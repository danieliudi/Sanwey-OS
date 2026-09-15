-- Currículo em até 2 arquivos
--
-- Pedido do Daniel em 15/09/2026, na sequência da liberação de foto: quem
-- fotografa o currículo em papel quase sempre tem DUAS páginas. Aceitar um
-- arquivo só significa receber metade do currículo — e o candidato descobre
-- isso tarde demais, ou não descobre.
--
-- ── POR QUE DUAS COLUNAS, E NÃO ARRAY NEM TABELA FILHA ────────────────────
-- O limite é DOIS, definido como decisão de produto, não como "por enquanto".
-- Com limite fixo e baixo:
--   · array (`text[]`) obrigaria a mexer em todo consumidor de
--     `resume_object_path` — tela de RH, triagem por IA, hook — de uma vez, e
--     a coluna existente já é lida em 4 lugares.
--   · tabela filha traria RLS nova, policy nova e join, para guardar no
--     máximo 2 linhas por candidato.
-- Duas colunas mantêm TUDO que existe funcionando sem alteração (o 1º arquivo
-- continua em `resume_object_path`/`resume_ext`) e o 2º é aditivo puro. Se um
-- dia o limite subir, aí sim vale a tabela filha — e a migração parte de um
-- estado consistente em vez de um array meio preenchido.
--
-- A policy de Storage NÃO muda: `rh_curriculos_public_insert` já permite até
-- 6 objetos por pasta (`rh_curriculo_folder_object_count(...) < 6`). O limite
-- de 2 é da aplicação, e a folga do banco é de propósito.

alter table public.rh_candidatos
  add column if not exists resume_extra_path text,
  add column if not exists resume_extra_ext  text;

comment on column public.rh_candidatos.resume_extra_path is
  'Caminho do SEGUNDO arquivo de currículo no bucket rh-curriculos, quando houver. O primeiro continua em resume_object_path — a ordem importa: é a ordem em que o candidato enviou, que para um currículo fotografado é a ordem das páginas.';
comment on column public.rh_candidatos.resume_extra_ext is
  'Extensão do segundo arquivo. Pode ser diferente da do primeiro: é legítimo mandar o PDF e uma foto do verso.';

-- ── RPCs: um token por arquivo, emitidos na MESMA chamada ─────────────────
--
-- Deliberadamente NÃO existe uma RPC separada de "me dá mais um token para o
-- candidato X". Ela receberia o UUID do candidato vindo do cliente, e quem
-- soubesse um UUID qualquer poderia pendurar arquivo na pasta de outra
-- pessoa — exatamente o buraco que o MD-03(b) da auditoria de 20/08/2026
-- fechou ao parar de devolver o UUID cru. Os dois tokens saem juntos, da
-- mesma chamada autenticada pelo próprio formulário.

drop function if exists public.submit_job_application(text, text, text, text, text, boolean, text, text);

create function public.submit_job_application(
  p_vaga_slug text, p_nome text, p_email text, p_telefone text, p_linkedin text,
  p_consentimento_lgpd boolean, p_resume_ext text, p_frente text default null,
  p_resume_ext_2 text default null
) returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
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
  v_token2 uuid;
  v_path2 text;
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
  IF p_resume_ext_2 IS NOT NULL AND p_resume_ext_2 !~ '^[a-zA-Z0-9]{1,10}$' THEN
    RAISE EXCEPTION 'Extensão de arquivo inválida';
  END IF;
  -- Segundo arquivo sem o primeiro não faz sentido e indicaria chamada
  -- montada à mão.
  IF coalesce(trim(p_resume_ext), '') = '' AND coalesce(trim(p_resume_ext_2), '') <> '' THEN
    RAISE EXCEPTION 'Segundo arquivo sem o primeiro';
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

    IF p_resume_ext_2 IS NOT NULL AND trim(p_resume_ext_2) <> '' THEN
      INSERT INTO public.rh_curriculo_upload_tokens (candidato_id) VALUES (v_candidate_id) RETURNING token INTO v_token2;
      v_path2 := v_candidate_id::text || '/' || v_token2::text || '-curriculo-2.' || trim(p_resume_ext_2);
      UPDATE public.rh_candidatos
      SET resume_extra_path = v_path2, resume_extra_ext = trim(p_resume_ext_2)
      WHERE id = v_candidate_id;
    ELSE
      -- Reenvio com um arquivo só limpa o segundo do envio anterior, senão o
      -- RH abriria a página 2 de um currículo que não existe mais.
      UPDATE public.rh_candidatos SET resume_extra_path = NULL, resume_extra_ext = NULL WHERE id = v_candidate_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'candidate_id', v_candidate_id,
    'resume_object_path', v_path,
    'resume_object_path_2', v_path2
  );
END;
$function$;

drop function if exists public.submit_talent_pool_application(text, text, text, text, boolean, text, text);

create function public.submit_talent_pool_application(
  p_nome text, p_email text, p_telefone text, p_linkedin text,
  p_consentimento_lgpd boolean, p_resume_ext text, p_frente text default null,
  p_resume_ext_2 text default null
) returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
DECLARE
  v_candidate_id uuid;
  v_recent_count int;
  v_frente text[];
  v_phone_digits text;
  v_recent_phone_count int;
  v_token uuid;
  v_path text;
  v_token2 uuid;
  v_path2 text;
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
  IF p_resume_ext_2 IS NOT NULL AND p_resume_ext_2 !~ '^[a-zA-Z0-9]{1,10}$' THEN
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

  IF p_resume_ext_2 IS NOT NULL AND trim(p_resume_ext_2) <> '' THEN
    INSERT INTO public.rh_curriculo_upload_tokens (candidato_id) VALUES (v_candidate_id) RETURNING token INTO v_token2;
    v_path2 := v_candidate_id::text || '/' || v_token2::text || '-curriculo-2.' || trim(p_resume_ext_2);
    UPDATE public.rh_candidatos
    SET resume_extra_path = v_path2, resume_extra_ext = trim(p_resume_ext_2)
    WHERE id = v_candidate_id;
  ELSE
    UPDATE public.rh_candidatos SET resume_extra_path = NULL, resume_extra_ext = NULL WHERE id = v_candidate_id;
  END IF;

  RETURN jsonb_build_object(
    'candidate_id', v_candidate_id,
    'resume_object_path', v_path,
    'resume_object_path_2', v_path2
  );
END;
$function$;

-- As duas continuam chamáveis por visitante anônimo — é formulário público.
-- O grant default do Supabase já cobre, mas nomear aqui deixa explícito e
-- sobrevive a um `revoke ... from public` futuro (regra 3.1 do CLAUDE.md).
grant execute on function public.submit_job_application(text, text, text, text, text, boolean, text, text, text) to anon, authenticated;
grant execute on function public.submit_talent_pool_application(text, text, text, text, boolean, text, text, text) to anon, authenticated;
