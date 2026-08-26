-- F-07 da auditoria funcional (19/08/2026): rh_colaboradores não tinha
-- chave única por e-mail, resultando em 4 pares da mesma pessoa cadastrada
-- 2x (uma linha vinculada ao profile de login, outra solta — 2 delas com
-- created_at idêntico ao milissegundo, sugerindo lote de importação).
-- Revisado par a par com o Daniel (20/08/2026): mantém a linha vinculada
-- ao profile em todos os 4 casos, herda frente/dados só preenchidos na
-- linha solta, reaponta histórico (FK) antes de remover — merge, não
-- delete às cegas, pra não perder nada (rh_treinamento_atribuicoes tinha
-- uma atribuição só na linha solta do caso "iudiyano").

-- Par 1 — Daniel Iudi Yano (canônica) absorve "Daniel Uidi" (erro de
-- digitação, sem histórico vinculado).
DELETE FROM public.rh_colaboradores WHERE id = '4863d80b-4c44-4cb7-aee9-5ac772af434a';

-- Par 2 — iudiyano: acd52c6c (vinculada ao profile) absorve d9898fb3. As
-- duas já tinham o MESMO treinamento atribuído (mesmo treinamento_id) —
-- descarta a atribuição duplicada antes de reapontar o resto, senão
-- colide com a unique (treinamento_id, colaborador_id).
DELETE FROM public.rh_treinamento_atribuicoes rta
  WHERE rta.colaborador_id = 'd9898fb3-dba0-4027-adf8-934182ad5577'
    AND EXISTS (
      SELECT 1 FROM public.rh_treinamento_atribuicoes rta2
      WHERE rta2.colaborador_id = 'acd52c6c-4c00-4e0c-878a-89856c613474'
        AND rta2.treinamento_id = rta.treinamento_id
    );
UPDATE public.rh_treinamento_atribuicoes SET colaborador_id = 'acd52c6c-4c00-4e0c-878a-89856c613474'
  WHERE colaborador_id = 'd9898fb3-dba0-4027-adf8-934182ad5577';
UPDATE public.rh_colaboradores SET frente = 'sanwey'
  WHERE id = 'acd52c6c-4c00-4e0c-878a-89856c613474' AND frente IS NULL;
DELETE FROM public.rh_colaboradores WHERE id = 'd9898fb3-dba0-4027-adf8-934182ad5577';

-- Par 3 — Leonardo Braga: 2071fe8e (vinculada ao profile, @resibag.com.br)
-- absorve 22a9c6f6 (solta, @sanwey.com.br) — sem histórico em nenhuma.
UPDATE public.rh_colaboradores SET frente = 'resibag'
  WHERE id = '2071fe8e-ddcc-4583-8e9c-edde8fedb23b' AND frente IS NULL;
DELETE FROM public.rh_colaboradores WHERE id = '22a9c6f6-ff82-4575-aca9-342e8d835c43';

-- Par 4 — Rafael Doddi: dc871d01 (vinculada ao profile) absorve 5876bb0c
-- (solta) — mesmo e-mail nas duas, sem histórico em nenhuma.
UPDATE public.rh_colaboradores SET frente = 'sanwey'
  WHERE id = 'dc871d01-e877-4589-a49f-bb2f760e024b' AND frente IS NULL;
DELETE FROM public.rh_colaboradores WHERE id = '5876bb0c-b6c1-4754-ac9e-974ea9947ad2';

-- Trava duplicata nova por e-mail (case-insensitive; nulo não conta, então
-- múltiplas linhas sem e-mail continuam permitidas).
CREATE UNIQUE INDEX IF NOT EXISTS rh_colaboradores_email_unique_idx
  ON public.rh_colaboradores (lower(email))
  WHERE email IS NOT NULL;
