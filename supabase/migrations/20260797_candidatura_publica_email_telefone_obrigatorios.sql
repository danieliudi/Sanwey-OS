-- E-mail e telefone passam a ser obrigatórios (os dois, não "pelo menos
-- um") na candidatura pública — pedido explícito do Daniel em 29/07/2026,
-- revertendo a folga deliberada da auditoria de fricção de 18/07.
--
-- O client (TalentPoolForm.jsx / JobApplicationForm.jsx) já passou a exigir
-- os dois; sem repetir a exigência aqui, um envio direto ao RPC (sem passar
-- pelo formulário) continuaria aceitando candidatura sem contato nenhum —
-- mesma classe de furo que os RPCs já fecham hoje pra nome/currículo/LGPD.

CREATE OR REPLACE FUNCTION public.submit_talent_pool_application(
  p_nome text, p_email text, p_telefone text, p_linkedin text,
  p_consentimento_lgpd boolean, p_resume_ext text, p_frente text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_candidate_id uuid;
  v_recent_count int;
  v_frente text[];
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

  -- Anti-flood global (o banco de talentos não tem vaga como porteiro).
  SELECT count(*) INTO v_recent_count
  FROM public.rh_candidatos
  WHERE source = 'banco_talentos' AND created_at > now() - interval '10 minutes';
  IF v_recent_count >= 40 THEN
    RAISE EXCEPTION 'Muitas candidaturas no momento. Tente novamente em alguns minutos.';
  END IF;

  v_frente := CASE WHEN coalesce(btrim(p_frente),'') = '' THEN '{}'::text[] ELSE ARRAY[btrim(p_frente)] END;

  INSERT INTO public.rh_candidatos (name, email, phone, linkedin_url, resume_ext, source, consentimento_lgpd_at, frente_origem)
  VALUES (trim(p_nome), nullif(trim(p_email), ''), nullif(trim(p_telefone), ''), nullif(trim(p_linkedin), ''), p_resume_ext, 'banco_talentos', now(), v_frente)
  ON CONFLICT (email)
  DO UPDATE SET
    phone         = coalesce(public.rh_candidatos.phone, excluded.phone),
    linkedin_url  = coalesce(public.rh_candidatos.linkedin_url, excluded.linkedin_url),
    resume_ext    = coalesce(excluded.resume_ext, public.rh_candidatos.resume_ext),
    frente_origem = (SELECT array_agg(DISTINCT x) FROM unnest(public.rh_candidatos.frente_origem || excluded.frente_origem) AS x)
  RETURNING id INTO v_candidate_id;

  RETURN v_candidate_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_job_application(
  p_vaga_slug text, p_nome text, p_email text, p_telefone text,
  p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text,
  p_frente text DEFAULT NULL
)
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
