-- MD-02 da auditoria de segurança (19/08/2026): MarketingRequestForm.jsx
-- gravava direto em marketing_requests com a chave anon (INSERT cru, RLS só
-- validava CONTEÚDO das colunas, sem limite de VOLUME) — qualquer pessoa na
-- internet insere linhas ilimitadas, lota o board de Solicitações e some
-- protocolo. Mesmo molde de submit_lead_capture: RPC SECURITY DEFINER com
-- validação de campo obrigatório + teto por identidade (e-mail, quando
-- informado — campo é opcional neste formulário) + circuit-breaker global.
-- INSERT público direto é revogado depois (policy trocada por uma vazia).

CREATE OR REPLACE FUNCTION public.submit_marketing_request(
  p_category        text,
  p_title           text,
  p_requester_name  text,
  p_requester_email text DEFAULT NULL,
  p_department      text DEFAULT NULL,
  p_request_type    text DEFAULT NULL,
  p_description     text DEFAULT NULL,
  p_priority        text DEFAULT 'media',
  p_deadline        date DEFAULT NULL,
  p_company_ids     text[] DEFAULT NULL,
  p_budget          numeric DEFAULT NULL,
  p_approver_name   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_company_ids text[];
  v_recent_email_count int;
  v_recent_total_count int;
BEGIN
  IF p_category NOT IN ('material', 'compra') THEN
    RAISE EXCEPTION 'Categoria inválida';
  END IF;
  IF coalesce(trim(p_requester_name), '') = '' OR length(trim(p_requester_name)) < 2 THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;
  IF p_category = 'compra' THEN
    IF coalesce(trim(p_title), '') = '' OR length(trim(p_title)) < 2 THEN
      RAISE EXCEPTION 'Descreva o que você precisa comprar';
    END IF;
  ELSE
    IF coalesce(trim(p_department), '') = '' THEN
      RAISE EXCEPTION 'Departamento é obrigatório';
    END IF;
    IF coalesce(trim(p_request_type), '') = '' THEN
      RAISE EXCEPTION 'Tipo de material é obrigatório';
    END IF;
    IF coalesce(trim(p_title), '') = '' OR length(trim(p_title)) < 3 THEN
      RAISE EXCEPTION 'Título da solicitação é obrigatório';
    END IF;
  END IF;
  IF p_requester_email IS NOT NULL AND btrim(p_requester_email) <> ''
     AND btrim(p_requester_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;
  IF p_priority NOT IN ('alta', 'media', 'baixa') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  v_company_ids := coalesce(p_company_ids, '{}');
  IF array_length(v_company_ids, 1) IS NULL THEN
    v_company_ids := ARRAY['industria', 'resibag', 'montemor'];
  END IF;
  IF NOT (v_company_ids <@ ARRAY['industria', 'resibag', 'montemor']) THEN
    RAISE EXCEPTION 'Empresa inválida';
  END IF;

  -- Teto estreito por identidade (só quando e-mail foi informado — campo é
  -- opcional neste form, diferente dos formulários de RH).
  IF p_requester_email IS NOT NULL AND btrim(p_requester_email) <> '' THEN
    SELECT count(*) INTO v_recent_email_count
    FROM public.marketing_requests
    WHERE lower(requester_email) = lower(btrim(p_requester_email))
      AND created_at > now() - interval '24 hours';
    IF v_recent_email_count >= 5 THEN
      RAISE EXCEPTION 'Muitas solicitações deste e-mail. Tente novamente mais tarde.';
    END IF;
  END IF;

  -- Circuit-breaker global — não existia nenhum teto de volume antes.
  SELECT count(*) INTO v_recent_total_count
  FROM public.marketing_requests
  WHERE created_at > now() - interval '10 minutes';
  IF v_recent_total_count >= 100 THEN
    RAISE EXCEPTION 'Muitas solicitações no momento. Tente novamente em alguns minutos.';
  END IF;

  INSERT INTO public.marketing_requests (
    category, title, requester_name, requester_email, department, request_type,
    description, priority, deadline, company_ids, budget, approver_name, status
  ) VALUES (
    p_category, trim(p_title), trim(p_requester_name),
    NULLIF(btrim(coalesce(p_requester_email, '')), ''),
    CASE WHEN p_category = 'material' THEN p_department ELSE NULL END,
    CASE WHEN p_category = 'material' THEN p_request_type ELSE NULL END,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    CASE WHEN p_category = 'material' THEN p_priority ELSE 'media' END,
    p_deadline, v_company_ids,
    CASE WHEN p_category = 'material' THEN p_budget ELSE NULL END,
    CASE WHEN p_category = 'material' THEN NULLIF(trim(coalesce(p_approver_name, '')), '') ELSE NULL END,
    'pendente'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.submit_marketing_request FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_marketing_request TO anon, authenticated;

-- Fecha o INSERT público direto — só a RPC (SECURITY DEFINER) escreve agora.
DROP POLICY IF EXISTS marketing_requests_public_insert ON public.marketing_requests;
