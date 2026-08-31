-- marketing_requests_set_updated_at ficou de fora do endurecimento geral
-- (20260519_security_harden_functions.sql) porque a tabela marketing_requests
-- só foi criada depois. Mesmo tratamento dos outros triggers de updated_at:
-- search_path fixo e sem execução direta via RPC (é só um BEFORE UPDATE).
ALTER FUNCTION public.marketing_requests_set_updated_at() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.marketing_requests_set_updated_at() FROM PUBLIC, anon, authenticated;
