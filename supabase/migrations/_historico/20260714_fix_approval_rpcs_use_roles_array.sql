-- FASE 5 prep: mesma correção já aplicada às RPCs de compras (ver
-- 20260714_marketing_purchase_requests.sql/migration de multi-cargo) —
-- estas 3 RPCs + o guard trigger de cotações ainda checavam o `role`
-- escalar em vez do array `roles` (current_user_has_role), então um
-- usuário com gerente_marketing como cargo SECUNDÁRIO não conseguia
-- aprovar solicitações de marketing nem cotações, mesmo tendo o cargo.

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
    title, requester_name, department, description, priority, deadline,
    company_ids, stage, notes, created_by, request_number
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

CREATE OR REPLACE FUNCTION public.approve_marketing_quote(p_quote_id uuid)
RETURNS marketing_supplier_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_supplier_quotes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar cotações';
  END IF;

  SELECT * INTO v_row FROM public.marketing_supplier_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Cotação já foi decidida';
  END IF;

  UPDATE public.marketing_supplier_quotes
  SET status = 'aprovada', approved_by = v_uid, approved_at = now()
  WHERE id = p_quote_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_marketing_quote(p_quote_id uuid, p_reason text DEFAULT NULL::text)
RETURNS marketing_supplier_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_supplier_quotes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar cotações';
  END IF;

  SELECT * INTO v_row FROM public.marketing_supplier_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Cotação já foi decidida';
  END IF;

  UPDATE public.marketing_supplier_quotes
  SET status = 'rejeitada', approved_by = v_uid, approved_at = now(), rejected_reason = p_reason
  WHERE id = p_quote_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.marketing_quotes_guard_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status IN ('aprovada', 'rejeitada')
     AND NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
    NEW.status := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejected_reason := OLD.rejected_reason;
  END IF;
  RETURN NEW;
END;
$function$;
