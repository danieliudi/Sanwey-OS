-- SEC-NOVO4 (BAIXO, defesa em profundidade): net.http_get/post/delete
-- (pg_net) tinham EXECUTE liberado pra anon e authenticated. O schema
-- `net` não é exposto pelo PostgREST (não é explorável hoje via API), mas
-- é grant desnecessariamente largo — só o cron (role postgres) precisa
-- disparar HTTP a partir do banco (ver cron.job "agent-runner-daily-sweep").
-- REVOKE não afeta o cron: ele roda como owner/superuser, não como
-- anon/authenticated.
--
-- NOTA (constatado ao verificar): este REVOKE isoladamente não teve
-- efeito — o EXECUTE real vinha de um GRANT a PUBLIC, herdado por todo
-- role. Ver a migration seguinte (..._from_public) pro fix que de fato
-- funciona nesse ambiente.
REVOKE EXECUTE ON FUNCTION net.http_get(text, jsonb, jsonb, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION net.http_post(text, jsonb, jsonb, jsonb, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION net.http_delete(text, jsonb, jsonb, integer, jsonb) FROM anon, authenticated;
