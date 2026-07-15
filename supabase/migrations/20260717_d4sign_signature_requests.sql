-- Item 12: integração com D4Sign para assinatura eletrônica. Schema fica
-- pronto agora; a integração real (edge functions que chamam a API do
-- D4Sign) só ativa quando os secrets D4SIGN_API_TOKEN/D4SIGN_CRYPT_KEY/
-- D4SIGN_SAFE_UUID forem configurados no Supabase — até lá, fica inerte
-- (mesmo padrão de "fail open" usado no item 11/check-document-legibility).
-- domain+record_id genérico (mesmo padrão de rh_attachments/rh_stage_history)
-- porque o piloto é "Termo de Férias" mas o contrato de admissão deve vir
-- em seguida, sem precisar de tabela nova.

CREATE TABLE public.rh_signature_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain                text NOT NULL,
  record_id             uuid NOT NULL,
  status                text NOT NULL DEFAULT 'pendente_envio'
                          CHECK (status = ANY (ARRAY['pendente_envio','enviado','assinado','recusado','cancelado'])),
  signers               jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_storage_path   text,
  d4sign_document_uuid  text UNIQUE,
  signed_file_path      text,
  sent_at               timestamptz,
  signed_at             timestamptz,
  last_webhook_event    text,
  last_webhook_at       timestamptz,
  created_by            uuid REFERENCES public.profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rh_signature_requests_domain_record_idx
  ON public.rh_signature_requests (domain, record_id);

ALTER TABLE public.rh_signature_requests ENABLE ROW LEVEL SECURITY;

-- Só RH mexe diretamente. A escrita de status vinda do webhook do D4Sign
-- passa pela edge function (service role), nunca por role anônima/RLS.
CREATE POLICY rh_signature_requests_rh_access ON public.rh_signature_requests
  FOR ALL USING (public.current_user_is_rh()) WITH CHECK (public.current_user_is_rh());
