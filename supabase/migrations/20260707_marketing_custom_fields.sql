-- Marketing (Campanhas/Entregas) ainda não tinha custom_fields — pré-requisito
-- pra ter campo-por-fase dinâmico (rh_pipeline_stage_fields, domain=
-- 'marketing'/'marketing_deliverables', já semeado com a identidade das
-- etapas) e pro enforcement de obrigatoriedade valer aqui também.
alter table public.marketing_campaigns add column if not exists custom_fields jsonb not null default '{}';
alter table public.marketing_deliverables add column if not exists custom_fields jsonb not null default '{}';
