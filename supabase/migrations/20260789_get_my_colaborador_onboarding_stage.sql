-- Frente 1 (Onboarding some do menu do colaborador quando concluir): a tela
-- do colaborador (RHOnboardingView.jsx, branch !isRHUser) precisa saber a
-- própria etapa de onboarding pra decidir se a trilha já terminou. A ÚNICA
-- policy de leitura em rh_colaboradores hoje é RH-only
-- (rh_colaboradores_rh_access) + diretoria — não existe self-select desde
-- que 20260713_fix_rh_colaboradores_self_select_scope.sql removeu a policy
-- ampla (vazava salary/notes/document_path/desligamento). Reabrir o
-- self-select não é opção; em vez disso, estende a função SECURITY DEFINER
-- que já existe exatamente pra esse tipo de leitura escopada por coluna
-- (get_my_colaborador(), 20260740_colaborador_portal_role.sql) com mais uma
-- coluna. Aditivo: consumidores existentes acessam por nome, ninguém quebra
-- — mas mudar o RETURNS TABLE exige DROP + CREATE (Postgres não deixa trocar
-- o tipo de retorno via CREATE OR REPLACE quando é definido por OUT params).
DROP FUNCTION IF EXISTS public.get_my_colaborador();

CREATE FUNCTION public.get_my_colaborador()
RETURNS TABLE (
  id uuid,
  full_name text,
  cpf text,
  rg text,
  birth_date date,
  phone text,
  email text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zip text,
  job_title text,
  department text,
  contract_type text,
  admission_date date,
  employee_status text,
  frente text,
  profile_id uuid,
  onboarding_stage text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, full_name, cpf, rg, birth_date, phone, email,
         address_street, address_number, address_complement, address_neighborhood,
         address_city, address_state, address_zip,
         job_title, department, contract_type, admission_date, employee_status, frente, profile_id,
         onboarding_stage
  FROM public.rh_colaboradores
  WHERE profile_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_colaborador() TO authenticated;
