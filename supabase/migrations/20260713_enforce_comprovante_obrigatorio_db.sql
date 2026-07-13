-- Achado importante da auditoria: a regra "comprovante obrigatório acima
-- de R$100 pra aprovar reembolso" (CRMViagensGestorView.jsx,
-- COMPROVANTE_OBRIGATORIO_ACIMA_DE) só era validada no client (um alert()
-- antes de chamar decidirReembolso) — uma chamada direta à API com
-- credencial de gestor contornava por completo. Move a mesma regra pro
-- banco via trigger, que é a única barreira que não dá pra pular.
CREATE OR REPLACE FUNCTION public.crm_viagem_despesas_require_comprovante()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status_reembolso = 'aprovado'
     AND NEW.valor > 100
     AND (NEW.comprovante_path IS NULL OR NEW.comprovante_path = '') THEN
    RAISE EXCEPTION 'Despesas acima de R$100 exigem comprovante anexado antes de aprovar reembolso.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_viagem_despesas_require_comprovante() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_viagem_despesas_require_comprovante_trg ON public.crm_viagem_despesas;
CREATE TRIGGER crm_viagem_despesas_require_comprovante_trg
  BEFORE INSERT OR UPDATE ON public.crm_viagem_despesas
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_viagem_despesas_require_comprovante();
