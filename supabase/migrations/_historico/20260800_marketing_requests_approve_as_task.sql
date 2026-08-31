-- Pedido do Daniel: ao aprovar uma Solicitação de Marketing, o aprovador
-- passa a poder escolher o destino — Entrega (agência externa, fluxo já
-- existente) ou Tarefa (equipe interna, novo). Confirmado com ele: (1) OK
-- criar coluna nova (aditiva, mesmo padrão de deliverable_id) pra rastrear
-- o vínculo quando vira tarefa; (2) OK dobrar requester_name/email/
-- department dentro da descrição da tarefa (marketing_tasks não tem essas
-- colunas próprias — mesmo formato já usado hoje pras Observações internas).

ALTER TABLE public.marketing_requests
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.marketing_tasks(id) ON DELETE SET NULL;

-- Mesma defesa que já existia pra deliverable_id: formulário público nunca
-- grava esse vínculo direto (só a RPC de aprovação grava, via SECURITY DEFINER).
DROP POLICY IF EXISTS marketing_requests_public_insert ON public.marketing_requests;
CREATE POLICY marketing_requests_public_insert
  ON public.marketing_requests
  FOR INSERT
  WITH CHECK (
    status = 'pendente'
    AND is_demo = false
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND deliverable_id IS NULL
    AND task_id IS NULL
    AND rejection_reason IS NULL
    AND company_ids <@ ARRAY['industria', 'resibag', 'montemor']::text[]
  );

-- Espelha approve_marketing_request, mas cria uma marketing_tasks em vez de
-- marketing_deliverables. marketing_tasks não tem requester_name/email/
-- department/request_number próprios — esses dados entram formatados no
-- topo da description (mesmo bloco de texto que p_notes já usa embaixo).
CREATE OR REPLACE FUNCTION public.approve_marketing_request_as_task(p_request_id uuid, p_notes text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_req       public.marketing_requests%ROWTYPE;
  v_id        uuid;
  v_requester text;
  v_desc      text;
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

  v_requester := NULLIF(concat_ws(' · ', v_req.requester_name, v_req.requester_email, v_req.department), '');
  v_desc := NULLIF(concat_ws(
    E'\n\n---\n',
    CASE WHEN v_requester IS NOT NULL THEN 'Solicitante: ' || v_requester ELSE NULL END,
    v_req.description,
    p_notes
  ), '');

  INSERT INTO public.marketing_tasks (
    title, description, priority, deadline, company_ids, stage, notes, created_by
  )
  VALUES (
    v_req.title,
    v_desc,
    v_req.priority,
    v_req.deadline,
    coalesce(v_req.company_ids, '{}'),
    'a_fazer',
    CASE WHEN p_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', p_notes, 'at', now())) ELSE '[]'::jsonb END,
    v_uid
  )
  RETURNING id INTO v_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, task_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_marketing_request_as_task(uuid, text) TO authenticated;
