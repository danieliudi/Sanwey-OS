-- Item 7 (backlog 28/07/2026): Tarefas de Marketing não tinha nenhum campo
-- por etapa configurado — mecanismo "Editar campos desta etapa"
-- (rh_pipeline_stage_fields, domain='marketing_tasks') já está plugado em
-- MarketingTarefasView.jsx desde P1.2/P1.6, só faltava o dado. Mesmo padrão
-- de gate de qualidade que Campanhas/Entregas já usam por etapa (campo
-- obrigatório trava a transição via enforcement real, ver
-- use-stage-fields.js). "A Fazer" fica sem campo adicional — é a etapa de
-- entrada, nada a exigir ainda.
insert into public.rh_pipeline_stage_fields
  (domain, stage_key, field_key, field_type, label, required, options, order_idx, help_text)
values
  ('marketing_tasks', 'em_andamento', 'real_start_date', 'date',     'Data de início real',        true, '[]', 0, 'Quando o trabalho de fato começou — trava a transição sem essa data.'),
  ('marketing_tasks', 'concluido',    'delivery_summary', 'textarea', 'Resumo do que foi entregue', true, '[]', 0, 'Descreva o que foi entregue — trava a conclusão sem prova de entrega.'),
  ('marketing_tasks', 'concluido',    'delivery_link',     'url',     'Link/evidência',             false, '[]', 1, 'Link opcional pra arquivo, print ou página publicada.')
on conflict (domain, company_id, stage_key, field_key) do nothing;
