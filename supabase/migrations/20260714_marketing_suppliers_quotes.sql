-- Cadastro de fornecedores de marketing (agência, gráfica, confecção,
-- stand de feira etc.) + fluxo de solicitação de cotação: marketing cria a
-- solicitação vinculada a um fornecedor, gerente_marketing/admin aprova, e
-- só na aprovação o e-mail sai automaticamente (edge function
-- send-quote-request) usando um template único e editável.

-- ── Fornecedores ─────────────────────────────────────────────────────────
CREATE TABLE public.marketing_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'outro'
    CHECK (category IN ('agencia', 'grafica', 'confeccao', 'stand_feira', 'outro')),
  contact_name text,
  email text NOT NULL,
  phone text,
  notes text,
  company_ids text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_suppliers_read
  ON public.marketing_suppliers FOR SELECT
  USING (current_user_is_marketing());

CREATE POLICY marketing_suppliers_insert
  ON public.marketing_suppliers FOR INSERT
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_suppliers_update
  ON public.marketing_suppliers FOR UPDATE
  USING (current_user_is_marketing())
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_suppliers_delete
  ON public.marketing_suppliers FOR DELETE
  USING (current_user_is_marketing());

-- ── Cotações ─────────────────────────────────────────────────────────────
CREATE TABLE public.marketing_supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.marketing_suppliers(id) ON DELETE CASCADE,
  company_ids text[] NOT NULL DEFAULT '{}',
  title text NOT NULL,
  description text,
  deadline date,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'enviada', 'respondida')),
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_reason text,
  sent_at timestamptz,
  email_error text,
  response_notes text,
  response_value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_supplier_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_supplier_quotes_read
  ON public.marketing_supplier_quotes FOR SELECT
  USING (current_user_is_marketing());

-- Só entra como 'pendente' e sem os campos de decisão/envio já preenchidos
-- — aprovar/rejeitar/enviar são ações separadas (RPC + edge function).
CREATE POLICY marketing_supplier_quotes_insert
  ON public.marketing_supplier_quotes FOR INSERT
  WITH CHECK (
    current_user_is_marketing()
    AND status = 'pendente'
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND sent_at IS NULL
  );

CREATE POLICY marketing_supplier_quotes_update
  ON public.marketing_supplier_quotes FOR UPDATE
  USING (current_user_is_marketing())
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_supplier_quotes_delete
  ON public.marketing_supplier_quotes FOR DELETE
  USING (current_user_is_marketing());

-- Trava a transição pendente → aprovada/rejeitada a gerente_marketing/admin
-- mesmo que alguém tente um UPDATE direto pulando a RPC de aprovação —
-- mesmo padrão de defesa em profundidade já usado em profiles/rh_ferias.
CREATE OR REPLACE FUNCTION public.marketing_quotes_guard_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status IN ('aprovada', 'rejeitada')
     AND NOT (current_user_is_admin() OR current_user_role() = 'gerente_marketing') THEN
    NEW.status := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejected_reason := OLD.rejected_reason;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marketing_quotes_guard_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketing_quotes_guard_approval_trg ON public.marketing_supplier_quotes;
CREATE TRIGGER marketing_quotes_guard_approval_trg
  BEFORE UPDATE ON public.marketing_supplier_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.marketing_quotes_guard_approval();

-- RPCs de aprovação/rejeição (atômicas, com o gate de role dentro da
-- própria função) — o cliente chama isso e, se aprovada, dispara a edge
-- function send-quote-request em seguida pra mandar o e-mail de verdade.
CREATE OR REPLACE FUNCTION public.approve_marketing_quote(p_quote_id uuid)
RETURNS public.marketing_supplier_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_supplier_quotes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND role = ANY (ARRAY['admin', 'gerente_marketing'])
  ) THEN
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
$$;

REVOKE EXECUTE ON FUNCTION public.approve_marketing_quote(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.reject_marketing_quote(p_quote_id uuid, p_reason text DEFAULT NULL)
RETURNS public.marketing_supplier_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_supplier_quotes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND role = ANY (ARRAY['admin', 'gerente_marketing'])
  ) THEN
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
$$;

REVOKE EXECUTE ON FUNCTION public.reject_marketing_quote(uuid, text) FROM PUBLIC, anon;

-- ── Template de e-mail (único, editável — singleton) ────────────────────
CREATE TABLE public.marketing_quote_email_template (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  subject text NOT NULL DEFAULT 'Solicitação de cotação — {{TITLE}}',
  body_html text NOT NULL DEFAULT $tpl$<p>Olá, {{SUPPLIER_NAME}},</p>
<p>Estamos solicitando uma cotação para: <strong>{{TITLE}}</strong>.</p>
<p>{{DESCRIPTION}}</p>
<p>Prazo desejado para resposta: <strong>{{DEADLINE}}</strong></p>
<p>Solicitado por {{REQUESTED_BY}} — Grupo Sanwey ({{COMPANY_NAMES}}).</p>
<p>Qualquer dúvida, é só responder este e-mail.</p>
<p>Atenciosamente,<br/>Grupo Sanwey</p>$tpl$,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.marketing_quote_email_template (id) VALUES (true);

ALTER TABLE public.marketing_quote_email_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_quote_email_template_read
  ON public.marketing_quote_email_template FOR SELECT
  USING (current_user_is_marketing());

CREATE POLICY marketing_quote_email_template_update
  ON public.marketing_quote_email_template FOR UPDATE
  USING (current_user_is_admin() OR current_user_role() = 'gerente_marketing')
  WITH CHECK (current_user_is_admin() OR current_user_role() = 'gerente_marketing');
