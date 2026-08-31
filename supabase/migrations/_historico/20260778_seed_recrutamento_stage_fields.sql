-- Migra o formulário fixo de Recrutamento (VAGA_STAGE_FIELDS/CANDIDATO_STAGE_FIELDS,
-- hardcoded em RHRecrutamentoView.jsx) pro sistema dinâmico de "Editar campos
-- desta etapa" (rh_pipeline_stage_fields, domain='vagas'/'candidatos') --
-- mesmo padrão já aplicado em 20260774_seed_marketing_deliverables_stage_fields.sql
-- pra Entregas de Marketing. Os dois sistemas gravavam no mesmo custom_fields
-- jsonb, mas só o dinâmico sobrevive a rename de etapa (é resolvido por
-- stage_key vindo de rh_pipeline_stages; o hardcoded assumia chaves literais
-- fixas em JS).
--
-- 'candidatos'/'triagem' já tem consentimento_lgpd em order_idx=0
-- (20260709_recrutamento_onboarding_marketing_stage_defaults.sql) -- começa em 1.
insert into public.rh_pipeline_stage_fields
  (domain, company_id, stage_key, field_key, field_type, label, required, options, order_idx, placeholder)
values
  -- Vagas
  ('vagas', 'all', 'rascunho', 'aprovacao_interna', 'radio', 'Aprovação interna necessária?', false, '["Sim","Não"]', 0, null),
  ('vagas', 'all', 'rascunho', 'data_prevista_publicacao', 'date', 'Data prevista de publicação', false, '[]', 1, null),
  ('vagas', 'all', 'rascunho', 'observacoes_rascunho', 'textarea', 'Observações', false, '[]', 2, 'Notas sobre a abertura da vaga…'),

  ('vagas', 'all', 'publicada', 'canais_divulgacao', 'multicheck', 'Canais de divulgação', false, '["LinkedIn","Gupy","Site da empresa","Indicação interna","Outro"]', 0, null),
  ('vagas', 'all', 'publicada', 'data_publicacao', 'date', 'Data de publicação', false, '[]', 1, null),
  ('vagas', 'all', 'publicada', 'meta_candidatos', 'number', 'Meta de candidatos', false, '[]', 2, 'Ex: 15'),

  ('vagas', 'all', 'em_triagem', 'responsavel_triagem', 'user', 'Responsável pela triagem', false, '[]', 0, null),
  ('vagas', 'all', 'em_triagem', 'prazo_triagem', 'date', 'Prazo para concluir a triagem', false, '[]', 1, null),
  ('vagas', 'all', 'em_triagem', 'status_triagem', 'radio', 'Status da triagem', false, '["Em andamento","Concluída"]', 2, null),

  ('vagas', 'all', 'encerrada', 'motivo_encerramento', 'select', 'Motivo do encerramento', false, '["Vaga preenchida","Cancelada","Sem candidatos aptos","Outro"]', 0, null),
  ('vagas', 'all', 'encerrada', 'data_encerramento', 'date', 'Data de encerramento', false, '[]', 1, null),

  -- Candidatos
  ('candidatos', 'all', 'triagem', 'curriculo_avaliado', 'radio', 'Currículo avaliado?', false, '["Sim","Não"]', 1, null),
  ('candidatos', 'all', 'triagem', 'nota_triagem', 'number', 'Nota da triagem (0–10)', false, '[]', 2, '0–10'),

  ('candidatos', 'all', 'entrevista1', 'data_entrevista_rh', 'date', 'Data da entrevista', false, '[]', 0, null),
  ('candidatos', 'all', 'entrevista1', 'entrevistador_rh', 'user', 'Entrevistador', false, '[]', 1, null),
  ('candidatos', 'all', 'entrevista1', 'parecer_entrevista_rh', 'select', 'Parecer', false, '["Aprovado","Reprovado","Aguardando"]', 2, null),
  ('candidatos', 'all', 'entrevista1', 'obs_entrevista_rh', 'textarea', 'Observações', false, '[]', 3, null),

  ('candidatos', 'all', 'entrevista2', 'data_entrevista_gestor', 'date', 'Data da entrevista', false, '[]', 0, null),
  ('candidatos', 'all', 'entrevista2', 'entrevistador_gestor', 'text', 'Gestor entrevistador', false, '[]', 1, null),
  ('candidatos', 'all', 'entrevista2', 'parecer_entrevista_gestor', 'select', 'Parecer', false, '["Aprovado","Reprovado","Aguardando"]', 2, null),
  ('candidatos', 'all', 'entrevista2', 'obs_entrevista_gestor', 'textarea', 'Observações', false, '[]', 3, null),

  ('candidatos', 'all', 'tecnico', 'tipo_teste_tecnico', 'text', 'Tipo de teste', false, '[]', 0, null),
  ('candidatos', 'all', 'tecnico', 'resultado_teste_tecnico', 'text', 'Resultado / nota', false, '[]', 1, null),
  ('candidatos', 'all', 'tecnico', 'aprovado_teste_tecnico', 'radio', 'Aprovado no teste?', false, '["Sim","Não"]', 2, null),

  ('candidatos', 'all', 'proposta', 'salario_proposto', 'currency', 'Salário proposto', false, '[]', 0, null),
  ('candidatos', 'all', 'proposta', 'data_envio_proposta', 'date', 'Data de envio da proposta', false, '[]', 1, null),
  ('candidatos', 'all', 'proposta', 'status_proposta', 'select', 'Status da proposta', false, '["Aguardando resposta","Aceita","Recusada","Negociando"]', 2, null)
on conflict (domain, company_id, stage_key, field_key) do nothing;
