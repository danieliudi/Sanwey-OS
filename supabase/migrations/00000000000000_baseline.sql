-- =====================================================================
-- BASELINE DO SCHEMA — ponto de partida unico do banco
--
-- Por que existe (31/08/2026): ate aqui o repositorio NAO reconstruia o
-- banco. Producao tinha 381 migrations registradas contra 292 arquivos
-- versionados, e 127 registros de producao nao tinham arquivo nenhum —
-- incluindo as que CRIAM as tabelas base (create_profiles..., create_leads
-- _table_with_rls, create_marketing_deliverables, rh_pipeline_generic_
-- schema). A migration mais antiga do repo era 20260504_add_client_
-- classification, que faz ALTER TABLE public.leads num banco onde `leads`
-- nunca havia sido criada. As primeiras semanas de schema nunca foram
-- versionadas.
--
-- Isso e a causa raiz do bug critico do Onboarding de 28/08/2026: a funcao
-- de trigger rh_onboarding_tarefas_guard_self_update() existia so em
-- producao, nunca commitada, e quebrou quando uma migration derrubou a
-- coluna que ela referenciava. Enquanto o repo nao fosse a fonte de
-- verdade, qualquer migration nova podia colidir com um objeto invisivel.
-- Essa funcao esta capturada aqui.
--
-- COMO FOI GERADO: por introspecao do catalogo do Postgres de producao
-- (pg_get_functiondef, pg_get_constraintdef, pg_get_indexdef,
-- pg_get_triggerdef, pg_policies, aclexplode), NAO por `supabase db dump`
-- — a maquina do Daniel nao tinha Docker, que a CLI exige. Cada bloco foi
-- transportado com md5 calculado pelo proprio Postgres e conferido do lado
-- de ca, entao a copia e exata; o que NAO se pode afirmar e que a
-- reconstrucao cubra 100% do que o pg_dump cobriria. A verificacao real e
-- o CI: o job `rls` sobe um Supabase local, aplica este arquivo do zero e
-- roda a matriz de 448 checagens de RLS.
--
-- O QUE ELE COBRE: extensoes, sequencias, 124 tabelas, 154 funcoes,
-- 492 constraints, indices, views, 101 triggers em `public` + os 3 de
-- auth.users (ver o bloco final), RLS nas 124 tabelas,
-- 345 policies, grants de tabela e de funcao, e os 13 buckets de Storage.
-- NAO cobre dados (so a definicao dos buckets, nao o conteudo), nem os
-- schemas auth/storage em si — o `supabase start` os cria.
--
-- O historico antigo (292 arquivos) foi movido pra supabase/migrations/
-- _historico/ como registro. Ele nao roda mais: nao rodava direito antes.
-- =====================================================================

-- Corpo de funcao nao e validado na criacao. Sem isto, uma funcao em SQL
-- que referencia outra ainda nao criada aborta o arquivo — e a ordem
-- alfabetica das 154 nao respeita dependencia. Mesmo recurso que o pg_dump
-- usa pelo mesmo motivo.
SET check_function_bodies = off;

-- ============ EXTENSOES ============
-- Cada uma num bloco com EXCEPTION: pg_cron e pg_net sao gerenciadas pela
-- plataforma Supabase e podem nao existir no stack local do CI. Falhar ali
-- abortaria o arquivo inteiro por uma extensao que o teste de RLS nem usa.
DO $baseline$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron indisponivel: %', SQLERRM; END $baseline$;
DO $baseline$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_net indisponivel: %', SQLERRM; END $baseline$;
DO $baseline$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_stat_statements indisponivel: %', SQLERRM; END $baseline$;
DO $baseline$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pgcrypto indisponivel: %', SQLERRM; END $baseline$;
DO $baseline$ BEGIN CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'supabase_vault indisponivel: %', SQLERRM; END $baseline$;
DO $baseline$ BEGIN CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'uuid-ossp indisponivel: %', SQLERRM; END $baseline$;

-- ============ SEQUENCIAS ============
-- Antes das tabelas: varios defaults sao nextval() destas.
CREATE SEQUENCE IF NOT EXISTS public.lead_stage_history_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.marketing_purchase_requests_number_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.marketing_requests_number_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.orders_numero_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.rapp_ibama_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.rh_stage_history_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE;

-- ============ TABELAS ============
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text,
  type text NOT NULL,
  title text,
  content text,
  score integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  performed_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agent_id text NOT NULL,
  action_type text NOT NULL,
  lead_id text,
  company_id text,
  title text NOT NULL,
  summary text,
  payload jsonb DEFAULT '{}'::jsonb,
  priority text DEFAULT 'normal'::text,
  status text DEFAULT 'pending'::text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_note text,
  run_id text,
  n8n_workflow text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  automation_id uuid
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  company_id text DEFAULT 'all'::text NOT NULL,
  module text DEFAULT 'crm'::text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  trigger jsonb NOT NULL,
  condition_groups jsonb DEFAULT '[]'::jsonb NOT NULL,
  then_actions jsonb DEFAULT '[]'::jsonb NOT NULL,
  else_actions jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  paused_reason text
);

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  module text,
  priority text DEFAULT 'media'::text NOT NULL,
  stage text DEFAULT 'reportado'::text NOT NULL,
  reported_by uuid,
  diagnosis text,
  diagnosed_at timestamp with time zone,
  pr_url text,
  branch_name text,
  needs_security_review boolean DEFAULT false NOT NULL,
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_admin boolean DEFAULT false NOT NULL,
  last_read_at timestamp with time zone,
  joined_at timestamp with time zone DEFAULT now(),
  archived_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  kind text DEFAULT 'canal'::text NOT NULL,
  name text,
  description text,
  icon text,
  company_id text,
  read_only boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  archived_at timestamp with time zone,
  sync_filter jsonb
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  channel_id uuid NOT NULL,
  author_id uuid,
  body text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.chat_stickers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  image_path text NOT NULL,
  uploaded_by uuid,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_addresses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  label text NOT NULL,
  address text NOT NULL,
  city text,
  state text,
  zip text,
  cnpj_faturamento text,
  is_default boolean DEFAULT false NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_billing_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  year integer NOT NULL,
  total_value numeric(14,2) DEFAULT 0 NOT NULL,
  order_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  job_title text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_products (
  client_id uuid NOT NULL,
  product_id uuid NOT NULL,
  price numeric(12,2) NOT NULL,
  active boolean DEFAULT true NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  category text,
  city text,
  state text,
  cnpj text,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  external_codes jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'ativo'::text NOT NULL,
  owner_ids text[] DEFAULT '{}'::text[] NOT NULL,
  address text,
  razao_social text
);

CREATE TABLE IF NOT EXISTS public.comex_export_operations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  title text NOT NULL,
  buyer_name text,
  buyer_country text,
  stage text DEFAULT 'qualificacao_comprador'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  owner_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  currency text DEFAULT 'USD'::text NOT NULL,
  sale_value numeric,
  ptax_rate numeric,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  starred boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.comex_import_operations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  title text NOT NULL,
  supplier_name text,
  stage text DEFAULT 'sourcing'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  owner_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  currency text DEFAULT 'USD'::text NOT NULL,
  fob_value numeric,
  freight_value numeric,
  insurance_value numeric,
  ptax_rate numeric,
  estimated_taxes_brl numeric,
  estimated_fees_brl numeric,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  starred boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.crm_viagem_categorias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  limite_alerta numeric
);

CREATE TABLE IF NOT EXISTS public.crm_viagem_despesas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  registro_id uuid,
  vendedor_id uuid NOT NULL,
  mes_referencia date NOT NULL,
  categoria text NOT NULL,
  valor numeric NOT NULL,
  data_despesa date NOT NULL,
  descricao text,
  comprovante_path text,
  comprovante_ext text,
  ia_extraido jsonb DEFAULT '{}'::jsonb NOT NULL,
  status_reembolso text DEFAULT 'pendente'::text NOT NULL,
  observacao_gestor text,
  aprovado_por uuid,
  aprovado_em timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  prestacao_id uuid
);

CREATE TABLE IF NOT EXISTS public.crm_viagem_prestacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  vendedor_id uuid NOT NULL,
  registro_id uuid,
  titulo text NOT NULL,
  mes_referencia date NOT NULL,
  status text DEFAULT 'rascunho'::text NOT NULL,
  enviada_em timestamp with time zone,
  decidida_em timestamp with time zone,
  decidida_por uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.crm_viagem_registros (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  vendedor_id uuid NOT NULL,
  mes_referencia date NOT NULL,
  lead_id text,
  cliente_nome text,
  destino_planejado text NOT NULL,
  data_planejada date NOT NULL,
  objetivo text,
  status text DEFAULT 'planejado'::text NOT NULL,
  data_realizada date,
  destino_realizado text,
  resumo_realizado text,
  motivo_divergencia text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  client_id uuid,
  valor_previsto numeric,
  tipo text DEFAULT 'visita'::text NOT NULL,
  campaign_id uuid
);

CREATE TABLE IF NOT EXISTS public.deliverable_checklists (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  deliverable_id uuid NOT NULL,
  title text DEFAULT 'Checklist'::text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_library (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  expires_at date,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  scope text DEFAULT 'shared'::text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.esg_emission_factors (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category text NOT NULL,
  scope smallint NOT NULL,
  unit text NOT NULL,
  factor_value numeric NOT NULL,
  gwp numeric DEFAULT 1 NOT NULL,
  source text NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.esg_emission_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  scope smallint NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  activity_data numeric NOT NULL,
  activity_unit text NOT NULL,
  emission_factor_id uuid NOT NULL,
  co2e_calculated numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.esg_reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  totals_by_scope jsonb DEFAULT '{}'::jsonb NOT NULL,
  record_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  generated_at timestamp with time zone DEFAULT now() NOT NULL,
  generated_by uuid
);

CREATE TABLE IF NOT EXISTS public.export_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  exported_by uuid NOT NULL,
  domain text NOT NULL,
  record_count integer DEFAULT 0 NOT NULL,
  meta jsonb,
  exported_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.external_cache (
  cache_key text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  companies text[] DEFAULT '{}'::text[] NOT NULL,
  invited_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  accepted_at timestamp with time zone,
  accepted_by uuid,
  last_sent_at timestamp with time zone,
  sectors text[] DEFAULT '{}'::text[],
  supervisor_id uuid,
  supplier_id uuid,
  name text
);

CREATE TABLE IF NOT EXISTS public.lead_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text NOT NULL,
  company_id text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_captures (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  customer_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  product_interest text,
  priority text,
  prospect_date date,
  notes text,
  source text DEFAULT 'site'::text,
  user_agent text,
  ip_address inet,
  created_at timestamp with time zone DEFAULT now(),
  lead_id text
);

CREATE TABLE IF NOT EXISTS public.lead_checklists (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text NOT NULL,
  company_id text NOT NULL,
  title text DEFAULT 'Checklist'::text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_document_refs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text NOT NULL,
  document_library_id uuid NOT NULL,
  attached_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.lead_emails (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text NOT NULL,
  template_id uuid,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  sent_by uuid,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  resend_message_id text,
  status text DEFAULT 'sent'::text NOT NULL,
  error_message text
);

CREATE TABLE IF NOT EXISTS public.lead_samples (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text NOT NULL,
  cost numeric DEFAULT 0 NOT NULL,
  sent_at date DEFAULT CURRENT_DATE NOT NULL,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.lead_stage_history (
  id bigint DEFAULT nextval('lead_stage_history_id_seq'::regclass) NOT NULL,
  lead_id text NOT NULL,
  company_id text NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  changed_by uuid,
  note text
);

CREATE TABLE IF NOT EXISTS public.leads (
  id text NOT NULL,
  company_id text NOT NULL,
  cnpj text,
  company text NOT NULL,
  razao_social text,
  sector text,
  cnae text,
  size text,
  city text,
  state text,
  address text,
  capital_social numeric DEFAULT 0,
  contact_email text,
  phone text,
  situacao text,
  trigger text,
  trigger_label text,
  evidence text,
  fit_score integer DEFAULT 0,
  sku text,
  sku_name text,
  unit_price numeric DEFAULT 0,
  quantity integer DEFAULT 0,
  value numeric DEFAULT 0,
  probability numeric DEFAULT 0,
  close_date timestamp with time zone,
  date_detected timestamp with time zone,
  days_ago integer DEFAULT 0,
  stage text DEFAULT 'prospeccao'::text,
  status text DEFAULT 'prospeccao'::text,
  owner text,
  urgency text,
  decision_maker jsonb DEFAULT '{}'::jsonb,
  starred boolean DEFAULT false,
  notes jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now(),
  stage_changed_at timestamp with time zone DEFAULT now(),
  is_demo boolean DEFAULT false,
  created_by uuid,
  canal_origem text DEFAULT 'manual'::text,
  client_classification text,
  order_count integer DEFAULT 0,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  next_follow_up timestamp with time zone,
  activities jsonb DEFAULT '[]'::jsonb,
  client_id uuid,
  badges jsonb DEFAULT '[]'::jsonb NOT NULL,
  owner_ids text[] DEFAULT '{}'::text[] NOT NULL,
  sent_to_posvenda_at timestamp with time zone,
  negotiation_started_at timestamp with time zone,
  campaign_id uuid
);

CREATE TABLE IF NOT EXISTS public.margin_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  product_id uuid,
  margem_aviso_pct numeric(6,2),
  margem_minima_pct numeric(6,2),
  active boolean DEFAULT true NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.market_intelligence_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  body text,
  source_url text,
  source_name text,
  sector text,
  relevant_for text[],
  status text DEFAULT 'published'::text NOT NULL,
  automation_id uuid,
  created_by text,
  detected_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.market_signals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  source text NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL,
  url text,
  urgency text DEFAULT 'medio'::text NOT NULL,
  detected_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_budgets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  category text NOT NULL,
  period_year integer NOT NULL,
  amount numeric DEFAULT 0 NOT NULL,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_campaign_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  drive_url text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  name text NOT NULL,
  channel text,
  budget numeric DEFAULT 0,
  kpi text,
  launch_date timestamp with time zone,
  end_date timestamp with time zone,
  stage text DEFAULT 'briefing'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now(),
  performance_score numeric DEFAULT 0,
  owner uuid,
  agency_name text,
  utm_url text,
  drive_folder_url text,
  drive_folder_id text,
  approval_checklist jsonb DEFAULT '[]'::jsonb,
  notes jsonb DEFAULT '[]'::jsonb,
  activities jsonb DEFAULT '[]'::jsonb,
  starred boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  owner_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  supplier_id uuid
);

CREATE TABLE IF NOT EXISTS public.marketing_deliverable_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  deliverable_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_deliverables (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  campaign_id uuid,
  title text NOT NULL,
  requester_name text,
  department text,
  description text,
  priority text DEFAULT 'media'::text,
  deadline timestamp with time zone,
  stage text DEFAULT 'solicitacao'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now(),
  assignee uuid,
  notes jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  stage_data jsonb DEFAULT '{}'::jsonb,
  activities jsonb DEFAULT '[]'::jsonb,
  starred boolean DEFAULT false,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  request_number text,
  assignee_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  campaign_stage_key text,
  requester_email text,
  email_error text
);

CREATE TABLE IF NOT EXISTS public.marketing_expense_deliverables (
  expense_id uuid NOT NULL,
  deliverable_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_expense_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  expense_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1 NOT NULL,
  unit_value numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_expense_tasks (
  expense_id uuid NOT NULL,
  task_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_expenses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  campaign_id uuid,
  description text NOT NULL,
  category text DEFAULT 'Outros'::text NOT NULL,
  amount numeric DEFAULT 0,
  status text DEFAULT 'pendente'::text NOT NULL,
  due_date timestamp with time zone,
  notes text,
  receipt_url text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  invoice_date date
);

CREATE TABLE IF NOT EXISTS public.marketing_protocol_numbers (
  number integer NOT NULL,
  source text NOT NULL,
  record_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_purchase_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_number text DEFAULT ('C'::text || lpad((nextval('marketing_purchase_requests_number_seq'::regclass))::text, 5, '0'::text)) NOT NULL,
  item_name text NOT NULL,
  description text,
  supplier_id uuid,
  quantity numeric,
  unit_price numeric,
  total_value numeric,
  stage text DEFAULT 'solicitado'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  requester_name text,
  requester_email text,
  requester_phone text,
  requested_by uuid,
  responsible_id uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_reason text,
  due_date date,
  invoice_date date,
  invoice_url text,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  expense_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  responsible_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  quote_options jsonb DEFAULT '[]'::jsonb NOT NULL,
  payment_terms text,
  supplier_order_code text,
  delivery_deadline date,
  partial_delivered_qty numeric,
  partial_remaining_qty numeric,
  partial_new_deadline date,
  partial_notes text,
  invoice_number text,
  payment_control_number text,
  delivered_at date,
  received_by text,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_quote_email_template (
  id boolean DEFAULT true NOT NULL,
  subject text DEFAULT 'Solicitação de cotação — {{TITLE}}'::text NOT NULL,
  body_html text DEFAULT '<p>Olá, {{SUPPLIER_NAME}},</p>
<p>Estamos solicitando uma cotação para: <strong>{{TITLE}}</strong>.</p>
<p>{{DESCRIPTION}}</p>
<p>Prazo desejado para resposta: <strong>{{DEADLINE}}</strong></p>
<p>Solicitado por {{REQUESTED_BY}} — Grupo Sanwey ({{COMPANY_NAMES}}).</p>
<p>Qualquer dúvida, é só responder este e-mail.</p>
<p>Atenciosamente,<br/>Grupo Sanwey</p>'::text NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text,
  department text,
  requester_name text,
  requester_email text,
  request_type text,
  priority text DEFAULT 'media'::text NOT NULL,
  deadline date,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  status text DEFAULT 'pendente'::text NOT NULL,
  rejection_reason text,
  notes text,
  approved_at timestamp with time zone,
  approved_by uuid,
  deliverable_id uuid,
  is_demo boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  request_number text NOT NULL,
  email_error text,
  task_id uuid,
  budget numeric,
  approver_name text,
  category text DEFAULT 'material'::text NOT NULL,
  purchase_request_id uuid
);

CREATE TABLE IF NOT EXISTS public.marketing_supplier_quotes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  supplier_id uuid NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  title text NOT NULL,
  description text,
  deadline date,
  status text DEFAULT 'pendente'::text NOT NULL,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_reason text,
  sent_at timestamp with time zone,
  email_error text,
  response_notes text,
  response_value numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_suppliers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  category text DEFAULT 'outro'::text NOT NULL,
  contact_name text,
  email text NOT NULL,
  phone text,
  notes text,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketing_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  campaign_id uuid,
  campaign_stage_key text,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'media'::text,
  deadline timestamp with time zone,
  stage text DEFAULT 'a_fazer'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now(),
  assignee_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  starred boolean DEFAULT false NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.module_states (
  module_id text NOT NULL,
  state text DEFAULT 'live'::text NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ncm_catalog (
  code text NOT NULL,
  description text NOT NULL,
  relevance text NOT NULL,
  group_label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  recipient_id uuid NOT NULL,
  type text DEFAULT 'mention'::text NOT NULL,
  title text NOT NULL,
  body text,
  link jsonb,
  created_by uuid,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantidade integer NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_stage_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  de text,
  para text NOT NULL,
  moved_by uuid,
  moved_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  numero bigint DEFAULT nextval('orders_numero_seq'::regclass) NOT NULL,
  company_id text NOT NULL,
  client_id uuid NOT NULL,
  contact_id uuid,
  address_id uuid,
  origem text NOT NULL,
  situacao text DEFAULT 'rascunho'::text NOT NULL,
  ordem_compra_cliente text,
  observacao text,
  kronosys_numero text,
  total numeric(12,2) DEFAULT 0 NOT NULL,
  created_by uuid,
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  date date NOT NULL,
  end_date date,
  description text,
  color text DEFAULT '#6366F1'::text NOT NULL,
  all_day boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_task_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_task_automations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  trigger jsonb DEFAULT '{}'::jsonb NOT NULL,
  condition_groups jsonb DEFAULT '[]'::jsonb NOT NULL,
  then_actions jsonb DEFAULT '[]'::jsonb NOT NULL,
  else_actions jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.personal_task_checklists (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text DEFAULT 'Checklist'::text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_task_dependencies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  task_id uuid NOT NULL,
  depends_on_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_task_stage_fields (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  stage_key text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL,
  label text NOT NULL,
  required boolean DEFAULT false NOT NULL,
  options jsonb DEFAULT '[]'::jsonb NOT NULL,
  order_idx integer DEFAULT 0 NOT NULL,
  placeholder text,
  help_text text,
  visible_if jsonb,
  required_if jsonb,
  validation_rule jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_task_stages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  stage_key text NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#64748B'::text NOT NULL,
  order_idx integer DEFAULT 0 NOT NULL,
  terminal boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_task_tags (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'media'::text NOT NULL,
  status text DEFAULT 'a_fazer'::text NOT NULL,
  due_date date,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  recurrence text DEFAULT 'none'::text NOT NULL,
  due_time text,
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  recurrence_config jsonb DEFAULT '{}'::jsonb NOT NULL,
  related_lead_id text
);

CREATE TABLE IF NOT EXISTS public.personal_tasks_api_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id uuid NOT NULL,
  label text NOT NULL,
  key_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.pipeline_stage_fields (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  stage_id text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL,
  label text NOT NULL,
  required boolean DEFAULT false NOT NULL,
  options jsonb DEFAULT '[]'::jsonb NOT NULL,
  order_idx integer DEFAULT 0 NOT NULL,
  placeholder text,
  help_text text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  visible_if jsonb,
  required_if jsonb,
  validation_rule jsonb
);

CREATE TABLE IF NOT EXISTS public.pipeline_stage_transitions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  domain text NOT NULL,
  company_id text DEFAULT 'all'::text NOT NULL,
  from_stage_key text NOT NULL,
  to_stage_key text NOT NULL,
  allowed boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  condition_groups jsonb
);

CREATE TABLE IF NOT EXISTS public.posvenda_cases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  lead_id text,
  client_name text NOT NULL,
  value numeric DEFAULT 0 NOT NULL,
  owner_ids text[] DEFAULT '{}'::text[] NOT NULL,
  stage text DEFAULT 'onboarding_cliente'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  negotiation_started_at timestamp with time zone,
  client_id uuid
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  sku text NOT NULL,
  name text NOT NULL,
  description text,
  unit text DEFAULT 'un'::text NOT NULL,
  moq integer,
  preco_tabela numeric(12,2),
  certifications text[] DEFAULT '{}'::text[] NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  tagline text,
  features text[] DEFAULT '{}'::text[] NOT NULL,
  specs jsonb DEFAULT '[]'::jsonb NOT NULL,
  applications text[] DEFAULT '{}'::text[] NOT NULL,
  category text,
  icon text,
  proposed boolean DEFAULT false NOT NULL,
  homologado boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profile_module_overrides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  module_id text NOT NULL,
  allow boolean NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profile_secrets (
  id uuid NOT NULL,
  ai_config jsonb,
  calendar_token text DEFAULT (gen_random_uuid())::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  name text,
  role text DEFAULT 'vendedor'::text NOT NULL,
  companies text[] DEFAULT '{}'::text[] NOT NULL,
  initials text,
  avatar_bg text DEFAULT '#1E4D8C'::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  email text,
  avatar_url text,
  sectors text[] DEFAULT '{}'::text[],
  supervisor_id uuid,
  job_title text,
  department text,
  admission_date date,
  contract_type text,
  employee_status text DEFAULT 'ativo'::text,
  frente text,
  roles text[] DEFAULT '{}'::text[] NOT NULL,
  mention_notifications_enabled boolean DEFAULT true NOT NULL,
  supplier_id uuid,
  chat_enabled boolean DEFAULT true NOT NULL,
  client_id uuid
);

CREATE TABLE IF NOT EXISTS public.proposal_line_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  proposal_id uuid NOT NULL,
  model_label text NOT NULL,
  quantity numeric DEFAULT 1 NOT NULL,
  unit_price numeric DEFAULT 0 NOT NULL,
  certification_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text NOT NULL,
  company_id text NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  ai_draft_text text,
  total_value numeric DEFAULT 0 NOT NULL,
  esg_snapshot jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.prospect_seeds (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cnpj text,
  company text NOT NULL,
  razao_social text,
  sector text NOT NULL,
  state text NOT NULL,
  city text,
  size text DEFAULT 'Mid-Market'::text,
  relevant_for text[] DEFAULT '{}'::text[],
  evidence text,
  source text DEFAULT 'curadoria'::text,
  fit_score integer DEFAULT 65,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  public_signals jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.rapp_cargas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  fonte text NOT NULL,
  url text NOT NULL,
  arquivo_bytes bigint,
  last_modified text,
  linhas_lidas integer DEFAULT 0 NOT NULL,
  linhas_gravadas integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'em_andamento'::text NOT NULL,
  erro text,
  iniciada_em timestamp with time zone DEFAULT now() NOT NULL,
  concluida_em timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.rapp_ibama (
  id bigint DEFAULT nextval('rapp_ibama_id_seq'::regclass) NOT NULL,
  fonte text NOT NULL,
  cnpj text NOT NULL,
  cnpj_raiz text GENERATED ALWAYS AS ("left"(cnpj, 8)) STORED,
  razao_social text,
  estado text,
  municipio text,
  categoria text,
  detalhe text,
  ano integer,
  residuo_codigo text,
  residuo_desc text,
  classificacao text,
  quantidade numeric,
  unidade text,
  cnpj_contraparte text,
  razao_contraparte text,
  situacao text,
  linha jsonb NOT NULL,
  carga_id uuid,
  ingerido_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.record_views (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  module text NOT NULL,
  record_id uuid NOT NULL,
  last_viewed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_aplicacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  candidate_id uuid NOT NULL,
  vaga_id uuid NOT NULL,
  etapa_pipeline text DEFAULT 'triagem'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now(),
  fit_score numeric,
  justificativa text,
  pontos_fortes jsonb DEFAULT '[]'::jsonb NOT NULL,
  gaps jsonb DEFAULT '[]'::jsonb NOT NULL,
  motivo_reprovacao text,
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  rating smallint,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  manager_decision text,
  manager_decision_at timestamp with time zone,
  manager_decision_notes text,
  manager_link_id uuid,
  hired_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.rh_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  domain text NOT NULL,
  record_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_avaliacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  evaluator_id uuid,
  cycle text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text DEFAULT 'rascunho'::text NOT NULL,
  self_rating numeric,
  manager_rating numeric,
  final_rating numeric,
  notes text,
  crm_metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  tipo text DEFAULT 'ad_hoc'::text NOT NULL,
  conteudo jsonb DEFAULT '{}'::jsonb NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  status_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  evaluator_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  desfecho text,
  desfecho_meta jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_bemestar_fila (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sessao_id uuid NOT NULL,
  senha integer NOT NULL,
  nome text NOT NULL,
  frente text,
  status text DEFAULT 'na_fila'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  called_at timestamp with time zone,
  horario time without time zone,
  ramal text,
  email text,
  whatsapp text,
  lembrete_enviado boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_bemestar_sessoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  titulo text NOT NULL,
  descricao text,
  data date,
  status text DEFAULT 'aberta'::text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  horario_inicio time without time zone,
  horario_fim time without time zone,
  slot_minutos integer DEFAULT 30 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_beneficios_catalogo (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tipo text NOT NULL,
  nome_exibicao text NOT NULL,
  fornecedor_id uuid,
  valor_padrao numeric,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_candidatos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  vaga_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  linkedin_url text,
  resume_url text,
  stage text DEFAULT 'triagem'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now(),
  notes jsonb DEFAULT '[]'::jsonb NOT NULL,
  rating smallint,
  source text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  cv_texto_extraido text,
  resume_ext text,
  consentimento_lgpd_at timestamp with time zone,
  frente_origem text[] DEFAULT '{}'::text[],
  responsible_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  resume_object_path text
);

CREATE TABLE IF NOT EXISTS public.rh_cargo_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  department text,
  contract_type text,
  salary_min numeric,
  salary_max numeric,
  benefits jsonb DEFAULT '[]'::jsonb NOT NULL,
  schedule text,
  shift text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  description text,
  schedule_blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
  escala text
);

CREATE TABLE IF NOT EXISTS public.rh_checklists (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  domain text NOT NULL,
  record_id uuid NOT NULL,
  title text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_colaborador_beneficios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  colaborador_id uuid NOT NULL,
  beneficio_catalogo_id uuid NOT NULL,
  status text DEFAULT 'solicitado'::text NOT NULL,
  valor numeric,
  solicitado_em timestamp with time zone DEFAULT now() NOT NULL,
  aprovado_em timestamp with time zone,
  aprovado_por uuid,
  notes text
);

CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id uuid,
  full_name text NOT NULL,
  cpf text,
  rg text,
  birth_date date,
  phone text,
  email text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zip text,
  job_title text,
  department text,
  contract_type text,
  admission_date date,
  employee_status text DEFAULT 'ativo'::text NOT NULL,
  salary numeric,
  document_type text,
  document_path text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  onboarding_stage text DEFAULT 'pre_admissao'::text NOT NULL,
  onboarding_stage_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  vaga_id uuid,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  aso_vencimento date,
  contrato_fim date,
  desligamento_date date,
  frente text,
  periodo_experiencia_dias integer,
  aprendiz_inicio date,
  aprendiz_fim date,
  desligamento_tipo text,
  desligamento_motivo text,
  desligamento_meta jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_curriculo_upload_tokens (
  token uuid DEFAULT gen_random_uuid() NOT NULL,
  candidato_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  used_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.rh_data_update_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  colaborador_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  field text NOT NULL,
  current_value text,
  new_value text NOT NULL,
  motivo text,
  status text DEFAULT 'pendente'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  motivo_recusa text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_ferias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  type text DEFAULT 'ferias'::text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'pendente'::text NOT NULL,
  notes text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  status_changed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_fornecedor_contrato_eventos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  contrato_id uuid NOT NULL,
  tipo text NOT NULL,
  valor_anterior numeric,
  valor_novo numeric,
  descricao text,
  data_evento date DEFAULT CURRENT_DATE NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_fornecedor_contratos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  fornecedor_id uuid NOT NULL,
  titulo text NOT NULL,
  vigencia_inicio date,
  vigencia_fim date,
  valor numeric,
  status text DEFAULT 'ativo'::text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  responsavel_id uuid
);

CREATE TABLE IF NOT EXISTS public.rh_fornecedores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  tipo text NOT NULL,
  contact_name text,
  email text,
  phone text,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_movimentacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  colaborador_id uuid NOT NULL,
  tipo text DEFAULT 'promocao'::text NOT NULL,
  cargo_anterior text,
  cargo_novo text,
  department_anterior text,
  department_novo text,
  salario_anterior numeric,
  salario_novo numeric,
  effective_date date,
  motivo text,
  status text DEFAULT 'pendente'::text NOT NULL,
  avaliacao_id uuid,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  motivo_recusa text,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  status_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_onboarding_tarefas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  colaborador_id uuid NOT NULL,
  template_id uuid,
  titulo text NOT NULL,
  data_limite date,
  status text DEFAULT 'pendente'::text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  responsavel_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_onboarding_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cargo text,
  frente text,
  checklist_padrao jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  tipo_trilha text
);

CREATE TABLE IF NOT EXISTS public.rh_pesquisa_respostas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pesquisa_id uuid NOT NULL,
  respostas jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  respondente_id uuid
);

CREATE TABLE IF NOT EXISTS public.rh_pesquisas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  titulo text NOT NULL,
  descricao text,
  perguntas jsonb DEFAULT '[]'::jsonb NOT NULL,
  status text DEFAULT 'aberta'::text NOT NULL,
  abre_em date,
  fecha_em date,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  modo text DEFAULT 'anonima'::text NOT NULL,
  scope_type text DEFAULT 'todos'::text NOT NULL,
  scope_value text
);

CREATE TABLE IF NOT EXISTS public.rh_pipeline_stage_fields (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  domain text NOT NULL,
  stage_key text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL,
  label text NOT NULL,
  required boolean DEFAULT false NOT NULL,
  options jsonb DEFAULT '[]'::jsonb NOT NULL,
  order_idx integer DEFAULT 0 NOT NULL,
  placeholder text,
  help_text text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  visible_if jsonb,
  required_if jsonb,
  company_id text DEFAULT 'all'::text NOT NULL,
  validation_rule jsonb
);

CREATE TABLE IF NOT EXISTS public.rh_pipeline_stages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  domain text NOT NULL,
  stage_key text NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#64748B'::text NOT NULL,
  order_idx integer DEFAULT 0 NOT NULL,
  probability numeric,
  sla_days integer,
  terminal boolean DEFAULT false NOT NULL,
  won boolean DEFAULT false NOT NULL,
  lost boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  company_id text DEFAULT 'all'::text NOT NULL,
  code text,
  card_preview_fields text[]
);

CREATE TABLE IF NOT EXISTS public.rh_report_presets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  metric_keys text[] DEFAULT '{}'::text[] NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_signature_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  domain text NOT NULL,
  record_id uuid NOT NULL,
  status text DEFAULT 'pendente_envio'::text NOT NULL,
  signers jsonb DEFAULT '[]'::jsonb NOT NULL,
  source_storage_path text,
  d4sign_document_uuid text,
  signed_file_path text,
  sent_at timestamp with time zone,
  signed_at timestamp with time zone,
  last_webhook_event text,
  last_webhook_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_stage_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  domain text NOT NULL,
  record_id uuid NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  changed_by uuid,
  custom_fields_snapshot jsonb
);

CREATE TABLE IF NOT EXISTS public.rh_treinamento_atribuicoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  treinamento_id uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  status text DEFAULT 'pendente'::text NOT NULL,
  data_conclusao timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  status_changed_at timestamp with time zone DEFAULT now() NOT NULL,
  certificado_url text
);

CREATE TABLE IF NOT EXISTS public.rh_treinamentos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  titulo text NOT NULL,
  descricao text,
  tipo text DEFAULT 'opcional'::text NOT NULL,
  link_conteudo text,
  frente text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  validade_dias integer,
  cargo_alvo text,
  departamento_alvo text
);

CREATE TABLE IF NOT EXISTS public.rh_vaga_manager_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  vaga_id uuid NOT NULL,
  manager_name text NOT NULL,
  manager_email text NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  last_accessed_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rh_vagas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  department text,
  description text,
  requirements text,
  stage text DEFAULT 'rascunho'::text NOT NULL,
  stage_changed_at timestamp with time zone DEFAULT now(),
  company_ids text[] DEFAULT '{}'::text[],
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  link_slug text,
  status text DEFAULT 'aberta'::text NOT NULL,
  cargo_template_id uuid,
  job_title text,
  contract_type text,
  schedule text,
  shift text,
  salary_min numeric,
  salary_max numeric,
  benefits jsonb DEFAULT '[]'::jsonb NOT NULL,
  hiring_deadline date,
  priority text DEFAULT 'media'::text NOT NULL,
  activities jsonb DEFAULT '[]'::jsonb NOT NULL,
  custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
  responsible_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  schedule_blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
  escala text,
  approved_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.sales_cases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  company_id text NOT NULL,
  client_id uuid,
  lead_id text,
  cliente_nome text NOT NULL,
  setor text,
  resultado text,
  situacao text,
  sinais text,
  objecao_principal text,
  concorrente text,
  licao text,
  categoria_licao text[] DEFAULT '{}'::text[] NOT NULL,
  raw_transcript text,
  source text DEFAULT 'voz'::text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  profile_id uuid NOT NULL,
  version integer NOT NULL,
  accepted_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.uniform_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  sizes text[] DEFAULT '{}'::text[] NOT NULL,
  models text[] DEFAULT ARRAY['Masculina'::text, 'Feminina'::text] NOT NULL,
  unit_price numeric,
  is_active boolean DEFAULT true NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.uniform_people (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  full_name text NOT NULL,
  department text,
  site text,
  colaborador_id uuid,
  is_active boolean DEFAULT true NOT NULL,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.uniform_person_sizes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  person_id uuid NOT NULL,
  item_id uuid NOT NULL,
  model text,
  size text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.uniform_round_lines (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  round_id uuid NOT NULL,
  person_id uuid NOT NULL,
  item_id uuid NOT NULL,
  department text,
  model text,
  size text,
  embroidery text,
  quantity integer DEFAULT 0 NOT NULL,
  unit_price numeric,
  approved_by uuid,
  approved_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  picked_up_by uuid,
  pickup_point text,
  signature_path text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.uniform_rounds (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  deadline date,
  status text DEFAULT 'coleta'::text NOT NULL,
  purchase_request_id uuid,
  company_ids text[] DEFAULT '{}'::text[] NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text,
  client_id uuid,
  company_id text NOT NULL,
  phone_number text NOT NULL,
  opt_in boolean DEFAULT false NOT NULL,
  opted_in_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid NOT NULL,
  direction text NOT NULL,
  body text NOT NULL,
  template_name text,
  sent_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============ FUNCOES ============
CREATE OR REPLACE FUNCTION public.agencia_sees_supplier(p_supplier_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    'agencia' = any(current_user_roles())
    and p_supplier_id is not null
    and (select supplier_id from public.profiles where id = auth.uid()) = p_supplier_id;
$function$
;

CREATE OR REPLACE FUNCTION public.ai_org_quota_increment(p_user_id uuid, p_daily_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_key text := 'ai_org_quota:' || p_user_id::text || ':' || to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD');
  v_count int;
BEGIN
  INSERT INTO public.external_cache (cache_key, source, payload, expires_at)
  VALUES (
    v_key,
    'ai_assistant_org_quota',
    jsonb_build_object('count', 1),
    (date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day') AT TIME ZONE 'utc'
  )
  ON CONFLICT (cache_key) DO UPDATE
    SET payload = jsonb_build_object(
      'count', COALESCE((public.external_cache.payload->>'count')::int, 0) + 1
    )
  RETURNING (payload->>'count')::int INTO v_count;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.allocate_marketing_protocol_number(p_source text, p_record_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_number integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('marketing_protocol_numbers'));

  SELECT gs.n INTO v_number
  FROM generate_series(94, (SELECT COALESCE(MAX(number), 93) + 1 FROM public.marketing_protocol_numbers)) AS gs(n)
  LEFT JOIN public.marketing_protocol_numbers mpn ON mpn.number = gs.n
  WHERE mpn.number IS NULL
  ORDER BY gs.n
  LIMIT 1;

  INSERT INTO public.marketing_protocol_numbers (number, source, record_id)
  VALUES (v_number, p_source, p_record_id);

  RETURN v_number;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_event_checklist_template(p_campaign_id uuid, p_company_ids text[], p_owner_ids uuid[], p_segments jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_seg jsonb;
  v_task_id uuid;
  v_created integer := 0;
  v_existing_titles text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_campaign_id::text));

  SELECT array_agg(title) INTO v_existing_titles
  FROM public.marketing_tasks
  WHERE campaign_id = p_campaign_id;

  FOR v_seg IN SELECT * FROM jsonb_array_elements(p_segments)
  LOOP
    IF v_existing_titles IS NOT NULL AND (v_seg->>'segment') = ANY(v_existing_titles) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.marketing_tasks (company_ids, campaign_id, title, assignee_ids, priority, created_by)
    VALUES (p_company_ids, p_campaign_id, v_seg->>'segment', p_owner_ids, 'media', v_uid)
    RETURNING id INTO v_task_id;

    INSERT INTO public.rh_checklists (domain, record_id, title, items, created_by)
    SELECT
      'marketing_tasks',
      v_task_id,
      'Checklist do segmento',
      (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'text', item, 'done', false))
         FROM jsonb_array_elements_text(v_seg->'items') AS item),
      v_uid;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_marketing_quote(p_quote_id uuid)
 RETURNS marketing_supplier_quotes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_supplier_quotes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar cotações';
  END IF;

  SELECT * INTO v_row FROM public.marketing_supplier_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Cotação já foi decidida';
  END IF;

  UPDATE public.marketing_supplier_quotes
  SET status = 'aprovada', approved_by = v_uid, approved_at = now()
  WHERE id = p_quote_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_marketing_request(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_req  public.marketing_requests%ROWTYPE;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações de marketing';
  END IF;

  SELECT * INTO v_req FROM public.marketing_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_req.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  INSERT INTO public.marketing_deliverables (
    title, requester_name, requester_email, department, description, priority, deadline,
    company_ids, stage, notes, created_by, request_number
  )
  VALUES (
    v_req.title,
    v_req.requester_name,
    v_req.requester_email,
    v_req.department,
    NULLIF(concat_ws(E'\n\n---\n', v_req.description, p_notes), ''),
    v_req.priority,
    v_req.deadline,
    coalesce(v_req.company_ids, '{}'),
    'solicitacao',
    CASE WHEN p_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', p_notes, 'at', now())) ELSE '[]'::jsonb END,
    v_uid,
    v_req.request_number
  )
  RETURNING id INTO v_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, deliverable_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_marketing_request_as_purchase(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_req  public.marketing_requests%ROWTYPE;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações de marketing';
  END IF;

  SELECT * INTO v_req FROM public.marketing_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_req.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  INSERT INTO public.marketing_purchase_requests (
    item_name, description, requester_name, requester_email, due_date, company_ids, stage, notes, created_by
  )
  VALUES (
    v_req.title,
    NULLIF(concat_ws(E'\n\n---\n', v_req.description, p_notes), ''),
    v_req.requester_name,
    v_req.requester_email,
    v_req.deadline,
    coalesce(v_req.company_ids, '{}'),
    'solicitado',
    CASE WHEN p_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', p_notes, 'at', now())) ELSE '[]'::jsonb END,
    v_uid
  )
  RETURNING id INTO v_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, purchase_request_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_marketing_request_as_task(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_req       public.marketing_requests%ROWTYPE;
  v_id        uuid;
  v_requester text;
  v_desc      text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações de marketing';
  END IF;

  SELECT * INTO v_req FROM public.marketing_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_req.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  v_requester := NULLIF(concat_ws(' · ', v_req.requester_name, v_req.requester_email, v_req.department), '');
  v_desc := NULLIF(concat_ws(
    E'\n\n---\n',
    CASE WHEN v_requester IS NOT NULL THEN 'Solicitante: ' || v_requester ELSE NULL END,
    v_req.description,
    p_notes
  ), '');

  INSERT INTO public.marketing_tasks (
    title, description, priority, deadline, company_ids, stage, notes, created_by
  )
  VALUES (
    v_req.title,
    v_desc,
    v_req.priority,
    v_req.deadline,
    coalesce(v_req.company_ids, '{}'),
    'a_fazer',
    CASE WHEN p_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', p_notes, 'at', now())) ELSE '[]'::jsonb END,
    v_uid
  )
  RETURNING id INTO v_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, task_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_purchase_request(p_id uuid, p_responsible_id uuid DEFAULT NULL::uuid, p_supplier_id uuid DEFAULT NULL::uuid, p_total_value numeric DEFAULT NULL::numeric)
 RETURNS marketing_purchase_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_purchase_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações de compra';
  END IF;

  SELECT * INTO v_row FROM public.marketing_purchase_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.stage NOT IN ('solicitado', 'cotacao') THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.marketing_purchase_requests
  SET stage = 'aprovado', approved_by = v_uid, approved_at = now(),
      responsible_id = coalesce(p_responsible_id, responsible_id, v_uid),
      supplier_id = coalesce(p_supplier_id, supplier_id),
      total_value = coalesce(p_total_value, total_value),
      activities = coalesce(v_row.activities, '[]'::jsonb) || jsonb_build_object(
        'type', 'stage_change', 'description', 'Aprovado', 'at', now()
      )
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
    SELECT v_row.requested_by, 'purchase_request_approved',
           'Sua solicitação de compra foi aprovada',
           v_row.item_name || ' (' || v_row.request_number || ')',
           jsonb_build_object('module', 'purchase_requests', 'id', v_row.id),
           v_uid
    WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = v_row.requested_by AND mention_notifications_enabled = true);
  END IF;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_rh_data_update_request(p_id uuid)
 RETURNS rh_data_update_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.rh_data_update_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')) THEN
    RAISE EXCEPTION 'Apenas RH pode aprovar solicitações de atualização';
  END IF;

  SELECT * INTO v_row FROM public.rh_data_update_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.rh_data_update_requests
  SET status = 'aprovado', reviewed_by = v_uid, reviewed_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  UPDATE public.rh_colaboradores SET
    phone                = CASE WHEN v_row.field = 'phone'                THEN v_row.new_value ELSE phone END,
    email                = CASE WHEN v_row.field = 'email'                THEN v_row.new_value ELSE email END,
    address_street       = CASE WHEN v_row.field = 'address_street'       THEN v_row.new_value ELSE address_street END,
    address_number       = CASE WHEN v_row.field = 'address_number'       THEN v_row.new_value ELSE address_number END,
    address_complement   = CASE WHEN v_row.field = 'address_complement'   THEN v_row.new_value ELSE address_complement END,
    address_neighborhood = CASE WHEN v_row.field = 'address_neighborhood' THEN v_row.new_value ELSE address_neighborhood END,
    address_city         = CASE WHEN v_row.field = 'address_city'         THEN v_row.new_value ELSE address_city END,
    address_state        = CASE WHEN v_row.field = 'address_state'        THEN v_row.new_value ELSE address_state END,
    address_zip          = CASE WHEN v_row.field = 'address_zip'          THEN v_row.new_value ELSE address_zip END,
    updated_at            = now()
  WHERE id = v_row.colaborador_id;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_rh_movimentacao(p_id uuid)
 RETURNS rh_movimentacoes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.rh_movimentacoes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Apenas a diretoria pode aprovar movimentações';
  END IF;

  SELECT * INTO v_row FROM public.rh_movimentacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Movimentação já foi decidida';
  END IF;

  UPDATE public.rh_movimentacoes
  SET status = 'aprovado', approved_by = v_uid, approved_at = now(), status_changed_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  -- Aplica no cadastro do colaborador só o que a movimentação de fato mudou.
  UPDATE public.rh_colaboradores
  SET salary     = COALESCE(v_row.salario_novo, salary),
      job_title  = COALESCE(v_row.cargo_novo, job_title),
      department = COALESCE(v_row.department_novo, department),
      updated_at = now()
  WHERE id = v_row.colaborador_id;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.broadcast_announcement(p_title text, p_body text, p_scope_type text DEFAULT 'todos'::text, p_scope_value text DEFAULT NULL::text, p_link jsonb DEFAULT NULL::jsonb, p_importante boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_type text := CASE WHEN p_importante THEN 'comunicado_importante' ELSE 'comunicado' END;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh')) THEN
    RAISE EXCEPTION 'Sem permissão para enviar comunicados';
  END IF;
  IF coalesce(trim(p_title), '') = '' THEN RAISE EXCEPTION 'Título obrigatório'; END IF;
  IF p_scope_type NOT IN ('todos','frente','departamento') THEN RAISE EXCEPTION 'Escopo inválido'; END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT p.id, v_type, p_title, p_body, p_link, v_uid
  FROM public.profiles p
  WHERE (p_importante OR p.mention_notifications_enabled = true)
    AND p.id <> v_uid
    AND (
      p_scope_type = 'todos'
      OR (p_scope_type = 'frente'       AND EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id AND c.frente = p_scope_value AND c.employee_status = 'ativo'))
      OR (p_scope_type = 'departamento' AND EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id AND c.department = p_scope_value AND c.employee_status = 'ativo'))
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_add_member(p_channel_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
  end if;
  if exists (select 1 from public.chat_channels where id = p_channel_id and sync_filter is not null) then
    raise exception 'Este grupo é sincronizado automaticamente por departamento — não dá pra adicionar pessoa à mão.';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and roles && array['agencia','cliente']::text[]) then
    raise exception 'Fornecedor, agência ou cliente não participa de grupo ou canal interno.';
  end if;
  insert into public.chat_channel_members (channel_id, user_id) values (p_channel_id, p_user_id) on conflict do nothing;
end; $function$
;

CREATE OR REPLACE FUNCTION public.chat_can_dm(p_target uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  me     public.profiles%ROWTYPE;
  target public.profiles%ROWTYPE;
BEGIN
  IF p_target IS NULL OR auth.uid() IS NULL OR p_target = auth.uid() THEN RETURN false; END IF;
  SELECT * INTO me     FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO target FROM public.profiles WHERE id = p_target;
  IF me.id IS NULL OR target.id IS NULL THEN RETURN false; END IF;

  IF me.roles && ARRAY['agencia','cliente']::text[] OR target.roles && ARRAY['agencia','cliente']::text[] THEN
    RETURN false;
  END IF;

  IF public.chat_is_manager(me.id) THEN RETURN true; END IF;

  IF target.roles && ARRAY['diretoria','admin']::text[] THEN RETURN false; END IF;

  IF me.supervisor_id = target.id OR target.supervisor_id = me.id THEN RETURN true; END IF;

  IF me.sectors IS NOT NULL AND target.sectors IS NOT NULL AND me.sectors && target.sectors THEN
    RETURN true;
  END IF;

  IF me.department IS NOT NULL AND target.department IS NOT NULL
     AND trim(lower(me.department)) = trim(lower(target.department)) THEN
    RETURN true;
  END IF;

  RETURN false;
END $function$
;

CREATE OR REPLACE FUNCTION public.chat_can_manage(p_channel uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    public.chat_is_manager(auth.uid())
    or exists (
      select 1 from public.chat_channel_members
      where channel_id = p_channel and user_id = auth.uid() and is_admin = true
    );
$function$
;

CREATE OR REPLACE FUNCTION public.chat_can_post(p_channel uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE ch public.chat_channels%ROWTYPE;
BEGIN
  IF NOT public.chat_is_member(p_channel) THEN RETURN false; END IF;
  SELECT * INTO ch FROM public.chat_channels WHERE id = p_channel;
  IF ch.id IS NULL OR ch.archived_at IS NOT NULL THEN RETURN false; END IF;
  IF ch.read_only THEN RETURN public.chat_is_manager(auth.uid()); END IF;
  RETURN true;
END $function$
;

CREATE OR REPLACE FUNCTION public.chat_channel_members_guard_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.user_id = auth.uid() and not chat_is_manager(auth.uid()) then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'não é permitido alterar o próprio is_admin';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_channel_roster(p_channel_id uuid)
 RETURNS TABLE(user_id uuid, is_admin boolean, name text, initials text, avatar_bg text, avatar_url text, job_title text, department text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select m.user_id, m.is_admin, p.name, p.initials, p.avatar_bg, p.avatar_url, p.job_title, p.department
  from public.chat_channel_members m
  join public.profiles p on p.id = m.user_id
  where m.channel_id = p_channel_id
    and public.chat_is_member(p_channel_id)
  order by m.is_admin desc, p.name asc;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_count_profiles_matching_filter(p_filter jsonb)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when not public.chat_is_manager(auth.uid()) then 0
    else (
      select count(*)::int
      from public.profiles p
      where public.chat_profile_matches_filter(p_filter, p.department, p.companies)
    )
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_create_channel(p_name text, p_icon text, p_description text, p_member_ids uuid[], p_read_only boolean DEFAULT false, p_sync_filter jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE new_id uuid; uid uuid; prof record; v_filter jsonb;
BEGIN
  IF NOT public.chat_is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas gestores podem criar canais.';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'O canal precisa de um nome.';
  END IF;

  -- Filtro "vazio" (sem departments e sem companies) equivale a nenhum
  -- filtro — nunca deixa um sync_filter não-nulo bater com todo mundo.
  v_filter := p_sync_filter;
  IF v_filter IS NOT NULL
     AND coalesce(jsonb_array_length(v_filter->'departments'), 0) = 0
     AND coalesce(jsonb_array_length(v_filter->'companies'), 0) = 0 THEN
    v_filter := NULL;
  END IF;

  INSERT INTO public.chat_channels (kind, name, icon, description, read_only, created_by, sync_filter)
  VALUES ('canal', trim(p_name), p_icon, p_description, coalesce(p_read_only, false), auth.uid(), v_filter)
  RETURNING id INTO new_id;

  INSERT INTO public.chat_channel_members (channel_id, user_id, is_admin) VALUES (new_id, auth.uid(), true);

  FOREACH uid IN ARRAY coalesce(p_member_ids, ARRAY[]::uuid[]) LOOP
    IF uid <> auth.uid() THEN
      INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, uid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  IF v_filter IS NOT NULL THEN
    FOR prof IN SELECT id, department, companies FROM public.profiles LOOP
      IF public.chat_profile_matches_filter(v_filter, prof.department, prof.companies) THEN
        INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, prof.id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_dm_candidates()
 RETURNS TABLE(id uuid, name text, initials text, avatar_bg text, avatar_url text, job_title text, department text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id, p.name, p.initials, p.avatar_bg, p.avatar_url, p.job_title, p.department
  FROM public.profiles p
  WHERE p.id <> auth.uid() AND public.chat_can_dm(p.id)
  ORDER BY p.name;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_is_manager(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user
      AND roles && ARRAY['admin','gerente','gerente_marketing','gerente_rh','diretoria']::text[]
  );
$function$
;

CREATE OR REPLACE FUNCTION public.chat_is_member(p_channel uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    coalesce((select chat_enabled from public.profiles where id = auth.uid()), true)
    and exists (
      select 1 from public.chat_channel_members
      where channel_id = p_channel and user_id = auth.uid()
    );
$function$
;

CREATE OR REPLACE FUNCTION public.chat_leave_channel(p_channel_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1 from public.chat_channel_members
    where channel_id = p_channel_id and user_id = auth.uid()
  ) then
    raise exception 'Você não é membro deste grupo/canal.';
  end if;

  if exists (
    select 1 from public.chat_channel_members
    where channel_id = p_channel_id and user_id = auth.uid() and is_admin = true
  ) and (
    select count(*) from public.chat_channel_members
    where channel_id = p_channel_id and is_admin = true
  ) <= 1 and (
    select count(*) from public.chat_channel_members
    where channel_id = p_channel_id
  ) > 1 then
    raise exception 'Você é o único admin do grupo — promova outra pessoa antes de sair.';
  end if;

  delete from public.chat_channel_members
  where channel_id = p_channel_id and user_id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_mark_read(p_channel uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  UPDATE public.chat_channel_members
  SET last_read_at = now()
  WHERE channel_id = p_channel AND user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.chat_my_channels()
 RETURNS TABLE(id uuid, kind text, name text, icon text, description text, read_only boolean, updated_at timestamp with time zone, last_read_at timestamp with time zone, archived_at timestamp with time zone, unread_count bigint, last_message_body text, last_message_at timestamp with time zone, last_message_author uuid, dm_peer_id uuid, dm_peer_name text, dm_peer_initials text, dm_peer_avatar_bg text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    c.id, c.kind, c.name, c.icon, c.description, c.read_only, c.updated_at, m.last_read_at, m.archived_at,
    (SELECT count(*) FROM public.chat_messages msg
      WHERE msg.channel_id = c.id AND msg.deleted_at IS NULL
        AND msg.author_id <> auth.uid()
        AND (m.last_read_at IS NULL OR msg.created_at > m.last_read_at)) AS unread_count,
    lm.body, lm.created_at, lm.author_id,
    peer.id, peer.name, peer.initials, peer.avatar_bg
  FROM public.chat_channel_members m
  JOIN public.chat_channels c ON c.id = m.channel_id AND c.archived_at IS NULL
  LEFT JOIN LATERAL (
    SELECT body, created_at, author_id FROM public.chat_messages
    WHERE channel_id = c.id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT p.id, p.name, p.initials, p.avatar_bg
    FROM public.chat_channel_members m2
    JOIN public.profiles p ON p.id = m2.user_id
    WHERE c.kind = 'dm' AND m2.channel_id = c.id AND m2.user_id <> auth.uid()
    LIMIT 1
  ) peer ON true
  WHERE m.user_id = auth.uid()
  ORDER BY coalesce(lm.created_at, c.updated_at) DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_profile_matches_filter(p_filter jsonb, p_department text, p_companies text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    (
      p_filter->'departments' is null
      or jsonb_array_length(p_filter->'departments') = 0
      or coalesce(p_department = any(array(select jsonb_array_elements_text(p_filter->'departments'))), false)
    )
    and (
      p_filter->'companies' is null
      or jsonb_array_length(p_filter->'companies') = 0
      or coalesce(p_companies, '{}'::text[]) && array(select jsonb_array_elements_text(p_filter->'companies'))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.chat_remove_member(p_channel_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
  end if;
  if exists (select 1 from public.chat_channels where id = p_channel_id and sync_filter is not null) then
    raise exception 'Este grupo é sincronizado automaticamente por departamento — não dá pra remover pessoa à mão.';
  end if;
  if exists (select 1 from public.chat_channel_members where channel_id = p_channel_id and user_id = p_user_id and is_admin = true)
     and (select count(*) from public.chat_channel_members where channel_id = p_channel_id and is_admin = true) <= 1 then
    raise exception 'Esse é o único admin do grupo — promova outra pessoa antes de remover.';
  end if;
  delete from public.chat_channel_members where channel_id = p_channel_id and user_id = p_user_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.chat_set_member_admin(p_channel_id uuid, p_user_id uuid, p_is_admin boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
  end if;
  if not p_is_admin
     and exists (select 1 from public.chat_channel_members where channel_id = p_channel_id and user_id = p_user_id and is_admin = true)
     and (select count(*) from public.chat_channel_members where channel_id = p_channel_id and is_admin = true) <= 1 then
    raise exception 'Esse é o único admin do grupo — promova outra pessoa antes de tirar o admin dele.';
  end if;
  update public.chat_channel_members set is_admin = p_is_admin
  where channel_id = p_channel_id and user_id = p_user_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.chat_start_dm(p_target uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE existing uuid; new_id uuid;
BEGIN
  IF NOT public.chat_can_dm(p_target) THEN
    RAISE EXCEPTION 'Você não pode iniciar uma conversa direta com essa pessoa.';
  END IF;

  SELECT c.id INTO existing
  FROM public.chat_channels c
  WHERE c.kind = 'dm'
    AND EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = p_target)
    AND (SELECT count(*) FROM public.chat_channel_members m WHERE m.channel_id = c.id) = 2
  LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.chat_channels (kind, created_by) VALUES ('dm', auth.uid()) RETURNING id INTO new_id;
  INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, auth.uid()), (new_id, p_target);
  RETURN new_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.chat_sync_channel_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE ch record;
BEGIN
  IF NEW.roles && ARRAY['agencia','cliente']::text[] THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.department IS NOT DISTINCT FROM OLD.department AND NEW.companies IS NOT DISTINCT FROM OLD.companies THEN
    RETURN NEW;
  END IF;
  FOR ch IN SELECT id FROM public.chat_channels WHERE sync_filter IS NOT NULL AND archived_at IS NULL LOOP
    PERFORM public.chat_sync_membership_for_channel(ch.id, NEW.id, NEW.department, NEW.companies);
  END LOOP;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_sync_membership_for_channel(p_channel_id uuid, p_user_id uuid, p_department text, p_companies text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_filter jsonb; v_matches boolean; v_is_member boolean;
BEGIN
  SELECT sync_filter INTO v_filter FROM public.chat_channels WHERE id = p_channel_id AND archived_at IS NULL;
  IF v_filter IS NULL THEN RETURN; END IF;

  v_matches := public.chat_profile_matches_filter(v_filter, p_department, p_companies);
  v_is_member := EXISTS(SELECT 1 FROM public.chat_channel_members WHERE channel_id = p_channel_id AND user_id = p_user_id);

  IF v_matches AND NOT v_is_member THEN
    INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (p_channel_id, p_user_id)
    ON CONFLICT DO NOTHING;
  ELSIF NOT v_matches AND v_is_member THEN
    -- Nunca remove quem é dono/criador do canal (is_admin) — sincronização
    -- ajusta a audiência, não expulsa quem administra o canal.
    DELETE FROM public.chat_channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id AND is_admin IS NOT TRUE;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_touch_channel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ BEGIN
  UPDATE public.chat_channels SET updated_at = now() WHERE id = NEW.channel_id;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.chat_update_channel(p_channel_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_read_only boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
  end if;
  if p_name is not null and trim(p_name) = '' then
    raise exception 'O nome não pode ficar vazio.';
  end if;
  update public.chat_channels set
    name = coalesce(nullif(trim(p_name), ''), name),
    description = case when p_description is not null then p_description else description end,
    read_only = coalesce(p_read_only, read_only),
    updated_at = now()
  where id = p_channel_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.client_billing_history_touch_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.clients_touch_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.comex_export_operations_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.comex_import_operations_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_mention_notifications(p_recipient_ids uuid[], p_type text, p_title text, p_body text, p_link jsonb DEFAULT NULL::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT DISTINCT r, coalesce(p_type, 'mention'), p_title, p_body, p_link, v_uid
  FROM unnest(p_recipient_ids) AS r
  WHERE r <> v_uid
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = r AND mention_notifications_enabled = true
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_create_cross_module_deliverable(p_title text, p_company_ids text[] DEFAULT '{}'::text[], p_description text DEFAULT NULL::text, p_priority text DEFAULT 'media'::text, p_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id  uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF coalesce(trim(p_title), '') = '' THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  INSERT INTO public.marketing_deliverables (
    title, company_ids, description, priority, deadline,
    department, request_type, requester_name, created_by
  )
  VALUES (
    trim(p_title),
    coalesce(p_company_ids, '{}'),
    p_description,
    coalesce(nullif(trim(p_priority), ''), 'media'),
    p_deadline,
    'Comercial',
    'automacao_crm',
    (SELECT name FROM public.profiles WHERE id = v_uid),
    v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_viagem_despesas_block_delete_prestada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF OLD.prestacao_id IS NOT NULL THEN
    SELECT status INTO v_status FROM public.crm_viagem_prestacoes WHERE id = OLD.prestacao_id;
    IF v_status IS DISTINCT FROM 'rascunho' THEN
      RAISE EXCEPTION 'Não é possível excluir uma despesa que já faz parte de uma prestação de contas enviada.';
    END IF;
  END IF;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_viagem_despesas_require_comprovante()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status_reembolso IN ('aprovado', 'pago')
     AND NEW.valor > 100
     AND (NEW.comprovante_path IS NULL OR NEW.comprovante_path = '') THEN
    RAISE EXCEPTION 'Despesas acima de R$100 exigem comprovante anexado antes de aprovar/pagar reembolso.';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_viagem_despesas_validate_prestacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old_status text;
  v_new_vendedor uuid;
  v_new_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.prestacao_id IS NOT NULL AND NEW.prestacao_id IS DISTINCT FROM OLD.prestacao_id THEN
    SELECT status INTO v_old_status FROM public.crm_viagem_prestacoes WHERE id = OLD.prestacao_id;
    IF v_old_status IS DISTINCT FROM 'rascunho' THEN
      RAISE EXCEPTION 'Não é possível remover ou trocar a despesa de uma prestação já enviada.';
    END IF;
  END IF;

  IF NEW.prestacao_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.prestacao_id IS DISTINCT FROM NEW.prestacao_id) THEN
    SELECT vendedor_id, status INTO v_new_vendedor, v_new_status FROM public.crm_viagem_prestacoes WHERE id = NEW.prestacao_id;
    IF v_new_vendedor IS NULL THEN
      RAISE EXCEPTION 'Prestação de contas não encontrada.';
    END IF;
    IF v_new_vendedor <> NEW.vendedor_id THEN
      RAISE EXCEPTION 'A prestação de contas pertence a outro vendedor.';
    END IF;
    IF v_new_status <> 'rascunho' THEN
      RAISE EXCEPTION 'Só é possível adicionar despesa a uma prestação em rascunho.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_viagem_prestacoes_recompute_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
  v_pendentes int;
  v_aprovados int;
  v_rejeitados int;
  v_total int;
BEGIN
  IF NEW.prestacao_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status_reembolso IS NOT DISTINCT FROM OLD.status_reembolso THEN RETURN NEW; END IF;

  SELECT status INTO v_status FROM public.crm_viagem_prestacoes WHERE id = NEW.prestacao_id;
  IF v_status IS DISTINCT FROM 'enviada' THEN RETURN NEW; END IF;

  SELECT
    count(*) FILTER (WHERE status_reembolso = 'pendente'),
    count(*) FILTER (WHERE status_reembolso = 'aprovado'),
    count(*) FILTER (WHERE status_reembolso = 'rejeitado'),
    count(*)
  INTO v_pendentes, v_aprovados, v_rejeitados, v_total
  FROM public.crm_viagem_despesas WHERE prestacao_id = NEW.prestacao_id;

  IF v_pendentes > 0 THEN
    RETURN NEW;
  ELSIF v_aprovados = v_total THEN
    UPDATE public.crm_viagem_prestacoes SET status = 'aprovada', decidida_em = now(), decidida_por = auth.uid() WHERE id = NEW.prestacao_id;
  ELSIF v_rejeitados = v_total THEN
    UPDATE public.crm_viagem_prestacoes SET status = 'rejeitada', decidida_em = now(), decidida_por = auth.uid() WHERE id = NEW.prestacao_id;
  ELSE
    UPDATE public.crm_viagem_prestacoes SET status = 'parcial', decidida_em = now(), decidida_por = auth.uid() WHERE id = NEW.prestacao_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_viagem_prestacoes_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_client(p_client uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    public.current_user_is_admin()
    or (public.current_user_has_role('gerente')
        and exists (select 1 from public.clients c
                    where c.id = p_client and c.company_ids && public.current_user_companies()))
    or (public.current_user_roles() && array['vendedor']::text[]
        and exists (select 1 from public.clients c
                    where c.id = p_client
                      and c.company_ids && public.current_user_companies()
                      and (c.owner_ids = '{}' or auth.uid()::text = any (c.owner_ids))));
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_can_see_lead(p_lead_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id
      and (
        public.current_user_is_admin()
        or (public.current_user_has_role('gerente') and l.company_id = any(public.current_user_companies()))
        or (public.current_user_has_role('vendedor') and l.company_id = any(public.current_user_companies())
            and ((auth.uid())::text = any(l.owner_ids)
                 or l.owner_ids && public.current_user_subordinate_ids()
                 or (l.owner_ids = '{}'::text[] and l.sector is not null and l.sector = any(public.current_user_sectors()))))
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_client_companies()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(c.company_ids, '{}'::text[])
  from public.clients c
  where c.id = public.current_user_client_id();
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_client_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select client_id from public.profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_companies()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(companies, '{}'::text[]) FROM profiles WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_has_module(p_module text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state text; v_override boolean; v_roles text[];
  v_is_admin boolean; v_is_manager boolean; v_is_marketing boolean;
  v_is_marketing_manager boolean; v_is_rh boolean; v_is_rh_manager boolean;
  v_is_agencia boolean; v_is_portal boolean; v_is_pure_marketing boolean;
  v_is_pure_rh boolean; v_is_market_intel boolean; v_is_diretoria boolean;
  v_is_pure_suporte boolean;
begin
  select allow into v_override from public.profile_module_overrides
   where user_id = auth.uid() and module_id = p_module;
  select roles into v_roles from public.profiles where id = auth.uid();
  if v_roles is null then v_roles := '{}'::text[]; end if;
  v_is_admin := v_roles && array['admin'];

  select state into v_state from public.module_states where module_id = p_module;
  v_state := coalesce(v_state, 'live');
  if v_state = 'off' then return false;
  elsif v_state = 'test' then
    if not (v_is_admin or v_override is true) then return false; end if;
  end if;

  if v_override is not null then return v_override; end if;

  v_is_manager           := v_roles && array['gerente','admin'];
  v_is_marketing         := v_roles && array['marketing','gerente_marketing','admin'];
  v_is_marketing_manager := v_roles && array['gerente_marketing','admin'];
  v_is_rh                := v_roles && array['rh','gerente_rh','admin'];
  v_is_rh_manager        := v_roles && array['gerente_rh','admin'];
  v_is_agencia           := v_roles && array['agencia'];
  v_is_portal            := array_length(v_roles,1) > 0 and v_roles <@ array['portal'];
  v_is_pure_marketing    := array_length(v_roles,1) > 0 and v_roles <@ array['marketing','gerente_marketing'];
  v_is_pure_rh           := array_length(v_roles,1) > 0 and v_roles <@ array['rh','gerente_rh'];
  v_is_pure_suporte      := array_length(v_roles,1) > 0 and v_roles <@ array['suporte'];
  -- Mercado: vendedor + gerência/marketing/admin (decidido com o Daniel
  -- 19/08/2026) — superset do antigo v_is_insights (que não incluía
  -- vendedor nem gerente Comercial puro).
  v_is_market_intel      := v_roles && array['vendedor','gerente','marketing','gerente_marketing','admin'];
  v_is_diretoria         := v_roles && array['diretoria'];

  if v_is_agencia or v_is_portal then return false; end if;
  if v_is_diretoria then return true; end if;

  if v_is_pure_suporte then
    return p_module = any(array['pedidos','clients','catalogo','chat','personal-tasks','meu-rh','tutorials',
                                'rh-onboarding','rh-treinamentos','rh-feedback']);
  end if;

  return case
    when p_module = 'catalogo'
      then (not v_is_pure_rh) and (v_is_marketing or not v_is_pure_marketing)
    when p_module = any(array['commercial-overview','crm','clients','pedidos','signals','explorer','crm-viagens'])
      then not v_is_pure_marketing and not v_is_pure_rh
    when p_module = 'crossref' then v_is_manager
    when p_module = any(array['marketing-home','marketing','marketing-solicitacoes','marketing-entregas',
         'marketing-fornecedores','marketing-compras','marketing-despesas','marketing-feiras'])
      then v_is_marketing
    when p_module = any(array['rh-overview','rh-recrutamento','rh-funcionarios','rh-cargos','rh-ferias',
         'rh-comunicacao','rh-bem-estar','rh-fornecedores']) then v_is_rh
    when p_module = any(array['rh-onboarding','rh-treinamentos','rh-feedback']) then true
    when p_module = 'executive' then v_is_manager or v_is_marketing_manager or v_is_rh_manager
    when p_module = 'market-intel' then v_is_market_intel
    when p_module = 'agents' then v_is_manager or v_is_rh_manager
    when p_module = 'esg-carbono' then v_is_manager
    when p_module = 'automations' then v_is_manager or v_is_rh_manager
    when p_module = any(array['chat','personal-tasks','meu-rh','tutorials']) then true
    else false
  end;
end; $function$
;

CREATE OR REPLACE FUNCTION public.current_user_has_role(p_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT p_role = ANY(roles) FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and 'admin' = ANY(roles)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_is_comex()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT roles && ARRAY['comex','admin']::text[] FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and roles && ARRAY['gerente','admin']::text[]
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_is_marketing()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT roles && ARRAY['marketing','gerente_marketing','admin']::text[]
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_is_marketing_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select roles && array['gerente_marketing','admin']::text[]
     from public.profiles where id = auth.uid()),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_is_rh()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT roles && ARRAY['rh','gerente_rh','admin']::text[]
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_is_rh_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT roles && ARRAY['gerente_rh','admin']::text[]
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_manages_commercial_tools()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.current_user_is_admin() or public.current_user_has_role('gerente');
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_manages_viagem_of(p_vendedor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    'admin' = ANY (current_user_roles())
    OR (
      'gerente' = ANY (current_user_roles())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_vendedor_id
        AND p.companies && current_user_companies()
      )
    )
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_roles()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(roles, '{}'::text[]) FROM public.profiles WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_sectors()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(sectors, '{}'::text[]) from public.profiles where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_subordinate_ids()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
  FROM public.profiles
  WHERE supervisor_id = (SELECT auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_margin_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company text;
  v record;
  v_msg text;
begin
  if public.current_user_is_admin() then
    return new;
  end if;

  select p.company_id into v_company from public.products p where p.id = new.product_id;
  if v_company is null then return new; end if;

  select * into v from public.margin_check(v_company, new.product_id, new.price);

  if v.bloqueia then
    v_msg := format(
      'Margem de %s%% está abaixo do mínimo de %s%% definido pela gerência para este produto. Fale com a gerência para revisar a regra.',
      to_char(v.margem_pct, 'FM990.00'), to_char(v.minimo_pct, 'FM990.00'));
    raise exception '%', v_msg using errcode = 'check_violation';
  end if;

  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.enviar_pesquisa_notificacao(p_pesquisa_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pesquisa record;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')) THEN
    RAISE EXCEPTION 'Sem permissão para enviar pesquisas';
  END IF;

  SELECT * INTO v_pesquisa FROM public.rh_pesquisas WHERE id = p_pesquisa_id;
  IF v_pesquisa.id IS NULL THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
  IF v_pesquisa.modo <> 'identificada' THEN RAISE EXCEPTION 'Só pesquisas identificadas podem ser notificadas.'; END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT p.id, 'pesquisa', 'Nova pesquisa: ' || v_pesquisa.titulo, v_pesquisa.descricao,
         jsonb_build_object('url', '/pesquisa/' || v_pesquisa.id::text), v_uid
  FROM public.profiles p
  WHERE p.mention_notifications_enabled = true
    AND p.id <> v_uid
    AND (
      v_pesquisa.scope_type = 'todos'
      OR (v_pesquisa.scope_type = 'frente'       AND EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id AND c.frente = v_pesquisa.scope_value AND c.employee_status = 'ativo'))
      OR (v_pesquisa.scope_type = 'departamento' AND EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id AND c.department = v_pesquisa.scope_value AND c.employee_status = 'ativo'))
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.esg_emission_factors_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.valid_to is not null then
    raise exception 'fator de emissão encerrado (valid_to preenchido) não pode ser alterado';
  end if;
  if new.factor_value is distinct from old.factor_value
     or new.gwp is distinct from old.gwp
     or new.category is distinct from old.category
     or new.scope is distinct from old.scope
     or new.unit is distinct from old.unit
     or new.source is distinct from old.source
     or new.valid_from is distinct from old.valid_from then
    raise exception 'fator de emissão é imutável -- crie uma nova vigência em vez de alterar esta';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.external_api_daily_increment(p_bucket text, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_key text := p_bucket || ':' || p_user_id::text || ':' || to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD');
  v_count int;
BEGIN
  INSERT INTO public.external_cache (cache_key, source, payload, expires_at)
  VALUES (
    v_key,
    'rate_limit:' || p_bucket,
    jsonb_build_object('count', 1),
    (date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day') AT TIME ZONE 'utc'
  )
  ON CONFLICT (cache_key) DO UPDATE
    SET payload = jsonb_build_object(
      'count', COALESCE((public.external_cache.payload->>'count')::int, 0) + 1
    )
  RETURNING (payload->>'count')::int INTO v_count;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_bemestar_horarios_disponiveis(p_id uuid)
 RETURNS TABLE(horario time without time zone, disponivel boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sessao record;
BEGIN
  SELECT * INTO v_sessao FROM public.rh_bemestar_sessoes WHERE id = p_id AND status = 'aberta';
  IF v_sessao.id IS NULL OR v_sessao.horario_inicio IS NULL OR v_sessao.horario_fim IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT slot::time,
           NOT EXISTS (
             SELECT 1 FROM public.rh_bemestar_fila f
             WHERE f.sessao_id = p_id AND f.horario = slot::time AND f.status <> 'faltou'
           )
    FROM generate_series(
      v_sessao.horario_inicio,
      v_sessao.horario_fim - (v_sessao.slot_minutos || ' minutes')::interval,
      (v_sessao.slot_minutos || ' minutes')::interval
    ) AS slot
    ORDER BY 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_bemestar_sessao_publica(p_id uuid)
 RETURNS TABLE(id uuid, titulo text, descricao text, data date, horario_inicio time without time zone, horario_fim time without time zone, slot_minutos integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id, s.titulo, s.descricao, s.data, s.horario_inicio, s.horario_fim, s.slot_minutos
  FROM public.rh_bemestar_sessoes s
  WHERE s.id = p_id AND s.status = 'aberta';
$function$
;

CREATE OR REPLACE FUNCTION public.get_client_timeline(p_client_id uuid)
 RETURNS TABLE(kind text, category text, ts timestamp with time zone, title text, detail text, actor_id uuid, actor_name text, lead_id text, lead_name text, meta jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
BEGIN
  IF p_client_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    current_user_is_admin()
    OR current_user_has_role('diretoria')
    OR (
      (current_user_roles() && ARRAY['gerente','vendedor'])
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = p_client_id
          AND c.company_ids && current_user_companies()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão pra ver o histórico deste cliente';
  END IF;

  RETURN QUERY
  WITH visible_leads AS (
    SELECT
      l.id, l.company, l.company_id, l.activities, l.notes,
      (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR current_user_has_role('gerente')
        OR l.owner_ids = '{}'::text[]
        OR (auth.uid())::text = ANY (l.owner_ids)
        OR l.owner_ids && current_user_subordinate_ids()
      ) AS owned
    FROM public.leads l
    WHERE l.client_id = p_client_id
      AND (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR l.company_id = ANY (current_user_companies())
      )
      AND (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR current_user_has_role('gerente')
        OR (l.sector IS NOT NULL AND l.sector = ANY (current_user_sectors()))
        OR (auth.uid())::text = ANY (l.owner_ids)
        OR l.owner_ids && current_user_subordinate_ids()
      )
  ),
  stage_names AS (
    SELECT DISTINCT ON (s.company_id, s.stage_key)
           s.company_id, s.stage_key, s.name
    FROM public.rh_pipeline_stages s
    WHERE s.domain = 'comercial'
    ORDER BY s.company_id, s.stage_key, s.order_idx
  ),
  items AS (
    SELECT
      CASE act.elem->>'type'
        WHEN 'note'               THEN 'nota'
        WHEN 'email_sent'         THEN 'email'
        WHEN 'proposal_generated' THEN 'proposta'
        WHEN 'ata_voz'            THEN 'ata'
        ELSE 'comentario'
      END                                                                      AS kind,
      'interacao'                                                              AS category,
      at.at                                                                    AS ts,
      CASE act.elem->>'type'
        WHEN 'note'               THEN 'Nota'
        WHEN 'email_sent'         THEN 'E-mail de abordagem'
        WHEN 'proposal_generated' THEN 'Proposta gerada'
        WHEN 'ata_voz'            THEN 'Ata de visita'
        ELSE 'Comentário'
      END                                                                      AS title,
      NULLIF(act.elem->>'body', '')                                            AS detail,
      NULLIF(act.elem->>'userId', '')::uuid                                    AS actor_id,
      COALESCE(pr.name, NULLIF(act.elem->>'userName', ''))                     AS actor_name,
      vl.id                                                                    AS lead_id,
      vl.company                                                               AS lead_name,
      jsonb_build_object(
        'source', 'leads.activities',
        'activityId', act.elem->>'id',
        'activityType', act.elem->>'type',
        'mentionedIds', COALESCE(act.elem->'mentionedIds', '[]'::jsonb),
        'editedAt', act.elem->>'editedAt',
        -- Da ata: o que ficou combinado é o que faz alguém agir seis meses
        -- depois, então sobe pro meta em vez de ficar só no corpo.
        'proximoPasso', act.elem->'meta'->>'proximoPasso',
        'proximoPassoData', act.elem->'meta'->>'proximoPassoData',
        'concorrente', act.elem->'meta'->>'concorrente',
        'origem', act.elem->'meta'->>'origem',
        -- Check-in de visita (17/08/2026): localização sempre anexada e o
        -- vínculo com a visita planejada em Viagens, quando existir.
        'location', act.elem->'meta'->'location',
        'viagemRegistroId', act.elem->'meta'->>'viagemRegistroId',
        'viagemLabel', act.elem->'meta'->>'viagemLabel'
      )                                                                        AS meta
    FROM visible_leads vl
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(vl.activities, '[]'::jsonb)) AS act(elem)
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(act.elem->>'timestamp', '')::timestamptz,
        NULLIF(act.elem->>'createdAt', '')::timestamptz
      ) AS at
    ) at
    LEFT JOIN public.profiles pr ON pr.id = NULLIF(act.elem->>'userId', '')::uuid
    WHERE act.elem->>'type' IN ('note', 'comment', 'email_sent', 'proposal_generated', 'ata_voz')
      AND act.elem->>'deletedAt' IS NULL
      AND at.at IS NOT NULL

    UNION ALL

    SELECT
      'nota',
      'interacao',
      NULLIF(nt.elem->>'createdAt', '')::timestamptz,
      'Nota (registro antigo)',
      COALESCE(NULLIF(nt.elem->>'text', ''), NULLIF(nt.elem->>'body', '')),
      NULLIF(nt.elem->>'userId', '')::uuid,
      COALESCE(pr.name, NULLIF(nt.elem->>'userName', '')),
      vl.id,
      vl.company,
      jsonb_build_object('source', 'leads.notes', 'legacy', true)
    FROM visible_leads vl
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(vl.notes, '[]'::jsonb)) AS nt(elem)
    LEFT JOIN public.profiles pr ON pr.id = NULLIF(nt.elem->>'userId', '')::uuid
    WHERE nt.elem->>'deletedAt' IS NULL
      AND NULLIF(nt.elem->>'createdAt', '') IS NOT NULL

    UNION ALL

    SELECT
      'etapa',
      'interno',
      h.changed_at,
      'Mudança de etapa',
      CASE WHEN h.from_stage IS NULL
           THEN 'Entrou em "' || COALESCE(sn_to.name, h.to_stage) || '"'
           ELSE 'De "' || COALESCE(sn_from.name, h.from_stage) || '" para "'
                       || COALESCE(sn_to.name, h.to_stage) || '"'
      END || COALESCE(' — ' || NULLIF(h.note, ''), ''),
      h.changed_by,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object('source', 'lead_stage_history', 'from', h.from_stage,
                         'to', h.to_stage, 'note', h.note,
                         'from_label', sn_from.name, 'to_label', sn_to.name)
    FROM visible_leads vl
    JOIN public.lead_stage_history h ON h.lead_id = vl.id
    LEFT JOIN public.profiles pr ON pr.id = h.changed_by
    LEFT JOIN stage_names sn_from ON sn_from.company_id = vl.company_id
                                 AND sn_from.stage_key = h.from_stage
    LEFT JOIN stage_names sn_to   ON sn_to.company_id = vl.company_id
                                 AND sn_to.stage_key = h.to_stage

    UNION ALL

    SELECT
      'etapa',
      'interno',
      at.at,
      'Mudança de etapa',
      NULLIF(act.elem->>'body', ''),
      NULLIF(act.elem->>'userId', '')::uuid,
      COALESCE(pr.name, NULLIF(act.elem->>'userName', '')),
      vl.id,
      vl.company,
      jsonb_build_object('source', 'leads.activities', 'from', act.elem->'meta'->>'from',
                         'to', act.elem->'meta'->>'to',
                         'from_label', sn_from.name, 'to_label', sn_to.name)
    FROM visible_leads vl
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(vl.activities, '[]'::jsonb)) AS act(elem)
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(act.elem->>'timestamp', '')::timestamptz,
        NULLIF(act.elem->>'createdAt', '')::timestamptz
      ) AS at
    ) at
    LEFT JOIN public.profiles pr ON pr.id = NULLIF(act.elem->>'userId', '')::uuid
    LEFT JOIN stage_names sn_from ON sn_from.company_id = vl.company_id
                                 AND sn_from.stage_key = act.elem->'meta'->>'from'
    LEFT JOIN stage_names sn_to   ON sn_to.company_id = vl.company_id
                                 AND sn_to.stage_key = act.elem->'meta'->>'to'
    WHERE act.elem->>'type' = 'stage_changed'
      AND act.elem->>'deletedAt' IS NULL
      AND at.at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_stage_history h
        WHERE h.lead_id = vl.id
          AND h.to_stage IS NOT DISTINCT FROM act.elem->'meta'->>'to'
          AND abs(extract(epoch FROM (h.changed_at - at.at))) < 300
      )

    UNION ALL

    SELECT
      'follow_up',
      'interacao',
      at.at,
      'Follow-up agendado',
      NULLIF(act.elem->>'body', ''),
      NULLIF(act.elem->>'userId', '')::uuid,
      COALESCE(pr.name, NULLIF(act.elem->>'userName', '')),
      vl.id,
      vl.company,
      jsonb_build_object('source', 'leads.activities', 'date', act.elem->'meta'->>'date')
    FROM visible_leads vl
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(vl.activities, '[]'::jsonb)) AS act(elem)
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(act.elem->>'timestamp', '')::timestamptz,
        NULLIF(act.elem->>'createdAt', '')::timestamptz
      ) AS at
    ) at
    LEFT JOIN public.profiles pr ON pr.id = NULLIF(act.elem->>'userId', '')::uuid
    WHERE act.elem->>'type' = 'follow_up_set'
      AND act.elem->>'deletedAt' IS NULL
      AND at.at IS NOT NULL

    UNION ALL

    SELECT
      'visita',
      CASE WHEN v.status IN ('cancelado', 'nao_realizado') THEN 'interno' ELSE 'interacao' END,
      COALESCE(
        ((COALESCE(v.data_realizada, v.data_planejada))::timestamp + interval '12 hours')
          AT TIME ZONE 'UTC',
        v.created_at
      ),
      CASE v.status
        WHEN 'realizado'     THEN 'Visita realizada'
        WHEN 'cancelado'     THEN 'Visita cancelada'
        WHEN 'nao_realizado' THEN 'Visita não realizada'
        ELSE 'Visita planejada'
      END,
      COALESCE(NULLIF(v.resumo_realizado, ''), NULLIF(v.objetivo, ''),
               NULLIF(v.destino_realizado, ''), NULLIF(v.destino_planejado, '')),
      v.vendedor_id,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object(
        'source', 'crm_viagem_registros',
        'viagemId', v.id,
        'matched_by', CASE
          WHEN v.client_id = p_client_id AND vl.id IS NOT NULL THEN 'ambos'
          WHEN v.client_id = p_client_id THEN 'cliente'
          ELSE 'negocio' END,
        'rawLeadId', v.lead_id,
        'status', v.status,
        'objetivo', v.objetivo,
        'resumo_realizado', v.resumo_realizado,
        'motivo_divergencia', v.motivo_divergencia,
        'destino_planejado', v.destino_planejado,
        'destino_realizado', v.destino_realizado,
        'data_planejada', v.data_planejada,
        'data_realizada', v.data_realizada,
        'valor_previsto', v.valor_previsto
      )
    FROM public.crm_viagem_registros v
    LEFT JOIN visible_leads vl ON vl.id = v.lead_id
    LEFT JOIN public.profiles pr ON pr.id = v.vendedor_id
    WHERE (v.client_id = p_client_id OR vl.id IS NOT NULL)
      AND (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR EXISTS (
          SELECT 1 FROM public.profiles vp
          WHERE vp.id = v.vendedor_id
            AND vp.companies && current_user_companies()
        )
      )

    UNION ALL

    SELECT
      'amostra',
      'interacao',
      COALESCE((s.sent_at::timestamp + interval '12 hours') AT TIME ZONE 'UTC', s.created_at),
      'Amostra enviada',
      NULLIF(s.notes, ''),
      s.created_by,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object('source', 'lead_samples', 'sampleId', s.id,
                         'cost', s.cost, 'sent_at', s.sent_at)
    FROM visible_leads vl
    JOIN public.lead_samples s ON s.lead_id = vl.id
    LEFT JOIN public.profiles pr ON pr.id = s.created_by

    UNION ALL

    SELECT
      'anexo',
      'interno',
      a.created_at,
      'Anexo adicionado',
      a.file_name,
      a.uploaded_by,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object('source', 'lead_attachments', 'attachmentId', a.id,
                         'file_path', a.file_path, 'file_size', a.file_size,
                         'mime_type', a.mime_type)
    FROM visible_leads vl
    JOIN public.lead_attachments a ON a.lead_id = vl.id
    LEFT JOIN public.profiles pr ON pr.id = a.uploaded_by
    WHERE vl.owned

    UNION ALL

    SELECT
      'posvenda',
      'interacao',
      pc.created_at,
      'Caso de pós-venda',
      COALESCE(pvs.name, NULLIF(pc.stage, '')),
      pc.created_by,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object('source', 'posvenda_cases', 'caseId', pc.id,
                         'stage', pc.stage, 'stage_label', pvs.name,
                         'value', pc.value, 'company_id', pc.company_id,
                         'client_name', pc.client_name,
                         'matched_by', CASE
                           WHEN pc.client_id = p_client_id AND vl.id IS NOT NULL THEN 'ambos'
                           WHEN pc.client_id = p_client_id THEN 'cliente'
                           ELSE 'negocio' END)
    FROM public.posvenda_cases pc
    LEFT JOIN visible_leads vl ON vl.id = pc.lead_id
    LEFT JOIN public.profiles pr ON pr.id = pc.created_by
    LEFT JOIN LATERAL (
      SELECT s.name FROM public.rh_pipeline_stages s
      WHERE s.domain = 'posvenda'
        AND s.stage_key = pc.stage
        AND s.company_id IN (pc.company_id, 'all')
      ORDER BY (s.company_id = pc.company_id) DESC, s.order_idx
      LIMIT 1
    ) pvs ON true
    WHERE (pc.client_id = p_client_id OR vl.id IS NOT NULL)
      AND (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR pc.company_id = ANY (current_user_companies())
      )

    UNION ALL

    SELECT
      'faturamento',
      'interno',
      make_timestamptz(b.year, 12, 31, 12, 0, 0, 'UTC'),
      'Faturamento ' || b.year::text,
      CASE WHEN COALESCE(b.order_count, 0) > 0
           THEN b.order_count::text || ' pedido(s) no ano' END,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::text,
      jsonb_build_object('source', 'client_billing_history', 'year', b.year,
                         'total_value', b.total_value, 'order_count', b.order_count)
    FROM public.client_billing_history b
    WHERE b.client_id = p_client_id
  )
  SELECT i.kind, i.category, i.ts, i.title, i.detail, i.actor_id, i.actor_name,
         i.lead_id, i.lead_name, i.meta
  FROM items i
  WHERE i.ts IS NOT NULL
  ORDER BY i.ts DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_colaborador_connections(p_colaborador_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT (
    current_user_is_admin()
    OR current_user_has_role('gerente_rh')
    OR current_user_has_role('rh')
    OR current_user_has_role('diretoria')
    OR EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = p_colaborador_id AND profile_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão pra ver conexões deste colaborador';
  END IF;

  SELECT jsonb_build_object(
    'avaliacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'tipo', a.tipo, 'cycle', a.cycle, 'status', a.status,
        'period_start', a.period_start, 'period_end', a.period_end,
        'final_rating', a.final_rating, 'created_at', a.created_at
      ) ORDER BY a.created_at DESC)
      FROM public.rh_avaliacoes a WHERE a.user_id = p_colaborador_id
    ), '[]'::jsonb),
    'movimentacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'tipo', m.tipo, 'cargo_novo', m.cargo_novo, 'status', m.status,
        'effective_date', m.effective_date, 'created_at', m.created_at
      ) ORDER BY m.created_at DESC)
      FROM public.rh_movimentacoes m WHERE m.colaborador_id = p_colaborador_id
    ), '[]'::jsonb),
    'treinamentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ta.id, 'titulo', t.titulo, 'status', ta.status,
        'data_conclusao', ta.data_conclusao, 'created_at', ta.created_at
      ) ORDER BY ta.created_at DESC)
      FROM public.rh_treinamento_atribuicoes ta
      JOIN public.rh_treinamentos t ON t.id = ta.treinamento_id
      WHERE ta.colaborador_id = p_colaborador_id
    ), '[]'::jsonb),
    'beneficios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', bc.nome_exibicao, 'status', b.status, 'valor', b.valor,
        'created_at', b.solicitado_em
      ) ORDER BY b.solicitado_em DESC)
      FROM public.rh_colaborador_beneficios b
      JOIN public.rh_beneficios_catalogo bc ON bc.id = b.beneficio_catalogo_id
      WHERE b.colaborador_id = p_colaborador_id
    ), '[]'::jsonb),
    'solicitacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'field', s.field, 'status', s.status, 'created_at', s.created_at
      ) ORDER BY s.created_at DESC)
      FROM public.rh_data_update_requests s WHERE s.colaborador_id = p_colaborador_id
    ), '[]'::jsonb),
    'ferias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', f.id, 'type', f.type, 'status', f.status,
        'start_date', f.start_date, 'end_date', f.end_date, 'created_at', f.created_at
      ) ORDER BY f.created_at DESC)
      FROM public.rh_ferias f WHERE f.user_id = p_colaborador_id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_marketing_request_number(p_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT request_number FROM public.marketing_requests WHERE id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_colaborador()
 RETURNS TABLE(id uuid, full_name text, cpf text, rg text, birth_date date, phone text, email text, address_street text, address_number text, address_complement text, address_neighborhood text, address_city text, address_state text, address_zip text, job_title text, department text, contract_type text, admission_date date, employee_status text, frente text, profile_id uuid, onboarding_stage text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id, full_name, cpf, rg, birth_date, phone, email,
         address_street, address_number, address_complement, address_neighborhood,
         address_city, address_state, address_zip,
         job_title, department, contract_type, admission_date, employee_status, frente, profile_id,
         onboarding_stage
  FROM public.rh_colaboradores
  WHERE profile_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_pesquisa_publica(p_id uuid)
 RETURNS TABLE(id uuid, titulo text, descricao text, perguntas jsonb, modo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id, p.titulo, p.descricao, p.perguntas, p.modo
  FROM public.rh_pesquisas p
  WHERE p.id = p_id
    AND p.status = 'aberta'
    AND (p.abre_em IS NULL OR p.abre_em <= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
    AND (p.fecha_em IS NULL OR p.fecha_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date);
$function$
;

CREATE OR REPLACE FUNCTION public.get_purchase_request_number(p_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT request_number FROM public.marketing_purchase_requests WHERE id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_supplier_last_purchase_price(p_supplier_id uuid, p_item_name text)
 RETURNS TABLE(total_value numeric, unit_price numeric, paid_at timestamp with time zone, request_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT current_user_is_marketing() THEN
    RAISE EXCEPTION 'Sem permissão para consultar histórico de compras';
  END IF;

  RETURN QUERY
  SELECT r.total_value, r.unit_price, r.stage_changed_at, r.request_number
  FROM public.marketing_purchase_requests r
  WHERE r.supplier_id = p_supplier_id
    AND r.stage = 'pago'
    AND lower(r.item_name) = lower(p_item_name)
  ORDER BY r.stage_changed_at DESC
  LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_vaga_publica(p_slug text)
 RETURNS TABLE(id uuid, title text, department text, description text, requirements text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT v.id, v.title, v.department, v.description, v.requirements
  FROM public.rh_vagas v
  WHERE v.link_slug = p_slug AND v.stage = 'publicada';
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  display_name text;
  user_count int;
  assigned_role text;
  assigned_companies text[];
  assigned_sectors text[];
  assigned_supervisor uuid;
  assigned_supplier uuid;
  invitation_id uuid;
  invitation_confirmed_already boolean := false;
begin
  select id, role, companies, sectors, supervisor_id, supplier_id
    into invitation_id, assigned_role, assigned_companies, assigned_sectors, assigned_supervisor, assigned_supplier
    from public.invitations
    where lower(email) = lower(new.email)
      and accepted_at is null
    order by created_at desc
    limit 1;

  -- Só aplica o papel/empresa do convite de imediato se o e-mail JÁ chegou
  -- confirmado no INSERT (ex.: fluxo administrativo/auto-confirm real).
  -- Caso contrário, entra como 'vendedor' sem empresa — igual a quem não
  -- tem convite nenhum — e handle_user_confirmed promove no momento em
  -- que a confirmação de e-mail realmente acontecer.
  if invitation_id is not null and new.email_confirmed_at is not null then
    invitation_confirmed_already := true;
  else
    invitation_id := null;
  end if;

  if invitation_id is null then
    select count(*) into user_count from public.profiles;
    if user_count = 0 then
      assigned_role := 'admin';
      assigned_companies := array['industria', 'resibag', 'montemor'];
    else
      assigned_role := 'vendedor';
      assigned_companies := '{}'::text[];
    end if;
    assigned_sectors := '{}'::text[];
    assigned_supervisor := null;
    assigned_supplier := null;
  end if;

  display_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  insert into public.profiles (id, email, name, initials, role, companies, sectors, supervisor_id, supplier_id)
  values (
    new.id,
    new.email,
    display_name,
    upper(substring(display_name from 1 for 2)),
    assigned_role,
    assigned_companies,
    coalesce(assigned_sectors, '{}'::text[]),
    assigned_supervisor,
    assigned_supplier
  )
  on conflict (id) do nothing;

  if invitation_confirmed_already then
    update public.invitations
      set accepted_at = now(), accepted_by = new.id
      where id = invitation_id;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  inv record;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select * into inv
      from public.invitations
      where lower(email) = lower(new.email)
        and accepted_at is null
      order by created_at desc
      limit 1;

    if inv.id is not null then
      update public.profiles
        set role = inv.role,
            companies = inv.companies,
            sectors = coalesce(inv.sectors, '{}'::text[]),
            supervisor_id = inv.supervisor_id,
            supplier_id = inv.supplier_id
        where id = new.id;

      update public.invitations
        set accepted_at = now(), accepted_by = new.id
        where id = inv.id;
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_comercial_operator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.current_user_roles() && array['admin','gerente','vendedor']::text[];
$function$
;

CREATE OR REPLACE FUNCTION public.is_comercial_support()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.current_user_roles() && array['suporte']::text[];
$function$
;

CREATE OR REPLACE FUNCTION public.is_own_colaborador(p_colaborador_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.rh_colaboradores
    WHERE id = p_colaborador_id AND profile_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.lead_samples_freeze_created_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.leads_sync_owner_ids()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.owner_ids IS NULL THEN
    NEW.owner_ids := '{}'::text[];
  END IF;
  IF NEW.owner IS NOT NULL AND NOT (NEW.owner = ANY(NEW.owner_ids)) THEN
    NEW.owner_ids := array_append(NEW.owner_ids, NEW.owner);
  END IF;
  IF array_length(NEW.owner_ids, 1) IS NULL AND NEW.owner IS NOT NULL THEN
    NEW.owner_ids := ARRAY[NEW.owner];
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.leads_sync_status_to_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.status := NEW.stage;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.leads_touch_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.last_activity := now();
  IF TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.list_evento_campaigns()
 RETURNS TABLE(id uuid, name text, company_ids text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select c.id, c.name, c.company_ids
  from public.marketing_campaigns c
  where c.channel = 'Evento'
    and (
      current_user_is_admin()
      or current_user_is_marketing()
      or (
        (current_user_roles() && array['vendedor','gerente']::text[])
        and (c.company_ids = '{}'::text[] or c.company_ids && current_user_companies())
      )
    )
  order by c.launch_date desc nulls last;
$function$
;

CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.stage IS NOT NULL THEN
      INSERT INTO public.lead_stage_history
        (lead_id, company_id, from_stage, to_stage, changed_at, changed_by)
      VALUES
        (NEW.id, NEW.company_id, NULL, NEW.stage,
         COALESCE(NEW.stage_changed_at, NEW.created_at, now()),
         NEW.created_by);
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.lead_stage_history
      (lead_id, company_id, from_stage, to_stage, changed_at, changed_by)
    VALUES
      (NEW.id, NEW.company_id, OLD.stage, NEW.stage,
       COALESCE(NEW.stage_changed_at, now()),
       auth.uid());
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_rh_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  domain_name text := TG_ARGV[0];
  stage_col   text := TG_ARGV[1];
  old_stage   text;
  new_stage   text;
BEGIN
  new_stage := to_jsonb(NEW) ->> stage_col;

  IF (TG_OP = 'INSERT') THEN
    IF new_stage IS NOT NULL THEN
      INSERT INTO public.rh_stage_history (domain, record_id, from_stage, to_stage, changed_at, changed_by, custom_fields_snapshot)
      VALUES (domain_name, NEW.id, NULL, new_stage, now(), auth.uid(), to_jsonb(NEW) -> 'custom_fields');
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    old_stage := to_jsonb(OLD) ->> stage_col;
    IF old_stage IS DISTINCT FROM new_stage THEN
      INSERT INTO public.rh_stage_history (domain, record_id, from_stage, to_stage, changed_at, changed_by, custom_fields_snapshot)
      VALUES (domain_name, NEW.id, old_stage, new_stage, now(), auth.uid(), to_jsonb(NEW) -> 'custom_fields');
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.margin_check(p_company_id text, p_product_id uuid, p_price numeric)
 RETURNS TABLE(preco_tabela numeric, margem_pct numeric, aviso_pct numeric, minimo_pct numeric, avisa boolean, bloqueia boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with tabela as (
    select p.preco_tabela from public.products p where p.id = p_product_id
  ),
  regra as (
    select r.margem_aviso_pct, r.margem_minima_pct
    from public.margin_rules r
    where r.company_id = p_company_id
      and r.active
      and (r.product_id = p_product_id or r.product_id is null)
    order by (r.product_id is null)   -- exceção do produto ganha do padrão
    limit 1
  ),
  calc as (
    select t.preco_tabela,
           case when t.preco_tabela is null or t.preco_tabela = 0 then null
                else round((p_price / t.preco_tabela - 1) * 100, 2) end as margem_pct
    from tabela t
  )
  select c.preco_tabela,
         c.margem_pct,
         g.margem_aviso_pct,
         g.margem_minima_pct,
         coalesce(c.margem_pct is not null and g.margem_aviso_pct  is not null and c.margem_pct < g.margem_aviso_pct,  false),
         coalesce(c.margem_pct is not null and g.margem_minima_pct is not null and c.margem_pct < g.margem_minima_pct, false)
  from calc c left join regra g on true;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_budgets_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  -- created_by é de quem criou: não pode ser reescrito depois.
  new.created_by = old.created_by;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_campaigns_sync_owner_ids()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.owner_ids IS NULL THEN
    NEW.owner_ids := '{}'::uuid[];
  END IF;
  IF NEW.owner IS NOT NULL AND NOT (NEW.owner = ANY(NEW.owner_ids)) THEN
    NEW.owner_ids := array_append(NEW.owner_ids, NEW.owner);
  END IF;
  IF array_length(NEW.owner_ids, 1) IS NULL AND NEW.owner IS NOT NULL THEN
    NEW.owner_ids := ARRAY[NEW.owner];
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_campaigns_touch_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.marketing_deliverables_assign_protocol_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'P' || lpad(public.allocate_marketing_protocol_number('deliverable', NEW.id)::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_deliverables_release_protocol_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req_id uuid;
BEGIN
  IF OLD.request_number IS NOT NULL THEN
    SELECT id INTO v_req_id
    FROM public.marketing_requests
    WHERE request_number = OLD.request_number
    LIMIT 1;
  END IF;

  IF v_req_id IS NOT NULL THEN
    UPDATE public.marketing_protocol_numbers
    SET source = 'marketing_request', record_id = v_req_id
    WHERE source = 'deliverable' AND record_id = OLD.id;
  ELSE
    DELETE FROM public.marketing_protocol_numbers
    WHERE source = 'deliverable' AND record_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_deliverables_sync_assignee_ids()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.assignee_ids IS NULL THEN
    NEW.assignee_ids := '{}'::uuid[];
  END IF;
  IF NEW.assignee IS NOT NULL AND NOT (NEW.assignee = ANY(NEW.assignee_ids)) THEN
    NEW.assignee_ids := array_append(NEW.assignee_ids, NEW.assignee);
  END IF;
  IF array_length(NEW.assignee_ids, 1) IS NULL AND NEW.assignee IS NOT NULL THEN
    NEW.assignee_ids := ARRAY[NEW.assignee];
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_deliverables_sync_protocol_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_num integer;
BEGIN
  IF NEW.request_number IS DISTINCT FROM OLD.request_number THEN
    v_num := NULLIF(regexp_replace(coalesce(NEW.request_number, ''), '\D', '', 'g'), '')::integer;
    IF v_num IS NULL OR v_num <= 0 OR v_num >= 1000000 THEN
      RAISE EXCEPTION 'Número de protocolo inválido (use um valor entre 1 e 999999): %', NEW.request_number;
    END IF;
    UPDATE public.marketing_protocol_numbers
    SET number = v_num
    WHERE source = 'deliverable' AND record_id = NEW.id;
    IF NOT FOUND THEN
      INSERT INTO public.marketing_protocol_numbers (number, source, record_id)
      VALUES (v_num, 'deliverable', NEW.id);
    END IF;
    NEW.request_number := 'P' || lpad(v_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_expense_items_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_expense_items_sync_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_expense_id uuid := coalesce(NEW.expense_id, OLD.expense_id);
  v_total numeric;
BEGIN
  SELECT coalesce(sum(quantity * unit_value), 0) INTO v_total
  FROM public.marketing_expense_items
  WHERE expense_id = v_expense_id;

  UPDATE public.marketing_expenses SET amount = v_total WHERE id = v_expense_id;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_guard_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.stage IN ('solicitado', 'cotacao') AND NEW.stage IN ('aprovado', 'rejeitado')
     AND NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    NEW.stage := OLD.stage;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejected_reason := OLD.rejected_reason;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_notify_new()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.stage <> 'solicitado' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT p.id, 'purchase_request_created',
         'Nova solicitação de compra',
         NEW.item_name || ' (' || NEW.request_number || ')'
           || CASE WHEN NEW.requester_name IS NOT NULL THEN ' — solicitado por ' || NEW.requester_name ELSE '' END,
         jsonb_build_object('module', 'purchase_requests', 'id', NEW.id),
         NEW.requested_by
  FROM public.profiles p
  WHERE p.mention_notifications_enabled = true
    AND p.id IS DISTINCT FROM NEW.requested_by
    AND p.roles && ARRAY['marketing','gerente_marketing','admin']::text[];

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_require_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.stage = 'pago' AND (NEW.invoice_url IS NULL OR NEW.invoice_url = '') THEN
    RAISE EXCEPTION 'Compra só pode ser marcada como paga com nota fiscal anexada.';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_sync_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_expense_id uuid;
BEGIN
  IF NEW.stage = 'pago' AND OLD.stage IS DISTINCT FROM 'pago' AND NEW.expense_id IS NULL THEN
    INSERT INTO public.marketing_expenses (
      company_ids, description, category, amount, status, due_date,
      invoice_date, notes, receipt_url, created_by
    )
    VALUES (
      coalesce(NEW.company_ids, '{}'),
      NEW.item_name || coalesce(' — ' || NEW.request_number, ''),
      'Compra de Marketing',
      coalesce(NEW.total_value, 0),
      'pago',
      -- Sem data a despesa sumiria do painel de orçamento sem aviso; a data
      -- do pagamento é o último recurso honesto.
      coalesce(NEW.due_date, NEW.invoice_date, current_date),
      NEW.invoice_date,
      concat_ws(E'\n', 'Origem: compra ' || NEW.request_number, NEW.description),
      NEW.invoice_url,
      NEW.responsible_id
    )
    RETURNING id INTO v_expense_id;

    UPDATE public.marketing_purchase_requests
    SET expense_id = v_expense_id
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_sync_responsible_ids()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.responsible_ids IS NULL THEN
    NEW.responsible_ids := '{}'::uuid[];
  END IF;
  IF NEW.responsible_id IS NOT NULL AND NOT (NEW.responsible_id = ANY(NEW.responsible_ids)) THEN
    NEW.responsible_ids := array_append(NEW.responsible_ids, NEW.responsible_id);
  END IF;
  IF array_length(NEW.responsible_ids, 1) IS NULL AND NEW.responsible_id IS NOT NULL THEN
    NEW.responsible_ids := ARRAY[NEW.responsible_id];
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_quotes_guard_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status IN ('aprovada', 'rejeitada')
     AND NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
    NEW.status := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.rejected_reason := OLD.rejected_reason;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_requests_assign_protocol_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'P' || lpad(public.allocate_marketing_protocol_number('marketing_request', NEW.id)::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_requests_release_protocol_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.marketing_protocol_numbers
  WHERE source = 'marketing_request' AND record_id = OLD.id;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_requests_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_requests_sync_protocol_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_num integer;
BEGIN
  IF NEW.request_number IS DISTINCT FROM OLD.request_number THEN
    v_num := NULLIF(regexp_replace(coalesce(NEW.request_number, ''), '\D', '', 'g'), '')::integer;
    IF v_num IS NULL OR v_num <= 0 OR v_num >= 1000000 THEN
      RAISE EXCEPTION 'Número de protocolo inválido (use um valor entre 1 e 999999): %', NEW.request_number;
    END IF;
    UPDATE public.marketing_protocol_numbers
    SET number = v_num
    WHERE source = 'marketing_request' AND record_id = NEW.id;
    IF NOT FOUND THEN
      INSERT INTO public.marketing_protocol_numbers (number, source, record_id)
      VALUES (v_num, 'marketing_request', NEW.id);
    END IF;
    NEW.request_number := 'P' || lpad(v_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marketing_tasks_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mc_set_checklist(p_campaign_id uuid, p_checklist jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF user_role NOT IN ('admin','marketing','gerente_marketing','agencia') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.marketing_campaigns
  SET approval_checklist = p_checklist
  WHERE id = p_campaign_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notifications_cascade_delete_by_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.notifications
  WHERE link ->> 'module' = TG_ARGV[0]
    AND link ->> 'id' = OLD.id::text;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.orders_guard_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.situacao is not distinct from old.situacao then
    return new;
  end if;

  -- Trava do Kronosys. Vale por qualquer caminho, não só pelo botão.
  if new.situacao in ('confirmado','producao','faturado')
     and coalesce(trim(new.kronosys_numero), '') = '' then
    raise exception 'Informe o número do pedido no Kronosys antes de confirmar. Sem ele, o cliente vê "confirmado" no portal sem nada por trás no ERP.'
      using errcode = 'check_violation';
  end if;

  -- Carimbo de confirmação: quem e quando. Preenchido pelo banco pra não
  -- depender de a tela lembrar de mandar.
  if new.situacao = 'confirmado' and old.situacao <> 'confirmado' then
    new.confirmed_by := coalesce(new.confirmed_by, auth.uid());
    new.confirmed_at := coalesce(new.confirmed_at, now());
  end if;

  insert into public.order_stage_history (order_id, de, para, moved_by)
  values (new.id, old.situacao, new.situacao, auth.uid());

  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.personal_task_checklists_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.personal_task_stages_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.personal_tasks_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pesquisa_respostas_aggregado(p_pesquisa_id uuid)
 RETURNS TABLE(total bigint, respostas jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN QUERY
    SELECT count(*)::bigint, coalesce(jsonb_agg(r.respostas), '[]'::jsonb)
    FROM public.rh_pesquisa_respostas r
    WHERE r.pesquisa_id = p_pesquisa_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.posvenda_cases_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.products_enforce_field_ownership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_roles text[];
  v_full  boolean;
begin
  select coalesce(roles,'{}'::text[]) into v_roles from public.profiles where id = auth.uid();
  v_full := v_roles && array['admin','gerente']::text[];
  if v_full then return new; end if;

  -- Marketing não mexe no comercial.
  if not (v_roles && array['suporte']::text[]) then
    new.sku          := old.sku;
    new.unit         := old.unit;
    new.moq          := old.moq;
    new.preco_tabela := old.preco_tabela;
    new.certifications := old.certifications;
    new.homologado   := old.homologado;
    new.active       := old.active;
    new.company_id   := old.company_id;
  end if;

  -- Suporte não mexe na vitrine.
  if not (v_roles && array['marketing','gerente_marketing']::text[]) then
    new.tagline      := old.tagline;
    new.description  := old.description;
    new.features     := old.features;
    new.specs        := old.specs;
    new.applications := old.applications;
    new.category     := old.category;
    new.icon         := old.icon;
    new.proposed     := old.proposed;
  end if;

  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.profile_secrets_ensure_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profile_secrets (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.profiles_prevent_self_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() = NEW.id AND NOT current_user_is_admin() THEN
    NEW.role := OLD.role;
    NEW.roles := OLD.roles;
    NEW.companies := OLD.companies;
    NEW.sectors := OLD.sectors;
    NEW.supervisor_id := OLD.supervisor_id;
    NEW.employee_status := OLD.employee_status;
    NEW.job_title := OLD.job_title;
    NEW.department := OLD.department;
    NEW.contract_type := OLD.contract_type;
    NEW.admission_date := OLD.admission_date;
    NEW.frente := OLD.frente;
    NEW.supplier_id := OLD.supplier_id;
    NEW.client_id := OLD.client_id;
    NEW.chat_enabled := OLD.chat_enabled;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.profiles_sync_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.roles IS NULL THEN
    NEW.roles := '{}'::text[];
  END IF;
  IF NEW.role IS NOT NULL AND NOT (NEW.role = ANY(NEW.roles)) THEN
    NEW.roles := array_append(NEW.roles, NEW.role);
  END IF;
  IF array_length(NEW.roles, 1) IS NULL THEN
    NEW.roles := ARRAY[NEW.role];
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.proposal_line_items_sync_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_proposal_id uuid := coalesce(new.proposal_id, old.proposal_id);
  v_total numeric;
begin
  select coalesce(sum(quantity * unit_price), 0) into v_total
  from public.proposal_line_items
  where proposal_id = v_proposal_id;

  update public.proposals set total_value = v_total where id = v_proposal_id;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalc_order_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_order uuid;
begin
  v_order := coalesce(new.order_id, old.order_id);
  update public.orders o
  set total = coalesce((select sum(i.quantidade * i.preco_unitario) from public.order_items i where i.order_id = v_order), 0),
      updated_at = now()
  where o.id = v_order;
  return null;
end; $function$
;

CREATE OR REPLACE FUNCTION public.reject_marketing_quote(p_quote_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS marketing_supplier_quotes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_supplier_quotes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar cotações';
  END IF;

  SELECT * INTO v_row FROM public.marketing_supplier_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Cotação já foi decidida';
  END IF;

  UPDATE public.marketing_supplier_quotes
  SET status = 'rejeitada', approved_by = v_uid, approved_at = now(), rejected_reason = p_reason
  WHERE id = p_quote_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_purchase_request(p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS marketing_purchase_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_purchase_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar solicitações de compra';
  END IF;

  SELECT * INTO v_row FROM public.marketing_purchase_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.stage NOT IN ('solicitado', 'cotacao') THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.marketing_purchase_requests
  SET stage = 'rejeitado', approved_by = v_uid, approved_at = now(), rejected_reason = p_reason,
      activities = coalesce(v_row.activities, '[]'::jsonb) || jsonb_build_object(
        'type', 'stage_change',
        'description', CASE WHEN p_reason IS NOT NULL THEN 'Rejeitado: ' || p_reason ELSE 'Rejeitado' END,
        'at', now()
      )
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
    SELECT v_row.requested_by, 'purchase_request_rejected',
           'Sua solicitação de compra foi rejeitada',
           v_row.item_name || ' (' || v_row.request_number || ')',
           jsonb_build_object('module', 'purchase_requests', 'id', v_row.id),
           v_uid
    WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = v_row.requested_by AND mention_notifications_enabled = true);
  END IF;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_rh_data_update_request(p_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS rh_data_update_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.rh_data_update_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')) THEN
    RAISE EXCEPTION 'Apenas RH pode recusar solicitações de atualização';
  END IF;

  SELECT * INTO v_row FROM public.rh_data_update_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.rh_data_update_requests
  SET status = 'recusado', reviewed_by = v_uid, reviewed_at = now(), motivo_recusa = p_motivo
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_rh_movimentacao(p_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS rh_movimentacoes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.rh_movimentacoes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Apenas a diretoria pode recusar movimentações';
  END IF;

  SELECT * INTO v_row FROM public.rh_movimentacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Movimentação já foi decidida';
  END IF;

  UPDATE public.rh_movimentacoes
  SET status = 'recusado', approved_by = v_uid, approved_at = now(), status_changed_at = now(), motivo_recusa = p_motivo
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rh_avaliacoes_sync_evaluator_ids()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.evaluator_ids IS NULL THEN
    NEW.evaluator_ids := '{}'::uuid[];
  END IF;
  IF NEW.evaluator_id IS NOT NULL AND NOT (NEW.evaluator_id = ANY(NEW.evaluator_ids)) THEN
    NEW.evaluator_ids := array_append(NEW.evaluator_ids, NEW.evaluator_id);
  END IF;
  IF array_length(NEW.evaluator_ids, 1) IS NULL AND NEW.evaluator_id IS NOT NULL THEN
    NEW.evaluator_ids := ARRAY[NEW.evaluator_id];
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rh_candidato_exists(p_candidate_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.rh_candidatos WHERE id = p_candidate_id);
$function$
;

CREATE OR REPLACE FUNCTION public.rh_curriculo_folder_object_count(p_folder text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(*)::int FROM storage.objects
  WHERE bucket_id = 'rh-curriculos' AND (storage.foldername(name))[1] = p_folder;
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.rh_movimentacoes_guard_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Só a diretoria (=admin) muda o status pra decidido. Qualquer outro que
  -- tentar mexer no status via UPDATE direto tem a troca revertida.
  IF OLD.status = 'pendente' AND NEW.status IN ('aprovado','recusado')
     AND NOT current_user_is_admin() THEN
    NEW.status := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.motivo_recusa := OLD.motivo_recusa;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rh_onboarding_tarefas_guard_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if is_own_colaborador(old.colaborador_id) and not exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = any(array['admin','gerente_rh','rh'])
  ) then
    if new.responsavel_ids is distinct from old.responsavel_ids
       or new.data_limite is distinct from old.data_limite
       or new.titulo is distinct from old.titulo
       or new.colaborador_id is distinct from old.colaborador_id
       or new.template_id is distinct from old.template_id then
      raise exception 'colaborador só pode alterar o status da própria tarefa de onboarding';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rh_submit_self_rating(p_avaliacao_id uuid, p_self_rating numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_self_rating IS NOT NULL AND (p_self_rating < 0 OR p_self_rating > 10) THEN
    RAISE EXCEPTION 'Nota deve estar entre 0 e 10';
  END IF;

  UPDATE public.rh_avaliacoes a
  SET self_rating = p_self_rating, updated_at = now()
  WHERE a.id = p_avaliacao_id
    AND EXISTS (
      SELECT 1 FROM public.rh_colaboradores c
      WHERE c.id = a.user_id AND c.profile_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada ou não pertence a você';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sales_cases_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_vaga_approved_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.approved_at IS NULL AND NEW.stage IS DISTINCT FROM 'rascunho' THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_bemestar_agendamento(p_sessao_id uuid, p_horario time without time zone, p_nome text, p_ramal text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_whatsapp text DEFAULT NULL::text, p_frente text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, senha integer, horario time without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sessao record;
  v_senha int;
  v_recent int;
  v_ja_ocupado boolean;
  v_novo_id uuid;
BEGIN
  IF coalesce(trim(p_nome), '') = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF coalesce(trim(p_email), '') = '' AND coalesce(trim(p_whatsapp), '') = '' THEN
    RAISE EXCEPTION 'Informe e-mail ou WhatsApp pra receber a confirmação';
  END IF;
  IF p_frente IS NOT NULL AND btrim(p_frente) <> '' AND btrim(p_frente) NOT IN ('sanwey','resibag','montemor') THEN
    RAISE EXCEPTION 'Unidade inválida';
  END IF;

  SELECT * INTO v_sessao FROM public.rh_bemestar_sessoes WHERE id = p_sessao_id AND status = 'aberta';
  IF v_sessao.id IS NULL THEN RAISE EXCEPTION 'Sessão não está aberta'; END IF;
  IF p_horario IS NULL OR p_horario < v_sessao.horario_inicio OR p_horario >= v_sessao.horario_fim THEN
    RAISE EXCEPTION 'Horário fora da janela de atendimento';
  END IF;

  SELECT count(*) INTO v_recent FROM public.rh_bemestar_fila
  WHERE sessao_id = p_sessao_id AND created_at > now() - interval '2 minutes';
  IF v_recent >= 60 THEN RAISE EXCEPTION 'Muitas entradas no momento. Tente novamente em instantes.'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rh_bemestar_' || p_sessao_id::text || p_horario::text));
  SELECT EXISTS (
    SELECT 1 FROM public.rh_bemestar_fila WHERE sessao_id = p_sessao_id AND horario = p_horario AND status <> 'faltou'
  ) INTO v_ja_ocupado;
  IF v_ja_ocupado THEN RAISE EXCEPTION 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.'; END IF;

  SELECT coalesce(max(f.senha), 0) + 1 INTO v_senha FROM public.rh_bemestar_fila f WHERE f.sessao_id = p_sessao_id;

  INSERT INTO public.rh_bemestar_fila (sessao_id, senha, nome, frente, horario, ramal, email, whatsapp)
  VALUES (p_sessao_id, v_senha, trim(p_nome), nullif(btrim(coalesce(p_frente, '')), ''), p_horario,
          nullif(trim(coalesce(p_ramal, '')), ''), nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_whatsapp, '')), ''))
  RETURNING rh_bemestar_fila.id INTO v_novo_id;

  RETURN QUERY SELECT v_novo_id, v_senha, p_horario;
END;
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.submit_lead_capture(p_company_id text, p_customer_name text, p_contact_phone text, p_contact_email text DEFAULT NULL::text, p_product_interest text DEFAULT NULL::text, p_priority text DEFAULT NULL::text, p_prospect_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_source text DEFAULT 'site'::text)
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
$function$
;

CREATE OR REPLACE FUNCTION public.submit_marketing_request(p_category text, p_title text, p_requester_name text, p_requester_email text DEFAULT NULL::text, p_department text DEFAULT NULL::text, p_request_type text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_priority text DEFAULT 'media'::text, p_deadline date DEFAULT NULL::date, p_company_ids text[] DEFAULT NULL::text[], p_budget numeric DEFAULT NULL::numeric, p_approver_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_company_ids text[];
  v_recent_email_count int;
  v_recent_total_count int;
BEGIN
  IF p_category NOT IN ('material', 'compra') THEN
    RAISE EXCEPTION 'Categoria inválida';
  END IF;
  IF coalesce(trim(p_requester_name), '') = '' OR length(trim(p_requester_name)) < 2 THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;
  IF p_category = 'compra' THEN
    IF coalesce(trim(p_title), '') = '' OR length(trim(p_title)) < 2 THEN
      RAISE EXCEPTION 'Descreva o que você precisa comprar';
    END IF;
  ELSE
    IF coalesce(trim(p_department), '') = '' THEN
      RAISE EXCEPTION 'Departamento é obrigatório';
    END IF;
    IF coalesce(trim(p_request_type), '') = '' THEN
      RAISE EXCEPTION 'Tipo de material é obrigatório';
    END IF;
    IF coalesce(trim(p_title), '') = '' OR length(trim(p_title)) < 3 THEN
      RAISE EXCEPTION 'Título da solicitação é obrigatório';
    END IF;
  END IF;
  IF p_requester_email IS NOT NULL AND btrim(p_requester_email) <> ''
     AND btrim(p_requester_email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;
  IF p_priority NOT IN ('alta', 'media', 'baixa') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  v_company_ids := coalesce(p_company_ids, '{}');
  IF array_length(v_company_ids, 1) IS NULL THEN
    v_company_ids := ARRAY['industria', 'resibag', 'montemor'];
  END IF;
  IF NOT (v_company_ids <@ ARRAY['industria', 'resibag', 'montemor']) THEN
    RAISE EXCEPTION 'Empresa inválida';
  END IF;

  -- Teto estreito por identidade (só quando e-mail foi informado — campo é
  -- opcional neste form, diferente dos formulários de RH).
  IF p_requester_email IS NOT NULL AND btrim(p_requester_email) <> '' THEN
    SELECT count(*) INTO v_recent_email_count
    FROM public.marketing_requests
    WHERE lower(requester_email) = lower(btrim(p_requester_email))
      AND created_at > now() - interval '24 hours';
    IF v_recent_email_count >= 5 THEN
      RAISE EXCEPTION 'Muitas solicitações deste e-mail. Tente novamente mais tarde.';
    END IF;
  END IF;

  -- Circuit-breaker global — não existia nenhum teto de volume antes.
  SELECT count(*) INTO v_recent_total_count
  FROM public.marketing_requests
  WHERE created_at > now() - interval '10 minutes';
  IF v_recent_total_count >= 100 THEN
    RAISE EXCEPTION 'Muitas solicitações no momento. Tente novamente em alguns minutos.';
  END IF;

  INSERT INTO public.marketing_requests (
    category, title, requester_name, requester_email, department, request_type,
    description, priority, deadline, company_ids, budget, approver_name, status
  ) VALUES (
    p_category, trim(p_title), trim(p_requester_name),
    NULLIF(btrim(coalesce(p_requester_email, '')), ''),
    CASE WHEN p_category = 'material' THEN p_department ELSE NULL END,
    CASE WHEN p_category = 'material' THEN p_request_type ELSE NULL END,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    CASE WHEN p_category = 'material' THEN p_priority ELSE 'media' END,
    p_deadline, v_company_ids,
    CASE WHEN p_category = 'material' THEN p_budget ELSE NULL END,
    CASE WHEN p_category = 'material' THEN NULLIF(trim(coalesce(p_approver_name, '')), '') ELSE NULL END,
    'pendente'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_pesquisa_resposta(p_pesquisa_id uuid, p_respostas jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_modo text;
  v_uid uuid := auth.uid();
  v_recent int;
  v_ja_respondeu boolean;
BEGIN
  SELECT modo INTO v_modo FROM public.rh_pesquisas
  WHERE id = p_pesquisa_id AND status = 'aberta'
    AND (abre_em IS NULL OR abre_em <= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
    AND (fecha_em IS NULL OR fecha_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  IF v_modo IS NULL THEN RAISE EXCEPTION 'Pesquisa não está aberta'; END IF;

  IF v_modo = 'identificada' THEN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Você precisa estar logado na plataforma para responder esta pesquisa.'; END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.rh_pesquisa_respostas WHERE pesquisa_id = p_pesquisa_id AND respondente_id = v_uid
    ) INTO v_ja_respondeu;
    IF v_ja_respondeu THEN RAISE EXCEPTION 'Você já respondeu esta pesquisa.'; END IF;

    INSERT INTO public.rh_pesquisa_respostas (pesquisa_id, respostas, respondente_id)
    VALUES (p_pesquisa_id, coalesce(p_respostas, '{}'::jsonb), v_uid);
    RETURN true;
  END IF;

  SELECT count(*) INTO v_recent FROM public.rh_pesquisa_respostas
  WHERE pesquisa_id = p_pesquisa_id AND created_at > now() - interval '10 minutes';
  IF v_recent >= 200 THEN RAISE EXCEPTION 'Muitas respostas no momento. Tente novamente em instantes.'; END IF;

  INSERT INTO public.rh_pesquisa_respostas (pesquisa_id, respostas)
  VALUES (p_pesquisa_id, coalesce(p_respostas, '{}'::jsonb));
  RETURN true;
END;
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_profile_to_colaborador()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.roles && array['agencia','cliente','fornecedor','portal']::text[] then
    return new;
  end if;
  insert into public.rh_colaboradores (profile_id, full_name, email, employee_status, frente)
  values (new.id, new.name, new.email, 'ativo', new.frente)
  on conflict (profile_id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at_deliverables()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at_expenses()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.uniform_can_write()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select current_user_is_admin() or current_user_is_marketing() or current_user_is_rh();
$function$
;

CREATE OR REPLACE FUNCTION public.uniform_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin new.updated_at := now(); return new; end $function$
;

CREATE OR REPLACE FUNCTION public.update_agent_actions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_rh_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_domain text;
  v_stage text;
begin
  if tg_table_name = 'rh_vagas' then
    v_domain := 'vagas'; v_stage := new.stage;
  elsif tg_table_name = 'rh_aplicacoes' then
    v_domain := 'candidatos'; v_stage := new.etapa_pipeline;
  elsif tg_table_name = 'rh_colaboradores' then
    v_domain := 'onboarding'; v_stage := new.onboarding_stage;
  elsif tg_table_name = 'rh_avaliacoes' then
    v_domain := 'feedback'; v_stage := new.status;
  elsif tg_table_name = 'rh_ferias' then
    v_domain := 'ferias'; v_stage := new.status;
  elsif tg_table_name = 'rh_treinamento_atribuicoes' then
    v_domain := 'treinamentos'; v_stage := new.status;
  elsif tg_table_name = 'bug_reports' then
    v_domain := 'bugs'; v_stage := new.stage;
  end if;

  if v_stage is not null and not exists (
    select 1 from public.rh_pipeline_stages where domain = v_domain and stage_key = v_stage
  ) then
    raise exception 'Etapa "%" inválida para %', v_stage, v_domain;
  end if;

  return new;
end;
$function$
;

-- ============ CONSTRAINTS ============
ALTER TABLE public.activities ADD CONSTRAINT activities_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_pkey PRIMARY KEY (id);
ALTER TABLE public.automations ADD CONSTRAINT automations_pkey PRIMARY KEY (id);
ALTER TABLE public.bug_reports ADD CONSTRAINT bug_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_pkey PRIMARY KEY (channel_id, user_id);
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.chat_stickers ADD CONSTRAINT chat_stickers_pkey PRIMARY KEY (id);
ALTER TABLE public.client_addresses ADD CONSTRAINT client_addresses_pkey PRIMARY KEY (id);
ALTER TABLE public.client_billing_history ADD CONSTRAINT client_billing_history_pkey PRIMARY KEY (id);
ALTER TABLE public.client_contacts ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.client_products ADD CONSTRAINT client_products_pkey PRIMARY KEY (client_id, product_id);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.comex_export_operations ADD CONSTRAINT comex_export_operations_pkey PRIMARY KEY (id);
ALTER TABLE public.comex_import_operations ADD CONSTRAINT comex_import_operations_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_viagem_categorias ADD CONSTRAINT crm_viagem_categorias_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_viagem_despesas ADD CONSTRAINT crm_viagem_despesas_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_viagem_prestacoes ADD CONSTRAINT crm_viagem_prestacoes_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_pkey PRIMARY KEY (id);
ALTER TABLE public.deliverable_checklists ADD CONSTRAINT deliverable_checklists_pkey PRIMARY KEY (id);
ALTER TABLE public.document_library ADD CONSTRAINT document_library_pkey PRIMARY KEY (id);
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.esg_emission_factors ADD CONSTRAINT esg_emission_factors_pkey PRIMARY KEY (id);
ALTER TABLE public.esg_emission_records ADD CONSTRAINT esg_emission_records_pkey PRIMARY KEY (id);
ALTER TABLE public.esg_reports ADD CONSTRAINT esg_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.export_audit_log ADD CONSTRAINT export_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.external_cache ADD CONSTRAINT external_cache_pkey PRIMARY KEY (cache_key);
ALTER TABLE public.invitations ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_attachments ADD CONSTRAINT lead_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_captures ADD CONSTRAINT lead_captures_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_checklists ADD CONSTRAINT lead_checklists_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_document_refs ADD CONSTRAINT lead_document_refs_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_emails ADD CONSTRAINT lead_emails_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_samples ADD CONSTRAINT lead_samples_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_stage_history ADD CONSTRAINT lead_stage_history_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.margin_rules ADD CONSTRAINT margin_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.market_intelligence_items ADD CONSTRAINT market_intelligence_items_pkey PRIMARY KEY (id);
ALTER TABLE public.market_signals ADD CONSTRAINT market_signals_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_budgets ADD CONSTRAINT marketing_budgets_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_campaign_attachments ADD CONSTRAINT marketing_campaign_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_deliverable_attachments ADD CONSTRAINT marketing_deliverable_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_deliverables ADD CONSTRAINT marketing_deliverables_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_expense_deliverables ADD CONSTRAINT marketing_expense_deliverables_pkey PRIMARY KEY (expense_id, deliverable_id);
ALTER TABLE public.marketing_expense_items ADD CONSTRAINT marketing_expense_items_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_expense_tasks ADD CONSTRAINT marketing_expense_tasks_pkey PRIMARY KEY (expense_id, task_id);
ALTER TABLE public.marketing_expenses ADD CONSTRAINT marketing_expenses_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_protocol_numbers ADD CONSTRAINT marketing_protocol_numbers_pkey PRIMARY KEY (number);
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_quote_email_template ADD CONSTRAINT marketing_quote_email_template_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_supplier_quotes ADD CONSTRAINT marketing_supplier_quotes_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_suppliers ADD CONSTRAINT marketing_suppliers_pkey PRIMARY KEY (id);
ALTER TABLE public.marketing_tasks ADD CONSTRAINT marketing_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.module_states ADD CONSTRAINT module_states_pkey PRIMARY KEY (module_id);
ALTER TABLE public.ncm_catalog ADD CONSTRAINT ncm_catalog_pkey PRIMARY KEY (code);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE public.order_stage_history ADD CONSTRAINT order_stage_history_pkey PRIMARY KEY (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_events ADD CONSTRAINT personal_events_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_task_attachments ADD CONSTRAINT personal_task_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_task_automations ADD CONSTRAINT personal_task_automations_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_task_checklists ADD CONSTRAINT personal_task_checklists_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_task_dependencies ADD CONSTRAINT personal_task_dependencies_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_task_stage_fields ADD CONSTRAINT personal_task_stage_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_task_stages ADD CONSTRAINT personal_task_stages_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_task_tags ADD CONSTRAINT personal_task_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_tasks ADD CONSTRAINT personal_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.personal_tasks_api_keys ADD CONSTRAINT personal_tasks_api_keys_pkey PRIMARY KEY (id);
ALTER TABLE public.pipeline_stage_fields ADD CONSTRAINT pipeline_stage_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.pipeline_stage_transitions ADD CONSTRAINT pipeline_stage_transitions_pkey PRIMARY KEY (id);
ALTER TABLE public.posvenda_cases ADD CONSTRAINT posvenda_cases_pkey PRIMARY KEY (id);
ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE public.profile_module_overrides ADD CONSTRAINT profile_module_overrides_pkey PRIMARY KEY (id);
ALTER TABLE public.profile_secrets ADD CONSTRAINT profile_secrets_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.proposal_line_items ADD CONSTRAINT proposal_line_items_pkey PRIMARY KEY (id);
ALTER TABLE public.proposals ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);
ALTER TABLE public.prospect_seeds ADD CONSTRAINT prospect_seeds_pkey PRIMARY KEY (id);
ALTER TABLE public.rapp_cargas ADD CONSTRAINT rapp_cargas_pkey PRIMARY KEY (id);
ALTER TABLE public.rapp_ibama ADD CONSTRAINT rapp_ibama_pkey PRIMARY KEY (id);
ALTER TABLE public.record_views ADD CONSTRAINT record_views_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_aplicacoes ADD CONSTRAINT rh_aplicacoes_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_attachments ADD CONSTRAINT rh_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_bemestar_fila ADD CONSTRAINT rh_bemestar_fila_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_bemestar_sessoes ADD CONSTRAINT rh_bemestar_sessoes_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_beneficios_catalogo ADD CONSTRAINT rh_beneficios_catalogo_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_candidatos ADD CONSTRAINT rh_candidatos_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_cargo_templates ADD CONSTRAINT rh_cargo_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_checklists ADD CONSTRAINT rh_checklists_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_colaborador_beneficios ADD CONSTRAINT rh_colaborador_beneficios_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_curriculo_upload_tokens ADD CONSTRAINT rh_curriculo_upload_tokens_pkey PRIMARY KEY (token);
ALTER TABLE public.rh_data_update_requests ADD CONSTRAINT rh_data_update_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_ferias ADD CONSTRAINT rh_ferias_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_fornecedor_contrato_eventos ADD CONSTRAINT rh_fornecedor_contrato_eventos_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_fornecedor_contratos ADD CONSTRAINT rh_fornecedor_contratos_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_fornecedores ADD CONSTRAINT rh_fornecedores_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_movimentacoes ADD CONSTRAINT rh_movimentacoes_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_onboarding_tarefas ADD CONSTRAINT rh_onboarding_tarefas_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_onboarding_templates ADD CONSTRAINT rh_onboarding_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_pesquisa_respostas ADD CONSTRAINT rh_pesquisa_respostas_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_pesquisas ADD CONSTRAINT rh_pesquisas_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_pipeline_stage_fields ADD CONSTRAINT rh_pipeline_stage_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_pipeline_stages ADD CONSTRAINT rh_pipeline_stages_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_report_presets ADD CONSTRAINT rh_report_presets_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_signature_requests ADD CONSTRAINT rh_signature_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_stage_history ADD CONSTRAINT rh_stage_history_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_treinamento_atribuicoes ADD CONSTRAINT rh_treinamento_atribuicoes_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_treinamentos ADD CONSTRAINT rh_treinamentos_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_vaga_manager_links ADD CONSTRAINT rh_vaga_manager_links_pkey PRIMARY KEY (id);
ALTER TABLE public.rh_vagas ADD CONSTRAINT rh_vagas_pkey PRIMARY KEY (id);
ALTER TABLE public.sales_cases ADD CONSTRAINT sales_cases_pkey PRIMARY KEY (id);
ALTER TABLE public.terms_acceptances ADD CONSTRAINT terms_acceptances_pkey PRIMARY KEY (id);
ALTER TABLE public.uniform_items ADD CONSTRAINT uniform_items_pkey PRIMARY KEY (id);
ALTER TABLE public.uniform_people ADD CONSTRAINT uniform_people_pkey PRIMARY KEY (id);
ALTER TABLE public.uniform_person_sizes ADD CONSTRAINT uniform_person_sizes_pkey PRIMARY KEY (id);
ALTER TABLE public.uniform_round_lines ADD CONSTRAINT uniform_round_lines_pkey PRIMARY KEY (id);
ALTER TABLE public.uniform_rounds ADD CONSTRAINT uniform_rounds_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.client_billing_history ADD CONSTRAINT client_billing_history_client_id_year_key UNIQUE (client_id, year);
ALTER TABLE public.crm_viagem_categorias ADD CONSTRAINT crm_viagem_categorias_nome_key UNIQUE (nome);
ALTER TABLE public.lead_document_refs ADD CONSTRAINT lead_document_refs_lead_id_document_library_id_key UNIQUE (lead_id, document_library_id);
ALTER TABLE public.marketing_protocol_numbers ADD CONSTRAINT marketing_protocol_numbers_source_record_id_key UNIQUE (source, record_id);
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_number_key UNIQUE (request_number);
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_request_number_key UNIQUE (request_number);
ALTER TABLE public.orders ADD CONSTRAINT orders_numero_key UNIQUE (numero);
ALTER TABLE public.personal_task_dependencies ADD CONSTRAINT personal_task_dependencies_task_id_depends_on_id_key UNIQUE (task_id, depends_on_id);
ALTER TABLE public.personal_task_stage_fields ADD CONSTRAINT personal_task_stage_fields_user_id_stage_key_field_key_key UNIQUE (user_id, stage_key, field_key);
ALTER TABLE public.personal_task_stages ADD CONSTRAINT personal_task_stages_user_id_stage_key_key UNIQUE (user_id, stage_key);
ALTER TABLE public.personal_task_tags ADD CONSTRAINT personal_task_tags_user_id_label_key UNIQUE (user_id, label);
ALTER TABLE public.personal_tasks_api_keys ADD CONSTRAINT personal_tasks_api_keys_key_hash_key UNIQUE (key_hash);
ALTER TABLE public.pipeline_stage_fields ADD CONSTRAINT pipeline_stage_fields_company_id_stage_id_field_key_key UNIQUE (company_id, stage_id, field_key);
ALTER TABLE public.pipeline_stage_transitions ADD CONSTRAINT pipeline_stage_transitions_domain_company_id_from_stage_key_key UNIQUE (domain, company_id, from_stage_key, to_stage_key);
ALTER TABLE public.products ADD CONSTRAINT products_company_id_sku_key UNIQUE (company_id, sku);
ALTER TABLE public.profile_module_overrides ADD CONSTRAINT profile_module_overrides_user_id_module_id_key UNIQUE (user_id, module_id);
ALTER TABLE public.prospect_seeds ADD CONSTRAINT prospect_seeds_cnpj_key UNIQUE (cnpj);
ALTER TABLE public.record_views ADD CONSTRAINT record_views_unique UNIQUE (user_id, module, record_id);
ALTER TABLE public.rh_aplicacoes ADD CONSTRAINT rh_aplicacoes_candidate_id_vaga_id_key UNIQUE (candidate_id, vaga_id);
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_user_tipo_period_key UNIQUE (user_id, tipo, period_start);
ALTER TABLE public.rh_bemestar_fila ADD CONSTRAINT rh_bemestar_fila_sessao_id_senha_key UNIQUE (sessao_id, senha);
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_profile_id_key UNIQUE (profile_id);
ALTER TABLE public.rh_pipeline_stage_fields ADD CONSTRAINT rh_pipeline_stage_fields_domain_company_stage_field_key UNIQUE (domain, company_id, stage_key, field_key);
ALTER TABLE public.rh_pipeline_stages ADD CONSTRAINT rh_pipeline_stages_domain_company_stage_key UNIQUE (domain, company_id, stage_key);
ALTER TABLE public.rh_signature_requests ADD CONSTRAINT rh_signature_requests_d4sign_document_uuid_key UNIQUE (d4sign_document_uuid);
ALTER TABLE public.rh_treinamento_atribuicoes ADD CONSTRAINT rh_treinamento_atribuicoes_treinamento_id_colaborador_id_key UNIQUE (treinamento_id, colaborador_id);
ALTER TABLE public.rh_vaga_manager_links ADD CONSTRAINT rh_vaga_manager_links_token_key UNIQUE (token);
ALTER TABLE public.terms_acceptances ADD CONSTRAINT terms_acceptances_profile_id_version_key UNIQUE (profile_id, version);
ALTER TABLE public.uniform_person_sizes ADD CONSTRAINT uniform_person_sizes_person_id_item_id_key UNIQUE (person_id, item_id);
ALTER TABLE public.activities ADD CONSTRAINT activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.activities ADD CONSTRAINT activities_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id);
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE SET NULL;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);
ALTER TABLE public.automations ADD CONSTRAINT automations_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.bug_reports ADD CONSTRAINT bug_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.bug_reports ADD CONSTRAINT bug_reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE;
ALTER TABLE public.chat_channel_members ADD CONSTRAINT chat_channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE;
ALTER TABLE public.chat_stickers ADD CONSTRAINT chat_stickers_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.client_addresses ADD CONSTRAINT client_addresses_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_billing_history ADD CONSTRAINT client_billing_history_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_contacts ADD CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_products ADD CONSTRAINT client_products_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_products ADD CONSTRAINT client_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE public.client_products ADD CONSTRAINT client_products_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.comex_export_operations ADD CONSTRAINT comex_export_operations_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.comex_import_operations ADD CONSTRAINT comex_import_operations_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_categorias ADD CONSTRAINT crm_viagem_categorias_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_despesas ADD CONSTRAINT crm_viagem_despesas_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_despesas ADD CONSTRAINT crm_viagem_despesas_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_despesas ADD CONSTRAINT crm_viagem_despesas_prestacao_id_fkey FOREIGN KEY (prestacao_id) REFERENCES crm_viagem_prestacoes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_despesas ADD CONSTRAINT crm_viagem_despesas_registro_id_fkey FOREIGN KEY (registro_id) REFERENCES crm_viagem_registros(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_despesas ADD CONSTRAINT crm_viagem_despesas_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.crm_viagem_prestacoes ADD CONSTRAINT crm_viagem_prestacoes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_prestacoes ADD CONSTRAINT crm_viagem_prestacoes_decidida_por_fkey FOREIGN KEY (decidida_por) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_prestacoes ADD CONSTRAINT crm_viagem_prestacoes_registro_id_fkey FOREIGN KEY (registro_id) REFERENCES crm_viagem_registros(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_prestacoes ADD CONSTRAINT crm_viagem_prestacoes_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.deliverable_checklists ADD CONSTRAINT deliverable_checklists_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.deliverable_checklists ADD CONSTRAINT deliverable_checklists_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES marketing_deliverables(id) ON DELETE CASCADE;
ALTER TABLE public.document_library ADD CONSTRAINT document_library_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.esg_emission_factors ADD CONSTRAINT esg_emission_factors_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.esg_emission_records ADD CONSTRAINT esg_emission_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.esg_emission_records ADD CONSTRAINT esg_emission_records_emission_factor_id_fkey FOREIGN KEY (emission_factor_id) REFERENCES esg_emission_factors(id);
ALTER TABLE public.esg_reports ADD CONSTRAINT esg_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES profiles(id);
ALTER TABLE public.export_audit_log ADD CONSTRAINT export_audit_log_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.invitations ADD CONSTRAINT invitations_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES marketing_suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.lead_attachments ADD CONSTRAINT lead_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lead_captures ADD CONSTRAINT lead_captures_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.lead_checklists ADD CONSTRAINT lead_checklists_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lead_document_refs ADD CONSTRAINT lead_document_refs_attached_by_fkey FOREIGN KEY (attached_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lead_document_refs ADD CONSTRAINT lead_document_refs_document_library_id_fkey FOREIGN KEY (document_library_id) REFERENCES document_library(id) ON DELETE CASCADE;
ALTER TABLE public.lead_document_refs ADD CONSTRAINT lead_document_refs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.lead_emails ADD CONSTRAINT lead_emails_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.lead_emails ADD CONSTRAINT lead_emails_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lead_emails ADD CONSTRAINT lead_emails_template_id_fkey FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;
ALTER TABLE public.lead_samples ADD CONSTRAINT lead_samples_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.lead_samples ADD CONSTRAINT lead_samples_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.lead_stage_history ADD CONSTRAINT lead_stage_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.lead_stage_history ADD CONSTRAINT lead_stage_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD CONSTRAINT leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.margin_rules ADD CONSTRAINT margin_rules_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE public.margin_rules ADD CONSTRAINT margin_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.market_intelligence_items ADD CONSTRAINT market_intelligence_items_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_budgets ADD CONSTRAINT marketing_budgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.marketing_campaign_attachments ADD CONSTRAINT marketing_campaign_attachments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_campaign_attachments ADD CONSTRAINT marketing_campaign_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_owner_fkey FOREIGN KEY (owner) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES marketing_suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_deliverable_attachments ADD CONSTRAINT marketing_deliverable_attachments_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES marketing_deliverables(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_deliverable_attachments ADD CONSTRAINT marketing_deliverable_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_deliverables ADD CONSTRAINT marketing_deliverables_assignee_fkey FOREIGN KEY (assignee) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_deliverables ADD CONSTRAINT marketing_deliverables_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_deliverables ADD CONSTRAINT marketing_deliverables_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_expense_deliverables ADD CONSTRAINT marketing_expense_deliverables_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES marketing_deliverables(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_expense_deliverables ADD CONSTRAINT marketing_expense_deliverables_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES marketing_expenses(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_expense_items ADD CONSTRAINT marketing_expense_items_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES marketing_expenses(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_expense_tasks ADD CONSTRAINT marketing_expense_tasks_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES marketing_expenses(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_expense_tasks ADD CONSTRAINT marketing_expense_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES marketing_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_expenses ADD CONSTRAINT marketing_expenses_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_expenses ADD CONSTRAINT marketing_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES marketing_expenses(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES marketing_suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_quote_email_template ADD CONSTRAINT marketing_quote_email_template_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES marketing_deliverables(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES marketing_purchase_requests(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_task_id_fkey FOREIGN KEY (task_id) REFERENCES marketing_tasks(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_supplier_quotes ADD CONSTRAINT marketing_supplier_quotes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_supplier_quotes ADD CONSTRAINT marketing_supplier_quotes_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_supplier_quotes ADD CONSTRAINT marketing_supplier_quotes_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES marketing_suppliers(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_suppliers ADD CONSTRAINT marketing_suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_tasks ADD CONSTRAINT marketing_tasks_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_tasks ADD CONSTRAINT marketing_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.module_states ADD CONSTRAINT module_states_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
ALTER TABLE public.order_stage_history ADD CONSTRAINT order_stage_history_moved_by_fkey FOREIGN KEY (moved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.order_stage_history ADD CONSTRAINT order_stage_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES client_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD CONSTRAINT orders_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES client_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.personal_events ADD CONSTRAINT personal_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_attachments ADD CONSTRAINT personal_task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES personal_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_attachments ADD CONSTRAINT personal_task_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_automations ADD CONSTRAINT personal_task_automations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_checklists ADD CONSTRAINT personal_task_checklists_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.personal_task_checklists ADD CONSTRAINT personal_task_checklists_task_id_fkey FOREIGN KEY (task_id) REFERENCES personal_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_checklists ADD CONSTRAINT personal_task_checklists_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_dependencies ADD CONSTRAINT personal_task_dependencies_depends_on_id_fkey FOREIGN KEY (depends_on_id) REFERENCES personal_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_dependencies ADD CONSTRAINT personal_task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES personal_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_dependencies ADD CONSTRAINT personal_task_dependencies_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_stage_fields ADD CONSTRAINT personal_task_stage_fields_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_stages ADD CONSTRAINT personal_task_stages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_task_tags ADD CONSTRAINT personal_task_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_tasks ADD CONSTRAINT personal_tasks_related_lead_id_fkey FOREIGN KEY (related_lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.personal_tasks ADD CONSTRAINT personal_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.personal_tasks_api_keys ADD CONSTRAINT personal_tasks_api_keys_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.posvenda_cases ADD CONSTRAINT posvenda_cases_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.posvenda_cases ADD CONSTRAINT posvenda_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.posvenda_cases ADD CONSTRAINT posvenda_cases_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profile_module_overrides ADD CONSTRAINT profile_module_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profile_module_overrides ADD CONSTRAINT profile_module_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profile_secrets ADD CONSTRAINT profile_secrets_id_fkey FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES marketing_suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.proposal_line_items ADD CONSTRAINT proposal_line_items_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.rapp_ibama ADD CONSTRAINT rapp_ibama_carga_id_fkey FOREIGN KEY (carga_id) REFERENCES rapp_cargas(id) ON DELETE SET NULL;
ALTER TABLE public.record_views ADD CONSTRAINT record_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.rh_aplicacoes ADD CONSTRAINT rh_aplicacoes_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES rh_candidatos(id) ON DELETE CASCADE;
ALTER TABLE public.rh_aplicacoes ADD CONSTRAINT rh_aplicacoes_manager_link_id_fkey FOREIGN KEY (manager_link_id) REFERENCES rh_vaga_manager_links(id);
ALTER TABLE public.rh_aplicacoes ADD CONSTRAINT rh_aplicacoes_vaga_id_fkey FOREIGN KEY (vaga_id) REFERENCES rh_vagas(id) ON DELETE CASCADE;
ALTER TABLE public.rh_attachments ADD CONSTRAINT rh_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES rh_colaboradores(id) ON DELETE CASCADE;
ALTER TABLE public.rh_bemestar_fila ADD CONSTRAINT rh_bemestar_fila_sessao_id_fkey FOREIGN KEY (sessao_id) REFERENCES rh_bemestar_sessoes(id) ON DELETE CASCADE;
ALTER TABLE public.rh_beneficios_catalogo ADD CONSTRAINT rh_beneficios_catalogo_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_beneficios_catalogo ADD CONSTRAINT rh_beneficios_catalogo_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES rh_fornecedores(id) ON DELETE SET NULL;
ALTER TABLE public.rh_candidatos ADD CONSTRAINT rh_candidatos_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_candidatos ADD CONSTRAINT rh_candidatos_vaga_id_fkey FOREIGN KEY (vaga_id) REFERENCES rh_vagas(id) ON DELETE SET NULL;
ALTER TABLE public.rh_cargo_templates ADD CONSTRAINT rh_cargo_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_checklists ADD CONSTRAINT rh_checklists_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_colaborador_beneficios ADD CONSTRAINT rh_colaborador_beneficios_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_colaborador_beneficios ADD CONSTRAINT rh_colaborador_beneficios_beneficio_catalogo_id_fkey FOREIGN KEY (beneficio_catalogo_id) REFERENCES rh_beneficios_catalogo(id);
ALTER TABLE public.rh_colaborador_beneficios ADD CONSTRAINT rh_colaborador_beneficios_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh_colaboradores(id) ON DELETE CASCADE;
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_vaga_id_fkey FOREIGN KEY (vaga_id) REFERENCES rh_vagas(id) ON DELETE SET NULL;
ALTER TABLE public.rh_curriculo_upload_tokens ADD CONSTRAINT rh_curriculo_upload_tokens_candidato_id_fkey FOREIGN KEY (candidato_id) REFERENCES rh_candidatos(id) ON DELETE CASCADE;
ALTER TABLE public.rh_data_update_requests ADD CONSTRAINT rh_data_update_requests_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh_colaboradores(id) ON DELETE CASCADE;
ALTER TABLE public.rh_data_update_requests ADD CONSTRAINT rh_data_update_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.rh_data_update_requests ADD CONSTRAINT rh_data_update_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_ferias ADD CONSTRAINT rh_ferias_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_ferias ADD CONSTRAINT rh_ferias_user_id_fkey FOREIGN KEY (user_id) REFERENCES rh_colaboradores(id) ON DELETE CASCADE;
ALTER TABLE public.rh_fornecedor_contrato_eventos ADD CONSTRAINT rh_fornecedor_contrato_eventos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES rh_fornecedor_contratos(id) ON DELETE CASCADE;
ALTER TABLE public.rh_fornecedor_contrato_eventos ADD CONSTRAINT rh_fornecedor_contrato_eventos_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_fornecedor_contratos ADD CONSTRAINT rh_fornecedor_contratos_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_fornecedor_contratos ADD CONSTRAINT rh_fornecedor_contratos_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES rh_fornecedores(id) ON DELETE CASCADE;
ALTER TABLE public.rh_fornecedor_contratos ADD CONSTRAINT rh_fornecedor_contratos_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_fornecedores ADD CONSTRAINT rh_fornecedores_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_movimentacoes ADD CONSTRAINT rh_movimentacoes_avaliacao_id_fkey FOREIGN KEY (avaliacao_id) REFERENCES rh_avaliacoes(id) ON DELETE SET NULL;
ALTER TABLE public.rh_movimentacoes ADD CONSTRAINT rh_movimentacoes_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh_colaboradores(id) ON DELETE CASCADE;
ALTER TABLE public.rh_onboarding_tarefas ADD CONSTRAINT rh_onboarding_tarefas_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh_colaboradores(id) ON DELETE CASCADE;
ALTER TABLE public.rh_onboarding_tarefas ADD CONSTRAINT rh_onboarding_tarefas_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_onboarding_tarefas ADD CONSTRAINT rh_onboarding_tarefas_template_id_fkey FOREIGN KEY (template_id) REFERENCES rh_onboarding_templates(id) ON DELETE SET NULL;
ALTER TABLE public.rh_onboarding_templates ADD CONSTRAINT rh_onboarding_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_pesquisa_respostas ADD CONSTRAINT rh_pesquisa_respostas_pesquisa_id_fkey FOREIGN KEY (pesquisa_id) REFERENCES rh_pesquisas(id) ON DELETE CASCADE;
ALTER TABLE public.rh_pesquisa_respostas ADD CONSTRAINT rh_pesquisa_respostas_respondente_id_fkey FOREIGN KEY (respondente_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_pipeline_stages ADD CONSTRAINT rh_pipeline_stages_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_report_presets ADD CONSTRAINT rh_report_presets_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_signature_requests ADD CONSTRAINT rh_signature_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_stage_history ADD CONSTRAINT rh_stage_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_treinamento_atribuicoes ADD CONSTRAINT rh_treinamento_atribuicoes_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh_colaboradores(id) ON DELETE CASCADE;
ALTER TABLE public.rh_treinamento_atribuicoes ADD CONSTRAINT rh_treinamento_atribuicoes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_treinamento_atribuicoes ADD CONSTRAINT rh_treinamento_atribuicoes_treinamento_id_fkey FOREIGN KEY (treinamento_id) REFERENCES rh_treinamentos(id) ON DELETE CASCADE;
ALTER TABLE public.rh_treinamentos ADD CONSTRAINT rh_treinamentos_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_vaga_manager_links ADD CONSTRAINT rh_vaga_manager_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.rh_vaga_manager_links ADD CONSTRAINT rh_vaga_manager_links_vaga_id_fkey FOREIGN KEY (vaga_id) REFERENCES rh_vagas(id) ON DELETE CASCADE;
ALTER TABLE public.rh_vagas ADD CONSTRAINT rh_vagas_cargo_template_id_fkey FOREIGN KEY (cargo_template_id) REFERENCES rh_cargo_templates(id) ON DELETE SET NULL;
ALTER TABLE public.rh_vagas ADD CONSTRAINT rh_vagas_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.sales_cases ADD CONSTRAINT sales_cases_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.sales_cases ADD CONSTRAINT sales_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.sales_cases ADD CONSTRAINT sales_cases_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.terms_acceptances ADD CONSTRAINT terms_acceptances_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.uniform_people ADD CONSTRAINT uniform_people_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES rh_colaboradores(id) ON DELETE SET NULL;
ALTER TABLE public.uniform_person_sizes ADD CONSTRAINT uniform_person_sizes_item_id_fkey FOREIGN KEY (item_id) REFERENCES uniform_items(id) ON DELETE CASCADE;
ALTER TABLE public.uniform_person_sizes ADD CONSTRAINT uniform_person_sizes_person_id_fkey FOREIGN KEY (person_id) REFERENCES uniform_people(id) ON DELETE CASCADE;
ALTER TABLE public.uniform_round_lines ADD CONSTRAINT uniform_round_lines_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.uniform_round_lines ADD CONSTRAINT uniform_round_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES uniform_items(id) ON DELETE RESTRICT;
ALTER TABLE public.uniform_round_lines ADD CONSTRAINT uniform_round_lines_person_id_fkey FOREIGN KEY (person_id) REFERENCES uniform_people(id) ON DELETE RESTRICT;
ALTER TABLE public.uniform_round_lines ADD CONSTRAINT uniform_round_lines_picked_up_by_fkey FOREIGN KEY (picked_up_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.uniform_round_lines ADD CONSTRAINT uniform_round_lines_round_id_fkey FOREIGN KEY (round_id) REFERENCES uniform_rounds(id) ON DELETE CASCADE;
ALTER TABLE public.uniform_rounds ADD CONSTRAINT uniform_rounds_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.uniform_rounds ADD CONSTRAINT uniform_rounds_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES marketing_purchase_requests(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.activities ADD CONSTRAINT activities_type_check CHECK ((type = ANY (ARRAY['onboarding'::text, 'nps'::text, 'nurture'::text, 'call'::text, 'email'::text, 'whatsapp'::text, 'note'::text, 'agent_suggestion'::text, 'agent_enrich'::text, 'agent_qualify'::text, 'stage_change'::text])));
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_agent_id_check CHECK ((agent_id = ANY (ARRAY['sdr_q'::text, 'scout'::text, 'cadencia'::text, 'sentinela'::text, 'cross'::text, 'automation'::text])));
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_company_id_check CHECK ((company_id = ANY (ARRAY['industria'::text, 'resibag'::text, 'montemor'::text])));
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'approved'::text, 'rejected'::text, 'executed'::text, 'ignored'::text])));
ALTER TABLE public.automations ADD CONSTRAINT automations_module_check CHECK ((module = ANY (ARRAY['crm'::text, 'marketing'::text, 'universal'::text, 'rh-fornecedores'::text, 'rh-vagas'::text, 'rh-sourcing'::text, 'sinais-mercado'::text, 'prospeccao'::text])));
ALTER TABLE public.bug_reports ADD CONSTRAINT bug_reports_priority_check CHECK ((priority = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text])));
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_kind_check CHECK ((kind = ANY (ARRAY['canal'::text, 'dm'::text])));
ALTER TABLE public.client_products ADD CONSTRAINT client_products_price_check CHECK ((price >= (0)::numeric));
ALTER TABLE public.clients ADD CONSTRAINT clients_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'inativo'::text])));
ALTER TABLE public.crm_viagem_despesas ADD CONSTRAINT crm_viagem_despesas_status_reembolso_check CHECK ((status_reembolso = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'rejeitado'::text, 'pago'::text])));
ALTER TABLE public.crm_viagem_despesas ADD CONSTRAINT crm_viagem_despesas_valor_check CHECK ((valor > (0)::numeric));
ALTER TABLE public.crm_viagem_prestacoes ADD CONSTRAINT crm_viagem_prestacoes_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'enviada'::text, 'aprovada'::text, 'rejeitada'::text, 'parcial'::text, 'paga'::text])));
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_status_check CHECK ((status = ANY (ARRAY['planejado'::text, 'realizado'::text, 'nao_realizado'::text, 'cancelado'::text])));
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_tipo_check CHECK ((tipo = ANY (ARRAY['visita'::text, 'evento'::text, 'outra'::text])));
ALTER TABLE public.crm_viagem_registros ADD CONSTRAINT crm_viagem_registros_valor_previsto_check CHECK (((valor_previsto IS NULL) OR (valor_previsto >= (0)::numeric)));
ALTER TABLE public.document_library ADD CONSTRAINT document_library_category_check CHECK ((category = ANY (ARRAY['certificado'::text, 'datasheet'::text, 'manual'::text, 'ficha_tecnica'::text, 'outro'::text])));
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_scope_check CHECK ((scope = ANY (ARRAY['shared'::text, 'private'::text])));
ALTER TABLE public.esg_emission_factors ADD CONSTRAINT esg_emission_factors_scope_check CHECK ((scope = ANY (ARRAY[1, 2, 3])));
ALTER TABLE public.esg_emission_factors ADD CONSTRAINT esg_emission_factors_valid_range_check CHECK (((valid_to IS NULL) OR (valid_to > valid_from)));
ALTER TABLE public.esg_emission_records ADD CONSTRAINT esg_emission_records_scope_check CHECK ((scope = ANY (ARRAY[1, 2, 3])));
ALTER TABLE public.invitations ADD CONSTRAINT invitations_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'gerente'::text, 'vendedor'::text, 'consultor'::text, 'marketing'::text, 'gerente_marketing'::text, 'agencia'::text, 'rh'::text, 'gerente_rh'::text, 'diretoria'::text, 'comex'::text])));
ALTER TABLE public.lead_captures ADD CONSTRAINT lead_captures_company_id_check CHECK ((company_id = ANY (ARRAY['industria'::text, 'resibag'::text, 'montemor'::text])));
ALTER TABLE public.lead_captures ADD CONSTRAINT lead_captures_priority_check CHECK (((priority IS NULL) OR (priority = ANY (ARRAY['Alta'::text, 'Média'::text, 'Baixa'::text]))));
ALTER TABLE public.lead_emails ADD CONSTRAINT lead_emails_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text])));
ALTER TABLE public.lead_samples ADD CONSTRAINT lead_samples_cost_nonnegative CHECK ((cost >= (0)::numeric));
ALTER TABLE public.leads ADD CONSTRAINT leads_canal_origem_check CHECK ((canal_origem = ANY (ARRAY['site_widget'::text, 'manual'::text, 'import'::text, 'referral'::text, 'whatsapp'::text])));
ALTER TABLE public.leads ADD CONSTRAINT leads_client_classification_check CHECK ((client_classification = ANY (ARRAY['D'::text, 'C'::text, 'B'::text, 'A'::text, 'X'::text])));
ALTER TABLE public.leads ADD CONSTRAINT leads_company_id_check CHECK ((company_id = ANY (ARRAY['industria'::text, 'resibag'::text, 'montemor'::text])));
ALTER TABLE public.leads ADD CONSTRAINT leads_value_check CHECK ((value >= (0)::numeric));
ALTER TABLE public.margin_rules ADD CONSTRAINT margin_rules_aviso_acima_do_minimo CHECK (((margem_aviso_pct IS NULL) OR (margem_minima_pct IS NULL) OR (margem_aviso_pct >= margem_minima_pct)));
ALTER TABLE public.margin_rules ADD CONSTRAINT margin_rules_tem_alguma_regra CHECK (((margem_aviso_pct IS NOT NULL) OR (margem_minima_pct IS NOT NULL)));
ALTER TABLE public.market_intelligence_items ADD CONSTRAINT market_intelligence_items_category_check CHECK ((category = ANY (ARRAY['visao_geral'::text, 'concorrencia'::text, 'regulatorio'::text, 'sustentabilidade'::text, 'regional'::text, 'preco_insumo'::text])));
ALTER TABLE public.market_intelligence_items ADD CONSTRAINT market_intelligence_items_status_check CHECK ((status = ANY (ARRAY['published'::text, 'archived'::text])));
ALTER TABLE public.market_signals ADD CONSTRAINT market_signals_urgency_check CHECK ((urgency = ANY (ARRAY['critico'::text, 'alto'::text, 'medio'::text, 'info'::text])));
ALTER TABLE public.marketing_budgets ADD CONSTRAINT marketing_budgets_amount_check CHECK ((amount >= (0)::numeric));
ALTER TABLE public.marketing_expenses ADD CONSTRAINT marketing_expenses_status_check CHECK ((status = ANY (ARRAY['pago'::text, 'pendente'::text])));
ALTER TABLE public.marketing_protocol_numbers ADD CONSTRAINT marketing_protocol_numbers_number_range CHECK (((number > 0) AND (number < 1000000)));
ALTER TABLE public.marketing_protocol_numbers ADD CONSTRAINT marketing_protocol_numbers_source_check CHECK ((source = ANY (ARRAY['marketing_request'::text, 'deliverable'::text])));
ALTER TABLE public.marketing_purchase_requests ADD CONSTRAINT marketing_purchase_requests_stage_check CHECK ((stage = ANY (ARRAY['solicitado'::text, 'cotacao'::text, 'aprovado'::text, 'rejeitado'::text, 'pedido_fornecedor'::text, 'entrega_parcial'::text, 'entregue'::text, 'pago'::text])));
ALTER TABLE public.marketing_quote_email_template ADD CONSTRAINT marketing_quote_email_template_id_check CHECK (id);
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_category_check CHECK ((category = ANY (ARRAY['material'::text, 'compra'::text])));
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_priority_check CHECK ((priority = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text])));
ALTER TABLE public.marketing_requests ADD CONSTRAINT marketing_requests_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'rejeitado'::text])));
ALTER TABLE public.marketing_supplier_quotes ADD CONSTRAINT marketing_supplier_quotes_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovada'::text, 'rejeitada'::text, 'enviada'::text, 'respondida'::text])));
ALTER TABLE public.marketing_suppliers ADD CONSTRAINT marketing_suppliers_category_check CHECK ((category = ANY (ARRAY['agencia'::text, 'grafica'::text, 'confeccao'::text, 'stand_feira'::text, 'outro'::text])));
ALTER TABLE public.module_states ADD CONSTRAINT module_states_state_check CHECK ((state = ANY (ARRAY['off'::text, 'test'::text, 'live'::text])));
ALTER TABLE public.ncm_catalog ADD CONSTRAINT ncm_catalog_relevance_check CHECK ((relevance = ANY (ARRAY['sanwey'::text, 'resibag'::text, 'both'::text])));
ALTER TABLE public.order_items ADD CONSTRAINT order_items_preco_unitario_check CHECK ((preco_unitario >= (0)::numeric));
ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantidade_check CHECK ((quantidade > 0));
ALTER TABLE public.orders ADD CONSTRAINT orders_origem_check CHECK ((origem = ANY (ARRAY['portal'::text, 'whatsapp'::text, 'email'::text, 'telefone'::text, 'outro'::text])));
ALTER TABLE public.orders ADD CONSTRAINT orders_situacao_check CHECK ((situacao = ANY (ARRAY['rascunho'::text, 'enviado'::text, 'conferencia'::text, 'confirmado'::text, 'producao'::text, 'faturado'::text, 'cancelado'::text])));
ALTER TABLE public.personal_task_dependencies ADD CONSTRAINT personal_task_dependencies_check CHECK ((task_id <> depends_on_id));
ALTER TABLE public.personal_task_stage_fields ADD CONSTRAINT personal_task_stage_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'textarea'::text, 'number'::text, 'currency'::text, 'date'::text, 'datetime'::text, 'time'::text, 'email'::text, 'phone'::text, 'url'::text, 'checkbox'::text, 'select'::text, 'radio'::text, 'multicheck'::text, 'user'::text])));
ALTER TABLE public.personal_tasks ADD CONSTRAINT personal_tasks_priority_check CHECK ((priority = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text])));
ALTER TABLE public.personal_tasks ADD CONSTRAINT personal_tasks_recurrence_check CHECK ((recurrence = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text])));
ALTER TABLE public.pipeline_stage_fields ADD CONSTRAINT pipeline_stage_fields_company_id_check CHECK ((company_id = ANY (ARRAY['industria'::text, 'resibag'::text, 'montemor'::text])));
ALTER TABLE public.pipeline_stage_fields ADD CONSTRAINT pipeline_stage_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'textarea'::text, 'number'::text, 'currency'::text, 'date'::text, 'datetime'::text, 'time'::text, 'email'::text, 'phone'::text, 'url'::text, 'checkbox'::text, 'select'::text, 'radio'::text, 'multicheck'::text, 'user'::text])));
ALTER TABLE public.pipeline_stage_transitions ADD CONSTRAINT pipeline_stage_transitions_domain_check CHECK ((domain = ANY (ARRAY['vagas'::text, 'candidatos'::text, 'onboarding'::text, 'comercial'::text, 'marketing'::text, 'marketing_deliverables'::text])));
ALTER TABLE public.products ADD CONSTRAINT products_category_conhecida CHECK (((category IS NULL) OR (category = ANY (ARRAY['resibag'::text, 'epi-seguranca'::text, 'movimentacao'::text, 'compliance'::text]))));
ALTER TABLE public.products ADD CONSTRAINT products_certificacao_restrita CHECK ((homologado OR (NOT (certifications && ARRAY['INMETRO'::text, 'ANTT 5998'::text, 'NORMAM-05'::text]))));
ALTER TABLE public.products ADD CONSTRAINT products_moq_check CHECK (((moq IS NULL) OR (moq > 0)));
ALTER TABLE public.products ADD CONSTRAINT products_preco_ref_check CHECK (((preco_tabela IS NULL) OR (preco_tabela >= (0)::numeric)));
ALTER TABLE public.products ADD CONSTRAINT products_specs_formato CHECK ((jsonb_typeof(specs) = 'array'::text));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_frente_check CHECK (((frente IS NULL) OR (frente = ANY (ARRAY['sanwey'::text, 'resibag'::text, 'montemor'::text]))));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'gerente'::text, 'vendedor'::text, 'suporte'::text, 'marketing'::text, 'gerente_marketing'::text, 'agencia'::text, 'rh'::text, 'gerente_rh'::text, 'diretoria'::text, 'comex'::text, 'cliente'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_roles_check CHECK ((roles <@ ARRAY['admin'::text, 'gerente'::text, 'vendedor'::text, 'suporte'::text, 'marketing'::text, 'gerente_marketing'::text, 'agencia'::text, 'rh'::text, 'gerente_rh'::text, 'portal'::text, 'diretoria'::text, 'comex'::text, 'cliente'::text]));
ALTER TABLE public.proposals ADD CONSTRAINT proposals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text])));
ALTER TABLE public.rapp_cargas ADD CONSTRAINT rapp_cargas_fonte_check CHECK ((fonte = ANY (ARRAY['gerador'::text, 'armazenador'::text, 'transportador'::text, 'destinador'::text])));
ALTER TABLE public.rapp_cargas ADD CONSTRAINT rapp_cargas_status_check CHECK ((status = ANY (ARRAY['em_andamento'::text, 'concluida'::text, 'falha'::text])));
ALTER TABLE public.rapp_ibama ADD CONSTRAINT rapp_ibama_cnpj_check CHECK ((cnpj ~ '^[0-9]{14}$'::text));
ALTER TABLE public.rapp_ibama ADD CONSTRAINT rapp_ibama_fonte_check CHECK ((fonte = ANY (ARRAY['gerador'::text, 'armazenador'::text, 'transportador'::text, 'destinador'::text])));
ALTER TABLE public.rh_aplicacoes ADD CONSTRAINT rh_aplicacoes_fit_score_check CHECK (((fit_score >= (0)::numeric) AND (fit_score <= (100)::numeric)));
ALTER TABLE public.rh_aplicacoes ADD CONSTRAINT rh_aplicacoes_manager_decision_check CHECK ((manager_decision = ANY (ARRAY['aprovado'::text, 'reprovado'::text])));
ALTER TABLE public.rh_aplicacoes ADD CONSTRAINT rh_aplicacoes_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
ALTER TABLE public.rh_attachments ADD CONSTRAINT rh_attachments_domain_check CHECK ((domain = ANY (ARRAY['vagas'::text, 'candidatos'::text, 'onboarding'::text, 'feedback'::text, 'ferias'::text, 'treinamentos'::text, 'fornecedor_contratos'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text, 'comex'::text, 'posvenda'::text, 'holerite'::text, 'ponto'::text])));
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_desfecho_check CHECK (((desfecho IS NULL) OR (desfecho = ANY (ARRAY['promovido'::text, 'mantido'::text, 'reavaliar'::text, 'reprovado'::text]))));
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_final_rating_check CHECK (((final_rating >= (0)::numeric) AND (final_rating <= (10)::numeric)));
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_manager_rating_check CHECK (((manager_rating >= (0)::numeric) AND (manager_rating <= (10)::numeric)));
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_self_rating_check CHECK (((self_rating >= (0)::numeric) AND (self_rating <= (10)::numeric)));
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'em_andamento'::text, 'concluido'::text])));
ALTER TABLE public.rh_avaliacoes ADD CONSTRAINT rh_avaliacoes_tipo_check CHECK ((tipo = ANY (ARRAY['30_dias'::text, '60_dias'::text, '90_dias'::text, 'semestral'::text, 'anual'::text, 'ad_hoc'::text, 'reavaliacao'::text])));
ALTER TABLE public.rh_bemestar_fila ADD CONSTRAINT rh_bemestar_fila_status_check CHECK ((status = ANY (ARRAY['na_fila'::text, 'chamado'::text, 'atendido'::text, 'faltou'::text])));
ALTER TABLE public.rh_bemestar_sessoes ADD CONSTRAINT rh_bemestar_sessoes_slot_minutos_check CHECK ((slot_minutos > 0));
ALTER TABLE public.rh_bemestar_sessoes ADD CONSTRAINT rh_bemestar_sessoes_status_check CHECK ((status = ANY (ARRAY['aberta'::text, 'encerrada'::text])));
ALTER TABLE public.rh_beneficios_catalogo ADD CONSTRAINT rh_beneficios_catalogo_tipo_check CHECK ((tipo = ANY (ARRAY['vt'::text, 'vr'::text, 'va'::text, 'wellhub'::text, 'convenio_medico'::text, 'outro'::text])));
ALTER TABLE public.rh_candidatos ADD CONSTRAINT rh_candidatos_frente_origem_check CHECK ((frente_origem <@ ARRAY['sanwey'::text, 'resibag'::text, 'montemor'::text]));
ALTER TABLE public.rh_candidatos ADD CONSTRAINT rh_candidatos_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
ALTER TABLE public.rh_checklists ADD CONSTRAINT rh_checklists_domain_check CHECK ((domain = ANY (ARRAY['vagas'::text, 'candidatos'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text, 'comex'::text])));
ALTER TABLE public.rh_colaborador_beneficios ADD CONSTRAINT rh_colaborador_beneficios_status_check CHECK ((status = ANY (ARRAY['solicitado'::text, 'aprovado'::text, 'ativo'::text, 'cancelado'::text])));
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_desligamento_tipo_check CHECK (((desligamento_tipo IS NULL) OR (desligamento_tipo = ANY (ARRAY['voluntario'::text, 'involuntario'::text, 'fim_contrato'::text, 'justa_causa'::text, 'acordo'::text]))));
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_document_type_check CHECK ((document_type = ANY (ARRAY['cnh'::text, 'rg'::text, NULL::text])));
ALTER TABLE public.rh_colaboradores ADD CONSTRAINT rh_colaboradores_frente_check CHECK (((frente IS NULL) OR (frente = ANY (ARRAY['sanwey'::text, 'resibag'::text, 'montemor'::text]))));
ALTER TABLE public.rh_data_update_requests ADD CONSTRAINT rh_data_update_requests_field_check CHECK ((field = ANY (ARRAY['phone'::text, 'email'::text, 'address_street'::text, 'address_number'::text, 'address_complement'::text, 'address_neighborhood'::text, 'address_city'::text, 'address_state'::text, 'address_zip'::text])));
ALTER TABLE public.rh_data_update_requests ADD CONSTRAINT rh_data_update_requests_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'recusado'::text])));
ALTER TABLE public.rh_ferias ADD CONSTRAINT rh_ferias_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'recusado'::text])));
ALTER TABLE public.rh_fornecedor_contrato_eventos ADD CONSTRAINT rh_fornecedor_contrato_eventos_tipo_check CHECK ((tipo = ANY (ARRAY['reajuste'::text, 'renovacao'::text, 'fatura'::text, 'nota'::text, 'orcamento'::text, 'compra'::text, 'outro'::text])));
ALTER TABLE public.rh_fornecedor_contratos ADD CONSTRAINT rh_fornecedor_contratos_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'vencido'::text, 'renovacao_pendente'::text, 'cancelado'::text])));
ALTER TABLE public.rh_fornecedores ADD CONSTRAINT rh_fornecedores_tipo_check CHECK ((tipo = ANY (ARRAY['convenio_medico'::text, 'seguradora'::text, 'terceirizada_rh'::text, 'outro'::text])));
ALTER TABLE public.rh_movimentacoes ADD CONSTRAINT rh_movimentacoes_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'recusado'::text])));
ALTER TABLE public.rh_movimentacoes ADD CONSTRAINT rh_movimentacoes_tipo_check CHECK ((tipo = ANY (ARRAY['promocao'::text, 'merito'::text, 'transferencia'::text, 'rebaixamento'::text, 'ajuste'::text])));
ALTER TABLE public.rh_onboarding_tarefas ADD CONSTRAINT rh_onboarding_tarefas_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'concluida'::text])));
ALTER TABLE public.rh_onboarding_templates ADD CONSTRAINT rh_onboarding_templates_frente_check CHECK (((frente IS NULL) OR (frente = ANY (ARRAY['sanwey'::text, 'resibag'::text, 'montemor'::text]))));
ALTER TABLE public.rh_onboarding_templates ADD CONSTRAINT rh_onboarding_templates_tipo_trilha_check CHECK (((tipo_trilha IS NULL) OR (tipo_trilha = ANY (ARRAY['administrativa'::text, 'operacional'::text, 'iso'::text]))));
ALTER TABLE public.rh_pesquisas ADD CONSTRAINT rh_pesquisas_modo_check CHECK ((modo = ANY (ARRAY['anonima'::text, 'identificada'::text])));
ALTER TABLE public.rh_pesquisas ADD CONSTRAINT rh_pesquisas_scope_type_check CHECK ((scope_type = ANY (ARRAY['todos'::text, 'frente'::text, 'departamento'::text])));
ALTER TABLE public.rh_pesquisas ADD CONSTRAINT rh_pesquisas_status_check CHECK ((status = ANY (ARRAY['aberta'::text, 'encerrada'::text])));
ALTER TABLE public.rh_pipeline_stage_fields ADD CONSTRAINT rh_pipeline_stage_fields_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'textarea'::text, 'number'::text, 'currency'::text, 'date'::text, 'datetime'::text, 'time'::text, 'email'::text, 'phone'::text, 'url'::text, 'checkbox'::text, 'select'::text, 'radio'::text, 'multicheck'::text, 'user'::text, 'percent_steps'::text])));
ALTER TABLE public.rh_signature_requests ADD CONSTRAINT rh_signature_requests_status_check CHECK ((status = ANY (ARRAY['pendente_envio'::text, 'enviado'::text, 'assinado'::text, 'recusado'::text, 'cancelado'::text])));
ALTER TABLE public.rh_stage_history ADD CONSTRAINT rh_stage_history_domain_check CHECK ((domain = ANY (ARRAY['vagas'::text, 'candidatos'::text, 'onboarding'::text, 'feedback'::text, 'ferias'::text, 'treinamentos'::text, 'marketing'::text, 'marketing_deliverables'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text, 'comex'::text, 'posvenda'::text])));
ALTER TABLE public.rh_treinamentos ADD CONSTRAINT rh_treinamentos_frente_check CHECK (((frente IS NULL) OR (frente = ANY (ARRAY['sanwey'::text, 'resibag'::text, 'montemor'::text]))));
ALTER TABLE public.rh_treinamentos ADD CONSTRAINT rh_treinamentos_tipo_check CHECK ((tipo = ANY (ARRAY['obrigatorio'::text, 'opcional'::text])));
ALTER TABLE public.rh_vagas ADD CONSTRAINT rh_vagas_company_ids_check CHECK ((company_ids <@ ARRAY['sanwey'::text, 'resibag'::text, 'montemor'::text]));
ALTER TABLE public.rh_vagas ADD CONSTRAINT rh_vagas_priority_check CHECK ((priority = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text, 'urgente'::text])));
ALTER TABLE public.rh_vagas ADD CONSTRAINT rh_vagas_status_check CHECK ((status = ANY (ARRAY['aberta'::text, 'pausada'::text, 'encerrada'::text])));
ALTER TABLE public.sales_cases ADD CONSTRAINT sales_cases_categoria_licao_check CHECK ((categoria_licao <@ ARRAY['preco'::text, 'prazo-entrega'::text, 'certificacao-compliance'::text, 'decisor-relacionamento'::text, 'concorrencia'::text, 'produto-especificacao'::text]));
ALTER TABLE public.sales_cases ADD CONSTRAINT sales_cases_company_id_check CHECK ((company_id = ANY (ARRAY['industria'::text, 'resibag'::text, 'montemor'::text])));
ALTER TABLE public.sales_cases ADD CONSTRAINT sales_cases_resultado_check CHECK ((resultado = ANY (ARRAY['ganhamos'::text, 'perdemos'::text, 'andamento'::text])));
ALTER TABLE public.sales_cases ADD CONSTRAINT sales_cases_source_check CHECK ((source = ANY (ARRAY['voz'::text, 'texto'::text])));
ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_check CHECK (((lead_id IS NOT NULL) OR (client_id IS NOT NULL)));
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));

-- ============ INDICES ============
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON public.activities USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_performed_by ON public.activities USING btree (performed_by);
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id ON public.agent_actions USING btree (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_company_id ON public.agent_actions USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON public.agent_actions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_lead_id ON public.agent_actions USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_resolved_by ON public.agent_actions USING btree (resolved_by);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON public.agent_actions USING btree (status);
CREATE INDEX IF NOT EXISTS chat_channel_members_user_idx ON public.chat_channel_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx ON public.chat_messages USING btree (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_stickers_active_idx ON public.chat_stickers USING btree (active);
CREATE INDEX IF NOT EXISTS idx_client_addresses_client ON public.client_addresses USING btree (client_id);
CREATE INDEX IF NOT EXISTS client_billing_history_client_id_idx ON public.client_billing_history USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON public.client_contacts USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_client_products_product ON public.client_products USING btree (product_id);
CREATE INDEX IF NOT EXISTS clients_company_ids_idx ON public.clients USING gin (company_ids);
CREATE INDEX IF NOT EXISTS clients_name_idx ON public.clients USING btree (lower(name));
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_clients_owner_ids ON public.clients USING gin (owner_ids);
CREATE INDEX IF NOT EXISTS comex_export_operations_created_at_idx ON public.comex_export_operations USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS comex_export_operations_stage_idx ON public.comex_export_operations USING btree (stage);
CREATE INDEX IF NOT EXISTS comex_import_operations_created_at_idx ON public.comex_import_operations USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS comex_import_operations_stage_idx ON public.comex_import_operations USING btree (stage);
CREATE INDEX IF NOT EXISTS idx_crm_viagem_categorias_created_by ON public.crm_viagem_categorias USING btree (created_by);
CREATE INDEX IF NOT EXISTS crm_viagem_despesas_prestacao_idx ON public.crm_viagem_despesas USING btree (prestacao_id);
CREATE INDEX IF NOT EXISTS crm_viagem_despesas_registro_idx ON public.crm_viagem_despesas USING btree (registro_id);
CREATE INDEX IF NOT EXISTS crm_viagem_despesas_status_idx ON public.crm_viagem_despesas USING btree (status_reembolso);
CREATE INDEX IF NOT EXISTS crm_viagem_despesas_vendedor_mes_idx ON public.crm_viagem_despesas USING btree (vendedor_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_crm_viagem_despesas_aprovado_por ON public.crm_viagem_despesas USING btree (aprovado_por);
CREATE INDEX IF NOT EXISTS idx_crm_viagem_despesas_created_by ON public.crm_viagem_despesas USING btree (created_by);
CREATE INDEX IF NOT EXISTS crm_viagem_prestacoes_registro_idx ON public.crm_viagem_prestacoes USING btree (registro_id);
CREATE INDEX IF NOT EXISTS crm_viagem_prestacoes_status_idx ON public.crm_viagem_prestacoes USING btree (status);
CREATE INDEX IF NOT EXISTS crm_viagem_prestacoes_vendedor_mes_idx ON public.crm_viagem_prestacoes USING btree (vendedor_id, mes_referencia);
CREATE INDEX IF NOT EXISTS crm_viagem_registros_campaign_idx ON public.crm_viagem_registros USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS crm_viagem_registros_client_idx ON public.crm_viagem_registros USING btree (client_id);
CREATE INDEX IF NOT EXISTS crm_viagem_registros_lead_idx ON public.crm_viagem_registros USING btree (lead_id);
CREATE INDEX IF NOT EXISTS crm_viagem_registros_vendedor_mes_idx ON public.crm_viagem_registros USING btree (vendedor_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_crm_viagem_registros_created_by ON public.crm_viagem_registros USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_deliverable_checklists_created_by ON public.deliverable_checklists USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_deliverable_checklists_deliverable_id ON public.deliverable_checklists USING btree (deliverable_id);
CREATE INDEX IF NOT EXISTS idx_document_library_company_ids ON public.document_library USING gin (company_ids);
CREATE INDEX IF NOT EXISTS idx_document_library_tags ON public.document_library USING gin (tags);
CREATE INDEX IF NOT EXISTS esg_emission_factors_category_idx ON public.esg_emission_factors USING btree (category, valid_from DESC);
CREATE UNIQUE INDEX IF NOT EXISTS esg_emission_factors_open_vigencia_unique ON public.esg_emission_factors USING btree (category, scope) WHERE (valid_to IS NULL);
CREATE INDEX IF NOT EXISTS esg_emission_records_company_idx ON public.esg_emission_records USING btree (company_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS esg_emission_records_source_unique ON public.esg_emission_records USING btree (source_type, source_id) WHERE (source_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS esg_reports_company_idx ON public.esg_reports USING btree (company_id, period_start DESC);
CREATE INDEX IF NOT EXISTS export_audit_log_exported_at_idx ON public.export_audit_log USING btree (exported_at DESC);
CREATE INDEX IF NOT EXISTS export_audit_log_exported_by_idx ON public.export_audit_log USING btree (exported_by);
CREATE INDEX IF NOT EXISTS external_cache_expires_idx ON public.external_cache USING btree (expires_at);
CREATE INDEX IF NOT EXISTS external_cache_source_idx ON public.external_cache USING btree (source);
CREATE INDEX IF NOT EXISTS idx_invitations_accepted_by ON public.invitations USING btree (accepted_by);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON public.invitations USING btree (invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_supervisor_id ON public.invitations USING btree (supervisor_id);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations USING btree (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS invitations_pending_email_unique ON public.invitations USING btree (lower(email)) WHERE (accepted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_lead_attachments_uploaded_by ON public.lead_attachments USING btree (uploaded_by);
CREATE INDEX IF NOT EXISTS lead_attachments_company_id_idx ON public.lead_attachments USING btree (company_id);
CREATE INDEX IF NOT EXISTS lead_attachments_lead_id_idx ON public.lead_attachments USING btree (lead_id);
CREATE INDEX IF NOT EXISTS lead_captures_company_idx ON public.lead_captures USING btree (company_id);
CREATE INDEX IF NOT EXISTS lead_captures_created_at_idx ON public.lead_captures USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS lead_captures_lead_idx ON public.lead_captures USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_checklists_created_by ON public.lead_checklists USING btree (created_by);
CREATE INDEX IF NOT EXISTS lead_checklists_lead_id_idx ON public.lead_checklists USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_document_refs_lead ON public.lead_document_refs USING btree (lead_id);
CREATE INDEX IF NOT EXISTS lead_samples_lead_id_idx ON public.lead_samples USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_changed_by ON public.lead_stage_history USING btree (changed_by);
CREATE INDEX IF NOT EXISTS idx_lsh_company_changed_at ON public.lead_stage_history USING btree (company_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lsh_lead_changed_at ON public.lead_stage_history USING btree (lead_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lsh_to_stage ON public.lead_stage_history USING btree (to_stage);
CREATE INDEX IF NOT EXISTS idx_leads_client_classification ON public.leads USING btree (client_classification);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads USING btree (created_by);
CREATE INDEX IF NOT EXISTS leads_campaign_id_idx ON public.leads USING btree (campaign_id) WHERE (campaign_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS leads_client_id_idx ON public.leads USING btree (client_id);
CREATE INDEX IF NOT EXISTS leads_cnpj_company_idx ON public.leads USING btree (cnpj, company_id);
CREATE INDEX IF NOT EXISTS leads_company_id_idx ON public.leads USING btree (company_id);
CREATE INDEX IF NOT EXISTS leads_next_follow_up_idx ON public.leads USING btree (next_follow_up) WHERE (next_follow_up IS NOT NULL);
CREATE INDEX IF NOT EXISTS leads_owner_idx ON public.leads USING btree (owner);
CREATE INDEX IF NOT EXISTS leads_stage_idx ON public.leads USING btree (stage);
CREATE UNIQUE INDEX IF NOT EXISTS margin_rules_excecao_produto ON public.margin_rules USING btree (company_id, product_id) WHERE (product_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS margin_rules_padrao_empresa ON public.margin_rules USING btree (company_id) WHERE (product_id IS NULL);
CREATE INDEX IF NOT EXISTS market_intelligence_items_category_idx ON public.market_intelligence_items USING btree (category);
CREATE INDEX IF NOT EXISTS market_intelligence_items_detected_at_idx ON public.market_intelligence_items USING btree (detected_at DESC);
CREATE INDEX IF NOT EXISTS market_intelligence_items_sector_idx ON public.market_intelligence_items USING btree (sector);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_budgets_unique_idx ON public.marketing_budgets USING btree (company_ids, category, period_year);
CREATE INDEX IF NOT EXISTS marketing_budgets_year_idx ON public.marketing_budgets USING btree (period_year);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_attachments_uploaded_by ON public.marketing_campaign_attachments USING btree (uploaded_by);
CREATE INDEX IF NOT EXISTS mca_campaign_id_idx ON public.marketing_campaign_attachments USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_by ON public.marketing_campaigns USING btree (created_by);
CREATE INDEX IF NOT EXISTS mc_company_ids_idx ON public.marketing_campaigns USING gin (company_ids);
CREATE INDEX IF NOT EXISTS mc_owner_idx ON public.marketing_campaigns USING btree (owner);
CREATE INDEX IF NOT EXISTS mc_stage_idx ON public.marketing_campaigns USING btree (stage);
CREATE INDEX IF NOT EXISTS mc_supplier_id_idx ON public.marketing_campaigns USING btree (supplier_id);
CREATE INDEX IF NOT EXISTS idx_marketing_deliverable_attachments_deliverable_id ON public.marketing_deliverable_attachments USING btree (deliverable_id);
CREATE INDEX IF NOT EXISTS idx_marketing_deliverable_attachments_uploaded_by ON public.marketing_deliverable_attachments USING btree (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_marketing_deliverables_assignee ON public.marketing_deliverables USING btree (assignee);
CREATE INDEX IF NOT EXISTS idx_marketing_deliverables_campaign_id ON public.marketing_deliverables USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_deliverables_created_by ON public.marketing_deliverables USING btree (created_by);
CREATE INDEX IF NOT EXISTS marketing_expense_deliverables_deliverable_idx ON public.marketing_expense_deliverables USING btree (deliverable_id);
CREATE INDEX IF NOT EXISTS marketing_expense_items_expense_idx ON public.marketing_expense_items USING btree (expense_id);
CREATE INDEX IF NOT EXISTS marketing_expense_tasks_task_idx ON public.marketing_expense_tasks USING btree (task_id);
CREATE INDEX IF NOT EXISTS idx_marketing_expenses_campaign_id ON public.marketing_expenses USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_expenses_created_by ON public.marketing_expenses USING btree (created_by);
CREATE INDEX IF NOT EXISTS marketing_purchase_requests_created_at_idx ON public.marketing_purchase_requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_purchase_requests_stage_idx ON public.marketing_purchase_requests USING btree (stage);
CREATE INDEX IF NOT EXISTS marketing_purchase_requests_supplier_idx ON public.marketing_purchase_requests USING btree (supplier_id);
CREATE INDEX IF NOT EXISTS marketing_requests_created_at_idx ON public.marketing_requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_requests_status_idx ON public.marketing_requests USING btree (status);
CREATE INDEX IF NOT EXISTS marketing_tasks_campaign_idx ON public.marketing_tasks USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS marketing_tasks_created_at_idx ON public.marketing_tasks USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_tasks_stage_idx ON public.marketing_tasks USING btree (stage);
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON public.notifications USING btree (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx ON public.notifications USING btree (recipient_id) WHERE (read_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_order_stage_history_order ON public.order_stage_history USING btree (order_id, moved_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client ON public.orders USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_situacao ON public.orders USING btree (company_id, situacao);
CREATE INDEX IF NOT EXISTS personal_events_user_id_date_idx ON public.personal_events USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS personal_task_attachments_task_id_idx ON public.personal_task_attachments USING btree (task_id);
CREATE INDEX IF NOT EXISTS personal_task_checklists_task_id_idx ON public.personal_task_checklists USING btree (task_id);
CREATE INDEX IF NOT EXISTS personal_task_dependencies_depends_on_id_idx ON public.personal_task_dependencies USING btree (depends_on_id);
CREATE INDEX IF NOT EXISTS personal_task_dependencies_task_id_idx ON public.personal_task_dependencies USING btree (task_id);
CREATE INDEX IF NOT EXISTS personal_task_stage_fields_lookup_idx ON public.personal_task_stage_fields USING btree (user_id, stage_key, order_idx);
CREATE INDEX IF NOT EXISTS personal_task_stages_user_id_idx ON public.personal_task_stages USING btree (user_id, order_idx);
CREATE INDEX IF NOT EXISTS personal_task_tags_user_id_idx ON public.personal_task_tags USING btree (user_id);
CREATE INDEX IF NOT EXISTS personal_tasks_user_id_idx ON public.personal_tasks USING btree (user_id);
CREATE INDEX IF NOT EXISTS personal_tasks_user_id_status_idx ON public.personal_tasks USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS personal_tasks_api_keys_profile_id_idx ON public.personal_tasks_api_keys USING btree (profile_id);
CREATE INDEX IF NOT EXISTS pipeline_stage_fields_lookup_idx ON public.pipeline_stage_fields USING btree (company_id, stage_id, order_idx);
CREATE INDEX IF NOT EXISTS posvenda_cases_client_id_idx ON public.posvenda_cases USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS posvenda_cases_company_id_idx ON public.posvenda_cases USING btree (company_id);
CREATE INDEX IF NOT EXISTS posvenda_cases_lead_id_idx ON public.posvenda_cases USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_products_company_active ON public.products USING btree (company_id) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS profile_secrets_calendar_token_key ON public.profile_secrets USING btree (calendar_token);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON public.profiles USING btree (email);
CREATE INDEX IF NOT EXISTS profiles_supervisor_id_idx ON public.profiles USING btree (supervisor_id);
CREATE INDEX IF NOT EXISTS profiles_supplier_id_idx ON public.profiles USING btree (supplier_id);
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_proposal ON public.proposal_line_items USING btree (proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead ON public.proposals USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_rapp_ano ON public.rapp_ibama USING btree (ano DESC);
CREATE INDEX IF NOT EXISTS idx_rapp_cnpj ON public.rapp_ibama USING btree (cnpj);
CREATE INDEX IF NOT EXISTS idx_rapp_cnpj_raiz ON public.rapp_ibama USING btree (cnpj_raiz);
CREATE INDEX IF NOT EXISTS idx_rapp_contraparte ON public.rapp_ibama USING btree (cnpj_contraparte) WHERE (cnpj_contraparte IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rapp_triagem ON public.rapp_ibama USING btree (fonte, classificacao, situacao, estado);
CREATE INDEX IF NOT EXISTS record_views_user_module_idx ON public.record_views USING btree (user_id, module);
CREATE INDEX IF NOT EXISTS rh_aplicacoes_candidate_id_idx ON public.rh_aplicacoes USING btree (candidate_id);
CREATE INDEX IF NOT EXISTS rh_aplicacoes_etapa_idx ON public.rh_aplicacoes USING btree (etapa_pipeline);
CREATE INDEX IF NOT EXISTS rh_aplicacoes_vaga_id_idx ON public.rh_aplicacoes USING btree (vaga_id);
CREATE INDEX IF NOT EXISTS rh_attachments_domain_record_idx ON public.rh_attachments USING btree (domain, record_id);
CREATE INDEX IF NOT EXISTS idx_rh_avaliacoes_evaluator_id ON public.rh_avaliacoes USING btree (evaluator_id);
CREATE INDEX IF NOT EXISTS rh_avaliacoes_user_idx ON public.rh_avaliacoes USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS rh_bemestar_fila_horario_uniq ON public.rh_bemestar_fila USING btree (sessao_id, horario) WHERE (horario IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rh_candidatos_created_by ON public.rh_candidatos USING btree (created_by);
CREATE UNIQUE INDEX IF NOT EXISTS rh_candidatos_email_key ON public.rh_candidatos USING btree (email);
CREATE INDEX IF NOT EXISTS rh_candidatos_stage_idx ON public.rh_candidatos USING btree (stage);
CREATE INDEX IF NOT EXISTS rh_candidatos_vaga_idx ON public.rh_candidatos USING btree (vaga_id);
CREATE INDEX IF NOT EXISTS idx_rh_cargo_templates_created_by ON public.rh_cargo_templates USING btree (created_by);
CREATE INDEX IF NOT EXISTS rh_checklists_domain_record_idx ON public.rh_checklists USING btree (domain, record_id);
CREATE INDEX IF NOT EXISTS rh_colaborador_beneficios_colaborador_idx ON public.rh_colaborador_beneficios USING btree (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_created_by ON public.rh_colaboradores USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_vaga_id ON public.rh_colaboradores USING btree (vaga_id);
CREATE UNIQUE INDEX IF NOT EXISTS rh_colaboradores_cpf_key ON public.rh_colaboradores USING btree (cpf) WHERE (cpf IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS rh_colaboradores_email_unique_idx ON public.rh_colaboradores USING btree (lower(email)) WHERE (email IS NOT NULL);
CREATE INDEX IF NOT EXISTS rh_colaboradores_onboarding_stage_idx ON public.rh_colaboradores USING btree (onboarding_stage);
CREATE INDEX IF NOT EXISTS rh_colaboradores_profile_id_idx ON public.rh_colaboradores USING btree (profile_id);
CREATE INDEX IF NOT EXISTS rh_curriculo_upload_tokens_candidato_idx ON public.rh_curriculo_upload_tokens USING btree (candidato_id);
CREATE INDEX IF NOT EXISTS rh_data_update_requests_colaborador_idx ON public.rh_data_update_requests USING btree (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_ferias_approved_by ON public.rh_ferias USING btree (approved_by);
CREATE INDEX IF NOT EXISTS rh_ferias_status_idx ON public.rh_ferias USING btree (status);
CREATE INDEX IF NOT EXISTS rh_ferias_user_idx ON public.rh_ferias USING btree (user_id);
CREATE INDEX IF NOT EXISTS rh_fornecedor_contrato_eventos_contrato_idx ON public.rh_fornecedor_contrato_eventos USING btree (contrato_id, data_evento DESC);
CREATE INDEX IF NOT EXISTS rh_fornecedor_contratos_fornecedor_idx ON public.rh_fornecedor_contratos USING btree (fornecedor_id);
CREATE INDEX IF NOT EXISTS rh_fornecedor_contratos_responsavel_idx ON public.rh_fornecedor_contratos USING btree (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_rh_onboarding_tarefas_created_by ON public.rh_onboarding_tarefas USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_rh_onboarding_tarefas_template_id ON public.rh_onboarding_tarefas USING btree (template_id);
CREATE INDEX IF NOT EXISTS rh_onboarding_tarefas_colaborador_idx ON public.rh_onboarding_tarefas USING btree (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_onboarding_templates_created_by ON public.rh_onboarding_templates USING btree (created_by);
CREATE UNIQUE INDEX IF NOT EXISTS rh_pesquisa_respostas_identificada_uniq ON public.rh_pesquisa_respostas USING btree (pesquisa_id, respondente_id) WHERE (respondente_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS rh_signature_requests_domain_record_idx ON public.rh_signature_requests USING btree (domain, record_id);
CREATE INDEX IF NOT EXISTS rh_stage_history_domain_record_idx ON public.rh_stage_history USING btree (domain, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rh_treinamento_atribuicoes_created_by ON public.rh_treinamento_atribuicoes USING btree (created_by);
CREATE INDEX IF NOT EXISTS rh_treinamento_atrib_colaborador_idx ON public.rh_treinamento_atribuicoes USING btree (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_treinamentos_created_by ON public.rh_treinamentos USING btree (created_by);
CREATE INDEX IF NOT EXISTS rh_vaga_manager_links_vaga_idx ON public.rh_vaga_manager_links USING btree (vaga_id);
CREATE INDEX IF NOT EXISTS idx_rh_vagas_cargo_template_id ON public.rh_vagas USING btree (cargo_template_id);
CREATE INDEX IF NOT EXISTS idx_rh_vagas_created_by ON public.rh_vagas USING btree (created_by);
CREATE UNIQUE INDEX IF NOT EXISTS rh_vagas_link_slug_key ON public.rh_vagas USING btree (link_slug) WHERE (link_slug IS NOT NULL);
CREATE INDEX IF NOT EXISTS rh_vagas_stage_idx ON public.rh_vagas USING btree (stage);
CREATE INDEX IF NOT EXISTS sales_cases_client_id_idx ON public.sales_cases USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS sales_cases_company_id_idx ON public.sales_cases USING btree (company_id);
CREATE INDEX IF NOT EXISTS sales_cases_created_at_idx ON public.sales_cases USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS sales_cases_created_by_idx ON public.sales_cases USING btree (created_by);
CREATE INDEX IF NOT EXISTS sales_cases_lead_id_idx ON public.sales_cases USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS uniform_people_dept_idx ON public.uniform_people USING btree (department) WHERE is_active;
CREATE INDEX IF NOT EXISTS uniform_round_lines_person_idx ON public.uniform_round_lines USING btree (person_id);
CREATE INDEX IF NOT EXISTS uniform_round_lines_round_idx ON public.uniform_round_lines USING btree (round_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_client ON public.whatsapp_conversations USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_lead ON public.whatsapp_conversations USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages USING btree (conversation_id);

-- ============ VIEWS ============
CREATE OR REPLACE VIEW public.rapp_candidatos_cadeia WITH (security_invoker=on) AS
 WITH operadores AS (
         SELECT r.cnpj,
            'operador'::text AS papel,
            r.fonte AS origem_fonte,
            max(r.razao_social) AS razao_social,
            max(r.estado) AS estado,
            max(r.municipio) AS municipio,
            max(r.ano) AS ultimo_ano,
            count(*) AS linhas,
            count(DISTINCT r.cnpj_contraparte) AS contrapartes
           FROM rapp_ibama r
          WHERE (r.fonte = ANY (ARRAY['transportador'::text, 'armazenador'::text])) AND r.situacao = 'Ativa'::text
          GROUP BY r.cnpj, r.fonte
        ), geradores AS (
         SELECT r.cnpj_contraparte AS cnpj,
            'gerador_referenciado'::text AS papel,
            r.fonte AS origem_fonte,
            max(r.razao_contraparte) AS razao_social,
            NULL::text AS estado,
            NULL::text AS municipio,
            max(r.ano) AS ultimo_ano,
            count(*) AS linhas,
            count(DISTINCT r.cnpj) AS contrapartes
           FROM rapp_ibama r
          WHERE (r.fonte = ANY (ARRAY['transportador'::text, 'armazenador'::text])) AND r.cnpj_contraparte IS NOT NULL
          GROUP BY r.cnpj_contraparte, r.fonte
        ), tudo AS (
         SELECT operadores.cnpj,
            operadores.papel,
            operadores.origem_fonte,
            operadores.razao_social,
            operadores.estado,
            operadores.municipio,
            operadores.ultimo_ano,
            operadores.linhas,
            operadores.contrapartes
           FROM operadores
        UNION ALL
         SELECT geradores.cnpj,
            geradores.papel,
            geradores.origem_fonte,
            geradores.razao_social,
            geradores.estado,
            geradores.municipio,
            geradores.ultimo_ano,
            geradores.linhas,
            geradores.contrapartes
           FROM geradores
        )
 SELECT cnpj,
    papel,
    origem_fonte,
    razao_social,
    estado,
    municipio,
    ultimo_ano,
    linhas,
    contrapartes
   FROM tudo t
  WHERE NOT (EXISTS ( SELECT 1
           FROM prospect_seeds p
          WHERE regexp_replace(COALESCE(p.cnpj, ''::text), '[^0-9]'::text, ''::text, 'g'::text) = t.cnpj)) AND NOT (EXISTS ( SELECT 1
           FROM agent_actions a
          WHERE a.action_type = 'sugestao_prospect'::text AND regexp_replace(COALESCE(a.payload ->> 'cnpj'::text, ''::text), '[^0-9]'::text, ''::text, 'g'::text) = t.cnpj));

CREATE OR REPLACE VIEW public.rapp_candidatos_resibag WITH (security_invoker=on) AS
 WITH base AS (
         SELECT r.cnpj,
            r.cnpj_raiz,
            max(r.razao_social) AS razao_social,
            max(r.estado) AS estado,
            max(r.municipio) AS municipio,
            max(r.categoria) AS categoria,
            max(r.detalhe) AS detalhe,
            max(r.ano) AS ultimo_ano,
            count(*) FILTER (WHERE r.classificacao = 'Perigoso'::text) AS linhas_perigoso,
            count(DISTINCT r.residuo_codigo) FILTER (WHERE r.classificacao = 'Perigoso'::text) AS tipos_perigoso,
            sum(
                CASE
                    WHEN r.classificacao = 'Perigoso'::text AND r.unidade ~~* 'tonelada%'::text THEN r.quantidade
                    WHEN r.classificacao = 'Perigoso'::text AND r.unidade ~~* 'kilograma%'::text THEN r.quantidade / 1000.0
                    WHEN r.classificacao = 'Perigoso'::text AND r.unidade ~~* 'kg%'::text THEN r.quantidade / 1000.0
                    ELSE NULL::numeric
                END) AS ton_perigoso_massa,
            count(*) FILTER (WHERE r.classificacao = 'Perigoso'::text AND r.unidade !~~* 'tonelada%'::text AND r.unidade !~~* 'kilograma%'::text AND r.unidade !~~* 'kg%'::text) AS linhas_perigoso_sem_massa
           FROM rapp_ibama r
          WHERE r.fonte = 'gerador'::text AND r.situacao = 'Ativa'::text
          GROUP BY r.cnpj, r.cnpj_raiz
        )
 SELECT cnpj,
    cnpj_raiz,
    razao_social,
    estado,
    municipio,
    categoria,
    detalhe,
    ultimo_ano,
    linhas_perigoso,
    tipos_perigoso,
    ton_perigoso_massa,
    linhas_perigoso_sem_massa
   FROM base b
  WHERE linhas_perigoso > 0 AND NOT (EXISTS ( SELECT 1
           FROM prospect_seeds p
          WHERE regexp_replace(COALESCE(p.cnpj, ''::text), '[^0-9]'::text, ''::text, 'g'::text) = b.cnpj)) AND NOT (EXISTS ( SELECT 1
           FROM agent_actions a
          WHERE a.action_type = 'sugestao_prospect'::text AND regexp_replace(COALESCE(a.payload ->> 'cnpj'::text, ''::text), '[^0-9]'::text, ''::text, 'g'::text) = b.cnpj));

-- ============ TRIGGERS ============
CREATE TRIGGER trg_agent_actions_updated_at BEFORE UPDATE ON public.agent_actions FOR EACH ROW EXECUTE FUNCTION update_agent_actions_updated_at();
CREATE TRIGGER bug_reports_validate_stage BEFORE INSERT OR UPDATE ON public.bug_reports FOR EACH ROW EXECUTE FUNCTION validate_rh_stage();
CREATE TRIGGER trg_chat_channel_members_guard_self_update BEFORE UPDATE ON public.chat_channel_members FOR EACH ROW EXECUTE FUNCTION chat_channel_members_guard_self_update();
CREATE TRIGGER chat_messages_touch_channel AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION chat_touch_channel();
CREATE TRIGGER trg_client_addresses_touch BEFORE UPDATE ON public.client_addresses FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER client_billing_history_touch BEFORE UPDATE ON public.client_billing_history FOR EACH ROW EXECUTE FUNCTION client_billing_history_touch_row();
CREATE TRIGGER trg_client_contacts_touch BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER trg_client_products_margem BEFORE INSERT OR UPDATE OF price ON public.client_products FOR EACH ROW EXECUTE FUNCTION enforce_margin_rule();
CREATE TRIGGER trg_client_products_touch BEFORE UPDATE ON public.client_products FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION clients_touch_row();
CREATE TRIGGER comex_export_operations_updated_at BEFORE UPDATE ON public.comex_export_operations FOR EACH ROW EXECUTE FUNCTION comex_export_operations_set_updated_at();
CREATE TRIGGER trg_log_comex_export_stage_change AFTER INSERT OR UPDATE ON public.comex_export_operations FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('comex', 'stage');
CREATE TRIGGER comex_import_operations_updated_at BEFORE UPDATE ON public.comex_import_operations FOR EACH ROW EXECUTE FUNCTION comex_import_operations_set_updated_at();
CREATE TRIGGER trg_log_comex_import_stage_change AFTER INSERT OR UPDATE ON public.comex_import_operations FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('comex', 'stage');
CREATE TRIGGER crm_viagem_despesas_block_delete_prestada_trg BEFORE DELETE ON public.crm_viagem_despesas FOR EACH ROW EXECUTE FUNCTION crm_viagem_despesas_block_delete_prestada();
CREATE TRIGGER crm_viagem_despesas_recompute_prestacao_trg AFTER UPDATE ON public.crm_viagem_despesas FOR EACH ROW EXECUTE FUNCTION crm_viagem_prestacoes_recompute_status();
CREATE TRIGGER crm_viagem_despesas_require_comprovante_trg BEFORE INSERT OR UPDATE ON public.crm_viagem_despesas FOR EACH ROW EXECUTE FUNCTION crm_viagem_despesas_require_comprovante();
CREATE TRIGGER crm_viagem_despesas_validate_prestacao_trg BEFORE INSERT OR UPDATE ON public.crm_viagem_despesas FOR EACH ROW EXECUTE FUNCTION crm_viagem_despesas_validate_prestacao();
CREATE TRIGGER crm_viagem_prestacoes_updated_at BEFORE UPDATE ON public.crm_viagem_prestacoes FOR EACH ROW EXECUTE FUNCTION crm_viagem_prestacoes_set_updated_at();
CREATE TRIGGER trg_document_library_touch BEFORE UPDATE ON public.document_library FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER trg_esg_emission_factors_guard_update BEFORE UPDATE ON public.esg_emission_factors FOR EACH ROW EXECUTE FUNCTION esg_emission_factors_guard_update();
CREATE TRIGGER lead_samples_freeze_created_by BEFORE UPDATE ON public.lead_samples FOR EACH ROW EXECUTE FUNCTION lead_samples_freeze_created_by();
CREATE TRIGGER leads_sync_owner_ids_trg BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION leads_sync_owner_ids();
CREATE TRIGGER leads_sync_status_to_stage_trg BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION leads_sync_status_to_stage();
CREATE TRIGGER leads_touch_trigger BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION leads_touch_row();
CREATE TRIGGER trg_log_lead_stage_change AFTER INSERT OR UPDATE OF stage ON public.leads FOR EACH ROW EXECUTE FUNCTION log_lead_stage_change();
CREATE TRIGGER trg_margin_rules_touch BEFORE UPDATE ON public.margin_rules FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER marketing_budgets_updated_at BEFORE UPDATE ON public.marketing_budgets FOR EACH ROW EXECUTE FUNCTION marketing_budgets_set_updated_at();
CREATE TRIGGER marketing_campaigns_sync_owner_ids_trg BEFORE INSERT OR UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION marketing_campaigns_sync_owner_ids();
CREATE TRIGGER mc_touch BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION marketing_campaigns_touch_row();
CREATE TRIGGER trg_log_campaign_stage_change AFTER INSERT OR UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('marketing', 'stage');
CREATE TRIGGER marketing_deliverables_notifications_cascade_trg AFTER DELETE ON public.marketing_deliverables FOR EACH ROW EXECUTE FUNCTION notifications_cascade_delete_by_link('deliverables');
CREATE TRIGGER marketing_deliverables_sync_assignee_ids_trg BEFORE INSERT OR UPDATE ON public.marketing_deliverables FOR EACH ROW EXECUTE FUNCTION marketing_deliverables_sync_assignee_ids();
CREATE TRIGGER set_updated_at_deliverables BEFORE UPDATE ON public.marketing_deliverables FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at_deliverables();
CREATE TRIGGER trg_log_deliverable_stage_change AFTER INSERT OR UPDATE ON public.marketing_deliverables FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('marketing_deliverables', 'stage');
CREATE TRIGGER trg_marketing_deliverables_protocol_number BEFORE INSERT ON public.marketing_deliverables FOR EACH ROW EXECUTE FUNCTION marketing_deliverables_assign_protocol_number();
CREATE TRIGGER trg_marketing_deliverables_protocol_release AFTER DELETE ON public.marketing_deliverables FOR EACH ROW EXECUTE FUNCTION marketing_deliverables_release_protocol_number();
CREATE TRIGGER trg_marketing_deliverables_protocol_sync BEFORE UPDATE ON public.marketing_deliverables FOR EACH ROW EXECUTE FUNCTION marketing_deliverables_sync_protocol_number();
CREATE TRIGGER marketing_expense_items_sync_amount_trg AFTER INSERT OR DELETE OR UPDATE ON public.marketing_expense_items FOR EACH ROW EXECUTE FUNCTION marketing_expense_items_sync_amount();
CREATE TRIGGER marketing_expense_items_updated_at BEFORE UPDATE ON public.marketing_expense_items FOR EACH ROW EXECUTE FUNCTION marketing_expense_items_set_updated_at();
CREATE TRIGGER set_updated_at_expenses BEFORE UPDATE ON public.marketing_expenses FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at_expenses();
CREATE TRIGGER marketing_purchase_requests_guard_approval_trg BEFORE UPDATE ON public.marketing_purchase_requests FOR EACH ROW EXECUTE FUNCTION marketing_purchase_requests_guard_approval();
CREATE TRIGGER marketing_purchase_requests_notifications_cascade_trg AFTER DELETE ON public.marketing_purchase_requests FOR EACH ROW EXECUTE FUNCTION notifications_cascade_delete_by_link('purchase_requests');
CREATE TRIGGER marketing_purchase_requests_notify_new_trg AFTER INSERT ON public.marketing_purchase_requests FOR EACH ROW EXECUTE FUNCTION marketing_purchase_requests_notify_new();
CREATE TRIGGER marketing_purchase_requests_require_invoice_trg BEFORE UPDATE ON public.marketing_purchase_requests FOR EACH ROW EXECUTE FUNCTION marketing_purchase_requests_require_invoice();
CREATE TRIGGER marketing_purchase_requests_sync_expense_trg AFTER UPDATE ON public.marketing_purchase_requests FOR EACH ROW EXECUTE FUNCTION marketing_purchase_requests_sync_expense();
CREATE TRIGGER marketing_purchase_requests_sync_responsible_ids_trg BEFORE INSERT OR UPDATE ON public.marketing_purchase_requests FOR EACH ROW EXECUTE FUNCTION marketing_purchase_requests_sync_responsible_ids();
CREATE TRIGGER marketing_purchase_requests_updated_at BEFORE UPDATE ON public.marketing_purchase_requests FOR EACH ROW EXECUTE FUNCTION marketing_purchase_requests_set_updated_at();
CREATE TRIGGER trg_log_purchase_request_stage_change AFTER INSERT OR UPDATE ON public.marketing_purchase_requests FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('marketing_purchase_requests', 'stage');
CREATE TRIGGER marketing_requests_updated_at BEFORE UPDATE ON public.marketing_requests FOR EACH ROW EXECUTE FUNCTION marketing_requests_set_updated_at();
CREATE TRIGGER trg_marketing_requests_protocol_number BEFORE INSERT ON public.marketing_requests FOR EACH ROW EXECUTE FUNCTION marketing_requests_assign_protocol_number();
CREATE TRIGGER trg_marketing_requests_protocol_release AFTER DELETE ON public.marketing_requests FOR EACH ROW EXECUTE FUNCTION marketing_requests_release_protocol_number();
CREATE TRIGGER trg_marketing_requests_protocol_sync BEFORE UPDATE ON public.marketing_requests FOR EACH ROW EXECUTE FUNCTION marketing_requests_sync_protocol_number();
CREATE TRIGGER marketing_quotes_guard_approval_trg BEFORE UPDATE ON public.marketing_supplier_quotes FOR EACH ROW EXECUTE FUNCTION marketing_quotes_guard_approval();
CREATE TRIGGER marketing_tasks_updated_at BEFORE UPDATE ON public.marketing_tasks FOR EACH ROW EXECUTE FUNCTION marketing_tasks_set_updated_at();
CREATE TRIGGER trg_log_task_stage_change AFTER INSERT OR UPDATE ON public.marketing_tasks FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('marketing_tasks', 'stage');
CREATE TRIGGER trg_module_states_touch BEFORE UPDATE ON public.module_states FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER trg_order_items_total AFTER INSERT OR DELETE OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION recalc_order_total();
CREATE TRIGGER trg_orders_guard_stage BEFORE UPDATE OF situacao ON public.orders FOR EACH ROW EXECUTE FUNCTION orders_guard_stage_change();
CREATE TRIGGER trg_orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER personal_task_checklists_updated_at BEFORE UPDATE ON public.personal_task_checklists FOR EACH ROW EXECUTE FUNCTION personal_task_checklists_set_updated_at();
CREATE TRIGGER personal_task_stage_fields_updated_at BEFORE UPDATE ON public.personal_task_stage_fields FOR EACH ROW EXECUTE FUNCTION personal_task_stages_set_updated_at();
CREATE TRIGGER personal_task_stages_updated_at BEFORE UPDATE ON public.personal_task_stages FOR EACH ROW EXECUTE FUNCTION personal_task_stages_set_updated_at();
CREATE TRIGGER personal_tasks_updated_at BEFORE UPDATE ON public.personal_tasks FOR EACH ROW EXECUTE FUNCTION personal_tasks_set_updated_at();
CREATE TRIGGER pipeline_stage_fields_touch BEFORE UPDATE ON public.pipeline_stage_fields FOR EACH ROW EXECUTE FUNCTION update_agent_actions_updated_at();
CREATE TRIGGER posvenda_cases_set_updated_at BEFORE UPDATE ON public.posvenda_cases FOR EACH ROW EXECUTE FUNCTION posvenda_cases_set_updated_at();
CREATE TRIGGER trg_log_posvenda_stage_change AFTER INSERT OR UPDATE ON public.posvenda_cases FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('posvenda', 'stage');
CREATE TRIGGER trg_products_field_ownership BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION products_enforce_field_ownership();
CREATE TRIGGER trg_products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER chat_sync_channel_membership_trigger AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION chat_sync_channel_membership();
CREATE TRIGGER on_profile_created_ensure_secrets AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION profile_secrets_ensure_row();
CREATE TRIGGER on_profile_created_sync_colaborador AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION sync_profile_to_colaborador();
CREATE TRIGGER profiles_prevent_self_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_prevent_self_role_escalation();
CREATE TRIGGER profiles_sync_roles_trigger BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_sync_roles();
CREATE TRIGGER trg_proposal_line_items_sync_total AFTER INSERT OR DELETE OR UPDATE ON public.proposal_line_items FOR EACH ROW EXECUTE FUNCTION proposal_line_items_sync_total();
CREATE TRIGGER trg_proposal_line_items_touch BEFORE UPDATE ON public.proposal_line_items FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER trg_proposals_touch BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER trg_log_candidato_stage_change AFTER INSERT OR UPDATE ON public.rh_aplicacoes FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('candidatos', 'etapa_pipeline');
CREATE TRIGGER validate_stage BEFORE INSERT OR UPDATE OF etapa_pipeline ON public.rh_aplicacoes FOR EACH ROW EXECUTE FUNCTION validate_rh_stage();
CREATE TRIGGER rh_avaliacoes_sync_evaluator_ids_trg BEFORE INSERT OR UPDATE ON public.rh_avaliacoes FOR EACH ROW EXECUTE FUNCTION rh_avaliacoes_sync_evaluator_ids();
CREATE TRIGGER trg_log_avaliacao_status_change AFTER INSERT OR UPDATE ON public.rh_avaliacoes FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('feedback', 'status');
CREATE TRIGGER validate_stage_rh_avaliacoes BEFORE INSERT OR UPDATE OF status ON public.rh_avaliacoes FOR EACH ROW EXECUTE FUNCTION validate_rh_stage();
CREATE TRIGGER trg_log_colaborador_onboarding_change AFTER INSERT OR UPDATE ON public.rh_colaboradores FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('onboarding', 'onboarding_stage');
CREATE TRIGGER validate_stage BEFORE INSERT OR UPDATE OF onboarding_stage ON public.rh_colaboradores FOR EACH ROW EXECUTE FUNCTION validate_rh_stage();
CREATE TRIGGER trg_log_ferias_status_change AFTER INSERT OR UPDATE ON public.rh_ferias FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('ferias', 'status');
CREATE TRIGGER validate_stage_rh_ferias BEFORE INSERT OR UPDATE OF status ON public.rh_ferias FOR EACH ROW EXECUTE FUNCTION validate_rh_stage();
CREATE TRIGGER rh_movimentacoes_guard BEFORE UPDATE ON public.rh_movimentacoes FOR EACH ROW EXECUTE FUNCTION rh_movimentacoes_guard_approval();
CREATE TRIGGER trg_rh_onboarding_tarefas_guard_self_update BEFORE UPDATE ON public.rh_onboarding_tarefas FOR EACH ROW EXECUTE FUNCTION rh_onboarding_tarefas_guard_self_update();
CREATE TRIGGER trg_log_treinamento_atrib_status_change AFTER INSERT OR UPDATE ON public.rh_treinamento_atribuicoes FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('treinamentos', 'status');
CREATE TRIGGER validate_stage_rh_treinamento_atribuicoes BEFORE INSERT OR UPDATE OF status ON public.rh_treinamento_atribuicoes FOR EACH ROW EXECUTE FUNCTION validate_rh_stage();
CREATE TRIGGER rh_vagas_notifications_cascade_trg AFTER DELETE ON public.rh_vagas FOR EACH ROW EXECUTE FUNCTION notifications_cascade_delete_by_link('rh_vagas');
CREATE TRIGGER trg_log_vaga_stage_change AFTER INSERT OR UPDATE ON public.rh_vagas FOR EACH ROW EXECUTE FUNCTION log_rh_stage_change('vagas', 'stage');
CREATE TRIGGER trg_set_vaga_approved_at BEFORE INSERT OR UPDATE ON public.rh_vagas FOR EACH ROW EXECUTE FUNCTION set_vaga_approved_at();
CREATE TRIGGER validate_stage BEFORE INSERT OR UPDATE OF stage ON public.rh_vagas FOR EACH ROW EXECUTE FUNCTION validate_rh_stage();
CREATE TRIGGER sales_cases_updated_at BEFORE UPDATE ON public.sales_cases FOR EACH ROW EXECUTE FUNCTION sales_cases_set_updated_at();
CREATE TRIGGER uniform_items_updated_at BEFORE UPDATE ON public.uniform_items FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER uniform_people_updated_at BEFORE UPDATE ON public.uniform_people FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER uniform_person_sizes_updated_at BEFORE UPDATE ON public.uniform_person_sizes FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER uniform_round_lines_updated_at BEFORE UPDATE ON public.uniform_round_lines FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER uniform_rounds_updated_at BEFORE UPDATE ON public.uniform_rounds FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();
CREATE TRIGGER trg_whatsapp_conversations_touch BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION uniform_set_updated_at();

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comex_export_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comex_import_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_viagem_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_viagem_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_viagem_prestacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_viagem_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esg_emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esg_emission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esg_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_document_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_intelligence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_deliverable_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_expense_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_expense_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_protocol_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_quote_email_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncm_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_task_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_task_stage_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_task_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_tasks_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stage_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posvenda_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_module_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapp_cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapp_ibama ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_aplicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_bemestar_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_bemestar_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_beneficios_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_cargo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_colaborador_beneficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_curriculo_upload_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_data_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_fornecedor_contrato_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_fornecedor_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_onboarding_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_pesquisa_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_pesquisas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_pipeline_stage_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_report_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_treinamento_atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_vaga_manager_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_person_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_round_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
CREATE POLICY activities_diretoria_read ON public.activities AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY activities_insert ON public.activities AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((((performed_by IS NULL) OR (performed_by = ( SELECT auth.uid() AS uid))) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = activities.lead_id) AND (current_user_has_role('admin'::text) OR current_user_has_role('gerente'::text) OR (current_user_has_role('vendedor'::text) AND (l.company_id = ANY (current_user_companies())) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text)))))))));

CREATE POLICY activities_select ON public.activities AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = activities.lead_id) AND (current_user_has_role('admin'::text) OR current_user_has_role('gerente'::text) OR (current_user_has_role('vendedor'::text) AND (l.company_id = ANY (current_user_companies())) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text))))))));

CREATE POLICY activities_update ON public.activities AS PERMISSIVE FOR UPDATE TO public
  USING (((performed_by = ( SELECT auth.uid() AS uid)) OR (current_user_has_role('admin'::text) OR current_user_has_role('gerente'::text))));

CREATE POLICY agent_actions_diretoria_read ON public.agent_actions AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY agent_actions_manager_all ON public.agent_actions AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND ((company_id IS NULL) OR (company_id = ANY (current_user_companies()))))))
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND ((company_id IS NULL) OR (company_id = ANY (current_user_companies()))))));

CREATE POLICY agent_actions_rh_manager_all ON public.agent_actions AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles && ARRAY['gerente_rh'::text, 'admin'::text])))) AND ((company_id IS NULL) OR (company_id = ANY (current_user_companies())))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles && ARRAY['gerente_rh'::text, 'admin'::text])))) AND ((company_id IS NULL) OR (company_id = ANY (current_user_companies())))));

CREATE POLICY agent_actions_seller_read ON public.agent_actions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((lead_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (leads l
     JOIN profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((l.id = agent_actions.lead_id) AND (l.owner = (( SELECT auth.uid() AS uid))::text) AND ('vendedor'::text = ANY (p.roles)))))));

CREATE POLICY agent_actions_seller_resolve ON public.agent_actions AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((lead_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (leads l
     JOIN profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((l.id = agent_actions.lead_id) AND (l.owner = (( SELECT auth.uid() AS uid))::text) AND ('vendedor'::text = ANY (p.roles)))))))
  WITH CHECK ((status = ANY (ARRAY['approved'::text, 'rejected'::text, 'ignored'::text])));

CREATE POLICY automations_read ON public.automations AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY automations_write ON public.automations AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente'::text])))));

CREATE POLICY automations_write_rh ON public.automations AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles && ARRAY['gerente_rh'::text, 'admin'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles && ARRAY['gerente_rh'::text, 'admin'::text])))));

CREATE POLICY bug_reports_admin_all ON public.bug_reports AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY bug_reports_insert_own ON public.bug_reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((reported_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE (profiles.id = auth.uid())))));

CREATE POLICY bug_reports_select_own ON public.bug_reports AS PERMISSIVE FOR SELECT TO public
  USING ((reported_by = auth.uid()));

CREATE POLICY chat_members_read ON public.chat_channel_members AS PERMISSIVE FOR SELECT TO public
  USING (chat_is_member(channel_id));

CREATE POLICY chat_members_update_self ON public.chat_channel_members AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY chat_channels_read ON public.chat_channels AS PERMISSIVE FOR SELECT TO public
  USING (chat_is_member(id));

CREATE POLICY chat_messages_insert ON public.chat_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((author_id = auth.uid()) AND chat_can_post(channel_id)));

CREATE POLICY chat_messages_read ON public.chat_messages AS PERMISSIVE FOR SELECT TO public
  USING (chat_is_member(channel_id));

CREATE POLICY chat_messages_update_own ON public.chat_messages AS PERMISSIVE FOR UPDATE TO public
  USING ((author_id = auth.uid()))
  WITH CHECK ((author_id = auth.uid()));

CREATE POLICY chat_stickers_delete ON public.chat_stickers AS PERMISSIVE FOR DELETE TO public
  USING (chat_is_manager(auth.uid()));

CREATE POLICY chat_stickers_read ON public.chat_stickers AS PERMISSIVE FOR SELECT TO public
  USING ((active OR chat_is_manager(auth.uid())));

CREATE POLICY chat_stickers_update ON public.chat_stickers AS PERMISSIVE FOR UPDATE TO public
  USING (chat_is_manager(auth.uid()))
  WITH CHECK (chat_is_manager(auth.uid()));

CREATE POLICY chat_stickers_write ON public.chat_stickers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (chat_is_manager(auth.uid()));

CREATE POLICY client_addresses_cliente ON public.client_addresses AS PERMISSIVE FOR SELECT TO public
  USING ((client_id = current_user_client_id()));

CREATE POLICY client_addresses_interno ON public.client_addresses AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_can_manage_client(client_id)))
  WITH CHECK ((current_user_is_admin() OR current_user_can_manage_client(client_id)));

CREATE POLICY client_addresses_suporte_read ON public.client_addresses AS PERMISSIVE FOR SELECT TO public
  USING (is_comercial_support());

CREATE POLICY client_billing_history_delete ON public.client_billing_history AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (('gerente'::text = ANY (current_user_roles())) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_billing_history.client_id) AND (c.company_ids && current_user_companies())))))));

CREATE POLICY client_billing_history_insert ON public.client_billing_history AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR ((current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text]) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_billing_history.client_id) AND (c.company_ids && current_user_companies())))))));

CREATE POLICY client_billing_history_read ON public.client_billing_history AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('diretoria'::text) OR ((current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text]) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_billing_history.client_id) AND (c.company_ids && current_user_companies())))))));

CREATE POLICY client_billing_history_update ON public.client_billing_history AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR ((current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text]) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_billing_history.client_id) AND (c.company_ids && current_user_companies())))))))
  WITH CHECK ((current_user_is_admin() OR ((current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text]) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = client_billing_history.client_id) AND (c.company_ids && current_user_companies())))))));

CREATE POLICY client_contacts_cliente ON public.client_contacts AS PERMISSIVE FOR SELECT TO public
  USING ((client_id = current_user_client_id()));

CREATE POLICY client_contacts_interno ON public.client_contacts AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_can_manage_client(client_id)))
  WITH CHECK ((current_user_is_admin() OR current_user_can_manage_client(client_id)));

CREATE POLICY client_contacts_suporte_read ON public.client_contacts AS PERMISSIVE FOR SELECT TO public
  USING (is_comercial_support());

CREATE POLICY client_products_cliente ON public.client_products AS PERMISSIVE FOR SELECT TO public
  USING ((client_id = current_user_client_id()));

CREATE POLICY client_products_interno ON public.client_products AS PERMISSIVE FOR ALL TO public
  USING (current_user_can_manage_client(client_id))
  WITH CHECK (current_user_can_manage_client(client_id));

CREATE POLICY client_products_suporte_read ON public.client_products AS PERMISSIVE FOR SELECT TO public
  USING (is_comercial_support());

CREATE POLICY clients_cliente_read ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING ((id = current_user_client_id()));

CREATE POLICY clients_delete ON public.clients AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (('gerente'::text = ANY (current_user_roles())) AND (company_ids && current_user_companies()))));

CREATE POLICY clients_diretoria_read ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY clients_insert ON public.clients AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR ((current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text]) AND (company_ids && current_user_companies()))));

CREATE POLICY clients_read ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR ((current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text]) AND (company_ids && current_user_companies()))));

CREATE POLICY clients_update ON public.clients AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR ((current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text]) AND (company_ids && current_user_companies()))))
  WITH CHECK ((current_user_is_admin() OR ((current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text]) AND (company_ids && current_user_companies()))));

CREATE POLICY comex_export_operations_delete ON public.comex_export_operations AS PERMISSIVE FOR DELETE TO public
  USING (current_user_is_comex());

CREATE POLICY comex_export_operations_diretoria_read ON public.comex_export_operations AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY comex_export_operations_insert ON public.comex_export_operations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (current_user_is_comex());

CREATE POLICY comex_export_operations_select ON public.comex_export_operations AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_comex() OR current_user_has_role('diretoria'::text)));

CREATE POLICY comex_export_operations_update ON public.comex_export_operations AS PERMISSIVE FOR UPDATE TO public
  USING (current_user_is_comex())
  WITH CHECK (current_user_is_comex());

CREATE POLICY comex_import_operations_delete ON public.comex_import_operations AS PERMISSIVE FOR DELETE TO public
  USING (current_user_is_comex());

CREATE POLICY comex_import_operations_diretoria_read ON public.comex_import_operations AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY comex_import_operations_insert ON public.comex_import_operations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (current_user_is_comex());

CREATE POLICY comex_import_operations_select ON public.comex_import_operations AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_comex() OR current_user_has_role('diretoria'::text)));

CREATE POLICY comex_import_operations_update ON public.comex_import_operations AS PERMISSIVE FOR UPDATE TO public
  USING (current_user_is_comex())
  WITH CHECK (current_user_is_comex());

CREATE POLICY crm_viagem_categorias_read ON public.crm_viagem_categorias AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY crm_viagem_categorias_write ON public.crm_viagem_categorias AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente'::text])))));

CREATE POLICY crm_viagem_despesas_delete ON public.crm_viagem_despesas AS PERMISSIVE FOR DELETE TO public
  USING ((((vendedor_id = auth.uid()) AND (status_reembolso = ANY (ARRAY['pendente'::text, 'rejeitado'::text]))) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_despesas_insert ON public.crm_viagem_despesas AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((((vendedor_id = auth.uid()) AND (status_reembolso = 'pendente'::text)) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_despesas_read ON public.crm_viagem_despesas AS PERMISSIVE FOR SELECT TO public
  USING (((vendedor_id = auth.uid()) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_despesas_update ON public.crm_viagem_despesas AS PERMISSIVE FOR UPDATE TO public
  USING ((((vendedor_id = auth.uid()) AND (status_reembolso = 'pendente'::text)) OR current_user_manages_viagem_of(vendedor_id)))
  WITH CHECK ((((vendedor_id = auth.uid()) AND (status_reembolso = 'pendente'::text)) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_prestacoes_delete ON public.crm_viagem_prestacoes AS PERMISSIVE FOR DELETE TO public
  USING ((((vendedor_id = auth.uid()) AND (status = 'rascunho'::text)) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_prestacoes_insert ON public.crm_viagem_prestacoes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((((vendedor_id = auth.uid()) AND (status = 'rascunho'::text)) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_prestacoes_read ON public.crm_viagem_prestacoes AS PERMISSIVE FOR SELECT TO public
  USING (((vendedor_id = auth.uid()) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_prestacoes_update ON public.crm_viagem_prestacoes AS PERMISSIVE FOR UPDATE TO public
  USING ((((vendedor_id = auth.uid()) AND (status = 'rascunho'::text)) OR current_user_manages_viagem_of(vendedor_id)))
  WITH CHECK ((((vendedor_id = auth.uid()) AND (status = ANY (ARRAY['rascunho'::text, 'enviada'::text]))) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_registros_delete ON public.crm_viagem_registros AS PERMISSIVE FOR DELETE TO public
  USING (((vendedor_id = auth.uid()) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_registros_insert ON public.crm_viagem_registros AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((vendedor_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY crm_viagem_registros_read ON public.crm_viagem_registros AS PERMISSIVE FOR SELECT TO public
  USING (((vendedor_id = auth.uid()) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY crm_viagem_registros_update ON public.crm_viagem_registros AS PERMISSIVE FOR UPDATE TO public
  USING (((vendedor_id = auth.uid()) OR current_user_manages_viagem_of(vendedor_id)));

CREATE POLICY "Deliverable checklists manage" ON public.deliverable_checklists AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_marketing() OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM (marketing_deliverables md
     JOIN marketing_campaigns mc ON ((mc.id = md.campaign_id)))
  WHERE (md.id = deliverable_checklists.deliverable_id)))))
  WITH CHECK ((current_user_is_marketing() OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM (marketing_deliverables md
     JOIN marketing_campaigns mc ON ((mc.id = md.campaign_id)))
  WHERE (md.id = deliverable_checklists.deliverable_id)))));

CREATE POLICY "Deliverable checklists read" ON public.deliverable_checklists AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_marketing() OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM (marketing_deliverables md
     JOIN marketing_campaigns mc ON ((mc.id = md.campaign_id)))
  WHERE (md.id = deliverable_checklists.deliverable_id)))));

CREATE POLICY document_library_diretoria_read ON public.document_library AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY document_library_manage ON public.document_library AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_ids && current_user_companies()))))
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_ids && current_user_companies()))));

CREATE POLICY document_library_select ON public.document_library AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR ((current_user_has_role('gerente'::text) OR current_user_has_role('vendedor'::text)) AND (company_ids && current_user_companies()))));

CREATE POLICY email_templates_delete ON public.email_templates AS PERMISSIVE FOR DELETE TO public
  USING (((created_by = auth.uid()) OR current_user_is_admin()));

CREATE POLICY email_templates_insert ON public.email_templates AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((created_by = auth.uid()) AND (current_user_roles() && ARRAY['vendedor'::text, 'gerente'::text, 'admin'::text])));

CREATE POLICY email_templates_select ON public.email_templates AS PERMISSIVE FOR SELECT TO public
  USING (((scope = 'shared'::text) OR (created_by = auth.uid()) OR current_user_is_admin()));

CREATE POLICY email_templates_update ON public.email_templates AS PERMISSIVE FOR UPDATE TO public
  USING (((created_by = auth.uid()) OR current_user_is_admin()))
  WITH CHECK (((created_by = auth.uid()) OR current_user_is_admin()));

CREATE POLICY esg_emission_factors_insert ON public.esg_emission_factors AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (current_user_is_admin());

CREATE POLICY esg_emission_factors_select ON public.esg_emission_factors AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente'::text) OR current_user_has_role('diretoria'::text)));

CREATE POLICY esg_emission_factors_update ON public.esg_emission_factors AS PERMISSIVE FOR UPDATE TO public
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY esg_emission_records_insert ON public.esg_emission_records AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY esg_emission_records_select ON public.esg_emission_records AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR current_user_has_role('diretoria'::text)));

CREATE POLICY esg_reports_insert ON public.esg_reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY esg_reports_select ON public.esg_reports AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR current_user_has_role('diretoria'::text)));

CREATE POLICY export_audit_log_admin_read ON public.export_audit_log AS PERMISSIVE FOR SELECT TO public
  USING (current_user_is_admin());

CREATE POLICY export_audit_log_self_insert ON public.export_audit_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((exported_by = auth.uid()));

CREATE POLICY invitations_admin_delete ON public.invitations AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_manager() AND (role <> 'admin'::text))));

CREATE POLICY invitations_admin_insert ON public.invitations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_manager() AND (role <> 'admin'::text))));

CREATE POLICY invitations_admin_select ON public.invitations AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_is_manager()));

CREATE POLICY invitations_admin_update ON public.invitations AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_manager() AND (role <> 'admin'::text))));

CREATE POLICY attachments_delete ON public.lead_attachments AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_attachments.lead_id) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text) OR (l.owner = ANY (current_user_subordinate_ids())))))))));

CREATE POLICY attachments_insert ON public.lead_attachments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_attachments.lead_id) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text) OR (l.owner = ANY (current_user_subordinate_ids())))))))));

CREATE POLICY attachments_select ON public.lead_attachments AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_attachments.lead_id) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text) OR (l.owner = ANY (current_user_subordinate_ids())))))))));

CREATE POLICY lead_attachments_diretoria_read ON public.lead_attachments AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY lead_captures_auth_delete ON public.lead_captures AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_is_admin());

CREATE POLICY lead_captures_auth_select ON public.lead_captures AS PERMISSIVE FOR SELECT TO authenticated
  USING ((current_user_is_admin() OR (company_id = ANY (current_user_companies()))));

CREATE POLICY lead_captures_auth_update ON public.lead_captures AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((current_user_is_admin() OR (current_user_is_manager() AND (company_id = ANY (current_user_companies())))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_manager() AND (company_id = ANY (current_user_companies())))));

CREATE POLICY checklists_delete ON public.lead_checklists AS PERMISSIVE FOR DELETE TO authenticated
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_checklists.lead_id) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text))))))));

CREATE POLICY checklists_insert ON public.lead_checklists AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_checklists.lead_id) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text))))))));

CREATE POLICY checklists_select ON public.lead_checklists AS PERMISSIVE FOR SELECT TO authenticated
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_checklists.lead_id) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text))))))));

CREATE POLICY checklists_update ON public.lead_checklists AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_checklists.lead_id) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text))))))))
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_checklists.lead_id) AND ((l.owner IS NULL) OR (l.owner = (( SELECT auth.uid() AS uid))::text))))))));

CREATE POLICY lead_checklists_diretoria_read ON public.lead_checklists AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY lead_document_refs_all ON public.lead_document_refs AS PERMISSIVE FOR ALL TO public
  USING ((current_user_can_see_lead(lead_id) AND (EXISTS ( SELECT 1
   FROM document_library dl
  WHERE (dl.id = lead_document_refs.document_library_id)))))
  WITH CHECK ((current_user_can_see_lead(lead_id) AND (EXISTS ( SELECT 1
   FROM document_library dl
  WHERE ((dl.id = lead_document_refs.document_library_id) AND (current_user_is_admin() OR ((current_user_has_role('gerente'::text) OR current_user_has_role('vendedor'::text)) AND (dl.company_ids && current_user_companies()))))))));

CREATE POLICY lead_document_refs_diretoria_read ON public.lead_document_refs AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY lead_emails_select ON public.lead_emails AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_emails.lead_id) AND (current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (l.company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (l.company_id = ANY (current_user_companies())) AND (((auth.uid())::text = ANY (l.owner_ids)) OR (l.owner_ids && current_user_subordinate_ids()) OR ((l.owner_ids = '{}'::text[]) AND (l.sector IS NOT NULL) AND (l.sector = ANY (current_user_sectors()))))))))));

CREATE POLICY lead_samples_delete ON public.lead_samples AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_samples.lead_id) AND (current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (l.company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (l.company_id = ANY (current_user_companies())) AND ((auth.uid())::text = ANY (l.owner_ids))))))));

CREATE POLICY lead_samples_insert ON public.lead_samples AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_samples.lead_id) AND (current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (l.company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (l.company_id = ANY (current_user_companies())) AND ((auth.uid())::text = ANY (l.owner_ids))))))) AND ((created_by = auth.uid()) OR current_user_is_admin())));

CREATE POLICY lead_samples_select ON public.lead_samples AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_samples.lead_id) AND (current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (l.company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (l.company_id = ANY (current_user_companies())) AND ((l.owner_ids = '{}'::text[]) OR ((auth.uid())::text = ANY (l.owner_ids)) OR (l.owner_ids && current_user_subordinate_ids()))))))));

CREATE POLICY lead_samples_update ON public.lead_samples AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_samples.lead_id) AND (current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (l.company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (l.company_id = ANY (current_user_companies())) AND ((auth.uid())::text = ANY (l.owner_ids))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_samples.lead_id) AND (current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (l.company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (l.company_id = ANY (current_user_companies())) AND ((auth.uid())::text = ANY (l.owner_ids))))))));

CREATE POLICY lsh_select ON public.lead_stage_history AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_stage_history.lead_id) AND ((l.created_by = ( SELECT auth.uid() AS uid)) OR current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (l.company_id = ANY (current_user_companies()))))))));

CREATE POLICY leads_delete ON public.leads AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (is_demo = true))));

CREATE POLICY leads_diretoria_read ON public.leads AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY leads_insert ON public.leads AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((current_user_has_role('admin'::text) OR current_user_has_role('gerente'::text) OR current_user_has_role('vendedor'::text)) AND (current_user_is_admin() OR (company_id = ANY (current_user_companies())))));

CREATE POLICY leads_select ON public.leads AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (((auth.uid())::text = ANY (owner_ids)) OR (owner_ids && current_user_subordinate_ids()) OR ((owner_ids = '{}'::text[]) AND (sector IS NOT NULL) AND (sector = ANY (current_user_sectors())))))));

CREATE POLICY leads_update ON public.leads AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (((auth.uid())::text = ANY (owner_ids)) OR (owner_ids && current_user_subordinate_ids()) OR ((owner_ids = '{}'::text[]) AND (sector IS NOT NULL) AND (sector = ANY (current_user_sectors())))))))
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND (((auth.uid())::text = ANY (owner_ids)) OR (owner_ids && current_user_subordinate_ids()) OR ((owner_ids = '{}'::text[]) AND (sector IS NOT NULL) AND (sector = ANY (current_user_sectors())))))));

CREATE POLICY margin_rules_read ON public.margin_rules AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('diretoria'::text) OR ((is_comercial_operator() OR is_comercial_support()) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY margin_rules_write ON public.margin_rules AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies())))))
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY market_intelligence_items_read ON public.market_intelligence_items AS PERMISSIVE FOR SELECT TO authenticated
  USING (((status = 'published'::text) AND ((expires_at IS NULL) OR (expires_at > now())) AND (current_user_is_admin() OR ((current_user_roles() && ARRAY['vendedor'::text, 'gerente'::text, 'marketing'::text, 'gerente_marketing'::text]) AND ((relevant_for IS NULL) OR (relevant_for && current_user_companies()))))));

CREATE POLICY market_signals_read ON public.market_signals AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (company_id = ANY (current_user_companies()))));

CREATE POLICY marketing_budgets_delete ON public.marketing_budgets AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing_manager() AND ((cardinality(company_ids) = 0) OR (company_ids && current_user_companies())))));

CREATE POLICY marketing_budgets_insert ON public.marketing_budgets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing_manager() AND ((cardinality(company_ids) = 0) OR (company_ids && current_user_companies())))));

CREATE POLICY marketing_budgets_select ON public.marketing_budgets AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND ((cardinality(company_ids) = 0) OR (company_ids && current_user_companies()))) OR current_user_has_role('diretoria'::text)));

CREATE POLICY marketing_budgets_update ON public.marketing_budgets AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing_manager() AND ((cardinality(company_ids) = 0) OR (company_ids && current_user_companies())))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing_manager() AND ((cardinality(company_ids) = 0) OR (company_ids && current_user_companies())))));

CREATE POLICY marketing_campaign_attachments_diretoria_read ON public.marketing_campaign_attachments AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY mca_delete ON public.marketing_campaign_attachments AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY mca_insert ON public.marketing_campaign_attachments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies())) OR agencia_sees_supplier(( SELECT marketing_campaigns.supplier_id
   FROM marketing_campaigns
  WHERE (marketing_campaigns.id = marketing_campaign_attachments.campaign_id)))));

CREATE POLICY mca_read ON public.marketing_campaign_attachments AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies())) OR agencia_sees_supplier(( SELECT marketing_campaigns.supplier_id
   FROM marketing_campaigns
  WHERE (marketing_campaigns.id = marketing_campaign_attachments.campaign_id)))));

CREATE POLICY marketing_campaigns_diretoria_read ON public.marketing_campaigns AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY mc_read ON public.marketing_campaigns AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies())) OR agencia_sees_supplier(supplier_id)));

CREATE POLICY mc_write ON public.marketing_campaigns AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY "Deliverable attachments table delete" ON public.marketing_deliverable_attachments AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_marketing() OR current_user_has_role('agencia'::text)));

CREATE POLICY "Deliverable attachments table insert" ON public.marketing_deliverable_attachments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_marketing() OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM (marketing_deliverables md
     JOIN marketing_campaigns mc ON ((mc.id = md.campaign_id)))
  WHERE (md.id = marketing_deliverable_attachments.deliverable_id)))));

CREATE POLICY "Deliverable attachments table read" ON public.marketing_deliverable_attachments AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_marketing() OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM (marketing_deliverables md
     JOIN marketing_campaigns mc ON ((mc.id = md.campaign_id)))
  WHERE (md.id = marketing_deliverable_attachments.deliverable_id)))));

CREATE POLICY marketing_deliverable_attachments_diretoria_read ON public.marketing_deliverable_attachments AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY deliverables_delete ON public.marketing_deliverables AS PERMISSIVE FOR DELETE TO authenticated
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY deliverables_insert ON public.marketing_deliverables AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY deliverables_select ON public.marketing_deliverables AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies())) OR (current_user_roles() && ARRAY['agencia'::text])));

CREATE POLICY deliverables_update ON public.marketing_deliverables AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_deliverables_diretoria_read ON public.marketing_deliverables AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY md_update ON public.marketing_deliverables AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies())) OR ((current_user_roles() && ARRAY['agencia'::text]) AND (stage = ANY (ARRAY['encaminhado_para_agencia'::text, 'em_producao'::text])))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies())) OR ((current_user_roles() && ARRAY['agencia'::text]) AND (stage = ANY (ARRAY['encaminhado_para_agencia'::text, 'em_producao'::text])))));

CREATE POLICY marketing_expense_deliverables_delete ON public.marketing_expense_deliverables AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_deliverables.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_deliverables_insert ON public.marketing_expense_deliverables AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_deliverables.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_deliverables_select ON public.marketing_expense_deliverables AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('diretoria'::text) OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_deliverables.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_items_delete ON public.marketing_expense_items AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_items.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_items_insert ON public.marketing_expense_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_items.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_items_select ON public.marketing_expense_items AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('diretoria'::text) OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_items.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_items_update ON public.marketing_expense_items AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_items.expense_id) AND (me.company_ids && current_user_companies())))))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_items.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_tasks_delete ON public.marketing_expense_tasks AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_tasks.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_tasks_insert ON public.marketing_expense_tasks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_tasks.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expense_tasks_select ON public.marketing_expense_tasks AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('diretoria'::text) OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_expenses me
  WHERE ((me.id = marketing_expense_tasks.expense_id) AND (me.company_ids && current_user_companies())))))));

CREATE POLICY marketing_expenses_diretoria_read ON public.marketing_expenses AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY me_delete ON public.marketing_expenses AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY me_insert ON public.marketing_expenses AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY me_select ON public.marketing_expenses AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY me_update ON public.marketing_expenses AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_purchase_requests_delete ON public.marketing_purchase_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_purchase_requests_diretoria_read ON public.marketing_purchase_requests AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY marketing_purchase_requests_insert_internal ON public.marketing_purchase_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_purchase_requests_insert_public ON public.marketing_purchase_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((stage = 'solicitado'::text) AND (supplier_id IS NULL) AND (responsible_id IS NULL) AND (approved_by IS NULL) AND (approved_at IS NULL) AND (rejected_reason IS NULL) AND (invoice_url IS NULL) AND (invoice_date IS NULL) AND (expense_id IS NULL) AND (requested_by IS NULL) AND (company_ids <@ ARRAY['industria'::text, 'resibag'::text, 'montemor'::text])));

CREATE POLICY marketing_purchase_requests_read ON public.marketing_purchase_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_purchase_requests_update ON public.marketing_purchase_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_quote_email_template_diretoria_read ON public.marketing_quote_email_template AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY marketing_quote_email_template_read ON public.marketing_quote_email_template AS PERMISSIVE FOR SELECT TO public
  USING (current_user_is_marketing());

CREATE POLICY marketing_quote_email_template_update ON public.marketing_quote_email_template AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_marketing'::text)))
  WITH CHECK ((current_user_is_admin() OR current_user_has_role('gerente_marketing'::text)));

CREATE POLICY marketing_requests_diretoria_read ON public.marketing_requests AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY marketing_requests_read ON public.marketing_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_requests_write ON public.marketing_requests AS PERMISSIVE FOR ALL TO authenticated
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_supplier_quotes_delete ON public.marketing_supplier_quotes AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_supplier_quotes_diretoria_read ON public.marketing_supplier_quotes AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY marketing_supplier_quotes_insert ON public.marketing_supplier_quotes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))) AND (status = 'pendente'::text) AND (approved_by IS NULL) AND (approved_at IS NULL) AND (sent_at IS NULL)));

CREATE POLICY marketing_supplier_quotes_read ON public.marketing_supplier_quotes AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_supplier_quotes_update ON public.marketing_supplier_quotes AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_suppliers_delete ON public.marketing_suppliers AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_suppliers_diretoria_read ON public.marketing_suppliers AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY marketing_suppliers_insert ON public.marketing_suppliers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_suppliers_read ON public.marketing_suppliers AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_suppliers_update ON public.marketing_suppliers AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_tasks_delete ON public.marketing_tasks AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_tasks_insert ON public.marketing_tasks AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY marketing_tasks_select ON public.marketing_tasks AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies())) OR current_user_has_role('diretoria'::text)));

CREATE POLICY marketing_tasks_update ON public.marketing_tasks AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_marketing() AND (company_ids && current_user_companies()))));

CREATE POLICY module_states_read ON public.module_states AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));

CREATE POLICY module_states_write ON public.module_states AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY ncm_catalog_admin_write ON public.ncm_catalog AS PERMISSIVE FOR ALL TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY ncm_catalog_auth_read ON public.ncm_catalog AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY notifications_delete_own ON public.notifications AS PERMISSIVE FOR DELETE TO public
  USING ((recipient_id = auth.uid()));

CREATE POLICY notifications_select_own ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING ((recipient_id = auth.uid()));

CREATE POLICY notifications_update_own ON public.notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((recipient_id = auth.uid()))
  WITH CHECK ((recipient_id = auth.uid()));

CREATE POLICY order_items_cliente_delete ON public.order_items AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.client_id = current_user_client_id()) AND (o.situacao = 'rascunho'::text)))));

CREATE POLICY order_items_cliente_insert ON public.order_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.client_id = current_user_client_id()) AND (o.situacao = 'rascunho'::text)))) AND (EXISTS ( SELECT 1
   FROM client_products cp
  WHERE ((cp.product_id = order_items.product_id) AND (cp.client_id = current_user_client_id()) AND cp.active AND (cp.price = order_items.preco_unitario))))));

CREATE POLICY order_items_cliente_read ON public.order_items AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.client_id = current_user_client_id())))));

CREATE POLICY order_items_cliente_update ON public.order_items AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.client_id = current_user_client_id()) AND (o.situacao = 'rascunho'::text)))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.client_id = current_user_client_id()) AND (o.situacao = 'rascunho'::text)))) AND (EXISTS ( SELECT 1
   FROM client_products cp
  WHERE ((cp.product_id = order_items.product_id) AND (cp.client_id = current_user_client_id()) AND cp.active AND (cp.price = order_items.preco_unitario))))));

CREATE POLICY order_items_interno ON public.order_items AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (is_comercial_operator() OR is_comercial_support()) AND (o.company_id = ANY (current_user_companies()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (is_comercial_operator() OR is_comercial_support()) AND (o.company_id = ANY (current_user_companies()))))));

CREATE POLICY order_stage_history_read ON public.order_stage_history AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE (o.id = order_stage_history.order_id))));

CREATE POLICY orders_cliente_insert ON public.orders AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((client_id = current_user_client_id()) AND (company_id = ANY (current_user_client_companies())) AND (situacao = ANY (ARRAY['rascunho'::text, 'enviado'::text])) AND (kronosys_numero IS NULL) AND (confirmed_by IS NULL)));

CREATE POLICY orders_cliente_read ON public.orders AS PERMISSIVE FOR SELECT TO public
  USING ((client_id = current_user_client_id()));

CREATE POLICY orders_cliente_update ON public.orders AS PERMISSIVE FOR UPDATE TO public
  USING (((client_id = current_user_client_id()) AND (situacao = 'rascunho'::text)))
  WITH CHECK (((client_id = current_user_client_id()) AND (company_id = ANY (current_user_client_companies())) AND (situacao = ANY (ARRAY['rascunho'::text, 'enviado'::text])) AND (kronosys_numero IS NULL) AND (confirmed_by IS NULL)));

CREATE POLICY orders_interno_read ON public.orders AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('diretoria'::text) OR ((is_comercial_operator() OR is_comercial_support()) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY orders_interno_write ON public.orders AS PERMISSIVE FOR ALL TO public
  USING (((is_comercial_operator() OR is_comercial_support()) AND (company_id = ANY (current_user_companies()))))
  WITH CHECK (((is_comercial_operator() OR is_comercial_support()) AND (company_id = ANY (current_user_companies()))));

CREATE POLICY personal_events_owner_all ON public.personal_events AS PERMISSIVE FOR ALL TO public
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY personal_task_attachments_owner_all ON public.personal_task_attachments AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY personal_task_automations_owner_all ON public.personal_task_automations AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY personal_task_checklists_owner_all ON public.personal_task_checklists AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY personal_task_dependencies_owner_all ON public.personal_task_dependencies AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY personal_task_stage_fields_owner_all ON public.personal_task_stage_fields AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY personal_task_stages_owner_all ON public.personal_task_stages AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY personal_task_tags_owner_all ON public.personal_task_tags AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY personal_tasks_owner_all ON public.personal_tasks AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY personal_tasks_api_keys_self ON public.personal_tasks_api_keys AS PERMISSIVE FOR ALL TO public
  USING ((profile_id = auth.uid()))
  WITH CHECK ((profile_id = auth.uid()));

CREATE POLICY stage_fields_admin_delete ON public.pipeline_stage_fields AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_is_admin());

CREATE POLICY stage_fields_admin_insert ON public.pipeline_stage_fields AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_is_admin());

CREATE POLICY stage_fields_admin_update ON public.pipeline_stage_fields AS PERMISSIVE FOR UPDATE TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY stage_fields_select_by_company ON public.pipeline_stage_fields AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = ANY (current_user_companies())) OR current_user_is_admin()));

CREATE POLICY pipeline_stage_transitions_read ON public.pipeline_stage_transitions AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY pipeline_stage_transitions_write ON public.pipeline_stage_transitions AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente'::text])))));

CREATE POLICY posvenda_cases_delete ON public.posvenda_cases AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY posvenda_cases_diretoria_read ON public.posvenda_cases AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY posvenda_cases_insert ON public.posvenda_cases AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((current_user_has_role('admin'::text) OR current_user_has_role('gerente'::text) OR current_user_has_role('vendedor'::text)) AND (current_user_is_admin() OR (company_id = ANY (current_user_companies())))));

CREATE POLICY posvenda_cases_select ON public.posvenda_cases AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND ((owner_ids = '{}'::text[]) OR ((auth.uid())::text = ANY (owner_ids)) OR (owner_ids && current_user_subordinate_ids())))));

CREATE POLICY posvenda_cases_update ON public.posvenda_cases AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (current_user_has_role('vendedor'::text) AND (company_id = ANY (current_user_companies())) AND ((owner_ids = '{}'::text[]) OR ((auth.uid())::text = ANY (owner_ids)) OR (owner_ids && current_user_subordinate_ids())))));

CREATE POLICY products_read_cliente ON public.products AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM client_products cp
  WHERE ((cp.product_id = products.id) AND (cp.client_id = current_user_client_id()) AND cp.active))) AND active));

CREATE POLICY products_read_interno ON public.products AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('diretoria'::text) OR ((is_comercial_operator() OR is_comercial_support() OR (current_user_roles() && ARRAY['marketing'::text, 'gerente_marketing'::text])) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY products_write ON public.products AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR ((current_user_has_role('gerente'::text) OR is_comercial_support() OR (current_user_roles() && ARRAY['marketing'::text, 'gerente_marketing'::text])) AND (company_id = ANY (current_user_companies())))))
  WITH CHECK ((current_user_is_admin() OR ((current_user_has_role('gerente'::text) OR is_comercial_support() OR (current_user_roles() && ARRAY['marketing'::text, 'gerente_marketing'::text])) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY profile_module_overrides_admin_all ON public.profile_module_overrides AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY profile_module_overrides_self_select ON public.profile_module_overrides AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

CREATE POLICY profile_secrets_self ON public.profile_secrets AS PERMISSIVE FOR ALL TO public
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

CREATE POLICY profiles_delete ON public.profiles AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR (current_user_is_manager() AND (NOT ('admin'::text = ANY (COALESCE(roles, '{}'::text[])))) AND (companies && current_user_companies()))));

CREATE POLICY profiles_diretoria_read ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY profiles_select ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING (((id = auth.uid()) OR ('admin'::text = ANY (current_user_roles())) OR (('gerente'::text = ANY (current_user_roles())) AND (companies && current_user_companies())) OR ((current_user_roles() && ARRAY['marketing'::text, 'gerente_marketing'::text]) AND (roles && ARRAY['marketing'::text, 'gerente_marketing'::text])) OR ((current_user_roles() && ARRAY['rh'::text, 'gerente_rh'::text]) AND (roles && ARRAY['rh'::text, 'gerente_rh'::text])) OR ((current_user_roles() && ARRAY['agencia'::text]) AND (roles && ARRAY['marketing'::text, 'gerente_marketing'::text])) OR ((current_user_roles() && ARRAY['marketing'::text, 'gerente_marketing'::text]) AND (roles && ARRAY['agencia'::text])) OR ((current_user_roles() && ARRAY['vendedor'::text]) AND ((id)::text = ANY (current_user_subordinate_ids()))) OR ((current_user_roles() && ARRAY['vendedor'::text]) AND (companies && current_user_companies()))));

CREATE POLICY profiles_update ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_is_manager() AND (NOT ('admin'::text = ANY (COALESCE(roles, '{}'::text[])))) AND (companies && current_user_companies())) OR (id = ( SELECT auth.uid() AS uid))))
  WITH CHECK ((current_user_is_admin() OR (current_user_is_manager() AND (NOT ('admin'::text = ANY (COALESCE(roles, '{}'::text[])))) AND (companies && current_user_companies())) OR (id = ( SELECT auth.uid() AS uid))));

CREATE POLICY proposal_line_items_all ON public.proposal_line_items AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM proposals p
  WHERE ((p.id = proposal_line_items.proposal_id) AND current_user_can_see_lead(p.lead_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM proposals p
  WHERE ((p.id = proposal_line_items.proposal_id) AND current_user_can_see_lead(p.lead_id)))));

CREATE POLICY proposal_line_items_diretoria_read ON public.proposal_line_items AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY proposals_all ON public.proposals AS PERMISSIVE FOR ALL TO public
  USING (current_user_can_see_lead(lead_id))
  WITH CHECK (current_user_can_see_lead(lead_id));

CREATE POLICY proposals_diretoria_read ON public.proposals AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY prospect_seeds_read_scoped ON public.prospect_seeds AS PERMISSIVE FOR SELECT TO authenticated
  USING (((enabled = true) AND (NOT (current_user_roles() && ARRAY['agencia'::text, 'cliente'::text, 'fornecedor'::text])) AND (current_user_is_admin() OR (relevant_for && current_user_companies()))));

CREATE POLICY record_views_own_insert ON public.record_views AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY record_views_own_select ON public.record_views AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

CREATE POLICY record_views_own_update ON public.record_views AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY rh_aplicacoes_diretoria_read ON public.rh_aplicacoes AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_aplicacoes_rh_access ON public.rh_aplicacoes AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_attachments_comex_access ON public.rh_attachments AS PERMISSIVE FOR ALL TO public
  USING (((domain = 'comex'::text) AND current_user_is_comex()))
  WITH CHECK (((domain = 'comex'::text) AND current_user_is_comex()));

CREATE POLICY rh_attachments_diretoria_read ON public.rh_attachments AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_attachments_marketing_access ON public.rh_attachments AS PERMISSIVE FOR ALL TO public
  USING (((domain = ANY (ARRAY['marketing_tasks'::text, 'marketing_purchase_requests'::text])) AND current_user_is_marketing()))
  WITH CHECK (((domain = ANY (ARRAY['marketing_tasks'::text, 'marketing_purchase_requests'::text])) AND current_user_is_marketing()));

CREATE POLICY rh_attachments_marketing_campaigns_access ON public.rh_attachments AS PERMISSIVE FOR ALL TO public
  USING (((domain = 'marketing_campaigns'::text) AND (current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_campaigns mc
  WHERE ((mc.id = rh_attachments.record_id) AND (mc.company_ids && current_user_companies()))))) OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM marketing_campaigns mc
  WHERE (mc.id = rh_attachments.record_id))))))
  WITH CHECK (((domain = 'marketing_campaigns'::text) AND (current_user_is_admin() OR (current_user_is_marketing() AND (EXISTS ( SELECT 1
   FROM marketing_campaigns mc
  WHERE ((mc.id = rh_attachments.record_id) AND (mc.company_ids && current_user_companies()))))) OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM marketing_campaigns mc
  WHERE (mc.id = rh_attachments.record_id))))));

CREATE POLICY rh_attachments_marketing_deliverables_access ON public.rh_attachments AS PERMISSIVE FOR ALL TO public
  USING (((domain = 'marketing_deliverables'::text) AND (current_user_is_marketing() OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM (marketing_deliverables md
     JOIN marketing_campaigns mc ON ((mc.id = md.campaign_id)))
  WHERE (md.id = rh_attachments.record_id))))))
  WITH CHECK (((domain = 'marketing_deliverables'::text) AND (current_user_is_marketing() OR agencia_sees_supplier(( SELECT mc.supplier_id
   FROM (marketing_deliverables md
     JOIN marketing_campaigns mc ON ((mc.id = md.campaign_id)))
  WHERE (md.id = rh_attachments.record_id))))));

CREATE POLICY rh_attachments_posvenda_access ON public.rh_attachments AS PERMISSIVE FOR ALL TO public
  USING (((domain = 'posvenda'::text) AND (EXISTS ( SELECT 1
   FROM posvenda_cases pc
  WHERE (pc.id = rh_attachments.record_id)))))
  WITH CHECK (((domain = 'posvenda'::text) AND (EXISTS ( SELECT 1
   FROM posvenda_cases pc
  WHERE (pc.id = rh_attachments.record_id)))));

CREATE POLICY rh_attachments_rh_access ON public.rh_attachments AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)))
  WITH CHECK ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_attachments_self_read ON public.rh_attachments AS PERMISSIVE FOR SELECT TO public
  USING (((domain = ANY (ARRAY['onboarding'::text, 'holerite'::text, 'ponto'::text])) AND is_own_colaborador(record_id)));

CREATE POLICY rh_avaliacoes_diretoria_read ON public.rh_avaliacoes AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_avaliacoes_read ON public.rh_avaliacoes AS PERMISSIVE FOR SELECT TO public
  USING ((is_own_colaborador(user_id) OR (( SELECT auth.uid() AS uid) = ANY (evaluator_ids)) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text]))))));

CREATE POLICY rh_avaliacoes_write ON public.rh_avaliacoes AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_bemestar_fila_diretoria_read ON public.rh_bemestar_fila AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_bemestar_fila_rh_rw ON public.rh_bemestar_fila AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)))
  WITH CHECK ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_bemestar_sessoes_diretoria_read ON public.rh_bemestar_sessoes AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_bemestar_sessoes_rh_all ON public.rh_bemestar_sessoes AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)))
  WITH CHECK ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_beneficios_catalogo_diretoria_read ON public.rh_beneficios_catalogo AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_beneficios_catalogo_rh_access ON public.rh_beneficios_catalogo AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_candidatos_diretoria_read ON public.rh_candidatos AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_candidatos_rh_access ON public.rh_candidatos AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_cargo_templates_diretoria_read ON public.rh_cargo_templates AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_cargo_templates_rh_access ON public.rh_cargo_templates AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_checklists_comex_access ON public.rh_checklists AS PERMISSIVE FOR ALL TO public
  USING (((domain = 'comex'::text) AND current_user_is_comex()))
  WITH CHECK (((domain = 'comex'::text) AND current_user_is_comex()));

CREATE POLICY rh_checklists_diretoria_read ON public.rh_checklists AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_checklists_marketing_access ON public.rh_checklists AS PERMISSIVE FOR ALL TO public
  USING (((domain = ANY (ARRAY['marketing_tasks'::text, 'marketing_purchase_requests'::text])) AND current_user_is_marketing()))
  WITH CHECK (((domain = ANY (ARRAY['marketing_tasks'::text, 'marketing_purchase_requests'::text])) AND current_user_is_marketing()));

CREATE POLICY rh_checklists_rh_access ON public.rh_checklists AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)))
  WITH CHECK ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_colaborador_beneficios_diretoria_read ON public.rh_colaborador_beneficios AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_colaborador_beneficios_rh_access ON public.rh_colaborador_beneficios AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_colaborador_beneficios_self_read ON public.rh_colaborador_beneficios AS PERMISSIVE FOR SELECT TO public
  USING (is_own_colaborador(colaborador_id));

CREATE POLICY rh_colaboradores_diretoria_read ON public.rh_colaboradores AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_colaboradores_rh_access ON public.rh_colaboradores AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)))
  WITH CHECK ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_data_update_requests_rh_access ON public.rh_data_update_requests AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)))
  WITH CHECK ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_data_update_requests_self_insert ON public.rh_data_update_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((requested_by = auth.uid()) AND is_own_colaborador(colaborador_id) AND (status = 'pendente'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL)));

CREATE POLICY rh_data_update_requests_self_read ON public.rh_data_update_requests AS PERMISSIVE FOR SELECT TO public
  USING ((requested_by = auth.uid()));

CREATE POLICY rh_ferias_delete ON public.rh_ferias AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_ferias_diretoria_read ON public.rh_ferias AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_ferias_insert ON public.rh_ferias AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM rh_colaboradores
  WHERE ((rh_colaboradores.id = rh_ferias.user_id) AND (rh_colaboradores.profile_id = auth.uid())))) AND (status = 'pendente'::text) AND (approved_by IS NULL) AND (approved_at IS NULL)) OR current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_ferias_read ON public.rh_ferias AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM rh_colaboradores
  WHERE ((rh_colaboradores.id = rh_ferias.user_id) AND (rh_colaboradores.profile_id = auth.uid())))) OR current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_ferias_update ON public.rh_ferias AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_fornecedor_contrato_eventos_diretoria_read ON public.rh_fornecedor_contrato_eventos AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_fornecedor_contrato_eventos_rh_access ON public.rh_fornecedor_contrato_eventos AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_fornecedor_contratos_diretoria_read ON public.rh_fornecedor_contratos AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_fornecedor_contratos_rh_access ON public.rh_fornecedor_contratos AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_fornecedores_diretoria_read ON public.rh_fornecedores AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_fornecedores_rh_access ON public.rh_fornecedores AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_movimentacoes_delete ON public.rh_movimentacoes AS PERMISSIVE FOR DELETE TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_movimentacoes_diretoria_read ON public.rh_movimentacoes AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_movimentacoes_insert ON public.rh_movimentacoes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)) AND (status = 'pendente'::text) AND (approved_by IS NULL) AND (approved_at IS NULL)));

CREATE POLICY rh_movimentacoes_select ON public.rh_movimentacoes AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_movimentacoes_update ON public.rh_movimentacoes AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_onboarding_tarefas_delete ON public.rh_onboarding_tarefas AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_onboarding_tarefas_diretoria_read ON public.rh_onboarding_tarefas AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_onboarding_tarefas_read ON public.rh_onboarding_tarefas AS PERMISSIVE FOR SELECT TO public
  USING ((is_own_colaborador(colaborador_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text]))))));

CREATE POLICY rh_onboarding_tarefas_update ON public.rh_onboarding_tarefas AS PERMISSIVE FOR UPDATE TO public
  USING ((is_own_colaborador(colaborador_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text]))))));

CREATE POLICY rh_onboarding_tarefas_write ON public.rh_onboarding_tarefas AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_onboarding_templates_diretoria_read ON public.rh_onboarding_templates AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_onboarding_templates_rh_access ON public.rh_onboarding_templates AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_pesquisas_diretoria_read ON public.rh_pesquisas AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_pesquisas_rh_all ON public.rh_pesquisas AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)))
  WITH CHECK ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY rh_pipeline_stage_fields_read ON public.rh_pipeline_stage_fields AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY rh_pipeline_stage_fields_write ON public.rh_pipeline_stage_fields AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR ((current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)) AND (domain = ANY (ARRAY['vagas'::text, 'onboarding'::text, 'ferias'::text, 'feedback'::text, 'candidatos'::text, 'treinamentos'::text]))) OR ((current_user_has_role('marketing'::text) OR current_user_has_role('gerente_marketing'::text)) AND (domain = ANY (ARRAY['marketing'::text, 'marketing_deliverables'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text]))) OR (current_user_has_role('comex'::text) AND (domain = ANY (ARRAY['comex_importacao'::text, 'comex_exportacao'::text])))))
  WITH CHECK ((current_user_is_admin() OR ((current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)) AND (domain = ANY (ARRAY['vagas'::text, 'onboarding'::text, 'ferias'::text, 'feedback'::text, 'candidatos'::text, 'treinamentos'::text]))) OR ((current_user_has_role('marketing'::text) OR current_user_has_role('gerente_marketing'::text)) AND (domain = ANY (ARRAY['marketing'::text, 'marketing_deliverables'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text]))) OR (current_user_has_role('comex'::text) AND (domain = ANY (ARRAY['comex_importacao'::text, 'comex_exportacao'::text])))));

CREATE POLICY rh_stage_fields_posvenda_write ON public.rh_pipeline_stage_fields AS PERMISSIVE FOR ALL TO public
  USING (((domain = 'posvenda'::text) AND (current_user_is_admin() OR current_user_has_role('gerente'::text))))
  WITH CHECK (((domain = 'posvenda'::text) AND (current_user_is_admin() OR current_user_has_role('gerente'::text))));

CREATE POLICY rh_pipeline_stages_posvenda_write ON public.rh_pipeline_stages AS PERMISSIVE FOR ALL TO public
  USING (((domain = 'posvenda'::text) AND (current_user_is_admin() OR current_user_has_role('gerente'::text))))
  WITH CHECK (((domain = 'posvenda'::text) AND (current_user_is_admin() OR current_user_has_role('gerente'::text))));

CREATE POLICY rh_pipeline_stages_read ON public.rh_pipeline_stages AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY rh_pipeline_stages_write ON public.rh_pipeline_stages AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (domain = 'comercial'::text)) OR ((current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)) AND (domain = ANY (ARRAY['vagas'::text, 'onboarding'::text, 'ferias'::text, 'feedback'::text, 'candidatos'::text, 'treinamentos'::text]))) OR ((current_user_has_role('marketing'::text) OR current_user_has_role('gerente_marketing'::text)) AND (domain = ANY (ARRAY['marketing'::text, 'marketing_deliverables'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text]))) OR (current_user_has_role('comex'::text) AND (domain = ANY (ARRAY['comex_importacao'::text, 'comex_exportacao'::text])))))
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (domain = 'comercial'::text)) OR ((current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)) AND (domain = ANY (ARRAY['vagas'::text, 'onboarding'::text, 'ferias'::text, 'feedback'::text, 'candidatos'::text, 'treinamentos'::text]))) OR ((current_user_has_role('marketing'::text) OR current_user_has_role('gerente_marketing'::text)) AND (domain = ANY (ARRAY['marketing'::text, 'marketing_deliverables'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text]))) OR (current_user_has_role('comex'::text) AND (domain = ANY (ARRAY['comex_importacao'::text, 'comex_exportacao'::text])))));

CREATE POLICY rh_report_presets_diretoria_read ON public.rh_report_presets AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_report_presets_rh_access ON public.rh_report_presets AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_signature_requests_diretoria_read ON public.rh_signature_requests AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_signature_requests_rh_access ON public.rh_signature_requests AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_stage_history_comex_access ON public.rh_stage_history AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_comex() AND (domain = 'comex'::text)))
  WITH CHECK ((current_user_is_comex() AND (domain = 'comex'::text)));

CREATE POLICY rh_stage_history_diretoria_read ON public.rh_stage_history AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_stage_history_marketing_access ON public.rh_stage_history AS PERMISSIVE FOR ALL TO public
  USING ((current_user_is_marketing() AND (domain = ANY (ARRAY['marketing'::text, 'marketing_deliverables'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text]))))
  WITH CHECK ((current_user_is_marketing() AND (domain = ANY (ARRAY['marketing'::text, 'marketing_deliverables'::text, 'marketing_tasks'::text, 'marketing_purchase_requests'::text]))));

CREATE POLICY rh_stage_history_posvenda_access ON public.rh_stage_history AS PERMISSIVE FOR ALL TO public
  USING (((domain = 'posvenda'::text) AND (EXISTS ( SELECT 1
   FROM posvenda_cases pc
  WHERE (pc.id = rh_stage_history.record_id)))))
  WITH CHECK (((domain = 'posvenda'::text) AND (EXISTS ( SELECT 1
   FROM posvenda_cases pc
  WHERE (pc.id = rh_stage_history.record_id)))));

CREATE POLICY rh_stage_history_rh_access ON public.rh_stage_history AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_stage_history_self_read ON public.rh_stage_history AS PERMISSIVE FOR SELECT TO public
  USING (((domain = 'onboarding'::text) AND is_own_colaborador(record_id)));

CREATE POLICY rh_treinamento_atrib_delete ON public.rh_treinamento_atribuicoes AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_treinamento_atrib_diretoria_read ON public.rh_treinamento_atribuicoes AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_treinamento_atrib_insert ON public.rh_treinamento_atribuicoes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_treinamento_atrib_read ON public.rh_treinamento_atribuicoes AS PERMISSIVE FOR SELECT TO public
  USING ((is_own_colaborador(colaborador_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text]))))));

CREATE POLICY rh_treinamento_atrib_update ON public.rh_treinamento_atribuicoes AS PERMISSIVE FOR UPDATE TO public
  USING ((is_own_colaborador(colaborador_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text]))))))
  WITH CHECK (((is_own_colaborador(colaborador_id) AND (status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'vencido'::text])) AND ((data_conclusao IS NULL) OR ((data_conclusao >= (now() - '00:05:00'::interval)) AND (data_conclusao <= (now() + '00:01:00'::interval))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text]))))));

CREATE POLICY rh_treinamentos_read ON public.rh_treinamentos AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY rh_treinamentos_write ON public.rh_treinamentos AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY rh_vaga_manager_links_diretoria_read ON public.rh_vaga_manager_links AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_vaga_manager_links_rh_access ON public.rh_vaga_manager_links AS PERMISSIVE FOR ALL TO public
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

CREATE POLICY rh_vagas_diretoria_read ON public.rh_vagas AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY rh_vagas_rh_access ON public.rh_vagas AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['admin'::text, 'gerente_rh'::text, 'rh'::text])))));

CREATE POLICY sales_cases_delete ON public.sales_cases AS PERMISSIVE FOR DELETE TO public
  USING (current_user_is_admin());

CREATE POLICY sales_cases_insert ON public.sales_cases AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_is_admin() OR ((created_by = auth.uid()) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY sales_cases_select ON public.sales_cases AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('diretoria'::text) OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR (created_by = auth.uid())));

CREATE POLICY sales_cases_update ON public.sales_cases AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR ((created_by = auth.uid()) AND (company_id = ANY (current_user_companies())))))
  WITH CHECK ((current_user_is_admin() OR (current_user_has_role('gerente'::text) AND (company_id = ANY (current_user_companies()))) OR ((created_by = auth.uid()) AND (company_id = ANY (current_user_companies())))));

CREATE POLICY terms_acceptances_rh_read ON public.terms_acceptances AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_is_admin() OR current_user_has_role('gerente_rh'::text) OR current_user_has_role('rh'::text)));

CREATE POLICY terms_acceptances_self ON public.terms_acceptances AS PERMISSIVE FOR ALL TO public
  USING ((profile_id = auth.uid()))
  WITH CHECK ((profile_id = auth.uid()));

CREATE POLICY uniform_items_read ON public.uniform_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((uniform_can_write() OR current_user_has_role('diretoria'::text)));

CREATE POLICY uniform_items_write ON public.uniform_items AS PERMISSIVE FOR ALL TO authenticated
  USING (uniform_can_write())
  WITH CHECK (uniform_can_write());

CREATE POLICY uniform_people_read ON public.uniform_people AS PERMISSIVE FOR SELECT TO authenticated
  USING ((uniform_can_write() OR current_user_has_role('diretoria'::text)));

CREATE POLICY uniform_people_write ON public.uniform_people AS PERMISSIVE FOR ALL TO authenticated
  USING (uniform_can_write())
  WITH CHECK (uniform_can_write());

CREATE POLICY uniform_person_sizes_read ON public.uniform_person_sizes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((uniform_can_write() OR current_user_has_role('diretoria'::text)));

CREATE POLICY uniform_person_sizes_write ON public.uniform_person_sizes AS PERMISSIVE FOR ALL TO authenticated
  USING (uniform_can_write())
  WITH CHECK (uniform_can_write());

CREATE POLICY uniform_round_lines_read ON public.uniform_round_lines AS PERMISSIVE FOR SELECT TO authenticated
  USING ((uniform_can_write() OR current_user_has_role('diretoria'::text)));

CREATE POLICY uniform_round_lines_write ON public.uniform_round_lines AS PERMISSIVE FOR ALL TO authenticated
  USING (uniform_can_write())
  WITH CHECK (uniform_can_write());

CREATE POLICY uniform_rounds_read ON public.uniform_rounds AS PERMISSIVE FOR SELECT TO authenticated
  USING ((uniform_can_write() OR current_user_has_role('diretoria'::text)));

CREATE POLICY uniform_rounds_write ON public.uniform_rounds AS PERMISSIVE FOR ALL TO authenticated
  USING (uniform_can_write())
  WITH CHECK (uniform_can_write());

CREATE POLICY whatsapp_conversations_all ON public.whatsapp_conversations AS PERMISSIVE FOR ALL TO public
  USING ((((lead_id IS NOT NULL) AND current_user_can_see_lead(lead_id)) OR ((client_id IS NOT NULL) AND (current_user_is_admin() OR current_user_can_manage_client(client_id)))))
  WITH CHECK ((((lead_id IS NOT NULL) AND current_user_can_see_lead(lead_id)) OR ((client_id IS NOT NULL) AND (current_user_is_admin() OR current_user_can_manage_client(client_id)))));

CREATE POLICY whatsapp_conversations_diretoria_read ON public.whatsapp_conversations AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

CREATE POLICY whatsapp_messages_all ON public.whatsapp_messages AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM whatsapp_conversations c
  WHERE ((c.id = whatsapp_messages.conversation_id) AND (((c.lead_id IS NOT NULL) AND current_user_can_see_lead(c.lead_id)) OR ((c.client_id IS NOT NULL) AND (current_user_is_admin() OR current_user_can_manage_client(c.client_id))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM whatsapp_conversations c
  WHERE ((c.id = whatsapp_messages.conversation_id) AND (((c.lead_id IS NOT NULL) AND current_user_can_see_lead(c.lead_id)) OR ((c.client_id IS NOT NULL) AND (current_user_is_admin() OR current_user_can_manage_client(c.client_id))))))));

CREATE POLICY whatsapp_messages_diretoria_read ON public.whatsapp_messages AS PERMISSIVE FOR SELECT TO public
  USING (current_user_has_role('diretoria'::text));

-- ============ GRANTS DE TABELA ============
GRANT DELETE ON public.activities TO anon;
GRANT INSERT ON public.activities TO anon;
GRANT REFERENCES ON public.activities TO anon;
GRANT SELECT ON public.activities TO anon;
GRANT TRIGGER ON public.activities TO anon;
GRANT TRUNCATE ON public.activities TO anon;
GRANT UPDATE ON public.activities TO anon;
GRANT DELETE ON public.activities TO authenticated;
GRANT INSERT ON public.activities TO authenticated;
GRANT REFERENCES ON public.activities TO authenticated;
GRANT SELECT ON public.activities TO authenticated;
GRANT TRIGGER ON public.activities TO authenticated;
GRANT TRUNCATE ON public.activities TO authenticated;
GRANT UPDATE ON public.activities TO authenticated;
GRANT DELETE ON public.activities TO service_role;
GRANT INSERT ON public.activities TO service_role;
GRANT REFERENCES ON public.activities TO service_role;
GRANT SELECT ON public.activities TO service_role;
GRANT TRIGGER ON public.activities TO service_role;
GRANT TRUNCATE ON public.activities TO service_role;
GRANT UPDATE ON public.activities TO service_role;
GRANT DELETE ON public.agent_actions TO anon;
GRANT INSERT ON public.agent_actions TO anon;
GRANT REFERENCES ON public.agent_actions TO anon;
GRANT SELECT ON public.agent_actions TO anon;
GRANT TRIGGER ON public.agent_actions TO anon;
GRANT TRUNCATE ON public.agent_actions TO anon;
GRANT UPDATE ON public.agent_actions TO anon;
GRANT DELETE ON public.agent_actions TO authenticated;
GRANT INSERT ON public.agent_actions TO authenticated;
GRANT REFERENCES ON public.agent_actions TO authenticated;
GRANT SELECT ON public.agent_actions TO authenticated;
GRANT TRIGGER ON public.agent_actions TO authenticated;
GRANT TRUNCATE ON public.agent_actions TO authenticated;
GRANT UPDATE ON public.agent_actions TO authenticated;
GRANT DELETE ON public.agent_actions TO service_role;
GRANT INSERT ON public.agent_actions TO service_role;
GRANT REFERENCES ON public.agent_actions TO service_role;
GRANT SELECT ON public.agent_actions TO service_role;
GRANT TRIGGER ON public.agent_actions TO service_role;
GRANT TRUNCATE ON public.agent_actions TO service_role;
GRANT UPDATE ON public.agent_actions TO service_role;
GRANT DELETE ON public.automations TO anon;
GRANT INSERT ON public.automations TO anon;
GRANT REFERENCES ON public.automations TO anon;
GRANT SELECT ON public.automations TO anon;
GRANT TRIGGER ON public.automations TO anon;
GRANT TRUNCATE ON public.automations TO anon;
GRANT UPDATE ON public.automations TO anon;
GRANT DELETE ON public.automations TO authenticated;
GRANT INSERT ON public.automations TO authenticated;
GRANT REFERENCES ON public.automations TO authenticated;
GRANT SELECT ON public.automations TO authenticated;
GRANT TRIGGER ON public.automations TO authenticated;
GRANT TRUNCATE ON public.automations TO authenticated;
GRANT UPDATE ON public.automations TO authenticated;
GRANT DELETE ON public.automations TO service_role;
GRANT INSERT ON public.automations TO service_role;
GRANT REFERENCES ON public.automations TO service_role;
GRANT SELECT ON public.automations TO service_role;
GRANT TRIGGER ON public.automations TO service_role;
GRANT TRUNCATE ON public.automations TO service_role;
GRANT UPDATE ON public.automations TO service_role;
GRANT DELETE ON public.bug_reports TO anon;
GRANT INSERT ON public.bug_reports TO anon;
GRANT REFERENCES ON public.bug_reports TO anon;
GRANT SELECT ON public.bug_reports TO anon;
GRANT TRIGGER ON public.bug_reports TO anon;
GRANT TRUNCATE ON public.bug_reports TO anon;
GRANT UPDATE ON public.bug_reports TO anon;
GRANT DELETE ON public.bug_reports TO authenticated;
GRANT INSERT ON public.bug_reports TO authenticated;
GRANT REFERENCES ON public.bug_reports TO authenticated;
GRANT SELECT ON public.bug_reports TO authenticated;
GRANT TRIGGER ON public.bug_reports TO authenticated;
GRANT TRUNCATE ON public.bug_reports TO authenticated;
GRANT UPDATE ON public.bug_reports TO authenticated;
GRANT DELETE ON public.bug_reports TO service_role;
GRANT INSERT ON public.bug_reports TO service_role;
GRANT REFERENCES ON public.bug_reports TO service_role;
GRANT SELECT ON public.bug_reports TO service_role;
GRANT TRIGGER ON public.bug_reports TO service_role;
GRANT TRUNCATE ON public.bug_reports TO service_role;
GRANT UPDATE ON public.bug_reports TO service_role;
GRANT DELETE ON public.chat_channel_members TO anon;
GRANT INSERT ON public.chat_channel_members TO anon;
GRANT REFERENCES ON public.chat_channel_members TO anon;
GRANT SELECT ON public.chat_channel_members TO anon;
GRANT TRIGGER ON public.chat_channel_members TO anon;
GRANT TRUNCATE ON public.chat_channel_members TO anon;
GRANT UPDATE ON public.chat_channel_members TO anon;
GRANT DELETE ON public.chat_channel_members TO authenticated;
GRANT INSERT ON public.chat_channel_members TO authenticated;
GRANT REFERENCES ON public.chat_channel_members TO authenticated;
GRANT SELECT ON public.chat_channel_members TO authenticated;
GRANT TRIGGER ON public.chat_channel_members TO authenticated;
GRANT TRUNCATE ON public.chat_channel_members TO authenticated;
GRANT UPDATE ON public.chat_channel_members TO authenticated;
GRANT DELETE ON public.chat_channel_members TO service_role;
GRANT INSERT ON public.chat_channel_members TO service_role;
GRANT REFERENCES ON public.chat_channel_members TO service_role;
GRANT SELECT ON public.chat_channel_members TO service_role;
GRANT TRIGGER ON public.chat_channel_members TO service_role;
GRANT TRUNCATE ON public.chat_channel_members TO service_role;
GRANT UPDATE ON public.chat_channel_members TO service_role;
GRANT DELETE ON public.chat_channels TO anon;
GRANT INSERT ON public.chat_channels TO anon;
GRANT REFERENCES ON public.chat_channels TO anon;
GRANT SELECT ON public.chat_channels TO anon;
GRANT TRIGGER ON public.chat_channels TO anon;
GRANT TRUNCATE ON public.chat_channels TO anon;
GRANT UPDATE ON public.chat_channels TO anon;
GRANT DELETE ON public.chat_channels TO authenticated;
GRANT INSERT ON public.chat_channels TO authenticated;
GRANT REFERENCES ON public.chat_channels TO authenticated;
GRANT SELECT ON public.chat_channels TO authenticated;
GRANT TRIGGER ON public.chat_channels TO authenticated;
GRANT TRUNCATE ON public.chat_channels TO authenticated;
GRANT UPDATE ON public.chat_channels TO authenticated;
GRANT DELETE ON public.chat_channels TO service_role;
GRANT INSERT ON public.chat_channels TO service_role;
GRANT REFERENCES ON public.chat_channels TO service_role;
GRANT SELECT ON public.chat_channels TO service_role;
GRANT TRIGGER ON public.chat_channels TO service_role;
GRANT TRUNCATE ON public.chat_channels TO service_role;
GRANT UPDATE ON public.chat_channels TO service_role;
GRANT DELETE ON public.chat_messages TO anon;
GRANT INSERT ON public.chat_messages TO anon;
GRANT REFERENCES ON public.chat_messages TO anon;
GRANT SELECT ON public.chat_messages TO anon;
GRANT TRIGGER ON public.chat_messages TO anon;
GRANT TRUNCATE ON public.chat_messages TO anon;
GRANT UPDATE ON public.chat_messages TO anon;
GRANT DELETE ON public.chat_messages TO authenticated;
GRANT INSERT ON public.chat_messages TO authenticated;
GRANT REFERENCES ON public.chat_messages TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT TRIGGER ON public.chat_messages TO authenticated;
GRANT TRUNCATE ON public.chat_messages TO authenticated;
GRANT UPDATE ON public.chat_messages TO authenticated;
GRANT DELETE ON public.chat_messages TO service_role;
GRANT INSERT ON public.chat_messages TO service_role;
GRANT REFERENCES ON public.chat_messages TO service_role;
GRANT SELECT ON public.chat_messages TO service_role;
GRANT TRIGGER ON public.chat_messages TO service_role;
GRANT TRUNCATE ON public.chat_messages TO service_role;
GRANT UPDATE ON public.chat_messages TO service_role;
GRANT DELETE ON public.chat_stickers TO anon;
GRANT INSERT ON public.chat_stickers TO anon;
GRANT REFERENCES ON public.chat_stickers TO anon;
GRANT SELECT ON public.chat_stickers TO anon;
GRANT TRIGGER ON public.chat_stickers TO anon;
GRANT TRUNCATE ON public.chat_stickers TO anon;
GRANT UPDATE ON public.chat_stickers TO anon;
GRANT DELETE ON public.chat_stickers TO authenticated;
GRANT INSERT ON public.chat_stickers TO authenticated;
GRANT REFERENCES ON public.chat_stickers TO authenticated;
GRANT SELECT ON public.chat_stickers TO authenticated;
GRANT TRIGGER ON public.chat_stickers TO authenticated;
GRANT TRUNCATE ON public.chat_stickers TO authenticated;
GRANT UPDATE ON public.chat_stickers TO authenticated;
GRANT DELETE ON public.chat_stickers TO service_role;
GRANT INSERT ON public.chat_stickers TO service_role;
GRANT REFERENCES ON public.chat_stickers TO service_role;
GRANT SELECT ON public.chat_stickers TO service_role;
GRANT TRIGGER ON public.chat_stickers TO service_role;
GRANT TRUNCATE ON public.chat_stickers TO service_role;
GRANT UPDATE ON public.chat_stickers TO service_role;
GRANT DELETE ON public.client_addresses TO anon;
GRANT INSERT ON public.client_addresses TO anon;
GRANT REFERENCES ON public.client_addresses TO anon;
GRANT SELECT ON public.client_addresses TO anon;
GRANT TRIGGER ON public.client_addresses TO anon;
GRANT TRUNCATE ON public.client_addresses TO anon;
GRANT UPDATE ON public.client_addresses TO anon;
GRANT DELETE ON public.client_addresses TO authenticated;
GRANT INSERT ON public.client_addresses TO authenticated;
GRANT REFERENCES ON public.client_addresses TO authenticated;
GRANT SELECT ON public.client_addresses TO authenticated;
GRANT TRIGGER ON public.client_addresses TO authenticated;
GRANT TRUNCATE ON public.client_addresses TO authenticated;
GRANT UPDATE ON public.client_addresses TO authenticated;
GRANT DELETE ON public.client_addresses TO service_role;
GRANT INSERT ON public.client_addresses TO service_role;
GRANT REFERENCES ON public.client_addresses TO service_role;
GRANT SELECT ON public.client_addresses TO service_role;
GRANT TRIGGER ON public.client_addresses TO service_role;
GRANT TRUNCATE ON public.client_addresses TO service_role;
GRANT UPDATE ON public.client_addresses TO service_role;
GRANT DELETE ON public.client_billing_history TO anon;
GRANT INSERT ON public.client_billing_history TO anon;
GRANT REFERENCES ON public.client_billing_history TO anon;
GRANT SELECT ON public.client_billing_history TO anon;
GRANT TRIGGER ON public.client_billing_history TO anon;
GRANT TRUNCATE ON public.client_billing_history TO anon;
GRANT UPDATE ON public.client_billing_history TO anon;
GRANT DELETE ON public.client_billing_history TO authenticated;
GRANT INSERT ON public.client_billing_history TO authenticated;
GRANT REFERENCES ON public.client_billing_history TO authenticated;
GRANT SELECT ON public.client_billing_history TO authenticated;
GRANT TRIGGER ON public.client_billing_history TO authenticated;
GRANT TRUNCATE ON public.client_billing_history TO authenticated;
GRANT UPDATE ON public.client_billing_history TO authenticated;
GRANT DELETE ON public.client_billing_history TO service_role;
GRANT INSERT ON public.client_billing_history TO service_role;
GRANT REFERENCES ON public.client_billing_history TO service_role;
GRANT SELECT ON public.client_billing_history TO service_role;
GRANT TRIGGER ON public.client_billing_history TO service_role;
GRANT TRUNCATE ON public.client_billing_history TO service_role;
GRANT UPDATE ON public.client_billing_history TO service_role;
GRANT DELETE ON public.client_contacts TO anon;
GRANT INSERT ON public.client_contacts TO anon;
GRANT REFERENCES ON public.client_contacts TO anon;
GRANT SELECT ON public.client_contacts TO anon;
GRANT TRIGGER ON public.client_contacts TO anon;
GRANT TRUNCATE ON public.client_contacts TO anon;
GRANT UPDATE ON public.client_contacts TO anon;
GRANT DELETE ON public.client_contacts TO authenticated;
GRANT INSERT ON public.client_contacts TO authenticated;
GRANT REFERENCES ON public.client_contacts TO authenticated;
GRANT SELECT ON public.client_contacts TO authenticated;
GRANT TRIGGER ON public.client_contacts TO authenticated;
GRANT TRUNCATE ON public.client_contacts TO authenticated;
GRANT UPDATE ON public.client_contacts TO authenticated;
GRANT DELETE ON public.client_contacts TO service_role;
GRANT INSERT ON public.client_contacts TO service_role;
GRANT REFERENCES ON public.client_contacts TO service_role;
GRANT SELECT ON public.client_contacts TO service_role;
GRANT TRIGGER ON public.client_contacts TO service_role;
GRANT TRUNCATE ON public.client_contacts TO service_role;
GRANT UPDATE ON public.client_contacts TO service_role;
GRANT DELETE ON public.client_products TO anon;
GRANT INSERT ON public.client_products TO anon;
GRANT REFERENCES ON public.client_products TO anon;
GRANT SELECT ON public.client_products TO anon;
GRANT TRIGGER ON public.client_products TO anon;
GRANT TRUNCATE ON public.client_products TO anon;
GRANT UPDATE ON public.client_products TO anon;
GRANT DELETE ON public.client_products TO authenticated;
GRANT INSERT ON public.client_products TO authenticated;
GRANT REFERENCES ON public.client_products TO authenticated;
GRANT SELECT ON public.client_products TO authenticated;
GRANT TRIGGER ON public.client_products TO authenticated;
GRANT TRUNCATE ON public.client_products TO authenticated;
GRANT UPDATE ON public.client_products TO authenticated;
GRANT DELETE ON public.client_products TO service_role;
GRANT INSERT ON public.client_products TO service_role;
GRANT REFERENCES ON public.client_products TO service_role;
GRANT SELECT ON public.client_products TO service_role;
GRANT TRIGGER ON public.client_products TO service_role;
GRANT TRUNCATE ON public.client_products TO service_role;
GRANT UPDATE ON public.client_products TO service_role;
GRANT DELETE ON public.clients TO anon;
GRANT INSERT ON public.clients TO anon;
GRANT REFERENCES ON public.clients TO anon;
GRANT SELECT ON public.clients TO anon;
GRANT TRIGGER ON public.clients TO anon;
GRANT TRUNCATE ON public.clients TO anon;
GRANT UPDATE ON public.clients TO anon;
GRANT DELETE ON public.clients TO authenticated;
GRANT INSERT ON public.clients TO authenticated;
GRANT REFERENCES ON public.clients TO authenticated;
GRANT SELECT ON public.clients TO authenticated;
GRANT TRIGGER ON public.clients TO authenticated;
GRANT TRUNCATE ON public.clients TO authenticated;
GRANT UPDATE ON public.clients TO authenticated;
GRANT DELETE ON public.clients TO service_role;
GRANT INSERT ON public.clients TO service_role;
GRANT REFERENCES ON public.clients TO service_role;
GRANT SELECT ON public.clients TO service_role;
GRANT TRIGGER ON public.clients TO service_role;
GRANT TRUNCATE ON public.clients TO service_role;
GRANT UPDATE ON public.clients TO service_role;
GRANT DELETE ON public.comex_export_operations TO anon;
GRANT INSERT ON public.comex_export_operations TO anon;
GRANT REFERENCES ON public.comex_export_operations TO anon;
GRANT SELECT ON public.comex_export_operations TO anon;
GRANT TRIGGER ON public.comex_export_operations TO anon;
GRANT TRUNCATE ON public.comex_export_operations TO anon;
GRANT UPDATE ON public.comex_export_operations TO anon;
GRANT DELETE ON public.comex_export_operations TO authenticated;
GRANT INSERT ON public.comex_export_operations TO authenticated;
GRANT REFERENCES ON public.comex_export_operations TO authenticated;
GRANT SELECT ON public.comex_export_operations TO authenticated;
GRANT TRIGGER ON public.comex_export_operations TO authenticated;
GRANT TRUNCATE ON public.comex_export_operations TO authenticated;
GRANT UPDATE ON public.comex_export_operations TO authenticated;
GRANT DELETE ON public.comex_export_operations TO service_role;
GRANT INSERT ON public.comex_export_operations TO service_role;
GRANT REFERENCES ON public.comex_export_operations TO service_role;
GRANT SELECT ON public.comex_export_operations TO service_role;
GRANT TRIGGER ON public.comex_export_operations TO service_role;
GRANT TRUNCATE ON public.comex_export_operations TO service_role;
GRANT UPDATE ON public.comex_export_operations TO service_role;
GRANT DELETE ON public.comex_import_operations TO anon;
GRANT INSERT ON public.comex_import_operations TO anon;
GRANT REFERENCES ON public.comex_import_operations TO anon;
GRANT SELECT ON public.comex_import_operations TO anon;
GRANT TRIGGER ON public.comex_import_operations TO anon;
GRANT TRUNCATE ON public.comex_import_operations TO anon;
GRANT UPDATE ON public.comex_import_operations TO anon;
GRANT DELETE ON public.comex_import_operations TO authenticated;
GRANT INSERT ON public.comex_import_operations TO authenticated;
GRANT REFERENCES ON public.comex_import_operations TO authenticated;
GRANT SELECT ON public.comex_import_operations TO authenticated;
GRANT TRIGGER ON public.comex_import_operations TO authenticated;
GRANT TRUNCATE ON public.comex_import_operations TO authenticated;
GRANT UPDATE ON public.comex_import_operations TO authenticated;
GRANT DELETE ON public.comex_import_operations TO service_role;
GRANT INSERT ON public.comex_import_operations TO service_role;
GRANT REFERENCES ON public.comex_import_operations TO service_role;
GRANT SELECT ON public.comex_import_operations TO service_role;
GRANT TRIGGER ON public.comex_import_operations TO service_role;
GRANT TRUNCATE ON public.comex_import_operations TO service_role;
GRANT UPDATE ON public.comex_import_operations TO service_role;
GRANT DELETE ON public.crm_viagem_categorias TO anon;
GRANT INSERT ON public.crm_viagem_categorias TO anon;
GRANT REFERENCES ON public.crm_viagem_categorias TO anon;
GRANT SELECT ON public.crm_viagem_categorias TO anon;
GRANT TRIGGER ON public.crm_viagem_categorias TO anon;
GRANT TRUNCATE ON public.crm_viagem_categorias TO anon;
GRANT UPDATE ON public.crm_viagem_categorias TO anon;
GRANT DELETE ON public.crm_viagem_categorias TO authenticated;
GRANT INSERT ON public.crm_viagem_categorias TO authenticated;
GRANT REFERENCES ON public.crm_viagem_categorias TO authenticated;
GRANT SELECT ON public.crm_viagem_categorias TO authenticated;
GRANT TRIGGER ON public.crm_viagem_categorias TO authenticated;
GRANT TRUNCATE ON public.crm_viagem_categorias TO authenticated;
GRANT UPDATE ON public.crm_viagem_categorias TO authenticated;
GRANT DELETE ON public.crm_viagem_categorias TO service_role;
GRANT INSERT ON public.crm_viagem_categorias TO service_role;
GRANT REFERENCES ON public.crm_viagem_categorias TO service_role;
GRANT SELECT ON public.crm_viagem_categorias TO service_role;
GRANT TRIGGER ON public.crm_viagem_categorias TO service_role;
GRANT TRUNCATE ON public.crm_viagem_categorias TO service_role;
GRANT UPDATE ON public.crm_viagem_categorias TO service_role;
GRANT DELETE ON public.crm_viagem_despesas TO anon;
GRANT INSERT ON public.crm_viagem_despesas TO anon;
GRANT REFERENCES ON public.crm_viagem_despesas TO anon;
GRANT SELECT ON public.crm_viagem_despesas TO anon;
GRANT TRIGGER ON public.crm_viagem_despesas TO anon;
GRANT TRUNCATE ON public.crm_viagem_despesas TO anon;
GRANT UPDATE ON public.crm_viagem_despesas TO anon;
GRANT DELETE ON public.crm_viagem_despesas TO authenticated;
GRANT INSERT ON public.crm_viagem_despesas TO authenticated;
GRANT REFERENCES ON public.crm_viagem_despesas TO authenticated;
GRANT SELECT ON public.crm_viagem_despesas TO authenticated;
GRANT TRIGGER ON public.crm_viagem_despesas TO authenticated;
GRANT TRUNCATE ON public.crm_viagem_despesas TO authenticated;
GRANT UPDATE ON public.crm_viagem_despesas TO authenticated;
GRANT DELETE ON public.crm_viagem_despesas TO service_role;
GRANT INSERT ON public.crm_viagem_despesas TO service_role;
GRANT REFERENCES ON public.crm_viagem_despesas TO service_role;
GRANT SELECT ON public.crm_viagem_despesas TO service_role;
GRANT TRIGGER ON public.crm_viagem_despesas TO service_role;
GRANT TRUNCATE ON public.crm_viagem_despesas TO service_role;
GRANT UPDATE ON public.crm_viagem_despesas TO service_role;
GRANT DELETE ON public.crm_viagem_prestacoes TO anon;
GRANT INSERT ON public.crm_viagem_prestacoes TO anon;
GRANT REFERENCES ON public.crm_viagem_prestacoes TO anon;
GRANT SELECT ON public.crm_viagem_prestacoes TO anon;
GRANT TRIGGER ON public.crm_viagem_prestacoes TO anon;
GRANT TRUNCATE ON public.crm_viagem_prestacoes TO anon;
GRANT UPDATE ON public.crm_viagem_prestacoes TO anon;
GRANT DELETE ON public.crm_viagem_prestacoes TO authenticated;
GRANT INSERT ON public.crm_viagem_prestacoes TO authenticated;
GRANT REFERENCES ON public.crm_viagem_prestacoes TO authenticated;
GRANT SELECT ON public.crm_viagem_prestacoes TO authenticated;
GRANT TRIGGER ON public.crm_viagem_prestacoes TO authenticated;
GRANT TRUNCATE ON public.crm_viagem_prestacoes TO authenticated;
GRANT UPDATE ON public.crm_viagem_prestacoes TO authenticated;
GRANT DELETE ON public.crm_viagem_prestacoes TO service_role;
GRANT INSERT ON public.crm_viagem_prestacoes TO service_role;
GRANT REFERENCES ON public.crm_viagem_prestacoes TO service_role;
GRANT SELECT ON public.crm_viagem_prestacoes TO service_role;
GRANT TRIGGER ON public.crm_viagem_prestacoes TO service_role;
GRANT TRUNCATE ON public.crm_viagem_prestacoes TO service_role;
GRANT UPDATE ON public.crm_viagem_prestacoes TO service_role;
GRANT DELETE ON public.crm_viagem_registros TO anon;
GRANT INSERT ON public.crm_viagem_registros TO anon;
GRANT REFERENCES ON public.crm_viagem_registros TO anon;
GRANT SELECT ON public.crm_viagem_registros TO anon;
GRANT TRIGGER ON public.crm_viagem_registros TO anon;
GRANT TRUNCATE ON public.crm_viagem_registros TO anon;
GRANT UPDATE ON public.crm_viagem_registros TO anon;
GRANT DELETE ON public.crm_viagem_registros TO authenticated;
GRANT INSERT ON public.crm_viagem_registros TO authenticated;
GRANT REFERENCES ON public.crm_viagem_registros TO authenticated;
GRANT SELECT ON public.crm_viagem_registros TO authenticated;
GRANT TRIGGER ON public.crm_viagem_registros TO authenticated;
GRANT TRUNCATE ON public.crm_viagem_registros TO authenticated;
GRANT UPDATE ON public.crm_viagem_registros TO authenticated;
GRANT DELETE ON public.crm_viagem_registros TO service_role;
GRANT INSERT ON public.crm_viagem_registros TO service_role;
GRANT REFERENCES ON public.crm_viagem_registros TO service_role;
GRANT SELECT ON public.crm_viagem_registros TO service_role;
GRANT TRIGGER ON public.crm_viagem_registros TO service_role;
GRANT TRUNCATE ON public.crm_viagem_registros TO service_role;
GRANT UPDATE ON public.crm_viagem_registros TO service_role;
GRANT DELETE ON public.deliverable_checklists TO anon;
GRANT INSERT ON public.deliverable_checklists TO anon;
GRANT REFERENCES ON public.deliverable_checklists TO anon;
GRANT SELECT ON public.deliverable_checklists TO anon;
GRANT TRIGGER ON public.deliverable_checklists TO anon;
GRANT TRUNCATE ON public.deliverable_checklists TO anon;
GRANT UPDATE ON public.deliverable_checklists TO anon;
GRANT DELETE ON public.deliverable_checklists TO authenticated;
GRANT INSERT ON public.deliverable_checklists TO authenticated;
GRANT REFERENCES ON public.deliverable_checklists TO authenticated;
GRANT SELECT ON public.deliverable_checklists TO authenticated;
GRANT TRIGGER ON public.deliverable_checklists TO authenticated;
GRANT TRUNCATE ON public.deliverable_checklists TO authenticated;
GRANT UPDATE ON public.deliverable_checklists TO authenticated;
GRANT DELETE ON public.deliverable_checklists TO service_role;
GRANT INSERT ON public.deliverable_checklists TO service_role;
GRANT REFERENCES ON public.deliverable_checklists TO service_role;
GRANT SELECT ON public.deliverable_checklists TO service_role;
GRANT TRIGGER ON public.deliverable_checklists TO service_role;
GRANT TRUNCATE ON public.deliverable_checklists TO service_role;
GRANT UPDATE ON public.deliverable_checklists TO service_role;
GRANT DELETE ON public.document_library TO anon;
GRANT INSERT ON public.document_library TO anon;
GRANT REFERENCES ON public.document_library TO anon;
GRANT SELECT ON public.document_library TO anon;
GRANT TRIGGER ON public.document_library TO anon;
GRANT TRUNCATE ON public.document_library TO anon;
GRANT UPDATE ON public.document_library TO anon;
GRANT DELETE ON public.document_library TO authenticated;
GRANT INSERT ON public.document_library TO authenticated;
GRANT REFERENCES ON public.document_library TO authenticated;
GRANT SELECT ON public.document_library TO authenticated;
GRANT TRIGGER ON public.document_library TO authenticated;
GRANT TRUNCATE ON public.document_library TO authenticated;
GRANT UPDATE ON public.document_library TO authenticated;
GRANT DELETE ON public.document_library TO service_role;
GRANT INSERT ON public.document_library TO service_role;
GRANT REFERENCES ON public.document_library TO service_role;
GRANT SELECT ON public.document_library TO service_role;
GRANT TRIGGER ON public.document_library TO service_role;
GRANT TRUNCATE ON public.document_library TO service_role;
GRANT UPDATE ON public.document_library TO service_role;
GRANT DELETE ON public.email_templates TO anon;
GRANT INSERT ON public.email_templates TO anon;
GRANT REFERENCES ON public.email_templates TO anon;
GRANT SELECT ON public.email_templates TO anon;
GRANT TRIGGER ON public.email_templates TO anon;
GRANT TRUNCATE ON public.email_templates TO anon;
GRANT UPDATE ON public.email_templates TO anon;
GRANT DELETE ON public.email_templates TO authenticated;
GRANT INSERT ON public.email_templates TO authenticated;
GRANT REFERENCES ON public.email_templates TO authenticated;
GRANT SELECT ON public.email_templates TO authenticated;
GRANT TRIGGER ON public.email_templates TO authenticated;
GRANT TRUNCATE ON public.email_templates TO authenticated;
GRANT UPDATE ON public.email_templates TO authenticated;
GRANT DELETE ON public.email_templates TO service_role;
GRANT INSERT ON public.email_templates TO service_role;
GRANT REFERENCES ON public.email_templates TO service_role;
GRANT SELECT ON public.email_templates TO service_role;
GRANT TRIGGER ON public.email_templates TO service_role;
GRANT TRUNCATE ON public.email_templates TO service_role;
GRANT UPDATE ON public.email_templates TO service_role;
GRANT DELETE ON public.esg_emission_factors TO anon;
GRANT INSERT ON public.esg_emission_factors TO anon;
GRANT REFERENCES ON public.esg_emission_factors TO anon;
GRANT SELECT ON public.esg_emission_factors TO anon;
GRANT TRIGGER ON public.esg_emission_factors TO anon;
GRANT TRUNCATE ON public.esg_emission_factors TO anon;
GRANT UPDATE ON public.esg_emission_factors TO anon;
GRANT DELETE ON public.esg_emission_factors TO authenticated;
GRANT INSERT ON public.esg_emission_factors TO authenticated;
GRANT REFERENCES ON public.esg_emission_factors TO authenticated;
GRANT SELECT ON public.esg_emission_factors TO authenticated;
GRANT TRIGGER ON public.esg_emission_factors TO authenticated;
GRANT TRUNCATE ON public.esg_emission_factors TO authenticated;
GRANT UPDATE ON public.esg_emission_factors TO authenticated;
GRANT DELETE ON public.esg_emission_factors TO service_role;
GRANT INSERT ON public.esg_emission_factors TO service_role;
GRANT REFERENCES ON public.esg_emission_factors TO service_role;
GRANT SELECT ON public.esg_emission_factors TO service_role;
GRANT TRIGGER ON public.esg_emission_factors TO service_role;
GRANT TRUNCATE ON public.esg_emission_factors TO service_role;
GRANT UPDATE ON public.esg_emission_factors TO service_role;
GRANT DELETE ON public.esg_emission_records TO anon;
GRANT INSERT ON public.esg_emission_records TO anon;
GRANT REFERENCES ON public.esg_emission_records TO anon;
GRANT SELECT ON public.esg_emission_records TO anon;
GRANT TRIGGER ON public.esg_emission_records TO anon;
GRANT TRUNCATE ON public.esg_emission_records TO anon;
GRANT UPDATE ON public.esg_emission_records TO anon;
GRANT DELETE ON public.esg_emission_records TO authenticated;
GRANT INSERT ON public.esg_emission_records TO authenticated;
GRANT REFERENCES ON public.esg_emission_records TO authenticated;
GRANT SELECT ON public.esg_emission_records TO authenticated;
GRANT TRIGGER ON public.esg_emission_records TO authenticated;
GRANT TRUNCATE ON public.esg_emission_records TO authenticated;
GRANT UPDATE ON public.esg_emission_records TO authenticated;
GRANT DELETE ON public.esg_emission_records TO service_role;
GRANT INSERT ON public.esg_emission_records TO service_role;
GRANT REFERENCES ON public.esg_emission_records TO service_role;
GRANT SELECT ON public.esg_emission_records TO service_role;
GRANT TRIGGER ON public.esg_emission_records TO service_role;
GRANT TRUNCATE ON public.esg_emission_records TO service_role;
GRANT UPDATE ON public.esg_emission_records TO service_role;
GRANT DELETE ON public.esg_reports TO anon;
GRANT INSERT ON public.esg_reports TO anon;
GRANT REFERENCES ON public.esg_reports TO anon;
GRANT SELECT ON public.esg_reports TO anon;
GRANT TRIGGER ON public.esg_reports TO anon;
GRANT TRUNCATE ON public.esg_reports TO anon;
GRANT UPDATE ON public.esg_reports TO anon;
GRANT DELETE ON public.esg_reports TO authenticated;
GRANT INSERT ON public.esg_reports TO authenticated;
GRANT REFERENCES ON public.esg_reports TO authenticated;
GRANT SELECT ON public.esg_reports TO authenticated;
GRANT TRIGGER ON public.esg_reports TO authenticated;
GRANT TRUNCATE ON public.esg_reports TO authenticated;
GRANT UPDATE ON public.esg_reports TO authenticated;
GRANT DELETE ON public.esg_reports TO service_role;
GRANT INSERT ON public.esg_reports TO service_role;
GRANT REFERENCES ON public.esg_reports TO service_role;
GRANT SELECT ON public.esg_reports TO service_role;
GRANT TRIGGER ON public.esg_reports TO service_role;
GRANT TRUNCATE ON public.esg_reports TO service_role;
GRANT UPDATE ON public.esg_reports TO service_role;
GRANT DELETE ON public.export_audit_log TO anon;
GRANT INSERT ON public.export_audit_log TO anon;
GRANT REFERENCES ON public.export_audit_log TO anon;
GRANT SELECT ON public.export_audit_log TO anon;
GRANT TRIGGER ON public.export_audit_log TO anon;
GRANT TRUNCATE ON public.export_audit_log TO anon;
GRANT UPDATE ON public.export_audit_log TO anon;
GRANT DELETE ON public.export_audit_log TO authenticated;
GRANT INSERT ON public.export_audit_log TO authenticated;
GRANT REFERENCES ON public.export_audit_log TO authenticated;
GRANT SELECT ON public.export_audit_log TO authenticated;
GRANT TRIGGER ON public.export_audit_log TO authenticated;
GRANT TRUNCATE ON public.export_audit_log TO authenticated;
GRANT UPDATE ON public.export_audit_log TO authenticated;
GRANT DELETE ON public.export_audit_log TO service_role;
GRANT INSERT ON public.export_audit_log TO service_role;
GRANT REFERENCES ON public.export_audit_log TO service_role;
GRANT SELECT ON public.export_audit_log TO service_role;
GRANT TRIGGER ON public.export_audit_log TO service_role;
GRANT TRUNCATE ON public.export_audit_log TO service_role;
GRANT UPDATE ON public.export_audit_log TO service_role;
GRANT DELETE ON public.external_cache TO anon;
GRANT INSERT ON public.external_cache TO anon;
GRANT REFERENCES ON public.external_cache TO anon;
GRANT SELECT ON public.external_cache TO anon;
GRANT TRIGGER ON public.external_cache TO anon;
GRANT TRUNCATE ON public.external_cache TO anon;
GRANT UPDATE ON public.external_cache TO anon;
GRANT DELETE ON public.external_cache TO authenticated;
GRANT INSERT ON public.external_cache TO authenticated;
GRANT REFERENCES ON public.external_cache TO authenticated;
GRANT SELECT ON public.external_cache TO authenticated;
GRANT TRIGGER ON public.external_cache TO authenticated;
GRANT TRUNCATE ON public.external_cache TO authenticated;
GRANT UPDATE ON public.external_cache TO authenticated;
GRANT DELETE ON public.external_cache TO service_role;
GRANT INSERT ON public.external_cache TO service_role;
GRANT REFERENCES ON public.external_cache TO service_role;
GRANT SELECT ON public.external_cache TO service_role;
GRANT TRIGGER ON public.external_cache TO service_role;
GRANT TRUNCATE ON public.external_cache TO service_role;
GRANT UPDATE ON public.external_cache TO service_role;
GRANT DELETE ON public.invitations TO anon;
GRANT INSERT ON public.invitations TO anon;
GRANT REFERENCES ON public.invitations TO anon;
GRANT SELECT ON public.invitations TO anon;
GRANT TRIGGER ON public.invitations TO anon;
GRANT TRUNCATE ON public.invitations TO anon;
GRANT UPDATE ON public.invitations TO anon;
GRANT DELETE ON public.invitations TO authenticated;
GRANT INSERT ON public.invitations TO authenticated;
GRANT REFERENCES ON public.invitations TO authenticated;
GRANT SELECT ON public.invitations TO authenticated;
GRANT TRIGGER ON public.invitations TO authenticated;
GRANT TRUNCATE ON public.invitations TO authenticated;
GRANT UPDATE ON public.invitations TO authenticated;
GRANT DELETE ON public.invitations TO service_role;
GRANT INSERT ON public.invitations TO service_role;
GRANT REFERENCES ON public.invitations TO service_role;
GRANT SELECT ON public.invitations TO service_role;
GRANT TRIGGER ON public.invitations TO service_role;
GRANT TRUNCATE ON public.invitations TO service_role;
GRANT UPDATE ON public.invitations TO service_role;
GRANT DELETE ON public.lead_attachments TO anon;
GRANT INSERT ON public.lead_attachments TO anon;
GRANT REFERENCES ON public.lead_attachments TO anon;
GRANT SELECT ON public.lead_attachments TO anon;
GRANT TRIGGER ON public.lead_attachments TO anon;
GRANT TRUNCATE ON public.lead_attachments TO anon;
GRANT UPDATE ON public.lead_attachments TO anon;
GRANT DELETE ON public.lead_attachments TO authenticated;
GRANT INSERT ON public.lead_attachments TO authenticated;
GRANT REFERENCES ON public.lead_attachments TO authenticated;
GRANT SELECT ON public.lead_attachments TO authenticated;
GRANT TRIGGER ON public.lead_attachments TO authenticated;
GRANT TRUNCATE ON public.lead_attachments TO authenticated;
GRANT UPDATE ON public.lead_attachments TO authenticated;
GRANT DELETE ON public.lead_attachments TO service_role;
GRANT INSERT ON public.lead_attachments TO service_role;
GRANT REFERENCES ON public.lead_attachments TO service_role;
GRANT SELECT ON public.lead_attachments TO service_role;
GRANT TRIGGER ON public.lead_attachments TO service_role;
GRANT TRUNCATE ON public.lead_attachments TO service_role;
GRANT UPDATE ON public.lead_attachments TO service_role;
GRANT DELETE ON public.lead_captures TO anon;
GRANT INSERT ON public.lead_captures TO anon;
GRANT REFERENCES ON public.lead_captures TO anon;
GRANT SELECT ON public.lead_captures TO anon;
GRANT TRIGGER ON public.lead_captures TO anon;
GRANT TRUNCATE ON public.lead_captures TO anon;
GRANT UPDATE ON public.lead_captures TO anon;
GRANT DELETE ON public.lead_captures TO authenticated;
GRANT INSERT ON public.lead_captures TO authenticated;
GRANT REFERENCES ON public.lead_captures TO authenticated;
GRANT SELECT ON public.lead_captures TO authenticated;
GRANT TRIGGER ON public.lead_captures TO authenticated;
GRANT TRUNCATE ON public.lead_captures TO authenticated;
GRANT UPDATE ON public.lead_captures TO authenticated;
GRANT DELETE ON public.lead_captures TO service_role;
GRANT INSERT ON public.lead_captures TO service_role;
GRANT REFERENCES ON public.lead_captures TO service_role;
GRANT SELECT ON public.lead_captures TO service_role;
GRANT TRIGGER ON public.lead_captures TO service_role;
GRANT TRUNCATE ON public.lead_captures TO service_role;
GRANT UPDATE ON public.lead_captures TO service_role;
GRANT DELETE ON public.lead_checklists TO anon;
GRANT INSERT ON public.lead_checklists TO anon;
GRANT REFERENCES ON public.lead_checklists TO anon;
GRANT SELECT ON public.lead_checklists TO anon;
GRANT TRIGGER ON public.lead_checklists TO anon;
GRANT TRUNCATE ON public.lead_checklists TO anon;
GRANT UPDATE ON public.lead_checklists TO anon;
GRANT DELETE ON public.lead_checklists TO authenticated;
GRANT INSERT ON public.lead_checklists TO authenticated;
GRANT REFERENCES ON public.lead_checklists TO authenticated;
GRANT SELECT ON public.lead_checklists TO authenticated;
GRANT TRIGGER ON public.lead_checklists TO authenticated;
GRANT TRUNCATE ON public.lead_checklists TO authenticated;
GRANT UPDATE ON public.lead_checklists TO authenticated;
GRANT DELETE ON public.lead_checklists TO service_role;
GRANT INSERT ON public.lead_checklists TO service_role;
GRANT REFERENCES ON public.lead_checklists TO service_role;
GRANT SELECT ON public.lead_checklists TO service_role;
GRANT TRIGGER ON public.lead_checklists TO service_role;
GRANT TRUNCATE ON public.lead_checklists TO service_role;
GRANT UPDATE ON public.lead_checklists TO service_role;
GRANT DELETE ON public.lead_document_refs TO anon;
GRANT INSERT ON public.lead_document_refs TO anon;
GRANT REFERENCES ON public.lead_document_refs TO anon;
GRANT SELECT ON public.lead_document_refs TO anon;
GRANT TRIGGER ON public.lead_document_refs TO anon;
GRANT TRUNCATE ON public.lead_document_refs TO anon;
GRANT UPDATE ON public.lead_document_refs TO anon;
GRANT DELETE ON public.lead_document_refs TO authenticated;
GRANT INSERT ON public.lead_document_refs TO authenticated;
GRANT REFERENCES ON public.lead_document_refs TO authenticated;
GRANT SELECT ON public.lead_document_refs TO authenticated;
GRANT TRIGGER ON public.lead_document_refs TO authenticated;
GRANT TRUNCATE ON public.lead_document_refs TO authenticated;
GRANT UPDATE ON public.lead_document_refs TO authenticated;
GRANT DELETE ON public.lead_document_refs TO service_role;
GRANT INSERT ON public.lead_document_refs TO service_role;
GRANT REFERENCES ON public.lead_document_refs TO service_role;
GRANT SELECT ON public.lead_document_refs TO service_role;
GRANT TRIGGER ON public.lead_document_refs TO service_role;
GRANT TRUNCATE ON public.lead_document_refs TO service_role;
GRANT UPDATE ON public.lead_document_refs TO service_role;
GRANT DELETE ON public.lead_emails TO anon;
GRANT INSERT ON public.lead_emails TO anon;
GRANT REFERENCES ON public.lead_emails TO anon;
GRANT SELECT ON public.lead_emails TO anon;
GRANT TRIGGER ON public.lead_emails TO anon;
GRANT TRUNCATE ON public.lead_emails TO anon;
GRANT UPDATE ON public.lead_emails TO anon;
GRANT DELETE ON public.lead_emails TO authenticated;
GRANT INSERT ON public.lead_emails TO authenticated;
GRANT REFERENCES ON public.lead_emails TO authenticated;
GRANT SELECT ON public.lead_emails TO authenticated;
GRANT TRIGGER ON public.lead_emails TO authenticated;
GRANT TRUNCATE ON public.lead_emails TO authenticated;
GRANT UPDATE ON public.lead_emails TO authenticated;
GRANT DELETE ON public.lead_emails TO service_role;
GRANT INSERT ON public.lead_emails TO service_role;
GRANT REFERENCES ON public.lead_emails TO service_role;
GRANT SELECT ON public.lead_emails TO service_role;
GRANT TRIGGER ON public.lead_emails TO service_role;
GRANT TRUNCATE ON public.lead_emails TO service_role;
GRANT UPDATE ON public.lead_emails TO service_role;
GRANT DELETE ON public.lead_samples TO anon;
GRANT INSERT ON public.lead_samples TO anon;
GRANT REFERENCES ON public.lead_samples TO anon;
GRANT SELECT ON public.lead_samples TO anon;
GRANT TRIGGER ON public.lead_samples TO anon;
GRANT TRUNCATE ON public.lead_samples TO anon;
GRANT UPDATE ON public.lead_samples TO anon;
GRANT DELETE ON public.lead_samples TO authenticated;
GRANT INSERT ON public.lead_samples TO authenticated;
GRANT REFERENCES ON public.lead_samples TO authenticated;
GRANT SELECT ON public.lead_samples TO authenticated;
GRANT TRIGGER ON public.lead_samples TO authenticated;
GRANT TRUNCATE ON public.lead_samples TO authenticated;
GRANT UPDATE ON public.lead_samples TO authenticated;
GRANT DELETE ON public.lead_samples TO service_role;
GRANT INSERT ON public.lead_samples TO service_role;
GRANT REFERENCES ON public.lead_samples TO service_role;
GRANT SELECT ON public.lead_samples TO service_role;
GRANT TRIGGER ON public.lead_samples TO service_role;
GRANT TRUNCATE ON public.lead_samples TO service_role;
GRANT UPDATE ON public.lead_samples TO service_role;
GRANT DELETE ON public.lead_stage_history TO anon;
GRANT INSERT ON public.lead_stage_history TO anon;
GRANT REFERENCES ON public.lead_stage_history TO anon;
GRANT SELECT ON public.lead_stage_history TO anon;
GRANT TRIGGER ON public.lead_stage_history TO anon;
GRANT TRUNCATE ON public.lead_stage_history TO anon;
GRANT UPDATE ON public.lead_stage_history TO anon;
GRANT DELETE ON public.lead_stage_history TO authenticated;
GRANT INSERT ON public.lead_stage_history TO authenticated;
GRANT REFERENCES ON public.lead_stage_history TO authenticated;
GRANT SELECT ON public.lead_stage_history TO authenticated;
GRANT TRIGGER ON public.lead_stage_history TO authenticated;
GRANT TRUNCATE ON public.lead_stage_history TO authenticated;
GRANT UPDATE ON public.lead_stage_history TO authenticated;
GRANT DELETE ON public.lead_stage_history TO service_role;
GRANT INSERT ON public.lead_stage_history TO service_role;
GRANT REFERENCES ON public.lead_stage_history TO service_role;
GRANT SELECT ON public.lead_stage_history TO service_role;
GRANT TRIGGER ON public.lead_stage_history TO service_role;
GRANT TRUNCATE ON public.lead_stage_history TO service_role;
GRANT UPDATE ON public.lead_stage_history TO service_role;
GRANT DELETE ON public.leads TO anon;
GRANT INSERT ON public.leads TO anon;
GRANT REFERENCES ON public.leads TO anon;
GRANT SELECT ON public.leads TO anon;
GRANT TRIGGER ON public.leads TO anon;
GRANT TRUNCATE ON public.leads TO anon;
GRANT UPDATE ON public.leads TO anon;
GRANT DELETE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO authenticated;
GRANT REFERENCES ON public.leads TO authenticated;
GRANT SELECT ON public.leads TO authenticated;
GRANT TRIGGER ON public.leads TO authenticated;
GRANT TRUNCATE ON public.leads TO authenticated;
GRANT UPDATE ON public.leads TO authenticated;
GRANT DELETE ON public.leads TO service_role;
GRANT INSERT ON public.leads TO service_role;
GRANT REFERENCES ON public.leads TO service_role;
GRANT SELECT ON public.leads TO service_role;
GRANT TRIGGER ON public.leads TO service_role;
GRANT TRUNCATE ON public.leads TO service_role;
GRANT UPDATE ON public.leads TO service_role;
GRANT DELETE ON public.margin_rules TO anon;
GRANT INSERT ON public.margin_rules TO anon;
GRANT REFERENCES ON public.margin_rules TO anon;
GRANT SELECT ON public.margin_rules TO anon;
GRANT TRIGGER ON public.margin_rules TO anon;
GRANT TRUNCATE ON public.margin_rules TO anon;
GRANT UPDATE ON public.margin_rules TO anon;
GRANT DELETE ON public.margin_rules TO authenticated;
GRANT INSERT ON public.margin_rules TO authenticated;
GRANT REFERENCES ON public.margin_rules TO authenticated;
GRANT SELECT ON public.margin_rules TO authenticated;
GRANT TRIGGER ON public.margin_rules TO authenticated;
GRANT TRUNCATE ON public.margin_rules TO authenticated;
GRANT UPDATE ON public.margin_rules TO authenticated;
GRANT DELETE ON public.margin_rules TO service_role;
GRANT INSERT ON public.margin_rules TO service_role;
GRANT REFERENCES ON public.margin_rules TO service_role;
GRANT SELECT ON public.margin_rules TO service_role;
GRANT TRIGGER ON public.margin_rules TO service_role;
GRANT TRUNCATE ON public.margin_rules TO service_role;
GRANT UPDATE ON public.margin_rules TO service_role;
GRANT DELETE ON public.market_intelligence_items TO anon;
GRANT INSERT ON public.market_intelligence_items TO anon;
GRANT REFERENCES ON public.market_intelligence_items TO anon;
GRANT SELECT ON public.market_intelligence_items TO anon;
GRANT TRIGGER ON public.market_intelligence_items TO anon;
GRANT TRUNCATE ON public.market_intelligence_items TO anon;
GRANT UPDATE ON public.market_intelligence_items TO anon;
GRANT DELETE ON public.market_intelligence_items TO authenticated;
GRANT INSERT ON public.market_intelligence_items TO authenticated;
GRANT REFERENCES ON public.market_intelligence_items TO authenticated;
GRANT SELECT ON public.market_intelligence_items TO authenticated;
GRANT TRIGGER ON public.market_intelligence_items TO authenticated;
GRANT TRUNCATE ON public.market_intelligence_items TO authenticated;
GRANT UPDATE ON public.market_intelligence_items TO authenticated;
GRANT DELETE ON public.market_intelligence_items TO service_role;
GRANT INSERT ON public.market_intelligence_items TO service_role;
GRANT REFERENCES ON public.market_intelligence_items TO service_role;
GRANT SELECT ON public.market_intelligence_items TO service_role;
GRANT TRIGGER ON public.market_intelligence_items TO service_role;
GRANT TRUNCATE ON public.market_intelligence_items TO service_role;
GRANT UPDATE ON public.market_intelligence_items TO service_role;
GRANT DELETE ON public.market_signals TO anon;
GRANT INSERT ON public.market_signals TO anon;
GRANT REFERENCES ON public.market_signals TO anon;
GRANT SELECT ON public.market_signals TO anon;
GRANT TRIGGER ON public.market_signals TO anon;
GRANT TRUNCATE ON public.market_signals TO anon;
GRANT UPDATE ON public.market_signals TO anon;
GRANT DELETE ON public.market_signals TO authenticated;
GRANT INSERT ON public.market_signals TO authenticated;
GRANT REFERENCES ON public.market_signals TO authenticated;
GRANT SELECT ON public.market_signals TO authenticated;
GRANT TRIGGER ON public.market_signals TO authenticated;
GRANT TRUNCATE ON public.market_signals TO authenticated;
GRANT UPDATE ON public.market_signals TO authenticated;
GRANT DELETE ON public.market_signals TO service_role;
GRANT INSERT ON public.market_signals TO service_role;
GRANT REFERENCES ON public.market_signals TO service_role;
GRANT SELECT ON public.market_signals TO service_role;
GRANT TRIGGER ON public.market_signals TO service_role;
GRANT TRUNCATE ON public.market_signals TO service_role;
GRANT UPDATE ON public.market_signals TO service_role;
GRANT DELETE ON public.marketing_budgets TO anon;
GRANT INSERT ON public.marketing_budgets TO anon;
GRANT REFERENCES ON public.marketing_budgets TO anon;
GRANT SELECT ON public.marketing_budgets TO anon;
GRANT TRIGGER ON public.marketing_budgets TO anon;
GRANT TRUNCATE ON public.marketing_budgets TO anon;
GRANT UPDATE ON public.marketing_budgets TO anon;
GRANT DELETE ON public.marketing_budgets TO authenticated;
GRANT INSERT ON public.marketing_budgets TO authenticated;
GRANT REFERENCES ON public.marketing_budgets TO authenticated;
GRANT SELECT ON public.marketing_budgets TO authenticated;
GRANT TRIGGER ON public.marketing_budgets TO authenticated;
GRANT TRUNCATE ON public.marketing_budgets TO authenticated;
GRANT UPDATE ON public.marketing_budgets TO authenticated;
GRANT DELETE ON public.marketing_budgets TO service_role;
GRANT INSERT ON public.marketing_budgets TO service_role;
GRANT REFERENCES ON public.marketing_budgets TO service_role;
GRANT SELECT ON public.marketing_budgets TO service_role;
GRANT TRIGGER ON public.marketing_budgets TO service_role;
GRANT TRUNCATE ON public.marketing_budgets TO service_role;
GRANT UPDATE ON public.marketing_budgets TO service_role;
GRANT DELETE ON public.marketing_campaign_attachments TO anon;
GRANT INSERT ON public.marketing_campaign_attachments TO anon;
GRANT REFERENCES ON public.marketing_campaign_attachments TO anon;
GRANT SELECT ON public.marketing_campaign_attachments TO anon;
GRANT TRIGGER ON public.marketing_campaign_attachments TO anon;
GRANT TRUNCATE ON public.marketing_campaign_attachments TO anon;
GRANT UPDATE ON public.marketing_campaign_attachments TO anon;
GRANT DELETE ON public.marketing_campaign_attachments TO authenticated;
GRANT INSERT ON public.marketing_campaign_attachments TO authenticated;
GRANT REFERENCES ON public.marketing_campaign_attachments TO authenticated;
GRANT SELECT ON public.marketing_campaign_attachments TO authenticated;
GRANT TRIGGER ON public.marketing_campaign_attachments TO authenticated;
GRANT TRUNCATE ON public.marketing_campaign_attachments TO authenticated;
GRANT UPDATE ON public.marketing_campaign_attachments TO authenticated;
GRANT DELETE ON public.marketing_campaign_attachments TO service_role;
GRANT INSERT ON public.marketing_campaign_attachments TO service_role;
GRANT REFERENCES ON public.marketing_campaign_attachments TO service_role;
GRANT SELECT ON public.marketing_campaign_attachments TO service_role;
GRANT TRIGGER ON public.marketing_campaign_attachments TO service_role;
GRANT TRUNCATE ON public.marketing_campaign_attachments TO service_role;
GRANT UPDATE ON public.marketing_campaign_attachments TO service_role;
GRANT DELETE ON public.marketing_campaigns TO anon;
GRANT INSERT ON public.marketing_campaigns TO anon;
GRANT REFERENCES ON public.marketing_campaigns TO anon;
GRANT SELECT ON public.marketing_campaigns TO anon;
GRANT TRIGGER ON public.marketing_campaigns TO anon;
GRANT TRUNCATE ON public.marketing_campaigns TO anon;
GRANT UPDATE ON public.marketing_campaigns TO anon;
GRANT DELETE ON public.marketing_campaigns TO authenticated;
GRANT INSERT ON public.marketing_campaigns TO authenticated;
GRANT REFERENCES ON public.marketing_campaigns TO authenticated;
GRANT SELECT ON public.marketing_campaigns TO authenticated;
GRANT TRIGGER ON public.marketing_campaigns TO authenticated;
GRANT TRUNCATE ON public.marketing_campaigns TO authenticated;
GRANT UPDATE ON public.marketing_campaigns TO authenticated;
GRANT DELETE ON public.marketing_campaigns TO service_role;
GRANT INSERT ON public.marketing_campaigns TO service_role;
GRANT REFERENCES ON public.marketing_campaigns TO service_role;
GRANT SELECT ON public.marketing_campaigns TO service_role;
GRANT TRIGGER ON public.marketing_campaigns TO service_role;
GRANT TRUNCATE ON public.marketing_campaigns TO service_role;
GRANT UPDATE ON public.marketing_campaigns TO service_role;
GRANT DELETE ON public.marketing_deliverable_attachments TO anon;
GRANT INSERT ON public.marketing_deliverable_attachments TO anon;
GRANT REFERENCES ON public.marketing_deliverable_attachments TO anon;
GRANT SELECT ON public.marketing_deliverable_attachments TO anon;
GRANT TRIGGER ON public.marketing_deliverable_attachments TO anon;
GRANT TRUNCATE ON public.marketing_deliverable_attachments TO anon;
GRANT UPDATE ON public.marketing_deliverable_attachments TO anon;
GRANT DELETE ON public.marketing_deliverable_attachments TO authenticated;
GRANT INSERT ON public.marketing_deliverable_attachments TO authenticated;
GRANT REFERENCES ON public.marketing_deliverable_attachments TO authenticated;
GRANT SELECT ON public.marketing_deliverable_attachments TO authenticated;
GRANT TRIGGER ON public.marketing_deliverable_attachments TO authenticated;
GRANT TRUNCATE ON public.marketing_deliverable_attachments TO authenticated;
GRANT UPDATE ON public.marketing_deliverable_attachments TO authenticated;
GRANT DELETE ON public.marketing_deliverable_attachments TO service_role;
GRANT INSERT ON public.marketing_deliverable_attachments TO service_role;
GRANT REFERENCES ON public.marketing_deliverable_attachments TO service_role;
GRANT SELECT ON public.marketing_deliverable_attachments TO service_role;
GRANT TRIGGER ON public.marketing_deliverable_attachments TO service_role;
GRANT TRUNCATE ON public.marketing_deliverable_attachments TO service_role;
GRANT UPDATE ON public.marketing_deliverable_attachments TO service_role;
GRANT DELETE ON public.marketing_deliverables TO anon;
GRANT INSERT ON public.marketing_deliverables TO anon;
GRANT REFERENCES ON public.marketing_deliverables TO anon;
GRANT SELECT ON public.marketing_deliverables TO anon;
GRANT TRIGGER ON public.marketing_deliverables TO anon;
GRANT TRUNCATE ON public.marketing_deliverables TO anon;
GRANT UPDATE ON public.marketing_deliverables TO anon;
GRANT DELETE ON public.marketing_deliverables TO authenticated;
GRANT INSERT ON public.marketing_deliverables TO authenticated;
GRANT REFERENCES ON public.marketing_deliverables TO authenticated;
GRANT SELECT ON public.marketing_deliverables TO authenticated;
GRANT TRIGGER ON public.marketing_deliverables TO authenticated;
GRANT TRUNCATE ON public.marketing_deliverables TO authenticated;
GRANT UPDATE ON public.marketing_deliverables TO authenticated;
GRANT DELETE ON public.marketing_deliverables TO service_role;
GRANT INSERT ON public.marketing_deliverables TO service_role;
GRANT REFERENCES ON public.marketing_deliverables TO service_role;
GRANT SELECT ON public.marketing_deliverables TO service_role;
GRANT TRIGGER ON public.marketing_deliverables TO service_role;
GRANT TRUNCATE ON public.marketing_deliverables TO service_role;
GRANT UPDATE ON public.marketing_deliverables TO service_role;
GRANT DELETE ON public.marketing_expense_deliverables TO anon;
GRANT INSERT ON public.marketing_expense_deliverables TO anon;
GRANT REFERENCES ON public.marketing_expense_deliverables TO anon;
GRANT SELECT ON public.marketing_expense_deliverables TO anon;
GRANT TRIGGER ON public.marketing_expense_deliverables TO anon;
GRANT TRUNCATE ON public.marketing_expense_deliverables TO anon;
GRANT UPDATE ON public.marketing_expense_deliverables TO anon;
GRANT DELETE ON public.marketing_expense_deliverables TO authenticated;
GRANT INSERT ON public.marketing_expense_deliverables TO authenticated;
GRANT REFERENCES ON public.marketing_expense_deliverables TO authenticated;
GRANT SELECT ON public.marketing_expense_deliverables TO authenticated;
GRANT TRIGGER ON public.marketing_expense_deliverables TO authenticated;
GRANT TRUNCATE ON public.marketing_expense_deliverables TO authenticated;
GRANT UPDATE ON public.marketing_expense_deliverables TO authenticated;
GRANT DELETE ON public.marketing_expense_deliverables TO service_role;
GRANT INSERT ON public.marketing_expense_deliverables TO service_role;
GRANT REFERENCES ON public.marketing_expense_deliverables TO service_role;
GRANT SELECT ON public.marketing_expense_deliverables TO service_role;
GRANT TRIGGER ON public.marketing_expense_deliverables TO service_role;
GRANT TRUNCATE ON public.marketing_expense_deliverables TO service_role;
GRANT UPDATE ON public.marketing_expense_deliverables TO service_role;
GRANT DELETE ON public.marketing_expense_items TO anon;
GRANT INSERT ON public.marketing_expense_items TO anon;
GRANT REFERENCES ON public.marketing_expense_items TO anon;
GRANT SELECT ON public.marketing_expense_items TO anon;
GRANT TRIGGER ON public.marketing_expense_items TO anon;
GRANT TRUNCATE ON public.marketing_expense_items TO anon;
GRANT UPDATE ON public.marketing_expense_items TO anon;
GRANT DELETE ON public.marketing_expense_items TO authenticated;
GRANT INSERT ON public.marketing_expense_items TO authenticated;
GRANT REFERENCES ON public.marketing_expense_items TO authenticated;
GRANT SELECT ON public.marketing_expense_items TO authenticated;
GRANT TRIGGER ON public.marketing_expense_items TO authenticated;
GRANT TRUNCATE ON public.marketing_expense_items TO authenticated;
GRANT UPDATE ON public.marketing_expense_items TO authenticated;
GRANT DELETE ON public.marketing_expense_items TO service_role;
GRANT INSERT ON public.marketing_expense_items TO service_role;
GRANT REFERENCES ON public.marketing_expense_items TO service_role;
GRANT SELECT ON public.marketing_expense_items TO service_role;
GRANT TRIGGER ON public.marketing_expense_items TO service_role;
GRANT TRUNCATE ON public.marketing_expense_items TO service_role;
GRANT UPDATE ON public.marketing_expense_items TO service_role;
GRANT DELETE ON public.marketing_expense_tasks TO anon;
GRANT INSERT ON public.marketing_expense_tasks TO anon;
GRANT REFERENCES ON public.marketing_expense_tasks TO anon;
GRANT SELECT ON public.marketing_expense_tasks TO anon;
GRANT TRIGGER ON public.marketing_expense_tasks TO anon;
GRANT TRUNCATE ON public.marketing_expense_tasks TO anon;
GRANT UPDATE ON public.marketing_expense_tasks TO anon;
GRANT DELETE ON public.marketing_expense_tasks TO authenticated;
GRANT INSERT ON public.marketing_expense_tasks TO authenticated;
GRANT REFERENCES ON public.marketing_expense_tasks TO authenticated;
GRANT SELECT ON public.marketing_expense_tasks TO authenticated;
GRANT TRIGGER ON public.marketing_expense_tasks TO authenticated;
GRANT TRUNCATE ON public.marketing_expense_tasks TO authenticated;
GRANT UPDATE ON public.marketing_expense_tasks TO authenticated;
GRANT DELETE ON public.marketing_expense_tasks TO service_role;
GRANT INSERT ON public.marketing_expense_tasks TO service_role;
GRANT REFERENCES ON public.marketing_expense_tasks TO service_role;
GRANT SELECT ON public.marketing_expense_tasks TO service_role;
GRANT TRIGGER ON public.marketing_expense_tasks TO service_role;
GRANT TRUNCATE ON public.marketing_expense_tasks TO service_role;
GRANT UPDATE ON public.marketing_expense_tasks TO service_role;
GRANT DELETE ON public.marketing_expenses TO anon;
GRANT INSERT ON public.marketing_expenses TO anon;
GRANT REFERENCES ON public.marketing_expenses TO anon;
GRANT SELECT ON public.marketing_expenses TO anon;
GRANT TRIGGER ON public.marketing_expenses TO anon;
GRANT TRUNCATE ON public.marketing_expenses TO anon;
GRANT UPDATE ON public.marketing_expenses TO anon;
GRANT DELETE ON public.marketing_expenses TO authenticated;
GRANT INSERT ON public.marketing_expenses TO authenticated;
GRANT REFERENCES ON public.marketing_expenses TO authenticated;
GRANT SELECT ON public.marketing_expenses TO authenticated;
GRANT TRIGGER ON public.marketing_expenses TO authenticated;
GRANT TRUNCATE ON public.marketing_expenses TO authenticated;
GRANT UPDATE ON public.marketing_expenses TO authenticated;
GRANT DELETE ON public.marketing_expenses TO service_role;
GRANT INSERT ON public.marketing_expenses TO service_role;
GRANT REFERENCES ON public.marketing_expenses TO service_role;
GRANT SELECT ON public.marketing_expenses TO service_role;
GRANT TRIGGER ON public.marketing_expenses TO service_role;
GRANT TRUNCATE ON public.marketing_expenses TO service_role;
GRANT UPDATE ON public.marketing_expenses TO service_role;
GRANT DELETE ON public.marketing_protocol_numbers TO anon;
GRANT INSERT ON public.marketing_protocol_numbers TO anon;
GRANT REFERENCES ON public.marketing_protocol_numbers TO anon;
GRANT SELECT ON public.marketing_protocol_numbers TO anon;
GRANT TRIGGER ON public.marketing_protocol_numbers TO anon;
GRANT TRUNCATE ON public.marketing_protocol_numbers TO anon;
GRANT UPDATE ON public.marketing_protocol_numbers TO anon;
GRANT DELETE ON public.marketing_protocol_numbers TO authenticated;
GRANT INSERT ON public.marketing_protocol_numbers TO authenticated;
GRANT REFERENCES ON public.marketing_protocol_numbers TO authenticated;
GRANT SELECT ON public.marketing_protocol_numbers TO authenticated;
GRANT TRIGGER ON public.marketing_protocol_numbers TO authenticated;
GRANT TRUNCATE ON public.marketing_protocol_numbers TO authenticated;
GRANT UPDATE ON public.marketing_protocol_numbers TO authenticated;
GRANT DELETE ON public.marketing_protocol_numbers TO service_role;
GRANT INSERT ON public.marketing_protocol_numbers TO service_role;
GRANT REFERENCES ON public.marketing_protocol_numbers TO service_role;
GRANT SELECT ON public.marketing_protocol_numbers TO service_role;
GRANT TRIGGER ON public.marketing_protocol_numbers TO service_role;
GRANT TRUNCATE ON public.marketing_protocol_numbers TO service_role;
GRANT UPDATE ON public.marketing_protocol_numbers TO service_role;
GRANT DELETE ON public.marketing_purchase_requests TO anon;
GRANT INSERT ON public.marketing_purchase_requests TO anon;
GRANT REFERENCES ON public.marketing_purchase_requests TO anon;
GRANT SELECT ON public.marketing_purchase_requests TO anon;
GRANT TRIGGER ON public.marketing_purchase_requests TO anon;
GRANT TRUNCATE ON public.marketing_purchase_requests TO anon;
GRANT UPDATE ON public.marketing_purchase_requests TO anon;
GRANT DELETE ON public.marketing_purchase_requests TO authenticated;
GRANT INSERT ON public.marketing_purchase_requests TO authenticated;
GRANT REFERENCES ON public.marketing_purchase_requests TO authenticated;
GRANT SELECT ON public.marketing_purchase_requests TO authenticated;
GRANT TRIGGER ON public.marketing_purchase_requests TO authenticated;
GRANT TRUNCATE ON public.marketing_purchase_requests TO authenticated;
GRANT UPDATE ON public.marketing_purchase_requests TO authenticated;
GRANT DELETE ON public.marketing_purchase_requests TO service_role;
GRANT INSERT ON public.marketing_purchase_requests TO service_role;
GRANT REFERENCES ON public.marketing_purchase_requests TO service_role;
GRANT SELECT ON public.marketing_purchase_requests TO service_role;
GRANT TRIGGER ON public.marketing_purchase_requests TO service_role;
GRANT TRUNCATE ON public.marketing_purchase_requests TO service_role;
GRANT UPDATE ON public.marketing_purchase_requests TO service_role;
GRANT DELETE ON public.marketing_quote_email_template TO anon;
GRANT INSERT ON public.marketing_quote_email_template TO anon;
GRANT REFERENCES ON public.marketing_quote_email_template TO anon;
GRANT SELECT ON public.marketing_quote_email_template TO anon;
GRANT TRIGGER ON public.marketing_quote_email_template TO anon;
GRANT TRUNCATE ON public.marketing_quote_email_template TO anon;
GRANT UPDATE ON public.marketing_quote_email_template TO anon;
GRANT DELETE ON public.marketing_quote_email_template TO authenticated;
GRANT INSERT ON public.marketing_quote_email_template TO authenticated;
GRANT REFERENCES ON public.marketing_quote_email_template TO authenticated;
GRANT SELECT ON public.marketing_quote_email_template TO authenticated;
GRANT TRIGGER ON public.marketing_quote_email_template TO authenticated;
GRANT TRUNCATE ON public.marketing_quote_email_template TO authenticated;
GRANT UPDATE ON public.marketing_quote_email_template TO authenticated;
GRANT DELETE ON public.marketing_quote_email_template TO service_role;
GRANT INSERT ON public.marketing_quote_email_template TO service_role;
GRANT REFERENCES ON public.marketing_quote_email_template TO service_role;
GRANT SELECT ON public.marketing_quote_email_template TO service_role;
GRANT TRIGGER ON public.marketing_quote_email_template TO service_role;
GRANT TRUNCATE ON public.marketing_quote_email_template TO service_role;
GRANT UPDATE ON public.marketing_quote_email_template TO service_role;
GRANT DELETE ON public.marketing_requests TO anon;
GRANT INSERT ON public.marketing_requests TO anon;
GRANT REFERENCES ON public.marketing_requests TO anon;
GRANT SELECT ON public.marketing_requests TO anon;
GRANT TRIGGER ON public.marketing_requests TO anon;
GRANT TRUNCATE ON public.marketing_requests TO anon;
GRANT UPDATE ON public.marketing_requests TO anon;
GRANT DELETE ON public.marketing_requests TO authenticated;
GRANT INSERT ON public.marketing_requests TO authenticated;
GRANT REFERENCES ON public.marketing_requests TO authenticated;
GRANT SELECT ON public.marketing_requests TO authenticated;
GRANT TRIGGER ON public.marketing_requests TO authenticated;
GRANT TRUNCATE ON public.marketing_requests TO authenticated;
GRANT UPDATE ON public.marketing_requests TO authenticated;
GRANT DELETE ON public.marketing_requests TO service_role;
GRANT INSERT ON public.marketing_requests TO service_role;
GRANT REFERENCES ON public.marketing_requests TO service_role;
GRANT SELECT ON public.marketing_requests TO service_role;
GRANT TRIGGER ON public.marketing_requests TO service_role;
GRANT TRUNCATE ON public.marketing_requests TO service_role;
GRANT UPDATE ON public.marketing_requests TO service_role;
GRANT DELETE ON public.marketing_supplier_quotes TO anon;
GRANT INSERT ON public.marketing_supplier_quotes TO anon;
GRANT REFERENCES ON public.marketing_supplier_quotes TO anon;
GRANT SELECT ON public.marketing_supplier_quotes TO anon;
GRANT TRIGGER ON public.marketing_supplier_quotes TO anon;
GRANT TRUNCATE ON public.marketing_supplier_quotes TO anon;
GRANT UPDATE ON public.marketing_supplier_quotes TO anon;
GRANT DELETE ON public.marketing_supplier_quotes TO authenticated;
GRANT INSERT ON public.marketing_supplier_quotes TO authenticated;
GRANT REFERENCES ON public.marketing_supplier_quotes TO authenticated;
GRANT SELECT ON public.marketing_supplier_quotes TO authenticated;
GRANT TRIGGER ON public.marketing_supplier_quotes TO authenticated;
GRANT TRUNCATE ON public.marketing_supplier_quotes TO authenticated;
GRANT UPDATE ON public.marketing_supplier_quotes TO authenticated;
GRANT DELETE ON public.marketing_supplier_quotes TO service_role;
GRANT INSERT ON public.marketing_supplier_quotes TO service_role;
GRANT REFERENCES ON public.marketing_supplier_quotes TO service_role;
GRANT SELECT ON public.marketing_supplier_quotes TO service_role;
GRANT TRIGGER ON public.marketing_supplier_quotes TO service_role;
GRANT TRUNCATE ON public.marketing_supplier_quotes TO service_role;
GRANT UPDATE ON public.marketing_supplier_quotes TO service_role;
GRANT DELETE ON public.marketing_suppliers TO anon;
GRANT INSERT ON public.marketing_suppliers TO anon;
GRANT REFERENCES ON public.marketing_suppliers TO anon;
GRANT SELECT ON public.marketing_suppliers TO anon;
GRANT TRIGGER ON public.marketing_suppliers TO anon;
GRANT TRUNCATE ON public.marketing_suppliers TO anon;
GRANT UPDATE ON public.marketing_suppliers TO anon;
GRANT DELETE ON public.marketing_suppliers TO authenticated;
GRANT INSERT ON public.marketing_suppliers TO authenticated;
GRANT REFERENCES ON public.marketing_suppliers TO authenticated;
GRANT SELECT ON public.marketing_suppliers TO authenticated;
GRANT TRIGGER ON public.marketing_suppliers TO authenticated;
GRANT TRUNCATE ON public.marketing_suppliers TO authenticated;
GRANT UPDATE ON public.marketing_suppliers TO authenticated;
GRANT DELETE ON public.marketing_suppliers TO service_role;
GRANT INSERT ON public.marketing_suppliers TO service_role;
GRANT REFERENCES ON public.marketing_suppliers TO service_role;
GRANT SELECT ON public.marketing_suppliers TO service_role;
GRANT TRIGGER ON public.marketing_suppliers TO service_role;
GRANT TRUNCATE ON public.marketing_suppliers TO service_role;
GRANT UPDATE ON public.marketing_suppliers TO service_role;
GRANT DELETE ON public.marketing_tasks TO anon;
GRANT INSERT ON public.marketing_tasks TO anon;
GRANT REFERENCES ON public.marketing_tasks TO anon;
GRANT SELECT ON public.marketing_tasks TO anon;
GRANT TRIGGER ON public.marketing_tasks TO anon;
GRANT TRUNCATE ON public.marketing_tasks TO anon;
GRANT UPDATE ON public.marketing_tasks TO anon;
GRANT DELETE ON public.marketing_tasks TO authenticated;
GRANT INSERT ON public.marketing_tasks TO authenticated;
GRANT REFERENCES ON public.marketing_tasks TO authenticated;
GRANT SELECT ON public.marketing_tasks TO authenticated;
GRANT TRIGGER ON public.marketing_tasks TO authenticated;
GRANT TRUNCATE ON public.marketing_tasks TO authenticated;
GRANT UPDATE ON public.marketing_tasks TO authenticated;
GRANT DELETE ON public.marketing_tasks TO service_role;
GRANT INSERT ON public.marketing_tasks TO service_role;
GRANT REFERENCES ON public.marketing_tasks TO service_role;
GRANT SELECT ON public.marketing_tasks TO service_role;
GRANT TRIGGER ON public.marketing_tasks TO service_role;
GRANT TRUNCATE ON public.marketing_tasks TO service_role;
GRANT UPDATE ON public.marketing_tasks TO service_role;
GRANT DELETE ON public.module_states TO anon;
GRANT INSERT ON public.module_states TO anon;
GRANT REFERENCES ON public.module_states TO anon;
GRANT SELECT ON public.module_states TO anon;
GRANT TRIGGER ON public.module_states TO anon;
GRANT TRUNCATE ON public.module_states TO anon;
GRANT UPDATE ON public.module_states TO anon;
GRANT DELETE ON public.module_states TO authenticated;
GRANT INSERT ON public.module_states TO authenticated;
GRANT REFERENCES ON public.module_states TO authenticated;
GRANT SELECT ON public.module_states TO authenticated;
GRANT TRIGGER ON public.module_states TO authenticated;
GRANT TRUNCATE ON public.module_states TO authenticated;
GRANT UPDATE ON public.module_states TO authenticated;
GRANT DELETE ON public.module_states TO service_role;
GRANT INSERT ON public.module_states TO service_role;
GRANT REFERENCES ON public.module_states TO service_role;
GRANT SELECT ON public.module_states TO service_role;
GRANT TRIGGER ON public.module_states TO service_role;
GRANT TRUNCATE ON public.module_states TO service_role;
GRANT UPDATE ON public.module_states TO service_role;
GRANT DELETE ON public.ncm_catalog TO anon;
GRANT INSERT ON public.ncm_catalog TO anon;
GRANT REFERENCES ON public.ncm_catalog TO anon;
GRANT SELECT ON public.ncm_catalog TO anon;
GRANT TRIGGER ON public.ncm_catalog TO anon;
GRANT TRUNCATE ON public.ncm_catalog TO anon;
GRANT UPDATE ON public.ncm_catalog TO anon;
GRANT DELETE ON public.ncm_catalog TO authenticated;
GRANT INSERT ON public.ncm_catalog TO authenticated;
GRANT REFERENCES ON public.ncm_catalog TO authenticated;
GRANT SELECT ON public.ncm_catalog TO authenticated;
GRANT TRIGGER ON public.ncm_catalog TO authenticated;
GRANT TRUNCATE ON public.ncm_catalog TO authenticated;
GRANT UPDATE ON public.ncm_catalog TO authenticated;
GRANT DELETE ON public.ncm_catalog TO service_role;
GRANT INSERT ON public.ncm_catalog TO service_role;
GRANT REFERENCES ON public.ncm_catalog TO service_role;
GRANT SELECT ON public.ncm_catalog TO service_role;
GRANT TRIGGER ON public.ncm_catalog TO service_role;
GRANT TRUNCATE ON public.ncm_catalog TO service_role;
GRANT UPDATE ON public.ncm_catalog TO service_role;
GRANT DELETE ON public.notifications TO anon;
GRANT INSERT ON public.notifications TO anon;
GRANT REFERENCES ON public.notifications TO anon;
GRANT SELECT ON public.notifications TO anon;
GRANT TRIGGER ON public.notifications TO anon;
GRANT TRUNCATE ON public.notifications TO anon;
GRANT UPDATE ON public.notifications TO anon;
GRANT DELETE ON public.notifications TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;
GRANT REFERENCES ON public.notifications TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT TRIGGER ON public.notifications TO authenticated;
GRANT TRUNCATE ON public.notifications TO authenticated;
GRANT UPDATE ON public.notifications TO authenticated;
GRANT DELETE ON public.notifications TO service_role;
GRANT INSERT ON public.notifications TO service_role;
GRANT REFERENCES ON public.notifications TO service_role;
GRANT SELECT ON public.notifications TO service_role;
GRANT TRIGGER ON public.notifications TO service_role;
GRANT TRUNCATE ON public.notifications TO service_role;
GRANT UPDATE ON public.notifications TO service_role;
GRANT DELETE ON public.order_items TO anon;
GRANT INSERT ON public.order_items TO anon;
GRANT REFERENCES ON public.order_items TO anon;
GRANT SELECT ON public.order_items TO anon;
GRANT TRIGGER ON public.order_items TO anon;
GRANT TRUNCATE ON public.order_items TO anon;
GRANT UPDATE ON public.order_items TO anon;
GRANT DELETE ON public.order_items TO authenticated;
GRANT INSERT ON public.order_items TO authenticated;
GRANT REFERENCES ON public.order_items TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT TRIGGER ON public.order_items TO authenticated;
GRANT TRUNCATE ON public.order_items TO authenticated;
GRANT UPDATE ON public.order_items TO authenticated;
GRANT DELETE ON public.order_items TO service_role;
GRANT INSERT ON public.order_items TO service_role;
GRANT REFERENCES ON public.order_items TO service_role;
GRANT SELECT ON public.order_items TO service_role;
GRANT TRIGGER ON public.order_items TO service_role;
GRANT TRUNCATE ON public.order_items TO service_role;
GRANT UPDATE ON public.order_items TO service_role;
GRANT DELETE ON public.order_stage_history TO anon;
GRANT INSERT ON public.order_stage_history TO anon;
GRANT REFERENCES ON public.order_stage_history TO anon;
GRANT SELECT ON public.order_stage_history TO anon;
GRANT TRIGGER ON public.order_stage_history TO anon;
GRANT TRUNCATE ON public.order_stage_history TO anon;
GRANT UPDATE ON public.order_stage_history TO anon;
GRANT DELETE ON public.order_stage_history TO authenticated;
GRANT INSERT ON public.order_stage_history TO authenticated;
GRANT REFERENCES ON public.order_stage_history TO authenticated;
GRANT SELECT ON public.order_stage_history TO authenticated;
GRANT TRIGGER ON public.order_stage_history TO authenticated;
GRANT TRUNCATE ON public.order_stage_history TO authenticated;
GRANT UPDATE ON public.order_stage_history TO authenticated;
GRANT DELETE ON public.order_stage_history TO service_role;
GRANT INSERT ON public.order_stage_history TO service_role;
GRANT REFERENCES ON public.order_stage_history TO service_role;
GRANT SELECT ON public.order_stage_history TO service_role;
GRANT TRIGGER ON public.order_stage_history TO service_role;
GRANT TRUNCATE ON public.order_stage_history TO service_role;
GRANT UPDATE ON public.order_stage_history TO service_role;
GRANT DELETE ON public.orders TO anon;
GRANT INSERT ON public.orders TO anon;
GRANT REFERENCES ON public.orders TO anon;
GRANT SELECT ON public.orders TO anon;
GRANT TRIGGER ON public.orders TO anon;
GRANT TRUNCATE ON public.orders TO anon;
GRANT UPDATE ON public.orders TO anon;
GRANT DELETE ON public.orders TO authenticated;
GRANT INSERT ON public.orders TO authenticated;
GRANT REFERENCES ON public.orders TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT TRIGGER ON public.orders TO authenticated;
GRANT TRUNCATE ON public.orders TO authenticated;
GRANT UPDATE ON public.orders TO authenticated;
GRANT DELETE ON public.orders TO service_role;
GRANT INSERT ON public.orders TO service_role;
GRANT REFERENCES ON public.orders TO service_role;
GRANT SELECT ON public.orders TO service_role;
GRANT TRIGGER ON public.orders TO service_role;
GRANT TRUNCATE ON public.orders TO service_role;
GRANT UPDATE ON public.orders TO service_role;
GRANT DELETE ON public.personal_events TO anon;
GRANT INSERT ON public.personal_events TO anon;
GRANT REFERENCES ON public.personal_events TO anon;
GRANT SELECT ON public.personal_events TO anon;
GRANT TRIGGER ON public.personal_events TO anon;
GRANT TRUNCATE ON public.personal_events TO anon;
GRANT UPDATE ON public.personal_events TO anon;
GRANT DELETE ON public.personal_events TO authenticated;
GRANT INSERT ON public.personal_events TO authenticated;
GRANT REFERENCES ON public.personal_events TO authenticated;
GRANT SELECT ON public.personal_events TO authenticated;
GRANT TRIGGER ON public.personal_events TO authenticated;
GRANT TRUNCATE ON public.personal_events TO authenticated;
GRANT UPDATE ON public.personal_events TO authenticated;
GRANT DELETE ON public.personal_events TO service_role;
GRANT INSERT ON public.personal_events TO service_role;
GRANT REFERENCES ON public.personal_events TO service_role;
GRANT SELECT ON public.personal_events TO service_role;
GRANT TRIGGER ON public.personal_events TO service_role;
GRANT TRUNCATE ON public.personal_events TO service_role;
GRANT UPDATE ON public.personal_events TO service_role;
GRANT DELETE ON public.personal_task_attachments TO anon;
GRANT INSERT ON public.personal_task_attachments TO anon;
GRANT REFERENCES ON public.personal_task_attachments TO anon;
GRANT SELECT ON public.personal_task_attachments TO anon;
GRANT TRIGGER ON public.personal_task_attachments TO anon;
GRANT TRUNCATE ON public.personal_task_attachments TO anon;
GRANT UPDATE ON public.personal_task_attachments TO anon;
GRANT DELETE ON public.personal_task_attachments TO authenticated;
GRANT INSERT ON public.personal_task_attachments TO authenticated;
GRANT REFERENCES ON public.personal_task_attachments TO authenticated;
GRANT SELECT ON public.personal_task_attachments TO authenticated;
GRANT TRIGGER ON public.personal_task_attachments TO authenticated;
GRANT TRUNCATE ON public.personal_task_attachments TO authenticated;
GRANT UPDATE ON public.personal_task_attachments TO authenticated;
GRANT DELETE ON public.personal_task_attachments TO service_role;
GRANT INSERT ON public.personal_task_attachments TO service_role;
GRANT REFERENCES ON public.personal_task_attachments TO service_role;
GRANT SELECT ON public.personal_task_attachments TO service_role;
GRANT TRIGGER ON public.personal_task_attachments TO service_role;
GRANT TRUNCATE ON public.personal_task_attachments TO service_role;
GRANT UPDATE ON public.personal_task_attachments TO service_role;
GRANT DELETE ON public.personal_task_automations TO anon;
GRANT INSERT ON public.personal_task_automations TO anon;
GRANT REFERENCES ON public.personal_task_automations TO anon;
GRANT SELECT ON public.personal_task_automations TO anon;
GRANT TRIGGER ON public.personal_task_automations TO anon;
GRANT TRUNCATE ON public.personal_task_automations TO anon;
GRANT UPDATE ON public.personal_task_automations TO anon;
GRANT DELETE ON public.personal_task_automations TO authenticated;
GRANT INSERT ON public.personal_task_automations TO authenticated;
GRANT REFERENCES ON public.personal_task_automations TO authenticated;
GRANT SELECT ON public.personal_task_automations TO authenticated;
GRANT TRIGGER ON public.personal_task_automations TO authenticated;
GRANT TRUNCATE ON public.personal_task_automations TO authenticated;
GRANT UPDATE ON public.personal_task_automations TO authenticated;
GRANT DELETE ON public.personal_task_automations TO service_role;
GRANT INSERT ON public.personal_task_automations TO service_role;
GRANT REFERENCES ON public.personal_task_automations TO service_role;
GRANT SELECT ON public.personal_task_automations TO service_role;
GRANT TRIGGER ON public.personal_task_automations TO service_role;
GRANT TRUNCATE ON public.personal_task_automations TO service_role;
GRANT UPDATE ON public.personal_task_automations TO service_role;
GRANT DELETE ON public.personal_task_checklists TO anon;
GRANT INSERT ON public.personal_task_checklists TO anon;
GRANT REFERENCES ON public.personal_task_checklists TO anon;
GRANT SELECT ON public.personal_task_checklists TO anon;
GRANT TRIGGER ON public.personal_task_checklists TO anon;
GRANT TRUNCATE ON public.personal_task_checklists TO anon;
GRANT UPDATE ON public.personal_task_checklists TO anon;
GRANT DELETE ON public.personal_task_checklists TO authenticated;
GRANT INSERT ON public.personal_task_checklists TO authenticated;
GRANT REFERENCES ON public.personal_task_checklists TO authenticated;
GRANT SELECT ON public.personal_task_checklists TO authenticated;
GRANT TRIGGER ON public.personal_task_checklists TO authenticated;
GRANT TRUNCATE ON public.personal_task_checklists TO authenticated;
GRANT UPDATE ON public.personal_task_checklists TO authenticated;
GRANT DELETE ON public.personal_task_checklists TO service_role;
GRANT INSERT ON public.personal_task_checklists TO service_role;
GRANT REFERENCES ON public.personal_task_checklists TO service_role;
GRANT SELECT ON public.personal_task_checklists TO service_role;
GRANT TRIGGER ON public.personal_task_checklists TO service_role;
GRANT TRUNCATE ON public.personal_task_checklists TO service_role;
GRANT UPDATE ON public.personal_task_checklists TO service_role;
GRANT DELETE ON public.personal_task_dependencies TO anon;
GRANT INSERT ON public.personal_task_dependencies TO anon;
GRANT REFERENCES ON public.personal_task_dependencies TO anon;
GRANT SELECT ON public.personal_task_dependencies TO anon;
GRANT TRIGGER ON public.personal_task_dependencies TO anon;
GRANT TRUNCATE ON public.personal_task_dependencies TO anon;
GRANT UPDATE ON public.personal_task_dependencies TO anon;
GRANT DELETE ON public.personal_task_dependencies TO authenticated;
GRANT INSERT ON public.personal_task_dependencies TO authenticated;
GRANT REFERENCES ON public.personal_task_dependencies TO authenticated;
GRANT SELECT ON public.personal_task_dependencies TO authenticated;
GRANT TRIGGER ON public.personal_task_dependencies TO authenticated;
GRANT TRUNCATE ON public.personal_task_dependencies TO authenticated;
GRANT UPDATE ON public.personal_task_dependencies TO authenticated;
GRANT DELETE ON public.personal_task_dependencies TO service_role;
GRANT INSERT ON public.personal_task_dependencies TO service_role;
GRANT REFERENCES ON public.personal_task_dependencies TO service_role;
GRANT SELECT ON public.personal_task_dependencies TO service_role;
GRANT TRIGGER ON public.personal_task_dependencies TO service_role;
GRANT TRUNCATE ON public.personal_task_dependencies TO service_role;
GRANT UPDATE ON public.personal_task_dependencies TO service_role;
GRANT DELETE ON public.personal_task_stage_fields TO anon;
GRANT INSERT ON public.personal_task_stage_fields TO anon;
GRANT REFERENCES ON public.personal_task_stage_fields TO anon;
GRANT SELECT ON public.personal_task_stage_fields TO anon;
GRANT TRIGGER ON public.personal_task_stage_fields TO anon;
GRANT TRUNCATE ON public.personal_task_stage_fields TO anon;
GRANT UPDATE ON public.personal_task_stage_fields TO anon;
GRANT DELETE ON public.personal_task_stage_fields TO authenticated;
GRANT INSERT ON public.personal_task_stage_fields TO authenticated;
GRANT REFERENCES ON public.personal_task_stage_fields TO authenticated;
GRANT SELECT ON public.personal_task_stage_fields TO authenticated;
GRANT TRIGGER ON public.personal_task_stage_fields TO authenticated;
GRANT TRUNCATE ON public.personal_task_stage_fields TO authenticated;
GRANT UPDATE ON public.personal_task_stage_fields TO authenticated;
GRANT DELETE ON public.personal_task_stage_fields TO service_role;
GRANT INSERT ON public.personal_task_stage_fields TO service_role;
GRANT REFERENCES ON public.personal_task_stage_fields TO service_role;
GRANT SELECT ON public.personal_task_stage_fields TO service_role;
GRANT TRIGGER ON public.personal_task_stage_fields TO service_role;
GRANT TRUNCATE ON public.personal_task_stage_fields TO service_role;
GRANT UPDATE ON public.personal_task_stage_fields TO service_role;
GRANT DELETE ON public.personal_task_stages TO anon;
GRANT INSERT ON public.personal_task_stages TO anon;
GRANT REFERENCES ON public.personal_task_stages TO anon;
GRANT SELECT ON public.personal_task_stages TO anon;
GRANT TRIGGER ON public.personal_task_stages TO anon;
GRANT TRUNCATE ON public.personal_task_stages TO anon;
GRANT UPDATE ON public.personal_task_stages TO anon;
GRANT DELETE ON public.personal_task_stages TO authenticated;
GRANT INSERT ON public.personal_task_stages TO authenticated;
GRANT REFERENCES ON public.personal_task_stages TO authenticated;
GRANT SELECT ON public.personal_task_stages TO authenticated;
GRANT TRIGGER ON public.personal_task_stages TO authenticated;
GRANT TRUNCATE ON public.personal_task_stages TO authenticated;
GRANT UPDATE ON public.personal_task_stages TO authenticated;
GRANT DELETE ON public.personal_task_stages TO service_role;
GRANT INSERT ON public.personal_task_stages TO service_role;
GRANT REFERENCES ON public.personal_task_stages TO service_role;
GRANT SELECT ON public.personal_task_stages TO service_role;
GRANT TRIGGER ON public.personal_task_stages TO service_role;
GRANT TRUNCATE ON public.personal_task_stages TO service_role;
GRANT UPDATE ON public.personal_task_stages TO service_role;
GRANT DELETE ON public.personal_task_tags TO anon;
GRANT INSERT ON public.personal_task_tags TO anon;
GRANT REFERENCES ON public.personal_task_tags TO anon;
GRANT SELECT ON public.personal_task_tags TO anon;
GRANT TRIGGER ON public.personal_task_tags TO anon;
GRANT TRUNCATE ON public.personal_task_tags TO anon;
GRANT UPDATE ON public.personal_task_tags TO anon;
GRANT DELETE ON public.personal_task_tags TO authenticated;
GRANT INSERT ON public.personal_task_tags TO authenticated;
GRANT REFERENCES ON public.personal_task_tags TO authenticated;
GRANT SELECT ON public.personal_task_tags TO authenticated;
GRANT TRIGGER ON public.personal_task_tags TO authenticated;
GRANT TRUNCATE ON public.personal_task_tags TO authenticated;
GRANT UPDATE ON public.personal_task_tags TO authenticated;
GRANT DELETE ON public.personal_task_tags TO service_role;
GRANT INSERT ON public.personal_task_tags TO service_role;
GRANT REFERENCES ON public.personal_task_tags TO service_role;
GRANT SELECT ON public.personal_task_tags TO service_role;
GRANT TRIGGER ON public.personal_task_tags TO service_role;
GRANT TRUNCATE ON public.personal_task_tags TO service_role;
GRANT UPDATE ON public.personal_task_tags TO service_role;
GRANT DELETE ON public.personal_tasks TO anon;
GRANT INSERT ON public.personal_tasks TO anon;
GRANT REFERENCES ON public.personal_tasks TO anon;
GRANT SELECT ON public.personal_tasks TO anon;
GRANT TRIGGER ON public.personal_tasks TO anon;
GRANT TRUNCATE ON public.personal_tasks TO anon;
GRANT UPDATE ON public.personal_tasks TO anon;
GRANT DELETE ON public.personal_tasks TO authenticated;
GRANT INSERT ON public.personal_tasks TO authenticated;
GRANT REFERENCES ON public.personal_tasks TO authenticated;
GRANT SELECT ON public.personal_tasks TO authenticated;
GRANT TRIGGER ON public.personal_tasks TO authenticated;
GRANT TRUNCATE ON public.personal_tasks TO authenticated;
GRANT UPDATE ON public.personal_tasks TO authenticated;
GRANT DELETE ON public.personal_tasks TO service_role;
GRANT INSERT ON public.personal_tasks TO service_role;
GRANT REFERENCES ON public.personal_tasks TO service_role;
GRANT SELECT ON public.personal_tasks TO service_role;
GRANT TRIGGER ON public.personal_tasks TO service_role;
GRANT TRUNCATE ON public.personal_tasks TO service_role;
GRANT UPDATE ON public.personal_tasks TO service_role;
GRANT DELETE ON public.personal_tasks_api_keys TO anon;
GRANT INSERT ON public.personal_tasks_api_keys TO anon;
GRANT REFERENCES ON public.personal_tasks_api_keys TO anon;
GRANT SELECT ON public.personal_tasks_api_keys TO anon;
GRANT TRIGGER ON public.personal_tasks_api_keys TO anon;
GRANT TRUNCATE ON public.personal_tasks_api_keys TO anon;
GRANT UPDATE ON public.personal_tasks_api_keys TO anon;
GRANT DELETE ON public.personal_tasks_api_keys TO authenticated;
GRANT INSERT ON public.personal_tasks_api_keys TO authenticated;
GRANT REFERENCES ON public.personal_tasks_api_keys TO authenticated;
GRANT SELECT ON public.personal_tasks_api_keys TO authenticated;
GRANT TRIGGER ON public.personal_tasks_api_keys TO authenticated;
GRANT TRUNCATE ON public.personal_tasks_api_keys TO authenticated;
GRANT UPDATE ON public.personal_tasks_api_keys TO authenticated;
GRANT DELETE ON public.personal_tasks_api_keys TO service_role;
GRANT INSERT ON public.personal_tasks_api_keys TO service_role;
GRANT REFERENCES ON public.personal_tasks_api_keys TO service_role;
GRANT SELECT ON public.personal_tasks_api_keys TO service_role;
GRANT TRIGGER ON public.personal_tasks_api_keys TO service_role;
GRANT TRUNCATE ON public.personal_tasks_api_keys TO service_role;
GRANT UPDATE ON public.personal_tasks_api_keys TO service_role;
GRANT DELETE ON public.pipeline_stage_fields TO anon;
GRANT INSERT ON public.pipeline_stage_fields TO anon;
GRANT REFERENCES ON public.pipeline_stage_fields TO anon;
GRANT SELECT ON public.pipeline_stage_fields TO anon;
GRANT TRIGGER ON public.pipeline_stage_fields TO anon;
GRANT TRUNCATE ON public.pipeline_stage_fields TO anon;
GRANT UPDATE ON public.pipeline_stage_fields TO anon;
GRANT DELETE ON public.pipeline_stage_fields TO authenticated;
GRANT INSERT ON public.pipeline_stage_fields TO authenticated;
GRANT REFERENCES ON public.pipeline_stage_fields TO authenticated;
GRANT SELECT ON public.pipeline_stage_fields TO authenticated;
GRANT TRIGGER ON public.pipeline_stage_fields TO authenticated;
GRANT TRUNCATE ON public.pipeline_stage_fields TO authenticated;
GRANT UPDATE ON public.pipeline_stage_fields TO authenticated;
GRANT DELETE ON public.pipeline_stage_fields TO service_role;
GRANT INSERT ON public.pipeline_stage_fields TO service_role;
GRANT REFERENCES ON public.pipeline_stage_fields TO service_role;
GRANT SELECT ON public.pipeline_stage_fields TO service_role;
GRANT TRIGGER ON public.pipeline_stage_fields TO service_role;
GRANT TRUNCATE ON public.pipeline_stage_fields TO service_role;
GRANT UPDATE ON public.pipeline_stage_fields TO service_role;
GRANT DELETE ON public.pipeline_stage_transitions TO anon;
GRANT INSERT ON public.pipeline_stage_transitions TO anon;
GRANT REFERENCES ON public.pipeline_stage_transitions TO anon;
GRANT SELECT ON public.pipeline_stage_transitions TO anon;
GRANT TRIGGER ON public.pipeline_stage_transitions TO anon;
GRANT TRUNCATE ON public.pipeline_stage_transitions TO anon;
GRANT UPDATE ON public.pipeline_stage_transitions TO anon;
GRANT DELETE ON public.pipeline_stage_transitions TO authenticated;
GRANT INSERT ON public.pipeline_stage_transitions TO authenticated;
GRANT REFERENCES ON public.pipeline_stage_transitions TO authenticated;
GRANT SELECT ON public.pipeline_stage_transitions TO authenticated;
GRANT TRIGGER ON public.pipeline_stage_transitions TO authenticated;
GRANT TRUNCATE ON public.pipeline_stage_transitions TO authenticated;
GRANT UPDATE ON public.pipeline_stage_transitions TO authenticated;
GRANT DELETE ON public.pipeline_stage_transitions TO service_role;
GRANT INSERT ON public.pipeline_stage_transitions TO service_role;
GRANT REFERENCES ON public.pipeline_stage_transitions TO service_role;
GRANT SELECT ON public.pipeline_stage_transitions TO service_role;
GRANT TRIGGER ON public.pipeline_stage_transitions TO service_role;
GRANT TRUNCATE ON public.pipeline_stage_transitions TO service_role;
GRANT UPDATE ON public.pipeline_stage_transitions TO service_role;
GRANT DELETE ON public.posvenda_cases TO anon;
GRANT INSERT ON public.posvenda_cases TO anon;
GRANT REFERENCES ON public.posvenda_cases TO anon;
GRANT SELECT ON public.posvenda_cases TO anon;
GRANT TRIGGER ON public.posvenda_cases TO anon;
GRANT TRUNCATE ON public.posvenda_cases TO anon;
GRANT UPDATE ON public.posvenda_cases TO anon;
GRANT DELETE ON public.posvenda_cases TO authenticated;
GRANT INSERT ON public.posvenda_cases TO authenticated;
GRANT REFERENCES ON public.posvenda_cases TO authenticated;
GRANT SELECT ON public.posvenda_cases TO authenticated;
GRANT TRIGGER ON public.posvenda_cases TO authenticated;
GRANT TRUNCATE ON public.posvenda_cases TO authenticated;
GRANT UPDATE ON public.posvenda_cases TO authenticated;
GRANT DELETE ON public.posvenda_cases TO service_role;
GRANT INSERT ON public.posvenda_cases TO service_role;
GRANT REFERENCES ON public.posvenda_cases TO service_role;
GRANT SELECT ON public.posvenda_cases TO service_role;
GRANT TRIGGER ON public.posvenda_cases TO service_role;
GRANT TRUNCATE ON public.posvenda_cases TO service_role;
GRANT UPDATE ON public.posvenda_cases TO service_role;
GRANT DELETE ON public.products TO anon;
GRANT INSERT ON public.products TO anon;
GRANT REFERENCES ON public.products TO anon;
GRANT SELECT ON public.products TO anon;
GRANT TRIGGER ON public.products TO anon;
GRANT TRUNCATE ON public.products TO anon;
GRANT UPDATE ON public.products TO anon;
GRANT DELETE ON public.products TO authenticated;
GRANT INSERT ON public.products TO authenticated;
GRANT REFERENCES ON public.products TO authenticated;
GRANT SELECT ON public.products TO authenticated;
GRANT TRIGGER ON public.products TO authenticated;
GRANT TRUNCATE ON public.products TO authenticated;
GRANT UPDATE ON public.products TO authenticated;
GRANT DELETE ON public.products TO service_role;
GRANT INSERT ON public.products TO service_role;
GRANT REFERENCES ON public.products TO service_role;
GRANT SELECT ON public.products TO service_role;
GRANT TRIGGER ON public.products TO service_role;
GRANT TRUNCATE ON public.products TO service_role;
GRANT UPDATE ON public.products TO service_role;
GRANT DELETE ON public.profile_module_overrides TO anon;
GRANT INSERT ON public.profile_module_overrides TO anon;
GRANT REFERENCES ON public.profile_module_overrides TO anon;
GRANT SELECT ON public.profile_module_overrides TO anon;
GRANT TRIGGER ON public.profile_module_overrides TO anon;
GRANT TRUNCATE ON public.profile_module_overrides TO anon;
GRANT UPDATE ON public.profile_module_overrides TO anon;
GRANT DELETE ON public.profile_module_overrides TO authenticated;
GRANT INSERT ON public.profile_module_overrides TO authenticated;
GRANT REFERENCES ON public.profile_module_overrides TO authenticated;
GRANT SELECT ON public.profile_module_overrides TO authenticated;
GRANT TRIGGER ON public.profile_module_overrides TO authenticated;
GRANT TRUNCATE ON public.profile_module_overrides TO authenticated;
GRANT UPDATE ON public.profile_module_overrides TO authenticated;
GRANT DELETE ON public.profile_module_overrides TO service_role;
GRANT INSERT ON public.profile_module_overrides TO service_role;
GRANT REFERENCES ON public.profile_module_overrides TO service_role;
GRANT SELECT ON public.profile_module_overrides TO service_role;
GRANT TRIGGER ON public.profile_module_overrides TO service_role;
GRANT TRUNCATE ON public.profile_module_overrides TO service_role;
GRANT UPDATE ON public.profile_module_overrides TO service_role;
GRANT DELETE ON public.profile_secrets TO anon;
GRANT INSERT ON public.profile_secrets TO anon;
GRANT REFERENCES ON public.profile_secrets TO anon;
GRANT SELECT ON public.profile_secrets TO anon;
GRANT TRIGGER ON public.profile_secrets TO anon;
GRANT TRUNCATE ON public.profile_secrets TO anon;
GRANT UPDATE ON public.profile_secrets TO anon;
GRANT DELETE ON public.profile_secrets TO authenticated;
GRANT INSERT ON public.profile_secrets TO authenticated;
GRANT REFERENCES ON public.profile_secrets TO authenticated;
GRANT SELECT ON public.profile_secrets TO authenticated;
GRANT TRIGGER ON public.profile_secrets TO authenticated;
GRANT TRUNCATE ON public.profile_secrets TO authenticated;
GRANT UPDATE ON public.profile_secrets TO authenticated;
GRANT DELETE ON public.profile_secrets TO service_role;
GRANT INSERT ON public.profile_secrets TO service_role;
GRANT REFERENCES ON public.profile_secrets TO service_role;
GRANT SELECT ON public.profile_secrets TO service_role;
GRANT TRIGGER ON public.profile_secrets TO service_role;
GRANT TRUNCATE ON public.profile_secrets TO service_role;
GRANT UPDATE ON public.profile_secrets TO service_role;
GRANT DELETE ON public.profiles TO anon;
GRANT INSERT ON public.profiles TO anon;
GRANT REFERENCES ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT TRIGGER ON public.profiles TO anon;
GRANT TRUNCATE ON public.profiles TO anon;
GRANT UPDATE ON public.profiles TO anon;
GRANT DELETE ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT REFERENCES ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT TRIGGER ON public.profiles TO authenticated;
GRANT TRUNCATE ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT DELETE ON public.profiles TO service_role;
GRANT INSERT ON public.profiles TO service_role;
GRANT REFERENCES ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO service_role;
GRANT TRIGGER ON public.profiles TO service_role;
GRANT TRUNCATE ON public.profiles TO service_role;
GRANT UPDATE ON public.profiles TO service_role;
GRANT DELETE ON public.proposal_line_items TO anon;
GRANT INSERT ON public.proposal_line_items TO anon;
GRANT REFERENCES ON public.proposal_line_items TO anon;
GRANT SELECT ON public.proposal_line_items TO anon;
GRANT TRIGGER ON public.proposal_line_items TO anon;
GRANT TRUNCATE ON public.proposal_line_items TO anon;
GRANT UPDATE ON public.proposal_line_items TO anon;
GRANT DELETE ON public.proposal_line_items TO authenticated;
GRANT INSERT ON public.proposal_line_items TO authenticated;
GRANT REFERENCES ON public.proposal_line_items TO authenticated;
GRANT SELECT ON public.proposal_line_items TO authenticated;
GRANT TRIGGER ON public.proposal_line_items TO authenticated;
GRANT TRUNCATE ON public.proposal_line_items TO authenticated;
GRANT UPDATE ON public.proposal_line_items TO authenticated;
GRANT DELETE ON public.proposal_line_items TO service_role;
GRANT INSERT ON public.proposal_line_items TO service_role;
GRANT REFERENCES ON public.proposal_line_items TO service_role;
GRANT SELECT ON public.proposal_line_items TO service_role;
GRANT TRIGGER ON public.proposal_line_items TO service_role;
GRANT TRUNCATE ON public.proposal_line_items TO service_role;
GRANT UPDATE ON public.proposal_line_items TO service_role;
GRANT DELETE ON public.proposals TO anon;
GRANT INSERT ON public.proposals TO anon;
GRANT REFERENCES ON public.proposals TO anon;
GRANT SELECT ON public.proposals TO anon;
GRANT TRIGGER ON public.proposals TO anon;
GRANT TRUNCATE ON public.proposals TO anon;
GRANT UPDATE ON public.proposals TO anon;
GRANT DELETE ON public.proposals TO authenticated;
GRANT INSERT ON public.proposals TO authenticated;
GRANT REFERENCES ON public.proposals TO authenticated;
GRANT SELECT ON public.proposals TO authenticated;
GRANT TRIGGER ON public.proposals TO authenticated;
GRANT TRUNCATE ON public.proposals TO authenticated;
GRANT UPDATE ON public.proposals TO authenticated;
GRANT DELETE ON public.proposals TO service_role;
GRANT INSERT ON public.proposals TO service_role;
GRANT REFERENCES ON public.proposals TO service_role;
GRANT SELECT ON public.proposals TO service_role;
GRANT TRIGGER ON public.proposals TO service_role;
GRANT TRUNCATE ON public.proposals TO service_role;
GRANT UPDATE ON public.proposals TO service_role;
GRANT DELETE ON public.prospect_seeds TO anon;
GRANT INSERT ON public.prospect_seeds TO anon;
GRANT REFERENCES ON public.prospect_seeds TO anon;
GRANT SELECT ON public.prospect_seeds TO anon;
GRANT TRIGGER ON public.prospect_seeds TO anon;
GRANT TRUNCATE ON public.prospect_seeds TO anon;
GRANT UPDATE ON public.prospect_seeds TO anon;
GRANT DELETE ON public.prospect_seeds TO authenticated;
GRANT INSERT ON public.prospect_seeds TO authenticated;
GRANT REFERENCES ON public.prospect_seeds TO authenticated;
GRANT SELECT ON public.prospect_seeds TO authenticated;
GRANT TRIGGER ON public.prospect_seeds TO authenticated;
GRANT TRUNCATE ON public.prospect_seeds TO authenticated;
GRANT UPDATE ON public.prospect_seeds TO authenticated;
GRANT DELETE ON public.prospect_seeds TO service_role;
GRANT INSERT ON public.prospect_seeds TO service_role;
GRANT REFERENCES ON public.prospect_seeds TO service_role;
GRANT SELECT ON public.prospect_seeds TO service_role;
GRANT TRIGGER ON public.prospect_seeds TO service_role;
GRANT TRUNCATE ON public.prospect_seeds TO service_role;
GRANT UPDATE ON public.prospect_seeds TO service_role;
GRANT DELETE ON public.rapp_candidatos_cadeia TO service_role;
GRANT INSERT ON public.rapp_candidatos_cadeia TO service_role;
GRANT REFERENCES ON public.rapp_candidatos_cadeia TO service_role;
GRANT SELECT ON public.rapp_candidatos_cadeia TO service_role;
GRANT TRIGGER ON public.rapp_candidatos_cadeia TO service_role;
GRANT TRUNCATE ON public.rapp_candidatos_cadeia TO service_role;
GRANT UPDATE ON public.rapp_candidatos_cadeia TO service_role;
GRANT DELETE ON public.rapp_candidatos_resibag TO service_role;
GRANT INSERT ON public.rapp_candidatos_resibag TO service_role;
GRANT REFERENCES ON public.rapp_candidatos_resibag TO service_role;
GRANT SELECT ON public.rapp_candidatos_resibag TO service_role;
GRANT TRIGGER ON public.rapp_candidatos_resibag TO service_role;
GRANT TRUNCATE ON public.rapp_candidatos_resibag TO service_role;
GRANT UPDATE ON public.rapp_candidatos_resibag TO service_role;
GRANT DELETE ON public.rapp_cargas TO anon;
GRANT INSERT ON public.rapp_cargas TO anon;
GRANT REFERENCES ON public.rapp_cargas TO anon;
GRANT SELECT ON public.rapp_cargas TO anon;
GRANT TRIGGER ON public.rapp_cargas TO anon;
GRANT TRUNCATE ON public.rapp_cargas TO anon;
GRANT UPDATE ON public.rapp_cargas TO anon;
GRANT DELETE ON public.rapp_cargas TO authenticated;
GRANT INSERT ON public.rapp_cargas TO authenticated;
GRANT REFERENCES ON public.rapp_cargas TO authenticated;
GRANT SELECT ON public.rapp_cargas TO authenticated;
GRANT TRIGGER ON public.rapp_cargas TO authenticated;
GRANT TRUNCATE ON public.rapp_cargas TO authenticated;
GRANT UPDATE ON public.rapp_cargas TO authenticated;
GRANT DELETE ON public.rapp_cargas TO service_role;
GRANT INSERT ON public.rapp_cargas TO service_role;
GRANT REFERENCES ON public.rapp_cargas TO service_role;
GRANT SELECT ON public.rapp_cargas TO service_role;
GRANT TRIGGER ON public.rapp_cargas TO service_role;
GRANT TRUNCATE ON public.rapp_cargas TO service_role;
GRANT UPDATE ON public.rapp_cargas TO service_role;
GRANT DELETE ON public.rapp_ibama TO anon;
GRANT INSERT ON public.rapp_ibama TO anon;
GRANT REFERENCES ON public.rapp_ibama TO anon;
GRANT SELECT ON public.rapp_ibama TO anon;
GRANT TRIGGER ON public.rapp_ibama TO anon;
GRANT TRUNCATE ON public.rapp_ibama TO anon;
GRANT UPDATE ON public.rapp_ibama TO anon;
GRANT DELETE ON public.rapp_ibama TO authenticated;
GRANT INSERT ON public.rapp_ibama TO authenticated;
GRANT REFERENCES ON public.rapp_ibama TO authenticated;
GRANT SELECT ON public.rapp_ibama TO authenticated;
GRANT TRIGGER ON public.rapp_ibama TO authenticated;
GRANT TRUNCATE ON public.rapp_ibama TO authenticated;
GRANT UPDATE ON public.rapp_ibama TO authenticated;
GRANT DELETE ON public.rapp_ibama TO service_role;
GRANT INSERT ON public.rapp_ibama TO service_role;
GRANT REFERENCES ON public.rapp_ibama TO service_role;
GRANT SELECT ON public.rapp_ibama TO service_role;
GRANT TRIGGER ON public.rapp_ibama TO service_role;
GRANT TRUNCATE ON public.rapp_ibama TO service_role;
GRANT UPDATE ON public.rapp_ibama TO service_role;
GRANT DELETE ON public.record_views TO anon;
GRANT INSERT ON public.record_views TO anon;
GRANT REFERENCES ON public.record_views TO anon;
GRANT SELECT ON public.record_views TO anon;
GRANT TRIGGER ON public.record_views TO anon;
GRANT TRUNCATE ON public.record_views TO anon;
GRANT UPDATE ON public.record_views TO anon;
GRANT DELETE ON public.record_views TO authenticated;
GRANT INSERT ON public.record_views TO authenticated;
GRANT REFERENCES ON public.record_views TO authenticated;
GRANT SELECT ON public.record_views TO authenticated;
GRANT TRIGGER ON public.record_views TO authenticated;
GRANT TRUNCATE ON public.record_views TO authenticated;
GRANT UPDATE ON public.record_views TO authenticated;
GRANT DELETE ON public.record_views TO service_role;
GRANT INSERT ON public.record_views TO service_role;
GRANT REFERENCES ON public.record_views TO service_role;
GRANT SELECT ON public.record_views TO service_role;
GRANT TRIGGER ON public.record_views TO service_role;
GRANT TRUNCATE ON public.record_views TO service_role;
GRANT UPDATE ON public.record_views TO service_role;
GRANT DELETE ON public.rh_aplicacoes TO anon;
GRANT INSERT ON public.rh_aplicacoes TO anon;
GRANT REFERENCES ON public.rh_aplicacoes TO anon;
GRANT SELECT ON public.rh_aplicacoes TO anon;
GRANT TRIGGER ON public.rh_aplicacoes TO anon;
GRANT TRUNCATE ON public.rh_aplicacoes TO anon;
GRANT UPDATE ON public.rh_aplicacoes TO anon;
GRANT DELETE ON public.rh_aplicacoes TO authenticated;
GRANT INSERT ON public.rh_aplicacoes TO authenticated;
GRANT REFERENCES ON public.rh_aplicacoes TO authenticated;
GRANT SELECT ON public.rh_aplicacoes TO authenticated;
GRANT TRIGGER ON public.rh_aplicacoes TO authenticated;
GRANT TRUNCATE ON public.rh_aplicacoes TO authenticated;
GRANT UPDATE ON public.rh_aplicacoes TO authenticated;
GRANT DELETE ON public.rh_aplicacoes TO service_role;
GRANT INSERT ON public.rh_aplicacoes TO service_role;
GRANT REFERENCES ON public.rh_aplicacoes TO service_role;
GRANT SELECT ON public.rh_aplicacoes TO service_role;
GRANT TRIGGER ON public.rh_aplicacoes TO service_role;
GRANT TRUNCATE ON public.rh_aplicacoes TO service_role;
GRANT UPDATE ON public.rh_aplicacoes TO service_role;
GRANT DELETE ON public.rh_attachments TO anon;
GRANT INSERT ON public.rh_attachments TO anon;
GRANT REFERENCES ON public.rh_attachments TO anon;
GRANT SELECT ON public.rh_attachments TO anon;
GRANT TRIGGER ON public.rh_attachments TO anon;
GRANT TRUNCATE ON public.rh_attachments TO anon;
GRANT UPDATE ON public.rh_attachments TO anon;
GRANT DELETE ON public.rh_attachments TO authenticated;
GRANT INSERT ON public.rh_attachments TO authenticated;
GRANT REFERENCES ON public.rh_attachments TO authenticated;
GRANT SELECT ON public.rh_attachments TO authenticated;
GRANT TRIGGER ON public.rh_attachments TO authenticated;
GRANT TRUNCATE ON public.rh_attachments TO authenticated;
GRANT UPDATE ON public.rh_attachments TO authenticated;
GRANT DELETE ON public.rh_attachments TO service_role;
GRANT INSERT ON public.rh_attachments TO service_role;
GRANT REFERENCES ON public.rh_attachments TO service_role;
GRANT SELECT ON public.rh_attachments TO service_role;
GRANT TRIGGER ON public.rh_attachments TO service_role;
GRANT TRUNCATE ON public.rh_attachments TO service_role;
GRANT UPDATE ON public.rh_attachments TO service_role;
GRANT DELETE ON public.rh_avaliacoes TO anon;
GRANT INSERT ON public.rh_avaliacoes TO anon;
GRANT REFERENCES ON public.rh_avaliacoes TO anon;
GRANT SELECT ON public.rh_avaliacoes TO anon;
GRANT TRIGGER ON public.rh_avaliacoes TO anon;
GRANT TRUNCATE ON public.rh_avaliacoes TO anon;
GRANT UPDATE ON public.rh_avaliacoes TO anon;
GRANT DELETE ON public.rh_avaliacoes TO authenticated;
GRANT INSERT ON public.rh_avaliacoes TO authenticated;
GRANT REFERENCES ON public.rh_avaliacoes TO authenticated;
GRANT SELECT ON public.rh_avaliacoes TO authenticated;
GRANT TRIGGER ON public.rh_avaliacoes TO authenticated;
GRANT TRUNCATE ON public.rh_avaliacoes TO authenticated;
GRANT UPDATE ON public.rh_avaliacoes TO authenticated;
GRANT DELETE ON public.rh_avaliacoes TO service_role;
GRANT INSERT ON public.rh_avaliacoes TO service_role;
GRANT REFERENCES ON public.rh_avaliacoes TO service_role;
GRANT SELECT ON public.rh_avaliacoes TO service_role;
GRANT TRIGGER ON public.rh_avaliacoes TO service_role;
GRANT TRUNCATE ON public.rh_avaliacoes TO service_role;
GRANT UPDATE ON public.rh_avaliacoes TO service_role;
GRANT DELETE ON public.rh_bemestar_fila TO anon;
GRANT INSERT ON public.rh_bemestar_fila TO anon;
GRANT REFERENCES ON public.rh_bemestar_fila TO anon;
GRANT SELECT ON public.rh_bemestar_fila TO anon;
GRANT TRIGGER ON public.rh_bemestar_fila TO anon;
GRANT TRUNCATE ON public.rh_bemestar_fila TO anon;
GRANT UPDATE ON public.rh_bemestar_fila TO anon;
GRANT DELETE ON public.rh_bemestar_fila TO authenticated;
GRANT INSERT ON public.rh_bemestar_fila TO authenticated;
GRANT REFERENCES ON public.rh_bemestar_fila TO authenticated;
GRANT SELECT ON public.rh_bemestar_fila TO authenticated;
GRANT TRIGGER ON public.rh_bemestar_fila TO authenticated;
GRANT TRUNCATE ON public.rh_bemestar_fila TO authenticated;
GRANT UPDATE ON public.rh_bemestar_fila TO authenticated;
GRANT DELETE ON public.rh_bemestar_fila TO service_role;
GRANT INSERT ON public.rh_bemestar_fila TO service_role;
GRANT REFERENCES ON public.rh_bemestar_fila TO service_role;
GRANT SELECT ON public.rh_bemestar_fila TO service_role;
GRANT TRIGGER ON public.rh_bemestar_fila TO service_role;
GRANT TRUNCATE ON public.rh_bemestar_fila TO service_role;
GRANT UPDATE ON public.rh_bemestar_fila TO service_role;
GRANT DELETE ON public.rh_bemestar_sessoes TO anon;
GRANT INSERT ON public.rh_bemestar_sessoes TO anon;
GRANT REFERENCES ON public.rh_bemestar_sessoes TO anon;
GRANT SELECT ON public.rh_bemestar_sessoes TO anon;
GRANT TRIGGER ON public.rh_bemestar_sessoes TO anon;
GRANT TRUNCATE ON public.rh_bemestar_sessoes TO anon;
GRANT UPDATE ON public.rh_bemestar_sessoes TO anon;
GRANT DELETE ON public.rh_bemestar_sessoes TO authenticated;
GRANT INSERT ON public.rh_bemestar_sessoes TO authenticated;
GRANT REFERENCES ON public.rh_bemestar_sessoes TO authenticated;
GRANT SELECT ON public.rh_bemestar_sessoes TO authenticated;
GRANT TRIGGER ON public.rh_bemestar_sessoes TO authenticated;
GRANT TRUNCATE ON public.rh_bemestar_sessoes TO authenticated;
GRANT UPDATE ON public.rh_bemestar_sessoes TO authenticated;
GRANT DELETE ON public.rh_bemestar_sessoes TO service_role;
GRANT INSERT ON public.rh_bemestar_sessoes TO service_role;
GRANT REFERENCES ON public.rh_bemestar_sessoes TO service_role;
GRANT SELECT ON public.rh_bemestar_sessoes TO service_role;
GRANT TRIGGER ON public.rh_bemestar_sessoes TO service_role;
GRANT TRUNCATE ON public.rh_bemestar_sessoes TO service_role;
GRANT UPDATE ON public.rh_bemestar_sessoes TO service_role;
GRANT DELETE ON public.rh_beneficios_catalogo TO anon;
GRANT INSERT ON public.rh_beneficios_catalogo TO anon;
GRANT REFERENCES ON public.rh_beneficios_catalogo TO anon;
GRANT SELECT ON public.rh_beneficios_catalogo TO anon;
GRANT TRIGGER ON public.rh_beneficios_catalogo TO anon;
GRANT TRUNCATE ON public.rh_beneficios_catalogo TO anon;
GRANT UPDATE ON public.rh_beneficios_catalogo TO anon;
GRANT DELETE ON public.rh_beneficios_catalogo TO authenticated;
GRANT INSERT ON public.rh_beneficios_catalogo TO authenticated;
GRANT REFERENCES ON public.rh_beneficios_catalogo TO authenticated;
GRANT SELECT ON public.rh_beneficios_catalogo TO authenticated;
GRANT TRIGGER ON public.rh_beneficios_catalogo TO authenticated;
GRANT TRUNCATE ON public.rh_beneficios_catalogo TO authenticated;
GRANT UPDATE ON public.rh_beneficios_catalogo TO authenticated;
GRANT DELETE ON public.rh_beneficios_catalogo TO service_role;
GRANT INSERT ON public.rh_beneficios_catalogo TO service_role;
GRANT REFERENCES ON public.rh_beneficios_catalogo TO service_role;
GRANT SELECT ON public.rh_beneficios_catalogo TO service_role;
GRANT TRIGGER ON public.rh_beneficios_catalogo TO service_role;
GRANT TRUNCATE ON public.rh_beneficios_catalogo TO service_role;
GRANT UPDATE ON public.rh_beneficios_catalogo TO service_role;
GRANT DELETE ON public.rh_candidatos TO anon;
GRANT INSERT ON public.rh_candidatos TO anon;
GRANT REFERENCES ON public.rh_candidatos TO anon;
GRANT SELECT ON public.rh_candidatos TO anon;
GRANT TRIGGER ON public.rh_candidatos TO anon;
GRANT TRUNCATE ON public.rh_candidatos TO anon;
GRANT UPDATE ON public.rh_candidatos TO anon;
GRANT DELETE ON public.rh_candidatos TO authenticated;
GRANT INSERT ON public.rh_candidatos TO authenticated;
GRANT REFERENCES ON public.rh_candidatos TO authenticated;
GRANT SELECT ON public.rh_candidatos TO authenticated;
GRANT TRIGGER ON public.rh_candidatos TO authenticated;
GRANT TRUNCATE ON public.rh_candidatos TO authenticated;
GRANT UPDATE ON public.rh_candidatos TO authenticated;
GRANT DELETE ON public.rh_candidatos TO service_role;
GRANT INSERT ON public.rh_candidatos TO service_role;
GRANT REFERENCES ON public.rh_candidatos TO service_role;
GRANT SELECT ON public.rh_candidatos TO service_role;
GRANT TRIGGER ON public.rh_candidatos TO service_role;
GRANT TRUNCATE ON public.rh_candidatos TO service_role;
GRANT UPDATE ON public.rh_candidatos TO service_role;
GRANT DELETE ON public.rh_cargo_templates TO anon;
GRANT INSERT ON public.rh_cargo_templates TO anon;
GRANT REFERENCES ON public.rh_cargo_templates TO anon;
GRANT SELECT ON public.rh_cargo_templates TO anon;
GRANT TRIGGER ON public.rh_cargo_templates TO anon;
GRANT TRUNCATE ON public.rh_cargo_templates TO anon;
GRANT UPDATE ON public.rh_cargo_templates TO anon;
GRANT DELETE ON public.rh_cargo_templates TO authenticated;
GRANT INSERT ON public.rh_cargo_templates TO authenticated;
GRANT REFERENCES ON public.rh_cargo_templates TO authenticated;
GRANT SELECT ON public.rh_cargo_templates TO authenticated;
GRANT TRIGGER ON public.rh_cargo_templates TO authenticated;
GRANT TRUNCATE ON public.rh_cargo_templates TO authenticated;
GRANT UPDATE ON public.rh_cargo_templates TO authenticated;
GRANT DELETE ON public.rh_cargo_templates TO service_role;
GRANT INSERT ON public.rh_cargo_templates TO service_role;
GRANT REFERENCES ON public.rh_cargo_templates TO service_role;
GRANT SELECT ON public.rh_cargo_templates TO service_role;
GRANT TRIGGER ON public.rh_cargo_templates TO service_role;
GRANT TRUNCATE ON public.rh_cargo_templates TO service_role;
GRANT UPDATE ON public.rh_cargo_templates TO service_role;
GRANT DELETE ON public.rh_checklists TO anon;
GRANT INSERT ON public.rh_checklists TO anon;
GRANT REFERENCES ON public.rh_checklists TO anon;
GRANT SELECT ON public.rh_checklists TO anon;
GRANT TRIGGER ON public.rh_checklists TO anon;
GRANT TRUNCATE ON public.rh_checklists TO anon;
GRANT UPDATE ON public.rh_checklists TO anon;
GRANT DELETE ON public.rh_checklists TO authenticated;
GRANT INSERT ON public.rh_checklists TO authenticated;
GRANT REFERENCES ON public.rh_checklists TO authenticated;
GRANT SELECT ON public.rh_checklists TO authenticated;
GRANT TRIGGER ON public.rh_checklists TO authenticated;
GRANT TRUNCATE ON public.rh_checklists TO authenticated;
GRANT UPDATE ON public.rh_checklists TO authenticated;
GRANT DELETE ON public.rh_checklists TO service_role;
GRANT INSERT ON public.rh_checklists TO service_role;
GRANT REFERENCES ON public.rh_checklists TO service_role;
GRANT SELECT ON public.rh_checklists TO service_role;
GRANT TRIGGER ON public.rh_checklists TO service_role;
GRANT TRUNCATE ON public.rh_checklists TO service_role;
GRANT UPDATE ON public.rh_checklists TO service_role;
GRANT DELETE ON public.rh_colaborador_beneficios TO anon;
GRANT INSERT ON public.rh_colaborador_beneficios TO anon;
GRANT REFERENCES ON public.rh_colaborador_beneficios TO anon;
GRANT SELECT ON public.rh_colaborador_beneficios TO anon;
GRANT TRIGGER ON public.rh_colaborador_beneficios TO anon;
GRANT TRUNCATE ON public.rh_colaborador_beneficios TO anon;
GRANT UPDATE ON public.rh_colaborador_beneficios TO anon;
GRANT DELETE ON public.rh_colaborador_beneficios TO authenticated;
GRANT INSERT ON public.rh_colaborador_beneficios TO authenticated;
GRANT REFERENCES ON public.rh_colaborador_beneficios TO authenticated;
GRANT SELECT ON public.rh_colaborador_beneficios TO authenticated;
GRANT TRIGGER ON public.rh_colaborador_beneficios TO authenticated;
GRANT TRUNCATE ON public.rh_colaborador_beneficios TO authenticated;
GRANT UPDATE ON public.rh_colaborador_beneficios TO authenticated;
GRANT DELETE ON public.rh_colaborador_beneficios TO service_role;
GRANT INSERT ON public.rh_colaborador_beneficios TO service_role;
GRANT REFERENCES ON public.rh_colaborador_beneficios TO service_role;
GRANT SELECT ON public.rh_colaborador_beneficios TO service_role;
GRANT TRIGGER ON public.rh_colaborador_beneficios TO service_role;
GRANT TRUNCATE ON public.rh_colaborador_beneficios TO service_role;
GRANT UPDATE ON public.rh_colaborador_beneficios TO service_role;
GRANT DELETE ON public.rh_colaboradores TO anon;
GRANT INSERT ON public.rh_colaboradores TO anon;
GRANT REFERENCES ON public.rh_colaboradores TO anon;
GRANT SELECT ON public.rh_colaboradores TO anon;
GRANT TRIGGER ON public.rh_colaboradores TO anon;
GRANT TRUNCATE ON public.rh_colaboradores TO anon;
GRANT UPDATE ON public.rh_colaboradores TO anon;
GRANT DELETE ON public.rh_colaboradores TO authenticated;
GRANT INSERT ON public.rh_colaboradores TO authenticated;
GRANT REFERENCES ON public.rh_colaboradores TO authenticated;
GRANT SELECT ON public.rh_colaboradores TO authenticated;
GRANT TRIGGER ON public.rh_colaboradores TO authenticated;
GRANT TRUNCATE ON public.rh_colaboradores TO authenticated;
GRANT UPDATE ON public.rh_colaboradores TO authenticated;
GRANT DELETE ON public.rh_colaboradores TO service_role;
GRANT INSERT ON public.rh_colaboradores TO service_role;
GRANT REFERENCES ON public.rh_colaboradores TO service_role;
GRANT SELECT ON public.rh_colaboradores TO service_role;
GRANT TRIGGER ON public.rh_colaboradores TO service_role;
GRANT TRUNCATE ON public.rh_colaboradores TO service_role;
GRANT UPDATE ON public.rh_colaboradores TO service_role;
GRANT DELETE ON public.rh_curriculo_upload_tokens TO anon;
GRANT INSERT ON public.rh_curriculo_upload_tokens TO anon;
GRANT REFERENCES ON public.rh_curriculo_upload_tokens TO anon;
GRANT SELECT ON public.rh_curriculo_upload_tokens TO anon;
GRANT TRIGGER ON public.rh_curriculo_upload_tokens TO anon;
GRANT TRUNCATE ON public.rh_curriculo_upload_tokens TO anon;
GRANT UPDATE ON public.rh_curriculo_upload_tokens TO anon;
GRANT DELETE ON public.rh_curriculo_upload_tokens TO authenticated;
GRANT INSERT ON public.rh_curriculo_upload_tokens TO authenticated;
GRANT REFERENCES ON public.rh_curriculo_upload_tokens TO authenticated;
GRANT SELECT ON public.rh_curriculo_upload_tokens TO authenticated;
GRANT TRIGGER ON public.rh_curriculo_upload_tokens TO authenticated;
GRANT TRUNCATE ON public.rh_curriculo_upload_tokens TO authenticated;
GRANT UPDATE ON public.rh_curriculo_upload_tokens TO authenticated;
GRANT DELETE ON public.rh_curriculo_upload_tokens TO service_role;
GRANT INSERT ON public.rh_curriculo_upload_tokens TO service_role;
GRANT REFERENCES ON public.rh_curriculo_upload_tokens TO service_role;
GRANT SELECT ON public.rh_curriculo_upload_tokens TO service_role;
GRANT TRIGGER ON public.rh_curriculo_upload_tokens TO service_role;
GRANT TRUNCATE ON public.rh_curriculo_upload_tokens TO service_role;
GRANT UPDATE ON public.rh_curriculo_upload_tokens TO service_role;
GRANT DELETE ON public.rh_data_update_requests TO anon;
GRANT INSERT ON public.rh_data_update_requests TO anon;
GRANT REFERENCES ON public.rh_data_update_requests TO anon;
GRANT SELECT ON public.rh_data_update_requests TO anon;
GRANT TRIGGER ON public.rh_data_update_requests TO anon;
GRANT TRUNCATE ON public.rh_data_update_requests TO anon;
GRANT UPDATE ON public.rh_data_update_requests TO anon;
GRANT DELETE ON public.rh_data_update_requests TO authenticated;
GRANT INSERT ON public.rh_data_update_requests TO authenticated;
GRANT REFERENCES ON public.rh_data_update_requests TO authenticated;
GRANT SELECT ON public.rh_data_update_requests TO authenticated;
GRANT TRIGGER ON public.rh_data_update_requests TO authenticated;
GRANT TRUNCATE ON public.rh_data_update_requests TO authenticated;
GRANT UPDATE ON public.rh_data_update_requests TO authenticated;
GRANT DELETE ON public.rh_data_update_requests TO service_role;
GRANT INSERT ON public.rh_data_update_requests TO service_role;
GRANT REFERENCES ON public.rh_data_update_requests TO service_role;
GRANT SELECT ON public.rh_data_update_requests TO service_role;
GRANT TRIGGER ON public.rh_data_update_requests TO service_role;
GRANT TRUNCATE ON public.rh_data_update_requests TO service_role;
GRANT UPDATE ON public.rh_data_update_requests TO service_role;
GRANT DELETE ON public.rh_ferias TO anon;
GRANT INSERT ON public.rh_ferias TO anon;
GRANT REFERENCES ON public.rh_ferias TO anon;
GRANT SELECT ON public.rh_ferias TO anon;
GRANT TRIGGER ON public.rh_ferias TO anon;
GRANT TRUNCATE ON public.rh_ferias TO anon;
GRANT UPDATE ON public.rh_ferias TO anon;
GRANT DELETE ON public.rh_ferias TO authenticated;
GRANT INSERT ON public.rh_ferias TO authenticated;
GRANT REFERENCES ON public.rh_ferias TO authenticated;
GRANT SELECT ON public.rh_ferias TO authenticated;
GRANT TRIGGER ON public.rh_ferias TO authenticated;
GRANT TRUNCATE ON public.rh_ferias TO authenticated;
GRANT UPDATE ON public.rh_ferias TO authenticated;
GRANT DELETE ON public.rh_ferias TO service_role;
GRANT INSERT ON public.rh_ferias TO service_role;
GRANT REFERENCES ON public.rh_ferias TO service_role;
GRANT SELECT ON public.rh_ferias TO service_role;
GRANT TRIGGER ON public.rh_ferias TO service_role;
GRANT TRUNCATE ON public.rh_ferias TO service_role;
GRANT UPDATE ON public.rh_ferias TO service_role;
GRANT DELETE ON public.rh_fornecedor_contrato_eventos TO anon;
GRANT INSERT ON public.rh_fornecedor_contrato_eventos TO anon;
GRANT REFERENCES ON public.rh_fornecedor_contrato_eventos TO anon;
GRANT SELECT ON public.rh_fornecedor_contrato_eventos TO anon;
GRANT TRIGGER ON public.rh_fornecedor_contrato_eventos TO anon;
GRANT TRUNCATE ON public.rh_fornecedor_contrato_eventos TO anon;
GRANT UPDATE ON public.rh_fornecedor_contrato_eventos TO anon;
GRANT DELETE ON public.rh_fornecedor_contrato_eventos TO authenticated;
GRANT INSERT ON public.rh_fornecedor_contrato_eventos TO authenticated;
GRANT REFERENCES ON public.rh_fornecedor_contrato_eventos TO authenticated;
GRANT SELECT ON public.rh_fornecedor_contrato_eventos TO authenticated;
GRANT TRIGGER ON public.rh_fornecedor_contrato_eventos TO authenticated;
GRANT TRUNCATE ON public.rh_fornecedor_contrato_eventos TO authenticated;
GRANT UPDATE ON public.rh_fornecedor_contrato_eventos TO authenticated;
GRANT DELETE ON public.rh_fornecedor_contrato_eventos TO service_role;
GRANT INSERT ON public.rh_fornecedor_contrato_eventos TO service_role;
GRANT REFERENCES ON public.rh_fornecedor_contrato_eventos TO service_role;
GRANT SELECT ON public.rh_fornecedor_contrato_eventos TO service_role;
GRANT TRIGGER ON public.rh_fornecedor_contrato_eventos TO service_role;
GRANT TRUNCATE ON public.rh_fornecedor_contrato_eventos TO service_role;
GRANT UPDATE ON public.rh_fornecedor_contrato_eventos TO service_role;
GRANT DELETE ON public.rh_fornecedor_contratos TO anon;
GRANT INSERT ON public.rh_fornecedor_contratos TO anon;
GRANT REFERENCES ON public.rh_fornecedor_contratos TO anon;
GRANT SELECT ON public.rh_fornecedor_contratos TO anon;
GRANT TRIGGER ON public.rh_fornecedor_contratos TO anon;
GRANT TRUNCATE ON public.rh_fornecedor_contratos TO anon;
GRANT UPDATE ON public.rh_fornecedor_contratos TO anon;
GRANT DELETE ON public.rh_fornecedor_contratos TO authenticated;
GRANT INSERT ON public.rh_fornecedor_contratos TO authenticated;
GRANT REFERENCES ON public.rh_fornecedor_contratos TO authenticated;
GRANT SELECT ON public.rh_fornecedor_contratos TO authenticated;
GRANT TRIGGER ON public.rh_fornecedor_contratos TO authenticated;
GRANT TRUNCATE ON public.rh_fornecedor_contratos TO authenticated;
GRANT UPDATE ON public.rh_fornecedor_contratos TO authenticated;
GRANT DELETE ON public.rh_fornecedor_contratos TO service_role;
GRANT INSERT ON public.rh_fornecedor_contratos TO service_role;
GRANT REFERENCES ON public.rh_fornecedor_contratos TO service_role;
GRANT SELECT ON public.rh_fornecedor_contratos TO service_role;
GRANT TRIGGER ON public.rh_fornecedor_contratos TO service_role;
GRANT TRUNCATE ON public.rh_fornecedor_contratos TO service_role;
GRANT UPDATE ON public.rh_fornecedor_contratos TO service_role;
GRANT DELETE ON public.rh_fornecedores TO anon;
GRANT INSERT ON public.rh_fornecedores TO anon;
GRANT REFERENCES ON public.rh_fornecedores TO anon;
GRANT SELECT ON public.rh_fornecedores TO anon;
GRANT TRIGGER ON public.rh_fornecedores TO anon;
GRANT TRUNCATE ON public.rh_fornecedores TO anon;
GRANT UPDATE ON public.rh_fornecedores TO anon;
GRANT DELETE ON public.rh_fornecedores TO authenticated;
GRANT INSERT ON public.rh_fornecedores TO authenticated;
GRANT REFERENCES ON public.rh_fornecedores TO authenticated;
GRANT SELECT ON public.rh_fornecedores TO authenticated;
GRANT TRIGGER ON public.rh_fornecedores TO authenticated;
GRANT TRUNCATE ON public.rh_fornecedores TO authenticated;
GRANT UPDATE ON public.rh_fornecedores TO authenticated;
GRANT DELETE ON public.rh_fornecedores TO service_role;
GRANT INSERT ON public.rh_fornecedores TO service_role;
GRANT REFERENCES ON public.rh_fornecedores TO service_role;
GRANT SELECT ON public.rh_fornecedores TO service_role;
GRANT TRIGGER ON public.rh_fornecedores TO service_role;
GRANT TRUNCATE ON public.rh_fornecedores TO service_role;
GRANT UPDATE ON public.rh_fornecedores TO service_role;
GRANT DELETE ON public.rh_movimentacoes TO anon;
GRANT INSERT ON public.rh_movimentacoes TO anon;
GRANT REFERENCES ON public.rh_movimentacoes TO anon;
GRANT SELECT ON public.rh_movimentacoes TO anon;
GRANT TRIGGER ON public.rh_movimentacoes TO anon;
GRANT TRUNCATE ON public.rh_movimentacoes TO anon;
GRANT UPDATE ON public.rh_movimentacoes TO anon;
GRANT DELETE ON public.rh_movimentacoes TO authenticated;
GRANT INSERT ON public.rh_movimentacoes TO authenticated;
GRANT REFERENCES ON public.rh_movimentacoes TO authenticated;
GRANT SELECT ON public.rh_movimentacoes TO authenticated;
GRANT TRIGGER ON public.rh_movimentacoes TO authenticated;
GRANT TRUNCATE ON public.rh_movimentacoes TO authenticated;
GRANT UPDATE ON public.rh_movimentacoes TO authenticated;
GRANT DELETE ON public.rh_movimentacoes TO service_role;
GRANT INSERT ON public.rh_movimentacoes TO service_role;
GRANT REFERENCES ON public.rh_movimentacoes TO service_role;
GRANT SELECT ON public.rh_movimentacoes TO service_role;
GRANT TRIGGER ON public.rh_movimentacoes TO service_role;
GRANT TRUNCATE ON public.rh_movimentacoes TO service_role;
GRANT UPDATE ON public.rh_movimentacoes TO service_role;
GRANT DELETE ON public.rh_onboarding_tarefas TO anon;
GRANT INSERT ON public.rh_onboarding_tarefas TO anon;
GRANT REFERENCES ON public.rh_onboarding_tarefas TO anon;
GRANT SELECT ON public.rh_onboarding_tarefas TO anon;
GRANT TRIGGER ON public.rh_onboarding_tarefas TO anon;
GRANT TRUNCATE ON public.rh_onboarding_tarefas TO anon;
GRANT UPDATE ON public.rh_onboarding_tarefas TO anon;
GRANT DELETE ON public.rh_onboarding_tarefas TO authenticated;
GRANT INSERT ON public.rh_onboarding_tarefas TO authenticated;
GRANT REFERENCES ON public.rh_onboarding_tarefas TO authenticated;
GRANT SELECT ON public.rh_onboarding_tarefas TO authenticated;
GRANT TRIGGER ON public.rh_onboarding_tarefas TO authenticated;
GRANT TRUNCATE ON public.rh_onboarding_tarefas TO authenticated;
GRANT UPDATE ON public.rh_onboarding_tarefas TO authenticated;
GRANT DELETE ON public.rh_onboarding_tarefas TO service_role;
GRANT INSERT ON public.rh_onboarding_tarefas TO service_role;
GRANT REFERENCES ON public.rh_onboarding_tarefas TO service_role;
GRANT SELECT ON public.rh_onboarding_tarefas TO service_role;
GRANT TRIGGER ON public.rh_onboarding_tarefas TO service_role;
GRANT TRUNCATE ON public.rh_onboarding_tarefas TO service_role;
GRANT UPDATE ON public.rh_onboarding_tarefas TO service_role;
GRANT DELETE ON public.rh_onboarding_templates TO anon;
GRANT INSERT ON public.rh_onboarding_templates TO anon;
GRANT REFERENCES ON public.rh_onboarding_templates TO anon;
GRANT SELECT ON public.rh_onboarding_templates TO anon;
GRANT TRIGGER ON public.rh_onboarding_templates TO anon;
GRANT TRUNCATE ON public.rh_onboarding_templates TO anon;
GRANT UPDATE ON public.rh_onboarding_templates TO anon;
GRANT DELETE ON public.rh_onboarding_templates TO authenticated;
GRANT INSERT ON public.rh_onboarding_templates TO authenticated;
GRANT REFERENCES ON public.rh_onboarding_templates TO authenticated;
GRANT SELECT ON public.rh_onboarding_templates TO authenticated;
GRANT TRIGGER ON public.rh_onboarding_templates TO authenticated;
GRANT TRUNCATE ON public.rh_onboarding_templates TO authenticated;
GRANT UPDATE ON public.rh_onboarding_templates TO authenticated;
GRANT DELETE ON public.rh_onboarding_templates TO service_role;
GRANT INSERT ON public.rh_onboarding_templates TO service_role;
GRANT REFERENCES ON public.rh_onboarding_templates TO service_role;
GRANT SELECT ON public.rh_onboarding_templates TO service_role;
GRANT TRIGGER ON public.rh_onboarding_templates TO service_role;
GRANT TRUNCATE ON public.rh_onboarding_templates TO service_role;
GRANT UPDATE ON public.rh_onboarding_templates TO service_role;
GRANT DELETE ON public.rh_pesquisa_respostas TO anon;
GRANT INSERT ON public.rh_pesquisa_respostas TO anon;
GRANT REFERENCES ON public.rh_pesquisa_respostas TO anon;
GRANT SELECT ON public.rh_pesquisa_respostas TO anon;
GRANT TRIGGER ON public.rh_pesquisa_respostas TO anon;
GRANT TRUNCATE ON public.rh_pesquisa_respostas TO anon;
GRANT UPDATE ON public.rh_pesquisa_respostas TO anon;
GRANT DELETE ON public.rh_pesquisa_respostas TO authenticated;
GRANT INSERT ON public.rh_pesquisa_respostas TO authenticated;
GRANT REFERENCES ON public.rh_pesquisa_respostas TO authenticated;
GRANT SELECT ON public.rh_pesquisa_respostas TO authenticated;
GRANT TRIGGER ON public.rh_pesquisa_respostas TO authenticated;
GRANT TRUNCATE ON public.rh_pesquisa_respostas TO authenticated;
GRANT UPDATE ON public.rh_pesquisa_respostas TO authenticated;
GRANT DELETE ON public.rh_pesquisa_respostas TO service_role;
GRANT INSERT ON public.rh_pesquisa_respostas TO service_role;
GRANT REFERENCES ON public.rh_pesquisa_respostas TO service_role;
GRANT SELECT ON public.rh_pesquisa_respostas TO service_role;
GRANT TRIGGER ON public.rh_pesquisa_respostas TO service_role;
GRANT TRUNCATE ON public.rh_pesquisa_respostas TO service_role;
GRANT UPDATE ON public.rh_pesquisa_respostas TO service_role;
GRANT DELETE ON public.rh_pesquisas TO anon;
GRANT INSERT ON public.rh_pesquisas TO anon;
GRANT REFERENCES ON public.rh_pesquisas TO anon;
GRANT SELECT ON public.rh_pesquisas TO anon;
GRANT TRIGGER ON public.rh_pesquisas TO anon;
GRANT TRUNCATE ON public.rh_pesquisas TO anon;
GRANT UPDATE ON public.rh_pesquisas TO anon;
GRANT DELETE ON public.rh_pesquisas TO authenticated;
GRANT INSERT ON public.rh_pesquisas TO authenticated;
GRANT REFERENCES ON public.rh_pesquisas TO authenticated;
GRANT SELECT ON public.rh_pesquisas TO authenticated;
GRANT TRIGGER ON public.rh_pesquisas TO authenticated;
GRANT TRUNCATE ON public.rh_pesquisas TO authenticated;
GRANT UPDATE ON public.rh_pesquisas TO authenticated;
GRANT DELETE ON public.rh_pesquisas TO service_role;
GRANT INSERT ON public.rh_pesquisas TO service_role;
GRANT REFERENCES ON public.rh_pesquisas TO service_role;
GRANT SELECT ON public.rh_pesquisas TO service_role;
GRANT TRIGGER ON public.rh_pesquisas TO service_role;
GRANT TRUNCATE ON public.rh_pesquisas TO service_role;
GRANT UPDATE ON public.rh_pesquisas TO service_role;
GRANT DELETE ON public.rh_pipeline_stage_fields TO anon;
GRANT INSERT ON public.rh_pipeline_stage_fields TO anon;
GRANT REFERENCES ON public.rh_pipeline_stage_fields TO anon;
GRANT SELECT ON public.rh_pipeline_stage_fields TO anon;
GRANT TRIGGER ON public.rh_pipeline_stage_fields TO anon;
GRANT TRUNCATE ON public.rh_pipeline_stage_fields TO anon;
GRANT UPDATE ON public.rh_pipeline_stage_fields TO anon;
GRANT DELETE ON public.rh_pipeline_stage_fields TO authenticated;
GRANT INSERT ON public.rh_pipeline_stage_fields TO authenticated;
GRANT REFERENCES ON public.rh_pipeline_stage_fields TO authenticated;
GRANT SELECT ON public.rh_pipeline_stage_fields TO authenticated;
GRANT TRIGGER ON public.rh_pipeline_stage_fields TO authenticated;
GRANT TRUNCATE ON public.rh_pipeline_stage_fields TO authenticated;
GRANT UPDATE ON public.rh_pipeline_stage_fields TO authenticated;
GRANT DELETE ON public.rh_pipeline_stage_fields TO service_role;
GRANT INSERT ON public.rh_pipeline_stage_fields TO service_role;
GRANT REFERENCES ON public.rh_pipeline_stage_fields TO service_role;
GRANT SELECT ON public.rh_pipeline_stage_fields TO service_role;
GRANT TRIGGER ON public.rh_pipeline_stage_fields TO service_role;
GRANT TRUNCATE ON public.rh_pipeline_stage_fields TO service_role;
GRANT UPDATE ON public.rh_pipeline_stage_fields TO service_role;
GRANT DELETE ON public.rh_pipeline_stages TO anon;
GRANT INSERT ON public.rh_pipeline_stages TO anon;
GRANT REFERENCES ON public.rh_pipeline_stages TO anon;
GRANT SELECT ON public.rh_pipeline_stages TO anon;
GRANT TRIGGER ON public.rh_pipeline_stages TO anon;
GRANT TRUNCATE ON public.rh_pipeline_stages TO anon;
GRANT UPDATE ON public.rh_pipeline_stages TO anon;
GRANT DELETE ON public.rh_pipeline_stages TO authenticated;
GRANT INSERT ON public.rh_pipeline_stages TO authenticated;
GRANT REFERENCES ON public.rh_pipeline_stages TO authenticated;
GRANT SELECT ON public.rh_pipeline_stages TO authenticated;
GRANT TRIGGER ON public.rh_pipeline_stages TO authenticated;
GRANT TRUNCATE ON public.rh_pipeline_stages TO authenticated;
GRANT UPDATE ON public.rh_pipeline_stages TO authenticated;
GRANT DELETE ON public.rh_pipeline_stages TO service_role;
GRANT INSERT ON public.rh_pipeline_stages TO service_role;
GRANT REFERENCES ON public.rh_pipeline_stages TO service_role;
GRANT SELECT ON public.rh_pipeline_stages TO service_role;
GRANT TRIGGER ON public.rh_pipeline_stages TO service_role;
GRANT TRUNCATE ON public.rh_pipeline_stages TO service_role;
GRANT UPDATE ON public.rh_pipeline_stages TO service_role;
GRANT DELETE ON public.rh_report_presets TO anon;
GRANT INSERT ON public.rh_report_presets TO anon;
GRANT REFERENCES ON public.rh_report_presets TO anon;
GRANT SELECT ON public.rh_report_presets TO anon;
GRANT TRIGGER ON public.rh_report_presets TO anon;
GRANT TRUNCATE ON public.rh_report_presets TO anon;
GRANT UPDATE ON public.rh_report_presets TO anon;
GRANT DELETE ON public.rh_report_presets TO authenticated;
GRANT INSERT ON public.rh_report_presets TO authenticated;
GRANT REFERENCES ON public.rh_report_presets TO authenticated;
GRANT SELECT ON public.rh_report_presets TO authenticated;
GRANT TRIGGER ON public.rh_report_presets TO authenticated;
GRANT TRUNCATE ON public.rh_report_presets TO authenticated;
GRANT UPDATE ON public.rh_report_presets TO authenticated;
GRANT DELETE ON public.rh_report_presets TO service_role;
GRANT INSERT ON public.rh_report_presets TO service_role;
GRANT REFERENCES ON public.rh_report_presets TO service_role;
GRANT SELECT ON public.rh_report_presets TO service_role;
GRANT TRIGGER ON public.rh_report_presets TO service_role;
GRANT TRUNCATE ON public.rh_report_presets TO service_role;
GRANT UPDATE ON public.rh_report_presets TO service_role;
GRANT DELETE ON public.rh_signature_requests TO anon;
GRANT INSERT ON public.rh_signature_requests TO anon;
GRANT REFERENCES ON public.rh_signature_requests TO anon;
GRANT SELECT ON public.rh_signature_requests TO anon;
GRANT TRIGGER ON public.rh_signature_requests TO anon;
GRANT TRUNCATE ON public.rh_signature_requests TO anon;
GRANT UPDATE ON public.rh_signature_requests TO anon;
GRANT DELETE ON public.rh_signature_requests TO authenticated;
GRANT INSERT ON public.rh_signature_requests TO authenticated;
GRANT REFERENCES ON public.rh_signature_requests TO authenticated;
GRANT SELECT ON public.rh_signature_requests TO authenticated;
GRANT TRIGGER ON public.rh_signature_requests TO authenticated;
GRANT TRUNCATE ON public.rh_signature_requests TO authenticated;
GRANT UPDATE ON public.rh_signature_requests TO authenticated;
GRANT DELETE ON public.rh_signature_requests TO service_role;
GRANT INSERT ON public.rh_signature_requests TO service_role;
GRANT REFERENCES ON public.rh_signature_requests TO service_role;
GRANT SELECT ON public.rh_signature_requests TO service_role;
GRANT TRIGGER ON public.rh_signature_requests TO service_role;
GRANT TRUNCATE ON public.rh_signature_requests TO service_role;
GRANT UPDATE ON public.rh_signature_requests TO service_role;
GRANT DELETE ON public.rh_stage_history TO anon;
GRANT INSERT ON public.rh_stage_history TO anon;
GRANT REFERENCES ON public.rh_stage_history TO anon;
GRANT SELECT ON public.rh_stage_history TO anon;
GRANT TRIGGER ON public.rh_stage_history TO anon;
GRANT TRUNCATE ON public.rh_stage_history TO anon;
GRANT UPDATE ON public.rh_stage_history TO anon;
GRANT DELETE ON public.rh_stage_history TO authenticated;
GRANT INSERT ON public.rh_stage_history TO authenticated;
GRANT REFERENCES ON public.rh_stage_history TO authenticated;
GRANT SELECT ON public.rh_stage_history TO authenticated;
GRANT TRIGGER ON public.rh_stage_history TO authenticated;
GRANT TRUNCATE ON public.rh_stage_history TO authenticated;
GRANT UPDATE ON public.rh_stage_history TO authenticated;
GRANT DELETE ON public.rh_stage_history TO service_role;
GRANT INSERT ON public.rh_stage_history TO service_role;
GRANT REFERENCES ON public.rh_stage_history TO service_role;
GRANT SELECT ON public.rh_stage_history TO service_role;
GRANT TRIGGER ON public.rh_stage_history TO service_role;
GRANT TRUNCATE ON public.rh_stage_history TO service_role;
GRANT UPDATE ON public.rh_stage_history TO service_role;
GRANT DELETE ON public.rh_treinamento_atribuicoes TO anon;
GRANT INSERT ON public.rh_treinamento_atribuicoes TO anon;
GRANT REFERENCES ON public.rh_treinamento_atribuicoes TO anon;
GRANT SELECT ON public.rh_treinamento_atribuicoes TO anon;
GRANT TRIGGER ON public.rh_treinamento_atribuicoes TO anon;
GRANT TRUNCATE ON public.rh_treinamento_atribuicoes TO anon;
GRANT UPDATE ON public.rh_treinamento_atribuicoes TO anon;
GRANT DELETE ON public.rh_treinamento_atribuicoes TO authenticated;
GRANT INSERT ON public.rh_treinamento_atribuicoes TO authenticated;
GRANT REFERENCES ON public.rh_treinamento_atribuicoes TO authenticated;
GRANT SELECT ON public.rh_treinamento_atribuicoes TO authenticated;
GRANT TRIGGER ON public.rh_treinamento_atribuicoes TO authenticated;
GRANT TRUNCATE ON public.rh_treinamento_atribuicoes TO authenticated;
GRANT UPDATE ON public.rh_treinamento_atribuicoes TO authenticated;
GRANT DELETE ON public.rh_treinamento_atribuicoes TO service_role;
GRANT INSERT ON public.rh_treinamento_atribuicoes TO service_role;
GRANT REFERENCES ON public.rh_treinamento_atribuicoes TO service_role;
GRANT SELECT ON public.rh_treinamento_atribuicoes TO service_role;
GRANT TRIGGER ON public.rh_treinamento_atribuicoes TO service_role;
GRANT TRUNCATE ON public.rh_treinamento_atribuicoes TO service_role;
GRANT UPDATE ON public.rh_treinamento_atribuicoes TO service_role;
GRANT DELETE ON public.rh_treinamentos TO anon;
GRANT INSERT ON public.rh_treinamentos TO anon;
GRANT REFERENCES ON public.rh_treinamentos TO anon;
GRANT SELECT ON public.rh_treinamentos TO anon;
GRANT TRIGGER ON public.rh_treinamentos TO anon;
GRANT TRUNCATE ON public.rh_treinamentos TO anon;
GRANT UPDATE ON public.rh_treinamentos TO anon;
GRANT DELETE ON public.rh_treinamentos TO authenticated;
GRANT INSERT ON public.rh_treinamentos TO authenticated;
GRANT REFERENCES ON public.rh_treinamentos TO authenticated;
GRANT SELECT ON public.rh_treinamentos TO authenticated;
GRANT TRIGGER ON public.rh_treinamentos TO authenticated;
GRANT TRUNCATE ON public.rh_treinamentos TO authenticated;
GRANT UPDATE ON public.rh_treinamentos TO authenticated;
GRANT DELETE ON public.rh_treinamentos TO service_role;
GRANT INSERT ON public.rh_treinamentos TO service_role;
GRANT REFERENCES ON public.rh_treinamentos TO service_role;
GRANT SELECT ON public.rh_treinamentos TO service_role;
GRANT TRIGGER ON public.rh_treinamentos TO service_role;
GRANT TRUNCATE ON public.rh_treinamentos TO service_role;
GRANT UPDATE ON public.rh_treinamentos TO service_role;
GRANT DELETE ON public.rh_vaga_manager_links TO anon;
GRANT INSERT ON public.rh_vaga_manager_links TO anon;
GRANT REFERENCES ON public.rh_vaga_manager_links TO anon;
GRANT SELECT ON public.rh_vaga_manager_links TO anon;
GRANT TRIGGER ON public.rh_vaga_manager_links TO anon;
GRANT TRUNCATE ON public.rh_vaga_manager_links TO anon;
GRANT UPDATE ON public.rh_vaga_manager_links TO anon;
GRANT DELETE ON public.rh_vaga_manager_links TO authenticated;
GRANT INSERT ON public.rh_vaga_manager_links TO authenticated;
GRANT REFERENCES ON public.rh_vaga_manager_links TO authenticated;
GRANT SELECT ON public.rh_vaga_manager_links TO authenticated;
GRANT TRIGGER ON public.rh_vaga_manager_links TO authenticated;
GRANT TRUNCATE ON public.rh_vaga_manager_links TO authenticated;
GRANT UPDATE ON public.rh_vaga_manager_links TO authenticated;
GRANT DELETE ON public.rh_vaga_manager_links TO service_role;
GRANT INSERT ON public.rh_vaga_manager_links TO service_role;
GRANT REFERENCES ON public.rh_vaga_manager_links TO service_role;
GRANT SELECT ON public.rh_vaga_manager_links TO service_role;
GRANT TRIGGER ON public.rh_vaga_manager_links TO service_role;
GRANT TRUNCATE ON public.rh_vaga_manager_links TO service_role;
GRANT UPDATE ON public.rh_vaga_manager_links TO service_role;
GRANT DELETE ON public.rh_vagas TO anon;
GRANT INSERT ON public.rh_vagas TO anon;
GRANT REFERENCES ON public.rh_vagas TO anon;
GRANT SELECT ON public.rh_vagas TO anon;
GRANT TRIGGER ON public.rh_vagas TO anon;
GRANT TRUNCATE ON public.rh_vagas TO anon;
GRANT UPDATE ON public.rh_vagas TO anon;
GRANT DELETE ON public.rh_vagas TO authenticated;
GRANT INSERT ON public.rh_vagas TO authenticated;
GRANT REFERENCES ON public.rh_vagas TO authenticated;
GRANT SELECT ON public.rh_vagas TO authenticated;
GRANT TRIGGER ON public.rh_vagas TO authenticated;
GRANT TRUNCATE ON public.rh_vagas TO authenticated;
GRANT UPDATE ON public.rh_vagas TO authenticated;
GRANT DELETE ON public.rh_vagas TO service_role;
GRANT INSERT ON public.rh_vagas TO service_role;
GRANT REFERENCES ON public.rh_vagas TO service_role;
GRANT SELECT ON public.rh_vagas TO service_role;
GRANT TRIGGER ON public.rh_vagas TO service_role;
GRANT TRUNCATE ON public.rh_vagas TO service_role;
GRANT UPDATE ON public.rh_vagas TO service_role;
GRANT DELETE ON public.sales_cases TO anon;
GRANT INSERT ON public.sales_cases TO anon;
GRANT REFERENCES ON public.sales_cases TO anon;
GRANT SELECT ON public.sales_cases TO anon;
GRANT TRIGGER ON public.sales_cases TO anon;
GRANT TRUNCATE ON public.sales_cases TO anon;
GRANT UPDATE ON public.sales_cases TO anon;
GRANT DELETE ON public.sales_cases TO authenticated;
GRANT INSERT ON public.sales_cases TO authenticated;
GRANT REFERENCES ON public.sales_cases TO authenticated;
GRANT SELECT ON public.sales_cases TO authenticated;
GRANT TRIGGER ON public.sales_cases TO authenticated;
GRANT TRUNCATE ON public.sales_cases TO authenticated;
GRANT UPDATE ON public.sales_cases TO authenticated;
GRANT DELETE ON public.sales_cases TO service_role;
GRANT INSERT ON public.sales_cases TO service_role;
GRANT REFERENCES ON public.sales_cases TO service_role;
GRANT SELECT ON public.sales_cases TO service_role;
GRANT TRIGGER ON public.sales_cases TO service_role;
GRANT TRUNCATE ON public.sales_cases TO service_role;
GRANT UPDATE ON public.sales_cases TO service_role;
GRANT DELETE ON public.terms_acceptances TO anon;
GRANT INSERT ON public.terms_acceptances TO anon;
GRANT REFERENCES ON public.terms_acceptances TO anon;
GRANT SELECT ON public.terms_acceptances TO anon;
GRANT TRIGGER ON public.terms_acceptances TO anon;
GRANT TRUNCATE ON public.terms_acceptances TO anon;
GRANT UPDATE ON public.terms_acceptances TO anon;
GRANT DELETE ON public.terms_acceptances TO authenticated;
GRANT INSERT ON public.terms_acceptances TO authenticated;
GRANT REFERENCES ON public.terms_acceptances TO authenticated;
GRANT SELECT ON public.terms_acceptances TO authenticated;
GRANT TRIGGER ON public.terms_acceptances TO authenticated;
GRANT TRUNCATE ON public.terms_acceptances TO authenticated;
GRANT UPDATE ON public.terms_acceptances TO authenticated;
GRANT DELETE ON public.terms_acceptances TO service_role;
GRANT INSERT ON public.terms_acceptances TO service_role;
GRANT REFERENCES ON public.terms_acceptances TO service_role;
GRANT SELECT ON public.terms_acceptances TO service_role;
GRANT TRIGGER ON public.terms_acceptances TO service_role;
GRANT TRUNCATE ON public.terms_acceptances TO service_role;
GRANT UPDATE ON public.terms_acceptances TO service_role;
GRANT DELETE ON public.uniform_items TO anon;
GRANT INSERT ON public.uniform_items TO anon;
GRANT REFERENCES ON public.uniform_items TO anon;
GRANT SELECT ON public.uniform_items TO anon;
GRANT TRIGGER ON public.uniform_items TO anon;
GRANT TRUNCATE ON public.uniform_items TO anon;
GRANT UPDATE ON public.uniform_items TO anon;
GRANT DELETE ON public.uniform_items TO authenticated;
GRANT INSERT ON public.uniform_items TO authenticated;
GRANT REFERENCES ON public.uniform_items TO authenticated;
GRANT SELECT ON public.uniform_items TO authenticated;
GRANT TRIGGER ON public.uniform_items TO authenticated;
GRANT TRUNCATE ON public.uniform_items TO authenticated;
GRANT UPDATE ON public.uniform_items TO authenticated;
GRANT DELETE ON public.uniform_items TO service_role;
GRANT INSERT ON public.uniform_items TO service_role;
GRANT REFERENCES ON public.uniform_items TO service_role;
GRANT SELECT ON public.uniform_items TO service_role;
GRANT TRIGGER ON public.uniform_items TO service_role;
GRANT TRUNCATE ON public.uniform_items TO service_role;
GRANT UPDATE ON public.uniform_items TO service_role;
GRANT DELETE ON public.uniform_people TO anon;
GRANT INSERT ON public.uniform_people TO anon;
GRANT REFERENCES ON public.uniform_people TO anon;
GRANT SELECT ON public.uniform_people TO anon;
GRANT TRIGGER ON public.uniform_people TO anon;
GRANT TRUNCATE ON public.uniform_people TO anon;
GRANT UPDATE ON public.uniform_people TO anon;
GRANT DELETE ON public.uniform_people TO authenticated;
GRANT INSERT ON public.uniform_people TO authenticated;
GRANT REFERENCES ON public.uniform_people TO authenticated;
GRANT SELECT ON public.uniform_people TO authenticated;
GRANT TRIGGER ON public.uniform_people TO authenticated;
GRANT TRUNCATE ON public.uniform_people TO authenticated;
GRANT UPDATE ON public.uniform_people TO authenticated;
GRANT DELETE ON public.uniform_people TO service_role;
GRANT INSERT ON public.uniform_people TO service_role;
GRANT REFERENCES ON public.uniform_people TO service_role;
GRANT SELECT ON public.uniform_people TO service_role;
GRANT TRIGGER ON public.uniform_people TO service_role;
GRANT TRUNCATE ON public.uniform_people TO service_role;
GRANT UPDATE ON public.uniform_people TO service_role;
GRANT DELETE ON public.uniform_person_sizes TO anon;
GRANT INSERT ON public.uniform_person_sizes TO anon;
GRANT REFERENCES ON public.uniform_person_sizes TO anon;
GRANT SELECT ON public.uniform_person_sizes TO anon;
GRANT TRIGGER ON public.uniform_person_sizes TO anon;
GRANT TRUNCATE ON public.uniform_person_sizes TO anon;
GRANT UPDATE ON public.uniform_person_sizes TO anon;
GRANT DELETE ON public.uniform_person_sizes TO authenticated;
GRANT INSERT ON public.uniform_person_sizes TO authenticated;
GRANT REFERENCES ON public.uniform_person_sizes TO authenticated;
GRANT SELECT ON public.uniform_person_sizes TO authenticated;
GRANT TRIGGER ON public.uniform_person_sizes TO authenticated;
GRANT TRUNCATE ON public.uniform_person_sizes TO authenticated;
GRANT UPDATE ON public.uniform_person_sizes TO authenticated;
GRANT DELETE ON public.uniform_person_sizes TO service_role;
GRANT INSERT ON public.uniform_person_sizes TO service_role;
GRANT REFERENCES ON public.uniform_person_sizes TO service_role;
GRANT SELECT ON public.uniform_person_sizes TO service_role;
GRANT TRIGGER ON public.uniform_person_sizes TO service_role;
GRANT TRUNCATE ON public.uniform_person_sizes TO service_role;
GRANT UPDATE ON public.uniform_person_sizes TO service_role;
GRANT DELETE ON public.uniform_round_lines TO anon;
GRANT INSERT ON public.uniform_round_lines TO anon;
GRANT REFERENCES ON public.uniform_round_lines TO anon;
GRANT SELECT ON public.uniform_round_lines TO anon;
GRANT TRIGGER ON public.uniform_round_lines TO anon;
GRANT TRUNCATE ON public.uniform_round_lines TO anon;
GRANT UPDATE ON public.uniform_round_lines TO anon;
GRANT DELETE ON public.uniform_round_lines TO authenticated;
GRANT INSERT ON public.uniform_round_lines TO authenticated;
GRANT REFERENCES ON public.uniform_round_lines TO authenticated;
GRANT SELECT ON public.uniform_round_lines TO authenticated;
GRANT TRIGGER ON public.uniform_round_lines TO authenticated;
GRANT TRUNCATE ON public.uniform_round_lines TO authenticated;
GRANT UPDATE ON public.uniform_round_lines TO authenticated;
GRANT DELETE ON public.uniform_round_lines TO service_role;
GRANT INSERT ON public.uniform_round_lines TO service_role;
GRANT REFERENCES ON public.uniform_round_lines TO service_role;
GRANT SELECT ON public.uniform_round_lines TO service_role;
GRANT TRIGGER ON public.uniform_round_lines TO service_role;
GRANT TRUNCATE ON public.uniform_round_lines TO service_role;
GRANT UPDATE ON public.uniform_round_lines TO service_role;
GRANT DELETE ON public.uniform_rounds TO anon;
GRANT INSERT ON public.uniform_rounds TO anon;
GRANT REFERENCES ON public.uniform_rounds TO anon;
GRANT SELECT ON public.uniform_rounds TO anon;
GRANT TRIGGER ON public.uniform_rounds TO anon;
GRANT TRUNCATE ON public.uniform_rounds TO anon;
GRANT UPDATE ON public.uniform_rounds TO anon;
GRANT DELETE ON public.uniform_rounds TO authenticated;
GRANT INSERT ON public.uniform_rounds TO authenticated;
GRANT REFERENCES ON public.uniform_rounds TO authenticated;
GRANT SELECT ON public.uniform_rounds TO authenticated;
GRANT TRIGGER ON public.uniform_rounds TO authenticated;
GRANT TRUNCATE ON public.uniform_rounds TO authenticated;
GRANT UPDATE ON public.uniform_rounds TO authenticated;
GRANT DELETE ON public.uniform_rounds TO service_role;
GRANT INSERT ON public.uniform_rounds TO service_role;
GRANT REFERENCES ON public.uniform_rounds TO service_role;
GRANT SELECT ON public.uniform_rounds TO service_role;
GRANT TRIGGER ON public.uniform_rounds TO service_role;
GRANT TRUNCATE ON public.uniform_rounds TO service_role;
GRANT UPDATE ON public.uniform_rounds TO service_role;
GRANT DELETE ON public.whatsapp_conversations TO anon;
GRANT INSERT ON public.whatsapp_conversations TO anon;
GRANT REFERENCES ON public.whatsapp_conversations TO anon;
GRANT SELECT ON public.whatsapp_conversations TO anon;
GRANT TRIGGER ON public.whatsapp_conversations TO anon;
GRANT TRUNCATE ON public.whatsapp_conversations TO anon;
GRANT UPDATE ON public.whatsapp_conversations TO anon;
GRANT DELETE ON public.whatsapp_conversations TO authenticated;
GRANT INSERT ON public.whatsapp_conversations TO authenticated;
GRANT REFERENCES ON public.whatsapp_conversations TO authenticated;
GRANT SELECT ON public.whatsapp_conversations TO authenticated;
GRANT TRIGGER ON public.whatsapp_conversations TO authenticated;
GRANT TRUNCATE ON public.whatsapp_conversations TO authenticated;
GRANT UPDATE ON public.whatsapp_conversations TO authenticated;
GRANT DELETE ON public.whatsapp_conversations TO service_role;
GRANT INSERT ON public.whatsapp_conversations TO service_role;
GRANT REFERENCES ON public.whatsapp_conversations TO service_role;
GRANT SELECT ON public.whatsapp_conversations TO service_role;
GRANT TRIGGER ON public.whatsapp_conversations TO service_role;
GRANT TRUNCATE ON public.whatsapp_conversations TO service_role;
GRANT UPDATE ON public.whatsapp_conversations TO service_role;
GRANT DELETE ON public.whatsapp_messages TO anon;
GRANT INSERT ON public.whatsapp_messages TO anon;
GRANT REFERENCES ON public.whatsapp_messages TO anon;
GRANT SELECT ON public.whatsapp_messages TO anon;
GRANT TRIGGER ON public.whatsapp_messages TO anon;
GRANT TRUNCATE ON public.whatsapp_messages TO anon;
GRANT UPDATE ON public.whatsapp_messages TO anon;
GRANT DELETE ON public.whatsapp_messages TO authenticated;
GRANT INSERT ON public.whatsapp_messages TO authenticated;
GRANT REFERENCES ON public.whatsapp_messages TO authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT TRIGGER ON public.whatsapp_messages TO authenticated;
GRANT TRUNCATE ON public.whatsapp_messages TO authenticated;
GRANT UPDATE ON public.whatsapp_messages TO authenticated;
GRANT DELETE ON public.whatsapp_messages TO service_role;
GRANT INSERT ON public.whatsapp_messages TO service_role;
GRANT REFERENCES ON public.whatsapp_messages TO service_role;
GRANT SELECT ON public.whatsapp_messages TO service_role;
GRANT TRIGGER ON public.whatsapp_messages TO service_role;
GRANT TRUNCATE ON public.whatsapp_messages TO service_role;
GRANT UPDATE ON public.whatsapp_messages TO service_role;

-- ============ GRANTS DE FUNCAO ============
REVOKE ALL ON FUNCTION public.agencia_sees_supplier(p_supplier_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agencia_sees_supplier(p_supplier_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.agencia_sees_supplier(p_supplier_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agencia_sees_supplier(p_supplier_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.agencia_sees_supplier(p_supplier_id uuid) TO anon;
REVOKE ALL ON FUNCTION public.ai_org_quota_increment(p_user_id uuid, p_daily_limit integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_org_quota_increment(p_user_id uuid, p_daily_limit integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.ai_org_quota_increment(p_user_id uuid, p_daily_limit integer) TO service_role;
REVOKE ALL ON FUNCTION public.allocate_marketing_protocol_number(p_source text, p_record_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_marketing_protocol_number(p_source text, p_record_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.allocate_marketing_protocol_number(p_source text, p_record_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.apply_event_checklist_template(p_campaign_id uuid, p_company_ids text[], p_owner_ids uuid[], p_segments jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_event_checklist_template(p_campaign_id uuid, p_company_ids text[], p_owner_ids uuid[], p_segments jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.apply_event_checklist_template(p_campaign_id uuid, p_company_ids text[], p_owner_ids uuid[], p_segments jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.apply_event_checklist_template(p_campaign_id uuid, p_company_ids text[], p_owner_ids uuid[], p_segments jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_event_checklist_template(p_campaign_id uuid, p_company_ids text[], p_owner_ids uuid[], p_segments jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.approve_marketing_quote(p_quote_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_marketing_quote(p_quote_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_marketing_quote(p_quote_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_marketing_quote(p_quote_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.approve_marketing_request(p_request_id uuid, p_notes text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request(p_request_id uuid, p_notes text) TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request(p_request_id uuid, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request(p_request_id uuid, p_notes text) TO service_role;
REVOKE ALL ON FUNCTION public.approve_marketing_request_as_purchase(p_request_id uuid, p_notes text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request_as_purchase(p_request_id uuid, p_notes text) TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request_as_purchase(p_request_id uuid, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request_as_purchase(p_request_id uuid, p_notes text) TO service_role;
REVOKE ALL ON FUNCTION public.approve_marketing_request_as_task(p_request_id uuid, p_notes text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request_as_task(p_request_id uuid, p_notes text) TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request_as_task(p_request_id uuid, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_marketing_request_as_task(p_request_id uuid, p_notes text) TO service_role;
REVOKE ALL ON FUNCTION public.approve_purchase_request(p_id uuid, p_responsible_id uuid, p_supplier_id uuid, p_total_value numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_purchase_request(p_id uuid, p_responsible_id uuid, p_supplier_id uuid, p_total_value numeric) TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_purchase_request(p_id uuid, p_responsible_id uuid, p_supplier_id uuid, p_total_value numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_purchase_request(p_id uuid, p_responsible_id uuid, p_supplier_id uuid, p_total_value numeric) TO service_role;
REVOKE ALL ON FUNCTION public.approve_rh_data_update_request(p_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_rh_data_update_request(p_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_rh_data_update_request(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_rh_data_update_request(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.approve_rh_movimentacao(p_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_rh_movimentacao(p_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_rh_movimentacao(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_rh_movimentacao(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.broadcast_announcement(p_title text, p_body text, p_scope_type text, p_scope_value text, p_link jsonb, p_importante boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_announcement(p_title text, p_body text, p_scope_type text, p_scope_value text, p_link jsonb, p_importante boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.broadcast_announcement(p_title text, p_body text, p_scope_type text, p_scope_value text, p_link jsonb, p_importante boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_announcement(p_title text, p_body text, p_scope_type text, p_scope_value text, p_link jsonb, p_importante boolean) TO service_role;
REVOKE ALL ON FUNCTION public.chat_add_member(p_channel_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_add_member(p_channel_id uuid, p_user_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_add_member(p_channel_id uuid, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_add_member(p_channel_id uuid, p_user_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_can_dm(p_target uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_can_dm(p_target uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_can_dm(p_target uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_dm(p_target uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_can_manage(p_channel uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_can_manage(p_channel uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_can_manage(p_channel uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_manage(p_channel uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_can_post(p_channel uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_can_post(p_channel uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_can_post(p_channel uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_post(p_channel uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_channel_members_guard_self_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_channel_members_guard_self_update() TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_channel_members_guard_self_update() TO service_role;
REVOKE ALL ON FUNCTION public.chat_channel_roster(p_channel_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_channel_roster(p_channel_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_channel_roster(p_channel_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_channel_roster(p_channel_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_count_profiles_matching_filter(p_filter jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_count_profiles_matching_filter(p_filter jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_count_profiles_matching_filter(p_filter jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_count_profiles_matching_filter(p_filter jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.chat_create_channel(p_name text, p_icon text, p_description text, p_member_ids uuid[], p_read_only boolean, p_sync_filter jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_create_channel(p_name text, p_icon text, p_description text, p_member_ids uuid[], p_read_only boolean, p_sync_filter jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_create_channel(p_name text, p_icon text, p_description text, p_member_ids uuid[], p_read_only boolean, p_sync_filter jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_create_channel(p_name text, p_icon text, p_description text, p_member_ids uuid[], p_read_only boolean, p_sync_filter jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.chat_dm_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_dm_candidates() TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_dm_candidates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_dm_candidates() TO service_role;
REVOKE ALL ON FUNCTION public.chat_is_manager(p_user uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_is_manager(p_user uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_is_manager(p_user uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_is_manager(p_user uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_is_manager(p_user uuid) TO anon;
REVOKE ALL ON FUNCTION public.chat_is_member(p_channel uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_is_member(p_channel uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_is_member(p_channel uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_is_member(p_channel uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_is_member(p_channel uuid) TO anon;
REVOKE ALL ON FUNCTION public.chat_leave_channel(p_channel_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_leave_channel(p_channel_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_leave_channel(p_channel_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_leave_channel(p_channel_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_mark_read(p_channel uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_mark_read(p_channel uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_mark_read(p_channel uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_mark_read(p_channel uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_my_channels() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_my_channels() TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_my_channels() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_my_channels() TO service_role;
REVOKE ALL ON FUNCTION public.chat_profile_matches_filter(p_filter jsonb, p_department text, p_companies text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_profile_matches_filter(p_filter jsonb, p_department text, p_companies text[]) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_profile_matches_filter(p_filter jsonb, p_department text, p_companies text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.chat_profile_matches_filter(p_filter jsonb, p_department text, p_companies text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_profile_matches_filter(p_filter jsonb, p_department text, p_companies text[]) TO service_role;
REVOKE ALL ON FUNCTION public.chat_remove_member(p_channel_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_remove_member(p_channel_id uuid, p_user_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_remove_member(p_channel_id uuid, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_remove_member(p_channel_id uuid, p_user_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_set_member_admin(p_channel_id uuid, p_user_id uuid, p_is_admin boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_set_member_admin(p_channel_id uuid, p_user_id uuid, p_is_admin boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_set_member_admin(p_channel_id uuid, p_user_id uuid, p_is_admin boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_set_member_admin(p_channel_id uuid, p_user_id uuid, p_is_admin boolean) TO service_role;
REVOKE ALL ON FUNCTION public.chat_start_dm(p_target uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_start_dm(p_target uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_start_dm(p_target uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_start_dm(p_target uuid) TO service_role;
REVOKE ALL ON FUNCTION public.chat_sync_channel_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_sync_channel_membership() TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_sync_channel_membership() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_sync_channel_membership() TO service_role;
REVOKE ALL ON FUNCTION public.chat_sync_membership_for_channel(p_channel_id uuid, p_user_id uuid, p_department text, p_companies text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_sync_membership_for_channel(p_channel_id uuid, p_user_id uuid, p_department text, p_companies text[]) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_sync_membership_for_channel(p_channel_id uuid, p_user_id uuid, p_department text, p_companies text[]) TO service_role;
REVOKE ALL ON FUNCTION public.chat_touch_channel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_touch_channel() TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_touch_channel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_touch_channel() TO service_role;
REVOKE ALL ON FUNCTION public.chat_update_channel(p_channel_id uuid, p_name text, p_description text, p_read_only boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_update_channel(p_channel_id uuid, p_name text, p_description text, p_read_only boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.chat_update_channel(p_channel_id uuid, p_name text, p_description text, p_read_only boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_update_channel(p_channel_id uuid, p_name text, p_description text, p_read_only boolean) TO service_role;
REVOKE ALL ON FUNCTION public.client_billing_history_touch_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_billing_history_touch_row() TO postgres;
GRANT EXECUTE ON FUNCTION public.client_billing_history_touch_row() TO anon;
GRANT EXECUTE ON FUNCTION public.client_billing_history_touch_row() TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_billing_history_touch_row() TO service_role;
REVOKE ALL ON FUNCTION public.clients_touch_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clients_touch_row() TO postgres;
GRANT EXECUTE ON FUNCTION public.clients_touch_row() TO anon;
GRANT EXECUTE ON FUNCTION public.clients_touch_row() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clients_touch_row() TO service_role;
REVOKE ALL ON FUNCTION public.comex_export_operations_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comex_export_operations_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.comex_export_operations_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.comex_export_operations_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.comex_export_operations_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.comex_import_operations_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comex_import_operations_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.comex_import_operations_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.comex_import_operations_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.comex_import_operations_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.create_mention_notifications(p_recipient_ids uuid[], p_type text, p_title text, p_body text, p_link jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_mention_notifications(p_recipient_ids uuid[], p_type text, p_title text, p_body text, p_link jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.create_mention_notifications(p_recipient_ids uuid[], p_type text, p_title text, p_body text, p_link jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_mention_notifications(p_recipient_ids uuid[], p_type text, p_title text, p_body text, p_link jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.crm_create_cross_module_deliverable(p_title text, p_company_ids text[], p_description text, p_priority text, p_deadline timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_create_cross_module_deliverable(p_title text, p_company_ids text[], p_description text, p_priority text, p_deadline timestamp with time zone) TO postgres;
GRANT EXECUTE ON FUNCTION public.crm_create_cross_module_deliverable(p_title text, p_company_ids text[], p_description text, p_priority text, p_deadline timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_create_cross_module_deliverable(p_title text, p_company_ids text[], p_description text, p_priority text, p_deadline timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION public.crm_viagem_despesas_block_delete_prestada() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_viagem_despesas_block_delete_prestada() TO postgres;
GRANT EXECUTE ON FUNCTION public.crm_viagem_despesas_block_delete_prestada() TO service_role;
REVOKE ALL ON FUNCTION public.crm_viagem_despesas_require_comprovante() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_viagem_despesas_require_comprovante() TO postgres;
GRANT EXECUTE ON FUNCTION public.crm_viagem_despesas_require_comprovante() TO service_role;
REVOKE ALL ON FUNCTION public.crm_viagem_despesas_validate_prestacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_viagem_despesas_validate_prestacao() TO postgres;
GRANT EXECUTE ON FUNCTION public.crm_viagem_despesas_validate_prestacao() TO service_role;
REVOKE ALL ON FUNCTION public.crm_viagem_prestacoes_recompute_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_viagem_prestacoes_recompute_status() TO postgres;
GRANT EXECUTE ON FUNCTION public.crm_viagem_prestacoes_recompute_status() TO service_role;
REVOKE ALL ON FUNCTION public.crm_viagem_prestacoes_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_viagem_prestacoes_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.crm_viagem_prestacoes_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.crm_viagem_prestacoes_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_viagem_prestacoes_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.current_user_can_manage_client(p_client uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_client(p_client uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_client(p_client uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_client(p_client uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_client(p_client uuid) TO anon;
REVOKE ALL ON FUNCTION public.current_user_can_see_lead(p_lead_id text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_see_lead(p_lead_id text) TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_can_see_lead(p_lead_id text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_see_lead(p_lead_id text) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_can_see_lead(p_lead_id text) TO anon;
REVOKE ALL ON FUNCTION public.current_user_client_companies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_client_companies() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_client_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_client_companies() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_client_companies() TO anon;
REVOKE ALL ON FUNCTION public.current_user_client_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO anon;
REVOKE ALL ON FUNCTION public.current_user_companies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_companies() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_companies() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_companies() TO anon;
REVOKE ALL ON FUNCTION public.current_user_has_module(p_module text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_module(p_module text) TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_has_module(p_module text) TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_module(p_module text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_module(p_module text) TO service_role;
REVOKE ALL ON FUNCTION public.current_user_has_role(p_role text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(p_role text) TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(p_role text) TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(p_role text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(p_role text) TO service_role;
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO anon;
REVOKE ALL ON FUNCTION public.current_user_is_comex() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_comex() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_is_comex() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_comex() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_comex() TO service_role;
REVOKE ALL ON FUNCTION public.current_user_is_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_manager() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_manager() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_manager() TO anon;
REVOKE ALL ON FUNCTION public.current_user_is_marketing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing() TO anon;
REVOKE ALL ON FUNCTION public.current_user_is_marketing_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing_manager() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing_manager() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing_manager() TO anon;
REVOKE ALL ON FUNCTION public.current_user_is_rh() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_rh() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_is_rh() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_rh() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_rh() TO service_role;
REVOKE ALL ON FUNCTION public.current_user_is_rh_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_rh_manager() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_is_rh_manager() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_rh_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_rh_manager() TO service_role;
REVOKE ALL ON FUNCTION public.current_user_manages_commercial_tools() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_manages_commercial_tools() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_manages_commercial_tools() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_manages_commercial_tools() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_manages_commercial_tools() TO anon;
REVOKE ALL ON FUNCTION public.current_user_manages_viagem_of(p_vendedor_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_manages_viagem_of(p_vendedor_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_manages_viagem_of(p_vendedor_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_manages_viagem_of(p_vendedor_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_manages_viagem_of(p_vendedor_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon;
REVOKE ALL ON FUNCTION public.current_user_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO service_role;
REVOKE ALL ON FUNCTION public.current_user_sectors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_sectors() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_sectors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_sectors() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_sectors() TO anon;
REVOKE ALL ON FUNCTION public.current_user_subordinate_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_subordinate_ids() TO postgres;
GRANT EXECUTE ON FUNCTION public.current_user_subordinate_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_subordinate_ids() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_subordinate_ids() TO anon;
REVOKE ALL ON FUNCTION public.enforce_margin_rule() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_margin_rule() TO postgres;
GRANT EXECUTE ON FUNCTION public.enforce_margin_rule() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_margin_rule() TO service_role;
REVOKE ALL ON FUNCTION public.enviar_pesquisa_notificacao(p_pesquisa_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_pesquisa_notificacao(p_pesquisa_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.enviar_pesquisa_notificacao(p_pesquisa_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_pesquisa_notificacao(p_pesquisa_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.esg_emission_factors_guard_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esg_emission_factors_guard_update() TO postgres;
GRANT EXECUTE ON FUNCTION public.esg_emission_factors_guard_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.esg_emission_factors_guard_update() TO service_role;
REVOKE ALL ON FUNCTION public.external_api_daily_increment(p_bucket text, p_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.external_api_daily_increment(p_bucket text, p_user_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.external_api_daily_increment(p_bucket text, p_user_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_bemestar_horarios_disponiveis(p_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bemestar_horarios_disponiveis(p_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_bemestar_horarios_disponiveis(p_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_bemestar_horarios_disponiveis(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bemestar_horarios_disponiveis(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_bemestar_sessao_publica(p_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bemestar_sessao_publica(p_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_bemestar_sessao_publica(p_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_bemestar_sessao_publica(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bemestar_sessao_publica(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_client_timeline(p_client_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_timeline(p_client_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_client_timeline(p_client_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_timeline(p_client_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_colaborador_connections(p_colaborador_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_colaborador_connections(p_colaborador_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_colaborador_connections(p_colaborador_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_colaborador_connections(p_colaborador_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_marketing_request_number(p_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketing_request_number(p_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_marketing_request_number(p_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_marketing_request_number(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketing_request_number(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_my_colaborador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_colaborador() TO postgres;
GRANT EXECUTE ON FUNCTION public.get_my_colaborador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_colaborador() TO service_role;
REVOKE ALL ON FUNCTION public.get_pesquisa_publica(p_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_publica(p_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_publica(p_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_publica(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_publica(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_purchase_request_number(p_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_purchase_request_number(p_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_purchase_request_number(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_request_number(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_supplier_last_purchase_price(p_supplier_id uuid, p_item_name text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_last_purchase_price(p_supplier_id uuid, p_item_name text) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_supplier_last_purchase_price(p_supplier_id uuid, p_item_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supplier_last_purchase_price(p_supplier_id uuid, p_item_name text) TO service_role;
REVOKE ALL ON FUNCTION public.get_vaga_publica(p_slug text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vaga_publica(p_slug text) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_vaga_publica(p_slug text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_vaga_publica(p_slug text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vaga_publica(p_slug text) TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION public.handle_user_confirmed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_user_confirmed() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_user_confirmed() TO service_role;
REVOKE ALL ON FUNCTION public.is_comercial_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_comercial_operator() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_comercial_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_comercial_operator() TO service_role;
REVOKE ALL ON FUNCTION public.is_comercial_support() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_comercial_support() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_comercial_support() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_comercial_support() TO service_role;
REVOKE ALL ON FUNCTION public.is_own_colaborador(p_colaborador_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_own_colaborador(p_colaborador_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.is_own_colaborador(p_colaborador_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_colaborador(p_colaborador_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.lead_samples_freeze_created_by() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_samples_freeze_created_by() TO postgres;
GRANT EXECUTE ON FUNCTION public.lead_samples_freeze_created_by() TO anon;
GRANT EXECUTE ON FUNCTION public.lead_samples_freeze_created_by() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_samples_freeze_created_by() TO service_role;
REVOKE ALL ON FUNCTION public.leads_sync_owner_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leads_sync_owner_ids() TO postgres;
GRANT EXECUTE ON FUNCTION public.leads_sync_owner_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.leads_sync_owner_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leads_sync_owner_ids() TO service_role;
REVOKE ALL ON FUNCTION public.leads_sync_status_to_stage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leads_sync_status_to_stage() TO postgres;
GRANT EXECUTE ON FUNCTION public.leads_sync_status_to_stage() TO service_role;
REVOKE ALL ON FUNCTION public.leads_touch_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leads_touch_row() TO postgres;
GRANT EXECUTE ON FUNCTION public.leads_touch_row() TO anon;
GRANT EXECUTE ON FUNCTION public.leads_touch_row() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leads_touch_row() TO service_role;
REVOKE ALL ON FUNCTION public.list_evento_campaigns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_evento_campaigns() TO postgres;
GRANT EXECUTE ON FUNCTION public.list_evento_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_evento_campaigns() TO service_role;
REVOKE ALL ON FUNCTION public.log_lead_stage_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_lead_stage_change() TO postgres;
GRANT EXECUTE ON FUNCTION public.log_lead_stage_change() TO service_role;
REVOKE ALL ON FUNCTION public.log_rh_stage_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_rh_stage_change() TO postgres;
GRANT EXECUTE ON FUNCTION public.log_rh_stage_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_rh_stage_change() TO service_role;
REVOKE ALL ON FUNCTION public.margin_check(p_company_id text, p_product_id uuid, p_price numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.margin_check(p_company_id text, p_product_id uuid, p_price numeric) TO postgres;
GRANT EXECUTE ON FUNCTION public.margin_check(p_company_id text, p_product_id uuid, p_price numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.margin_check(p_company_id text, p_product_id uuid, p_price numeric) TO service_role;
REVOKE ALL ON FUNCTION public.marketing_budgets_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_budgets_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_budgets_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.marketing_budgets_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_budgets_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_campaigns_sync_owner_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_campaigns_sync_owner_ids() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_campaigns_sync_owner_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.marketing_campaigns_sync_owner_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_campaigns_sync_owner_ids() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_campaigns_touch_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_campaigns_touch_row() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_campaigns_touch_row() TO anon;
GRANT EXECUTE ON FUNCTION public.marketing_campaigns_touch_row() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_campaigns_touch_row() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_deliverables_assign_protocol_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_assign_protocol_number() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_assign_protocol_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_assign_protocol_number() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_deliverables_release_protocol_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_release_protocol_number() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_release_protocol_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_release_protocol_number() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_deliverables_sync_assignee_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_sync_assignee_ids() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_sync_assignee_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_sync_assignee_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_sync_assignee_ids() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_deliverables_sync_protocol_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_sync_protocol_number() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_sync_protocol_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_deliverables_sync_protocol_number() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_expense_items_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_expense_items_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_expense_items_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.marketing_expense_items_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_expense_items_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_expense_items_sync_amount() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_expense_items_sync_amount() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_expense_items_sync_amount() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_purchase_requests_guard_approval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_guard_approval() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_guard_approval() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_purchase_requests_notify_new() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_notify_new() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_notify_new() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_purchase_requests_require_invoice() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_require_invoice() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_require_invoice() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_purchase_requests_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_purchase_requests_sync_expense() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_sync_expense() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_sync_expense() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_purchase_requests_sync_responsible_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_sync_responsible_ids() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_sync_responsible_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_sync_responsible_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_purchase_requests_sync_responsible_ids() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_quotes_guard_approval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_quotes_guard_approval() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_quotes_guard_approval() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_requests_assign_protocol_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_requests_assign_protocol_number() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_requests_assign_protocol_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_requests_assign_protocol_number() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_requests_release_protocol_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_requests_release_protocol_number() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_requests_release_protocol_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_requests_release_protocol_number() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_requests_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_requests_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_requests_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_requests_sync_protocol_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_requests_sync_protocol_number() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_requests_sync_protocol_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_requests_sync_protocol_number() TO service_role;
REVOKE ALL ON FUNCTION public.marketing_tasks_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_tasks_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.marketing_tasks_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.marketing_tasks_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_tasks_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.mc_set_checklist(p_campaign_id uuid, p_checklist jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mc_set_checklist(p_campaign_id uuid, p_checklist jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.mc_set_checklist(p_campaign_id uuid, p_checklist jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mc_set_checklist(p_campaign_id uuid, p_checklist jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.notifications_cascade_delete_by_link() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notifications_cascade_delete_by_link() TO postgres;
GRANT EXECUTE ON FUNCTION public.notifications_cascade_delete_by_link() TO service_role;
REVOKE ALL ON FUNCTION public.orders_guard_stage_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orders_guard_stage_change() TO postgres;
GRANT EXECUTE ON FUNCTION public.orders_guard_stage_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.orders_guard_stage_change() TO service_role;
REVOKE ALL ON FUNCTION public.personal_task_checklists_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.personal_task_checklists_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.personal_task_checklists_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.personal_task_checklists_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_task_checklists_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.personal_task_stages_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.personal_task_stages_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.personal_task_stages_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.personal_task_stages_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_task_stages_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.personal_tasks_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.personal_tasks_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.personal_tasks_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.personal_tasks_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.personal_tasks_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.pesquisa_respostas_aggregado(p_pesquisa_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pesquisa_respostas_aggregado(p_pesquisa_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.pesquisa_respostas_aggregado(p_pesquisa_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pesquisa_respostas_aggregado(p_pesquisa_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.posvenda_cases_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.posvenda_cases_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.posvenda_cases_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.posvenda_cases_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.posvenda_cases_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.products_enforce_field_ownership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.products_enforce_field_ownership() TO postgres;
GRANT EXECUTE ON FUNCTION public.products_enforce_field_ownership() TO authenticated;
GRANT EXECUTE ON FUNCTION public.products_enforce_field_ownership() TO service_role;
REVOKE ALL ON FUNCTION public.profile_secrets_ensure_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_secrets_ensure_row() TO postgres;
GRANT EXECUTE ON FUNCTION public.profile_secrets_ensure_row() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_secrets_ensure_row() TO service_role;
REVOKE ALL ON FUNCTION public.profiles_prevent_self_role_escalation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_prevent_self_role_escalation() TO postgres;
GRANT EXECUTE ON FUNCTION public.profiles_prevent_self_role_escalation() TO service_role;
REVOKE ALL ON FUNCTION public.profiles_sync_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_sync_roles() TO postgres;
GRANT EXECUTE ON FUNCTION public.profiles_sync_roles() TO anon;
GRANT EXECUTE ON FUNCTION public.profiles_sync_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_sync_roles() TO service_role;
REVOKE ALL ON FUNCTION public.proposal_line_items_sync_total() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_line_items_sync_total() TO postgres;
GRANT EXECUTE ON FUNCTION public.proposal_line_items_sync_total() TO service_role;
REVOKE ALL ON FUNCTION public.recalc_order_total() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_order_total() TO postgres;
GRANT EXECUTE ON FUNCTION public.recalc_order_total() TO service_role;
REVOKE ALL ON FUNCTION public.reject_marketing_quote(p_quote_id uuid, p_reason text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_marketing_quote(p_quote_id uuid, p_reason text) TO postgres;
GRANT EXECUTE ON FUNCTION public.reject_marketing_quote(p_quote_id uuid, p_reason text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_marketing_quote(p_quote_id uuid, p_reason text) TO service_role;
REVOKE ALL ON FUNCTION public.reject_purchase_request(p_id uuid, p_reason text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_purchase_request(p_id uuid, p_reason text) TO postgres;
GRANT EXECUTE ON FUNCTION public.reject_purchase_request(p_id uuid, p_reason text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_purchase_request(p_id uuid, p_reason text) TO service_role;
REVOKE ALL ON FUNCTION public.reject_rh_data_update_request(p_id uuid, p_motivo text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_rh_data_update_request(p_id uuid, p_motivo text) TO postgres;
GRANT EXECUTE ON FUNCTION public.reject_rh_data_update_request(p_id uuid, p_motivo text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rh_data_update_request(p_id uuid, p_motivo text) TO service_role;
REVOKE ALL ON FUNCTION public.reject_rh_movimentacao(p_id uuid, p_motivo text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_rh_movimentacao(p_id uuid, p_motivo text) TO postgres;
GRANT EXECUTE ON FUNCTION public.reject_rh_movimentacao(p_id uuid, p_motivo text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rh_movimentacao(p_id uuid, p_motivo text) TO service_role;
REVOKE ALL ON FUNCTION public.rh_avaliacoes_sync_evaluator_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_avaliacoes_sync_evaluator_ids() TO postgres;
GRANT EXECUTE ON FUNCTION public.rh_avaliacoes_sync_evaluator_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.rh_avaliacoes_sync_evaluator_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_avaliacoes_sync_evaluator_ids() TO service_role;
REVOKE ALL ON FUNCTION public.rh_candidato_exists(p_candidate_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_candidato_exists(p_candidate_id uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.rh_candidato_exists(p_candidate_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.rh_candidato_exists(p_candidate_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_candidato_exists(p_candidate_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.rh_curriculo_folder_object_count(p_folder text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_folder_object_count(p_folder text) TO postgres;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_folder_object_count(p_folder text) TO anon;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_folder_object_count(p_folder text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_folder_object_count(p_folder text) TO service_role;
REVOKE ALL ON FUNCTION public.rh_curriculo_token_consume(p_candidato_id uuid, p_filename text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_token_consume(p_candidato_id uuid, p_filename text) TO postgres;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_token_consume(p_candidato_id uuid, p_filename text) TO anon;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_token_consume(p_candidato_id uuid, p_filename text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_token_consume(p_candidato_id uuid, p_filename text) TO service_role;
REVOKE ALL ON FUNCTION public.rh_movimentacoes_guard_approval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_movimentacoes_guard_approval() TO postgres;
GRANT EXECUTE ON FUNCTION public.rh_movimentacoes_guard_approval() TO anon;
GRANT EXECUTE ON FUNCTION public.rh_movimentacoes_guard_approval() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_movimentacoes_guard_approval() TO service_role;
REVOKE ALL ON FUNCTION public.rh_onboarding_tarefas_guard_self_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_onboarding_tarefas_guard_self_update() TO postgres;
GRANT EXECUTE ON FUNCTION public.rh_onboarding_tarefas_guard_self_update() TO service_role;
REVOKE ALL ON FUNCTION public.rh_submit_self_rating(p_avaliacao_id uuid, p_self_rating numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_submit_self_rating(p_avaliacao_id uuid, p_self_rating numeric) TO postgres;
GRANT EXECUTE ON FUNCTION public.rh_submit_self_rating(p_avaliacao_id uuid, p_self_rating numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_submit_self_rating(p_avaliacao_id uuid, p_self_rating numeric) TO service_role;
REVOKE ALL ON FUNCTION public.sales_cases_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_cases_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.sales_cases_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.sales_cases_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_cases_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.set_vaga_approved_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_vaga_approved_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.set_vaga_approved_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_vaga_approved_at() TO service_role;
REVOKE ALL ON FUNCTION public.submit_bemestar_agendamento(p_sessao_id uuid, p_horario time without time zone, p_nome text, p_ramal text, p_email text, p_whatsapp text, p_frente text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_bemestar_agendamento(p_sessao_id uuid, p_horario time without time zone, p_nome text, p_ramal text, p_email text, p_whatsapp text, p_frente text) TO postgres;
GRANT EXECUTE ON FUNCTION public.submit_bemestar_agendamento(p_sessao_id uuid, p_horario time without time zone, p_nome text, p_ramal text, p_email text, p_whatsapp text, p_frente text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_bemestar_agendamento(p_sessao_id uuid, p_horario time without time zone, p_nome text, p_ramal text, p_email text, p_whatsapp text, p_frente text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_bemestar_agendamento(p_sessao_id uuid, p_horario time without time zone, p_nome text, p_ramal text, p_email text, p_whatsapp text, p_frente text) TO service_role;
REVOKE ALL ON FUNCTION public.submit_job_application(p_vaga_slug text, p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_application(p_vaga_slug text, p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) TO postgres;
GRANT EXECUTE ON FUNCTION public.submit_job_application(p_vaga_slug text, p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_job_application(p_vaga_slug text, p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_job_application(p_vaga_slug text, p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) TO service_role;
REVOKE ALL ON FUNCTION public.submit_lead_capture(p_company_id text, p_customer_name text, p_contact_phone text, p_contact_email text, p_product_interest text, p_priority text, p_prospect_date date, p_notes text, p_source text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_lead_capture(p_company_id text, p_customer_name text, p_contact_phone text, p_contact_email text, p_product_interest text, p_priority text, p_prospect_date date, p_notes text, p_source text) TO postgres;
GRANT EXECUTE ON FUNCTION public.submit_lead_capture(p_company_id text, p_customer_name text, p_contact_phone text, p_contact_email text, p_product_interest text, p_priority text, p_prospect_date date, p_notes text, p_source text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_lead_capture(p_company_id text, p_customer_name text, p_contact_phone text, p_contact_email text, p_product_interest text, p_priority text, p_prospect_date date, p_notes text, p_source text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_lead_capture(p_company_id text, p_customer_name text, p_contact_phone text, p_contact_email text, p_product_interest text, p_priority text, p_prospect_date date, p_notes text, p_source text) TO service_role;
REVOKE ALL ON FUNCTION public.submit_marketing_request(p_category text, p_title text, p_requester_name text, p_requester_email text, p_department text, p_request_type text, p_description text, p_priority text, p_deadline date, p_company_ids text[], p_budget numeric, p_approver_name text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_marketing_request(p_category text, p_title text, p_requester_name text, p_requester_email text, p_department text, p_request_type text, p_description text, p_priority text, p_deadline date, p_company_ids text[], p_budget numeric, p_approver_name text) TO postgres;
GRANT EXECUTE ON FUNCTION public.submit_marketing_request(p_category text, p_title text, p_requester_name text, p_requester_email text, p_department text, p_request_type text, p_description text, p_priority text, p_deadline date, p_company_ids text[], p_budget numeric, p_approver_name text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_marketing_request(p_category text, p_title text, p_requester_name text, p_requester_email text, p_department text, p_request_type text, p_description text, p_priority text, p_deadline date, p_company_ids text[], p_budget numeric, p_approver_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_marketing_request(p_category text, p_title text, p_requester_name text, p_requester_email text, p_department text, p_request_type text, p_description text, p_priority text, p_deadline date, p_company_ids text[], p_budget numeric, p_approver_name text) TO service_role;
REVOKE ALL ON FUNCTION public.submit_pesquisa_resposta(p_pesquisa_id uuid, p_respostas jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pesquisa_resposta(p_pesquisa_id uuid, p_respostas jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.submit_pesquisa_resposta(p_pesquisa_id uuid, p_respostas jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_pesquisa_resposta(p_pesquisa_id uuid, p_respostas jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pesquisa_resposta(p_pesquisa_id uuid, p_respostas jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.submit_talent_pool_application(p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_talent_pool_application(p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) TO postgres;
GRANT EXECUTE ON FUNCTION public.submit_talent_pool_application(p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_talent_pool_application(p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_talent_pool_application(p_nome text, p_email text, p_telefone text, p_linkedin text, p_consentimento_lgpd boolean, p_resume_ext text, p_frente text) TO service_role;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_profile_email() TO postgres;
GRANT EXECUTE ON FUNCTION public.sync_profile_email() TO service_role;
REVOKE ALL ON FUNCTION public.sync_profile_to_colaborador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_profile_to_colaborador() TO postgres;
GRANT EXECUTE ON FUNCTION public.sync_profile_to_colaborador() TO service_role;
REVOKE ALL ON FUNCTION public.trigger_set_updated_at_deliverables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at_deliverables() TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at_deliverables() TO anon;
GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at_deliverables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at_deliverables() TO service_role;
REVOKE ALL ON FUNCTION public.trigger_set_updated_at_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at_expenses() TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at_expenses() TO anon;
GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at_expenses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_set_updated_at_expenses() TO service_role;
REVOKE ALL ON FUNCTION public.uniform_can_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uniform_can_write() TO postgres;
GRANT EXECUTE ON FUNCTION public.uniform_can_write() TO authenticated;
GRANT EXECUTE ON FUNCTION public.uniform_can_write() TO service_role;
REVOKE ALL ON FUNCTION public.uniform_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uniform_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.uniform_set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.uniform_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.uniform_set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.update_agent_actions_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_agent_actions_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_agent_actions_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_agent_actions_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_agent_actions_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.validate_rh_stage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_rh_stage() TO postgres;
GRANT EXECUTE ON FUNCTION public.validate_rh_stage() TO service_role;

-- ============ BUCKETS DE STORAGE ============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('avatars', 'avatars', true, 2097152, '{image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('chat-attachments', 'chat-attachments', false, 10485760, '{application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/jpeg,image/png,image/gif,image/webp,audio/webm,audio/ogg}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('chat-stickers', 'chat-stickers', true, 2097152, '{image/png,image/webp}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('crm-comprovantes', 'crm-comprovantes', false, 10485760, '{application/pdf,image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('deliverable-attachments', 'deliverable-attachments', false, 52428800, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('document-library', 'document-library', false, 10485760, '{application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.ms-excel}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('lead-attachments', 'lead-attachments', false, 52428800, '{image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/wav}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('marketing-attachments', 'marketing-attachments', false, 52428800, '{image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,video/mp4,video/quicktime,application/zip}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('personal-task-attachments', 'personal-task-attachments', false, 10485760, '{application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/jpeg,image/png,image/gif,image/webp}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('rh-attachments', 'rh-attachments', false, 10485760, '{application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.ms-excel}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('rh-curriculos', 'rh-curriculos', false, 10485760, '{application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('rh-documentos-assinatura', 'rh-documentos-assinatura', false, 10485760, '{application/pdf,image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('rh-documentos-colaborador', 'rh-documentos-colaborador', false, 10485760, '{application/pdf,image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO NOTHING;

-- ============ TRIGGERS EM auth.users ============
-- Achado no 1o CI do baseline (31/08/2026): a primeira versao filtrava
-- triggers por nspname = 'public' e perdeu estes tres, que vivem numa tabela
-- do schema `auth`. O sintoma foi cirurgico — 128 divergencias na matriz de
-- RLS, exatamente o numero de celulas onde expected = true. Sem
-- on_auth_user_created, o INSERT em auth.users nao gera a linha em
-- public.profiles, nenhuma checagem de cargo passa, e TUDO que deveria ser
-- permitido vira negado.
--
-- So estes tres entram: os outros triggers fora de `public` (cron.job,
-- realtime.subscription, storage.buckets, storage.objects) pertencem a
-- plataforma e o proprio `supabase start` os cria — recria-los aqui daria
-- conflito.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change AFTER UPDATE OF email ON auth.users FOR EACH ROW WHEN (((old.email)::text IS DISTINCT FROM (new.email)::text)) EXECUTE FUNCTION sync_profile_email();

DROP TRIGGER IF EXISTS on_user_confirmed ON auth.users;
CREATE TRIGGER on_user_confirmed AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_user_confirmed();
