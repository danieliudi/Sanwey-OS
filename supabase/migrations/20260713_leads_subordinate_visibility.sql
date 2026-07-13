-- Achado crítico da auditoria: CRMView.jsx já pressupõe que um vendedor
-- vê (e edita) os leads dos consultores que ele supervisiona
-- (`subordinateIds`, via profiles.supervisor_id) — mas a RLS de `leads`
-- só liberava `owner IS NULL OR owner = auth.uid()` pra role vendedor, sem
-- cláusula de subordinado. Na prática a feature nunca funcionava: o filtro
-- client-side ficava vazio porque as linhas nunca chegavam do banco.
CREATE OR REPLACE FUNCTION public.current_user_subordinate_ids()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
  FROM public.profiles
  WHERE supervisor_id = (SELECT auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_subordinate_ids() FROM PUBLIC, anon;

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
  )
  WITH CHECK (
    (current_user_role() = 'admin')
    OR (current_user_role() = 'gerente' AND company_id = ANY (current_user_companies()))
    OR (
      current_user_role() = 'vendedor'
      AND company_id = ANY (current_user_companies())
      AND (owner IS NULL OR owner = (SELECT auth.uid())::text OR owner = ANY (current_user_subordinate_ids()))
    )
  );
