-- Rastreio Fase 3 — origem UTM na captura pública → leads.campaign_id
--
-- NÃO APLICAR sem confirmação explícita do Daniel (CLAUDE.md regra 5).
-- Draft no repo: o formulário já lê UTM e faz fallback em notes até isto
-- estar no banco.
--
-- O que muda:
--   - params opcionais p_utm_source/medium/campaign/content
--   - resolve campaign_id pelo nome (utm_campaign = marketing_campaigns.name),
--     canais Conteúdo/Digital, empresa do slug
--   - grava UTM em custom_fields (capture_utm_*)
--   - sem match de campanha: campaign_id fica null (nunca inventa — PRD §10)
--
-- Assinatura nova: DROP da antiga + CREATE (Postgres não troca arg list com
-- CREATE OR REPLACE). Grants refeitos pra anon/authenticated.

DROP FUNCTION IF EXISTS public.submit_lead_capture(
  text, text, text, text, text, text, date, text, text
);

CREATE OR REPLACE FUNCTION public.submit_lead_capture(
  p_company_id text,
  p_customer_name text,
  p_contact_phone text,
  p_contact_email text DEFAULT NULL::text,
  p_product_interest text DEFAULT NULL::text,
  p_priority text DEFAULT NULL::text,
  p_prospect_date date DEFAULT NULL::date,
  p_notes text DEFAULT NULL::text,
  p_source text DEFAULT 'site'::text,
  p_utm_source text DEFAULT NULL::text,
  p_utm_medium text DEFAULT NULL::text,
  p_utm_campaign text DEFAULT NULL::text,
  p_utm_content text DEFAULT NULL::text
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
  v_campaign_id uuid;
  v_utm_source text;
  v_utm_medium text;
  v_utm_campaign text;
  v_utm_content text;
  v_source text;
  v_trigger_label text;
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
  IF p_contact_email IS NOT NULL AND btrim(p_contact_email) <> ''
     AND btrim(p_contact_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
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

  v_utm_source   := NULLIF(lower(btrim(coalesce(p_utm_source, ''))), '');
  v_utm_medium   := NULLIF(lower(btrim(coalesce(p_utm_medium, ''))), '');
  v_utm_campaign := NULLIF(lower(btrim(coalesce(p_utm_campaign, ''))), '');
  v_utm_content  := NULLIF(lower(btrim(coalesce(p_utm_content, ''))), '');

  -- Fonte efetiva: UTM > p_source legado (?src=) > site
  v_source := coalesce(v_utm_source, NULLIF(lower(btrim(coalesce(p_source, ''))), ''), 'site');

  v_campaign_id := NULL;
  IF v_utm_campaign IS NOT NULL THEN
    SELECT mc.id INTO v_campaign_id
    FROM public.marketing_campaigns mc
    WHERE lower(btrim(mc.name)) = v_utm_campaign
      AND mc.channel IN ('Conteúdo', 'Digital')
      AND p_company_id = ANY (mc.company_ids)
    ORDER BY mc.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_custom := jsonb_build_object(
    'capture_customer_name', btrim(p_customer_name),
    'capture_contact_phone', btrim(p_contact_phone),
    'capture_contact_email', NULLIF(btrim(coalesce(p_contact_email,'')), ''),
    'capture_product_interest', NULLIF(btrim(coalesce(p_product_interest,'')), ''),
    'capture_priority', p_priority,
    'capture_prospect_date', to_char(p_prospect_date, 'YYYY-MM-DD'),
    'capture_notes', NULLIF(btrim(coalesce(p_notes,'')), ''),
    'capture_source', v_source
  );
  IF v_utm_source IS NOT NULL THEN
    v_custom := v_custom || jsonb_build_object('capture_utm_source', v_utm_source);
  END IF;
  IF v_utm_medium IS NOT NULL THEN
    v_custom := v_custom || jsonb_build_object('capture_utm_medium', v_utm_medium);
  END IF;
  IF v_utm_campaign IS NOT NULL THEN
    v_custom := v_custom || jsonb_build_object('capture_utm_campaign', v_utm_campaign);
  END IF;
  IF v_utm_content IS NOT NULL THEN
    v_custom := v_custom || jsonb_build_object(
      'capture_utm_content', v_utm_content,
      'capture_content_id', v_utm_content
    );
  END IF;

  IF v_utm_campaign IS NOT NULL AND v_utm_content IS NOT NULL THEN
    v_trigger_label := 'Captura pública · ' || v_source || ' · ' || v_utm_campaign || ' · ' || v_utm_content;
  ELSIF v_utm_campaign IS NOT NULL THEN
    v_trigger_label := 'Captura pública · ' || v_source || ' · ' || v_utm_campaign;
  ELSE
    v_trigger_label := 'Captura pública · ' || v_source;
  END IF;

  v_lead_id := 'cap_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO leads (
    id, company_id, company, cnpj, sector, city, state, contact_email, phone,
    stage, status, urgency, probability, value, fit_score, starred,
    notes, custom_fields, decision_maker,
    trigger, trigger_label, evidence,
    created_at, last_activity, stage_changed_at, date_detected, days_ago, is_demo,
    campaign_id
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
    v_trigger_label,
    coalesce(p_notes, p_product_interest, btrim(p_customer_name) || ' enviou formulário'),
    now(), now(), now(), now(), 0, false,
    v_campaign_id
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
    v_source, v_lead_id
  ) RETURNING id INTO v_capture_id;

  RETURN jsonb_build_object(
    'ok', true,
    'capture_id', v_capture_id,
    'lead_id', v_lead_id,
    'campaign_id', v_campaign_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_lead_capture(
  text, text, text, text, text, text, date, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_lead_capture(
  text, text, text, text, text, text, date, text, text, text, text, text, text
) TO postgres, anon, authenticated, service_role;

COMMENT ON FUNCTION public.submit_lead_capture(
  text, text, text, text, text, text, date, text, text, text, text, text, text
) IS
  'Captura pública anon. Fase 3: UTM opcional resolve campaign_id por nome (Conteúdo/Digital). Sem match → null.';
