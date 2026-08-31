-- Comex — Importação e Exportação Direta (novo departamento em Comercial).
-- Ver docs/design-spec-comex.md pro racional completo. Decisões do Daniel:
-- 2 boards separados (não um genérico só), cargo dedicado "comex" (só quem
-- tiver esse cargo vê/acessa — sem carve-out pro time comercial geral),
-- transição de etapa livre nesta rodada (sem pipeline_stage_transitions).

-- ── 1. Cargo novo "comex" ──────────────────────────────────────────────────
-- Mesmo padrão de 20260756_papel_diretoria.sql + 20260757 (as 2 migrations
-- que ampliaram roles/role/invitations pro papel Diretoria) — feito numa
-- tacada só aqui, já que a lição (esquecer o scalar `role`) já é conhecida.
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_roles_check,
  ADD CONSTRAINT profiles_roles_check
    CHECK (roles <@ ARRAY['admin','gerente','vendedor','consultor','marketing','gerente_marketing','agencia','rh','gerente_rh','portal','diretoria','comex']::text[]);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN (
      'admin','gerente','vendedor','consultor',
      'marketing','gerente_marketing','agencia',
      'rh','gerente_rh','diretoria','comex'
    ));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations') THEN
    ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_role_check
        CHECK (role IN (
          'admin','gerente','vendedor','consultor',
          'marketing','gerente_marketing','agencia',
          'rh','gerente_rh','diretoria','comex'
        ));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_user_is_comex()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT roles && ARRAY['comex','admin']::text[] FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$;

-- ── 2. Tabela base — Importação Direta ────────────────────────────────────
-- Núcleo estruturado só pro que a calculadora de Landed Cost e o board
-- realmente precisam tipado; NCM/Incoterm/PO number/BL/DI-DUIMP/canal RFB
-- etc. ficam em custom_fields via rh_pipeline_stage_fields (dado
-- configurável por etapa, já existente — CLAUDE.md regra 5).
CREATE TABLE public.comex_import_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_ids         text[] NOT NULL DEFAULT '{}',
  title               text NOT NULL,
  supplier_name       text,
  stage               text NOT NULL DEFAULT 'sourcing',
  stage_changed_at    timestamptz NOT NULL DEFAULT now(),
  owner_ids           uuid[] NOT NULL DEFAULT '{}',

  currency            text NOT NULL DEFAULT 'USD',
  fob_value           numeric,
  freight_value       numeric,
  insurance_value     numeric,
  ptax_rate           numeric,
  estimated_taxes_brl numeric,
  estimated_fees_brl  numeric,

  custom_fields       jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes               jsonb NOT NULL DEFAULT '[]'::jsonb,
  activities          jsonb NOT NULL DEFAULT '[]'::jsonb,
  starred             boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comex_import_operations_stage_idx      ON public.comex_import_operations (stage);
CREATE INDEX comex_import_operations_created_at_idx ON public.comex_import_operations (created_at DESC);

ALTER TABLE public.comex_import_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY comex_import_operations_select ON public.comex_import_operations FOR SELECT
  USING (current_user_is_comex() OR current_user_has_role('diretoria'));
CREATE POLICY comex_import_operations_insert ON public.comex_import_operations FOR INSERT
  WITH CHECK (current_user_is_comex());
CREATE POLICY comex_import_operations_update ON public.comex_import_operations FOR UPDATE
  USING (current_user_is_comex()) WITH CHECK (current_user_is_comex());
CREATE POLICY comex_import_operations_delete ON public.comex_import_operations FOR DELETE
  USING (current_user_is_comex());

CREATE OR REPLACE FUNCTION public.comex_import_operations_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER comex_import_operations_updated_at
  BEFORE UPDATE ON public.comex_import_operations
  FOR EACH ROW EXECUTE FUNCTION public.comex_import_operations_set_updated_at();

-- ── 3. Tabela base — Exportação Direta ────────────────────────────────────
CREATE TABLE public.comex_export_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_ids         text[] NOT NULL DEFAULT '{}',
  title               text NOT NULL,
  buyer_name          text,
  buyer_country       text,
  stage               text NOT NULL DEFAULT 'qualificacao_comprador',
  stage_changed_at    timestamptz NOT NULL DEFAULT now(),
  owner_ids           uuid[] NOT NULL DEFAULT '{}',

  currency            text NOT NULL DEFAULT 'USD',
  sale_value          numeric,
  ptax_rate           numeric,

  custom_fields       jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes               jsonb NOT NULL DEFAULT '[]'::jsonb,
  activities          jsonb NOT NULL DEFAULT '[]'::jsonb,
  starred             boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comex_export_operations_stage_idx      ON public.comex_export_operations (stage);
CREATE INDEX comex_export_operations_created_at_idx ON public.comex_export_operations (created_at DESC);

