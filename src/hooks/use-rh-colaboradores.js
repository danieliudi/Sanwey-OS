import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Mapeia snake_case do banco para camelCase — mesmo padrão de use-leads.js.
function rowToColaborador(r) {
  return {
    id: r.id,
    profileId: r.profile_id,
    fullName: r.full_name,
    cpf: r.cpf,
    rg: r.rg,
    birthDate: r.birth_date,
    phone: r.phone,
    email: r.email,
    addressStreet: r.address_street,
    addressNumber: r.address_number,
    addressComplement: r.address_complement,
    addressNeighborhood: r.address_neighborhood,
    addressCity: r.address_city,
    addressState: r.address_state,
    addressZip: r.address_zip,
    jobTitle: r.job_title,
    department: r.department,
    contractType: r.contract_type,
    admissionDate: r.admission_date,
    employeeStatus: r.employee_status,
    salary: r.salary,
    documentType: r.document_type,
    documentPath: r.document_path,
    notes: r.notes,
    vagaId: r.vaga_id,
    onboardingStage: r.onboarding_stage,
    onboardingStageChangedAt: r.onboarding_stage_changed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function colaboradorToRow(c, extras = {}) {
  return {
    profile_id: c.profileId ?? null,
    full_name: c.fullName,
    cpf: c.cpf || null,
    rg: c.rg || null,
    birth_date: c.birthDate || null,
    phone: c.phone || null,
    email: c.email || null,
    address_street: c.addressStreet || null,
    address_number: c.addressNumber || null,
    address_complement: c.addressComplement || null,
    address_neighborhood: c.addressNeighborhood || null,
    address_city: c.addressCity || null,
    address_state: c.addressState || null,
    address_zip: c.addressZip || null,
    job_title: c.jobTitle || null,
    department: c.department || null,
    contract_type: c.contractType || null,
    admission_date: c.admissionDate || null,
    employee_status: c.employeeStatus || "ativo",
    salary: c.salary != null && c.salary !== "" ? Number(c.salary) : null,
    document_type: c.documentType || null,
    document_path: c.documentPath || null,
    notes: c.notes || null,
    vaga_id: c.vagaId || null,
    ...extras,
  };
}

export function useRHColaboradores({ userId } = {}) {
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_colaboradores").select("*").order("full_name", { ascending: true });
      if (!activeRef.current) return;
      setColaboradores((data || []).map(rowToColaborador));
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("rh-colaboradores")
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_colaboradores" }, fetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createColaborador = useCallback(async (data) => {
    const row = colaboradorToRow(data, { created_by: userId });
    const { data: novo, error } = await supabase.from("rh_colaboradores").insert(row).select().single();
    if (error) throw new Error(error.message);
    const mapped = rowToColaborador(novo);
    setColaboradores(prev => [...prev, mapped].sort((a, b) => a.fullName.localeCompare(b.fullName)));
    return mapped;
  }, [userId]);

  const updateColaborador = useCallback(async (id, patch) => {
    const dbPatch = colaboradorToRow({ ...colaboradores.find(c => c.id === id), ...patch }, { updated_at: new Date().toISOString() });
    const { error } = await supabase.from("rh_colaboradores").update(dbPatch).eq("id", id);
    if (error) throw new Error(error.message);
    setColaboradores(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, [colaboradores]);

  const deleteColaborador = useCallback(async (id) => {
    const { error } = await supabase.from("rh_colaboradores").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setColaboradores(prev => prev.filter(c => c.id !== id));
  }, []);

  const changeOnboardingStage = useCallback(async (id, stage) => {
    const patch = { onboarding_stage: stage, onboarding_stage_changed_at: new Date().toISOString() };
    const { error } = await supabase.from("rh_colaboradores").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setColaboradores(prev => prev.map(c => c.id === id ? { ...c, onboardingStage: stage, onboardingStageChangedAt: patch.onboarding_stage_changed_at } : c));
  }, []);

  return { colaboradores, loading, createColaborador, updateColaborador, deleteColaborador, changeOnboardingStage, refetch: fetchAll };
}
