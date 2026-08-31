-- Estende a tag de frente do RH (sanwey/resibag/montemor) também para
-- colaboradores que têm login (profiles), no mesmo espírito de
-- job_title/department/admission_date/contract_type/employee_status —
-- campos de RH que já vivem em profiles só porque a pessoa também é
-- usuário do sistema, sem que isso vire um conceito do CRM/Marketing
-- (esses continuam usando só `companies`, ver src/constants/companies.js).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS frente text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_frente_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_frente_check
  CHECK (frente IS NULL OR frente IN ('sanwey', 'resibag', 'montemor'));

-- Mesmo guard anti-autoescalação de 20260713_fix_profiles_self_escalation_
-- gerente_and_columns.sql, agora cobrindo também `frente` — sem isso, um
-- colaborador não-admin poderia trocar a própria frente direto pela API.
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
    NEW.frente := OLD.frente;
  END IF;
  RETURN NEW;
END;
$$;

-- rh_colaboradores é a fonte única pra telas de RH mesmo pra quem tem login
-- (ver 20260706_rh_overview_colaboradores_sync.sql) — o sync automático
-- precisa levar frente junto, senão o par profiles/rh_colaboradores diverge
-- assim que alguém aceita um convite com frente já definida.
CREATE OR REPLACE FUNCTION public.sync_profile_to_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rh_colaboradores (profile_id, full_name, email, employee_status, frente)
  VALUES (NEW.id, NEW.name, NEW.email, 'ativo', NEW.frente)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;
