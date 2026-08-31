-- MD-01 da auditoria de segurança (19/08/2026): submit_job_application e
-- submit_talent_pool_application só tinham teto GLOBAL (40 por 10min, conta
-- a tabela inteira) — um atacante disparando 40 envios derruba o formulário
-- pra TODO mundo até a janela passar, de novo, indefinidamente. Mesmo padrão
-- que submit_lead_capture já implementa corretamente: mantém o teto global
-- como circuit-breaker de último recurso (só sobe o número), e adiciona um
-- teto ESTREITO por telefone normalizado (3 por 24h) — a defesa real.
-- Nenhuma outra mudança de comportamento/validação nas duas funções.

CREATE OR REPLACE FUNCTION public.submit_job_application(p_vaga_slug text, p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vaga_id      uuid;
  v_company_ids  text[];
  v_department   text;
  v_frente_origem text[];
  v_candidate_id uuid;
  v_recent_count int;
  v_phone_digits text;
  v_recent_phone_count int;
BEGIN
  IF p_consentimento_lgpd IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Consentimento LGPD obrigatório';
  END IF;
  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;
  IF coalesce(trim(p_email), '') = '' THEN
    RAISE EXCEPTION 'E-mail obrigatório';
  END IF;
  IF coalesce(trim(p_telefone), '') = '' THEN
    RAISE EXCEPTION 'Telefone obrigatório';
  END IF;

  -- Teto estreito por identidade (novo) — mesmo padrão de submit_lead_capture.
  v_phone_digits := regexp_replace(p_telefone, '\D', '', 'g');
  SELECT count(*) INTO v_recent_phone_count
  FROM public.rh_candidatos
  WHERE regexp_replace(phone, '\D', '', 'g') = v_phone_digits
    AND created_at > now() - interval '24 hours';
  IF v_recent_phone_count >= 3 THEN
    RAISE EXCEPTION 'Muitas candidaturas para este contato. Tente novamente mais tarde.';
  END IF;

  -- Circuit-breaker global (existia, só sobe o teto — deixa de ser a única defesa).
  SELECT count(*) INTO v_recent_count
  FROM public.rh_aplicacoes
  WHERE created_at > now() - interval '10 minutes';
  IF v_recent_count >= 200 THEN
    RAISE EXCEPTION 'Muitas candidaturas no momento. Tente novamente em alguns minutos.';
  END IF;

  SELECT id, company_ids, department INTO v_vaga_id, v_company_ids, v_department
  FROM public.rh_vagas
  WHERE link_slug = p_vaga_slug AND stage = 'publicada';

  IF v_vaga_id IS NULL THEN
    RAISE EXCEPTION 'Vaga não encontrada ou encerrada';
  END IF;

  IF coalesce(v_department, '') NOT IN ('Operações', 'Logística', 'Produção', 'Qualidade')
     AND coalesce(trim(p_resume_ext), '') = '' THEN
    RAISE EXCEPTION 'Currículo obrigatório';
  END IF;

  IF btrim(p_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;
  IF p_frente IS NOT NULL AND btrim(p_frente) <> '' AND btrim(p_frente) NOT IN ('sanwey','resibag','montemor') THEN
    RAISE EXCEPTION 'Unidade inválida';
  END IF;

  v_frente_origem := coalesce(v_company_ids, '{}');
  IF p_frente IS NOT NULL AND btrim(p_frente) <> '' AND NOT (btrim(p_frente) = ANY(v_frente_origem)) THEN
    v_frente_origem := v_frente_origem || ARRAY[btrim(p_frente)];
  END IF;

  INSERT INTO public.rh_candidatos (name, email, phone, linkedin_url, resume_ext, source, consentimento_lgpd_at, frente_origem)
  VALUES (trim(p_nome), nullif(trim(p_email), ''), nullif(trim(p_telefone), ''), nullif(trim(p_linkedin), ''), nullif(trim(p_resume_ext), ''), 'vaga_publica', now(), v_frente_origem)
  ON CONFLICT (email)
  DO UPDATE SET
    phone         = coalesce(public.rh_candidatos.phone, excluded.phone),
    linkedin_url  = coalesce(public.rh_candidatos.linkedin_url, excluded.linkedin_url),
    frente_origem = (SELECT array_agg(DISTINCT x) FROM unnest(public.rh_candidatos.frente_origem || excluded.frente_origem) AS x)
  RETURNING id INTO v_candidate_id;

  INSERT INTO public.rh_aplicacoes (candidate_id, vaga_id)
  VALUES (v_candidate_id, v_vaga_id)
  ON CONFLICT (candidate_id, vaga_id) DO UPDATE SET updated_at = now();

  RETURN v_candidate_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_talent_pool_application(p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_candidate_id uuid;
  v_recent_count int;
  v_frente text[];
  v_phone_digits text;
  v_recent_phone_count int;
BEGIN
  IF p_consentimento_lgpd IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Consentimento LGPD obrigatório';
  END IF;
  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;
  IF coalesce(trim(p_resume_ext), '') = '' THEN
    RAISE EXCEPTION 'Currículo obrigatório';
  END IF;
  IF coalesce(trim(p_email), '') = '' THEN
    RAISE EXCEPTION 'E-mail obrigatório';
  END IF;
  IF coalesce(trim(p_telefone), '') = '' THEN
    RAISE EXCEPTION 'Telefone obrigatório';
  END IF;
  IF btrim(p_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;
  IF p_frente IS NOT NULL AND btrim(p_frente) <> '' AND btrim(p_frente) NOT IN ('sanwey','resibag','montemor') THEN
    RAISE EXCEPTION 'Unidade inválida';
  END IF;

  -- Teto estreito por identidade (novo) — mesmo padrão de submit_lead_capture.
  v_phone_digits := regexp_replace(p_telefone, '\D', '', 'g');
  SELECT count(*) INTO v_recent_phone_count
  FROM public.rh_candidatos
  WHERE source = 'banco_talentos'
    AND regexp_replace(phone, '\D', '', 'g') = v_phone_digits
    AND created_at > now() - interval '24 hours';
  IF v_recent_phone_count >= 3 THEN
    RAISE EXCEPTION 'Muitas candidaturas para este contato. Tente novamente mais tarde.';
  END IF;

  -- Circuit-breaker global (existia, só sobe o teto — deixa de ser a única defesa).
  SELECT count(*) INTO v_recent_count
  FROM public.rh_candidatos
  WHERE source = 'banco_talentos' AND created_at > now() - interval '10 minutes';
  IF v_recent_count >= 200 THEN
    RAISE EXCEPTION 'Muitas candidaturas no momento. Tente novamente em alguns minutos.';
  END IF;

  v_frente := CASE WHEN coalesce(btrim(p_frente),'') = '' THEN '{}'::text[] ELSE ARRAY[btrim(p_frente)] END;

  INSERT INTO public.rh_candidatos (name, email, phone, linkedin_url, resume_ext, source, consentimento_lgpd_at, frente_origem)
  VALUES (trim(p_nome), nullif(trim(p_email), ''), nullif(trim(p_telefone), ''), nullif(trim(p_linkedin), ''), p_resume_ext, 'banco_talentos', now(), v_frente)
  ON CONFLICT (email)
  DO UPDATE SET
    phone         = coalesce(public.rh_candidatos.phone, excluded.phone),
    linkedin_url  = coalesce(public.rh_candidatos.linkedin_url, excluded.linkedin_url),
    resume_ext    = coalesce(public.rh_candidatos.resume_ext, excluded.resume_ext),
    frente_origem = (SELECT array_agg(DISTINCT x) FROM unnest(public.rh_candidatos.frente_origem || excluded.frente_origem) AS x)
  RETURNING id INTO v_candidate_id;

  RETURN v_candidate_id;
END;
$function$;
