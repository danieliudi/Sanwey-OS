-- Migra o formulário fixo de Entregas (STAGE_FIELDS, hardcoded em
-- DeliverableDetailDrawer.jsx) pro sistema dinâmico de "Editar campos desta
-- etapa" (rh_pipeline_stage_fields, domain='marketing_deliverables') —
-- unificando os dois formulários paralelos que hoje coexistem por etapa em
-- Entregas (achado: "Editar campos desta etapa" só editava um formulário
-- secundário "Campos adicionais", nunca os campos que o usuário via
-- primeiro/de verdade na tela).
--
-- field_key idêntico ao STAGE_FIELDS[stage][i].key original — a migration
-- seguinte (20260775) copia os valores já salvos em marketing_deliverables.
-- stage_data pra dentro de custom_fields usando essa mesma chave.
--
-- "Responsável pela Solicitação" (STAGE_FIELDS.solicitacao.assignee) NÃO
-- entra aqui: vira um campo geral "Responsáveis" no drawer (assignee_ids,
-- coluna já existente), igual ao padrão já usado em Tarefas de Marketing —
-- sem isso, o responsável só era editável enquanto o card estivesse na
-- etapa "Solicitação", o que já era uma limitação real do formulário fixo.
--
-- revision_needed era radio_bool (true/false) no formulário fixo; aqui vira
-- radio com opções "Sim"/"Não" — não precisa de um tipo novo só pra isso.
insert into public.rh_pipeline_stage_fields
  (domain, stage_key, field_key, field_type, label, required, options, order_idx, help_text)
values
  -- Solicitação
  ('marketing_deliverables', 'solicitacao', 'request_type',   'select',   'Tipo de Solicitação',   true,  '["Design","Vídeo","Copywriting","Social Media","Email Marketing","Apresentação","Landing Page","Outro"]', 0, 'Selecione o tipo de solicitação.'),
  ('marketing_deliverables', 'solicitacao', 'request_date',   'date',     'Data de Solicitação',   true,  '[]', 1, 'Data em que a solicitação foi feita.'),
  ('marketing_deliverables', 'solicitacao', 'request_status', 'radio',    'Status da Solicitação', false, '["Pendente","Em andamento","Concluído"]', 2, 'Status atual da solicitação.'),
  ('marketing_deliverables', 'solicitacao', 'observations',   'textarea', 'Observações',           false, '[]', 3, 'Observações adicionais.'),

  -- Em Produção
  ('marketing_deliverables', 'em_producao', 'production_stage',      'select',        'Etapa Atual',                true,  '["Planejamento","Desenvolvimento","Finalização"]', 0, 'Etapa atual do processo de produção.'),
  ('marketing_deliverables', 'em_producao', 'production_start_date', 'date',          'Data de Início da Produção', true,  '[]', 1, 'Data em que a produção foi iniciada.'),
  ('marketing_deliverables', 'em_producao', 'production_resources',  'textarea',      'Recursos Alocados',          false, '[]', 2, 'Liste os recursos alocados.'),
  ('marketing_deliverables', 'em_producao', 'production_progress',   'percent_steps', 'Progresso Atual (%)',        true,  '[]', 3, 'Progresso atual em porcentagem.'),
  ('marketing_deliverables', 'em_producao', 'production_risks',      'multicheck',    'Riscos Identificados',       false, '["Falta de materiais","Problemas técnicos","Atrasos na entrega","Outros"]', 4, 'Riscos que podem impactar a produção.'),

  -- Revisão — order_idx começa em 1: "link_preview" já existe nesta etapa
  -- desde 20260709_recrutamento_onboarding_marketing_stage_defaults.sql,
  -- ocupando order_idx 0.
  ('marketing_deliverables', 'revisao', 'revision_needed',   'radio',    'Revisão Necessária',       true,  '["Sim","Não"]', 1, 'A revisão é necessária para esta etapa?'),
  ('marketing_deliverables', 'revisao', 'revision_date',     'date',     'Data de Revisão',          true,  '[]', 2, 'Data em que a revisão será realizada.'),
  ('marketing_deliverables', 'revisao', 'revision_assignee', 'user',     'Responsável pela Revisão', true,  '[]', 3, 'Selecione o responsável pela revisão.'),
  ('marketing_deliverables', 'revisao', 'revision_comments', 'textarea', 'Comentários da Revisão',   false, '[]', 4, 'Comentários ou observações sobre a revisão.'),
  ('marketing_deliverables', 'revisao', 'revision_status',   'select',   'Status da Revisão',        true,  '["Aprovado","Reprovado","Pendente de aprovação"]', 5, 'Status atual da revisão.'),

  -- Entregue
  ('marketing_deliverables', 'entregue', 'delivery_date',        'date',     'Data de Entrega',          true,  '[]', 0, 'Data em que foi entregue.'),
  ('marketing_deliverables', 'entregue', 'delivery_assignee',    'user',     'Responsável pela Entrega', false, '[]', 1, 'Responsável pela entrega.'),
  ('marketing_deliverables', 'entregue', 'delivery_approved_by', 'text',     'Aprovado por',             false, '[]', 2, 'Nome de quem aprovou a entrega.'),
  ('marketing_deliverables', 'entregue', 'delivery_comments',    'textarea', 'Comentários Finais',       false, '[]', 3, 'Observações finais sobre a entrega.')
on conflict (domain, company_id, stage_key, field_key) do nothing;
