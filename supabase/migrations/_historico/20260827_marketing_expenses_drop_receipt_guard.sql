-- Retira a obrigatoriedade de nota fiscal pra marcar despesa de Marketing
-- como paga (pedido do Daniel, 05/08/2026) — nota fiscal continua podendo
-- ser anexada normalmente, só deixa de travar o status 'pago' quando ausente.
-- Reverte o guard criado em 20260714_marketing_expenses_invoice_and_guard.sql.

DROP TRIGGER IF EXISTS marketing_expenses_require_receipt_trg ON public.marketing_expenses;
DROP FUNCTION IF EXISTS public.marketing_expenses_require_receipt();
