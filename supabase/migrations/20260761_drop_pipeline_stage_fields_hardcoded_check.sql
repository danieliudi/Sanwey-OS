-- Mesmo problema de leads_stage_check (ver 20260760): pipeline_stage_fields_stage_id_check
-- hardcoda os 7 stage_key originais, travando silenciosamente o editor de
-- campos customizados ("Editar campos desta etapa") pra qualquer etapa
-- criada via "Editar etapas". stage_id já é validado pela existência real da
-- etapa em rh_pipeline_stages (domain='comercial'), não precisa de uma CHECK
-- hardcoded duplicando essa lista.
alter table pipeline_stage_fields drop constraint if exists pipeline_stage_fields_stage_id_check;
