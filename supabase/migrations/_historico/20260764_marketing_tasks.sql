-- Kanban de "Tarefas" de Marketing — gestão do dia a dia (pedido do usuário:
-- "idêntico a Entregas", vinculável a campanha, SEM acesso da Agência pra
-- não misturar com o board de entregas que a agência acompanha).
--
-- Etapas via rh_pipeline_stages (domain='marketing_tasks'), mesmo mecanismo
-- já usado por marketing_deliverables (domain='marketing_deliverables') —
-- editável pelo RHStageEditorModal já existente. Por isso `stage` aqui é
-- text puro, SEM CHECK constraint hardcoded — mesma classe de bug já
-- corrigida nesta sessão em leads/pipeline_stage_fields (CHECK fixo
-- bloquearia silenciosamente qualquer etapa custom criada pelo usuário).

CREATE TABLE public.marketing_tasks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_ids        text[] NOT NULL DEFAULT '{}',
  campaign_id        uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  -- A qual etapa da campanha esta tarefa pertence/influencia (pedido do
  -- usuário: rollup de % conclusão por etapa da campanha + base pra
  -- automação futura "100% concluído nessa etapa -> avança a campanha").
  -- Nullable — nem toda tarefa precisa estar amarrada a uma etapa específica.
  campaign_stage_key text,
  title              text NOT NULL,
  description        text,
  priority           text DEFAULT 'media',
  deadline           timestamptz,
  stage              text NOT NULL DEFAULT 'a_fazer',
  stage_changed_at   timestamptz DEFAULT now(),
  assignee_ids       uuid[] NOT NULL DEFAULT '{}',
  notes              jsonb NOT NULL DEFAULT '[]'::jsonb,
  activities         jsonb NOT NULL DEFAULT '[]'::jsonb,
  starred            boolean NOT NULL DEFAULT false,
  custom_fields      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketing_tasks_stage_idx       ON public.marketing_tasks (stage);
CREATE INDEX marketing_tasks_campaign_idx    ON public.marketing_tasks (campaign_id);
CREATE INDEX marketing_tasks_created_at_idx  ON public.marketing_tasks (created_at DESC);

ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;

-- Mesmo critério de marketing_expenses (sem o carve-out de agência que
-- marketing_deliverables tem via agencia_sees_supplier — pedido explícito:
-- "pra não misturar com os da Agência").
CREATE POLICY marketing_tasks_select ON public.marketing_tasks FOR SELECT
  USING (current_user_is_marketing() OR current_user_has_role('diretoria'));

CREATE POLICY marketing_tasks_insert ON public.marketing_tasks FOR INSERT
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_tasks_update ON public.marketing_tasks FOR UPDATE
  USING (current_user_is_marketing())
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_tasks_delete ON public.marketing_tasks FOR DELETE
  USING (current_user_is_marketing());

CREATE OR REPLACE FUNCTION public.marketing_tasks_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER marketing_tasks_updated_at
  BEFORE UPDATE ON public.marketing_tasks
  FOR EACH ROW EXECUTE FUNCTION public.marketing_tasks_set_updated_at();

-- Seed inicial das etapas (editável depois via "Editar etapas", igual a
-- qualquer outro board) — 3 etapas simples, mais leve que o fluxo de
-- aprovação de Entregas, condizente com "tarefa do dia a dia".
INSERT INTO public.rh_pipeline_stages (domain, stage_key, name, color, order_idx, terminal, won, lost)
VALUES
  ('marketing_tasks', 'a_fazer',      'A Fazer',      '#6366F1', 0, false, false, false),
  ('marketing_tasks', 'em_andamento', 'Em Andamento', '#D97706', 1, false, false, false),
  ('marketing_tasks', 'concluido',    'Concluído',    '#16A34A', 2, true,  false, false)
ON CONFLICT DO NOTHING;

-- Mesmo campo em marketing_deliverables (Entregas), pro rollup/automação
-- funcionar cruzando os dois tipos de item vinculados a uma campanha.
ALTER TABLE public.marketing_deliverables ADD COLUMN IF NOT EXISTS campaign_stage_key text;
