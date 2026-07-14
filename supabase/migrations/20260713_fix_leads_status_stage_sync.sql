-- Menor da auditoria: leads.status é um espelho de leads.stage (todo path
-- de escrita do app grava os dois iguais — changeStage, leadToRow, criação),
-- mas sem enforcement no banco 1 lead ficou com os dois divergentes (sem
-- trigger/CHECK que sincronize). Nenhum relatório/dashboard consome status
-- (todos agrupam por stage), mas trava a divergência na fonte em vez de
-- remover a coluna (mudança maior, fora de escopo aqui).
UPDATE public.leads SET status = stage WHERE status <> stage;

CREATE OR REPLACE FUNCTION public.leads_sync_status_to_stage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.status := NEW.stage;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leads_sync_status_to_stage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS leads_sync_status_to_stage_trg ON public.leads;
CREATE TRIGGER leads_sync_status_to_stage_trg
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_sync_status_to_stage();
