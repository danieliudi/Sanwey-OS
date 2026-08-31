-- Bug real reportado pelo Daniel (11/08/2026): "new row violates row-level
-- security policy for table crm_viagem_despesas" ao tentar lançar despesa.
--
-- Investigação: RLS está habilitada na tabela, mas hoje só existe a policy
-- de SELECT (crm_viagem_despesas_read) — nenhuma de INSERT/UPDATE/DELETE.
-- As migrations 20260706_crm_viagens_reembolsos.sql,
-- 20260724_scope_crm_viagens_by_company.sql e
-- 20260725_despesa_owner_delete_rejected.sql já definiam essas 3 policies
-- (a última reescrita, escopada por empresa via current_user_manages_viagem_of,
-- igual à tabela-irmã crm_viagem_registros) — mas elas não existem no banco
-- ao vivo hoje, então todo lançamento/edição/exclusão de despesa está
-- quebrado pra qualquer usuário desde que essas migrations deveriam ter
-- entrado em vigor. Esta migration restaura exatamente o estado final já
-- revisado (mesmo predicado das duas migrations acima, sem nenhuma mudança
-- de regra) — não é uma decisão nova de design, é reparar uma lacuna real.

DROP POLICY IF EXISTS "crm_viagem_despesas_insert" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_insert" ON public.crm_viagem_despesas
  FOR INSERT
  WITH CHECK (
    (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
    OR current_user_manages_viagem_of(vendedor_id)
  );

DROP POLICY IF EXISTS "crm_viagem_despesas_update" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_update" ON public.crm_viagem_despesas
  FOR UPDATE
  USING (
    (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
    OR current_user_manages_viagem_of(vendedor_id)
  )
  WITH CHECK (
    (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
    OR current_user_manages_viagem_of(vendedor_id)
  );

DROP POLICY IF EXISTS "crm_viagem_despesas_delete" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_delete" ON public.crm_viagem_despesas
  FOR DELETE
  USING (
    (vendedor_id = auth.uid() AND status_reembolso IN ('pendente', 'rejeitado'))
    OR current_user_manages_viagem_of(vendedor_id)
  );
