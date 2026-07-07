-- Formulário de Solicitação de Marketing: outros departamentos podem abrir
-- pedidos para a equipe de marketing. Cada solicitação entra como 'pendente',
-- pode ser aprovada (gerando automaticamente uma entrega em marketing_deliverables)
-- ou rejeitada. O formulário público usa a rota /solicitar-marketing sem login.

CREATE TABLE IF NOT EXISTS public.marketing_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  description      text,
  department       text,
  requester_name   text,
  requester_email  text,
  request_type     text,
  priority         text        NOT NULL DEFAULT 'media'
                     CHECK (priority IN ('baixa','media','alta')),
  deadline         date,
  company_ids      text[]      NOT NULL DEFAULT '{}',
  status           text        NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','aprovado','rejeitado')),
  rejection_reason text,
  notes            text,
  approved_at      timestamptz,
  approved_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  deliverable_id   uuid        REFERENCES public.marketing_deliverables(id) ON DELETE SET NULL,
  is_demo          boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_requests_status_idx ON public.marketing_requests (status);
CREATE INDEX IF NOT EXISTS marketing_requests_created_at_idx ON public.marketing_requests (created_at DESC);

ALTER TABLE public.marketing_requests ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa autenticada pode ler solicitações (para agência e outros módulos)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_requests' AND policyname = 'marketing_requests_read') THEN
    CREATE POLICY "marketing_requests_read" ON public.marketing_requests
      FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
      );
  END IF;

  -- Marketing + admin podem criar/editar/deletar
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_requests' AND policyname = 'marketing_requests_write') THEN
    CREATE POLICY "marketing_requests_write" ON public.marketing_requests
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'marketing', 'gerente_marketing')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'marketing', 'gerente_marketing')
        )
      );
  END IF;

  -- Inserção pública: permite formulário externo (anon) criar solicitações
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_requests' AND policyname = 'marketing_requests_public_insert') THEN
    CREATE POLICY "marketing_requests_public_insert" ON public.marketing_requests
      FOR INSERT
      WITH CHECK (status = 'pendente');
  END IF;
END $$;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.marketing_requests_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_requests_updated_at ON public.marketing_requests;
CREATE TRIGGER marketing_requests_updated_at
  BEFORE UPDATE ON public.marketing_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_requests_set_updated_at();
