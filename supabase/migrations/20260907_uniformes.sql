-- APLICADA em 11/08/2026 (migration `uniformes_coleta_compra_retirada`).
-- Uniformes — coleta por departamento, compra via Compras de Marketing,
-- e retirada assinada. Decidido com o Daniel 11/08/2026.
--
-- Desenho em uma frase: o módulo NÃO refaz o motor de compra. A rodada
-- consolida N linhas e vira UM card de marketing_purchase_requests (mesmo
-- movimento que approve_marketing_request_as_purchase já faz hoje); depois do
-- "pago", a rodada volta a mandar, pra distribuição e retirada.
--
-- Por que uma lista de pessoas PRÓPRIA em vez de reusar rh_colaboradores:
-- o de-para com a planilha real (Controle Uniformes Geral.xlsx, 11/08) deu
-- 38 das 50 pessoas SEM correspondente no cadastro, e das 12 que casaram a
-- maioria era ambígua (3 "Tatiane" e 2 "Everton" na planilha, em
-- departamentos diferentes; "Rafael"/"Leonardo" duplicados do lado do
-- sistema). A Lista DP tem prédio e departamento — dado que o cadastro não
-- tem — então ela é a fonte melhor, não a pior. O vínculo com
-- rh_colaboradores existe (uniform_people.colaborador_id) mas é OPCIONAL e
-- manual: serve pra autoconfirmação de retirada de quem tem login, não pra
-- travar a importação.

-- ── Catálogo de peças ────────────────────────────────────────────────────
-- A escala de tamanho vive NA PEÇA porque ela muda por peça (achado real:
-- POLO usa P/M/G/GG, SOCIAL usa Nº 1..7 e também P/G na feminina). Uma lista
-- única de tamanhos ofereceria "Nº 3" pra uma polo.
create table if not exists uniform_items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  sizes        text[] not null default '{}',
  models       text[] not null default array['Masculina','Feminina'],
  unit_price   numeric,
  is_active    boolean not null default true,
  company_ids  text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Pessoas ──────────────────────────────────────────────────────────────
-- Editável de verdade (pedido explícito do Daniel: gente entra e sai). Quem
-- sai vira is_active=false — nunca delete, senão o histórico de retirada de
-- rodadas passadas perde o nome.
create table if not exists uniform_people (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  department     text,
  site           text,                                   -- prédio: 148, 201, 227, Monte Mor
  colaborador_id uuid references rh_colaboradores(id) on delete set null,
  is_active      boolean not null default true,
  company_ids    text[] not null default '{}',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists uniform_people_dept_idx on uniform_people (department) where is_active;

-- ── Tamanho por pessoa e por peça ────────────────────────────────────────
-- É ISTO que faz o gestor responder só "quantos" na rodada, em vez de
-- redigitar departamento/funcionário/modelo/tamanho/bordado toda vez.
create table if not exists uniform_person_sizes (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references uniform_people(id) on delete cascade,
  item_id    uuid not null references uniform_items(id) on delete cascade,
  model      text,
  size       text,
  updated_at timestamptz not null default now(),
  unique (person_id, item_id)
);

-- ── Rodada de coleta ─────────────────────────────────────────────────────
create table if not exists uniform_rounds (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,                    -- "CT Fev-26"
  deadline             date,
  status               text not null default 'coleta',   -- coleta | fechada | comprada | distribuindo | concluida
  purchase_request_id  uuid references marketing_purchase_requests(id) on delete set null,
  company_ids          text[] not null default '{}',
  created_by           uuid references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── Linha da rodada ──────────────────────────────────────────────────────
-- As 73 linhas de "CT Fev-26" viram 73 destas. Aprovação é POR DEPARTAMENTO
-- (o gestor aprova a própria área de uma vez), por isso approved_* fica na
-- linha mas é preenchido em lote.
--
-- pickup_point responde ao "dá pra fazer retirada no Marketing ou no RH?":
-- o ponto é dado da linha, não do módulo — quem estiver mais perto entrega.
create table if not exists uniform_round_lines (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references uniform_rounds(id) on delete cascade,
  person_id      uuid not null references uniform_people(id) on delete restrict,
  item_id        uuid not null references uniform_items(id) on delete restrict,
  department     text,                                   -- congelado na criação da linha
  model          text,
  size           text,
  embroidery     text,                                   -- Sanwey | Resibag
  quantity       integer not null default 0,
  unit_price     numeric,
  approved_by    uuid references profiles(id) on delete set null,
  approved_at    timestamptz,
  picked_up_at   timestamptz,
  picked_up_by   uuid references profiles(id) on delete set null,  -- quem CONFERIU a entrega
  pickup_point   text,                                   -- marketing | rh
  signature_path text,                                   -- assinatura na tela (Storage)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists uniform_round_lines_round_idx  on uniform_round_lines (round_id);
create index if not exists uniform_round_lines_person_idx on uniform_round_lines (person_id);

-- ── updated_at ───────────────────────────────────────────────────────────
create or replace function uniform_set_updated_at() returns trigger
language plpgsql set search_path to 'public','pg_temp' as $fn$
begin new.updated_at := now(); return new; end $fn$;

do $blk$
declare t text;
begin
  foreach t in array array['uniform_items','uniform_people','uniform_person_sizes','uniform_rounds','uniform_round_lines'] loop
    execute format('drop trigger if exists %1$s_updated_at on %1$s', t);
    execute format('create trigger %1$s_updated_at before update on %1$s for each row execute function uniform_set_updated_at()', t);
  end loop;
end $blk$;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table uniform_items        enable row level security;
alter table uniform_people       enable row level security;
alter table uniform_person_sizes enable row level security;
alter table uniform_rounds       enable row level security;
alter table uniform_round_lines  enable row level security;

-- Predicado espelhado no da tabela-irmã mais próxima já em produção
-- (marketing_purchase_requests), com a diferença deliberada de aceitar
-- company_ids vazio — uniforme é do Grupo, não de uma frente só (mesma
-- correção que marketing_budgets já carrega; '{}' && qualquer_coisa é FALSE
-- em Postgres e trancaria a tabela inteira).
create or replace function uniform_can_write() returns boolean
language sql stable security definer set search_path to 'public','pg_temp' as $fn$
  select current_user_is_admin() or current_user_is_marketing() or current_user_is_rh();
$fn$;
revoke all on function uniform_can_write() from public;
revoke execute on function uniform_can_write() from anon;
grant execute on function uniform_can_write() to authenticated;

-- Marketing e RH escrevem; diretoria lê. RH entra porque a retirada pode
-- acontecer no balcão do RH (decidido 11/08) — não é acesso de cortesia.
do $blk$
declare t text;
begin
  foreach t in array array['uniform_items','uniform_people','uniform_person_sizes','uniform_rounds','uniform_round_lines'] loop
    execute format('drop policy if exists %1$s_write on %1$s', t);
    execute format('drop policy if exists %1$s_read  on %1$s', t);
    execute format('create policy %1$s_write on %1$s for all to authenticated using (uniform_can_write()) with check (uniform_can_write())', t);
    execute format('create policy %1$s_read on %1$s for select to authenticated using (uniform_can_write() or current_user_has_role(''diretoria''))', t);
  end loop;
end $blk$;