ALTER TABLE public.comex_export_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY comex_export_operations_select ON public.comex_export_operations FOR SELECT
  USING (current_user_is_comex() OR current_user_has_role('diretoria'));
CREATE POLICY comex_export_operations_insert ON public.comex_export_operations FOR INSERT
  WITH CHECK (current_user_is_comex());
CREATE POLICY comex_export_operations_update ON public.comex_export_operations FOR UPDATE
  USING (current_user_is_comex()) WITH CHECK (current_user_is_comex());
CREATE POLICY comex_export_operations_delete ON public.comex_export_operations FOR DELETE
  USING (current_user_is_comex());

CREATE OR REPLACE FUNCTION public.comex_export_operations_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER comex_export_operations_updated_at
  BEFORE UPDATE ON public.comex_export_operations
  FOR EACH ROW EXECUTE FUNCTION public.comex_export_operations_set_updated_at();

-- ── 4. Anexos e checklists — domínio 'comex' compartilhado pelos 2 boards ──
-- record_id (uuid) já desambigua entre uma operação de importação e uma de
-- exportação (PKs de tabelas diferentes, sem colisão) — mesmo padrão aditivo
-- já usado 3x (20260709, 20260716, 20260782).
ALTER TABLE public.rh_attachments
  DROP CONSTRAINT rh_attachments_domain_check,
  ADD CONSTRAINT rh_attachments_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','feedback','ferias','treinamentos','fornecedor_contratos','marketing_tasks','marketing_purchase_requests','comex']));

ALTER TABLE public.rh_checklists
  DROP CONSTRAINT rh_checklists_domain_check,
  ADD CONSTRAINT rh_checklists_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','marketing_tasks','marketing_purchase_requests','comex']));

CREATE POLICY rh_attachments_comex_access ON public.rh_attachments FOR ALL
  USING (domain = 'comex' AND current_user_is_comex())
  WITH CHECK (domain = 'comex' AND current_user_is_comex());

CREATE POLICY rh_checklists_comex_access ON public.rh_checklists FOR ALL
  USING (domain = 'comex' AND current_user_is_comex())
  WITH CHECK (domain = 'comex' AND current_user_is_comex());

-- Diretoria só-leitura, mesmo invariante de 20260756 (vê tudo, altera nada).
CREATE POLICY comex_import_operations_diretoria_read ON public.comex_import_operations FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY comex_export_operations_diretoria_read ON public.comex_export_operations FOR SELECT USING (current_user_has_role('diretoria'));

-- ── 5. Etapas — domain-agnóstico, zero mudança de schema nessa parte ──────
-- sla_days em dias corridos: estimativas de produto pro fluxo de comex
-- (docs/design-spec-comex.md), não é lei tributária nem prazo contratual —
-- trocar depois é trivial, mesmo espírito de PURCHASE_STAGES.slaDays.
INSERT INTO public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, terminal, won, lost, sla_days)
VALUES
  ('comex_importacao', 'all', 'sourcing',             'Sourcing & Qualificação de Fornecedor',        '#64748B', 0, false, false, false, 15),
  ('comex_importacao', 'all', 'cotacao_landed_cost',  'Cotação & Landed Cost',                        '#2563EB', 1, false, false, false, 5),
  ('comex_importacao', 'all', 'po_fechamento',        'PO & Fechamento Financeiro',                   '#7C3AED', 2, false, false, false, 5),
  ('comex_importacao', 'all', 'producao_embarque',    'Produção & Prontidão para Embarque',           '#D97706', 3, false, false, false, 25),
  ('comex_importacao', 'all', 'transito_aduana',      'Em Trânsito & Parametrização Aduaneira',       '#EA580C', 4, false, false, false, 35),
  ('comex_importacao', 'all', 'recebimento',          'DTA, Transporte Nacional & Recebimento',       '#16A34A', 5, true,  true,  false, 5),

  ('comex_exportacao', 'all', 'qualificacao_comprador', 'Qualificação do Comprador Internacional',    '#64748B', 0, false, false, false, 7),
  ('comex_exportacao', 'all', 'analise_regulatoria',    'Análise Regulatória & Precificação por Incoterm', '#2563EB', 1, false, false, false, 5),
  ('comex_exportacao', 'all', 'proforma_negociacao',    'Proforma Invoice & Negociação',               '#7C3AED', 2, false, false, false, 10),
  ('comex_exportacao', 'all', 'order_entry_producao',   'Order Entry & Instrução de Produção',         '#D97706', 3, false, false, false, 20),
  ('comex_exportacao', 'all', 'embarque_despacho',      'Gestão do Embarque & Despacho',               '#EA580C', 4, false, false, false, 10),
  ('comex_exportacao', 'all', 'liquidacao',             'Documentos Originais & Liquidação Cambial',   '#16A34A', 5, true,  true,  false, 5)
ON CONFLICT (domain, company_id, stage_key) DO NOTHING;
