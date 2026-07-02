-- ─────────────────────────────────────────────────────────────────────────────
-- Módulo RH: captação pública, talent pool, triagem por IA, onboarding,
-- treinamento e extensão de feedback.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. rh_vagas: status de publicação + slug público
ALTER TABLE public.rh_vagas
  ADD COLUMN IF NOT EXISTS link_slug text,
  ADD COLUMN IF NOT EXISTS status    text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','pausada','encerrada'));

CREATE UNIQUE INDEX IF NOT EXISTS rh_vagas_link_slug_key ON public.rh_vagas (link_slug) WHERE link_slug IS NOT NULL;

-- 2. rh_candidatos vira o talent pool (pessoa), desacoplado de vaga_id
ALTER TABLE public.rh_candidatos
  ADD COLUMN IF NOT EXISTS cv_texto_extraido    text,
  ADD COLUMN IF NOT EXISTS resume_ext           text,
  ADD COLUMN IF NOT EXISTS consentimento_lgpd_at timestamptz,
  ADD COLUMN IF NOT EXISTS frente_origem        text[] DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS rh_candidatos_email_key ON public.rh_candidatos (email) WHERE email IS NOT NULL;

-- 3. rh_aplicacoes: candidato x vaga (permite reaplicação sem duplicar candidato)
CREATE TABLE IF NOT EXISTS public.rh_aplicacoes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      uuid        NOT NULL REFERENCES public.rh_candidatos(id) ON DELETE CASCADE,
  vaga_id           uuid        NOT NULL REFERENCES public.rh_vagas(id) ON DELETE CASCADE,
  etapa_pipeline    text        NOT NULL DEFAULT 'triagem',
  stage_changed_at  timestamptz DEFAULT now(),
  fit_score         numeric     CHECK (fit_score BETWEEN 0 AND 100),
  justificativa     text,
  pontos_fortes     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  gaps              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  motivo_reprovacao text,
  notes             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  rating            smallint    CHECK (rating BETWEEN 1 AND 5),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, vaga_id)
);

ALTER TABLE public.rh_aplicacoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_aplicacoes' AND policyname = 'rh_aplicacoes_rh_access'
  ) THEN
    CREATE POLICY "rh_aplicacoes_rh_access" ON public.rh_aplicacoes
      FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rh_aplicacoes_vaga_id_idx      ON public.rh_aplicacoes (vaga_id);
CREATE INDEX IF NOT EXISTS rh_aplicacoes_candidate_id_idx ON public.rh_aplicacoes (candidate_id);
CREATE INDEX IF NOT EXISTS rh_aplicacoes_etapa_idx        ON public.rh_aplicacoes (etapa_pipeline);

-- 4. Onboarding
CREATE TABLE IF NOT EXISTS public.rh_onboarding_templates (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo             text,
  frente            text,
  checklist_padrao  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_onboarding_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_onboarding_templates' AND policyname = 'rh_onboarding_templates_rh_access'
  ) THEN
    CREATE POLICY "rh_onboarding_templates_rh_access" ON public.rh_onboarding_templates
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rh_onboarding_tarefas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id     uuid        REFERENCES public.rh_onboarding_templates(id) ON DELETE SET NULL,
  titulo          text        NOT NULL,
  responsavel     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_limite     date,
  status          text        NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente','em_andamento','concluida')),
  created_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_onboarding_tarefas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_onboarding_tarefas' AND policyname = 'rh_onboarding_tarefas_read'
  ) THEN
    CREATE POLICY "rh_onboarding_tarefas_read" ON public.rh_onboarding_tarefas
      FOR SELECT
      USING (
        colaborador_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_onboarding_tarefas' AND policyname = 'rh_onboarding_tarefas_write'
  ) THEN
    CREATE POLICY "rh_onboarding_tarefas_write" ON public.rh_onboarding_tarefas
      FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_onboarding_tarefas' AND policyname = 'rh_onboarding_tarefas_update'
  ) THEN
    CREATE POLICY "rh_onboarding_tarefas_update" ON public.rh_onboarding_tarefas
      FOR UPDATE
      USING (
        colaborador_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_onboarding_tarefas' AND policyname = 'rh_onboarding_tarefas_delete'
  ) THEN
    CREATE POLICY "rh_onboarding_tarefas_delete" ON public.rh_onboarding_tarefas
      FOR DELETE
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rh_onboarding_tarefas_colaborador_idx ON public.rh_onboarding_tarefas (colaborador_id);

-- 5. Treinamento
CREATE TABLE IF NOT EXISTS public.rh_treinamentos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text        NOT NULL,
  descricao     text,
  tipo          text        NOT NULL DEFAULT 'opcional' CHECK (tipo IN ('obrigatorio','opcional')),
  link_conteudo text,
  frente        text,
  created_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_treinamentos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_treinamentos' AND policyname = 'rh_treinamentos_read'
  ) THEN
    CREATE POLICY "rh_treinamentos_read" ON public.rh_treinamentos
      FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_treinamentos' AND policyname = 'rh_treinamentos_write'
  ) THEN
    CREATE POLICY "rh_treinamentos_write" ON public.rh_treinamentos
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rh_treinamento_atribuicoes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id  uuid        NOT NULL REFERENCES public.rh_treinamentos(id) ON DELETE CASCADE,
  colaborador_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido')),
  data_conclusao  timestamptz,
  created_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (treinamento_id, colaborador_id)
);

ALTER TABLE public.rh_treinamento_atribuicoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_treinamento_atribuicoes' AND policyname = 'rh_treinamento_atrib_read'
  ) THEN
    CREATE POLICY "rh_treinamento_atrib_read" ON public.rh_treinamento_atribuicoes
      FOR SELECT
      USING (
        colaborador_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_treinamento_atribuicoes' AND policyname = 'rh_treinamento_atrib_insert'
  ) THEN
    CREATE POLICY "rh_treinamento_atrib_insert" ON public.rh_treinamento_atribuicoes
      FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_treinamento_atribuicoes' AND policyname = 'rh_treinamento_atrib_update'
  ) THEN
    CREATE POLICY "rh_treinamento_atrib_update" ON public.rh_treinamento_atribuicoes
      FOR UPDATE
      USING (
        colaborador_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_treinamento_atribuicoes' AND policyname = 'rh_treinamento_atrib_delete'
  ) THEN
    CREATE POLICY "rh_treinamento_atrib_delete" ON public.rh_treinamento_atribuicoes
      FOR DELETE
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rh_treinamento_atrib_colaborador_idx ON public.rh_treinamento_atribuicoes (colaborador_id);

-- 6. Feedback: estende rh_avaliacoes (sem tabela nova)
ALTER TABLE public.rh_avaliacoes
  ADD COLUMN IF NOT EXISTS tipo     text NOT NULL DEFAULT 'ad_hoc'
    CHECK (tipo IN ('30_dias','60_dias','90_dias','semestral','anual','ad_hoc')),
  ADD COLUMN IF NOT EXISTS conteudo jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 7. RPCs de captação pública (SECURITY DEFINER, mesmo padrão de submit_lead_capture)

CREATE OR REPLACE FUNCTION public.get_vaga_publica(p_slug text)
RETURNS TABLE (id uuid, title text, department text, description text, requirements text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT v.id, v.title, v.department, v.description, v.requirements
  FROM public.rh_vagas v
  WHERE v.link_slug = p_slug AND v.status = 'aberta';
$$;

REVOKE ALL ON FUNCTION public.get_vaga_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vaga_publica(text) TO anon, authenticated;

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
  WHERE link_slug = p_vaga_slug AND status = 'aberta';

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

REVOKE ALL ON FUNCTION public.submit_job_application(text, text, text, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_application(text, text, text, text, text, boolean, text) TO anon, authenticated;

-- 8. Bucket de currículos: escrita anônima permitida, leitura só para RH autenticado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rh-curriculos', 'rh-curriculos', false, 10485760,
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'rh_curriculos_public_insert'
  ) THEN
    CREATE POLICY "rh_curriculos_public_insert" ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'rh-curriculos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'rh_curriculos_rh_read'
  ) THEN
    CREATE POLICY "rh_curriculos_rh_read" ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'rh-curriculos'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      );
  END IF;
END $$;
