-- ─────────────────────────────────────────────────────────────────────────────
-- Módulo de RH: novos roles, campos HR em profiles, e tabelas de domínio
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ampliar constraint de role para incluir rh / gerente_rh
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN (
      'admin','gerente','vendedor','consultor',
      'marketing','gerente_marketing','agencia',
      'rh','gerente_rh'
    ));

-- Idem na tabela de convites, se existir
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations') THEN
    ALTER TABLE public.invitations
      DROP CONSTRAINT IF EXISTS invitations_role_check;
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_role_check
        CHECK (role IN (
          'admin','gerente','vendedor','consultor',
          'marketing','gerente_marketing','agencia',
          'rh','gerente_rh'
        ));
  END IF;
END $$;

-- 2. Campos de RH estendidos em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title       text,
  ADD COLUMN IF NOT EXISTS department      text,
  ADD COLUMN IF NOT EXISTS admission_date  date,
  ADD COLUMN IF NOT EXISTS contract_type   text,
  ADD COLUMN IF NOT EXISTS employee_status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS salary          numeric;

-- 3. Vagas de emprego
CREATE TABLE IF NOT EXISTS public.rh_vagas (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  department       text,
  description      text,
  requirements     text,
  stage            text        NOT NULL DEFAULT 'triagem',
  stage_changed_at timestamptz DEFAULT now(),
  company_ids      text[]      DEFAULT '{}',
  created_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_vagas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_vagas' AND policyname = 'rh_vagas_rh_access'
  ) THEN
    CREATE POLICY "rh_vagas_rh_access" ON public.rh_vagas
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      );
  END IF;
END $$;

-- 4. Candidatos
CREATE TABLE IF NOT EXISTS public.rh_candidatos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id          uuid        REFERENCES public.rh_vagas(id) ON DELETE SET NULL,
  name             text        NOT NULL,
  email            text,
  phone            text,
  linkedin_url     text,
  resume_url       text,
  stage            text        NOT NULL DEFAULT 'triagem',
  stage_changed_at timestamptz DEFAULT now(),
  notes            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  rating           smallint    CHECK (rating BETWEEN 1 AND 5),
  source           text,
  created_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_candidatos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_candidatos' AND policyname = 'rh_candidatos_rh_access'
  ) THEN
    CREATE POLICY "rh_candidatos_rh_access" ON public.rh_candidatos
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      );
  END IF;
END $$;

-- 5. Solicitações de férias e licenças
CREATE TABLE IF NOT EXISTS public.rh_ferias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT 'ferias',
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  status      text        NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','aprovado','recusado')),
  notes       text,
  approved_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_ferias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_ferias' AND policyname = 'rh_ferias_read'
  ) THEN
    CREATE POLICY "rh_ferias_read" ON public.rh_ferias
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_ferias' AND policyname = 'rh_ferias_insert'
  ) THEN
    CREATE POLICY "rh_ferias_insert" ON public.rh_ferias
      FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_ferias' AND policyname = 'rh_ferias_update'
  ) THEN
    CREATE POLICY "rh_ferias_update" ON public.rh_ferias
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      );
  END IF;
END $$;

-- 6. Avaliações de desempenho
CREATE TABLE IF NOT EXISTS public.rh_avaliacoes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  cycle          text        NOT NULL,
  period_start   date        NOT NULL,
  period_end     date        NOT NULL,
  status         text        NOT NULL DEFAULT 'rascunho'
                             CHECK (status IN ('rascunho','em_andamento','concluido')),
  self_rating    numeric     CHECK (self_rating BETWEEN 0 AND 10),
  manager_rating numeric     CHECK (manager_rating BETWEEN 0 AND 10),
  final_rating   numeric     CHECK (final_rating BETWEEN 0 AND 10),
  notes          text,
  crm_metrics    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_avaliacoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_avaliacoes' AND policyname = 'rh_avaliacoes_read'
  ) THEN
    CREATE POLICY "rh_avaliacoes_read" ON public.rh_avaliacoes
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR evaluator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_avaliacoes' AND policyname = 'rh_avaliacoes_write'
  ) THEN
    CREATE POLICY "rh_avaliacoes_write" ON public.rh_avaliacoes
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin','gerente_rh','rh')
        )
      );
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS rh_candidatos_stage_idx     ON public.rh_candidatos (stage);
CREATE INDEX IF NOT EXISTS rh_candidatos_vaga_id_idx   ON public.rh_candidatos (vaga_id);
CREATE INDEX IF NOT EXISTS rh_ferias_user_id_idx       ON public.rh_ferias (user_id);
CREATE INDEX IF NOT EXISTS rh_ferias_status_idx        ON public.rh_ferias (status);
CREATE INDEX IF NOT EXISTS rh_avaliacoes_user_id_idx   ON public.rh_avaliacoes (user_id);
