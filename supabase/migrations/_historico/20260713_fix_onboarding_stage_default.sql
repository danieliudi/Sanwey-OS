-- Achado importante da auditoria: rh_colaboradores.onboarding_stage tinha
-- DEFAULT 'documentacao', mas a etapa "pre_admissao" foi adicionada como
-- primeira etapa real (order_idx=0) do domínio onboarding. Todo colaborador
-- criado sem informar onboardingStage explicitamente (NovoColaboradorModal,
-- fluxo de contratação do Recrutamento) caía direto em "Documentação",
-- pulando "Pré-admissão" silenciosamente.
ALTER TABLE public.rh_colaboradores ALTER COLUMN onboarding_stage SET DEFAULT 'pre_admissao';
