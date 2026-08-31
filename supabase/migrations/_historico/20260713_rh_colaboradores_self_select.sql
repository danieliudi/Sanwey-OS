-- Achado crítico da auditoria: rh_colaboradores só tinha uma policy (ALL,
-- restrita a admin/gerente_rh/rh). Sem SELECT pra própria linha, todo
-- colaborador comum ficava sem acesso à própria linha — e como
-- rh_avaliacoes_read / rh_treinamento_atrib_read decidem "isso é meu?" via
-- EXISTS (SELECT 1 FROM rh_colaboradores WHERE profile_id = auth.uid()),
-- essa subquery nunca resolvia true pra ele. Resultado prático: colaborador
-- não via as próprias avaliações, treinamentos atribuídos nem o checklist
-- de onboarding. Adiciona SELECT (só leitura, só da própria linha).
CREATE POLICY rh_colaboradores_self_select
  ON public.rh_colaboradores
  FOR SELECT
  USING (profile_id = (SELECT auth.uid()));
