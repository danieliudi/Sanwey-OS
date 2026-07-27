-- rh_ferias era o único domínio de RH que não tinha passado pela correção já
-- aplicada 5x (rh_avaliacoes, rh_onboarding_tarefas, rh_treinamento_atribuicoes,
-- rh_colaborador_beneficios, rh_data_update_requests): user_id apontava pra
-- profiles(id), então colaborador sem login no sistema nunca podia ter uma
-- solicitação de férias/licença registrada. Mesmo padrão de sempre.

-- Backfill: garante um rh_colaboradores pra cada profile já referenciado em
-- rh_ferias.
INSERT INTO public.rh_colaboradores (profile_id, full_name, email, employee_status)
SELECT DISTINCT p.id, p.name, p.email, 'ativo'
FROM public.profiles p
WHERE p.id IN (SELECT user_id FROM public.rh_ferias)
  AND NOT EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id);

ALTER TABLE public.rh_ferias
  DROP CONSTRAINT IF EXISTS rh_ferias_user_id_fkey;

UPDATE public.rh_ferias f
SET user_id = c.id
FROM public.rh_colaboradores c
WHERE c.profile_id = f.user_id;

ALTER TABLE public.rh_ferias
  ADD CONSTRAINT rh_ferias_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE;

-- RLS: user_id = auth.uid() não funciona mais (user_id agora é
-- rh_colaboradores.id, não profiles.id) — get_my_colaborador() é
-- RETURNS TABLE (set-returning), não pode ser usada em comparação escalar
-- dentro de policy ("set-returning functions are not allowed in policy
-- expressions"). Troca pro mesmo EXISTS já usado em rh_avaliacoes_read.
DROP POLICY IF EXISTS rh_ferias_read ON public.rh_ferias;
CREATE POLICY rh_ferias_read ON public.rh_ferias
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = user_id AND profile_id = auth.uid())
    OR current_user_is_admin()
    OR current_user_has_role('gerente_rh')
    OR current_user_has_role('rh')
  );

DROP POLICY IF EXISTS rh_ferias_insert ON public.rh_ferias;
CREATE POLICY rh_ferias_insert ON public.rh_ferias
  FOR INSERT
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = user_id AND profile_id = auth.uid())
      AND status = 'pendente' AND approved_by IS NULL AND approved_at IS NULL
    )
    OR current_user_is_admin()
    OR current_user_has_role('gerente_rh')
    OR current_user_has_role('rh')
  );
