-- Painel do colaborador (Onda 5): fundação pro papel "portal" — quem tem
-- login mas nenhum cargo operacional (ex.: Engenharia, hoje sem função na
-- plataforma). Acessa só /meu-rh. Não reaproveita o nome "colaborador"
-- porque esse termo já significa "funcionário" no sistema (rh_colaboradores
-- cobre todo mundo, inclusive quem nunca vai logar).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_roles_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_roles_check
  CHECK (roles <@ ARRAY['admin','gerente','vendedor','consultor','marketing','gerente_marketing','agencia','rh','gerente_rh','portal']::text[]);

-- Achado da pesquisa: RHOnboardingView/RHTreinamentosView/RHFeedbackView já
-- tentam mostrar "meu checklist/treinamento/avaliação" pra quem não é RH,
-- derivando de `colaboradores.find(c => c.profileId === currentUser.id)` —
-- mas `useRHColaboradores` faz um select("*") sem filtro, e a ÚNICA policy
-- de rh_colaboradores é RH-only. Pra não-RH, `colaboradores` sempre vem
-- vazio: essas telas "próprias" já estavam quebradas em produção antes
-- desta migration, não é regressão introduzida agora.
--
-- Não reabre a policy de self-select ampla que foi removida de propósito em
-- 20260713_fix_rh_colaboradores_self_select_scope.sql (vazava salary, notes,
-- document_path, campos de desligamento). Em vez disso, uma função
-- SECURITY DEFINER com lista de colunas fechada — RLS do Postgres não
-- restringe coluna, só linha, então column-level scoping só dá pra fazer
-- assim (ou com uma view; função fica mais perto do padrão já usado no
-- projeto pra leitura escopada, ex. is_own_colaborador).
CREATE OR REPLACE FUNCTION public.get_my_colaborador()
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
  profile_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, full_name, cpf, rg, birth_date, phone, email,
         address_street, address_number, address_complement, address_neighborhood,
         address_city, address_state, address_zip,
         job_title, department, contract_type, admission_date, employee_status, frente, profile_id
  FROM public.rh_colaboradores
  WHERE profile_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_colaborador() TO authenticated;

-- Correção adjacente (achada ao mexer em RLS de férias pro painel do
-- colaborador): rh_ferias_read/insert/update ainda checavam profiles.role
-- (cargo ESCALAR) em vez do array roles — mesma classe de bug já corrigida
-- em outras tabelas nesta sessão (rh_attachments, cotações de marketing).
-- Quem tem rh/gerente_rh/admin como cargo SECUNDÁRIO não conseguia
-- gerenciar férias de ninguém, mesmo tendo o cargo.
DROP POLICY IF EXISTS rh_ferias_read ON public.rh_ferias;
CREATE POLICY rh_ferias_read ON public.rh_ferias
  FOR SELECT USING (
    user_id = auth.uid()
    OR current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );

DROP POLICY IF EXISTS rh_ferias_insert ON public.rh_ferias;
CREATE POLICY rh_ferias_insert ON public.rh_ferias
  FOR INSERT WITH CHECK (
    (
      user_id = auth.uid()
      AND status = 'pendente'
      AND approved_by IS NULL
      AND approved_at IS NULL
    )
    OR current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );

DROP POLICY IF EXISTS rh_ferias_update ON public.rh_ferias;
CREATE POLICY rh_ferias_update ON public.rh_ferias
  FOR UPDATE USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );
