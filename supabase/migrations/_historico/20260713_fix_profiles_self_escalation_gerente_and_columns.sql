-- Correção de um furo na migração anterior (20260713_fix_profiles_self_
-- privilege_escalation.sql): o guard do trigger isentava tanto admin QUANTO
-- gerente (`NOT current_user_is_admin() AND NOT current_user_is_manager()`),
-- mas current_user_is_manager() retorna true para role IN ('gerente','admin').
-- Ou seja, um gerente autoeditando a própria linha (`id = auth.uid()`, ramo
-- permitido por profiles_update) ainda conseguia rodar
-- `update profiles set role='admin' where id=auth.uid()` e escalar.
-- Reduz o guard para apenas "não é admin".
--
-- Também fecha um segundo furo do mesmo achado: colunas sensíveis de RH
-- (salary, supervisor_id, employee_status, job_title, department,
-- contract_type, admission_date) não eram revertidas, então qualquer
-- colaborador não-admin conseguia autoeditar o próprio salário/cargo/gestor
-- direto pela API.
CREATE OR REPLACE FUNCTION public.profiles_prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT current_user_is_admin() THEN
    NEW.role := OLD.role;
    NEW.companies := OLD.companies;
    NEW.sectors := OLD.sectors;
    NEW.salary := OLD.salary;
    NEW.supervisor_id := OLD.supervisor_id;
    NEW.employee_status := OLD.employee_status;
    NEW.job_title := OLD.job_title;
    NEW.department := OLD.department;
    NEW.contract_type := OLD.contract_type;
    NEW.admission_date := OLD.admission_date;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_prevent_self_role_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_prevent_self_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_prevent_self_role_escalation();
