-- Mesmo bug de 20260801 (rh_pipeline_stages_write), instância separada:
-- rh_colaboradores_rh_access (20260703_rh_colaboradores.sql) checava
-- profiles.role — coluna legada, escalar — em vez de profiles.roles[]. Quem
-- tem gerente_rh/rh como CARGO ADICIONAL (não o principal) passa em
-- isRHManager no front (App.jsx já lê roles[]) mas caía na RLS aqui: editar
-- ou excluir um funcionário falhava silenciosamente pra esse perfil. Achado
-- ao construir a exclusão de funcionário (30/07/2026) — esta tabela não
-- fazia parte do escopo do audit diário de RLS (supabase/tests/
-- rls_stage_matrix.sql), que só cobre rh_pipeline_stages/rh_pipeline_
-- stage_fields; não craqueado antes por falta de teste, não por menos grave.
DROP POLICY IF EXISTS rh_colaboradores_rh_access ON public.rh_colaboradores;
CREATE POLICY rh_colaboradores_rh_access ON public.rh_colaboradores
  FOR ALL
  USING (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
  WITH CHECK (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'));
