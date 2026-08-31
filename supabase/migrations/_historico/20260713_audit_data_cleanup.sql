-- Limpeza de dados — 3 achados menores da auditoria completa.

-- 1. marketing_deliverables tinha 4 colunas de nível superior nunca lidas
--    nem escritas pelo app (use-marketing-deliverables.js) — os mesmos
--    dados (quando existem) já ficam dentro de stage_data (jsonb), via o
--    formulário fixo por etapa do DeliverableDetailDrawer.jsx.
ALTER TABLE public.marketing_deliverables
  DROP COLUMN IF EXISTS request_type,
  DROP COLUMN IF EXISTS request_date,
  DROP COLUMN IF EXISTS request_status,
  DROP COLUMN IF EXISTS observations;

-- 2. pipeline_stage_fields tinha linhas órfãs pra "montemor", empresa
--    descontinuada (COMPANY_IDS só tem industria/resibag) — nunca batem
--    no lookup companyId::stageId, são inertes.
DELETE FROM public.pipeline_stage_fields WHERE company_id = 'montemor';

-- 3. 1 lead órfão com owner apontando pra um profile que não existe mais —
--    ficava invisível pra qualquer vendedor (RLS não casa) e só aparecia
--    pra gerente/admin. Desatribui (fica como "sem responsável", visível e
--    reatribuível por qualquer vendedor, igual a um lead novo).
UPDATE public.leads
SET owner = NULL
WHERE id = 'lead_1780061932925_foq7y' AND owner = '7c5557ac-8291-4fff-860f-8e85fe81a7c6';
