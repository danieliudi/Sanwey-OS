-- Captura em versionamento as definições atuais (já vivas em produção) de 4
-- funções centrais de RLS que nunca tiveram um CREATE FUNCTION registrado em
-- supabase/migrations/ até hoje (só apareciam em ALTER FUNCTION/REVOKE
-- pontuais) — divergência real entre o histórico de migrations e o estado
-- vivo do banco. Este arquivo é puramente declarativo: reproduz exatamente o
-- corpo já em produção (via pg_get_functiondef), sem nenhuma mudança de
-- comportamento. Serve de baseline seguro antes de qualquer alteração real
-- nessas funções (ver 20260714_profiles_multi_role_foundation.sql, em
-- seguida).

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_is_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('gerente','admin')
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.current_user_companies()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(companies, '{}'::text[]) FROM profiles WHERE id = auth.uid()
$function$;
