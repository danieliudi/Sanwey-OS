-- Modelo de "frente" (unidade/empresa) do módulo de RH.
--
-- Importante: este é um conceito EXCLUSIVO do RH, com 3 valores reais
-- (sanwey, resibag, montemor) — Monte Mor é uma entidade só de folha/RH,
-- sem operação comercial/marketing própria. Não confundir com o
-- COMPANY_IDS global do CRM/Marketing (industria/resibag, ver
-- src/constants/companies.js), que é um domínio totalmente separado e
-- não deve ganhar um terceiro valor. As colunas abaixo (company_ids,
-- frente_origem, frente) já existiam em rh_vagas/rh_candidatos desde
-- 20260702/20260703 mas nunca foram preenchidas por nenhuma tela — agora
-- passam a ser as opções reais usadas em todo o módulo de RH.

-- 1. rh_colaboradores nunca teve tag de frente — cada colaborador
--    pertence a uma frente só (não múltiplas, ao contrário de vaga).
ALTER TABLE public.rh_colaboradores
  ADD COLUMN IF NOT EXISTS frente text;

ALTER TABLE public.rh_colaboradores
  DROP CONSTRAINT IF EXISTS rh_colaboradores_frente_check;
ALTER TABLE public.rh_colaboradores
  ADD CONSTRAINT rh_colaboradores_frente_check
  CHECK (frente IS NULL OR frente IN ('sanwey', 'resibag', 'montemor'));

-- 2. rh_vagas.company_ids — vaga pode ser aberta pra mais de uma frente
--    ao mesmo tempo (ex: "Vendedor" pra Sanwey e Resibag juntas).
ALTER TABLE public.rh_vagas
  DROP CONSTRAINT IF EXISTS rh_vagas_company_ids_check;
ALTER TABLE public.rh_vagas
  ADD CONSTRAINT rh_vagas_company_ids_check
  CHECK (company_ids <@ ARRAY['sanwey', 'resibag', 'montemor']::text[]);

-- 3. rh_candidatos.frente_origem — herdado automaticamente das vagas em
--    que o candidato se aplicou (ver submit_job_application), acumulado.
ALTER TABLE public.rh_candidatos
  DROP CONSTRAINT IF EXISTS rh_candidatos_frente_origem_check;
ALTER TABLE public.rh_candidatos
  ADD CONSTRAINT rh_candidatos_frente_origem_check
  CHECK (frente_origem <@ ARRAY['sanwey', 'resibag', 'montemor']::text[]);

-- 4. rh_onboarding_templates.frente / rh_treinamentos.frente — texto
--    livre nunca usado por nenhuma tela; limpa valor de teste e trava
--    nos 3 valores reais.
UPDATE public.rh_onboarding_templates SET frente = NULL
  WHERE frente IS NOT NULL AND frente NOT IN ('sanwey', 'resibag', 'montemor');
ALTER TABLE public.rh_onboarding_templates
  DROP CONSTRAINT IF EXISTS rh_onboarding_templates_frente_check;
ALTER TABLE public.rh_onboarding_templates
  ADD CONSTRAINT rh_onboarding_templates_frente_check
  CHECK (frente IS NULL OR frente IN ('sanwey', 'resibag', 'montemor'));

UPDATE public.rh_treinamentos SET frente = NULL
  WHERE frente IS NOT NULL AND frente NOT IN ('sanwey', 'resibag', 'montemor');
ALTER TABLE public.rh_treinamentos
  DROP CONSTRAINT IF EXISTS rh_treinamentos_frente_check;
ALTER TABLE public.rh_treinamentos
  ADD CONSTRAINT rh_treinamentos_frente_check
  CHECK (frente IS NULL OR frente IN ('sanwey', 'resibag', 'montemor'));
