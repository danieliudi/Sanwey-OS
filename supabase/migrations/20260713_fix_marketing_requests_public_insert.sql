-- Importante da auditoria: marketing_requests_public_insert só exigia
-- status='pendente' — o front insere direto (sem RPC) e o anon conseguia
-- gravar company_ids arbitrário (inclusive lixo ou 'montemor', empresa
-- desativada), is_demo=true, notes/rejection_reason livres, e floodar o
-- board sem limite. approved_by/deliverable_id já eram protegidos pelas FKs
-- (não aceitam uuid arbitrário sem linha real), mas nada impedia setá-los
-- para uma linha real existente adivinhada.
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
    AND company_ids <@ ARRAY['industria', 'resibag']::text[]
  );
