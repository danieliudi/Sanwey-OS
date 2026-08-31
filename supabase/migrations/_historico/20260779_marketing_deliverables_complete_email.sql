-- P1.7 da auditoria Zero Bullshit (parte 2): approve_marketing_request ainda
-- não copiava requester_email de marketing_requests pra marketing_deliverables
-- (coluna criada em 20260777, nunca populada) — sem isso a edge function de
-- aviso de entrega concluída não tem pra quem enviar. Copia aqui, mesmo
-- padrão de requester_name/department/etc já copiados por essa RPC. Também
-- adiciona email_error (mesmo papel do de marketing_requests: guarda a falha
-- de envio pra tela oferecer "tentar de novo" sem repetir a transição).

ALTER TABLE public.marketing_deliverables ADD COLUMN IF NOT EXISTS email_error text;

CREATE OR REPLACE FUNCTION public.approve_marketing_request(p_request_id uuid, p_notes text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_req  public.marketing_requests%ROWTYPE;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
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
    title, requester_name, requester_email, department, description, priority, deadline,
    company_ids, stage, notes, created_by, request_number
  )
  VALUES (
    v_req.title,
    v_req.requester_name,
    v_req.requester_email,
    v_req.department,
    NULLIF(concat_ws(E'\n\n---\n', v_req.description, p_notes), ''),
    v_req.priority,
    v_req.deadline,
    coalesce(v_req.company_ids, '{}'),
    'solicitacao',
    CASE WHEN p_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', p_notes, 'at', now())) ELSE '[]'::jsonb END,
    v_uid,
    v_req.request_number
  )
  RETURNING id INTO v_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, deliverable_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$function$;
