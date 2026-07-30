-- Unifica o formulário público de Solicitação de Marketing: um só formulário
-- (/solicitar-marketing e /solicitar-compra, ambos no mesmo componente) com
-- seletor de tipo — "Material de Marketing" ou "Compra". Os dois passam a
-- entrar na mesma fila de Solicitações como 'pendente', em vez de Compra
-- pular direto pro Kanban de Compras sem nenhum gate de aprovação (o formulário
-- antigo inseria direto em marketing_purchase_requests, stage='solicitado').
--
-- Pedido do Daniel (30/07/2026), com uma ressalva confirmada depois do
-- mockup: só Material tem a escolha de destino (Entrega/Tarefa) ao aprovar —
-- Compra vai automaticamente pro Kanban de Compras, sem decisão nenhuma.
--
-- marketing_purchase_requests continua intocada (schema, RLS, numeração
-- própria com prefixo "C") — decisão de manter esse board com identidade
-- separada é de uma sessão anterior (ver comentário em
-- 20260714_marketing_purchase_requests.sql). Só ganha uma nova via de
-- entrada: a aprovação de uma solicitação, em vez do form público direto.

ALTER TABLE public.marketing_requests
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'material' CHECK (category IN ('material', 'compra'));

ALTER TABLE public.marketing_requests
  ADD COLUMN IF NOT EXISTS purchase_request_id uuid REFERENCES public.marketing_purchase_requests(id) ON DELETE SET NULL;

-- Mesma defesa que já existe pra deliverable_id/task_id — formulário público
-- nunca grava esse vínculo direto, só a RPC de aprovação (SECURITY DEFINER).
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
    AND purchase_request_id IS NULL
    AND rejection_reason IS NULL
    AND company_ids <@ ARRAY['industria', 'resibag', 'montemor']::text[]
  );

-- Espelha approve_marketing_request_as_task, mas cria uma
-- marketing_purchase_requests em vez de marketing_tasks/marketing_deliverables.
-- title (nome do item pra category='compra') e requester_email migram pros
-- campos equivalentes; stage nasce em 'solicitado', igual ao form antigo.
CREATE OR REPLACE FUNCTION public.approve_marketing_request_as_purchase(p_request_id uuid, p_notes text DEFAULT NULL::text)
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

  INSERT INTO public.marketing_purchase_requests (
    item_name, description, requester_name, requester_email, due_date, company_ids, stage, notes, created_by
  )
  VALUES (
    v_req.title,
    NULLIF(concat_ws(E'\n\n---\n', v_req.description, p_notes), ''),
    v_req.requester_name,
    v_req.requester_email,
    v_req.deadline,
    coalesce(v_req.company_ids, '{}'),
    'solicitado',
    CASE WHEN p_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', p_notes, 'at', now())) ELSE '[]'::jsonb END,
    v_uid
  )
  RETURNING id INTO v_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, purchase_request_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_marketing_request_as_purchase(uuid, text) TO authenticated;
