-- Marketing module — follow-up fixes
--   1. Storage bucket `marketing-attachments` + RLS for storage.objects
--   2. RPC `mc_set_checklist` so agencia role can tick approval checklists
--      (RLS on marketing_campaigns only allows marketing team to UPDATE)

-- 1. Storage bucket ---------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-attachments', 'marketing-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: marketing team + agencia can read/upload; only marketing can delete
DROP POLICY IF EXISTS mca_storage_read   ON storage.objects;
DROP POLICY IF EXISTS mca_storage_insert ON storage.objects;
DROP POLICY IF EXISTS mca_storage_delete ON storage.objects;

CREATE POLICY mca_storage_read ON storage.objects FOR SELECT USING (
  bucket_id = 'marketing-attachments' AND (
    public.current_user_is_marketing()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'agencia'
  )
);

CREATE POLICY mca_storage_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'marketing-attachments' AND (
    public.current_user_is_marketing()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'agencia'
  )
);

CREATE POLICY mca_storage_delete ON storage.objects FOR DELETE USING (
  bucket_id = 'marketing-attachments'
  AND public.current_user_is_marketing()
);

-- 2. RPC to update approval_checklist (allows agencia to tick items) -------
CREATE OR REPLACE FUNCTION public.mc_set_checklist(
  p_campaign_id uuid,
  p_checklist jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF user_role NOT IN ('admin','marketing','gerente_marketing','agencia') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.marketing_campaigns
  SET approval_checklist = p_checklist
  WHERE id = p_campaign_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mc_set_checklist(uuid, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mc_set_checklist(uuid, jsonb) TO authenticated;
