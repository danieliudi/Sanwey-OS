-- Importante da auditoria: submit_lead_capture (SECURITY DEFINER, anon)
-- não tinha nenhum anti-abuso — um script conseguia criar milhares de leads
-- reais no funil comercial visível em minutos (leads_select trata owner
-- IS NULL como visível a todos os vendedores da empresa). Sem infra de
-- CAPTCHA/edge function nesta RPC, o throttle possível em SQL puro é por
-- telefone (mesmo contato não spamma) e um teto por empresa numa janela
-- curta (contém flood de dados aleatórios). Não impede um atacante
-- sofisticado rotacionando telefones falsos, mas barra os scripts triviais
-- de replay/flood.
--
-- Junto, corrige o "menor" relacionado: a whitelist ainda aceitava
-- 'montemor' (empresa desativada, sem view na UI) — permitia recriar leads
-- órfãos exatamente do tipo que a limpeza de dados já tinha removido.
CREATE OR REPLACE FUNCTION public.submit_lead_capture(
  p_company_id text, p_customer_name text, p_contact_phone text,
  p_contact_email text DEFAULT NULL::text, p_product_interest text DEFAULT NULL::text,
  p_priority text DEFAULT NULL::text, p_prospect_date date DEFAULT NULL::date,
  p_notes text DEFAULT NULL::text, p_source text DEFAULT 'site'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capture_id uuid;
  v_lead_id text;
  v_custom jsonb;
  v_phone_digits text;
  v_recent_phone_count int;
  v_recent_company_count int;
BEGIN
  -- Validações mínimas
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

  -- Anti-abuso: mesmo telefone não pode enviar mais de 3x em 24h
  v_phone_digits := regexp_replace(p_contact_phone, '\D', '', 'g');
  SELECT count(*) INTO v_recent_phone_count
  FROM lead_captures
  WHERE regexp_replace(contact_phone, '\D', '', 'g') = v_phone_digits
    AND created_at > now() - interval '24 hours';
  IF v_recent_phone_count >= 3 THEN
    RAISE EXCEPTION 'Muitas solicitações para este contato. Tente novamente mais tarde.';
  END IF;

  -- Anti-abuso: teto global por empresa numa janela curta (flood de dados aleatórios)
  SELECT count(*) INTO v_recent_company_count
  FROM lead_captures
  WHERE company_id = p_company_id
    AND created_at > now() - interval '10 minutes';
  IF v_recent_company_count >= 30 THEN
    RAISE EXCEPTION 'Muitas solicitações no momento. Tente novamente em alguns minutos.';
  END IF;

  -- Monta os customFields que serão exibidos como "Formulário Inicial" no card
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

  -- Cria o lead
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

  -- Cria a linha de auditoria
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
$$;
