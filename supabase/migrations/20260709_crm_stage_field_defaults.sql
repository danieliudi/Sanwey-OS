-- Campos padrão por etapa no pipeline Comercial (pipeline_stage_fields,
-- tabela legada usada pelo CRMView) — inspirados em práticas de mercado
-- (Pipedrive "required fields", Salesforce "Next Step", HubSpot loss-reason
-- dropdown obrigatório): "próximo passo" evita negócio parado sem dono,
-- valor/data/decisor evitam negociação sem informação básica, motivo de
-- ganho/perda vira dado estruturado (select) em vez de texto livre.
-- Continuam editáveis/removíveis pelo admin via "Editar fase" no CRMView.

INSERT INTO public.pipeline_stage_fields (company_id, stage_id, field_key, field_type, label, required, order_idx, help_text)
VALUES
  ('industria', 'prospeccao',  'proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('industria', 'qualificacao','proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('industria', 'visitas',     'proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('industria', 'amostras',    'proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('industria', 'negociacao',  'proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('industria', 'negociacao',  'valor', 'currency', 'Valor do negócio', true, 1, null),
  ('industria', 'negociacao',  'data_fechamento', 'date', 'Previsão de fechamento', true, 2, null),
  ('industria', 'negociacao',  'contato_decisor', 'text', 'Contato do decisor', true, 3, null),
  ('industria', 'ganho',       'motivo_ganho', 'select', 'Motivo do ganho', false, 0, 'Opcional — não bloqueia, é só pra relatório (etapas terminais não travam saída).'),
  ('industria', 'perdido',     'motivo_perda', 'select', 'Motivo da perda', false, 0, 'Opcional — não bloqueia, é só pra relatório (etapas terminais não travam saída).'),

  ('resibag', 'prospeccao',  'proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('resibag', 'qualificacao','proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('resibag', 'visitas',     'proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('resibag', 'amostras',    'proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('resibag', 'negociacao',  'proximo_passo', 'text', 'Próximo passo', true, 0, null),
  ('resibag', 'negociacao',  'valor', 'currency', 'Valor do negócio', true, 1, null),
  ('resibag', 'negociacao',  'data_fechamento', 'date', 'Previsão de fechamento', true, 2, null),
  ('resibag', 'negociacao',  'contato_decisor', 'text', 'Contato do decisor', true, 3, null),
  ('resibag', 'ganho',       'motivo_ganho', 'select', 'Motivo do ganho', false, 0, 'Opcional — não bloqueia, é só pra relatório (etapas terminais não travam saída).'),
  ('resibag', 'perdido',     'motivo_perda', 'select', 'Motivo da perda', false, 0, 'Opcional — não bloqueia, é só pra relatório (etapas terminais não travam saída).')
ON CONFLICT (company_id, stage_id, field_key) DO NOTHING;

UPDATE public.pipeline_stage_fields SET options = '["Preço competitivo","Relacionamento","Qualidade do produto/amostra","Prazo de entrega","Outro"]'::jsonb
WHERE field_key = 'motivo_ganho';

UPDATE public.pipeline_stage_fields SET options = '["Preço","Concorrência","Sem orçamento","Não é decisor","Timing","Outro"]'::jsonb
WHERE field_key = 'motivo_perda';
