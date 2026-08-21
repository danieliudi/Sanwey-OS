-- Hotfix da própria correção anterior (mesma tarefa, MD-03): a policy
-- rh_curriculos_public_insert tinha um subquery `SELECT count(*) FROM
-- storage.objects` DENTRO da policy de INSERT da própria storage.objects —
-- Postgres detecta isso como "infinite recursion detected in policy" e
-- rejeita QUALQUER insert (achado ao testar com simulação de RLS antes de
-- reportar como pronto, nunca chegou a rodar contra upload real). Motivo:
-- o subquery roda como o role que está inserindo (anon), que está sujeito
-- à própria RLS de storage.objects — referenciar a mesma tabela dentro da
-- sua própria policy fecha um ciclo. Fix: mover a contagem pra dentro de
-- uma função SECURITY DEFINER (roda como dono da função, isento de RLS
-- nessa tabela) — mesmo motivo pelo qual rh_curriculo_token_consume já
-- funcionava normalmente.
CREATE OR REPLACE FUNCTION public.rh_curriculo_folder_object_count(p_folder text)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(*)::int FROM storage.objects
  WHERE bucket_id = 'rh-curriculos' AND (storage.foldername(name))[1] = p_folder;
$function$;
REVOKE EXECUTE ON FUNCTION public.rh_curriculo_folder_object_count FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_curriculo_folder_object_count TO anon, authenticated;

DROP POLICY IF EXISTS rh_curriculos_public_insert ON storage.objects;
CREATE POLICY rh_curriculos_public_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rh-curriculos'
    AND public.rh_curriculo_token_consume(
          (storage.foldername(name))[1]::uuid,
          split_part(name, '/', 2)
        )
    AND public.rh_curriculo_folder_object_count((storage.foldername(name))[1]) < 6
  );
