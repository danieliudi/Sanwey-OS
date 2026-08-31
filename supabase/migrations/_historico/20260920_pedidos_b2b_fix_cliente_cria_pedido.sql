-- Aplicada em produção 12/08/2026, depois que o teste de ponta a ponta do
-- módulo (13 casos, rodados como login de cliente de verdade dentro de uma
-- transação revertida) pegou o caminho feliz quebrado.
--
-- SINTOMA: o cliente não conseguia criar o próprio pedido. Tudo que devia ser
-- bloqueado bloqueava — mas o insert legítimo também.
--
-- CAUSA: a policy `orders_cliente_insert` conferia a empresa assim:
--
--   exists (select 1 from public.clients c
--           where c.id = orders.client_id and orders.company_id = any (c.company_ids))
--
-- Esse EXISTS roda com o RLS DO PRÓPRIO CLIENTE, e não existe policy nenhuma
-- que deixe um login de cliente ler `clients` — as quatro que existem são de
-- admin/gerente/vendedor/diretoria. O predicado dava FALSO em silêncio.
--
-- LIÇÃO GERAL, vale pra qualquer policy futura: consultar tabela protegida por
-- RLS de dentro de uma policy só funciona se o chamador enxergar aquela
-- tabela. Quando não enxerga, a resposta certa é um helper SECURITY DEFINER —
-- mesmo molde de `current_user_companies()`, que já existe pro lado interno.

create or replace function public.current_user_client_companies()
returns text[]
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(c.company_ids, '{}'::text[])
  from public.clients c
  where c.id = public.current_user_client_id();
$$;
revoke all on function public.current_user_client_companies() from public;
revoke execute on function public.current_user_client_companies() from anon;
grant execute on function public.current_user_client_companies() to authenticated;

drop policy orders_cliente_insert on public.orders;
create policy orders_cliente_insert on public.orders for insert
  with check (
    client_id = public.current_user_client_id()
    and company_id = any (public.current_user_client_companies())
    and situacao in ('rascunho','enviado')
    and kronosys_numero is null
    and confirmed_by is null
  );

-- O portal também precisa mostrar razão social/CNPJ do cliente logado. Policy
-- permissiva, então só ACRESCENTA: o cliente enxerga a própria linha e nada
-- mais. Sem isto o portal não teria nem como escrever o nome de quem entrou.
create policy clients_cliente_read on public.clients for select
  using (id = public.current_user_client_id());
