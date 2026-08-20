-- MD-06 da auditoria de segurança (19/08/2026): ai-assistant deixava
-- qualquer conta autenticada gastar a chave de IA da EMPRESA (fallback do
-- AI_ORG_*, usado quando o usuário não tem chave pessoal configurada) sem
-- limite algum de chamadas por dia. Corrigido com cota diária por usuário —
-- só se aplica ao fallback da empresa, nunca à chave pessoal (o custo dessa
-- é do próprio usuário).
--
-- Reaproveita a tabela external_cache já existente (cache genérico com TTL,
-- hoje só usada por cnpj-lookup) em vez de tabela nova — decidido com o
-- Daniel: 1 chave por usuário/dia, payload = {count}. Upsert atômico via
-- função (não faz sentido resolver isso com um SELECT + UPDATE de dois
-- passos na edge function — corrida entre duas chamadas simultâneas do
-- mesmo usuário poderia deixar o contador furar o teto).

CREATE OR REPLACE FUNCTION public.ai_org_quota_increment(p_user_id uuid, p_daily_limit int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_key text := 'ai_org_quota:' || p_user_id::text || ':' || to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD');
  v_count int;
BEGIN
  INSERT INTO public.external_cache (cache_key, source, payload, expires_at)
  VALUES (
    v_key,
    'ai_assistant_org_quota',
    jsonb_build_object('count', 1),
    (date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day') AT TIME ZONE 'utc'
  )
  ON CONFLICT (cache_key) DO UPDATE
    SET payload = jsonb_build_object(
      'count', COALESCE((public.external_cache.payload->>'count')::int, 0) + 1
    )
  RETURNING (payload->>'count')::int INTO v_count;

  RETURN v_count; -- chamador (edge function) decide o que fazer ao passar de p_daily_limit
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ai_org_quota_increment(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_org_quota_increment(uuid, int) TO service_role;
