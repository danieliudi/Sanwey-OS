-- Achado RC4 da auditoria de fricção de 18/07: TalentPoolForm (banco de
-- talentos, /trabalhe-conosco) tem um campo "Unidade de interesse" que
-- JobApplicationForm (candidatura numa vaga específica, /vagas/:slug) não
-- tem — mesma jornada de se candidatar ao Grupo Sanwey, formulários
-- divergentes. Adiciona p_frente opcional em submit_job_application,
-- somando à frente_origem já herdada das empresas da vaga (não substitui —
-- o candidato pode se candidatar a uma vaga da Sanwey e ainda assim marcar
-- interesse em outra unidade pra oportunidades futuras).
-- Adicionar um parâmetro novo (mesmo com DEFAULT) muda a assinatura da
-- função pro Postgres — sem o DROP, CREATE OR REPLACE criaria um segundo
-- overload em vez de substituir, e chamadas via RPC com nomeação de
-- parâmetros (como o cliente Supabase faz) ficariam ambíguas entre as
-- duas versões.
DROP FUNCTION IF EXISTS public.submit_job_application(text, text, text, text, text, boolean, text);

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

  IF p_email IS NOT NULL AND btrim(p_email) <> '' AND btrim(p_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
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
  ON CONFLICT (email) WHERE email IS NOT NULL
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

REVOKE ALL ON FUNCTION public.submit_job_application(text, text, text, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_application(text, text, text, text, text, boolean, text, text) TO anon, authenticated;
