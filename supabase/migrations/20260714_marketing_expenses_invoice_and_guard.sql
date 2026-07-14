-- FASE 2 (Despesas, itens 2 e 8): data da fatura vira campo próprio, e nota
-- fiscal (receipt_url, já existia mas nunca era exigida nem tinha upload na
-- tela) passa a ser obrigatória pra marcar uma despesa como paga — mesmo
-- padrão de guard trigger já usado em crm_viagem_despesas (ver
-- 20260713_fix_comprovante_trigger_status_pago.sql).

ALTER TABLE public.marketing_expenses
  ADD COLUMN IF NOT EXISTS invoice_date date;

CREATE OR REPLACE FUNCTION public.marketing_expenses_require_receipt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'pago' AND (NEW.receipt_url IS NULL OR NEW.receipt_url = '') THEN
    RAISE EXCEPTION 'Despesa paga exige nota fiscal anexada.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_expenses_require_receipt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketing_expenses_require_receipt_trg ON public.marketing_expenses;
CREATE TRIGGER marketing_expenses_require_receipt_trg
  BEFORE INSERT OR UPDATE ON public.marketing_expenses
  FOR EACH ROW EXECUTE FUNCTION public.marketing_expenses_require_receipt();
