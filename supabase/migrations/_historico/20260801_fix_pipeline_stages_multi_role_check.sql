-- Bug real: "Criar etapa" (Nova etapa) falhava com "new row violates
-- row-level security policy" pra qualquer usuário cujo papel de
-- marketing/RH/comex fosse um CARGO ADICIONAL (roles[]), não o cargo
-- principal (profiles.role, coluna escalar antiga) — reportado em Tarefas
-- (domain='marketing_tasks'), mas afeta qualquer domínio.
--
-- Causa raiz: rh_pipeline_stages_write / rh_pipeline_stage_fields_write
-- usavam current_user_role() (só lê profiles.role, escalar, pré-FASE 1)
-- em vez de current_user_has_role() (lê profiles.roles[], já usado
-- corretamente pelas policies de posvenda nas mesmas tabelas).
--
-- Confirmado no banco: Elaine Uehara (role='gerente', roles inclui
-- 'marketing'/'gerente_marketing') e Everton Barbosa (role='gerente',
-- roles inclui 'gerente_marketing') caem exatamente nesse buraco.

DROP POLICY IF EXISTS rh_pipeline_stages_write ON public.rh_pipeline_stages;
CREATE POLICY rh_pipeline_stages_write
  ON public.rh_pipeline_stages
  FOR ALL
  USING (
    current_user_is_admin()
    OR (current_user_has_role('gerente') AND domain = 'comercial')
    OR (
      (current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
      AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos'])
    )
    OR (
      (current_user_has_role('marketing') OR current_user_has_role('gerente_marketing'))
      AND domain = ANY (ARRAY['marketing', 'marketing_deliverables', 'marketing_tasks', 'marketing_purchase_requests'])
    )
    OR (current_user_has_role('comex') AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_has_role('gerente') AND domain = 'comercial')
    OR (
      (current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
      AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos'])
    )
    OR (
      (current_user_has_role('marketing') OR current_user_has_role('gerente_marketing'))
      AND domain = ANY (ARRAY['marketing', 'marketing_deliverables', 'marketing_tasks', 'marketing_purchase_requests'])
    )
    OR (current_user_has_role('comex') AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  );

DROP POLICY IF EXISTS rh_pipeline_stage_fields_write ON public.rh_pipeline_stage_fields;
CREATE POLICY rh_pipeline_stage_fields_write
  ON public.rh_pipeline_stage_fields
  FOR ALL
  USING (
    current_user_is_admin()
    OR (
      (current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
      AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos'])
    )
    OR (
      (current_user_has_role('marketing') OR current_user_has_role('gerente_marketing'))
      AND domain = ANY (ARRAY['marketing', 'marketing_deliverables', 'marketing_tasks', 'marketing_purchase_requests'])
    )
    OR (current_user_has_role('comex') AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (
      (current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
      AND domain = ANY (ARRAY['vagas', 'onboarding', 'ferias', 'feedback', 'candidatos', 'treinamentos'])
    )
    OR (
      (current_user_has_role('marketing') OR current_user_has_role('gerente_marketing'))
      AND domain = ANY (ARRAY['marketing', 'marketing_deliverables', 'marketing_tasks', 'marketing_purchase_requests'])
    )
    OR (current_user_has_role('comex') AND domain = ANY (ARRAY['comex_importacao', 'comex_exportacao']))
  );
