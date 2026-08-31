-- Clientes: código externo por empresa (ex.: Kronos), status ativo/inativo,
-- e histórico de faturamento por ano (tabela própria — evita migration nova
-- a cada virada de ano, ao contrário de colunas fixas "total_2023" etc.).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS external_codes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'));

CREATE TABLE IF NOT EXISTS public.client_billing_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  year        int NOT NULL,
  total_value numeric(14,2) NOT NULL DEFAULT 0,
  order_count int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (client_id, year)
);

CREATE INDEX IF NOT EXISTS client_billing_history_client_id_idx ON public.client_billing_history (client_id);

ALTER TABLE public.client_billing_history ENABLE ROW LEVEL SECURITY;

-- Mesmo modelo de RLS já usado em clients (read/write aberto a autenticado,
-- delete só admin/gerente) — é parte do mesmo registro comercial.
DROP POLICY IF EXISTS client_billing_history_read ON public.client_billing_history;
CREATE POLICY client_billing_history_read ON public.client_billing_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS client_billing_history_insert ON public.client_billing_history;
CREATE POLICY client_billing_history_insert ON public.client_billing_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS client_billing_history_update ON public.client_billing_history;
CREATE POLICY client_billing_history_update ON public.client_billing_history FOR UPDATE
  USING      (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS client_billing_history_delete ON public.client_billing_history;
CREATE POLICY client_billing_history_delete ON public.client_billing_history FOR DELETE
  USING (
    coalesce(
      (SELECT role IN ('admin','gerente') FROM public.profiles WHERE id = auth.uid()),
      false
    )
  );

CREATE OR REPLACE FUNCTION public.client_billing_history_touch_row()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS client_billing_history_touch ON public.client_billing_history;
CREATE TRIGGER client_billing_history_touch
  BEFORE UPDATE ON public.client_billing_history
  FOR EACH ROW EXECUTE FUNCTION public.client_billing_history_touch_row();
