-- Frente 6 (auditoria de QA externo + "excluir etapa" não funciona em
-- Tarefas): dois fixes independentes de dado/RLS, agrupados por serem da
-- mesma rodada.

-- 1. "Excluir esta etapa" (e qualquer escrita em etapa/campo por etapa) não
-- funcionava em Tarefas de Marketing nem em Compras — rh_pipeline_stages_write
-- e rh_pipeline_stage_fields_write (20260785_comex_pipeline_stages_write_scope.sql)
-- escopam por (role, domain), e a cláusula de marketing só liberava
-- 'marketing'/'marketing_deliverables'. 'marketing_tasks' e
-- 'marketing_purchase_requests' nasceram depois e nunca entraram nessa
-- lista — um DELETE/UPDATE filtrado por RLS que não casa nenhuma linha não
-- gera erro, só afeta 0 linhas, então o botão parecia funcionar e não
-- funcionava. Mesmo padrão aditivo de sempre.
DROP POLICY IF EXISTS rh_pipeline_stages_write ON public.rh_pipeline_stages;
CREATE POLICY rh_pipeline_stages_write
  ON public.rh_pipeline_stages
  FOR ALL
  USING (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND domain = 'comercial')
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables', 'marketing_tasks', 'marketing_purchase_requests']))
    OR (current_user_role() = 'comex' AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND domain = 'comercial')
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables', 'marketing_tasks', 'marketing_purchase_requests']))
    OR (current_user_role() = 'comex' AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  );

DROP POLICY IF EXISTS rh_pipeline_stage_fields_write ON public.rh_pipeline_stage_fields;
CREATE POLICY rh_pipeline_stage_fields_write
  ON public.rh_pipeline_stage_fields
  FOR ALL
  USING (
    current_user_is_admin()
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables', 'marketing_tasks', 'marketing_purchase_requests']))
    OR (current_user_role() = 'comex' AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables', 'marketing_tasks', 'marketing_purchase_requests']))
    OR (current_user_role() = 'comex' AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  );

-- 2. Criar candidato manualmente (RHRecrutamentoView → useRHRecrutamento.
-- createCandidato) falhava 100% das vezes com "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification". Causa:
-- use-rh-recrutamento.js faz supabase.from("rh_candidatos").upsert(row,
-- { onConflict: "email" }) — o supabase-js gera um ON CONFLICT (email)
-- SEM predicado, mas o único índice único de email
-- (20260702_rh_captacao_ia.sql) é PARCIAL (WHERE email IS NOT NULL).
-- Postgres não casa um ON CONFLICT sem predicado com um índice parcial.
-- Os RPCs submit_job_application/rh_submit_talent_pool_application
-- funcionam porque repetem o predicado explicitamente no ON CONFLICT —
-- só o caminho client-side quebrava.
--
-- Fix: trocar o índice parcial por um índice único "completo". Não muda
-- nenhum comportamento pra linhas com email NULL — unicidade do Postgres
-- já trata todo NULL como distinto entre si, com ou sem predicado.
DROP INDEX IF EXISTS public.rh_candidatos_email_key;
CREATE UNIQUE INDEX rh_candidatos_email_key ON public.rh_candidatos (email);

-- Os dois RPCs que inserem candidato precisam parar de especificar o
-- predicado no ON CONFLICT (o índice agora não tem mais predicado — um
-- ON CONFLICT com WHERE não casaria com um índice sem WHERE).
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

REVOKE ALL ON FUNCTION public.submit_job_application(text, text, text, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_application(text, text, text, text, text, boolean, text, text) TO anon, authenticated;

-- Mesmo ajuste (tirar o predicado do ON CONFLICT) no RPC irmão do banco de
-- talentos, que insere em rh_candidatos do mesmo jeito.
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
  IF p_email IS NOT NULL AND btrim(p_email) <> '' AND btrim(p_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
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

REVOKE ALL ON FUNCTION public.submit_talent_pool_application(text, text, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_talent_pool_application(text, text, text, text, boolean, text, text) TO anon, authenticated;
