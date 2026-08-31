-- Onda 2 (item 7, Áudio de onboarding) — trilhas diferenciadas.
-- Um template de onboarding agora carrega o tipo de trilha (administrativa vs
-- operacional vs ISO), além de cargo/frente que já existiam. CHECK brando
-- (permite null='geral') pra não repetir o erro do status de treinamentos,
-- que travou um valor novo. Herda a RLS existente.
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
ALTER TABLE public.rh_onboarding_templates
  ADD COLUMN IF NOT EXISTS tipo_trilha text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rh_onboarding_templates_tipo_trilha_check') THEN
    ALTER TABLE public.rh_onboarding_templates
      ADD CONSTRAINT rh_onboarding_templates_tipo_trilha_check
      CHECK (tipo_trilha IS NULL OR tipo_trilha = ANY (ARRAY['administrativa','operacional','iso']));
  END IF;
END $$;

COMMENT ON COLUMN public.rh_onboarding_templates.tipo_trilha IS 'Trilha do onboarding: administrativa/operacional/iso (null = geral)';
