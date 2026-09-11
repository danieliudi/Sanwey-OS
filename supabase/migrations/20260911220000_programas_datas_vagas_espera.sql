-- Programas (ex-"Bem-estar"): várias datas por programa, vagas por horário e
-- lista de espera.
--
-- Decidido com o Daniel em 11/09/2026, mockup aprovado. Três limitações reais
-- do modelo anterior, todas no código e não em configuração:
--   1. uma sessão tinha UMA data — um evento de três dias exigia três sessões
--      e três links de QR diferentes;
--   2. cada horário comportava EXATAMENTE uma pessoa (o `NOT EXISTS` do
--      get_bemestar_horarios_disponiveis), sem como abrir turma;
--   3. "Nenhum horário livre no momento" era a mesma frase para três causas
--      distintas — programa encerrado, sem horário de início, sem horário de
--      fim — e a causa quase sempre era a terceira, enquanto a frase culpava
--      a lotação.
--
-- Conferido em produção antes de escrever: `rh_bemestar_sessoes` e
-- `rh_bemestar_fila` estão VAZIAS (0 linhas nas duas). O backfill abaixo
-- existe por correção, não por necessidade — em produção ele não move nada.
--
-- O que NÃO muda de nome (CLAUDE.md regra 18 — identificador que outro lado
-- lê é contrato, não nome): a rota pública `/bem-estar/:id` continua
-- `bem-estar`, porque ela já está impressa em QR code; o id de seção interno
-- continua `bemestar`, porque as permissões por módulo e a visibilidade do
-- Painel Executivo são gravadas por id na preferência de cada usuário.
-- "Programas" é rótulo de tela, e só.

-- ── A data: o que antes era coluna da sessão vira linha própria ─────────────
--
-- A recorrência do formulário GERA linhas aqui e para por aí: cada data vive
-- sozinha depois de criada. É o que permite apagar a do feriado, mudar o
-- horário de uma só ou acrescentar uma fora do padrão sem desmontar o resto.
-- Guardar a regra de recorrência e recalcular a agenda a partir dela faria o
-- contrário — toda edição de uma data viraria exceção a manter.
create table if not exists public.rh_bemestar_datas (
  id                uuid primary key default gen_random_uuid(),
  sessao_id         uuid not null references public.rh_bemestar_sessoes(id) on delete cascade,
  data              date not null,
  horario_inicio    time not null,
  horario_fim       time not null,
  slot_minutos      int  not null default 30 check (slot_minutos > 0),
  vagas_por_horario int  not null default 1  check (vagas_por_horario > 0),
  status            text not null default 'aberta' check (status in ('aberta','encerrada')),
  created_at        timestamptz not null default now(),
  constraint rh_bemestar_datas_janela check (horario_inicio < horario_fim),
  constraint rh_bemestar_datas_unica  unique (sessao_id, data)
);

create index if not exists rh_bemestar_datas_sessao_idx on public.rh_bemestar_datas (sessao_id, data);

alter table public.rh_bemestar_datas enable row level security;

-- Espelha linha por linha o predicado já em produção nas tabelas-irmãs
-- (rh_bemestar_sessoes / rh_bemestar_fila), em vez de inventar modelo novo.
drop policy if exists rh_bemestar_datas_rh_all on public.rh_bemestar_datas;
create policy rh_bemestar_datas_rh_all on public.rh_bemestar_datas
  for all
  using (current_user_is_admin() or current_user_has_role('gerente_rh') or current_user_has_role('rh'))
  with check (current_user_is_admin() or current_user_has_role('gerente_rh') or current_user_has_role('rh'));

drop policy if exists rh_bemestar_datas_diretoria_read on public.rh_bemestar_datas;
create policy rh_bemestar_datas_diretoria_read on public.rh_bemestar_datas
  for select using (current_user_has_role('diretoria'));

do $$ begin alter publication supabase_realtime add table public.rh_bemestar_datas;
exception when duplicate_object then null; end $$;

