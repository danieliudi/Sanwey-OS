-- Feedback vira um fluxo por ciclo em vez de um log solto: check-ins de
-- onboarding (30/60/90 dias) e um ciclo semestral recorrente pra quem já
-- foi efetivado nascem sozinhos como pendência (rascunho), em vez do RH
-- ter que lembrar de criar do zero. Também corrige o mesmo bug de FK que
-- onboarding/treinamentos tinham: user_id apontava pra profiles(id), então
-- colaborador sem login no sistema nunca podia ter um feedback registrado.

-- Backfill: garante um rh_colaboradores pra cada profile já referenciado em
-- rh_avaliacoes (produção está zerada, mas mantém o padrão de segurança
-- usado nas duas migrações anteriores).
INSERT INTO public.rh_colaboradores (profile_id, full_name, email, employee_status)
SELECT DISTINCT p.id, p.name, p.email, 'ativo'
FROM public.profiles p
WHERE p.id IN (SELECT user_id FROM public.rh_avaliacoes)
  AND NOT EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id);

ALTER TABLE public.rh_avaliacoes
  DROP CONSTRAINT IF EXISTS rh_avaliacoes_user_id_fkey;

UPDATE public.rh_avaliacoes a
SET user_id = c.id
FROM public.rh_colaboradores c
WHERE c.profile_id = a.user_id;

ALTER TABLE public.rh_avaliacoes
  ADD CONSTRAINT rh_avaliacoes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE;

-- Trava de segurança contra ciclo duplicado (ex: dois RH abrindo a tela ao
-- mesmo tempo e ambos disparando a reconciliação automática).
ALTER TABLE public.rh_avaliacoes
  DROP CONSTRAINT IF EXISTS rh_avaliacoes_user_tipo_period_key;
ALTER TABLE public.rh_avaliacoes
  ADD CONSTRAINT rh_avaliacoes_user_tipo_period_key UNIQUE (user_id, tipo, period_start);

DROP POLICY IF EXISTS "rh_avaliacoes_read" ON public.rh_avaliacoes;
CREATE POLICY "rh_avaliacoes_read" ON public.rh_avaliacoes
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = user_id AND profile_id = auth.uid())
    OR evaluator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
  );

-- rh_avaliacoes_write continua só-RH (inalterada) — a autoavaliação do
-- colaborador passa por uma RPC estreita abaixo, não por escrita direta na
-- tabela, pra não abrir a linha inteira (nota do gestor, notas) pra edição
-- de quem está sendo avaliado.
CREATE OR REPLACE FUNCTION public.rh_submit_self_rating(p_avaliacao_id uuid, p_self_rating numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_self_rating IS NOT NULL AND (p_self_rating < 0 OR p_self_rating > 10) THEN
    RAISE EXCEPTION 'Nota deve estar entre 0 e 10';
  END IF;

  UPDATE public.rh_avaliacoes a
  SET self_rating = p_self_rating, updated_at = now()
  WHERE a.id = p_avaliacao_id
    AND EXISTS (
      SELECT 1 FROM public.rh_colaboradores c
      WHERE c.id = a.user_id AND c.profile_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada ou não pertence a você';
  END IF;
END;
$$;

-- REVOKE ... FROM PUBLIC só limpa o privilégio implícito do pseudo-papel
-- PUBLIC — este projeto Supabase tem um default privilege que concede
-- EXECUTE a "anon" diretamente em toda function nova, então precisa
-- revogar de "anon" explicitamente também (a function já se protege
-- sozinha checando auth.uid(), mas o princípio do menor privilégio pede
-- isso mesmo assim).
REVOKE ALL ON FUNCTION public.rh_submit_self_rating(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rh_submit_self_rating(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.rh_submit_self_rating(uuid, numeric) TO authenticated;
