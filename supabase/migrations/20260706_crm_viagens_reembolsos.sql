-- Viagens & Reembolsos: planejamento mensal de visitas (planejado -> realizado)
-- + despesas de reembolso com comprovante e fluxo de aprovação. Resolve a dor
-- do gestor de cruzar manualmente, vendedor por vendedor, o que foi dito que
-- ia ser feito com o que de fato foi feito.

-- 1. Catálogo de categorias de despesa (configurável pelo admin)
CREATE TABLE IF NOT EXISTS public.crm_viagem_categorias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL UNIQUE,
  ativo       boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crm_viagem_categorias (nome) VALUES
  ('Combustível'), ('Hospedagem'), ('Alimentação'), ('Pedágio'), ('Transporte'), ('Outros')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.crm_viagem_categorias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_categorias' AND policyname = 'crm_viagem_categorias_read') THEN
    CREATE POLICY "crm_viagem_categorias_read" ON public.crm_viagem_categorias
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_categorias' AND policyname = 'crm_viagem_categorias_write') THEN
    CREATE POLICY "crm_viagem_categorias_write" ON public.crm_viagem_categorias
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente')));
  END IF;
END $$;

-- 2. Registro de visita/viagem — uma linha evolui de planejado até o desfecho,
--    em vez de duas tabelas separadas pra planejado/realizado (mesmo padrão já
--    usado no pipeline de candidatos: etapa evolui na mesma linha).
CREATE TABLE IF NOT EXISTS public.crm_viagem_registros (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mes_referencia      date        NOT NULL,
  lead_id             text        REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_nome        text,
  destino_planejado   text        NOT NULL,
  data_planejada      date        NOT NULL,
  objetivo            text,
  status              text        NOT NULL DEFAULT 'planejado'
                        CHECK (status IN ('planejado','realizado','nao_realizado','cancelado')),
  data_realizada      date,
  destino_realizado   text,
  resumo_realizado     text,
  motivo_divergencia  text,
  created_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_viagem_registros_vendedor_mes_idx ON public.crm_viagem_registros (vendedor_id, mes_referencia);
CREATE INDEX IF NOT EXISTS crm_viagem_registros_lead_idx ON public.crm_viagem_registros (lead_id);

ALTER TABLE public.crm_viagem_registros ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_registros' AND policyname = 'crm_viagem_registros_read') THEN
    CREATE POLICY "crm_viagem_registros_read" ON public.crm_viagem_registros
      FOR SELECT
      USING (
        vendedor_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_registros' AND policyname = 'crm_viagem_registros_insert') THEN
    CREATE POLICY "crm_viagem_registros_insert" ON public.crm_viagem_registros
      FOR INSERT
      WITH CHECK (vendedor_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_registros' AND policyname = 'crm_viagem_registros_update') THEN
    CREATE POLICY "crm_viagem_registros_update" ON public.crm_viagem_registros
      FOR UPDATE
      USING (
        vendedor_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_registros' AND policyname = 'crm_viagem_registros_delete') THEN
    CREATE POLICY "crm_viagem_registros_delete" ON public.crm_viagem_registros
      FOR DELETE
      USING (
        vendedor_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
      );
  END IF;
END $$;

-- 3. Despesas de reembolso — penduradas numa visita (ou avulsas), com
--    comprovante e fluxo de aprovação. Uma vez decidida (fora de "pendente"),
--    o vendedor não pode mais editar — só ler; só gestor/admin decide.
CREATE TABLE IF NOT EXISTS public.crm_viagem_despesas (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id       uuid        REFERENCES public.crm_viagem_registros(id) ON DELETE SET NULL,
  vendedor_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mes_referencia    date        NOT NULL,
  categoria         text        NOT NULL,
  valor             numeric     NOT NULL CHECK (valor > 0),
  data_despesa      date        NOT NULL,
  descricao         text,
  comprovante_path  text,
  comprovante_ext   text,
  ia_extraido       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status_reembolso  text        NOT NULL DEFAULT 'pendente'
                      CHECK (status_reembolso IN ('pendente','aprovado','rejeitado','pago')),
  observacao_gestor text,
  aprovado_por      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  aprovado_em       timestamptz,
  created_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_viagem_despesas_vendedor_mes_idx ON public.crm_viagem_despesas (vendedor_id, mes_referencia);
CREATE INDEX IF NOT EXISTS crm_viagem_despesas_registro_idx ON public.crm_viagem_despesas (registro_id);
CREATE INDEX IF NOT EXISTS crm_viagem_despesas_status_idx ON public.crm_viagem_despesas (status_reembolso);

ALTER TABLE public.crm_viagem_despesas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_despesas' AND policyname = 'crm_viagem_despesas_read') THEN
    CREATE POLICY "crm_viagem_despesas_read" ON public.crm_viagem_despesas
      FOR SELECT
      USING (
        vendedor_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_despesas' AND policyname = 'crm_viagem_despesas_insert') THEN
    CREATE POLICY "crm_viagem_despesas_insert" ON public.crm_viagem_despesas
      FOR INSERT
      WITH CHECK (
        (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
      );
  END IF;
  -- Update: o vendedor só edita a própria despesa enquanto ela ainda está
  -- pendente (USING trava no estado atual, WITH CHECK trava no estado
  -- resultante — juntos impedem editar depois de decidida, mesmo sem tocar
  -- no campo de status).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_despesas' AND policyname = 'crm_viagem_despesas_update') THEN
    CREATE POLICY "crm_viagem_despesas_update" ON public.crm_viagem_despesas
      FOR UPDATE
      USING (
        (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
      )
      WITH CHECK (
        (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_viagem_despesas' AND policyname = 'crm_viagem_despesas_delete') THEN
    CREATE POLICY "crm_viagem_despesas_delete" ON public.crm_viagem_despesas
      FOR DELETE
      USING (
        (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
      );
  END IF;
END $$;

-- 4. Bucket de comprovantes — caminho `${vendedor_id}/${despesa_id}.${ext}`,
--    dono lê/escreve o próprio, gestor lê tudo (mesmo padrão de segurança já
--    usado nos buckets de RH, adaptado pra self-service do vendedor).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('crm-comprovantes', 'crm-comprovantes', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'crm_comprovantes_insert_own') THEN
    CREATE POLICY "crm_comprovantes_insert_own" ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'crm-comprovantes' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'crm_comprovantes_select') THEN
    CREATE POLICY "crm_comprovantes_select" ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'crm-comprovantes' AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente'))
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'crm_comprovantes_delete_own') THEN
    CREATE POLICY "crm_comprovantes_delete_own" ON storage.objects
      FOR DELETE
      USING (bucket_id = 'crm-comprovantes' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
