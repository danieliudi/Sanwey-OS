-- Agência (Beehave) via etapa/campos em branco e sem conseguir preencher
-- nada em Entregas — canWrite no front (use-marketing-deliverables.js) já
-- excluía o papel "agencia" de tudo, e md_update aqui no banco (ainda no
-- estado original de 20260610, nunca revisitado) também: só
-- current_user_is_marketing() passava. Pedido do Daniel (30/07/2026): a
-- agência produz a entrega, então precisa preencher campos da etapa,
-- responsáveis, checklist, anexos, título e mover de etapa — igual ao time
-- de Marketing. Escolha confirmada: paridade de UPDATE, exceto excluir —
-- md_delete e md_insert (criar/duplicar entrega) continuam só marketing/
-- admin, sem mudança aqui.
--
-- Reaproveita agencia_sees_supplier() (20260718) em vez de checar
-- role='agencia' puro, pra ficar simétrico com deliverables_select — mesmo
-- escopo por fornecedor (hoje sem efeito prático com uma agência só
-- cadastrada, mas evita reabrir esse mesmo furo quando houver mais de uma).
DROP POLICY IF EXISTS md_update ON public.marketing_deliverables;
CREATE POLICY md_update ON public.marketing_deliverables FOR UPDATE USING (
  public.current_user_is_marketing()
  OR agencia_sees_supplier((SELECT supplier_id FROM public.marketing_campaigns WHERE id = campaign_id))
);
