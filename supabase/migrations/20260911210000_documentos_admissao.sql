-- Documentos de admissão: a relação por colaborador, com arquivo por item.
--
-- Decidido com o Daniel em 11/09/2026 (opção B do mockup). A opção A era usar
-- o checklist de onboarding que já existe — sai barato e marca "recebido",
-- mas NÃO guarda o arquivo. E o cadastro do colaborador tem um único par
-- `document_type`/`document_path`: uma relação de 17 documentos não cabe ali.
-- Registrar que o RG chegou sem guardar o RG não resolve o problema do RH.

-- ── Catálogo dos tipos ──────────────────────────────────────────────────────
--
-- Tabela e não constante no código: o RH acrescenta tipo sem release. É o
-- mesmo espírito da regra 5 — se cabe como dado configurável, é dado.
--
-- `condicional` marca o que não vale pra todo mundo (CNH, reservista, certidão
-- de casamento, documentos de dependentes). Sem essa marca o checklist nasce
-- impossível de zerar, e um checklist que nunca fecha deixa de ser lido.
create table if not exists public.rh_documento_tipos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  grupo       text not null default 'identificacao'
              check (grupo in ('identificacao','residencia','trabalho','familia','saude','formacao','outros')),
  condicional boolean not null default false,
  aceita_varios boolean not null default false,
  observacao_padrao text,
  ordem       int not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.rh_documento_tipos enable row level security;

drop policy if exists rh_documento_tipos_leitura on public.rh_documento_tipos;
create policy rh_documento_tipos_leitura on public.rh_documento_tipos
  for select using (public.current_user_is_pessoal());

drop policy if exists rh_documento_tipos_escrita on public.rh_documento_tipos;
create policy rh_documento_tipos_escrita on public.rh_documento_tipos
  for all using (public.current_user_is_rh()) with check (public.current_user_is_rh());

insert into public.rh_documento_tipos (nome, grupo, condicional, aceita_varios, observacao_padrao, ordem)
select * from (values
  ('RG',                          'identificacao', false, false, null, 0),
  ('CPF',                         'identificacao', false, false, null, 1),
  ('CNH',                         'identificacao', true,  false, 'Só para quem dirige a trabalho ou usa como identidade.', 2),
  ('Título de eleitor',           'identificacao', false, false, null, 3),
  ('Certificado de reservista',   'identificacao', true,  false, 'Homens até 45 anos.', 4),
  ('Cartão Nacional de Saúde (CNS)','saude',       false, false, null, 5),
  ('PIS/PASEP',                   'trabalho',      false, false, null, 6),
  ('CTPS',                        'trabalho',      false, false, 'Digital: basta o número e a data.', 7),
  ('Dados bancários',             'trabalho',      false, false, 'Se ainda não houver conta, registrar aqui o pedido de abertura e o banco.', 8),
  ('Comprovante de residência',   'residencia',    false, false, 'Até 90 dias.', 9),
  ('Certidão de nascimento',      'familia',       true,  false, 'Quando não houver certidão de casamento.', 10),
  ('Certidão de casamento ou união estável','familia', true, false, null, 11),
  ('Documentos de dependentes',   'familia',       true,  true,  'CPF e certidão de cada dependente.', 12),
  ('Carteira de vacinação',       'saude',         false, true,  null, 13),
  ('Comprovante de escolaridade', 'formacao',      false, false, null, 14),
  ('Certificados de cursos',      'formacao',      true,  true,  null, 15),
  ('Foto 3x4',                    'outros',        false, false, null, 16)
) as v(nome, grupo, condicional, aceita_varios, observacao_padrao, ordem)
where not exists (select 1 from public.rh_documento_tipos);

