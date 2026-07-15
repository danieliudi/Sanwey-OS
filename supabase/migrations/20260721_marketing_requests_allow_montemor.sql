-- Monte Mor passa a ser uma unidade válida pra solicitações de Marketing
-- (material e compra) — não vende nada, mas gera pedidos internos pro
-- Marketing atender (ver src/constants/companies.js: MARKETING_UNIT_IDS).
-- As duas policies de INSERT público travavam company_ids <@
-- ['industria','resibag'] (20260713_fix_marketing_requests_public_insert.sql
-- e 20260714_marketing_purchase_requests.sql), o que agora rejeitaria um
-- envio legítimo com 'montemor'.

DROP POLICY IF EXISTS marketing_requests_public_insert ON public.marketing_requests;
CREATE POLICY marketing_requests_public_insert
  ON public.marketing_requests
  FOR INSERT
  WITH CHECK (
    status = 'pendente'
    AND is_demo = false
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND deliverable_id IS NULL
    AND rejection_reason IS NULL
    AND company_ids <@ ARRAY['industria', 'resibag', 'montemor']::text[]
  );

DROP POLICY IF EXISTS marketing_purchase_requests_insert_public ON public.marketing_purchase_requests;
CREATE POLICY marketing_purchase_requests_insert_public
  ON public.marketing_purchase_requests FOR INSERT
  WITH CHECK (
    stage = 'solicitado'
    AND supplier_id IS NULL
    AND responsible_id IS NULL
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND rejected_reason IS NULL
    AND invoice_url IS NULL
    AND invoice_date IS NULL
    AND expense_id IS NULL
    AND requested_by IS NULL
    AND company_ids <@ ARRAY['industria', 'resibag', 'montemor']::text[]
  );
