-- Achado LOW da 2ª auditoria: a validação de e-mail (regex) adicionada em
-- 20260713_fix_public_rpcs_email_format.sql ficava morta sempre que uma
-- migration posterior redefinisse (CREATE OR REPLACE) a mesma função sem
-- reincorporar o check.
--
-- submit_lead_capture: o banco AO VIVO já tem o check (aplicado em algum
-- ponto fora do arquivo de migration correspondente) — mas o ARQUIVO
-- 20260713_fix_submit_lead_capture_abuse.sql, que é o que "vence" na ordem
-- de replay, não tem o regex. Sem esta migration, um `supabase db reset`
-- (replay do zero) reproduziria a versão SEM validação, divergindo do banco
-- de produção. Esta migration reafirma a versão com o check, sincronizando
-- repo e banco (idempotente — não muda o comportamento ao vivo).
--
-- submit_job_application: aqui o gap é real — nenhuma versão (nem a do
-- arquivo, nem a ao vivo) valida formato de e-mail. Adiciona o check.
CREATE OR REPLACE FUNCTION public.submit_lead_capture(
  p_company_id text, p_customer_name text, p_contact_phone text,
  p_contact_email text DEFAULT NULL::text, p_product_interest text DEFAULT NULL::text,
  p_priority text DEFAULT NULL::text, p_prospect_date date DEFAULT NULL::date,
  p_notes text DEFAULT NULL::text, p_source text DEFAULT 'site'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_capture_id uuid;
  v_lead_id text;
  v_custom jsonb;
  v_phone_digits text;
  v_recent_phone_count int;
  v_recent_company_count int;
BEGIN
  IF p_company_id IS NULL OR p_company_id NOT IN ('industria','resibag') THEN
    RAISE EXCEPTION 'Empresa inválida';
  END IF;
  IF p_customer_name IS NULL OR length(btrim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório';
  END IF;
  IF p_contact_phone IS NULL OR length(btrim(p_contact_phone)) < 8 THEN
    RAISE EXCEPTION 'Contato é obrigatório';
  END IF;
  IF p_prospect_date IS NULL THEN
    RAISE EXCEPTION 'Data de prospecção é obrigatória';
  END IF;
  IF p_priority IS NOT NULL AND p_priority NOT IN ('Alta','Média','Baixa') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;
  IF p_contact_email IS NOT NULL AND btrim(p_contact_email) <> '' AND btrim(p_contact_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;

  v_phone_digits := regexp_replace(p_contact_phone, '\D', '', 'g');
  SELECT count(*) INTO v_recent_phone_count
  FROM lead_captures
  WHERE regexp_replace(contact_phone, '\D', '', 'g') = v_phone_digits
    AND created_at > now() - interval '24 hours';
  IF v_recent_phone_count >= 3 THEN
    RAISE EXCEPTION 'Muitas solicitações para este contato. Tente novamente mais tarde.';
  END IF;

  SELECT count(*) INTO v_recent_company_count
  FROM lead_captures
  WHERE company_id = p_company_id
    AND created_at > now() - interval '10 minutes';
  IF v_recent_company_count >= 30 THEN
    RAISE EXCEPTION 'Muitas solicitações no momento. Tente novamente em alguns minutos.';
  END IF;

  v_custom := jsonb_build_object(
    'capture_customer_name', btrim(p_customer_name),
    'capture_contact_phone', btrim(p_contact_phone),
    'capture_contact_email', NULLIF(btrim(coalesce(p_contact_email,'')), ''),
    'capture_product_interest', NULLIF(btrim(coalesce(p_product_interest,'')), ''),
    'capture_priority', p_priority,
    'capture_prospect_date', to_char(p_prospect_date, 'YYYY-MM-DD'),
    'capture_notes', NULLIF(btrim(coalesce(p_notes,'')), ''),
    'capture_source', p_source
  );

  v_lead_id := 'cap_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO leads (
    id, company_id, company, cnpj, sector, city, state, contact_email, phone,
    stage, status, urgency, probability, value, fit_score, starred,
    notes, custom_fields, decision_maker,
    trigger, trigger_label, evidence,
    created_at, last_activity, stage_changed_at, date_detected, days_ago, is_demo
  ) VALUES (
    v_lead_id,
    p_company_id,
    btrim(p_customer_name),
    NULL, NULL, NULL, NULL,
    NULLIF(btrim(coalesce(p_contact_email,'')), ''),
    NULLIF(btrim(coalesce(p_contact_phone,'')), ''),
    'prospeccao', 'prospeccao',
    CASE p_priority WHEN 'Alta' THEN 'critico' WHEN 'Média' THEN 'atencao' ELSE 'indefinido' END,
    10, 0, 0, false,
    '[]'::jsonb, v_custom, '{"name":"—","role":"—"}'::jsonb,
    'formulario_publico',
    'Captura pública · ' || coalesce(p_source,'site'),
    coalesce(p_notes, p_product_interest, btrim(p_customer_name) || ' enviou formulário'),
    now(), now(), now(), now(), 0, false
  );

  INSERT INTO lead_captures (
    company_id, customer_name, contact_phone, contact_email,
    product_interest, priority, prospect_date, notes, source, lead_id
  ) VALUES (
    p_company_id, btrim(p_customer_name), btrim(p_contact_phone),
    NULLIF(btrim(coalesce(p_contact_email,'')), ''),
    NULLIF(btrim(coalesce(p_product_interest,'')), ''),
    p_priority, p_prospect_date,
    NULLIF(btrim(coalesce(p_notes,'')), ''),
    p_source, v_lead_id
  ) RETURNING id INTO v_capture_id;

  RETURN jsonb_build_object('ok', true, 'capture_id', v_capture_id, 'lead_id', v_lead_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_job_application(
  p_vaga_slug text, p_nome text, p_email text, p_telefone text,
  p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  -- Achado da 2ª auditoria: nenhuma versão desta função validava formato de
  -- e-mail (só o front-end público bloqueava) — a RPC aceitava qualquer
  -- string. E-mail aqui é opcional (nullif), então só valida se preenchido.
  IF p_email IS NOT NULL AND btrim(p_email) <> '' AND btrim(p_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido';
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
$function$;
