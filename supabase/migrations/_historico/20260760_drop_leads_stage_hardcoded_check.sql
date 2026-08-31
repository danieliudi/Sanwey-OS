-- leads_stage_check / leads_status_check hardcoded os 7 valores originais do
-- pipeline comercial (prospeccao/qualificacao/.../ganho/perdido). Isso trava
-- silenciosamente qualquer etapa CUSTOM criada via "Editar etapas" (Pipeline
-- > StageEditorModal): a etapa nova persiste em rh_pipeline_stages e aparece
-- no Kanban, mas mover um lead pra ela é rejeitado pelo Postgres — a
-- constraint nunca foi atualizada quando etapas customizadas passaram a
-- existir. A fonte de verdade real do que é uma etapa válida já é
-- rh_pipeline_stages (domain='comercial'), configurável por empresa — uma
-- CHECK hardcoded na tabela leads duplica e conflita com essa config.
alter table leads drop constraint if exists leads_stage_check;
alter table leads drop constraint if exists leads_status_check;
