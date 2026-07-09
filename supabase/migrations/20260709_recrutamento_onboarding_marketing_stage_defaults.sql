-- Recrutamento: consentimento LGPD como campo obrigatório logo na Triagem
-- (aviso de privacidade + consentimento de tratamento de dados do
-- candidato — exigência real de LGPD, não só UX) e motivo de reprovação
-- estruturado (select, opcional — etapa terminal não trava saída, é só
-- pra relatório, mesmo caso de motivo_ganho/perda do Comercial).
INSERT INTO public.rh_pipeline_stage_fields (domain, company_id, stage_key, field_key, field_type, label, required, order_idx, help_text)
VALUES
  ('candidatos', 'all', 'triagem', 'consentimento_lgpd', 'checkbox', 'Candidato ciente do tratamento de dados (LGPD)', true, 0, 'Confirma que o aviso de privacidade foi apresentado e o consentimento registrado antes de seguir no processo.'),
  ('candidatos', 'all', 'reprovado', 'motivo_reprovacao', 'select', 'Motivo da reprovação', false, 0, 'Opcional — não bloqueia, é só pra relatório (etapa terminal não trava saída).')
ON CONFLICT (domain, company_id, stage_key, field_key) DO NOTHING;

UPDATE public.rh_pipeline_stage_fields
SET options = '["Perfil técnico insuficiente","Pretensão salarial incompatível","Disponibilidade","Não compareceu","Referências","Outro"]'::jsonb
WHERE domain = 'candidatos' AND stage_key = 'reprovado' AND field_key = 'motivo_reprovacao';

-- Onboarding: nova etapa "Pré-admissão" antes de Documentação — cobre o
-- período entre aceite da oferta e o dia 1 (Gupy Admissão, ClickBoarding),
-- hoje totalmente fora do board (que só começa depois da contratação).
UPDATE public.rh_pipeline_stages SET order_idx = order_idx + 1 WHERE domain = 'onboarding' AND company_id = 'all';

INSERT INTO public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, terminal, won, lost)
VALUES ('onboarding', 'all', 'pre_admissao', 'Pré-admissão', '#7C3AED', 0, false, false, false)
ON CONFLICT (domain, company_id, stage_key) DO NOTHING;

-- Campos obrigatórios na Pré-admissão: equipamento/acesso provisionado e
-- padrinho/buddy designado ANTES do dia 1 — o achado nº1 da pesquisa de
-- onboarding (Rippling/Enboarder/ClickBoarding) é que o gestor não ter
-- preparado essas duas coisas é a causa estrutural nº1 de "primeiras
-- semanas desorganizadas".
INSERT INTO public.rh_pipeline_stage_fields (domain, company_id, stage_key, field_key, field_type, label, required, order_idx, help_text)
VALUES
  ('onboarding', 'all', 'pre_admissao', 'equipamento_provisionado', 'checkbox', 'Equipamento/acesso ao sistema já solicitado', true, 0, null),
  ('onboarding', 'all', 'pre_admissao', 'buddy_id', 'user', 'Padrinho/buddy designado', true, 1, 'Colega responsável por acompanhar a pessoa nas primeiras semanas.')
ON CONFLICT (domain, company_id, stage_key, field_key) DO NOTHING;

-- Marketing: link de preview obrigatório antes de entrar em revisão (não
-- existe campo de anexo genérico no sistema — um link já resolve a maior
-- parte dos casos, ex: Figma/Drive/Canva) e UTM como campo informativo
-- (não obrigatório: preencher automaticamente exigiria código, fica como
-- campo manual por enquanto).
INSERT INTO public.rh_pipeline_stage_fields (domain, company_id, stage_key, field_key, field_type, label, required, order_idx, help_text)
VALUES
  ('marketing_deliverables', 'all', 'revisao', 'link_preview', 'url', 'Link de preview/arquivo', true, 0, 'Ex: link do Figma, Drive ou Canva com a peça pronta pra revisão.'),
  ('marketing', 'all', 'ao_vivo', 'utm_link', 'text', 'Link com UTM', false, 0, 'Ex: utm_source=..&utm_campaign=.. — opcional, ajuda a rastrear resultado da campanha.')
ON CONFLICT (domain, company_id, stage_key, field_key) DO NOTHING;
