-- Fundação do módulo de Pedidos + Catálogo, compartilhada entre o CRM
-- (back office) e a Plataforma B2B (portal do cliente). Arquitetura aprovada
-- com o Daniel 12/08/2026 — "uma base, três portas": um banco só, três
-- aplicações com deploys e logins separados, e o RLS como fronteira real.
--
-- DECISÕES QUE ESTE SCHEMA CARREGA
--
-- 1) Marca NÃO é coluna nova. A dimensão já existe na plataforma como
--    `company_id` (COMPANY_IDS = industria | resibag) e `clients.company_ids`
--    já é array — "cliente que compra das duas" já era representável.
--
-- 2) Preço é por cliente × produto, obrigatório, sem herança (client_products).
--    Modelo já projetado no portal (`conta_produtos`): conta aprovada começa
--    com ZERO produtos liberados, e não existe preço de tabela como fallback.
--    Por isso `price` é NOT NULL: não dá pra liberar produto sem negociar.
--    Pausar (`active = false`) preserva o preço negociado.
--    `products.preco_ref` NÃO entra em pedido — é só ponto de partida pro
--    vendedor ao liberar um produto pra um cliente novo.
--
-- 3) RLS FECHA POR OMISSÃO pro cliente externo. Todo predicado de cliente
--    passa por `current_user_client_id()`, que devolve NULL quando o login
--    não está vinculado a nenhum cliente — e `client_id = NULL` nunca é
--    verdadeiro, então login solto não vê linha nenhuma. Isto é deliberado e
--    é o oposto do molde de `agencia_sees_supplier()`, que abre por omissão
--    (login sem fornecedor amarrado enxerga tudo). Aquele molde NÃO serve
--    aqui: no portal, abrir por omissão é vazamento entre concorrentes.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Papel "cliente"
-- ─────────────────────────────────────────────────────────────────────────

-- ATENÇÃO: as duas listas abaixo NÃO são iguais entre si em produção —
-- `profiles_role_check` (papel principal) não aceita 'portal', só o array
-- `roles` aceita. Cada CHECK é reescrito preservando exatamente a lista que
-- já está no ar, acrescentando só 'cliente'. Igualar as duas aqui seria
-- alargar permissão de raspão.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin','gerente','vendedor','marketing','gerente_marketing','agencia','rh','gerente_rh','diretoria','comex','cliente']));

alter table public.profiles drop constraint profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check
  check (roles <@ array['admin','gerente','vendedor','marketing','gerente_marketing','agencia','rh','gerente_rh','portal','diretoria','comex','cliente']);

-- Vínculo login → cliente. NULL = funcionário (ou cliente ainda não vinculado,
-- que por construção não enxerga nada).
alter table public.profiles add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists idx_profiles_client_id on public.profiles(client_id) where client_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Helpers
-- ─────────────────────────────────────────────────────────────────────────

-- Cliente do login atual. NULL pra funcionário e pra login sem vínculo —
-- é essa nulidade que faz o RLS fechar por omissão.
create or replace function public.current_user_client_id()
returns uuid
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select client_id from public.profiles where id = auth.uid();
$$;
revoke all on function public.current_user_client_id() from public;
revoke execute on function public.current_user_client_id() from anon;
grant execute on function public.current_user_client_id() to authenticated;

-- Quem opera o back office comercial (libera produto, define preço, confere
-- pedido). Mesmo vocabulário de papel já usado no resto da plataforma.
create or replace function public.is_comercial_operator()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.current_user_roles() && array['admin','gerente','vendedor']::text[];
$$;
revoke all on function public.is_comercial_operator() from public;
revoke execute on function public.is_comercial_operator() from anon;
grant execute on function public.is_comercial_operator() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Catálogo
-- ─────────────────────────────────────────────────────────────────────────

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,                    -- industria | resibag
  sku text not null,
  name text not null,
  description text,
  unit text not null default 'un',
  moq integer check (moq is null or moq > 0),  -- pedido mínimo; portal já usa
  preco_ref numeric(12,2) check (preco_ref is null or preco_ref >= 0),
  certifications text[] not null default '{}', -- INMETRO, FSSC 22000, ANP…
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, sku)
);
create index idx_products_company_active on public.products(company_id) where active;

alter table public.products enable row level security;

