-- Onboarding vira um Kanban de verdade, um card por colaborador (não por
-- tarefa), estruturado como o Kanban de vendas: etapas fixas, cartão com
-- progresso, e dados importados do recrutamento (vaga de origem).

ALTER TABLE public.rh_colaboradores
  ADD COLUMN IF NOT EXISTS onboarding_stage             text        NOT NULL DEFAULT 'documentacao',
  ADD COLUMN IF NOT EXISTS onboarding_stage_changed_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS vaga_id                      uuid        REFERENCES public.rh_vagas(id) ON DELETE SET NULL;

ALTER TABLE public.rh_colaboradores
  DROP CONSTRAINT IF EXISTS rh_colaboradores_onboarding_stage_check;
ALTER TABLE public.rh_colaboradores
  ADD CONSTRAINT rh_colaboradores_onboarding_stage_check
  CHECK (onboarding_stage IN ('documentacao','integracao','acompanhamento','avaliacao','concluido'));

-- Colaboradores que já existiam antes desta migração não passam pelo
-- onboarding agora criado — ficam marcados como concluídos pra não lotar
-- a primeira coluna do Kanban com gente que já trabalha aqui há tempo.
UPDATE public.rh_colaboradores SET onboarding_stage = 'concluido' WHERE onboarding_stage = 'documentacao';

CREATE INDEX IF NOT EXISTS rh_colaboradores_onboarding_stage_idx ON public.rh_colaboradores (onboarding_stage);
