-- Marketing module: campaigns, attachments, new roles
-- Adds: marketing_campaigns, marketing_campaign_attachments tables
-- New roles: marketing, gerente_marketing, agencia

-- 1. Extend role constraints
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin','gerente','vendedor','consultor','marketing','gerente_marketing','agencia'));

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin','gerente','vendedor','consultor','marketing','gerente_marketing','agencia'));

-- 2. Helper: is current user a marketing team member?
CREATE OR REPLACE FUNCTION public.current_user_is_marketing()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT role IN ('marketing','gerente_marketing','admin')
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_is_marketing() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_is_marketing() TO authenticated;

-- 3. marketing_campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_ids      text[]    NOT NULL DEFAULT '{}',
  name             text      NOT NULL,
  channel          text,
  budget           numeric   DEFAULT 0,
  kpi              text,
  launch_date      timestamptz,
  end_date         timestamptz,
  stage            text      NOT NULL DEFAULT 'briefing',
  stage_changed_at timestamptz DEFAULT now(),
  performance_score numeric  DEFAULT 0,
  owner            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  agency_name      text,
  utm_url          text,
  drive_folder_url text,
  drive_folder_id  text,
  approval_checklist jsonb   DEFAULT '[]'::jsonb,
  notes            jsonb     DEFAULT '[]'::jsonb,
  activities       jsonb     DEFAULT '[]'::jsonb,
  starred          boolean   DEFAULT false,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mc_stage_idx       ON public.marketing_campaigns(stage);
CREATE INDEX IF NOT EXISTS mc_owner_idx       ON public.marketing_campaigns(owner);
CREATE INDEX IF NOT EXISTS mc_company_ids_idx ON public.marketing_campaigns USING GIN(company_ids);

CREATE OR REPLACE FUNCTION public.marketing_campaigns_touch_row()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS mc_touch ON public.marketing_campaigns;
CREATE TRIGGER mc_touch
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.marketing_campaigns_touch_row();

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mc_read  ON public.marketing_campaigns;
CREATE POLICY mc_read ON public.marketing_campaigns FOR SELECT USING (
  current_user_is_marketing()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'agencia'
);

DROP POLICY IF EXISTS mc_write ON public.marketing_campaigns;
CREATE POLICY mc_write ON public.marketing_campaigns
  FOR ALL
  USING     (current_user_is_marketing())
  WITH CHECK(current_user_is_marketing());

-- 4. marketing_campaign_attachments
CREATE TABLE IF NOT EXISTS public.marketing_campaign_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  company_ids text[] NOT NULL DEFAULT '{}',
  file_name   text NOT NULL,
  file_path   text NOT NULL,
  file_size   bigint,
  mime_type   text,
  drive_url   text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mca_campaign_id_idx ON public.marketing_campaign_attachments(campaign_id);

ALTER TABLE public.marketing_campaign_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mca_read ON public.marketing_campaign_attachments;
CREATE POLICY mca_read ON public.marketing_campaign_attachments FOR SELECT USING (
  current_user_is_marketing()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'agencia'
);

DROP POLICY IF EXISTS mca_insert ON public.marketing_campaign_attachments;
CREATE POLICY mca_insert ON public.marketing_campaign_attachments FOR INSERT WITH CHECK (
  current_user_is_marketing()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'agencia'
);

DROP POLICY IF EXISTS mca_delete ON public.marketing_campaign_attachments;
CREATE POLICY mca_delete ON public.marketing_campaign_attachments FOR DELETE USING (
  current_user_is_marketing()
);
