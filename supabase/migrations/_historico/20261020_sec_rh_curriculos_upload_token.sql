-- MD-03(b) da auditoria de segurança (19/08/2026): submit_talent_pool_application
-- devolvia o UUID do candidato mesmo quando o e-mail já existia (ON CONFLICT
-- ... RETURNING id) — submeter com o e-mail de outra pessoa devolve o UUID
-- dela, e esse UUID sozinho já bastava pra escrever na pasta dela
-- (rh_curriculos_public_insert só checava "candidato existe"). Suprimir o
-- retorno no reenvio (sugestão literal da auditoria) quebraria o reenvio
-- legítimo de currículo (upload usa upsert, é o fluxo normal de atualizar o
-- currículo). Fix real: token de upload de USO ÚNICO e curta validade,
-- minerado a cada chamada bem-sucedida da RPC (insert OU update) — quem só
-- tem o UUID do candidato (sem ter acabado de completar a RPC) não consegue
-- mais escrever nada.

CREATE TABLE IF NOT EXISTS public.rh_curriculo_upload_tokens (
  token        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id uuid NOT NULL REFERENCES public.rh_candidatos(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  used_at      timestamptz
);
CREATE INDEX IF NOT EXISTS rh_curriculo_upload_tokens_candidato_idx
  ON public.rh_curriculo_upload_tokens (candidato_id);

-- Sem policy nenhuma (RLS habilitada, zero policies = nega tudo pra
-- anon/authenticated) — mesmo padrão de tabela "só acessível via função
-- SECURITY DEFINER" já usado na plataforma (ver achado BX-04). Só a função
-- abaixo (dona da tabela) lê/escreve aqui.
ALTER TABLE public.rh_curriculo_upload_tokens ENABLE ROW LEVEL SECURITY;

-- Onde o RH de fato encontra o arquivo — substitui a reconstrução de path
-- fixo "curriculo.<ext>" que as 3 telas de leitura faziam (o nome do
-- arquivo deixa de ser previsível, ver função de consumo abaixo).
ALTER TABLE public.rh_candidatos ADD COLUMN IF NOT EXISTS resume_object_path text;

-- Valida E consome (marca used_at) um token de upload — chamada dentro da
-- policy de INSERT do bucket, então roda na mesma transação do upload: se o
-- INSERT falhar por qualquer outro motivo depois, o consumo do token
-- reverte junto (fica disponível de novo), não desperdiça o token à toa.
-- p_filename é só o nome do arquivo (sem a pasta) — espera o formato
-- "<token-uuid>-curriculo.<ext>" que a RPC de submissão gera.
CREATE OR REPLACE FUNCTION public.rh_curriculo_token_consume(p_candidato_id uuid, p_filename text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_token uuid;
  v_ok boolean;
BEGIN
  BEGIN
    v_token := substring(p_filename from 1 for 36)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  UPDATE public.rh_curriculo_upload_tokens
  SET used_at = now()
  WHERE token = v_token
    AND candidato_id = p_candidato_id
    AND used_at IS NULL
    AND created_at > now() - interval '15 minutes'
  RETURNING true INTO v_ok;

  RETURN coalesce(v_ok, false);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.rh_curriculo_token_consume FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_token_consume TO anon, authenticated;

-- Substitui a checagem "candidato existe" pela checagem de token — e sobe o
-- teto de objetos por pasta de 3 pra 6 (cada reenvio legítimo agora cria um
-- arquivo NOVO em vez de sobrescrever o mesmo nome fixo, já que o nome
-- passou a incluir o token; teto continua sendo só um cinto-e-suspensório,
-- a defesa real agora é o token).
DROP POLICY IF EXISTS rh_curriculos_public_insert ON storage.objects;
CREATE POLICY rh_curriculos_public_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rh-curriculos'
    AND public.rh_curriculo_token_consume(
          (storage.foldername(name))[1]::uuid,
          split_part(name, '/', 2)
        )
    AND (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'rh-curriculos'
        AND (storage.foldername(o.name))[1] = (storage.foldername(name))[1]
    ) < 6
  );

-- submit_job_application e submit_talent_pool_application: mineram o token
-- (só quando há currículo pra subir), guardam o path esperado em
-- rh_candidatos.resume_object_path, e devolvem os dois pro chamador em vez
-- do UUID cru do candidato. p_resume_ext validado (vira parte do path).
-- Muda o tipo de retorno (uuid → jsonb) — CREATE OR REPLACE não permite
-- isso, precisa DROP explícito antes (e re-GRANT depois, DROP limpa os
-- grants existentes).
DROP FUNCTION IF EXISTS public.submit_job_application(text, text, text, text, text, boolean, text, text);
DROP FUNCTION IF EXISTS public.submit_talent_pool_application(text, text, text, text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.submit_job_application(p_vaga_slug text, p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text DEFAULT NULL::text)
 RETURNS jsonb
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
  v_token uuid;
  v_path text;
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
  IF p_resume_ext IS NOT NULL AND p_resume_ext !~ '^[a-zA-Z0-9]{1,10}$' THEN
    RAISE EXCEPTION 'Extensão de arquivo inválida';
  END IF;

  v_phone_digits := regexp_replace(p_telefone, '\D', '', 'g');
  SELECT count(*) INTO v_recent_phone_count
  FROM public.rh_candidatos
  WHERE regexp_replace(phone, '\D', '', 'g') = v_phone_digits
    AND created_at > now() - interval '24 hours';
  IF v_recent_phone_count >= 3 THEN
    RAISE EXCEPTION 'Muitas candidaturas para este contato. Tente novamente mais tarde.';
  END IF;

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
    resume_ext    = coalesce(excluded.resume_ext, public.rh_candidatos.resume_ext),
    frente_origem = (SELECT array_agg(DISTINCT x) FROM unnest(public.rh_candidatos.frente_origem || excluded.frente_origem) AS x)
  RETURNING id INTO v_candidate_id;

  INSERT INTO public.rh_aplicacoes (candidate_id, vaga_id)
  VALUES (v_candidate_id, v_vaga_id)
  ON CONFLICT (candidate_id, vaga_id) DO UPDATE SET updated_at = now();

  IF p_resume_ext IS NOT NULL AND trim(p_resume_ext) <> '' THEN
    INSERT INTO public.rh_curriculo_upload_tokens (candidato_id) VALUES (v_candidate_id) RETURNING token INTO v_token;
    v_path := v_candidate_id::text || '/' || v_token::text || '-curriculo.' || trim(p_resume_ext);
    UPDATE public.rh_candidatos SET resume_object_path = v_path WHERE id = v_candidate_id;
  END IF;

  RETURN jsonb_build_object('candidate_id', v_candidate_id, 'resume_object_path', v_path);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.submit_job_application FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_application TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_talent_pool_application(p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text DEFAULT NULL::text)
 RETURNS jsonb
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
  v_token uuid;
  v_path text;
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
  IF p_resume_ext !~ '^[a-zA-Z0-9]{1,10}$' THEN
    RAISE EXCEPTION 'Extensão de arquivo inválida';
  END IF;

  v_phone_digits := regexp_replace(p_telefone, '\D', '', 'g');
  SELECT count(*) INTO v_recent_phone_count
  FROM public.rh_candidatos
  WHERE source = 'banco_talentos'
    AND regexp_replace(phone, '\D', '', 'g') = v_phone_digits
    AND created_at > now() - interval '24 hours';
  IF v_recent_phone_count >= 3 THEN
    RAISE EXCEPTION 'Muitas candidaturas para este contato. Tente novamente mais tarde.';
  END IF;

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
    resume_ext    = excluded.resume_ext,
    frente_origem = (SELECT array_agg(DISTINCT x) FROM unnest(public.rh_candidatos.frente_origem || excluded.frente_origem) AS x)
  RETURNING id INTO v_candidate_id;

  INSERT INTO public.rh_curriculo_upload_tokens (candidato_id) VALUES (v_candidate_id) RETURNING token INTO v_token;
  v_path := v_candidate_id::text || '/' || v_token::text || '-curriculo.' || trim(p_resume_ext);
  UPDATE public.rh_candidatos SET resume_object_path = v_path WHERE id = v_candidate_id;

  RETURN jsonb_build_object('candidate_id', v_candidate_id, 'resume_object_path', v_path);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.submit_talent_pool_application FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_talent_pool_application TO anon, authenticated;
