-- Treinamentos vira um mini-LMS: validade/revalidação (treinamentos tipo NR
-- vencem e precisam ser refeitos), atribuição automática por cargo/
-- departamento (disparada quando o colaborador entra em "Integração" no
-- onboarding), e corrige o mesmo bug de FK que o onboarding tinha —
-- colaborador_id apontava pra profiles(id), então quem não tem login no
-- sistema nunca podia ser atribuído a um treinamento.

ALTER TABLE public.rh_treinamentos
  ADD COLUMN IF NOT EXISTS validade_dias      integer,
  ADD COLUMN IF NOT EXISTS cargo_alvo         text,
  ADD COLUMN IF NOT EXISTS departamento_alvo  text;

-- Backfill: garante um rh_colaboradores pra cada profile já referenciado em
-- rh_treinamento_atribuicoes, pra não perder atribuições existentes na
-- troca de FK (produção tinha 1 atribuição de teste sem colaborador
-- correspondente).
INSERT INTO public.rh_colaboradores (profile_id, full_name, email, employee_status)
SELECT DISTINCT p.id, p.name, p.email, 'ativo'
FROM public.profiles p
WHERE p.id IN (SELECT colaborador_id FROM public.rh_treinamento_atribuicoes)
  AND NOT EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id);

-- Solta a FK antiga (→ profiles) antes de repontar colaborador_id, senão o
-- UPDATE abaixo tenta gravar um id de rh_colaboradores num campo ainda
-- restrito a ids de profiles e viola a constraint antiga.
ALTER TABLE public.rh_treinamento_atribuicoes
  DROP CONSTRAINT IF EXISTS rh_treinamento_atribuicoes_colaborador_id_fkey;

UPDATE public.rh_treinamento_atribuicoes a
SET colaborador_id = c.id
FROM public.rh_colaboradores c
WHERE c.profile_id = a.colaborador_id;

ALTER TABLE public.rh_treinamento_atribuicoes
  ADD CONSTRAINT rh_treinamento_atribuicoes_colaborador_id_fkey
  FOREIGN KEY (colaborador_id) REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "rh_treinamento_atrib_read" ON public.rh_treinamento_atribuicoes;
CREATE POLICY "rh_treinamento_atrib_read" ON public.rh_treinamento_atribuicoes
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = colaborador_id AND profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
  );

DROP POLICY IF EXISTS "rh_treinamento_atrib_update" ON public.rh_treinamento_atribuicoes;
CREATE POLICY "rh_treinamento_atrib_update" ON public.rh_treinamento_atribuicoes
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = colaborador_id AND profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
  );
