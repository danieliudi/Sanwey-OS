-- Menor da auditoria: rh_pipeline_stages_write/rh_pipeline_stage_fields_write
-- concediam ALL a um array de roles sem nenhum filtro por domain — um
-- marketing/gerente_marketing conseguia escrever nas etapas de domain
-- 'onboarding'/'vagas' (RH) e vice-versa, mesmo sem ter tela pra isso.
--
-- rh_pipeline_stages é uma tabela compartilhada por 3 áreas via domain:
--   'comercial'                          → CRM (use-pipelines.js, role gerente/admin)
--   'vagas','onboarding','ferias',
--   'feedback','candidatos','treinamentos' → RH (rh/gerente_rh/admin)
--   'marketing','marketing_deliverables'  → Marketing (marketing/gerente_marketing/admin)
-- Escopa cada role só ao(s) domain(s) que a própria tela usa.
--
-- rh_pipeline_stage_fields é só RH+Marketing — CRM usa a tabela legada
-- separada pipeline_stage_fields pros campos dinâmicos (gerente não precisa
-- de acesso aqui de jeito nenhum).
DROP POLICY IF EXISTS rh_pipeline_stages_write ON public.rh_pipeline_stages;
CREATE POLICY rh_pipeline_stages_write
  ON public.rh_pipeline_stages
  FOR ALL
  USING (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND domain = 'comercial')
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables']))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND domain = 'comercial')
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables']))
  );

DROP POLICY IF EXISTS rh_pipeline_stage_fields_write ON public.rh_pipeline_stage_fields;
CREATE POLICY rh_pipeline_stage_fields_write
  ON public.rh_pipeline_stage_fields
  FOR ALL
  USING (
    current_user_is_admin()
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables']))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_role() = ANY (ARRAY['gerente_rh', 'rh']) AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos']))
    OR (current_user_role() = ANY (ARRAY['marketing', 'gerente_marketing']) AND domain = ANY (ARRAY['marketing', 'marketing_deliverables']))
  );
