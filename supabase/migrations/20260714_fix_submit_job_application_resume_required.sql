-- PRD do RH (R3/R4): currículo é obrigatório e a submissão deve ser
-- bloqueada tanto no cliente quanto no servidor. JobApplicationForm.jsx já
-- bloqueia no cliente, mas a RPC nunca validava p_resume_ext — quem
-- chamasse submit_job_application direto (sem passar pelo form) conseguia
-- criar candidato/aplicação sem currículo nenhum.
CREATE OR REPLACE FUNCTION public.submit_job_application(
  p_vaga_slug text, p_nome text, p_email text, p_telefone text,
  p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vaga_id      uuid;
  v_company_ids  text[];
  v_candidate_id uuid;
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

  SELECT id, company_ids INTO v_vaga_id, v_company_ids
  FROM public.rh_vagas
  WHERE link_slug = p_vaga_slug AND stage = 'publicada';

  IF v_vaga_id IS NULL THEN
    RAISE EXCEPTION 'Vaga não encontrada ou encerrada';
  END IF;

  INSERT INTO public.rh_candidatos (name, email, phone, linkedin_url, resume_ext, source, consentimento_lgpd_at, frente_origem)
  VALUES (trim(p_nome), nullif(trim(p_email), ''), nullif(trim(p_telefone), ''), nullif(trim(p_linkedin), ''), p_resume_ext, 'vaga_publica', now(), coalesce(v_company_ids, '{}'))
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
$$;
