-- Reconciliação: esta migração já estava aplicada no banco remoto
-- (supabase_migrations.schema_migrations, version 20260729174315,
-- "fix_pipeline_stages_multi_role_check") mas nunca tinha um arquivo .sql
-- correspondente neste repo — auditoria encontrou a política write de
-- rh_pipeline_stages ainda usando current_user_role() = 'x' (coluna legada
-- de role único), enquanto profiles.role já virou profiles.roles (array,
-- desde 20260714_profiles_multi_role_foundation.sql). Um usuário com roles
-- multiplos (ex.: ['vendedor','marketing']) tinha current_user_role() != 'x'
-- pra qualquer domínio que dependesse do array, e a escrita era barrada
-- pela RLS silenciosamente — foi o caso reportado do "Nova etapa" no Kanban
-- de Tarefas de Marketing ("new row violates row-level security policy for
-- table rh_pipeline_stages"). Troca current_user_role() por
-- current_user_has_role(), que já consulta o array `roles` corretamente.
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
