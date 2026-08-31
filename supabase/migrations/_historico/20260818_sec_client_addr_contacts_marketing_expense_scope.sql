-- Achado da auditoria de segurança de 18/08/2026 (pedido do Daniel: comprovar
-- pra diretoria que dado de cliente/funcionário não vaza entre empresas do
-- grupo). Dois gaps reais de isolamento por empresa, verificados ao vivo
-- contra pg_policies antes de escrever este fix — não é achado especulativo.
--
-- 1) client_addresses / client_contacts usavam is_comercial_operator(), que
--    só checa CARGO (admin/gerente/vendedor) — nenhum filtro por empresa ou
--    por cliente. Um vendedor da Resibag conseguia ler E ESCREVER endereço,
--    CNPJ de faturamento, contato (nome/e-mail/telefone) de cliente da
--    Sanwey, e vice-versa. A tabela-irmã client_products já usa
--    current_user_can_manage_client(client_id) (junta com clients.company_ids
--    + owner_ids) — só replicando o padrão que já existe e já é correto.
drop policy if exists client_addresses_interno on public.client_addresses;
create policy client_addresses_interno on public.client_addresses
  for all
  using (current_user_is_admin() or current_user_can_manage_client(client_id))
  with check (current_user_is_admin() or current_user_can_manage_client(client_id));

drop policy if exists client_contacts_interno on public.client_contacts;
create policy client_contacts_interno on public.client_contacts
  for all
  using (current_user_is_admin() or current_user_can_manage_client(client_id))
  with check (current_user_is_admin() or current_user_can_manage_client(client_id));

-- 2) marketing_expense_items/tasks/deliverables usavam só
--    current_user_is_marketing() (papel), sem repetir o escopo por empresa
--    que a tabela-mãe marketing_expenses já aplica (me_select/me_insert/etc:
--    company_ids && current_user_companies()). Como essas 3 tabelas-filhas
--    não têm company_id próprio, o escopo precisa vir de um join até a mãe.
drop policy if exists marketing_expense_items_select on public.marketing_expense_items;
create policy marketing_expense_items_select on public.marketing_expense_items
  for select
  using (
    current_user_is_admin() or current_user_has_role('diretoria')
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_items.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_items_insert on public.marketing_expense_items;
create policy marketing_expense_items_insert on public.marketing_expense_items
  for insert
  with check (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_items.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_items_update on public.marketing_expense_items;
create policy marketing_expense_items_update on public.marketing_expense_items
  for update
  using (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_items.expense_id
        and me.company_ids && current_user_companies()
    ))
  )
  with check (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_items.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_items_delete on public.marketing_expense_items;
create policy marketing_expense_items_delete on public.marketing_expense_items
  for delete
  using (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_items.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_tasks_select on public.marketing_expense_tasks;
create policy marketing_expense_tasks_select on public.marketing_expense_tasks
  for select
  using (
    current_user_is_admin() or current_user_has_role('diretoria')
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_tasks.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_tasks_insert on public.marketing_expense_tasks;
create policy marketing_expense_tasks_insert on public.marketing_expense_tasks
  for insert
  with check (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_tasks.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_tasks_delete on public.marketing_expense_tasks;
create policy marketing_expense_tasks_delete on public.marketing_expense_tasks
  for delete
  using (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_tasks.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_deliverables_select on public.marketing_expense_deliverables;
create policy marketing_expense_deliverables_select on public.marketing_expense_deliverables
  for select
  using (
    current_user_is_admin() or current_user_has_role('diretoria')
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_deliverables.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_deliverables_insert on public.marketing_expense_deliverables;
create policy marketing_expense_deliverables_insert on public.marketing_expense_deliverables
  for insert
  with check (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_deliverables.expense_id
        and me.company_ids && current_user_companies()
    ))
  );

drop policy if exists marketing_expense_deliverables_delete on public.marketing_expense_deliverables;
create policy marketing_expense_deliverables_delete on public.marketing_expense_deliverables
  for delete
  using (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_expenses me
      where me.id = marketing_expense_deliverables.expense_id
        and me.company_ids && current_user_companies()
    ))
  );
