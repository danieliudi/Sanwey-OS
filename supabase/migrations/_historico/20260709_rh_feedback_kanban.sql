-- Converte Feedback (rh_avaliacoes) num domínio de pipeline igual aos demais
-- (Vagas/Candidatos/Onboarding/Comercial/Marketing): etapas customizáveis
-- (rh_pipeline_stages) usando a coluna `status` já existente como stage_key,
-- campos por etapa (rh_pipeline_stage_fields), custom_fields/activities pra
-- registrar contexto por avaliação, e status_changed_at pro badge de aging.

ALTER TABLE public.rh_pipeline_stages
  DROP CONSTRAINT rh_pipeline_stages_domain_check,
  ADD CONSTRAINT rh_pipeline_stages_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables','feedback']));

ALTER TABLE public.rh_pipeline_stage_fields
  DROP CONSTRAINT rh_pipeline_stage_fields_domain_check,
  ADD CONSTRAINT rh_pipeline_stage_fields_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables','feedback']));

ALTER TABLE public.rh_avaliacoes
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, terminal, won)
VALUES
  ('feedback', 'all', 'rascunho',     'Rascunho',      '#B45309', 0, false, false),
  ('feedback', 'all', 'em_andamento', 'Em Andamento',  '#3B82F6', 1, false, false),
  ('feedback', 'all', 'concluido',    'Concluído',     '#16A34A', 2, true,  true)
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
  end if;

  if v_stage is not null and not exists (
    select 1 from public.rh_pipeline_stages where domain = v_domain and stage_key = v_stage
  ) then
    raise exception 'Etapa "%" inválida para %', v_stage, v_domain;
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS validate_stage_rh_avaliacoes ON public.rh_avaliacoes;
CREATE TRIGGER validate_stage_rh_avaliacoes
  BEFORE INSERT OR UPDATE OF status ON public.rh_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.validate_rh_stage();