-- ── A reserva passa a apontar para a data ──────────────────────────────────
alter table public.rh_bemestar_fila
  add column if not exists data_id uuid references public.rh_bemestar_datas(id) on delete cascade;

create index if not exists rh_bemestar_fila_data_idx on public.rh_bemestar_fila (data_id, horario);

-- `espera` = lotado, quer ser chamado se vagar. `cancelado` = desistiu antes.
-- Os dois liberam vaga; `atendido`, `na_fila` e `chamado` ocupam.
-- O índice único `rh_bemestar_fila_horario_uniq (sessao_id, horario)` é o que
-- fazia "uma pessoa por horário" ser regra de SCHEMA. Ele precisa sair por
-- dois motivos, não um:
--   1. vagas por horário passa a ser configurável — 5 vagas às 09:00 são 5
--      linhas com o mesmo (sessao_id, horario);
--   2. ele nem sequer olhava a data. Com várias datas no mesmo programa,
--      09:00 de segunda e 09:00 de quarta colidiriam.
-- E ele tinha um terceiro defeito que ninguém chegou a ver: não excluía
-- `faltou`, enquanto a função de horários livres excluía — ou seja, o horário
-- de quem faltou aparecia livre na tela e o INSERT batia no índice.
-- A garantia de não estourar a turma passa a ser o `pg_advisory_xact_lock` +
-- contagem dentro de submit_bemestar_agendamento (reserva) e o gatilho de
-- capacidade no fim deste arquivo (promoção da espera).
drop index if exists public.rh_bemestar_fila_horario_uniq;

alter table public.rh_bemestar_fila drop constraint if exists rh_bemestar_fila_status_check;
alter table public.rh_bemestar_fila add constraint rh_bemestar_fila_status_check
  check (status in ('na_fila','chamado','atendido','faltou','espera','cancelado'));

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Uma linha de data por sessão que já tinha janela de horário. Sessão do
-- modelo antigo (fila FIFO, sem janela) continua sem data: ela nunca ofereceu
-- horário nenhum, e inventar uma data aqui seria fabricar agenda que ninguém
-- marcou. A tela do RH já avisa "Sem horário" nesse caso.
insert into public.rh_bemestar_datas (sessao_id, data, horario_inicio, horario_fim, slot_minutos, vagas_por_horario, status)
select s.id,
       coalesce(s.data, s.created_at::date),
       s.horario_inicio, s.horario_fim, s.slot_minutos, 1,
       case when s.status = 'aberta' then 'aberta' else 'encerrada' end
from public.rh_bemestar_sessoes s
where s.horario_inicio is not null
  and s.horario_fim is not null
  and not exists (select 1 from public.rh_bemestar_datas d where d.sessao_id = s.id)
on conflict on constraint rh_bemestar_datas_unica do nothing;

update public.rh_bemestar_fila f
   set data_id = d.id
  from public.rh_bemestar_datas d
 where d.sessao_id = f.sessao_id
   and f.data_id is null;

