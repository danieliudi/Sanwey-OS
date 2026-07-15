-- Ajuste do fix anterior (20260718_fix_profiles_select_dept_roles.sql):
-- em vez de dar visibilidade TOTAL da tabela profiles pra qualquer
-- marketing/gerente_marketing/rh/gerente_rh, escopa por departamento —
-- cada um só enxerga colegas do MESMO departamento (marketing só vê
-- marketing/gerente_marketing; rh só vê rh/gerente_rh), mais admin (sempre
-- visível a todo departamento) e gerente/admin continuam vendo todo mundo
-- (current_user_is_manager(), inalterado).
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR current_user_is_manager()
  OR 'admin' = ANY (roles)
  OR (
    current_user_roles() && ARRAY['marketing','gerente_marketing']::text[]
    AND roles && ARRAY['marketing','gerente_marketing']::text[]
  )
  OR (
    current_user_roles() && ARRAY['rh','gerente_rh']::text[]
    AND roles && ARRAY['rh','gerente_rh']::text[]
  )
  OR (current_user_role() = ANY (ARRAY['vendedor','consultor']) AND (id)::text = ANY (current_user_subordinate_ids()))
);

-- current_user_is_dept_staff() (do fix anterior) não é mais usada — a
-- checagem virou escopada por família de departamento, direto na política.
DROP FUNCTION IF EXISTS public.current_user_is_dept_staff();
