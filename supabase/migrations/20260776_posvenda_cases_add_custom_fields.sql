-- P1.3 da auditoria Zero Bullshit: o gear "Editar fase" do Pós-venda já grava
-- campos configurados por etapa em rh_pipeline_stage_fields (domain
-- "posvenda"), mas posvenda_cases não tinha onde persistir os valores
-- preenchidos — QuickAddCaseModal/PosVendaDetailModal ignoravam a config.
ALTER TABLE public.posvenda_cases ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
