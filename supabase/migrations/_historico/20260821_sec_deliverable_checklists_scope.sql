-- SEC-M1: deliverable_checklists tinha read+write+delete liberados a
-- QUALQUER autenticado (auth.role()='authenticated', sem escopo de
-- departamento/fornecedor) — diferente de marketing_deliverable_attachments,
-- que já é escopado corretamente. Mesmo padrão agencia_sees_supplier via
-- join no deliverable pai.
DROP POLICY IF EXISTS "Deliverable checklists read" ON public.deliverable_checklists;
CREATE POLICY "Deliverable checklists read" ON public.deliverable_checklists
FOR SELECT
USING (
  current_user_is_marketing()
  OR agencia_sees_supplier((
    SELECT mc.supplier_id
    FROM public.marketing_deliverables md
    JOIN public.marketing_campaigns mc ON mc.id = md.campaign_id
    WHERE md.id = deliverable_checklists.deliverable_id
  ))
);

DROP POLICY IF EXISTS "Deliverable checklists manage" ON public.deliverable_checklists;
CREATE POLICY "Deliverable checklists manage" ON public.deliverable_checklists
FOR ALL
USING (
  current_user_is_marketing()
  OR agencia_sees_supplier((
    SELECT mc.supplier_id
    FROM public.marketing_deliverables md
    JOIN public.marketing_campaigns mc ON mc.id = md.campaign_id
    WHERE md.id = deliverable_checklists.deliverable_id
  ))
)
WITH CHECK (
  current_user_is_marketing()
  OR agencia_sees_supplier((
    SELECT mc.supplier_id
    FROM public.marketing_deliverables md
    JOIN public.marketing_campaigns mc ON mc.id = md.campaign_id
    WHERE md.id = deliverable_checklists.deliverable_id
  ))
);
