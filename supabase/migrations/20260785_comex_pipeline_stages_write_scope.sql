-- Comex ganhou tela de "Nova etapa"/"Editar campos desta etapa" (ComexView.jsx),
-- mas rh_pipeline_stages_write/rh_pipeline_stage_fields_write (escopadas por
-- (role, domain) desde 20260713_fix_rh_pipeline_stages_domain_scope.sql) não
-- incluíam o cargo/domains novos — write silenciosamente barrado pela RLS
-- mesmo com o botão visível na UI. Mesmo padrão aditivo de sempre.
DROP POLICY IF EXISTS rh_pipeline_stages_write ON public.rh_pipeline_stages;
CREATE POLICY rh_pipeline_stages_write
  ON public.rh_pipeline_stages
  FOR ALL
  USING (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND domain = 'comercial')
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables']))
    OR (current_user_role() = 'comex' AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND domain = 'comercial')
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables']))
    OR (current_user_role() = 'comex' AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  );

DROP POLICY IF EXISTS rh_pipeline_stage_fields_write ON public.rh_pipeline_stage_fields;
CREATE POLICY rh_pipeline_stage_fields_write
  ON public.rh_pipeline_stage_fields
  FOR ALL
  USING (
    current_user_is_admin()
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables']))
    OR (current_user_role() = 'comex' AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables']))
    OR (current_user_role() = 'comex' AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  );
