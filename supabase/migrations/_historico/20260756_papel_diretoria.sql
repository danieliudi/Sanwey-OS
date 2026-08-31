-- Papel Diretoria (reunião com o RH, 20/07 + pedido seguinte do usuário):
-- "criar um perfil de usuário para Diretoria, em que possam ver tudo da
-- plataforma, mas não podem preencher nem alterar nada." A única exceção é
-- interação mais rica no Painel Executivo (tratada no front, não aqui).
--
-- Estratégia de baixo risco: toda policy de escrita (INSERT/UPDATE/DELETE ou
-- FOR ALL) neste projeto é uma allow-list por papel — nunca inclui
-- 'diretoria' em lugar nenhum, então o bloqueio de escrita é automático, sem
-- tocar em nenhuma policy existente. Para leitura, em vez de reescrever
-- policies já existentes (risco de regressão), cada tabela ganha uma policy
-- SELECT NOVA e aditiva (`current_user_has_role('diretoria')`) — o Postgres
-- combina policies do mesmo comando com OR, então isso só ADICIONA acesso
-- de leitura pra esse papel, nunca reduz o que os outros papéis já tinham.

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_roles_check,
  ADD CONSTRAINT profiles_roles_check
    CHECK (roles <@ ARRAY['admin','gerente','vendedor','consultor','marketing','gerente_marketing','agencia','rh','gerente_rh','portal','diretoria']::text[]);

-- ── CRM / Comercial ──────────────────────────────────────────────────────────
CREATE POLICY leads_diretoria_read ON public.leads FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY clients_diretoria_read ON public.clients FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY activities_diretoria_read ON public.activities FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY lead_attachments_diretoria_read ON public.lead_attachments FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY lead_checklists_diretoria_read ON public.lead_checklists FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY agent_actions_diretoria_read ON public.agent_actions FOR SELECT USING (current_user_has_role('diretoria'));

-- ── Marketing ────────────────────────────────────────────────────────────────
CREATE POLICY marketing_campaigns_diretoria_read ON public.marketing_campaigns FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_campaign_attachments_diretoria_read ON public.marketing_campaign_attachments FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_deliverables_diretoria_read ON public.marketing_deliverables FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_deliverable_attachments_diretoria_read ON public.marketing_deliverable_attachments FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_expenses_diretoria_read ON public.marketing_expenses FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_purchase_requests_diretoria_read ON public.marketing_purchase_requests FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_requests_diretoria_read ON public.marketing_requests FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_quote_email_template_diretoria_read ON public.marketing_quote_email_template FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_supplier_quotes_diretoria_read ON public.marketing_supplier_quotes FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY marketing_suppliers_diretoria_read ON public.marketing_suppliers FOR SELECT USING (current_user_has_role('diretoria'));

-- ── RH ───────────────────────────────────────────────────────────────────────
-- Inclui campos sensíveis (salário em rh_colaboradores/rh_movimentacoes) —
-- decisão deliberada: o usuário pediu "ver tudo da plataforma" sem exceção
-- de dado, só de interação (ver nota no início do arquivo).
CREATE POLICY rh_colaboradores_diretoria_read ON public.rh_colaboradores FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_vagas_diretoria_read ON public.rh_vagas FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_candidatos_diretoria_read ON public.rh_candidatos FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_aplicacoes_diretoria_read ON public.rh_aplicacoes FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_avaliacoes_diretoria_read ON public.rh_avaliacoes FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_ferias_diretoria_read ON public.rh_ferias FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_treinamento_atrib_diretoria_read ON public.rh_treinamento_atribuicoes FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_onboarding_tarefas_diretoria_read ON public.rh_onboarding_tarefas FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_movimentacoes_diretoria_read ON public.rh_movimentacoes FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_cargo_templates_diretoria_read ON public.rh_cargo_templates FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_checklists_diretoria_read ON public.rh_checklists FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_fornecedores_diretoria_read ON public.rh_fornecedores FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_fornecedor_contratos_diretoria_read ON public.rh_fornecedor_contratos FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_fornecedor_contrato_eventos_diretoria_read ON public.rh_fornecedor_contrato_eventos FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_bemestar_sessoes_diretoria_read ON public.rh_bemestar_sessoes FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_bemestar_fila_diretoria_read ON public.rh_bemestar_fila FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_pesquisas_diretoria_read ON public.rh_pesquisas FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_signature_requests_diretoria_read ON public.rh_signature_requests FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_vaga_manager_links_diretoria_read ON public.rh_vaga_manager_links FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_onboarding_templates_diretoria_read ON public.rh_onboarding_templates FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_stage_history_diretoria_read ON public.rh_stage_history FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_attachments_diretoria_read ON public.rh_attachments FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_colaborador_beneficios_diretoria_read ON public.rh_colaborador_beneficios FOR SELECT USING (current_user_has_role('diretoria'));
CREATE POLICY rh_beneficios_catalogo_diretoria_read ON public.rh_beneficios_catalogo FOR SELECT USING (current_user_has_role('diretoria'));

-- Diretório de perfis (nomes/contato/cargos) — não inclui rh_pesquisa_respostas
-- (fica de fora de propósito: anônima por invariante estrutural, sem SELECT
-- policy nenhuma, nem pra admin — só via RPC de agregação).
CREATE POLICY profiles_diretoria_read ON public.profiles FOR SELECT USING (current_user_has_role('diretoria'));
