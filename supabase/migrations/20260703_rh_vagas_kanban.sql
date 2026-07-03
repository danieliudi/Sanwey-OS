-- Fase A do redesenho Vagas → Candidatos → Funcionários → Onboarding:
-- 1) rh_vagas ganha um ciclo de vida de verdade (stage), reaproveitando a
--    coluna "stage" que já existia mas era vestigial.
-- 2) rh_cargo_templates: catálogo de cargos configurável pelo admin, usado
--    pra pré-preencher a vaga (departamento, salário, benefícios, jornada).
-- 3) RPCs públicas passam a checar stage='publicada' em vez de status='aberta'.
-- 4) Corrige rh_onboarding_tarefas.colaborador_id pra apontar pro cadastro
--    de funcionário independente de login (rh_colaboradores), não profiles —
--    hoje a tabela tem 0 linhas em produção, migração sem risco de dado.

-- 1. rh_cargo_templates (catálogo de cargos)
CREATE TABLE IF NOT EXISTS public.rh_cargo_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  department     text,
  contract_type  text,
  salary_min     numeric,
  salary_max     numeric,
  benefits       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  schedule       text,
  shift          text,
  created_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_cargo_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_cargo_templates' AND policyname = 'rh_cargo_templates_rh_access'
  ) THEN
    CREATE POLICY "rh_cargo_templates_rh_access" ON public.rh_cargo_templates
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')));
  END IF;
END $$;

-- 2. rh_vagas: novo ciclo de vida + campos ricos
ALTER TABLE public.rh_vagas ALTER COLUMN stage SET DEFAULT 'rascunho';

-- Vagas existentes (criadas antes desta migração) começam como "publicada"
-- pra não sumir do kanban visível — o valor antigo era só 'triagem' (vestigial).
UPDATE public.rh_vagas SET stage = 'publicada' WHERE stage = 'triagem';

ALTER TABLE public.rh_vagas
  DROP CONSTRAINT IF EXISTS rh_vagas_stage_check;
ALTER TABLE public.rh_vagas
  ADD CONSTRAINT rh_vagas_stage_check
  CHECK (stage IN ('rascunho','publicada','em_triagem','encerrada'));

ALTER TABLE public.rh_vagas
  ADD COLUMN IF NOT EXISTS cargo_template_id uuid REFERENCES public.rh_cargo_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_title          text,
  ADD COLUMN IF NOT EXISTS contract_type      text,
  ADD COLUMN IF NOT EXISTS schedule           text,
  ADD COLUMN IF NOT EXISTS shift              text,
  ADD COLUMN IF NOT EXISTS salary_min         numeric,
  ADD COLUMN IF NOT EXISTS salary_max         numeric,
  ADD COLUMN IF NOT EXISTS benefits           jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hiring_deadline    date,
  ADD COLUMN IF NOT EXISTS priority           text NOT NULL DEFAULT 'media';

ALTER TABLE public.rh_vagas
  DROP CONSTRAINT IF EXISTS rh_vagas_priority_check;
ALTER TABLE public.rh_vagas
  ADD CONSTRAINT rh_vagas_priority_check
  CHECK (priority IN ('baixa','media','alta','urgente'));

CREATE INDEX IF NOT EXISTS rh_vagas_stage_idx ON public.rh_vagas (stage);

-- 3. RPCs públicas: stage='publicada' é a nova fonte de verdade
CREATE OR REPLACE FUNCTION public.get_vaga_publica(p_slug text)
RETURNS TABLE (id uuid, title text, department text, description text, requirements text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT v.id, v.title, v.department, v.description, v.requirements
  FROM public.rh_vagas v
  WHERE v.link_slug = p_slug AND v.stage = 'publicada';
$$;

CREATE OR REPLACE FUNCTION public.submit_job_application(
  p_vaga_slug             text,
  p_nome                  text,
  p_email                 text,
  p_telefone              text,
  p_linkedin              text,
  p_consentimento_lgpd    boolean,
  p_resume_ext            text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vaga_id      uuid;
  v_company_ids  text[];
  v_candidate_id uuid;
BEGIN
  IF p_consentimento_lgpd IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Consentimento LGPD obrigatório';
  END IF;
  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  SELECT id, company_ids INTO v_vaga_id, v_company_ids
  FROM public.rh_vagas
  WHERE link_slug = p_vaga_slug AND stage = 'publicada';

  IF v_vaga_id IS NULL THEN
    RAISE EXCEPTION 'Vaga não encontrada ou encerrada';
  END IF;

  INSERT INTO public.rh_candidatos (name, email, phone, linkedin_url, resume_ext, source, consentimento_lgpd_at, frente_origem)
  VALUES (trim(p_nome), nullif(trim(p_email), ''), nullif(trim(p_telefone), ''), nullif(trim(p_linkedin), ''), p_resume_ext, 'vaga_publica', now(), coalesce(v_company_ids, '{}'))
  ON CONFLICT (email) WHERE email IS NOT NULL
  DO UPDATE SET
    name                  = excluded.name,
    phone                 = coalesce(excluded.phone, public.rh_candidatos.phone),
    linkedin_url          = coalesce(excluded.linkedin_url, public.rh_candidatos.linkedin_url),
    resume_ext            = excluded.resume_ext,
    consentimento_lgpd_at = excluded.consentimento_lgpd_at,
    frente_origem         = (SELECT array_agg(DISTINCT x) FROM unnest(public.rh_candidatos.frente_origem || excluded.frente_origem) AS x)
  RETURNING id INTO v_candidate_id;

  INSERT INTO public.rh_aplicacoes (candidate_id, vaga_id)
  VALUES (v_candidate_id, v_vaga_id)
  ON CONFLICT (candidate_id, vaga_id) DO UPDATE SET updated_at = now();

  RETURN v_candidate_id;
END;
$$;

-- 4. Corrige FK de onboarding pra apontar pro cadastro independente de login
ALTER TABLE public.rh_onboarding_tarefas
  DROP CONSTRAINT IF EXISTS rh_onboarding_tarefas_colaborador_id_fkey;
ALTER TABLE public.rh_onboarding_tarefas
  ADD CONSTRAINT rh_onboarding_tarefas_colaborador_id_fkey
  FOREIGN KEY (colaborador_id) REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "rh_onboarding_tarefas_read" ON public.rh_onboarding_tarefas;
CREATE POLICY "rh_onboarding_tarefas_read" ON public.rh_onboarding_tarefas
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = colaborador_id AND profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
  );

DROP POLICY IF EXISTS "rh_onboarding_tarefas_update" ON public.rh_onboarding_tarefas;
CREATE POLICY "rh_onboarding_tarefas_update" ON public.rh_onboarding_tarefas
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = colaborador_id AND profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
  );
