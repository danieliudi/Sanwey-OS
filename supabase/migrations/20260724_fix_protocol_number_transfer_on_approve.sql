-- Achado HIGH da auditoria de plataforma: números de protocolo (P0000X)
-- podiam se duplicar depois de aprovar uma marketing_request e depois
-- excluí-la.
--
-- Cenário: approve_marketing_request() cria a entrega copiando
-- request_number da solicitação de origem (v_req.request_number), sem
-- registrar um novo dono no razão (marketing_protocol_numbers) — o
-- registro do razão continua apontando pra (source='marketing_request',
-- record_id=p_request_id). Como marketing_requests_write não distingue
-- status (mesmo já aprovada, dá pra excluir a solicitação), excluir a
-- solicitação aprovada dispara trg_marketing_requests_protocol_release,
-- que libera esse número no razão — mesmo ele ainda estando visivelmente
-- em uso na entrega. A próxima solicitação nova recebe esse número livre,
-- e agora duas linhas (a entrega antiga e a nova solicitação) mostram o
-- mesmo P0000X.
--
-- Fix: no INSERT da entrega, transferir a posse do registro do razão de
-- (marketing_request, p_request_id) pra (deliverable, v_id) — assim, ao
-- excluir a solicitação depois, o release trigger não encontra mais nada
-- pra apagar (já foi transferido) e o número continua reservado sob a
-- entrega.
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

  UPDATE public.marketing_protocol_numbers
  SET source = 'deliverable', record_id = v_id
  WHERE source = 'marketing_request' AND record_id = p_request_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, deliverable_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$function$;

-- Bônus alinhado ao mesmo arquivo: marketing_requests_read checava
-- profiles.role escalar (não roles[]) — gerente_marketing como cargo
-- ADICIONAL não conseguia nem listar as solicitações. Alinha com o mesmo
-- helper array-aware já usado em marketing_requests_write.
DROP POLICY IF EXISTS "marketing_requests_read" ON public.marketing_requests;
CREATE POLICY "marketing_requests_read" ON public.marketing_requests
  FOR SELECT
  USING (current_user_is_marketing());
