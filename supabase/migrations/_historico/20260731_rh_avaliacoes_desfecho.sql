-- Onda 2 (item 6, Áudio 5) — desfecho estruturado da avaliação de desempenho.
-- Além de nota/pontos, a conclusão passa a registrar um encaminhamento:
--   promovido  → gera ajuste de salário (registrado em desfecho_meta)
--   mantido    → segue no ciclo normal
--   reavaliar  → agenda uma reavaliação (novo ciclo tipo 'reavaliacao')
--   reprovado  → encerra com parecer negativo
-- desfecho_meta guarda o contexto (salário antigo→novo, prazo da reavaliação)
-- pra trilha de auditoria. Aditivo e nullable — herda a RLS existente.
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
ALTER TABLE public.rh_avaliacoes
  ADD COLUMN IF NOT EXISTS desfecho text,
  ADD COLUMN IF NOT EXISTS desfecho_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rh_avaliacoes_desfecho_check'
  ) THEN
    ALTER TABLE public.rh_avaliacoes
      ADD CONSTRAINT rh_avaliacoes_desfecho_check
      CHECK (desfecho IS NULL OR desfecho = ANY (ARRAY['promovido','mantido','reavaliar','reprovado']));
  END IF;
END $$;

-- 'reavaliacao' vira um tipo de ciclo válido (encadeado por desfecho='reavaliar').
ALTER TABLE public.rh_avaliacoes DROP CONSTRAINT IF EXISTS rh_avaliacoes_tipo_check;
ALTER TABLE public.rh_avaliacoes
  ADD CONSTRAINT rh_avaliacoes_tipo_check
  CHECK (tipo = ANY (ARRAY['30_dias','60_dias','90_dias','semestral','anual','ad_hoc','reavaliacao']));

COMMENT ON COLUMN public.rh_avaliacoes.desfecho IS 'Encaminhamento da avaliação: promovido/mantido/reavaliar/reprovado';
COMMENT ON COLUMN public.rh_avaliacoes.desfecho_meta IS 'Contexto do desfecho (ex: salario_anterior/salario_novo, reavaliar_meses)';
