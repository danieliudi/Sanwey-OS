-- Amplia o domínio de rh_attachments (usado pela aba "Anexos" do
-- RHDetailDrawerShell, sempre renderizada independente do domínio) pra
-- cobrir os novos domínios de Kanban: feedback, ferias, treinamentos.
ALTER TABLE public.rh_attachments
  DROP CONSTRAINT rh_attachments_domain_check,
  ADD CONSTRAINT rh_attachments_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','feedback','ferias','treinamentos']));
