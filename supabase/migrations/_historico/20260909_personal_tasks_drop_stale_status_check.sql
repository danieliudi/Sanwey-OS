-- personal_tasks.status ficou com um CHECK fixo (a_fazer/fazendo/feito) desde a
-- migration original, mesmo depois de personal_task_stages ter introduzido etapas
-- customizáveis por usuário (20260829_personal_tasks_stages_fields_tags_recurrence.sql).
-- Aquela migration já documentava a intenção de não travar o status com CHECK fixo
-- (mesmo motivo do CHECK ter sido removido de rh_pipeline_stages/rh_vagas), mas o
-- DROP CONSTRAINT nunca foi executado — bug real: mover um card pra qualquer etapa
-- custom (ex.: "Treinamentos e Reuniões", "Concluído") falhava silenciosamente no
-- banco, sem nenhum erro visível pro usuário. Reportado pelo Daniel 11/08/2026.
alter table public.personal_tasks drop constraint if exists personal_tasks_status_check;

comment on column public.personal_tasks.status is
  'Chave da etapa (personal_task_stages.stage_key) ou um dos 3 valores default (a_fazer/fazendo/feito) pra quem nunca customizou. Sem CHECK fixo de propósito — etapas são configuráveis por usuário.';
