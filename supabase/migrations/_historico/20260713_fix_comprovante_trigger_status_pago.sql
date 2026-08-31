-- Furo na migração anterior (20260713_enforce_comprovante_obrigatorio_db.sql):
-- o trigger só checava status_reembolso = 'aprovado', mas a CHECK constraint
-- da coluna também permite o status terminal 'pago'. Um UPDATE direto pra
-- 'pago' (pulando 'aprovado') com valor > 100 e comprovante_path vazio
-- contornava a exigência por completo. Cobre os dois status finais.
CREATE OR REPLACE FUNCTION public.crm_viagem_despesas_require_comprovante()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status_reembolso IN ('aprovado', 'pago')
     AND NEW.valor > 100
     AND (NEW.comprovante_path IS NULL OR NEW.comprovante_path = '') THEN
    RAISE EXCEPTION 'Despesas acima de R$100 exigem comprovante anexado antes de aprovar/pagar reembolso.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_viagem_despesas_require_comprovante() FROM PUBLIC, anon, authenticated;
