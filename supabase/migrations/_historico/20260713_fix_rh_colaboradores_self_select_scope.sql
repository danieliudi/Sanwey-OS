-- Achado da auditoria: a policy rh_colaboradores_self_select (adicionada em
-- 20260713_rh_colaboradores_self_select.sql) dá SELECT * na própria linha —
-- inclusive salary, notes, document_path e desligamento_date, que não
-- precisam ser lidos pelo colaborador. Ela só existia pra fazer as
-- subqueries EXISTS(SELECT 1 FROM rh_colaboradores WHERE profile_id=auth.uid())
-- de rh_avaliacoes/rh_treinamento_atribuicoes/rh_onboarding_tarefas/
-- rh_attachments resolverem true (sem SELECT nenhum em rh_colaboradores, RLS
-- some com a linha antes mesmo do WHERE ser avaliado). Nenhuma tela do
-- frontend lê rh_colaboradores fora do módulo de RH (useRHColaboradores só é
-- usado nas views RH, todas atrás de isRHUser) — o self-select só era
-- alcançável via API direta.
--
-- Troca o padrão: uma função SECURITY DEFINER que responde só "essa linha é
-- minha?" sem expor a linha inteira, e as policies dependentes passam a
-- chamar essa função em vez do EXISTS inline. Com isso dá pra remover o
-- self-select amplo de rh_colaboradores.
CREATE OR REPLACE FUNCTION public.is_own_colaborador(p_colaborador_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rh_colaboradores
    WHERE id = p_colaborador_id AND profile_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_own_colaborador(uuid) FROM PUBLIC, anon;

DROP POLICY IF EXISTS rh_attachments_self_read ON public.rh_attachments;
CREATE POLICY rh_attachments_self_read
  ON public.rh_attachments
  FOR SELECT
  USING (domain = 'onboarding' AND public.is_own_colaborador(record_id));

DROP POLICY IF EXISTS rh_avaliacoes_read ON public.rh_avaliacoes;
CREATE POLICY rh_avaliacoes_read
  ON public.rh_avaliacoes
  FOR SELECT
  USING (
    public.is_own_colaborador(user_id)
    OR evaluator_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['admin', 'gerente_rh', 'rh'])
    )
  );

DROP POLICY IF EXISTS rh_treinamento_atrib_read ON public.rh_treinamento_atribuicoes;
CREATE POLICY rh_treinamento_atrib_read
  ON public.rh_treinamento_atribuicoes
  FOR SELECT
  USING (
    public.is_own_colaborador(colaborador_id)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['admin', 'gerente_rh', 'rh'])
    )
  );

DROP POLICY IF EXISTS rh_treinamento_atrib_update ON public.rh_treinamento_atribuicoes;
CREATE POLICY rh_treinamento_atrib_update
  ON public.rh_treinamento_atribuicoes
  FOR UPDATE
  USING (
    public.is_own_colaborador(colaborador_id)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['admin', 'gerente_rh', 'rh'])
    )
  );

DROP POLICY IF EXISTS rh_onboarding_tarefas_read ON public.rh_onboarding_tarefas;
CREATE POLICY rh_onboarding_tarefas_read
  ON public.rh_onboarding_tarefas
  FOR SELECT
  USING (
    public.is_own_colaborador(colaborador_id)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['admin', 'gerente_rh', 'rh'])
    )
  );

DROP POLICY IF EXISTS rh_onboarding_tarefas_update ON public.rh_onboarding_tarefas;
CREATE POLICY rh_onboarding_tarefas_update
  ON public.rh_onboarding_tarefas
  FOR UPDATE
  USING (
    public.is_own_colaborador(colaborador_id)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['admin', 'gerente_rh', 'rh'])
    )
  );

DROP POLICY IF EXISTS rh_colaboradores_self_select ON public.rh_colaboradores;
