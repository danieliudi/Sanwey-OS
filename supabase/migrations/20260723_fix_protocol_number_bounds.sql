-- Achado crítico da auditoria de plataforma: allocate_marketing_protocol_number
-- acha o menor gap livre com generate_series(94, MAX(number)+1) sem NENHUM
-- teto — como o número pode ser editado manualmente (EditableProtocolNumber)
-- sem limite de tamanho, um erro de digitação (ex: "2000000000" em vez de
-- "200") grava esse valor no razão, e a PRÓXIMA solicitação nova (inclusive
-- pelo formulário público) trava escaneando bilhões de linhas sob o
-- advisory lock global — derruba a numeração de protocolo pra todo mundo.
--
-- Trava o valor num teto razoável (formato P00001..P99999 cobre até 99999;
-- deixamos folga até 999999) tanto na tabela (CHECK, bloqueia até escrita
-- direta) quanto nos triggers de sincronia manual (mensagem de erro clara
-- em vez de um erro de constraint genérico).

ALTER TABLE public.marketing_protocol_numbers
  ADD CONSTRAINT marketing_protocol_numbers_number_range
  CHECK (number > 0 AND number < 1000000);

CREATE OR REPLACE FUNCTION public.marketing_requests_sync_protocol_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_num integer;
BEGIN
  IF NEW.request_number IS DISTINCT FROM OLD.request_number THEN
    v_num := NULLIF(regexp_replace(coalesce(NEW.request_number, ''), '\D', '', 'g'), '')::integer;
    IF v_num IS NULL OR v_num <= 0 OR v_num >= 1000000 THEN
      RAISE EXCEPTION 'Número de protocolo inválido (use um valor entre 1 e 999999): %', NEW.request_number;
    END IF;
    UPDATE public.marketing_protocol_numbers
    SET number = v_num
    WHERE source = 'marketing_request' AND record_id = NEW.id;
    IF NOT FOUND THEN
      INSERT INTO public.marketing_protocol_numbers (number, source, record_id)
      VALUES (v_num, 'marketing_request', NEW.id);
    END IF;
    NEW.request_number := 'P' || lpad(v_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.marketing_deliverables_sync_protocol_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_num integer;
BEGIN
  IF NEW.request_number IS DISTINCT FROM OLD.request_number THEN
    v_num := NULLIF(regexp_replace(coalesce(NEW.request_number, ''), '\D', '', 'g'), '')::integer;
    IF v_num IS NULL OR v_num <= 0 OR v_num >= 1000000 THEN
      RAISE EXCEPTION 'Número de protocolo inválido (use um valor entre 1 e 999999): %', NEW.request_number;
    END IF;
    UPDATE public.marketing_protocol_numbers
    SET number = v_num
    WHERE source = 'deliverable' AND record_id = NEW.id;
    IF NOT FOUND THEN
      INSERT INTO public.marketing_protocol_numbers (number, source, record_id)
      VALUES (v_num, 'deliverable', NEW.id);
    END IF;
    NEW.request_number := 'P' || lpad(v_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;
