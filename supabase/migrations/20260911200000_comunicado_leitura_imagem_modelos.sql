-- Comunicado: confirmação de leitura, imagem, conteúdo sensível, modelos e
-- documento pra assinatura. Decidido com o Daniel em 11/09/2026, sobre mockup.

-- ── 1. Colunas novas no comunicado ──────────────────────────────────────────
alter table public.rh_comunicados
  add column if not exists sensivel        boolean not null default false,
  add column if not exists imagem_path     text,
  add column if not exists documento_path  text;

comment on column public.rh_comunicados.sensivel is
  'Conteúdo sensível: o e-mail vira só um AVISO com o título e um link — sem corpo e sem imagem. Decidido com o Daniel: na maioria dos comunicados o sensível é o texto, não a imagem, então tirar só a imagem deixaria o marcador decorativo.';
comment on column public.rh_comunicados.documento_path is
  'PDF anexado pra coleta de assinatura via D4Sign (caminho A). A D4Sign assina ARQUIVO, não bloco de texto — por isso o documento é anexado, não gerado a partir do comunicado.';

-- ── 2. Confirmação de leitura ───────────────────────────────────────────────
--
-- Uma linha por destinatário, criada NO ENVIO. Não é recalculada depois: o
-- quadro de pessoas muda, e recontar em janeiro daria outro conjunto para o
-- mesmo comunicado (mesma razão do alcance medido, regra 14).
--
-- `canal_email` e `canal_plataforma` gravam o que a pessoa REALMENTE tinha na
-- hora. É o que permite a terceira coluna da tela: quem não tinha canal
-- nenhum não deixou de confirmar — nunca teve como. Somar essa pessoa com
-- quem ignorou faria o número mentir.
create table if not exists public.rh_comunicado_leituras (
  id               uuid primary key default gen_random_uuid(),
  comunicado_id    uuid not null references public.rh_comunicados(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  -- Segredo do link do e-mail. Pessoal por destinatário: o link de uma pessoa
  -- não confirma pela outra.
  token            text not null unique default encode(gen_random_bytes(24), 'hex'),
  canal_email      boolean not null default false,
  canal_plataforma boolean not null default false,
  confirmado_em    timestamptz,
  origem           text check (origem in ('email','plataforma')),
  unique (comunicado_id, profile_id)
);

alter table public.rh_comunicado_leituras enable row level security;

create index if not exists rh_comunicado_leituras_comunicado_idx
  on public.rh_comunicado_leituras (comunicado_id);

-- Quem envia comunicado lê a lista. A própria pessoa lê a own linha (é o que
-- a plataforma usa pro botão "Confirmei a leitura" saber se já confirmou).
drop policy if exists rh_comunicado_leituras_rh on public.rh_comunicado_leituras;
create policy rh_comunicado_leituras_rh on public.rh_comunicado_leituras
  for select using (current_user_is_admin() or current_user_has_role('gerente_rh') or current_user_has_role('diretoria'));

drop policy if exists rh_comunicado_leituras_propria on public.rh_comunicado_leituras;
create policy rh_comunicado_leituras_propria on public.rh_comunicado_leituras
  for select using (profile_id = (select auth.uid()));

-- Confirmar é só pela RPC abaixo (SECURITY DEFINER): sem policy de UPDATE,
-- ninguém marca a própria leitura direto pelo PostgREST nem, muito menos, a
-- dos outros.

-- ── 3. Confirmar pelo LINK do e-mail (sem login) ────────────────────────────
--
-- Chamável por anon de propósito: o link chega por e-mail e a pessoa clica no
-- celular, deslogada. O segredo é o token; sem ele a função não faz nada, e
-- ela nunca devolve dado de ninguém — só o título do comunicado, pra tela de
-- confirmação dizer o que foi confirmado.
create or replace function public.confirmar_leitura_por_token(p_token text)
returns table(ok boolean, titulo text, ja_confirmado boolean)
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_id uuid; v_com uuid; v_ja timestamptz; v_tit text;
begin
  if coalesce(trim(p_token), '') = '' then
    return query select false, null::text, false; return;
  end if;

  select l.id, l.comunicado_id, l.confirmado_em into v_id, v_com, v_ja
  from public.rh_comunicado_leituras l
  where l.token = p_token;

  if v_id is null then
    -- Token inválido e token inexistente respondem igual: não vira oráculo.
    return query select false, null::text, false; return;
  end if;

  select c.titulo into v_tit from public.rh_comunicados c where c.id = v_com;

  if v_ja is not null then
    return query select true, v_tit, true; return;
  end if;

  update public.rh_comunicado_leituras
     set confirmado_em = now(), origem = 'email'
   where id = v_id;

  return query select true, v_tit, false;
end;
$$;
revoke all on function public.confirmar_leitura_por_token(text) from public;
grant execute on function public.confirmar_leitura_por_token(text) to anon, authenticated;

-- ── 4. Confirmar DENTRO da plataforma ───────────────────────────────────────
create or replace function public.confirmar_leitura_comunicado(p_comunicado_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'Autenticação necessária'; end if;
  update public.rh_comunicado_leituras
     set confirmado_em = coalesce(confirmado_em, now()),
         origem = coalesce(origem, 'plataforma')
   where comunicado_id = p_comunicado_id and profile_id = v_uid;
  return found;
end;
$$;
revoke all on function public.confirmar_leitura_comunicado(uuid) from public, anon;
grant execute on function public.confirmar_leitura_comunicado(uuid) to authenticated;

-- ── 5. Lista de leitura pra tela do RH ──────────────────────────────────────
-- Devolve nome porque é isso que a tela mostra; por isso é restrita a quem já
-- podia ver a lista de comunicados.
create or replace function public.comunicado_leituras(p_comunicado_id uuid)
returns table(profile_id uuid, nome text, confirmado_em timestamptz, origem text,
              canal_email boolean, canal_plataforma boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not (current_user_is_admin() or current_user_has_role('gerente_rh') or current_user_has_role('diretoria')) then
    raise exception 'Sem permissão';
  end if;
  return query
    select l.profile_id, coalesce(p.name, p.email, 'Sem nome'), l.confirmado_em, l.origem,
           l.canal_email, l.canal_plataforma
    from public.rh_comunicado_leituras l
    left join public.profiles p on p.id = l.profile_id
    where l.comunicado_id = p_comunicado_id
    order by (l.confirmado_em is null), l.confirmado_em desc, coalesce(p.name, p.email);
end;
$$;
revoke all on function public.comunicado_leituras(uuid) from public, anon;
grant execute on function public.comunicado_leituras(uuid) to authenticated;

-- ── 6. Modelos de comunicado ────────────────────────────────────────────────
--
-- Guarda O QUE SE DIZ, nunca COMO SE PARECE. Decidido com o Daniel: o RH edita
-- título, texto e escopo sugerido; a casca do e-mail, logo, tipografia, cor da
-- barra e o selo de importante continuam vindo do template da plataforma, pra
-- identidade visual não virar campo de formulário.
create table if not exists public.rh_comunicado_modelos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  icone       text,
  titulo      text,
  corpo       text,
  importante  boolean not null default false,
  sensivel    boolean not null default false,
  ordem       int not null default 0,
  -- `de_fabrica` marca os que vieram com a plataforma. Editáveis como os
  -- outros; a marca existe só pra ninguém ficar sem referência se apagar todos.
  de_fabrica  boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.rh_comunicado_modelos enable row level security;

drop policy if exists rh_comunicado_modelos_leitura on public.rh_comunicado_modelos;
create policy rh_comunicado_modelos_leitura on public.rh_comunicado_modelos
  for select using (current_user_is_admin() or current_user_has_role('gerente_rh'));

drop policy if exists rh_comunicado_modelos_escrita on public.rh_comunicado_modelos;
create policy rh_comunicado_modelos_escrita on public.rh_comunicado_modelos
  for all using (current_user_is_admin() or current_user_has_role('gerente_rh'))
  with check (current_user_is_admin() or current_user_has_role('gerente_rh'));

insert into public.rh_comunicado_modelos (nome, icone, titulo, corpo, importante, sensivel, ordem, de_fabrica)
select * from (values
  ('Recesso', 'recesso', 'Recesso de fim de ano',
   E'Vamos parar de [data de início] a [data de retorno].\n\nA escala de plantão sai até [data]. Quem estiver de plantão será avisado individualmente.\n\nDúvidas com [quem procurar].',
   false, false, 0, true),
  ('Feriado', 'feriado', 'Feriado de [nome do feriado] — [data]',
   E'Na [data] não haverá expediente.\n\nO que continua funcionando: [listar].\nRetomamos o horário normal em [data].',
   false, false, 1, true),
  ('Aviso de segurança', 'seguranca', 'Aviso de segurança — [assunto]',
   E'O que aconteceu: [descrever].\n\nO que fazer agora: [instrução].\n\nO que NÃO fazer: [instrução].\n\nEm caso de dúvida, procure [quem] imediatamente.',
   true, false, 2, true),
  ('Mudança de política', 'politica', 'Mudança na política de [assunto]',
   E'O que muda: [descrever].\n\nA partir de quando: [data].\n\nPor que mudou: [motivo].\n\nQuem procurar em caso de dúvida: [nome].',
   false, false, 3, true)
) as v(nome, icone, titulo, corpo, importante, sensivel, ordem, de_fabrica)
where not exists (select 1 from public.rh_comunicado_modelos where de_fabrica);

do $$
begin
  alter publication supabase_realtime add table public.rh_comunicado_modelos;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.rh_comunicado_leituras;
exception when duplicate_object then null;
end $$;

-- Grants nominais (ver 20260911160000_grants_reconstrucao.sql): função que
-- devolve nome de gente não pode ficar aberta a anon.
revoke execute on function public.comunicado_leituras(uuid) from anon;
revoke execute on function public.confirmar_leitura_comunicado(uuid) from anon;

-- ── 7. Bucket dos anexos do comunicado ──────────────────────────────────────
--
-- PRIVADO, e não público. O mockup falava em endereço público pra imagem
-- aparecer no e-mail; o caminho melhor é link ASSINADO de validade longa,
-- gerado no envio pela edge function (service_role assina sem depender de
-- policy). Não é listável nem indexável, e o comunicado SENSÍVEL simplesmente
-- nunca ganha link — a imagem dele não sai da plataforma.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comunicado-anexos', 'comunicado-anexos', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Caminho: comunicado-anexos/<comunicado_id>/<arquivo>
drop policy if exists comunicado_anexos_rh_all on storage.objects;
create policy comunicado_anexos_rh_all on storage.objects
  for all
  using (bucket_id = 'comunicado-anexos'
         and (current_user_is_admin() or current_user_has_role('gerente_rh')))
  with check (bucket_id = 'comunicado-anexos'
         and (current_user_is_admin() or current_user_has_role('gerente_rh')));

-- Destinatário lê o anexo do comunicado que ELE recebeu — e só esse. O vínculo
-- é a própria linha de leitura, que já existe por destinatário.
drop policy if exists comunicado_anexos_destinatario_read on storage.objects;
create policy comunicado_anexos_destinatario_read on storage.objects
  for select
  using (
    bucket_id = 'comunicado-anexos'
    and exists (
      select 1 from public.rh_comunicado_leituras l
      where l.profile_id = (select auth.uid())
        and l.comunicado_id::text = (storage.foldername(name))[1]
    )
  );

-- ── 8. broadcast_announcement grava as linhas de leitura ────────────────────
--
-- Aqui é o único lugar que sabe QUEM era o escopo na hora do envio, e é por
-- isso que o token nasce aqui: recomputar depois daria outro conjunto.
drop function if exists public.broadcast_announcement(text, text, text, text, jsonb, boolean, text[]);

create function public.broadcast_announcement(
  p_title text, p_body text,
  p_scope_type text default 'todos', p_scope_value text default null,
  p_link jsonb default null, p_importante boolean default false,
  p_canais text[] default array['plataforma'],
  p_sensivel boolean default false,
  p_imagem_path text default null,
  p_documento_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_count integer := 0;
  v_type  text := case when p_importante then 'comunicado_importante' else 'comunicado' end;
  v_id    uuid;
  v_quer_email boolean := 'email' = any(coalesce(p_canais, array['plataforma']));
  v_com_email int; v_sem_email int;
begin
  if v_uid is null then raise exception 'Autenticação necessária'; end if;
  if not (current_user_is_admin() or current_user_has_role('gerente_rh')) then
    raise exception 'Sem permissão para enviar comunicados';
  end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Título obrigatório'; end if;
  if p_scope_type not in ('todos','frente','departamento') then raise exception 'Escopo inválido'; end if;
  if coalesce(array_length(p_canais, 1), 0) = 0 then raise exception 'Escolha ao menos um canal'; end if;
  if exists (select 1 from unnest(p_canais) c where c not in ('plataforma','email')) then
    raise exception 'Canal inválido';
  end if;

  if 'plataforma' = any(p_canais) then
    insert into public.notifications (recipient_id, type, title, body, link, created_by)
    select d.profile_id, v_type, p_title, p_body, p_link, v_uid
    from public.comunicado_destinatarios(p_scope_type, p_scope_value, v_uid) d
    where p_importante or d.aceita_notificacao;
    get diagnostics v_count = row_count;
  end if;

  select count(distinct lower(trim(d.email))) filter (where public.email_utilizavel(d.email)),
         count(*) filter (where not public.email_utilizavel(d.email))
    into v_com_email, v_sem_email
  from public.comunicado_destinatarios(p_scope_type, p_scope_value, v_uid) d;

  insert into public.rh_comunicados
    (titulo, corpo, scope_type, scope_value, importante, canais, enviado_por,
     alcance_plataforma, alcance_email, sem_email, email_status,
     sensivel, imagem_path, documento_path)
  values
    (p_title, p_body, p_scope_type, p_scope_value, p_importante, p_canais, v_uid,
     v_count,
     case when v_quer_email then v_com_email else 0 end,
     case when v_quer_email then v_sem_email else 0 end,
     case when v_quer_email then 'pendente' else 'nao_solicitado' end,
     p_sensivel, p_imagem_path, p_documento_path)
  returning id into v_id;

  -- Uma linha por destinatário, com o canal que a pessoa REALMENTE tinha.
  insert into public.rh_comunicado_leituras (comunicado_id, profile_id, canal_email, canal_plataforma)
  select v_id, d.profile_id,
         v_quer_email and public.email_utilizavel(d.email),
         ('plataforma' = any(p_canais)) and (p_importante or d.aceita_notificacao)
  from public.comunicado_destinatarios(p_scope_type, p_scope_value, v_uid) d
  on conflict (comunicado_id, profile_id) do nothing;

  return jsonb_build_object(
    'comunicado_id', v_id,
    'alcance_plataforma', v_count,
    'alcance_email', case when v_quer_email then v_com_email else 0 end,
    'sem_email', case when v_quer_email then v_sem_email else 0 end
  );
end;
$$;
revoke all on function public.broadcast_announcement(text, text, text, text, jsonb, boolean, text[], boolean, text, text) from public, anon;
grant execute on function public.broadcast_announcement(text, text, text, text, jsonb, boolean, text[], boolean, text, text) to authenticated;
