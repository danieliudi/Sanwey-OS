-- Converte Férias & Licenças (rh_ferias) num domínio de pipeline igual aos
-- demais: etapas customizáveis (rh_pipeline_stages) usando `status` como
-- stage_key, campos por etapa (rh_pipeline_stage_fields) — usado sobretudo
-- pra exigir campo condicional por tipo de licença (ex: nº do atestado só
-- quando type = licenca_medica) — e custom_fields/activities/status_changed_at
-- pro mesmo padrão de card usado em Onboarding/Feedback.

ALTER TABLE public.rh_pipeline_stages
  DROP CONSTRAINT rh_pipeline_stages_domain_check,
  ADD CONSTRAINT rh_pipeline_stages_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables','feedback','ferias']));

ALTER TABLE public.rh_pipeline_stage_fields
  DROP CONSTRAINT rh_pipeline_stage_fields_domain_check,
  ADD CONSTRAINT rh_pipeline_stage_fields_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables','feedback','ferias']));

ALTER TABLE public.rh_ferias
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, terminal, won, lost)
VALUES
  ('ferias', 'all', 'pendente', 'Pendente', '#B45309', 0, false, false, false),
  ('ferias', 'all', 'aprovado', 'Aprovado', '#16A34A', 1, true,  true,  false),
  ('ferias', 'all', 'recusado', 'Recusado', '#DC2626', 2, true,  false, true)
ON CONFLICT (domain, company_id, stage_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_rh_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_domain text;
  v_stage text;
begin
  if tg_table_name = 'rh_vagas' then
    v_domain := 'vagas'; v_stage := new.stage;
  elsif tg_table_name = 'rh_aplicacoes' then
    v_domain := 'candidatos'; v_stage := new.etapa_pipeline;
  elsif tg_table_name = 'rh_colaboradores' then
    v_domain := 'onboarding'; v_stage := new.onboarding_stage;
  elsif tg_table_name = 'rh_avaliacoes' then
    v_domain := 'feedback'; v_stage := new.status;
  elsif tg_table_name = 'rh_ferias' then
    v_domain := 'ferias'; v_stage := new.status;
  end if;

  if v_stage is not null and not exists (
    select 1 from public.rh_pipeline_stages where domain = v_domain and stage_key = v_stage
  ) then
    raise exception 'Etapa "%" inválida para %', v_stage, v_domain;
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS validate_stage_rh_ferias ON public.rh_ferias;
CREATE TRIGGER validate_stage_rh_ferias
  BEFORE INSERT OR UPDATE OF status ON public.rh_ferias
  FOR EACH ROW EXECUTE FUNCTION public.validate_rh_stage();
