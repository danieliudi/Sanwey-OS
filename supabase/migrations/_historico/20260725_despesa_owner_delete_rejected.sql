-- Achado HIGH da 2ª auditoria (fluxo de reembolso é beco sem saída): a policy
-- de DELETE de crm_viagem_despesas só permitia o dono apagar a própria despesa
-- enquanto 'pendente'. Uma vez REJEITADA, o vendedor não podia removê-la nem
-- corrigi-la — ficava travada exibindo só "Rejeitado", inflando o total do mês.
-- Agora o dono também pode apagar a própria despesa 'rejeitado' (pra refazer
-- corrigida). Gestor/admin escopados por empresa continuam podendo apagar
-- qualquer uma (via current_user_manages_viagem_of).
DROP POLICY IF EXISTS "crm_viagem_despesas_delete" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_delete" ON public.crm_viagem_despesas
  FOR DELETE
  USING (
    (vendedor_id = auth.uid() AND status_reembolso IN ('pendente', 'rejeitado'))
    OR current_user_manages_viagem_of(vendedor_id)
  );
