-- Achado da própria correção (20/08/2026): REVOKE ... FROM PUBLIC não
-- remove os GRANTs diretos que os default privileges do projeto aplicam a
-- anon/authenticated na criação de toda função nova em public — confirmado
-- via get_advisors (anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable, novos WARN após o
-- deploy de ai_org_quota_increment e external_api_daily_increment, MD-06 e
-- MD-07 da auditoria de segurança de 19/08/2026).
--
-- Sem este REVOKE explícito, qualquer usuário autenticado (ou anon) podia
-- chamar as duas função direto via RPC e incrementar a cota de QUALQUER
-- user_id (a função não confere se o chamador é o dono do p_user_id) —
-- abuso menor (esgotar cota alheia), mas contraria o propósito de
-- MD-06/MD-07. As edge functions continuam funcionando: chamam via
-- service_role, que segue com EXECUTE.

REVOKE EXECUTE ON FUNCTION public.ai_org_quota_increment(uuid, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.external_api_daily_increment(text, uuid) FROM anon, authenticated;
