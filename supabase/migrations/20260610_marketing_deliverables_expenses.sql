-- Marketing deliverables and expenses tables

CREATE TABLE IF NOT EXISTS public.marketing_deliverables (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_ids      text[] NOT NULL DEFAULT '{}',
  campaign_id      uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  title            text NOT NULL,
  stage            text NOT NULL DEFAULT 'pendente',
  stage_changed_at timestamptz DEFAULT now(),
  assignee         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deadline         timestamptz,
  notes            jsonb DEFAULT '[]'::jsonb,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_deliverables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS md_select ON public.marketing_deliverables;
DROP POLICY IF EXISTS md_insert ON public.marketing_deliverables;
DROP POLICY IF EXISTS md_update ON public.marketing_deliverables;
DROP POLICY IF EXISTS md_delete ON public.marketing_deliverables;

CREATE POLICY md_select ON public.marketing_deliverables FOR SELECT USING (
  public.current_user_is_marketing()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'agencia'
);
CREATE POLICY md_insert ON public.marketing_deliverables FOR INSERT WITH CHECK (
  public.current_user_is_marketing()
);
CREATE POLICY md_update ON public.marketing_deliverables FOR UPDATE USING (
  public.current_user_is_marketing()
);
CREATE POLICY md_delete ON public.marketing_deliverables FOR DELETE USING (
  public.current_user_is_marketing()
);

CREATE TABLE IF NOT EXISTS public.marketing_expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_ids text[] NOT NULL DEFAULT '{}',
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  description text NOT NULL,
  category    text NOT NULL DEFAULT 'Outros',
  amount      numeric DEFAULT 0,
  status      text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente')),
  due_date    timestamptz,
  notes       text,
  receipt_url text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS me_select ON public.marketing_expenses;
DROP POLICY IF EXISTS me_insert ON public.marketing_expenses;
DROP POLICY IF EXISTS me_update ON public.marketing_expenses;
DROP POLICY IF EXISTS me_delete ON public.marketing_expenses;

CREATE POLICY me_select ON public.marketing_expenses FOR SELECT USING (
  public.current_user_is_marketing()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'agencia'
);
CREATE POLICY me_insert ON public.marketing_expenses FOR INSERT WITH CHECK (
  public.current_user_is_marketing()
);
CREATE POLICY me_update ON public.marketing_expenses FOR UPDATE USING (
  public.current_user_is_marketing()
);
CREATE POLICY me_delete ON public.marketing_expenses FOR DELETE USING (
  public.current_user_is_marketing()
);

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at_deliverables()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_deliverables ON public.marketing_deliverables;
CREATE TRIGGER set_updated_at_deliverables
  BEFORE UPDATE ON public.marketing_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at_deliverables();

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at_expenses()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_expenses ON public.marketing_expenses;
CREATE TRIGGER set_updated_at_expenses
  BEFORE UPDATE ON public.marketing_expenses
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at_expenses();
