-- Pipeline oficial usa 'ganho' (não 'fechado') desde o redesign de 7 etapas
-- (src/constants/pipelines.js). O CHECK estava aceitando 'fechado' e
-- rejeitando 'ganho', quebrando a etapa "Negócio Fechado".
ALTER TABLE public.leads DROP CONSTRAINT leads_stage_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_stage_check
  CHECK (stage = ANY (ARRAY['prospeccao'::text, 'qualificacao'::text, 'visitas'::text, 'amostras'::text, 'negociacao'::text, 'ganho'::text, 'perdido'::text]));

ALTER TABLE public.leads DROP CONSTRAINT leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY['prospeccao'::text, 'qualificacao'::text, 'visitas'::text, 'amostras'::text, 'negociacao'::text, 'ganho'::text, 'perdido'::text]));
