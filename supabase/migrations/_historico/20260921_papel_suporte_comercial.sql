-- Papel "suporte comercial" — Júlio, Priscila, Tainá e quem mais entrar.
-- Aplicada em produção 12/08/2026. Definida com o Daniel a partir da
-- descrição da própria área:
--
--   "quem atende o cliente, quem toma conta do cliente é o vendedor. O
--    suporte interno dá o suporte pra gente. Eles não vendem, eles não
--    negociam." E: "eles que sobem [no Kronosys]. Eles que sabem o preço
--    tela dos produtos e que ajudam os vendedores com esse valor de tabela,
--    pro vendedor colocar a margem em cima, de acordo com as orientações da
--    gerência."
--
-- DOIS PREÇOS, DOIS DONOS — é o coração deste papel:
--   products.preco_tabela   → do SUPORTE. Preço de tabela ("preço tela"),
--                             base pro vendedor calcular. Nunca vai em pedido.
--   client_products.price   → do VENDEDOR. Tabela + margem. É o que o cliente
--                             paga, e é o único que entra no pedido.
--
-- Sem esta separação, o caminho fácil seria dar login de "vendedor" pro
-- suporte só pra ele alcançar a Central de Pedidos — e junto ele herdaria a
-- caneta da negociação.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. O papel
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin','gerente','vendedor','suporte','marketing','gerente_marketing','agencia','rh','gerente_rh','diretoria','comex','cliente']));

alter table public.profiles drop constraint profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check
  check (roles <@ array['admin','gerente','vendedor','suporte','marketing','gerente_marketing','agencia','rh','gerente_rh','portal','diretoria','comex','cliente']);

-- Deliberadamente SEPARADO de is_comercial_operator(): aquele é "quem
-- negocia" (admin, gerente, vendedor) e continua sendo o único caminho pro
-- preço do cliente. Este é "quem opera".
create or replace function public.is_comercial_support()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.current_user_roles() && array['suporte']::text[];
$$;
revoke all on function public.is_comercial_support() from public;
revoke execute on function public.is_comercial_support() from anon;
grant execute on function public.is_comercial_support() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Catálogo: nome do preço de tabela + quem mantém
-- ─────────────────────────────────────────────────────────────────────────
-- `preco_ref` nasceu ontem como "referência" sem dono definido. Agora tem
-- dono e tem nome na boca do time. Zero linhas na tabela, o rename é de
-- graça — e nome que bate com a palavra que a área usa evita a próxima
-- confusão entre os dois preços.

alter table public.products rename column preco_ref to preco_tabela;
comment on column public.products.preco_tabela is
  'Preço de tabela ("preço tela"), mantido pelo suporte comercial. Base pro vendedor calcular o preço do cliente somando a margem. NUNCA entra em pedido — quem entra é client_products.price.';
comment on column public.client_products.price is
  'Preço negociado deste cliente para este produto: preço de tabela + margem, definido pelo VENDEDOR dono da conta. É o único preço que entra em pedido.';

alter policy products_read_interno on public.products
  using (
    public.current_user_is_admin()
    or public.current_user_has_role('diretoria')
    or ((public.is_comercial_operator() or public.is_comercial_support())
        and company_id = any (public.current_user_companies()))
  );

alter policy products_write on public.products
  using (
    public.current_user_is_admin()
    or ((public.current_user_has_role('gerente') or public.is_comercial_support())
        and company_id = any (public.current_user_companies()))
  )
  with check (
    public.current_user_is_admin()
    or ((public.current_user_has_role('gerente') or public.is_comercial_support())
        and company_id = any (public.current_user_companies()))
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Preço do cliente: suporte VÊ, nunca ESCREVE
-- ─────────────────────────────────────────────────────────────────────────
-- Ver é necessário — eles conferem o pedido, que já carrega o preço item a
-- item; esconder a liberação não esconderia nada e só atrapalharia a
-- conferência. Escrever é a linha que não cruzam: é a negociação do vendedor.
-- Por isso é policy de SELECT à parte, e não um ramo dentro da policy `for
-- all` que já existe — assim não há como um ramo novo abrir escrita sem
-- querer.

create policy client_products_suporte_read on public.client_products for select
  using (public.is_comercial_support());

create policy client_contacts_suporte_read on public.client_contacts for select
  using (public.is_comercial_support());

create policy client_addresses_suporte_read on public.client_addresses for select
  using (public.is_comercial_support());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Central de Pedidos: é onde o suporte trabalha
-- ─────────────────────────────────────────────────────────────────────────

alter policy orders_interno_read on public.orders
  using (
    public.current_user_is_admin()
    or public.current_user_has_role('diretoria')
    or ((public.is_comercial_operator() or public.is_comercial_support())
        and company_id = any (public.current_user_companies()))
  );

alter policy orders_interno_write on public.orders
  using ((public.is_comercial_operator() or public.is_comercial_support())
         and company_id = any (public.current_user_companies()))
  with check ((public.is_comercial_operator() or public.is_comercial_support())
              and company_id = any (public.current_user_companies()));

alter policy order_items_interno on public.order_items
  using (exists (select 1 from public.orders o
                 where o.id = order_items.order_id
                   and (public.is_comercial_operator() or public.is_comercial_support())
                   and o.company_id = any (public.current_user_companies())))
  with check (exists (select 1 from public.orders o
                      where o.id = order_items.order_id
                        and (public.is_comercial_operator() or public.is_comercial_support())
                        and o.company_id = any (public.current_user_companies())));

-- ─────────────────────────────────────────────────────────────────────────
-- Verificado em produção, 11 casos em transação revertida
-- ─────────────────────────────────────────────────────────────────────────
-- Como suporte: mantém preço de tabela (7,50 → 8,25) · NÃO muda preço do
-- cliente (segue 10,00) · NÃO libera produto · VÊ a liberação pra conferir ·
-- confirma pedido e grava número do Kronosys · marca Faturado.
-- Como vendedor: libera produto com preço · LÊ o preço de tabela pra calcular
-- a margem · NÃO altera a tabela.
