-- Achado da auditoria: a migração de subordinate visibility
-- (20260713_leads_subordinate_visibility.sql) ficou neutralizada no client:
-- CRMView.jsx monta subordinateIds a partir de `users` (perfis), mas
-- profiles_select só liberava a própria linha ou tudo (gerente/admin) — um
-- vendedor nunca recebia as linhas dos consultores que supervisiona, então
-- o Set ficava sempre vazio mesmo com a policy de leads corrigida.
--
-- Segundo furo: a role "consultor" (real, usada em NOTIFICATION_GROUPS e
-- filtrada no client em CRMView.jsx) não tinha ramo nenhum em leads_select/
-- leads_update — ficava com 0 linhas visíveis, e leads_insert não filtrava
-- por role, deixando qualquer role com company_id compatível (inclusive
-- rh/agencia) inserir leads comerciais.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select
  ON public.profiles
  FOR SELECT
  USING (
    (id = (SELECT auth.uid()))
    OR current_user_is_manager()
    OR (current_user_role() = 'vendedor' AND id::text = ANY (current_user_subordinate_ids()))
  );

DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select
  ON public.leads
  FOR SELECT
  USING (
    (current_user_role() = 'admin')
    OR (current_user_role() = 'gerente' AND company_id = ANY (current_user_companies()))
    OR (
      current_user_role() = 'vendedor'
      AND company_id = ANY (current_user_companies())
      AND (owner IS NULL OR owner = (SELECT auth.uid())::text OR owner = ANY (current_user_subordinate_ids()))
    )
    OR (
      current_user_role() = 'consultor'
      AND company_id = ANY (current_user_companies())
      AND owner = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update
  ON public.leads
  FOR UPDATE
  USING (
    (current_user_role() = 'admin')
    OR (current_user_role() = 'gerente' AND company_id = ANY (current_user_companies()))
    OR (
      current_user_role() = 'vendedor'
      AND company_id = ANY (current_user_companies())
      AND (owner IS NULL OR owner = (SELECT auth.uid())::text OR owner = ANY (current_user_subordinate_ids()))
    )
    OR (
      current_user_role() = 'consultor'
      AND company_id = ANY (current_user_companies())
      AND owner = (SELECT auth.uid())::text
    )
  )
  WITH CHECK (
    (current_user_role() = 'admin')
    OR (current_user_role() = 'gerente' AND company_id = ANY (current_user_companies()))
    OR (
      current_user_role() = 'vendedor'
      AND company_id = ANY (current_user_companies())
      AND (owner IS NULL OR owner = (SELECT auth.uid())::text OR owner = ANY (current_user_subordinate_ids()))
    )
    OR (
      current_user_role() = 'consultor'
      AND company_id = ANY (current_user_companies())
      AND owner = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert
  ON public.leads
  FOR INSERT
  WITH CHECK (
    current_user_role() = ANY (ARRAY['admin', 'gerente', 'vendedor', 'consultor'])
    AND (current_user_role() = 'admin' OR company_id = ANY (current_user_companies()))
  );
