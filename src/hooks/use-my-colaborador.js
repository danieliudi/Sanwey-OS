import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Lê a própria linha de rh_colaboradores (a do profile logado) via a função
// SECURITY DEFINER get_my_colaborador() — lista de colunas fechada de
// propósito (sem salary/notes/document_path/desligamento_*, ver migration
// 20260740_colaborador_portal_role.sql; onboarding_stage adicionado em
// 20260789_get_my_colaborador_onboarding_stage.sql). Usado tanto pelas telas
// "próprias" de onboarding/treinamentos/avaliação quanto pelo painel do
// colaborador.
export function useMyColaborador(currentUser) {
  const [meuColaborador, setMeuColaborador] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchMeuColaborador = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_colaborador");
    const row = !error && Array.isArray(data) ? data[0] : null;
    setMeuColaborador(row ? {
      id: row.id,
      fullName: row.full_name,
      cpf: row.cpf,
      rg: row.rg,
      birthDate: row.birth_date,
      phone: row.phone,
      email: row.email,
      addressStreet: row.address_street,
      addressNumber: row.address_number,
      addressComplement: row.address_complement,
      addressNeighborhood: row.address_neighborhood,
      addressCity: row.address_city,
      addressState: row.address_state,
      addressZip: row.address_zip,
      jobTitle: row.job_title,
      department: row.department,
      contractType: row.contract_type,
      admissionDate: row.admission_date,
      employeeStatus: row.employee_status,
      frente: row.frente,
      profileId: row.profile_id,
      onboardingStage: row.onboarding_stage,
    } : null);
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => { fetchMeuColaborador(); }, [fetchMeuColaborador]);

  return { meuColaborador, loading, refetch: fetchMeuColaborador };
}

export default useMyColaborador;
