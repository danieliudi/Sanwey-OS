-- Ajuste pedido pelo Daniel (20/08/2026), depois do fix anterior
-- (sec_deliverables_agencia_sees_assignee) restringir a Beehave só às
-- entregas com assignee/assignee_ids batendo: decisão explícita é que
-- agência vê TODAS as entregas, sem escopo por atribuição/fornecedor —
-- "outras coisas" (campanhas, checklists, anexos) ficam como estão por
-- ora, a avaliar depois. Substitui o caminho estreito por um grant direto
-- do papel 'agencia' nesta tabela especificamente.
DROP POLICY IF EXISTS deliverables_select ON public.marketing_deliverables;
CREATE POLICY deliverables_select ON public.marketing_deliverables FOR SELECT USING (
  current_user_is_admin()
  OR (current_user_is_marketing() AND (company_ids && current_user_companies()))
  OR (current_user_roles() && array['agencia']::text[])
);

DROP POLICY IF EXISTS md_update ON public.marketing_deliverables;
CREATE POLICY md_update ON public.marketing_deliverables FOR UPDATE USING (
  current_user_is_admin()
  OR (current_user_is_marketing() AND (company_ids && current_user_companies()))
  OR (current_user_roles() && array['agencia']::text[])
);
