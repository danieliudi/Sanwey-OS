-- Sem consumidor desde que a aba "Conexões" virou "Histórico"
-- (get_client_timeline) — já documentado como candidato a DROP na migration
-- 20260904_sec_get_client_connections_scope.sql, que preferiu só corrigir o
-- vazamento de RLS-bypass em vez de remover (decisão de schema exige
-- confirmação explícita do Daniel — CLAUDE.md regra 5). Confirmado agora
-- (11/08/2026): nenhum import do hook correspondente em src/, nenhuma
-- dependência no banco (pg_depend vazio). src/hooks/use-client-connections.js
-- removido no mesmo commit.
drop function if exists public.get_client_connections(uuid);
