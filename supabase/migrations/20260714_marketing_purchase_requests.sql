-- FASE 2 do pedido de Despesas/Compras: "Compras de Marketing" — processo
-- ligado à cotação (marketing_supplier_quotes) mas indo além dela: qualquer
-- pessoa (mesmo sem login, via formulário compartilhável) pode pedir a
-- compra de algo já pronto (brinde, uniforme, material impresso) que
-- marketing executa até o recebimento. Deliberadamente uma tabela separada
-- de marketing_requests (que é pra pedidos de CRIAÇÃO de material, não
-- compra de item pronto) — ver pedido do usuário: "sem ser junto com
-- solicitações de marketing".
--
-- Etapas confirmadas pelo usuário: solicitado → aprovado → pedido ao
-- fornecedor → entrega parcial → entregue → pago. Chegar em "pago" exige
-- nota fiscal e dispara o registro automático em marketing_expenses (fecha
-- o ciclo pedido pelo usuário: "as despesas criadas aqui, vão sendo
-- registradas nas Despesas, ao chegar no final do kanban").

CREATE TABLE public.marketing_purchase_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number    text,
  item_name         text NOT NULL,
  description       text,
  supplier_id       uuid REFERENCES public.marketing_suppliers(id) ON DELETE SET NULL,
  quantity          numeric,
  unit_price        numeric,
  total_value       numeric,
  stage             text NOT NULL DEFAULT 'solicitado'
    CHECK (stage IN ('solicitado','aprovado','rejeitado','pedido_fornecedor','entrega_parcial','entregue','pago')),
  stage_changed_at  timestamptz NOT NULL DEFAULT now(),
  requester_name    text,
  requester_email   text,
  requester_phone   text,
  requested_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsible_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  rejected_reason   text,
  due_date          date,
  invoice_date      date,
  invoice_url       text,
  company_ids       text[] NOT NULL DEFAULT '{}',
  notes             jsonb NOT NULL DEFAULT '[]'::jsonb,
  expense_id        uuid REFERENCES public.marketing_expenses(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketing_purchase_requests_stage_idx ON public.marketing_purchase_requests (stage);
CREATE INDEX marketing_purchase_requests_supplier_idx ON public.marketing_purchase_requests (supplier_id);
CREATE INDEX marketing_purchase_requests_created_at_idx ON public.marketing_purchase_requests (created_at DESC);

-- Protocolo sequencial "C00001..." (compras), mesma lógica de
-- marketing_requests_number_seq (P00001) — sequence, não max(id)+1, porque
-- esta tabela também aceita INSERT direto de anon (formulário público).
CREATE SEQUENCE public.marketing_purchase_requests_number_seq START 1;

ALTER TABLE public.marketing_purchase_requests
  ALTER COLUMN request_number SET DEFAULT ('C' || lpad(nextval('public.marketing_purchase_requests_number_seq')::text, 5, '0'));
ALTER TABLE public.marketing_purchase_requests
  ALTER COLUMN request_number SET NOT NULL;
ALTER TABLE public.marketing_purchase_requests
  ADD CONSTRAINT marketing_purchase_requests_number_key UNIQUE (request_number);

ALTER TABLE public.marketing_purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_purchase_requests_read
  ON public.marketing_purchase_requests FOR SELECT
  USING (current_user_is_marketing());

-- Formulário interno (marketing/gerente_marketing/admin criando direto).
CREATE POLICY marketing_purchase_requests_insert_internal
  ON public.marketing_purchase_requests FOR INSERT
  WITH CHECK (current_user_is_marketing());

-- Formulário público compartilhável (anon): mesmo espírito de
-- marketing_requests_public_insert (20260713_fix_marketing_requests_public_insert.sql)
-- — trava todas as colunas de decisão/execução pra impedir que o anon
-- grave a própria solicitação já aprovada, com fornecedor/responsável
-- definido ou nota fiscal anexada.
CREATE POLICY marketing_purchase_requests_insert_public
  ON public.marketing_purchase_requests FOR INSERT
  WITH CHECK (
    stage = 'solicitado'
    AND supplier_id IS NULL
    AND responsible_id IS NULL
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND rejected_reason IS NULL
    AND invoice_url IS NULL
    AND invoice_date IS NULL
    AND expense_id IS NULL
    AND requested_by IS NULL
    AND company_ids <@ ARRAY['industria', 'resibag']::text[]
  );

CREATE POLICY marketing_purchase_requests_update
  ON public.marketing_purchase_requests FOR UPDATE
  USING (current_user_is_marketing())
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_purchase_requests_delete
  ON public.marketing_purchase_requests FOR DELETE
  USING (current_user_is_marketing());

CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_purchase_requests_updated_at ON public.marketing_purchase_requests;
CREATE TRIGGER marketing_purchase_requests_updated_at
  BEFORE UPDATE ON public.marketing_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_purchase_requests_set_updated_at();

-- Trava a transição solicitado → aprovado/rejeitado a gerente_marketing/
-- admin mesmo num UPDATE direto (bypass da RPC de aprovação) — mesmo
-- padrão de defesa em profundidade de marketing_quotes_guard_approval.
CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_guard_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.stage = 'solicitado' AND NEW.stage IN ('aprovado', 'rejeitado')
     AND NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
    NEW.stage := OLD.stage;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejected_reason := OLD.rejected_reason;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_purchase_requests_guard_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketing_purchase_requests_guard_approval_trg ON public.marketing_purchase_requests;
CREATE TRIGGER marketing_purchase_requests_guard_approval_trg
  BEFORE UPDATE ON public.marketing_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_purchase_requests_guard_approval();

-- Nota fiscal obrigatória pra fechar como "pago" (pedido do usuário, item
-- 8) — mesmo padrão de crm_viagem_despesas_require_comprovante.
CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_require_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.stage = 'pago' AND (NEW.invoice_url IS NULL OR NEW.invoice_url = '') THEN
    RAISE EXCEPTION 'Compra só pode ser marcada como paga com nota fiscal anexada.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_purchase_requests_require_invoice() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketing_purchase_requests_require_invoice_trg ON public.marketing_purchase_requests;
CREATE TRIGGER marketing_purchase_requests_require_invoice_trg
  BEFORE UPDATE ON public.marketing_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_purchase_requests_require_invoice();

-- Ao chegar em "pago", registra automaticamente em marketing_expenses
-- (pedido do usuário: "despesas criadas aqui vão sendo registradas nas
-- Despesas"). Guard por expense_id IS NULL evita duplicar em updates
-- subsequentes e evita recursão infinita (o UPDATE que seta expense_id
-- dispara este mesmo trigger de novo, mas aí a condição já é falsa).
CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_sync_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expense_id uuid;
BEGIN
  IF NEW.stage = 'pago' AND OLD.stage IS DISTINCT FROM 'pago' AND NEW.expense_id IS NULL THEN
    INSERT INTO public.marketing_expenses (
      company_ids, description, category, amount, status, due_date,
      invoice_date, notes, receipt_url, created_by
    )
    VALUES (
      coalesce(NEW.company_ids, '{}'),
      NEW.item_name || coalesce(' — ' || NEW.request_number, ''),
      'Compra de Marketing',
      coalesce(NEW.total_value, 0),
      'pago',
      NEW.due_date,
      NEW.invoice_date,
      concat_ws(E'\n', 'Origem: compra ' || NEW.request_number, NEW.description),
      NEW.invoice_url,
      NEW.responsible_id
    )
    RETURNING id INTO v_expense_id;

    UPDATE public.marketing_purchase_requests
    SET expense_id = v_expense_id
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_purchase_requests_sync_expense() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketing_purchase_requests_sync_expense_trg ON public.marketing_purchase_requests;
CREATE TRIGGER marketing_purchase_requests_sync_expense_trg
  AFTER UPDATE ON public.marketing_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_purchase_requests_sync_expense();

-- RPCs de aprovação/rejeição — mesmo padrão de approve_marketing_quote,
-- com o gate de role dentro da própria função (redundante com o guard
-- trigger acima, mas dá uma mensagem de erro melhor pro cliente).
CREATE OR REPLACE FUNCTION public.approve_purchase_request(p_id uuid, p_responsible_id uuid DEFAULT NULL)
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
  IF v_row.stage <> 'solicitado' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.marketing_purchase_requests
  SET stage = 'aprovado', approved_by = v_uid, approved_at = now(),
      responsible_id = coalesce(p_responsible_id, responsible_id, v_uid)
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_purchase_request(uuid, uuid) FROM PUBLIC, anon;

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
  IF v_row.stage <> 'solicitado' THEN
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

-- Leitura do protocolo pelo solicitante externo (anon), sem abrir SELECT
-- geral na tabela — mesmo padrão de get_marketing_request_number.
CREATE OR REPLACE FUNCTION public.get_purchase_request_number(p_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT request_number FROM public.marketing_purchase_requests WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.get_purchase_request_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_purchase_request_number(uuid) TO anon, authenticated;

-- Comparação "valor pago no ano passado" (item 3): última compra PAGA
-- registrada pro mesmo fornecedor + mesmo item (case-insensitive), pra
-- gerente comparar com o valor da solicitação atual antes de aprovar.
CREATE OR REPLACE FUNCTION public.get_supplier_last_purchase_price(p_supplier_id uuid, p_item_name text)
RETURNS TABLE(total_value numeric, unit_price numeric, paid_at timestamptz, request_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  IF NOT current_user_is_marketing() THEN
    RAISE EXCEPTION 'Sem permissão para consultar histórico de compras';
  END IF;

  RETURN QUERY
  SELECT r.total_value, r.unit_price, r.stage_changed_at, r.request_number
  FROM public.marketing_purchase_requests r
  WHERE r.supplier_id = p_supplier_id
    AND r.stage = 'pago'
    AND lower(r.item_name) = lower(p_item_name)
  ORDER BY r.stage_changed_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_supplier_last_purchase_price(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supplier_last_purchase_price(uuid, text) TO authenticated;