-- Funcionário do comercial vê o catálogo das empresas a que tem acesso.
create policy products_read_interno on public.products for select
  using (
    public.current_user_is_admin()
    or public.current_user_has_role('diretoria')
    or (public.is_comercial_operator() and company_id = any (public.current_user_companies()))
  );

-- Cliente só enxerga produto que FOI LIBERADO pra ele e está ativo dos dois lados.
create policy products_read_cliente on public.products for select
  using (
    exists (
      select 1 from public.client_products cp
      where cp.product_id = products.id
        and cp.client_id = public.current_user_client_id()
        and cp.active
    )
    and products.active
  );

create policy products_write on public.products for all
  using (public.current_user_is_admin() or (public.current_user_has_role('gerente') and company_id = any (public.current_user_companies())))
  with check (public.current_user_is_admin() or (public.current_user_has_role('gerente') and company_id = any (public.current_user_companies())));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Contato e endereço do cliente
-- ─────────────────────────────────────────────────────────────────────────

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  job_title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_contacts_client on public.client_contacts(client_id);
alter table public.client_contacts enable row level security;

create policy client_contacts_interno on public.client_contacts for all
  using (public.current_user_is_admin() or public.is_comercial_operator())
  with check (public.current_user_is_admin() or public.is_comercial_operator());

create policy client_contacts_cliente on public.client_contacts for select
  using (client_id = public.current_user_client_id());

create table public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,                          -- "Planta Diadema"
  address text not null,
  city text,
  state text,
  zip text,
  cnpj_faturamento text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_addresses_client on public.client_addresses(client_id);
alter table public.client_addresses enable row level security;

create policy client_addresses_interno on public.client_addresses for all
  using (public.current_user_is_admin() or public.is_comercial_operator())
  with check (public.current_user_is_admin() or public.is_comercial_operator());

create policy client_addresses_cliente on public.client_addresses for select
  using (client_id = public.current_user_client_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Liberação + preço por cliente  (o "conta_produtos" do portal)
-- ─────────────────────────────────────────────────────────────────────────

create table public.client_products (
  client_id uuid not null references public.clients(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),  -- obrigatório: sem preço não libera
  active boolean not null default true,             -- pausar preserva a negociação
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, product_id)
);
create index idx_client_products_product on public.client_products(product_id);
alter table public.client_products enable row level security;

create policy client_products_interno on public.client_products for all
  using (public.current_user_is_admin() or public.is_comercial_operator())
  with check (public.current_user_is_admin() or public.is_comercial_operator());

-- Cliente lê só a própria linha — nunca o preço de outro cliente.
create policy client_products_cliente on public.client_products for select
  using (client_id = public.current_user_client_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Pedido
-- ─────────────────────────────────────────────────────────────────────────

create sequence if not exists public.orders_numero_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null default nextval('public.orders_numero_seq') unique,
  company_id text not null,                     -- industria | resibag
  client_id uuid not null references public.clients(id) on delete restrict,
  contact_id uuid references public.client_contacts(id) on delete set null,
  address_id uuid references public.client_addresses(id) on delete set null,
  origem text not null check (origem in ('portal','whatsapp','email','telefone','outro')),
  situacao text not null default 'rascunho'
    check (situacao in ('rascunho','enviado','conferencia','confirmado','producao','faturado','cancelado')),
  ordem_compra_cliente text,                    -- OC do cliente, sai na nota
  observacao text,
  -- Número do pedido no Kronosys, digitado à mão por quem sobe (o ERP não tem
  -- API). É o que fecha o ciclo pro cliente enxergar "confirmado" no portal.
  -- O CÓDIGO DO CLIENTE no Kronosys não vem aqui — `clients.external_codes`
  -- (jsonb) já existe pra isso e hoje está vazio; usar aquela coluna em vez de
  -- criar mais uma.
  kronosys_numero text,
  total numeric(12,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,  -- NULL = veio do portal
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_client on public.orders(client_id);
create index idx_orders_company_situacao on public.orders(company_id, situacao);
alter table public.orders enable row level security;

create policy orders_interno_read on public.orders for select
  using (
    public.current_user_is_admin()
    or public.current_user_has_role('diretoria')
    or (public.is_comercial_operator() and company_id = any (public.current_user_companies()))
  );

create policy orders_interno_write on public.orders for all
  using (public.is_comercial_operator() and company_id = any (public.current_user_companies()))
  with check (public.is_comercial_operator() and company_id = any (public.current_user_companies()));

-- Cliente lê só os pedidos dele.
create policy orders_cliente_read on public.orders for select
  using (client_id = public.current_user_client_id());

-- Cliente cria pedido só pra si, só na empresa a que tem acesso, e só em
-- estado inicial — nunca já confirmado, nunca já com número de Kronosys.
create policy orders_cliente_insert on public.orders for insert
  with check (
    client_id = public.current_user_client_id()
    and situacao in ('rascunho','enviado')
    and kronosys_numero is null
    and confirmed_by is null
    and exists (
      select 1 from public.clients c
      where c.id = orders.client_id and orders.company_id = any (c.company_ids)
    )
  );

-- Cliente edita só o próprio rascunho. Ao enviar, perde a caneta.
create policy orders_cliente_update on public.orders for update
  using (client_id = public.current_user_client_id() and situacao = 'rascunho')
  with check (
    client_id = public.current_user_client_id()
    and situacao in ('rascunho','enviado')
    and kronosys_numero is null
    and confirmed_by is null
  );

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  created_at timestamptz not null default now()
);
create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_product on public.order_items(product_id);
alter table public.order_items enable row level security;

create policy order_items_interno on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and public.is_comercial_operator() and o.company_id = any (public.current_user_companies())))
  with check (exists (select 1 from public.orders o where o.id = order_items.order_id and public.is_comercial_operator() and o.company_id = any (public.current_user_companies())));