-- ── Quantas vagas cada horário ainda tem ───────────────────────────────────
-- Origem do número (CLAUDE.md regra 14): `vagas_livres` é
-- `rh_bemestar_datas.vagas_por_horario` menos as linhas de `rh_bemestar_fila`
-- naquele (data_id, horario) cujo status OCUPA lugar — `na_fila`, `chamado` e
-- `atendido`. `faltou` e `cancelado` devolvem a vaga; `espera` nunca ocupou
-- uma, então é contado à parte, e não some da conta.
create or replace function public.get_bemestar_horarios_por_data(p_data_id uuid)
returns table(horario time without time zone, vagas_total int, vagas_livres int, na_espera int)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_d record;
begin
  select d.*, s.status as sessao_status
    into v_d
    from public.rh_bemestar_datas d
    join public.rh_bemestar_sessoes s on s.id = d.sessao_id
   where d.id = p_data_id;
  if v_d.id is null or v_d.status <> 'aberta' or v_d.sessao_status <> 'aberta' then
    return;
  end if;

  return query
    select slot::time,
           v_d.vagas_por_horario,
           greatest(0, v_d.vagas_por_horario - (
             select count(*)::int from public.rh_bemestar_fila f
              where f.data_id = p_data_id and f.horario = slot::time
                and f.status in ('na_fila','chamado','atendido')
           )),
           (select count(*)::int from public.rh_bemestar_fila f
             where f.data_id = p_data_id and f.horario = slot::time and f.status = 'espera')
      -- generate_series sobre TIMESTAMP, não sobre TIME. Não é preciosismo:
      -- não existe `generate_series(time, time, interval)` no Postgres, e a
      -- versão anterior desta função (get_bemestar_horarios_disponiveis, de
      -- 20/07) passava `time` — ou seja, ela levantava
      -- `42883: function generate_series(time, time, interval) does not exist`
      -- pra QUALQUER sessão com janela de horário. Nunca apareceu porque
      -- `rh_bemestar_sessoes` está com 0 linhas em produção: o módulo foi
      -- construído e nunca usado. Pego na branch de teste em 11/09/2026.
      from generate_series(
        (v_d.data + v_d.horario_inicio)::timestamp,
        (v_d.data + v_d.horario_fim)::timestamp - (v_d.slot_minutos || ' minutes')::interval,
        (v_d.slot_minutos || ' minutes')::interval
      ) as slot
     order by 1;
end;
$$;
revoke all on function public.get_bemestar_horarios_por_data(uuid) from public;
grant execute on function public.get_bemestar_horarios_por_data(uuid) to anon, authenticated;

