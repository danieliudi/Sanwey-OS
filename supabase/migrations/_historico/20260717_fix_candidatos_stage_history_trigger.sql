-- Corrige um bug da migration 20260715_rh_stage_history.sql: o trigger do
-- domínio 'candidatos' foi criado em rh_candidatos.stage, mas o Kanban de
-- Recrutamento na verdade grava a etapa em rh_aplicacoes.etapa_pipeline
-- (rh_candidatos é só a identidade/talent pool — nome, e-mail, currículo;
-- rh_aplicacoes é a aplicação por vaga, com a etapa de verdade). O
-- record_id que o front-end usa pra esse domínio também é aplicacao.id, não
-- candidato.id (ver joinAplicacao() em use-rh-recrutamento.js). Resultado:
-- o trigger antigo nunca disparava pra mudanças reais de etapa, e mesmo se
-- disparasse gravaria com o id errado — a aba "Histórico" de Candidatos
-- ficava sempre vazia.
DROP TRIGGER IF EXISTS trg_log_candidato_stage_change ON public.rh_candidatos;

CREATE TRIGGER trg_log_candidato_stage_change
  AFTER INSERT OR UPDATE ON public.rh_aplicacoes
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('candidatos', 'etapa_pipeline');