-- ── O documento de cada colaborador ─────────────────────────────────────────
--
-- `nao_se_aplica` é o que fecha o checklist de quem não dirige: o item não
-- fica pendente pra sempre nem some da lista — fica dito.
create table if not exists public.rh_colaborador_documentos (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.rh_colaboradores(id) on delete cascade,
  tipo_id        uuid not null references public.rh_documento_tipos(id) on delete restrict,
  status         text not null default 'pendente'
                 check (status in ('pendente','recebido','nao_se_aplica')),
  arquivo_path   text,
  arquivo_nome   text,
  observacao     text,
  recebido_por   uuid references public.profiles(id) on delete set null,
  recebido_em    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists rh_colaborador_documentos_colab_idx
  on public.rh_colaborador_documentos (colaborador_id);

alter table public.rh_colaborador_documentos enable row level security;

-- Espelha o predicado das tabelas-irmãs de RH (regra 3.1): quem administra
-- pessoal lê, quem é RH escreve. O DP lê e não escreve, como ficou decidido
-- na migration do cargo (20260911100000_papel_dp.sql).
drop policy if exists rh_colaborador_documentos_leitura on public.rh_colaborador_documentos;
create policy rh_colaborador_documentos_leitura on public.rh_colaborador_documentos
  for select using (public.current_user_is_pessoal());

drop policy if exists rh_colaborador_documentos_escrita on public.rh_colaborador_documentos;
create policy rh_colaborador_documentos_escrita on public.rh_colaborador_documentos
  for all using (public.current_user_is_rh()) with check (public.current_user_is_rh());

-- NÃO existe self-read aqui, e isso é decisão, não esquecimento. A revisão de
-- segurança de 11/09/2026 mostrou duas coisas: (a) nenhuma tela self-service
-- consome estes documentos — o único chamador de `useRHDocumentos` é a tela de
-- RH; e (b) `observacao` é campo livre que o RH digita achando que é nota
-- interna ("pediu 2ª via", "chegou ilegível"), e um `for select` da linha
-- inteira entregaria essa nota à própria pessoa pela API, sem nada na tela
-- avisando. Conceder acesso que o produto ainda não usa só cria superfície.
-- Quando nascer a pasta do colaborador, a policy entra JUNTO com a tela — e aí
-- escopando coluna (via view) ou rotulando a observação, como
-- `rh_attachments_self_read` faz escopando por `domain`.

-- Carimbo de quem recebeu. Não é o front que informa: o front manda o status,
-- o banco resolve o autor. Campo de autoria preenchido pelo cliente é campo
-- que dá pra mentir — mesmo motivo do freeze de `created_by` em lead_samples.
create or replace function public.rh_colaborador_documentos_touch()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.status = 'recebido' then
      new.recebido_por := (select auth.uid());
      new.recebido_em  := now();
    else
      new.recebido_por := null;
      new.recebido_em  := null;
    end if;
    return new;
  end if;
  if new.status = 'recebido' and old.status is distinct from 'recebido' then
    new.recebido_por := (select auth.uid());
    new.recebido_em  := now();
  elsif new.status <> 'recebido' then
    new.recebido_por := null;
    new.recebido_em  := null;
  else
    new.recebido_por := old.recebido_por;
    new.recebido_em  := old.recebido_em;
  end if;
  return new;
end;
$$;

drop trigger if exists rh_colaborador_documentos_touch_trg on public.rh_colaborador_documentos;
create trigger rh_colaborador_documentos_touch_trg
  before insert or update on public.rh_colaborador_documentos
  for each row execute function public.rh_colaborador_documentos_touch();

do $$ begin alter publication supabase_realtime add table public.rh_colaborador_documentos;
exception when duplicate_object then null; end $$;

-- ── Abrir a relação para um colaborador ─────────────────────────────────────
-- Idempotente: chamar de novo não duplica nem apaga o que já foi recebido,
-- só acrescenta o tipo que passou a existir depois.
create or replace function public.abrir_documentos_admissao(p_colaborador_id uuid)
returns int
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_n int;
begin
  if not public.current_user_is_rh() then
    raise exception 'Sem permissão';
  end if;
  -- Duas abas clicando "Abrir relação" ao mesmo tempo: o `not exists` abaixo
  -- não vê a linha que a outra transação ainda não commitou, e as duas
  -- inserem os 17. Não dá pra resolver com unique(colaborador_id, tipo_id)
  -- porque tipo com `aceita_varios` tem várias linhas de propósito.
  perform pg_advisory_xact_lock(hashtext('rh_docs_' || p_colaborador_id::text));
  insert into public.rh_colaborador_documentos (colaborador_id, tipo_id)
  select p_colaborador_id, t.id
  from public.rh_documento_tipos t
  where t.ativo
    and not exists (
      select 1 from public.rh_colaborador_documentos d
      where d.colaborador_id = p_colaborador_id and d.tipo_id = t.id
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.abrir_documentos_admissao(uuid) from public, anon;
grant execute on function public.abrir_documentos_admissao(uuid) to authenticated;

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Reusa `rh-documentos-colaborador`, que já existe e já é privado. Caminho
-- gravado pelo front: <colaborador_id>/<documento_id>-<timestamp>.<ext>
-- (`use-rh-documentos.js`). A pasta NÃO é exclusiva desta feature —
-- `NovoColaboradorModal.jsx` já grava <colaborador_id>/documento.<ext> no
-- mesmo bucket.
--
-- Sobre substituir `rh_doc_colaborador_rh_access` (de 20260703): a versão
-- ESCRITA naquele arquivo compara `profiles.role`, o escalar, mas a que está
-- em produção hoje já compara `roles[]` — alguém a corrigiu no caminho.
-- Conferido no banco em 11/09/2026, e confere com a regra 2.1 ("das 345
-- policies em produção, zero leem o escalar"). Ou seja: a troca abaixo é
-- no-op de acesso (mesmo conjunto de cargos, `exists` inline virando
-- `current_user_is_rh()`), feita só pra que o arquivo de migration e o banco
-- voltem a dizer a mesma coisa. Substituída e não acumulada: policy
-- permissiva sobrando continua valendo, e duas fazendo a mesma coisa é o que
-- deixa ninguém saber qual decide.
drop policy if exists rh_doc_colaborador_rh_access on storage.objects;
drop policy if exists rh_doc_colaborador_rh_all on storage.objects;
create policy rh_doc_colaborador_rh_all on storage.objects
  for all
  using (bucket_id = 'rh-documentos-colaborador' and public.current_user_is_rh())
  with check (bucket_id = 'rh-documentos-colaborador' and public.current_user_is_rh());

drop policy if exists rh_doc_colaborador_pessoal_read on storage.objects;
create policy rh_doc_colaborador_pessoal_read on storage.objects
  for select
  using (bucket_id = 'rh-documentos-colaborador' and public.current_user_is_pessoal());

-- Não há policy de "a própria pessoa baixa o próprio documento", pelo mesmo
-- motivo da tabela acima (nenhuma tela self-service consome isto ainda).
--
-- Fica registrado o que a revisão de 11/09/2026 mediu, porque a próxima
-- sessão que for escrever essa policy vai errar igual: o predicado óbvio —
-- `exists (select 1 from rh_colaboradores c where c.profile_id = auth.uid()
-- and c.id::text = (storage.foldername(name))[1])` — NUNCA concede nada.
-- Policy de `storage.objects` é avaliada com a role de quem pede, então o
-- subselect sofre a RLS de `rh_colaboradores`, que não tem self-read: a
-- pessoa enxerga 0 linhas ali e o `exists` é sempre falso. Medido em
-- produção: `is_own_colaborador(<id>)` devolve true (é SECURITY DEFINER) e o
-- mesmo teste inline devolve false. Quando a policy nascer, tem que ser por
-- função SECURITY DEFINER que receba o texto da pasta.
--
-- E há um bug PRÉ-EXISTENTE com essa mesma causa, fora do escopo desta
-- migration: `rh_attachments_self_read` usa o `exists` inline e por isso o
-- download do próprio holerite/ponto está morto em produção hoje. Merece
-- migration e decisão próprias — não pega carona aqui.
