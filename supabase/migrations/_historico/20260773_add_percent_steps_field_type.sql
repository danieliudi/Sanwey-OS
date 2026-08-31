-- Adiciona o tipo "percent_steps" (progresso em degraus 0/20/40/60/80/100,
-- botões em vez de input livre) ao catálogo genérico de campos por etapa —
-- pré-requisito pra migrar o formulário fixo de Entregas (STAGE_FIELDS,
-- DeliverableDetailDrawer.jsx) pro sistema dinâmico de "Editar campos desta
-- etapa" (rh_pipeline_stage_fields), unificando os dois formulários
-- paralelos que hoje existem pra Entregas.
--
-- Diferente dos CHECKs de domain/stage_key (dropados nas migrations
-- 20260760/61/63 — duplicavam a existência real de linhas em outra tabela),
-- este CHECK é uma enumeração fechada de verdade (não existe "tabela de
-- tipos válidos" em lugar nenhum), então o padrão certo aqui é estender a
-- lista, não derrubar o CHECK.
ALTER TABLE public.rh_pipeline_stage_fields DROP CONSTRAINT IF EXISTS rh_pipeline_stage_fields_field_type_check;
ALTER TABLE public.rh_pipeline_stage_fields ADD CONSTRAINT rh_pipeline_stage_fields_field_type_check
  CHECK (field_type in ('text','textarea','number','currency','date','datetime','time','email','phone','url','checkbox','select','radio','multicheck','user','percent_steps'));
