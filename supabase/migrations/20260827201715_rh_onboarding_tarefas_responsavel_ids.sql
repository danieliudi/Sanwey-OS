-- Coluna "responsavel" (uuid escalar) existe desde a criação da tabela
-- (20260702_rh_captacao_ia.sql) mas nunca foi usada em nenhuma tela nem
-- teve dado gravado (confirmado: 0 de 5 linhas preenchidas). Substituída
-- pelo padrão multi-responsável já usado em rh_vagas/rh_candidatos
-- (20260714_multi_responsible_foundation.sql) — sem policy nova, a coluna
-- não é referenciada em nenhuma RLS hoje.
ALTER TABLE public.rh_onboarding_tarefas
  DROP COLUMN IF EXISTS responsavel,
  ADD COLUMN IF NOT EXISTS responsavel_ids uuid[] NOT NULL DEFAULT '{}';
