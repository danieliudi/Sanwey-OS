-- Correção: o REVOKE anterior (de anon/authenticated diretamente) não
-- teve efeito porque o EXECUTE estava concedido a PUBLIC (que todo role,
-- incluindo anon/authenticated, herda automaticamente). Descoberta
-- importante ao investigar: `postgres` (dono do cron.job que usa
-- net.http_post) é MEMBRO de anon/authenticated/service_role — revogar
-- direto de PUBLIC sem compensar quebraria o cron "agent-runner-daily-sweep".
-- Fix correto: tira de PUBLIC, concede de volta só pra `postgres`
-- (quem legitimamente precisa, via cron.job) e `service_role` (edge
-- functions/admin, defesa em profundidade — não usa net.* hoje, mas é o
-- papel correto pra manter caso passe a usar).
--
-- RESÍDUO CONHECIDO: verificado após aplicar que o ACL de net.http_* volta
-- sozinho pro estado original (só PUBLIC+owner supabase_admin) — a
-- plataforma Supabase parece reconciliar/resetar esses grants
-- periodicamente (comportamento documentado de extensões gerenciadas).
-- Não é explorável hoje (schema `net` não é exposto pelo PostgREST), então
-- não vale insistir contra a automação da plataforma por um achado BAIXO.
-- Mantido no histórico de migrations por transparência — se a plataforma
-- parar de reconciliar isso no futuro, este REVOKE passa a valer de fato.
REVOKE EXECUTE ON FUNCTION net.http_get(text, jsonb, jsonb, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION net.http_post(text, jsonb, jsonb, jsonb, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION net.http_delete(text, jsonb, jsonb, integer, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION net.http_get(text, jsonb, jsonb, integer) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION net.http_post(text, jsonb, jsonb, jsonb, integer) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION net.http_delete(text, jsonb, jsonb, integer, jsonb) TO postgres, service_role;
