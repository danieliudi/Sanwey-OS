-- Clients: central client registry used by the Comercial pipeline.
-- Adds: public.clients table + public.leads.client_id FK.

-- 1. clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text,
  city        text,
  state       text,
  cnpj        text,
  company_ids text[] NOT NULL DEFAULT '{}',
  notes       text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_name_idx        ON public.clients (lower(name));
CREATE INDEX IF NOT EXISTS clients_company_ids_idx ON public.clients USING GIN(company_ids);

-- 2. keep updated_at fresh
CREATE OR REPLACE FUNCTION public.clients_touch_row()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS clients_touch ON public.clients;
CREATE TRIGGER clients_touch
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_touch_row();

-- 3. RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the registry.
DROP POLICY IF EXISTS clients_read ON public.clients;
CREATE POLICY clients_read ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Any authenticated user can create / edit clients.
DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients FOR UPDATE
  USING      (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only managers / admins can delete.
DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients FOR DELETE
  USING (
    coalesce(
      (SELECT role IN ('admin','gerente') FROM public.profiles WHERE id = auth.uid()),
      false
    )
  );

-- 4. link leads to a client
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_client_id_idx ON public.leads (client_id);
