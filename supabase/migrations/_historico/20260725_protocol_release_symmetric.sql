-- Achado HIGH da 2ª auditoria (Fable 5): o caminho espelhado do fix anterior
-- (20260724_fix_protocol_number_transfer_on_approve) ficou descoberto. Ao
-- aprovar uma solicitação, a posse do razão passa de (marketing_request) pra
-- (deliverable), mas a solicitação continua exibindo o mesmo P0000X. Se a
-- ENTREGA for excluída, o release trigger apagava incondicionalmente a linha
-- do razão — liberando um número que a solicitação aprovada ainda mostra.
-- A próxima alocação reusava esse número → duplicidade de P0000X.
--
-- Fix simétrico: ao excluir a entrega, se ainda existir uma solicitação
-- exibindo o mesmo número, devolve a posse do razão pra ela em vez de apagar.
-- O número só é liberado de fato quando NENHUM registro (solicitação nem
-- entrega) mais o exibe.
CREATE OR REPLACE FUNCTION public.marketing_deliverables_release_protocol_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req_id uuid;
BEGIN
  IF OLD.request_number IS NOT NULL THEN
    SELECT id INTO v_req_id
    FROM public.marketing_requests
    WHERE request_number = OLD.request_number
    LIMIT 1;
  END IF;

  IF v_req_id IS NOT NULL THEN
    -- Solicitação de origem sobrevive exibindo o número: devolve a posse.
    UPDATE public.marketing_protocol_numbers
    SET source = 'marketing_request', record_id = v_req_id
    WHERE source = 'deliverable' AND record_id = OLD.id;
  ELSE
    -- Ninguém mais exibe o número: libera pra reaproveitamento.
    DELETE FROM public.marketing_protocol_numbers
    WHERE source = 'deliverable' AND record_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$function$;
