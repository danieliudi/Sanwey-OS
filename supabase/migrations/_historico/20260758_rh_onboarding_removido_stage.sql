-- "Excluir" no Kanban de Onboarding não é mais hard delete (ver
-- RHOnboardingView.jsx, handleRemoveFromOnboarding) — move o colaborador pra
-- uma etapa terminal em vez de apagar o cadastro. Usar a etapa terminal
-- existente "concluido" (terminal=true, lost=false) pra isso poluiria a
-- métrica "Tempo médio de onboarding" do Painel de Insights
-- (use-insights-metrics.js:172-177 já usa terminal && !lost como critério de
-- "conclusão com sucesso") — um colaborador removido por engano/duplicidade
-- passaria a contar como onboarding concluído com sucesso em N dias.
--
-- Mesmo padrão já usado no domain 'candidatos' (etapa terminal+lost
-- "reprovado", ver 20260709_recrutamento_onboarding_marketing_stage_defaults.sql):
-- nova etapa terminal, mas com lost=true, pra sair do cálculo de sucesso
-- automaticamente (o filtro já é `terminal && !lost`, sem precisar mexer no
-- hook de métricas) e ganhar o selo visual de "saída" (X vermelho) que
-- RHKanbanCard.jsx já renderiza pra qualquer stage com lost=true.
-- order_idx 6: "concluido" já estava em 5 neste ambiente (reordenada em
-- algum momento via "Editar etapas"), não no 4 original desta tabela — não
-- assume posição fixa, só vem depois dela.
INSERT INTO public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, terminal, won, lost)
VALUES ('onboarding', 'all', 'removido', 'Removido', '#DC2626', 6, true, false, true)
ON CONFLICT (domain, company_id, stage_key) DO NOTHING;
