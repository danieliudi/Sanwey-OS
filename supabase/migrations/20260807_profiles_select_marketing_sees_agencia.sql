-- Bug reportado pelo Daniel: @ nos comentários de Entregas/Campanhas não
-- mostra a Beehave (usuária role 'agencia') pra Tati (role marketing)
-- marcar, mesmo com getMentionableUsers já passando includeAgencia: true
-- em CampaignDetailDrawer.jsx e DeliverableDetailDrawer.jsx (não é bug de
-- filtro no client). Causa raiz: a policy profiles_select
-- (20260802_profiles_select_agencia_marketing_symmetric.sql) só abriu a
-- direção agencia → vê marketing (pra resolver nome de assignee). Nunca
-- ganhou a direção inversa — marketing → vê agencia — então o profile da
-- Beehave nunca chega no array `users` de quem é marketing, e
-- getMentionableUsers não pode incluir um usuário que nunca recebeu.
--
-- Fix: mesmo padrão simétrico já estabelecido nas duas migrations
-- anteriores (marketing↔marketing, rh↔rh, e agora agencia↔marketing nos
-- dois sentidos) — sem mudar o modelo de permissão, só completando a
-- direção que faltou.
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
    OR (current_user_roles() && ARRAY['marketing', 'gerente_marketing'] AND roles && ARRAY['agencia'])
    OR (current_user_roles() && ARRAY['vendedor', 'consultor'] AND id::text = ANY (current_user_subordinate_ids()))
  );
