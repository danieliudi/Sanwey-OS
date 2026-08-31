-- Agent Builder Fase 3 (Sourcing interno — IA no banco de talentos). Escopo
-- confirmado por Daniel: só cron diário (sem trigger por evento), contexto
-- completo (badge + link + notificação) na tela de Agentes de IA desde a v1.
--
-- Único ajuste de schema necessário: o CHECK de automations.module ainda não
-- aceitava rh-sourcing. rh_candidatos/rh_vagas já têm tudo que o piloto
-- precisa (frente_origem, cv_texto_extraido, company_ids) — nenhuma
-- tabela/coluna nova.

alter table automations drop constraint if exists automations_module_check;
alter table automations add constraint automations_module_check
  check (module = any (array['crm','marketing','universal','rh-fornecedores','rh-vagas','rh-sourcing']));
