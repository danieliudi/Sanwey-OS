-- Redesign dos campos por etapa de Entregas (domain='marketing_deliverables'),
-- pedido do Daniel com mockup de referência por etapa. Volume de dado real
-- hoje é mínimo (poucos registros nessas 3 etapas) — substituição direta dos
-- campos antigos por completo, em vez de tentar mapear campo a campo.
--
-- "Link/arquivo final", "Versão entregue para revisão" e "Nova versão
-- pós-ajustes" apareciam no mockup como upload — a plataforma já tem uma
-- aba "Anexos" própria (upload de verdade) separada dos campos de etapa;
-- decisão confirmada com o Daniel foi usar campo de link (mesmo padrão já
-- usado em "link_preview" nesta mesma etapa antes), não inventar um tipo de
-- campo novo de arquivo.

-- Encaminhado à Agência: troca "Falta alguma informação?"/"Insira aqui..."
-- por SLA combinado + Brief validado + Observações de triagem.
DELETE FROM public.rh_pipeline_stage_fields
WHERE domain = 'marketing_deliverables' AND stage_key = 'encaminhado_para_agencia';

INSERT INTO public.rh_pipeline_stage_fields (domain, stage_key, field_key, label, field_type, required, help_text, order_idx, options) VALUES
  ('marketing_deliverables', 'encaminhado_para_agencia', 'sla_combinado',       'SLA combinado (data)',    'datetime', true,  'Prazo acordado com solicitante',            0, '[]'::jsonb),
  ('marketing_deliverables', 'encaminhado_para_agencia', 'brief_validado',      'Brief validado?',          'select',   true,  '',                                           1, '["Sim","Não"]'::jsonb),
  ('marketing_deliverables', 'encaminhado_para_agencia', 'observacoes_triagem', 'Observações de triagem',   'textarea', false, 'Pendências, dúvidas ou escopo a ajustar',   2, '[]'::jsonb);

-- Em Produção: troca o formulário fixo de produção por um checklist simples
-- + link da versão entregue pra revisão.
DELETE FROM public.rh_pipeline_stage_fields
WHERE domain = 'marketing_deliverables' AND stage_key = 'em_producao';

INSERT INTO public.rh_pipeline_stage_fields (domain, stage_key, field_key, label, field_type, required, help_text, order_idx, options) VALUES
  ('marketing_deliverables', 'em_producao', 'checklist_producao',       'Checklist de produção',          'multicheck', false, '',                                                          0, '["Brief lido","Padrões de marca aplicados","Revisão interna feita"]'::jsonb),
  ('marketing_deliverables', 'em_producao', 'versao_entregue_revisao',  'Versão entregue para revisão',   'url',        false, 'Link do Drive/Figma/Canva com a versão pronta pra revisão', 1, '[]'::jsonb);

-- Revisão -> "Revisão e Aprovação": troca o fluxo de revisão antigo por
-- aprovador + decisão + comentários + nova versão pós-ajustes.
UPDATE public.rh_pipeline_stages
SET name = 'Revisão e Aprovação'
WHERE domain = 'marketing_deliverables' AND stage_key = 'revisao';

DELETE FROM public.rh_pipeline_stage_fields
WHERE domain = 'marketing_deliverables' AND stage_key = 'revisao';

INSERT INTO public.rh_pipeline_stage_fields (domain, stage_key, field_key, label, field_type, required, help_text, order_idx, options) VALUES
  ('marketing_deliverables', 'revisao', 'aprovador_responsavel',   'Aprovador responsável',     'text',     true,  '',                                              0, '[]'::jsonb),
  ('marketing_deliverables', 'revisao', 'decisao_aprovacao',       'Decisão de aprovação',       'select',   true,  '',                                              1, '["Aprovado","Reprovado","Pendente de aprovação"]'::jsonb),
  ('marketing_deliverables', 'revisao', 'comentarios_aprovador',   'Comentários do aprovador',   'textarea', false, '',                                              2, '[]'::jsonb),
  ('marketing_deliverables', 'revisao', 'nova_versao_pos_ajustes', 'Nova versão pós-ajustes',    'url',      false, 'Link da nova versão após os ajustes solicitados', 3, '[]'::jsonb);

-- Entregue: troca "Responsável pela Entrega"/"Aprovado por" por link final +
-- data de entrega efetiva + feedback do solicitante.
DELETE FROM public.rh_pipeline_stage_fields
WHERE domain = 'marketing_deliverables' AND stage_key = 'entregue';

INSERT INTO public.rh_pipeline_stage_fields (domain, stage_key, field_key, label, field_type, required, help_text, order_idx, options) VALUES
  ('marketing_deliverables', 'entregue', 'link_arquivo_final',      'Link/arquivo final',        'url',      false, '', 0, '[]'::jsonb),
  ('marketing_deliverables', 'entregue', 'data_entrega_efetiva',    'Data de entrega efetiva',   'date',     true,  '', 1, '[]'::jsonb),
  ('marketing_deliverables', 'entregue', 'feedback_solicitante',    'Feedback do solicitante',   'textarea', false, '', 2, '[]'::jsonb);
