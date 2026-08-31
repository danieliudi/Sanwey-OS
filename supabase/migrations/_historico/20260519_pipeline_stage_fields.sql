-- Formulários customizáveis por etapa (estilo Pipefy).
-- Cada empresa tem sua própria configuração de campos para cada etapa do
-- pipeline. Os valores preenchidos pelo usuário ficam em leads.custom_fields.

CREATE TABLE public.pipeline_stage_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  text NOT NULL CHECK (company_id IN ('industria','resibag','montemor')),
  stage_id    text NOT NULL CHECK (stage_id IN ('prospeccao','qualificacao','visitas','amostras','negociacao','ganho','perdido')),
  field_key   text NOT NULL,
  field_type  text NOT NULL CHECK (field_type IN ('text','textarea','number','currency','date','datetime','email','phone','url','checkbox','select','user')),
  label       text NOT NULL,
  required    boolean NOT NULL DEFAULT false,
  options     jsonb NOT NULL DEFAULT '[]'::jsonb,
  order_idx   integer NOT NULL DEFAULT 0,
  placeholder text,
  help_text   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, stage_id, field_key)
);

CREATE INDEX pipeline_stage_fields_lookup_idx
  ON public.pipeline_stage_fields (company_id, stage_id, order_idx);

CREATE TRIGGER pipeline_stage_fields_touch
  BEFORE UPDATE ON public.pipeline_stage_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_actions_updated_at();

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pipeline_stage_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_fields_select_by_company"
  ON public.pipeline_stage_fields FOR SELECT
  TO authenticated
  USING (company_id = ANY (public.current_user_companies()) OR public.current_user_is_admin());

CREATE POLICY "stage_fields_admin_insert"
  ON public.pipeline_stage_fields FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "stage_fields_admin_update"
  ON public.pipeline_stage_fields FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "stage_fields_admin_delete"
  ON public.pipeline_stage_fields FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());
