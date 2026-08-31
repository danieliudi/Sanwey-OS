-- Mesma classe de bug já corrigida em 20260760/20260761 (leads_stage_check,
-- pipeline_stage_fields_stage_id_check): rh_pipeline_stages é a tabela
-- explicitamente compartilhada/configurável entre domínios (CLAUDE.md seção
-- 5 — "domain = 'comercial' pro Pipeline, outros valores por módulo"), mas
-- tinha um CHECK hardcoded enumerando só os domínios já existentes na época
-- em que foi criada, bloqueando silenciosamente qualquer domínio novo
-- (encontrado ao tentar inserir etapas pro novo domain='marketing_tasks').
ALTER TABLE public.rh_pipeline_stages DROP CONSTRAINT IF EXISTS rh_pipeline_stages_domain_check;
