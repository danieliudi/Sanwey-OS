-- Compras de Marketing: ninguém era avisado de uma solicitação nova — só
-- descobria abrindo o board manualmente. Notifica todos os usuários com
-- papel marketing/gerente_marketing/admin (mesmo público que agora pode
-- aprovar, ver 20260764) a cada solicitação criada.
--
-- Implementado como trigger AFTER INSERT (não client-side em createPurchase)
-- de propósito: uma solicitação nasce tanto do formulário interno (usuário
-- logado, ComprasMarketingView) quanto do formulário público compartilhável
-- (/solicitar-compra, PurchaseRequestForm.jsx) — este último insere direto
-- via supabase-js, em sessão anônima, sem passar pelo hook
-- useMarketingPurchaseRequests nenhuma vez. Só um trigger no banco alcança
-- os dois casos igualmente; uma implementação só client-side no hook
-- cobriria apenas o caminho interno, e a RPC de notificação existente
-- (create_mention_notifications) exige auth.uid() — inutilizável a partir
-- de uma sessão anônima de qualquer forma.
CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_notify_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.stage <> 'solicitado' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT p.id, 'purchase_request_created',
         'Nova solicitação de compra',
         NEW.item_name || ' (' || NEW.request_number || ')'
           || CASE WHEN NEW.requester_name IS NOT NULL THEN ' — solicitado por ' || NEW.requester_name ELSE '' END,
         jsonb_build_object('module', 'purchase_requests', 'id', NEW.id),
         NEW.requested_by
  FROM public.profiles p
  WHERE p.mention_notifications_enabled = true
    AND p.id IS DISTINCT FROM NEW.requested_by
    AND p.roles && ARRAY['marketing','gerente_marketing','admin']::text[];

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_purchase_requests_notify_new() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketing_purchase_requests_notify_new_trg ON public.marketing_purchase_requests;
CREATE TRIGGER marketing_purchase_requests_notify_new_trg
  AFTER INSERT ON public.marketing_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_purchase_requests_notify_new();
