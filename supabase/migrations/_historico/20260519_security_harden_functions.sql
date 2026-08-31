-- Hardening de funções (Supabase Security Advisors):
--   1. search_path explícito (evita resolução ambígua de schema em SECURITY DEFINER).
--   2. Revoga EXECUTE de PUBLIC/anon em funções que não devem ser RPC-callable.
--   3. Mantém EXECUTE em current_user_* para authenticated (RLS depende), tira de anon.
--
-- Warnings remanescentes após esta migration são intencionais:
--   - current_user_{companies,is_admin,is_manager,role} continuam callable
--     por authenticated. Cada uma só retorna dados do próprio uid, então OK.
--   - "Leaked Password Protection Disabled" é toggle no painel Auth, não SQL.

-- Trigger functions — nunca devem ser RPC-callable.
ALTER FUNCTION public.handle_new_user()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.log_lead_stage_change()           SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_profile_email()              SET search_path = public, pg_temp;
ALTER FUNCTION public.leads_touch_row()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.update_agent_actions_updated_at() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_stage_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_email()    FROM PUBLIC, anon, authenticated;

-- Helpers de RLS — search_path fixo + acesso só para usuário logado.
ALTER FUNCTION public.current_user_companies()  SET search_path = public, pg_temp;
ALTER FUNCTION public.current_user_is_admin()   SET search_path = public, pg_temp;
ALTER FUNCTION public.current_user_is_manager() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_user_role()       SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.current_user_companies()  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin()   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_manager() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role()       FROM PUBLIC, anon;
