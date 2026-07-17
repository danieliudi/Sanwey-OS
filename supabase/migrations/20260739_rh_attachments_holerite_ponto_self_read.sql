-- Painel do colaborador (Onda 5, prep) — holerite e comprovante de ponto:
-- documentos que o RH anexa (upload de um sistema externo homologado) e o
-- colaborador só consulta/baixa. Reaproveita rh_attachments (mesmo padrão já
-- usado pra documento de admissão em onboarding) — sem tabela nova.
--
-- rh_attachments_self_read cobria só domain='onboarding'; generaliza pra
-- incluir 'holerite' e 'ponto', mesma regra (is_own_colaborador, só SELECT).
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
DROP POLICY IF EXISTS rh_attachments_self_read ON public.rh_attachments;
CREATE POLICY rh_attachments_self_read ON public.rh_attachments
  FOR SELECT USING (
    domain = ANY (ARRAY['onboarding','holerite','ponto'])
    AND is_own_colaborador(record_id)
  );

-- Correção adjacente (achada ao mexer nesta tabela): rh_attachments_rh_access
-- checava profiles.role (cargo ESCALAR), não o array roles — alguém com
-- 'rh'/'gerente_rh' como cargo SECUNDÁRIO não conseguia gerenciar anexo
-- nenhum, mesmo tendo o cargo. Mesma classe de bug já corrigida em outras
-- tabelas (cotações de marketing, etc.) — alinha ao padrão
-- current_user_is_admin()/current_user_has_role().
DROP POLICY IF EXISTS rh_attachments_rh_access ON public.rh_attachments;
CREATE POLICY rh_attachments_rh_access ON public.rh_attachments
  FOR ALL USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  )
  WITH CHECK (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );
