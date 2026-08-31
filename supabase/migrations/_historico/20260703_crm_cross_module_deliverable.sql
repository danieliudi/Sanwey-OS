-- Permite que automações do CRM (disparadas por qualquer usuário autenticado,
-- não só marketing) criem uma entrega em Marketing, sem reabrir a RLS de
-- marketing_deliverables (que continua exigindo role de marketing pra
-- insert/update/delete manuais). Mesmo padrão de RPC SECURITY DEFINER já
-- usado em submit_job_application/submit_lead_capture.

CREATE OR REPLACE FUNCTION public.crm_create_cross_module_deliverable(
  p_title        text,
  p_company_ids  text[] DEFAULT '{}',
  p_description  text DEFAULT NULL,
  p_priority     text DEFAULT 'media',
  p_deadline     timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id  uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF coalesce(trim(p_title), '') = '' THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  INSERT INTO public.marketing_deliverables (
    title, company_ids, description, priority, deadline,
    department, request_type, requester_name, created_by
  )
  VALUES (
    trim(p_title),
    coalesce(p_company_ids, '{}'),
    p_description,
    coalesce(nullif(trim(p_priority), ''), 'media'),
    p_deadline,
    'Comercial',
    'automacao_crm',
    (SELECT name FROM public.profiles WHERE id = v_uid),
    v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_create_cross_module_deliverable(text, text[], text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_create_cross_module_deliverable(text, text[], text, text, timestamptz) TO authenticated;
