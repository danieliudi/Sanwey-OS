-- Importante da auditoria: deliverables_select era USING(true) — qualquer
-- autenticado (vendedor, rh, gerente comercial etc.) lia todos os
-- entregáveis de marketing de ambas as empresas via API direta, mesmo a UI
-- restringindo a rota a marketing/agencia (App.jsx). marketing_deliverable_
-- attachments tinha o mesmo furo nas 3 operações (só checava "authenticated").
-- Alinha ao mesmo conjunto de papéis que a UI permite (marketing + agencia),
-- igual ao padrão de mkt_attach_* no Storage.
DROP POLICY IF EXISTS deliverables_select ON public.marketing_deliverables;
CREATE POLICY deliverables_select
  ON public.marketing_deliverables
  FOR SELECT
  USING (current_user_is_marketing() OR current_user_role() = 'agencia');

DROP POLICY IF EXISTS "Deliverable attachments table read" ON public.marketing_deliverable_attachments;
CREATE POLICY "Deliverable attachments table read"
  ON public.marketing_deliverable_attachments
  FOR SELECT
  USING (current_user_is_marketing() OR current_user_role() = 'agencia');

DROP POLICY IF EXISTS "Deliverable attachments table insert" ON public.marketing_deliverable_attachments;
CREATE POLICY "Deliverable attachments table insert"
  ON public.marketing_deliverable_attachments
  FOR INSERT
  WITH CHECK (current_user_is_marketing() OR current_user_role() = 'agencia');

DROP POLICY IF EXISTS "Deliverable attachments table delete" ON public.marketing_deliverable_attachments;
CREATE POLICY "Deliverable attachments table delete"
  ON public.marketing_deliverable_attachments
  FOR DELETE
  USING (current_user_is_marketing() OR current_user_role() = 'agencia');
