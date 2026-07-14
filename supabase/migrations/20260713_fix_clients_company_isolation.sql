-- Crítico novo da auditoria: clients_read/clients_insert/clients_update só
-- checavam "está autenticado", sem nenhum escopo de empresa nem de role —
-- agencia (ou qualquer role fora do Comercial) conseguia ler/escrever
-- clientes de industria e resibag via API direta, mesmo a tela do CRM
-- redirecionando agencia pra Marketing (proteção só client-side). clients
-- é multi-empresa (company_ids array), então o escopo usa sobreposição de
-- array (&&) contra current_user_companies(), igual ao padrão já usado em
-- leads_select/leads_insert pra company_id.
DROP POLICY IF EXISTS clients_read ON public.clients;
CREATE POLICY clients_read
  ON public.clients
  FOR SELECT
  USING (
    current_user_is_admin()
    OR (
      current_user_role() = ANY (ARRAY['gerente', 'vendedor', 'consultor'])
      AND company_ids && current_user_companies()
    )
  );

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert
  ON public.clients
  FOR INSERT
  WITH CHECK (
    current_user_is_admin()
    OR (
      current_user_role() = ANY (ARRAY['gerente', 'vendedor', 'consultor'])
      AND company_ids && current_user_companies()
    )
  );

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update
  ON public.clients
  FOR UPDATE
  USING (
    current_user_is_admin()
    OR (
      current_user_role() = ANY (ARRAY['gerente', 'vendedor', 'consultor'])
      AND company_ids && current_user_companies()
    )
  )
  WITH CHECK (
    current_user_is_admin()
    OR (
      current_user_role() = ANY (ARRAY['gerente', 'vendedor', 'consultor'])
      AND company_ids && current_user_companies()
    )
  );

-- clients_delete já restringia por role (admin/gerente), mas um gerente de
-- uma empresa conseguia apagar clientes da outra — adiciona o mesmo escopo.
DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete
  ON public.clients
  FOR DELETE
  USING (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND company_ids && current_user_companies())
  );
