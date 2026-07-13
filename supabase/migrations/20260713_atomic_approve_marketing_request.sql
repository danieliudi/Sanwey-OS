-- Achado importante da auditoria: aprovar uma Solicitação de Marketing
-- fazia 2 escritas separadas no cliente (criar marketing_deliverables,
-- depois atualizar marketing_requests.deliverable_id) sem transação — se a
-- 2ª falhasse, ficava um deliverable órfão e a solicitação continuava
-- "pendente"; reaprovar criaria um segundo deliverable. RPC única faz as
-- duas escritas na mesma transação (tudo ou nada).
CREATE OR REPLACE FUNCTION public.approve_marketing_request(p_request_id uuid, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_req  public.marketing_requests%ROWTYPE;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND role = ANY (ARRAY['admin', 'marketing', 'gerente_marketing'])
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações de marketing';
  END IF;

  SELECT * INTO v_req FROM public.marketing_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_req.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  INSERT INTO public.marketing_deliverables (
    title, requester_name, department, description, priority, deadline,
    company_ids, stage, notes, created_by
  )
  VALUES (
    v_req.title,
    v_req.requester_name,
    v_req.department,
    NULLIF(concat_ws(E'\n\n---\n', v_req.description, p_notes), ''),
    v_req.priority,
    v_req.deadline,
    coalesce(v_req.company_ids, '{}'),
    'solicitacao',
    CASE WHEN p_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', p_notes, 'at', now())) ELSE '[]'::jsonb END,
    v_uid
  )
  RETURNING id INTO v_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, deliverable_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_marketing_request(uuid, text) FROM PUBLIC, anon;
