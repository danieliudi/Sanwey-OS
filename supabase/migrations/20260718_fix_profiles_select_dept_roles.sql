-- profiles_select nunca foi atualizada quando os cargos de RH/Marketing
-- (rh, gerente_rh, marketing, gerente_marketing) foram introduzidos — só
-- reconhecia o conjunto original de cargos Comercial (gerente/admin/vendedor
-- com subordinados). Resultado: um usuário marketing/gerente_marketing/rh/
-- gerente_rh só enxerga a PRÓPRIA linha via RLS, então `useProfiles()`
-- (usado em toda seleção de responsável/@menção/avatar da plataforma) volta
-- praticamente vazio pra esses cargos — ex.: o seletor "Responsável" em
-- Entregas fica sem nomes pra marcar quem já está atribuído, pra qualquer
-- usuário "marketing" comum (não gerente_marketing/admin).
CREATE OR REPLACE FUNCTION public.current_user_is_dept_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(
    (SELECT roles && ARRAY['marketing','gerente_marketing','rh','gerente_rh']::text[]
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR current_user_is_manager()
  OR current_user_is_dept_staff()
  OR (current_user_role() = ANY (ARRAY['vendedor','consultor']) AND (id)::text = ANY (current_user_subordinate_ids()))
);
