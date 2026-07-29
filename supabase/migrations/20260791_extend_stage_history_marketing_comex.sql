-- Estende rh_stage_history (histórico de etapa genérico, migration
-- 20260715) pros domínios de Marketing (Campanhas/Entregas/Tarefas/
-- Compras) e Comex — mesma tabela/hook/aba "Histórico" que já serve os 6
-- domínios de RH, reaproveitando o trigger genérico log_rh_stage_change()
-- em vez de criar tabela nova. Parte da unificação dos modais de card
-- (abas no centro + histórico real, pedido do Daniel).
--
-- Comex é bônus fora do pedido original: já passava domain="comex" pro
-- mesmo RHDetailDrawerShell/useRHStageHistory que os demais, mas 'comex'
-- nunca esteve no CHECK — a aba Histórico dele sempre esteve vazia,
-- silenciosamente, porque nenhuma linha com esse domain jamais foi aceita.

ALTER TABLE public.rh_stage_history
  DROP CONSTRAINT rh_stage_history_domain_check,
  ADD CONSTRAINT rh_stage_history_domain_check
    CHECK (domain = ANY (ARRAY[
      'vagas','candidatos','onboarding','feedback','ferias','treinamentos',
      'marketing','marketing_deliverables','marketing_tasks','marketing_purchase_requests',
      'comex'
    ]));

CREATE POLICY rh_stage_history_marketing_access ON public.rh_stage_history
  FOR ALL
  USING (current_user_is_marketing() AND domain IN ('marketing','marketing_deliverables','marketing_tasks','marketing_purchase_requests'))
  WITH CHECK (current_user_is_marketing() AND domain IN ('marketing','marketing_deliverables','marketing_tasks','marketing_purchase_requests'));

CREATE POLICY rh_stage_history_comex_access ON public.rh_stage_history
  FOR ALL
  USING (current_user_is_comex() AND domain = 'comex')
  WITH CHECK (current_user_is_comex() AND domain = 'comex');

CREATE TRIGGER trg_log_campaign_stage_change
  AFTER INSERT OR UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('marketing', 'stage');

CREATE TRIGGER trg_log_deliverable_stage_change
  AFTER INSERT OR UPDATE ON public.marketing_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('marketing_deliverables', 'stage');

CREATE TRIGGER trg_log_task_stage_change
  AFTER INSERT OR UPDATE ON public.marketing_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('marketing_tasks', 'stage');

CREATE TRIGGER trg_log_purchase_request_stage_change
  AFTER INSERT OR UPDATE ON public.marketing_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('marketing_purchase_requests', 'stage');

CREATE TRIGGER trg_log_comex_import_stage_change
  AFTER INSERT OR UPDATE ON public.comex_import_operations
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('comex', 'stage');

CREATE TRIGGER trg_log_comex_export_stage_change
  AFTER INSERT OR UPDATE ON public.comex_export_operations
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('comex', 'stage');
