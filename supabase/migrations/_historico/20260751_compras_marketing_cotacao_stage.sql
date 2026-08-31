-- Redesign do fluxo de Compras de Marketing pedido pelo usuário:
--   1. Nova etapa "cotacao" entre solicitado e aprovado — comparação de até
--      3 fornecedores candidatos com valor de cada um (quote_options jsonb);
--      na aprovação, escolhe-se qual venceu (define supplier_id + total_value).
--   2. Campos por etapa: "Prazo de pagamento" (aprovado), "Código de pedido
--      do fornecedor" + "Prazo de entrega" (pedido ao fornecedor), campos de
--      entrega parcial, e nota fiscal/CP/data de entrega/quem recebeu (entregue).
-- Aposenta o fluxo antigo de marketing_supplier_quotes (removido da UI em
-- FornecedoresView, tabela/dados históricos mantidos intactos).

ALTER TABLE public.marketing_purchase_requests
  ADD COLUMN IF NOT EXISTS quote_options            jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_terms             text,
  ADD COLUMN IF NOT EXISTS supplier_order_code       text,
  ADD COLUMN IF NOT EXISTS delivery_deadline         date,
  ADD COLUMN IF NOT EXISTS partial_delivered_qty     numeric,
  ADD COLUMN IF NOT EXISTS partial_remaining_qty     numeric,
  ADD COLUMN IF NOT EXISTS partial_new_deadline      date,
  ADD COLUMN IF NOT EXISTS partial_notes             text,
  ADD COLUMN IF NOT EXISTS invoice_number            text,
  ADD COLUMN IF NOT EXISTS payment_control_number    text,
  ADD COLUMN IF NOT EXISTS delivered_at              date,
  ADD COLUMN IF NOT EXISTS received_by               text;

ALTER TABLE public.marketing_purchase_requests DROP CONSTRAINT IF EXISTS marketing_purchase_requests_stage_check;
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_stage_check
  CHECK (stage IN ('solicitado','cotacao','aprovado','rejeitado','pedido_fornecedor','entrega_parcial','entregue','pago'));

-- Guard de aprovação agora trava a transição saindo de "solicitado" OU
-- "cotacao" pra "aprovado"/"rejeitado" (antes só saía de "solicitado").
CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_guard_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.stage IN ('solicitado', 'cotacao') AND NEW.stage IN ('aprovado', 'rejeitado')
     AND NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
    NEW.stage := OLD.stage;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejected_reason := OLD.rejected_reason;
  END IF;
  RETURN NEW;
END;
$$;

-- approve_purchase_request ganha p_supplier_id (fornecedor vencedor da
-- cotação) — quando informado, grava supplier_id e, se houver valor
-- correspondente em quote_options, também total_value.
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
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
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

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_purchase_request(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_purchase_request(uuid, uuid, uuid) TO authenticated;

-- reject_purchase_request também passa a aceitar "cotacao" como etapa de
-- origem válida (mesma regra do approve acima).
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
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
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

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_purchase_request(uuid, text) FROM PUBLIC, anon;
