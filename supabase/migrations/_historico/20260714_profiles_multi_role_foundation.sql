-- FASE 1 do pedido de multi-cargo: usuário passa a poder acumular mais de um
-- cargo (ex: vendedor + agencia), sem quebrar nada que já depende de um
-- único "cargo principal" (tela de login, dashboard padrão por role, etc).
--
-- Desenho escolhido: `profiles.role` (escalar) continua existindo e vira o
-- "cargo principal" — usado só para decidir a landing page/dashboard padrão
-- de cada usuário. `profiles.roles` (array, nova coluna) passa a ser a fonte
-- de verdade para toda checagem de permissão (RLS e frontend). Um trigger
-- garante o invariante `role = ANY(roles)` sempre, então quem só lê `role`
-- continua funcionando sem mudança nenhuma, e quem precisa saber "esse
-- usuário também é X" passa a checar `roles`.
--
-- Reversível e incremental de propósito: dá pra ir migrando helper por
-- helper (ver funções abaixo) e tela por tela sem quebrar nada no meio do
-- caminho.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_roles_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_roles_check
  CHECK (roles <@ ARRAY['admin','gerente','vendedor','consultor','marketing','gerente_marketing','agencia','rh','gerente_rh']::text[]);

-- Backfill: todo mundo começa com roles = [role] (nenhum cargo extra ainda).
UPDATE public.profiles
SET roles = ARRAY[role]::text[]
WHERE roles IS NULL OR roles = '{}'::text[];

-- Mantém o invariante role ∈ roles em toda escrita futura, então helpers que
-- checam só `roles` nunca ficam incoerentes com o `role` escalar.
CREATE OR REPLACE FUNCTION public.profiles_sync_roles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.roles IS NULL THEN
    NEW.roles := '{}'::text[];
  END IF;
  IF NEW.role IS NOT NULL AND NOT (NEW.role = ANY(NEW.roles)) THEN
    NEW.roles := array_append(NEW.roles, NEW.role);
  END IF;
  IF array_length(NEW.roles, 1) IS NULL THEN
    NEW.roles := ARRAY[NEW.role];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_roles_trigger ON public.profiles;
CREATE TRIGGER profiles_sync_roles_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_sync_roles();

-- profiles_prevent_self_escalation roda antes (ordem alfabética de trigger
-- BEFORE: "profiles_prevent_self_escalation" < "profiles_sync_roles_trigger"),
-- então o guard abaixo já reseta NEW.roles pra OLD.roles antes do sync rodar
-- — sem isso, um não-admin poderia se autoconceder um cargo extra via roles
-- mesmo com o guard de role/companies/etc já existente.
CREATE OR REPLACE FUNCTION public.profiles_prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT current_user_is_admin() THEN
    NEW.role := OLD.role;
    NEW.roles := OLD.roles;
    NEW.companies := OLD.companies;
    NEW.sectors := OLD.sectors;
    NEW.salary := OLD.salary;
    NEW.supervisor_id := OLD.supervisor_id;
    NEW.employee_status := OLD.employee_status;
    NEW.job_title := OLD.job_title;
    NEW.department := OLD.department;
    NEW.contract_type := OLD.contract_type;
    NEW.admission_date := OLD.admission_date;
    NEW.frente := OLD.frente;
  END IF;
  RETURN NEW;
END;
$$;

-- Helpers existentes migram de `role = ...`/`role IN (...)` para checagem
-- via `roles` (overlap/ANY) — mesmos nomes e assinaturas, então os ~196
-- call-sites que já usam esses helpers em RLS ganham suporte a multi-cargo
-- de graça, sem editar policy nenhuma.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and 'admin' = ANY(roles)
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
    where id = auth.uid() and roles && ARRAY['gerente','admin']::text[]
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_is_marketing()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT roles && ARRAY['marketing','gerente_marketing','admin']::text[]
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$;

-- current_user_role() continua devolvendo o cargo principal (escalar) —
-- usado hoje só pra decidir landing page/dashboard padrão, então não muda.

-- Novos helpers: RH nunca teve helper próprio (todo o módulo usa ~49
-- checagens inline de role em RLS) e não existia forma de perguntar "esse
-- usuário acumula ESTE cargo em especial" fora dos combos já prontos acima.

CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(roles, '{}'::text[]) FROM public.profiles WHERE id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT p_role = ANY(roles) FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_is_rh()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT roles && ARRAY['rh','gerente_rh','admin']::text[]
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_is_rh_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT roles && ARRAY['gerente_rh','admin']::text[]
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$;
