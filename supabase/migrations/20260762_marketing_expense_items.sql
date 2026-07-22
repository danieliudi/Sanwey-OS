-- Pedido do usuário: permitir múltiplos itens (quantidade × valor unitário)
-- por despesa, pra comparar preços. marketing_expenses.amount continua sendo
-- a fonte da verdade pra despesas SEM itens (comportamento atual, inalterado);
-- quando há itens, um trigger recalcula amount = soma dos itens, pra todo
-- código que já lê `amount` (dashboards, orçamento de campanha) continuar
-- funcionando sem precisar saber que essa tabela nova existe.

CREATE TABLE public.marketing_expense_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   uuid NOT NULL REFERENCES public.marketing_expenses(id) ON DELETE CASCADE,
  description  text NOT NULL,
  quantity     numeric NOT NULL DEFAULT 1,
  unit_value   numeric NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketing_expense_items_expense_idx ON public.marketing_expense_items (expense_id);

ALTER TABLE public.marketing_expense_items ENABLE ROW LEVEL SECURITY;

-- Mesmo critério de acesso de marketing_expenses (linha pai) — se pode ver a
-- despesa, pode ver os itens dela.
CREATE POLICY marketing_expense_items_select
  ON public.marketing_expense_items FOR SELECT
  USING (current_user_is_marketing() OR current_user_has_role('diretoria'));

CREATE POLICY marketing_expense_items_insert
  ON public.marketing_expense_items FOR INSERT
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_expense_items_update
  ON public.marketing_expense_items FOR UPDATE
  USING (current_user_is_marketing())
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_expense_items_delete
  ON public.marketing_expense_items FOR DELETE
  USING (current_user_is_marketing());

CREATE OR REPLACE FUNCTION public.marketing_expense_items_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER marketing_expense_items_updated_at
  BEFORE UPDATE ON public.marketing_expense_items
  FOR EACH ROW EXECUTE FUNCTION public.marketing_expense_items_set_updated_at();

-- Recalcula marketing_expenses.amount = soma(quantity*unit_value) sempre que
-- os itens de uma despesa mudam — despesa sem item nenhum mantém `amount`
-- inalterado (editável direto, comportamento de hoje).
CREATE OR REPLACE FUNCTION public.marketing_expense_items_sync_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expense_id uuid := coalesce(NEW.expense_id, OLD.expense_id);
  v_total numeric;
BEGIN
  SELECT coalesce(sum(quantity * unit_value), 0) INTO v_total
  FROM public.marketing_expense_items
  WHERE expense_id = v_expense_id;

  UPDATE public.marketing_expenses SET amount = v_total WHERE id = v_expense_id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_expense_items_sync_amount() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER marketing_expense_items_sync_amount_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.marketing_expense_items
  FOR EACH ROW EXECUTE FUNCTION public.marketing_expense_items_sync_amount();
