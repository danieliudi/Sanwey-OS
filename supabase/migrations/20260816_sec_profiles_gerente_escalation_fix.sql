-- SEC-C1 (CRÍTICO): gerente podia promover qualquer peer não-admin a admin
-- via array roles[] — a policy só guardava a coluna escalar `role`, não o
-- array de onde current_user_is_admin() realmente deriva autoridade. Também
-- faltava escopo de empresa no ramo gerente (cross-frente).

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
FOR UPDATE
USING (
  current_user_is_admin()
  OR (
    current_user_is_manager()
    AND role <> 'admin'
    AND companies && current_user_companies()
  )
  OR (id = (SELECT auth.uid()))
)
WITH CHECK (
  current_user_is_admin()
  OR (
    current_user_is_manager()
    AND role <> 'admin'
    AND NOT ('admin' = ANY (COALESCE(roles, ARRAY[]::text[])))
    AND companies && current_user_companies()
  )
  OR (id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS profiles_delete ON public.profiles;
CREATE POLICY profiles_delete ON public.profiles
FOR DELETE
USING (
  current_user_is_admin()
  OR (
    current_user_is_manager()
    AND role <> 'admin'
    AND companies && current_user_companies()
  )
);

-- Defesa em profundidade (achado L1/M2): o trigger que impede
-- self-escalation usava lista fixa de colunas e `supplier_id` tinha ficado
-- de fora — um usuário comum podia se auto-vincular a um fornecedor via
-- UPDATE profiles SET supplier_id=... WHERE id=auth.uid(). Reescrito sem
-- referenciar `salary` (coluna removida na migration de profile_secrets,
-- aplicada logo em seguida nesta mesma rodada).
CREATE OR REPLACE FUNCTION public.profiles_prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() = NEW.id AND NOT current_user_is_admin() THEN
    NEW.role := OLD.role;
    NEW.roles := OLD.roles;
    NEW.companies := OLD.companies;
    NEW.sectors := OLD.sectors;
    NEW.supervisor_id := OLD.supervisor_id;
    NEW.employee_status := OLD.employee_status;
    NEW.job_title := OLD.job_title;
    NEW.department := OLD.department;
    NEW.contract_type := OLD.contract_type;
    NEW.admission_date := OLD.admission_date;
    NEW.frente := OLD.frente;
    NEW.supplier_id := OLD.supplier_id;
  END IF;
  RETURN NEW;
END;
$function$;
