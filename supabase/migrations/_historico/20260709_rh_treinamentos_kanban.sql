-- Adiciona o domínio "treinamentos" ao sistema de pipeline (etapas
-- customizáveis + campos por etapa), usado por um board por treinamento
-- (não um board único — catálogo × pessoas pode virar centenas de cards
-- misturados). "Vencido" passa a ser um stage_key de verdade, gravado em
-- rh_treinamento_atribuicoes.status, em vez de só calculado no cliente a
-- partir de data_conclusao + validade_dias — a reconciliação que faz essa
-- transição roda ao abrir a tela (mesmo padrão de nextPendingCycle do
-- Feedback), não por um cron/job agendado (não existe essa infra aqui).

ALTER TABLE public.rh_pipeline_stages
  DROP CONSTRAINT rh_pipeline_stages_domain_check,
  ADD CONSTRAINT rh_pipeline_stages_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables','feedback','ferias','treinamentos']));

ALTER TABLE public.rh_pipeline_stage_fields
  DROP CONSTRAINT rh_pipeline_stage_fields_domain_check,
  ADD CONSTRAINT rh_pipeline_stage_fields_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables','feedback','ferias','treinamentos']));

ALTER TABLE public.rh_treinamento_atribuicoes
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

-- Nenhuma das 3 etapas é terminal: pendente → concluído → vencido →
-- pendente (revalidação) é um ciclo, não um funil com um fim definido —
-- diferente de Recrutamento/Onboarding.
INSERT INTO public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, terminal, won, lost)
VALUES
  ('treinamentos', 'all', 'pendente',  'Pendente',  '#B45309', 0, false, false, false),
  ('treinamentos', 'all', 'concluido', 'Concluído', '#16A34A', 1, false, false, false),
  ('treinamentos', 'all', 'vencido',   'Vencido',   '#DC2626', 2, false, false, false)
ON CONFLICT (domain, company_id, stage_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_rh_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_domain text;
  v_stage text;
begin
  if tg_table_name = 'rh_vagas' then
    v_domain := 'vagas'; v_stage := new.stage;
  elsif tg_table_name = 'rh_aplicacoes' then
    v_domain := 'candidatos'; v_stage := new.etapa_pipeline;
  elsif tg_table_name = 'rh_colaboradores' then
    v_domain := 'onboarding'; v_stage := new.onboarding_stage;
  elsif tg_table_name = 'rh_avaliacoes' then
    v_domain := 'feedback'; v_stage := new.status;
  elsif tg_table_name = 'rh_ferias' then
    v_domain := 'ferias'; v_stage := new.status;
  elsif tg_table_name = 'rh_treinamento_atribuicoes' then
    v_domain := 'treinamentos'; v_stage := new.status;
  end if;

  if v_stage is not null and not exists (
    select 1 from public.rh_pipeline_stages where domain = v_domain and stage_key = v_stage
  ) then
    raise exception 'Etapa "%" inválida para %', v_stage, v_domain;
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS validate_stage_rh_treinamento_atribuicoes ON public.rh_treinamento_atribuicoes;
CREATE TRIGGER validate_stage_rh_treinamento_atribuicoes
  BEFORE INSERT OR UPDATE OF status ON public.rh_treinamento_atribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.validate_rh_stage();

-- Campos padrão no estágio "Concluído", pra já sair pronto pra auditoria de
-- NR (Normas Regulamentadoras): carga horária, conteúdo programático e
-- instrutor são exatamente o que a fiscalização trabalhista pede como
-- comprovação de treinamento obrigatório (o certificado em si vai na aba
-- Anexos do card, via rh_attachments).
INSERT INTO public.rh_pipeline_stage_fields (domain, company_id, stage_key, field_key, field_type, label, required, order_idx, help_text)
VALUES
  ('treinamentos', 'all', 'concluido', 'carga_horaria', 'number', 'Carga horária (horas)', true, 0, 'Duração total do treinamento, em horas.'),
  ('treinamentos', 'all', 'concluido', 'conteudo_programatico', 'textarea', 'Conteúdo programático', true, 1, 'Resumo dos tópicos cobertos — exigido em fiscalização de NR.'),
  ('treinamentos', 'all', 'concluido', 'instrutor', 'text', 'Instrutor (nome e qualificação)', true, 2, null)
ON CONFLICT (domain, company_id, stage_key, field_key) DO NOTHING;