-- ── As datas de um programa, para a página pública ─────────────────────────
-- Devolve TAMBÉM o motivo de não haver o que escolher, em vez de devolver
-- vazio e deixar a página adivinhar — era exatamente a causa de "Nenhum
-- horário livre no momento" aparecer para três situações diferentes.
drop function if exists public.get_bemestar_sessao_publica(uuid);
create or replace function public.get_bemestar_sessao_publica(p_id uuid)
returns table(
  id uuid, titulo text, descricao text, status text,
  datas jsonb, motivo text
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s record;
  v_datas jsonb;
  v_total int;
  v_futuras int;
begin
  select * into v_s from public.rh_bemestar_sessoes s where s.id = p_id;
  if v_s.id is null then
    return;  -- link que não corresponde a programa nenhum: a página diz isso.
  end if;

  select count(*) into v_total from public.rh_bemestar_datas d where d.sessao_id = p_id;

  select coalesce(jsonb_agg(x order by x->>'data'), '[]'::jsonb), count(*)
    into v_datas, v_futuras
    from (
      select jsonb_build_object(
               'id', d.id,
               'data', d.data,
               'horario_inicio', d.horario_inicio,
               'horario_fim', d.horario_fim,
               'slot_minutos', d.slot_minutos,
               'vagas_por_horario', d.vagas_por_horario,
               'vagas_livres', greatest(0, (
                 (extract(epoch from (d.horario_fim - d.horario_inicio)) / (d.slot_minutos * 60))::int
                 * d.vagas_por_horario
               ) - (
                 select count(*)::int from public.rh_bemestar_fila f
                  where f.data_id = d.id and f.status in ('na_fila','chamado','atendido')
               ))
             ) as x
        from public.rh_bemestar_datas d
       where d.sessao_id = p_id
         and d.status = 'aberta'
         and d.data >= current_date
    ) t;

  return query select
    v_s.id, v_s.titulo, v_s.descricao, v_s.status,
    coalesce(v_datas, '[]'::jsonb),
    case
      when v_s.status <> 'aberta' then 'encerrado'
      when v_total = 0            then 'sem_datas'
      when v_futuras = 0          then 'sem_datas_futuras'
      else null
    end;
end;
$$;
revoke all on function public.get_bemestar_sessao_publica(uuid) from public;
grant execute on function public.get_bemestar_sessao_publica(uuid) to anon, authenticated;

-- Compatibilidade: a assinatura antiga continua existindo e continua
-- respondendo, apontada para a primeira data aberta do programa. Um QR
-- impresso ou uma aba deixada aberta antes do deploy não quebra.
create or replace function public.get_bemestar_horarios_disponiveis(p_id uuid)
returns table(horario time without time zone, disponivel boolean)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select h.horario, h.vagas_livres > 0
    from public.get_bemestar_horarios_por_data(
      (select d.id from public.rh_bemestar_datas d
        where d.sessao_id = p_id and d.status = 'aberta' and d.data >= current_date
        order by d.data limit 1)
    ) h;
$$;
revoke all on function public.get_bemestar_horarios_disponiveis(uuid) from public;
grant execute on function public.get_bemestar_horarios_disponiveis(uuid) to anon, authenticated;

-- ── Reservar ───────────────────────────────────────────────────────────────
-- `drop` antes de recriar, e não `create or replace`: a assinatura ganhou
-- `p_data_id` e `p_aceita_espera`. Com DEFAULT, o `replace` deixaria as DUAS
-- versões no schema e toda chamada viraria "function is not unique". Já
-- mordeu nesta plataforma.
drop function if exists public.submit_bemestar_agendamento(uuid, time without time zone, text, text, text, text, text);

create or replace function public.submit_bemestar_agendamento(
  p_sessao_id uuid,
  p_horario time without time zone,
  p_nome text,
  p_ramal text default null,
  p_email text default null,
  p_whatsapp text default null,
  p_frente text default null,
  p_data_id uuid default null,
  p_aceita_espera boolean default false
)
returns table(id uuid, senha integer, horario time without time zone, status text, posicao_espera int)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_d record;
  v_senha int;
  v_recent int;
  v_ocupadas int;
  v_novo_id uuid;
  v_status text;
  v_posicao int := null;
  v_data_id uuid;
begin
  if coalesce(trim(p_nome), '') = '' then raise exception 'Nome obrigatório'; end if;
  if coalesce(trim(p_email), '') = '' and coalesce(trim(p_whatsapp), '') = '' then
    raise exception 'Informe e-mail ou WhatsApp pra receber a confirmação';
  end if;
  if p_frente is not null and btrim(p_frente) <> '' and btrim(p_frente) not in ('sanwey','resibag','montemor') then
    raise exception 'Unidade inválida';
  end if;

  -- Sem data escolhida, cai na primeira aberta — é o que mantém em pé um
  -- link de programa de data única, que é como todos nasceram.
  v_data_id := coalesce(
    p_data_id,
    (select d.id from public.rh_bemestar_datas d
      where d.sessao_id = p_sessao_id and d.status = 'aberta' and d.data >= current_date
      order by d.data limit 1)
  );

  select d.*, s.status as sessao_status
    into v_d
    from public.rh_bemestar_datas d
    join public.rh_bemestar_sessoes s on s.id = d.sessao_id
   where d.id = v_data_id;

  if v_d.id is null then raise exception 'Data não encontrada'; end if;
  -- A data precisa pertencer ao programa do link: sem esta checagem, um
  -- data_id de OUTRO programa passaria, e a reserva iria parar na agenda
  -- errada.
  if v_d.sessao_id <> p_sessao_id then raise exception 'Data não pertence a este programa'; end if;
  if v_d.sessao_status <> 'aberta' or v_d.status <> 'aberta' then raise exception 'Programa não está aberto'; end if;
  if v_d.data < current_date then raise exception 'Essa data já passou'; end if;

  if p_horario is null or p_horario < v_d.horario_inicio or p_horario >= v_d.horario_fim then
    raise exception 'Horário fora da janela de atendimento';
  end if;
  -- Horário tem que cair na grade: sem isto dá pra reservar 09:07 num
  -- programa de slots de 30 min, e esse horário nunca mais aparece pra
  -- ninguém — some da grade e leva a vaga junto.
  if mod(
       (extract(epoch from (p_horario - v_d.horario_inicio)))::bigint,
       (v_d.slot_minutos * 60)::bigint
     ) <> 0 then
    raise exception 'Horário fora da grade de atendimento';
  end if;

  select count(*) into v_recent from public.rh_bemestar_fila
   where sessao_id = p_sessao_id and created_at > now() - interval '2 minutes';
  if v_recent >= 60 then raise exception 'Muitas entradas no momento. Tente novamente em instantes.'; end if;

  perform pg_advisory_xact_lock(hashtext('rh_bemestar_' || v_data_id::text || p_horario::text));

  select count(*) into v_ocupadas from public.rh_bemestar_fila f
   where f.data_id = v_data_id and f.horario = p_horario
     and f.status in ('na_fila','chamado','atendido');

  if v_ocupadas < v_d.vagas_por_horario then
    v_status := 'na_fila';
  elsif p_aceita_espera then
    v_status := 'espera';
    select count(*)::int + 1 into v_posicao from public.rh_bemestar_fila f
     where f.data_id = v_data_id and f.horario = p_horario and f.status = 'espera';
  else
    raise exception 'Esse horário acabou de lotar. Escolha outro ou entre na lista de espera.';
  end if;

  select coalesce(max(f.senha), 0) + 1 into v_senha
    from public.rh_bemestar_fila f where f.sessao_id = p_sessao_id;

  insert into public.rh_bemestar_fila (sessao_id, data_id, senha, nome, frente, horario, ramal, email, whatsapp, status)
  values (p_sessao_id, v_data_id, v_senha, trim(p_nome), nullif(btrim(coalesce(p_frente, '')), ''), p_horario,
          nullif(trim(coalesce(p_ramal, '')), ''), nullif(trim(coalesce(p_email, '')), ''),
          nullif(trim(coalesce(p_whatsapp, '')), ''), v_status)
  returning rh_bemestar_fila.id into v_novo_id;

  return query select v_novo_id, v_senha, p_horario, v_status, v_posicao;
end;
$$;
revoke all on function public.submit_bemestar_agendamento(uuid, time without time zone, text, text, text, text, text, uuid, boolean) from public;
grant execute on function public.submit_bemestar_agendamento(uuid, time without time zone, text, text, text, text, text, uuid, boolean) to anon, authenticated;

-- ── Promover da espera é ação do RH, e tem teto ────────────────────────────
--
-- Promoção automática (alguém marca "faltou", o primeiro da espera vira
-- reserva sozinho) foi descartada de propósito: ninguém avisaria a pessoa, e
-- ela descobriria que tinha horário depois que ele passou. O RH promove pela
-- tela, e é nesse momento que sai a confirmação por e-mail.
--
-- O teto, porém, é do banco e não da tela: promover além de
-- `vagas_por_horario` é exatamente a classe de bug "guardrail de transição
-- ignorado". Sem isto, dois cliques rápidos em duas abas estouram a turma.
create or replace function public.rh_bemestar_fila_guard_capacidade()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_vagas int;
  v_ocupadas int;
begin
  if new.status not in ('na_fila','chamado','atendido') then return new; end if;
  if old.status in ('na_fila','chamado','atendido') then return new; end if;
  if new.data_id is null then return new; end if;

  select d.vagas_por_horario into v_vagas
    from public.rh_bemestar_datas d where d.id = new.data_id;
  if v_vagas is null then return new; end if;

  select count(*) into v_ocupadas from public.rh_bemestar_fila f
   where f.data_id = new.data_id and f.horario = new.horario
     and f.status in ('na_fila','chamado','atendido')
     and f.id <> new.id;

  if v_ocupadas >= v_vagas then
    raise exception 'Esse horário está lotado (% de % vagas) — libere uma vaga antes de promover.', v_ocupadas, v_vagas;
  end if;
  return new;
end;
$$;

drop trigger if exists rh_bemestar_fila_guard_capacidade_trg on public.rh_bemestar_fila;
create trigger rh_bemestar_fila_guard_capacidade_trg
  before update on public.rh_bemestar_fila
  for each row execute function public.rh_bemestar_fila_guard_capacidade();
