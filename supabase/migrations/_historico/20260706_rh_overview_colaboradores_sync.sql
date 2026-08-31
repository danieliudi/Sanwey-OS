-- RHOverviewView lia contagem de funcionário, admissão e departamento
-- direto de "profiles" — campos que nunca foram preenchidos por nenhuma
-- tela (job_title/department/admission_date em profiles são vestigiais de
-- antes de rh_colaboradores existir). Na prática isso deixava "Admissões
-- Recentes" e "Distribuição por Departamento" sempre vazios, e contava só
-- quem tem login, ignorando quem foi cadastrado via "Novo Funcionário".
--
-- Correção: rh_colaboradores passa a ser a fonte única também pra quem tem
-- login — todo profile ganha um rh_colaboradores correspondente (backfill
-- + trigger pra manter sincronizado daqui pra frente).

-- 1. No máximo um rh_colaboradores por profile_id (múltiplos com
--    profile_id NULL continuam permitidos — UNIQUE não considera NULL
--    igual a NULL em Postgres).
ALTER TABLE public.rh_colaboradores
  DROP CONSTRAINT IF EXISTS rh_colaboradores_profile_id_key;
ALTER TABLE public.rh_colaboradores
  ADD CONSTRAINT rh_colaboradores_profile_id_key UNIQUE (profile_id);

-- 2. Backfill: profiles que ainda não têm um rh_colaboradores correspondente.
INSERT INTO public.rh_colaboradores (profile_id, full_name, email, employee_status)
SELECT p.id, p.name, p.email, 'ativo'
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id);

-- 3. Mantém sincronizado: todo profile novo (aceitou convite, criou conta)
--    ganha automaticamente um rh_colaboradores.
CREATE OR REPLACE FUNCTION public.sync_profile_to_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rh_colaboradores (profile_id, full_name, email, employee_status)
  VALUES (NEW.id, NEW.name, NEW.email, 'ativo')
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_sync_colaborador ON public.profiles;
CREATE TRIGGER on_profile_created_sync_colaborador
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_colaborador();
