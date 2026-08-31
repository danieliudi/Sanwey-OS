-- Pedido do Daniel (29/07/2026): "Preciso poder deletar cargos e salários e
-- movimentações." Investigação encontrou dois problemas distintos:
--
-- 1) Excluir Cargo já existe na UI/hook desde a tarefa #203, mas a policy
--    de RLS (rh_cargo_templates_rh_access, 20260703_rh_vagas_kanban.sql)
--    ainda lê a coluna escalar legada profiles.role em vez do array
--    profiles.roles — funciona só pra quem tem admin/gerente_rh/rh como
--    cargo PRINCIPAL, falha silenciosamente (RLS bloqueia, 0 linhas) pra
--    quem acumulou isso como cargo secundário (o cenário que a Fase 1 de
--    multi-cargo, 20260714_profiles_multi_role_foundation.sql, existe pra
--    cobrir). current_user_is_rh() já é o helper certo, array-aware, com
--    exatamente o mesmo conjunto de papéis (rh/gerente_rh/admin).
--
-- 2) Excluir Movimentação nunca existiu em nenhuma camada — sem função no
--    hook, sem botão na UI, sem policy de DELETE na tabela. Adiciono a
--    policy aqui; hook e UI são a parte de frontend desta mesma mudança.

DROP POLICY IF EXISTS rh_cargo_templates_rh_access ON public.rh_cargo_templates;
CREATE POLICY rh_cargo_templates_rh_access ON public.rh_cargo_templates
  FOR ALL
  USING (current_user_is_rh())
  WITH CHECK (current_user_is_rh());

DROP POLICY IF EXISTS rh_movimentacoes_delete ON public.rh_movimentacoes;
CREATE POLICY rh_movimentacoes_delete ON public.rh_movimentacoes
  FOR DELETE USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );
