-- Importante da auditoria: agent_actions tem company_id, mas
-- agent_actions_manager_all concedia ALL a gerente/admin sem nenhum escopo
-- de empresa — diferente de leads (que já escopa gerente por
-- company_id=ANY(current_user_companies())), um gerente de uma empresa lia
-- e alterava ações de agente (payload, lead_id, resolução) da outra.
DROP POLICY IF EXISTS agent_actions_manager_all ON public.agent_actions;
CREATE POLICY agent_actions_manager_all
  ON public.agent_actions
  FOR ALL
  USING (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND (company_id IS NULL OR company_id = ANY (current_user_companies())))
  )
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND (company_id IS NULL OR company_id = ANY (current_user_companies())))
  );
