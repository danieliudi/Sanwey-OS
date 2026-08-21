-- Achado 20/08/2026 (Beehave reportou perda de acesso a Entregas): a
-- migration desta sessão sec_agencia_sees_supplier_failclosed removeu o
-- fallback fail-open de agencia_sees_supplier() — correto, era uma
-- exposição real (qualquer login agencia via TODAS as entregas de TODOS os
-- fornecedores, não só as próprias). Mas marketing_campaigns.supplier_id
-- nunca foi preenchido (0 de 2 campanhas) e a maioria das entregas (13/15)
-- nem tem campanha vinculada — então agencia_sees_supplier() nunca mais
-- teria como retornar true por esse caminho, pra ninguém.
--
-- O vínculo real "esta entrega é da agência tal" já existe e é usado
-- ativamente: marketing_deliverables.assignee/assignee_ids (2 entregas da
-- Beehave já estão corretamente atribuídas lá). Esse caminho nunca fez
-- parte da policy — o "vê tudo" de antes era só efeito colateral do
-- fail-open, não vinha do assignee. Adiciona esse caminho, mantendo o
-- resto da policy idêntico.
--
-- Débito conhecido, não coberto aqui: deliverable_checklists e os storage
-- policies de anexos de entrega/campanha ainda só têm o caminho por
-- agencia_sees_supplier() (mesmo problema estrutural) — deixados de fora
-- desta migration de propósito, pra não mexer em 7 arquivos de policy sob
-- pressão. A entrega em si já ficar visível resolve o essencial reportado;
-- se a Beehave precisar abrir checklist/anexo de uma entrega seguindo esse
-- mesmo padrão, precisa da mesma correção lá.
DROP POLICY IF EXISTS deliverables_select ON public.marketing_deliverables;
CREATE POLICY deliverables_select ON public.marketing_deliverables FOR SELECT USING (
  current_user_is_admin()
  OR (current_user_is_marketing() AND (company_ids && current_user_companies()))
  OR agencia_sees_supplier((SELECT marketing_campaigns.supplier_id FROM marketing_campaigns WHERE marketing_campaigns.id = marketing_deliverables.campaign_id))
  OR (current_user_roles() && array['agencia']::text[] AND (assignee = auth.uid() OR assignee_ids @> array[auth.uid()]))
);

DROP POLICY IF EXISTS md_update ON public.marketing_deliverables;
CREATE POLICY md_update ON public.marketing_deliverables FOR UPDATE USING (
  current_user_is_admin()
  OR (current_user_is_marketing() AND (company_ids && current_user_companies()))
  OR agencia_sees_supplier((SELECT marketing_campaigns.supplier_id FROM marketing_campaigns WHERE marketing_campaigns.id = marketing_deliverables.campaign_id))
  OR (current_user_roles() && array['agencia']::text[] AND (assignee = auth.uid() OR assignee_ids @> array[auth.uid()]))
);
