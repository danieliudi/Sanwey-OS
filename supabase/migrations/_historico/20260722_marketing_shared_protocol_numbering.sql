-- Numeração de protocolo compartilhada (formato P00001) entre solicitações
-- de Marketing (marketing_requests, formulário externo) e cards criados
-- MANUALMENTE em Entregas (marketing_deliverables) — pedido do usuário.
-- Requisitos: uma única sequência contínua, reaproveitamento do número de
-- registros excluídos (gap-fill), edição manual, e retomada a partir de
-- P00094 (números anteriores já foram usados fora do sistema).
--
-- marketing_purchase_requests (Compras) fica de fora — usa prefixo "C" e
-- sequência própria, não fazia parte do pedido original.
--
-- Uma sequence do Postgres nunca reaproveita números excluídos, então não
-- serve aqui. Em vez disso, um "razão" (ledger) registra explicitamente
-- cada número em uso; alocar o próximo número é "achar o menor inteiro
-- livre >= 94", sob um advisory lock pra ficar seguro sob concorrência
-- (marketing_requests aceita INSERT anônimo do formulário público).

CREATE TABLE IF NOT EXISTS public.marketing_protocol_numbers (
  number     integer PRIMARY KEY,
  source     text NOT NULL CHECK (source IN ('marketing_request', 'deliverable')),
  record_id  uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, record_id)
);

ALTER TABLE public.marketing_protocol_numbers ENABLE ROW LEVEL SECURITY;
-- Sem policies: só as funções SECURITY DEFINER abaixo tocam essa tabela.

CREATE OR REPLACE FUNCTION public.allocate_marketing_protocol_number(p_source text, p_record_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_number integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('marketing_protocol_numbers'));

  SELECT gs.n INTO v_number
  FROM generate_series(94, (SELECT COALESCE(MAX(number), 93) + 1 FROM public.marketing_protocol_numbers)) AS gs(n)
  LEFT JOIN public.marketing_protocol_numbers mpn ON mpn.number = gs.n
  WHERE mpn.number IS NULL
  ORDER BY gs.n
  LIMIT 1;

  INSERT INTO public.marketing_protocol_numbers (number, source, record_id)
  VALUES (v_number, p_source, p_record_id);

  RETURN v_number;
END;
$function$;

-- ── marketing_requests ───────────────────────────────────────────────────

ALTER TABLE public.marketing_requests
  ALTER COLUMN request_number DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.marketing_requests_assign_protocol_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'P' || lpad(public.allocate_marketing_protocol_number('marketing_request', NEW.id)::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_marketing_requests_protocol_number ON public.marketing_requests;
CREATE TRIGGER trg_marketing_requests_protocol_number
  BEFORE INSERT ON public.marketing_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_requests_assign_protocol_number();

-- Edição manual: sincroniza o razão quando o próprio request_number é
-- alterado via UPDATE, normalizando o formato e rejeitando duplicidade
-- (a PK de marketing_protocol_numbers barra o número já em uso).
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
    IF v_num IS NULL THEN
      RAISE EXCEPTION 'Número de protocolo inválido: %', NEW.request_number;
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

DROP TRIGGER IF EXISTS trg_marketing_requests_protocol_sync ON public.marketing_requests;
CREATE TRIGGER trg_marketing_requests_protocol_sync
  BEFORE UPDATE ON public.marketing_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_requests_sync_protocol_number();

CREATE OR REPLACE FUNCTION public.marketing_requests_release_protocol_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.marketing_protocol_numbers
  WHERE source = 'marketing_request' AND record_id = OLD.id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_marketing_requests_protocol_release ON public.marketing_requests;
CREATE TRIGGER trg_marketing_requests_protocol_release
  AFTER DELETE ON public.marketing_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_requests_release_protocol_number();

-- ── marketing_deliverables ───────────────────────────────────────────────
-- Só aloca quando request_number vem NULL (card criado manualmente em
-- Entregas). Quando a entrega nasce de approve_marketing_request(), o
-- número já vem copiado da solicitação de origem — o trigger não mexe.

CREATE OR REPLACE FUNCTION public.marketing_deliverables_assign_protocol_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'P' || lpad(public.allocate_marketing_protocol_number('deliverable', NEW.id)::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_marketing_deliverables_protocol_number ON public.marketing_deliverables;
CREATE TRIGGER trg_marketing_deliverables_protocol_number
  BEFORE INSERT ON public.marketing_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.marketing_deliverables_assign_protocol_number();

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
    IF v_num IS NULL THEN
      RAISE EXCEPTION 'Número de protocolo inválido: %', NEW.request_number;
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

DROP TRIGGER IF EXISTS trg_marketing_deliverables_protocol_sync ON public.marketing_deliverables;
CREATE TRIGGER trg_marketing_deliverables_protocol_sync
  BEFORE UPDATE ON public.marketing_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.marketing_deliverables_sync_protocol_number();

CREATE OR REPLACE FUNCTION public.marketing_deliverables_release_protocol_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.marketing_protocol_numbers
  WHERE source = 'deliverable' AND record_id = OLD.id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_marketing_deliverables_protocol_release ON public.marketing_deliverables;
CREATE TRIGGER trg_marketing_deliverables_protocol_release
  AFTER DELETE ON public.marketing_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.marketing_deliverables_release_protocol_number();

-- ── Furo achado de passagem: marketing_requests_write checava profiles.role
-- (escalar) em vez do array roles — gerente_marketing como cargo SECUNDÁRIO
-- não conseguia editar/excluir solicitações (inclusive o número de
-- protocolo que esta migration acabou de tornar editável). Mesma classe de
-- bug já corrigida noutras tabelas via current_user_is_marketing().
DROP POLICY IF EXISTS "marketing_requests_write" ON public.marketing_requests;
CREATE POLICY "marketing_requests_write" ON public.marketing_requests
  FOR ALL
  USING (current_user_is_marketing())
  WITH CHECK (current_user_is_marketing());
