-- Auditoria (agência Beehave em Entregas): "RESPONSÁVEIS" aparecia vazio no
-- drawer de um deliverable com assignee_ids corretamente preenchido —
-- RHDetailDrawerShell/DeliverableDetailDrawer resolve o nome via
-- users.find(id) sobre a lista vinda de use-profiles.js (SELECT * FROM
-- profiles sem filtro client-side, depende 100% da RLS). profiles_select
-- (20260716_scope_profiles_select_by_company.sql) tem cláusula simétrica
-- pra marketing↔marketing e rh↔rh, mas nunca ganhou uma pra 'agencia' —
-- então qualquer usuário de agência só enxergava o próprio profile, e
-- assignee de outra pessoa resolvia pra nada (silencioso, sem erro).
--
-- Fix: mesmo padrão simétrico já usado (Daniel confirmou esse escopo em
-- auditoria, em vez de restringir por assignee_ids específico) — agencia
-- passa a enxergar profiles de marketing/gerente_marketing, o time que
-- de fato aparece como responsável nos deliverables que a agência já lê.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR 'admin' = ANY (current_user_roles())
    OR ('gerente' = ANY (current_user_roles()) AND companies && current_user_companies())
    OR (current_user_roles() && ARRAY['marketing', 'gerente_marketing'] AND roles && ARRAY['marketing', 'gerente_marketing'])
    OR (current_user_roles() && ARRAY['rh', 'gerente_rh'] AND roles && ARRAY['rh', 'gerente_rh'])
    OR (current_user_roles() && ARRAY['agencia'] AND roles && ARRAY['marketing', 'gerente_marketing'])
    OR (current_user_roles() && ARRAY['vendedor', 'consultor'] AND id::text = ANY (current_user_subordinate_ids()))
  );
