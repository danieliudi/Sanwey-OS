-- Agent Builder Fase 2 (Vaga parada — Recrutamento). Aprovado por Daniel em
-- 29/07/2026 (respostas 1-6 ao plano proposto na sessão) — mesmo padrão do
-- piloto Fornecedores RH (20260780_agent_builder_fase1_schema.sql), previsto
-- desde então: "Fase 2 adiciona rh-recrutamento/rh-onboarding quando chegar
-- a hora, não agora". Chegou.
--
-- Único ajuste de schema necessário: o CHECK de automations.module só
-- aceitava crm/marketing/universal/rh-fornecedores. rh_vagas já tem tudo
-- que o piloto precisa (stage, stage_changed_at, department, hiring_deadline)
-- — nenhuma tabela/coluna nova.

alter table automations drop constraint if exists automations_module_check;
alter table automations add constraint automations_module_check
  check (module = any (array['crm','marketing','universal','rh-fornecedores','rh-vagas']));
