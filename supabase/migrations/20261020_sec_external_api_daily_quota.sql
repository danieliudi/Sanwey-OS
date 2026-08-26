-- MD-07 da auditoria de segurança (19/08/2026): os 3 proxies do Google
-- (places-autocomplete, distance-matrix, reverse-geocode) dependiam só do
-- JWT válido da plataforma (verify_jwt=true) — sem limite de CHAMADAS por
-- usuário, qualquer conta ativa dispara volume ilimitado contra APIs
-- cobradas por requisição.
--
-- Generaliza o mesmo padrão do ai_org_quota_increment (MD-06, mesmo dia):
-- upsert atômico de contador em external_cache, chave = bucket:user:data.
-- p_bucket identifica o proxy ("places_autocomplete", "distance_matrix",
-- "reverse_geocode") — cada function usa seu próprio limite diário.

CREATE OR REPLACE FUNCTION public.external_api_daily_increment(p_bucket text, p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_key text := p_bucket || ':' || p_user_id::text || ':' || to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD');
  v_count int;
BEGIN
  INSERT INTO public.external_cache (cache_key, source, payload, expires_at)
  VALUES (
    v_key,
    'rate_limit:' || p_bucket,
    jsonb_build_object('count', 1),
    (date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day') AT TIME ZONE 'utc'
  )
  ON CONFLICT (cache_key) DO UPDATE
    SET payload = jsonb_build_object(
      'count', COALESCE((public.external_cache.payload->>'count')::int, 0) + 1
    )
  RETURNING (payload->>'count')::int INTO v_count;

  RETURN v_count; -- cada chamador decide o que fazer ao passar do próprio limite
END;
$$;

REVOKE EXECUTE ON FUNCTION public.external_api_daily_increment(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.external_api_daily_increment(text, uuid) TO service_role;