create policy order_items_cliente_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.client_id = public.current_user_client_id()));

-- Item só entra em pedido do próprio cliente, ainda em rascunho, e só de
-- produto liberado pra ele. O preço é o de client_products — o cliente não
-- escolhe quanto paga.
create policy order_items_cliente_insert on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = public.current_user_client_id()
        and o.situacao = 'rascunho'
    )
    and exists (
      select 1 from public.client_products cp
      where cp.product_id = order_items.product_id
        and cp.client_id = public.current_user_client_id()
        and cp.active
        and cp.price = order_items.preco_unitario
    )
  );

-- Mudar a quantidade de um item do próprio rascunho. Mesmas amarras do insert:
-- o preço continua tendo que bater com o de client_products. Sem isto, o portal
-- teria que apagar e reinserir a cada "+1" no carrinho.
create policy order_items_cliente_update on public.order_items for update
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.client_id = public.current_user_client_id()
      and o.situacao = 'rascunho'
  ))
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = public.current_user_client_id()
        and o.situacao = 'rascunho'
    )
    and exists (
      select 1 from public.client_products cp
      where cp.product_id = order_items.product_id
        and cp.client_id = public.current_user_client_id()
        and cp.active
        and cp.price = order_items.preco_unitario
    )
  );

create policy order_items_cliente_delete on public.order_items for delete
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.client_id = public.current_user_client_id()
      and o.situacao = 'rascunho'
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Total do pedido — recalculado no banco, nunca confiado no client
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.recalc_order_total()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_order uuid;
begin
  v_order := coalesce(new.order_id, old.order_id);
  update public.orders o
  set total = coalesce((select sum(i.quantidade * i.preco_unitario) from public.order_items i where i.order_id = v_order), 0),
      updated_at = now()
  where o.id = v_order;
  return null;
end; $$;

create trigger trg_order_items_total
  after insert or update or delete on public.order_items
  for each row execute function public.recalc_order_total();

-- ─────────────────────────────────────────────────────────────────────────
-- 8. updated_at — reaproveita a função genérica que já existe
-- ─────────────────────────────────────────────────────────────────────────
-- `public.uniform_set_updated_at()` já está em produção (5 triggers) e o corpo
-- é exatamente `new.updated_at := now()` — nada específico de uniforme. Criar
-- uma `touch_updated_at()` idêntica ao lado seria a 21ª variante da mesma
-- coisa; regra 1 do CLAUDE.md manda importar, não reescrever parecido.

create trigger trg_products_touch before update on public.products for each row execute function public.uniform_set_updated_at();
create trigger trg_client_contacts_touch before update on public.client_contacts for each row execute function public.uniform_set_updated_at();
create trigger trg_client_addresses_touch before update on public.client_addresses for each row execute function public.uniform_set_updated_at();
create trigger trg_client_products_touch before update on public.client_products for each row execute function public.uniform_set_updated_at();
create trigger trg_orders_touch before update on public.orders for each row execute function public.uniform_set_updated_at();
