-- Onda 3 (item 10) — Offboarding: entrevista de desligamento estruturada.
-- Estende rh_colaboradores em vez de tabela nova (mesmo padrão do desfecho da
-- avaliação). desligamento_meta guarda as respostas da entrevista de saída.
-- Aditivo/nullable, herda a RLS existente (rh_colaboradores_rh_access).
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
ALTER TABLE public.rh_colaboradores
  ADD COLUMN IF NOT EXISTS desligamento_tipo text,
  ADD COLUMN IF NOT EXISTS desligamento_motivo text,
  ADD COLUMN IF NOT EXISTS desligamento_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rh_colaboradores_desligamento_tipo_check') THEN
    ALTER TABLE public.rh_colaboradores
      ADD CONSTRAINT rh_colaboradores_desligamento_tipo_check
      CHECK (desligamento_tipo IS NULL OR desligamento_tipo = ANY (ARRAY['voluntario','involuntario','fim_contrato','justa_causa','acordo']));
  END IF;
END $$;

COMMENT ON COLUMN public.rh_colaboradores.desligamento_tipo IS 'Tipo do desligamento: voluntario/involuntario/fim_contrato/justa_causa/acordo';
COMMENT ON COLUMN public.rh_colaboradores.desligamento_motivo IS 'Motivo/observação do desligamento';
COMMENT ON COLUMN public.rh_colaboradores.desligamento_meta IS 'Respostas da entrevista de desligamento (jsonb)';
