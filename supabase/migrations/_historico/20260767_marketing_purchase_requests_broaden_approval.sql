-- Compras de Marketing: qualquer pessoa de marketing (não só gerente_
-- marketing/admin) passa a poder aprovar/rejeitar solicitações — pedido
-- explícito do usuário. Mesmo critério já usado em approve_marketing_request
-- (20260714_fix_approval_rpcs_use_roles_array.sql):
-- current_user_is_admin() OR current_user_has_role('marketing') OR
-- current_user_has_role('gerente_marketing').
--
-- Aproveita a mesma migration pra notificar o solicitante original
-- (requested_by) quando a decisão é tomada (aprovado/rejeitado) — hoje
-- ninguém é avisado do resultado. Solicitações via formulário público não
-- têm requested_by (anon insere sem usuário logado associado); nesse caso
-- simplesmente não há quem notificar, tratado como caso normal, não erro.

CREATE OR REPLACE FUNCTION public.approve_purchase_request(p_id uuid, p_responsible_id uuid DEFAULT NULL, p_supplier_id uuid DEFAULT NULL)
RETURNS public.marketing_purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_purchase_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações de compra';
  END IF;

  SELECT * INTO v_row FROM public.marketing_purchase_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.stage NOT IN ('solicitado', 'cotacao') THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.marketing_purchase_requests
  SET stage = 'aprovado', approved_by = v_uid, approved_at = now(),
      responsible_id = coalesce(p_responsible_id, responsible_id, v_uid),
      supplier_id = coalesce(p_supplier_id, supplier_id),
      total_value = coalesce(
        (SELECT (elem->>'value')::numeric
           FROM jsonb_array_elements(v_row.quote_options) elem
          WHERE p_supplier_id IS NOT NULL AND elem->>'supplierId' = p_supplier_id::text),
        total_value
      )
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
    SELECT v_row.requested_by, 'purchase_request_approved',
           'Sua solicitação de compra foi aprovada',
           v_row.item_name || ' (' || v_row.request_number || ')',
           jsonb_build_object('module', 'purchase_requests', 'id', v_row.id),
           v_uid
    WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = v_row.requested_by AND mention_notifications_enabled = true);
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_purchase_request(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_purchase_request(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_purchase_request(p_id uuid, p_reason text DEFAULT NULL)
RETURNS public.marketing_purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_purchase_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar solicitações de compra';
  END IF;

  SELECT * INTO v_row FROM public.marketing_purchase_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.stage NOT IN ('solicitado', 'cotacao') THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.marketing_purchase_requests
  SET stage = 'rejeitado', approved_by = v_uid, approved_at = now(), rejected_reason = p_reason
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
    SELECT v_row.requested_by, 'purchase_request_rejected',
           'Sua solicitação de compra foi rejeitada',
           v_row.item_name || ' (' || v_row.request_number || ')',
           jsonb_build_object('module', 'purchase_requests', 'id', v_row.id),
           v_uid
    WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = v_row.requested_by AND mention_notifications_enabled = true);
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_purchase_request(uuid, text) FROM PUBLIC, anon;

-- Guard trigger (defesa em profundidade contra UPDATE direto bypassando as
-- RPCs acima) — mesmo critério ampliado.
CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_guard_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.stage IN ('solicitado', 'cotacao') AND NEW.stage IN ('aprovado', 'rejeitado')
     AND NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    NEW.stage := OLD.stage;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejected_reason := OLD.rejected_reason;
  END IF;
  RETURN NEW;
END;
$$;
