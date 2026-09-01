import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";
import { toLocalISODate } from "../utils/date";

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
    frente: r.frente,
    contractType: r.contract_type,
    admissionDate: r.admission_date,
    periodoExperienciaDias: r.periodo_experiencia_dias,
    employeeStatus: r.employee_status,
    salary: r.salary,
    documentType: r.document_type,
    documentPath: r.document_path,
    notes: r.notes,
    vagaId: r.vaga_id,
    asoVencimento: r.aso_vencimento,
    contratoFim: r.contrato_fim,
    aprendizInicio: r.aprendiz_inicio,
    aprendizFim: r.aprendiz_fim,
    desligamentoDate: r.desligamento_date,
    desligamentoTipo: r.desligamento_tipo,
    desligamentoMotivo: r.desligamento_motivo,
    desligamentoMeta: r.desligamento_meta && typeof r.desligamento_meta === "object" ? r.desligamento_meta : {},
    onboardingStage: r.onboarding_stage,
    onboardingStageChangedAt: r.onboarding_stage_changed_at,
    customFields: r.custom_fields && typeof r.custom_fields === "object" ? r.custom_fields : {},
    activities: Array.isArray(r.activities) ? r.activities : [],
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
    frente: c.frente || null,
    contract_type: c.contractType || null,
    admission_date: c.admissionDate || null,
    periodo_experiencia_dias: c.periodoExperienciaDias != null && c.periodoExperienciaDias !== ""
      ? Number(c.periodoExperienciaDias) : null,
    employee_status: c.employeeStatus || "ativo",
    salary: c.salary != null && c.salary !== "" ? Number(c.salary) : null,
    document_type: c.documentType || null,
    document_path: c.documentPath || null,
    notes: c.notes || null,
    vaga_id: c.vagaId || null,
    aso_vencimento: c.asoVencimento || null,
    contrato_fim: c.contratoFim || null,
    aprendiz_inicio: c.aprendizInicio || null,
    aprendiz_fim: c.aprendizFim || null,
    desligamento_date: c.desligamentoDate || null,
    ...(c.desligamentoTipo !== undefined ? { desligamento_tipo: c.desligamentoTipo || null } : {}),
    ...(c.desligamentoMotivo !== undefined ? { desligamento_motivo: c.desligamentoMotivo || null } : {}),
    ...(c.desligamentoMeta !== undefined ? { desligamento_meta: c.desligamentoMeta && typeof c.desligamentoMeta === "object" ? c.desligamentoMeta : {} } : {}),
    custom_fields: c.customFields && typeof c.customFields === "object" ? c.customFields : {},
    activities: Array.isArray(c.activities) ? c.activities : [],
    // Opcionais — omitidos quando ausentes pra não sobrescrever o default da
    // coluna (primeira etapa) no fluxo de contratação, que nunca informa isso.
    ...(c.onboardingStage ? { onboarding_stage: c.onboardingStage } : {}),
    ...(c.onboardingStageChangedAt ? { onboarding_stage_changed_at: c.onboardingStageChangedAt } : {}),
    ...extras,
  };
}

export function useRHColaboradores({ userId, enabled = true } = {}) {
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_colaboradores").select("*").order("full_name", { ascending: true });
      if (!isActive()) return;
      setColaboradores((data || []).map(rowToColaborador));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled) { setLoading(false); return; }
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channelName = `rh-colaboradores-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_colaboradores" }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll, enabled]);

  const createColaborador = useCallback(async (data) => {
    const row = colaboradorToRow(data, { created_by: userId });
    const { data: novo, error } = await supabase.from("rh_colaboradores").insert(row).select().single();
    if (error) throw new Error(error.message);
    const mapped = rowToColaborador(novo);
    setColaboradores(prev => [...prev, mapped].sort((a, b) => a.fullName.localeCompare(b.fullName)));
    return mapped;
  }, [userId]);

  const updateColaborador = useCallback(async (id, patch) => {
    const current = colaboradores.find(c => c.id === id);
    // Marca a data de desligamento automaticamente na primeira vez que o
    // status vira "desligado" — usada só pra estimar aviso-prévio, não
    // sobrescreve se já tiver sido definida (ex: ajuste manual do RH).
    const merged = { ...current, ...patch };
    if (merged.employeeStatus === "desligado" && !merged.desligamentoDate) {
      merged.desligamentoDate = toLocalISODate(new Date());
    }
    const dbPatch = colaboradorToRow(merged, { updated_at: new Date().toISOString() });
    const { data, error } = await supabase.from("rh_colaboradores").update(dbPatch).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar este colaborador.");
    setColaboradores(prev => prev.map(c => c.id === id ? merged : c));
  }, [colaboradores]);

  const changeOnboardingStage = useCallback(async (id, stage) => {
    const patch = { onboarding_stage: stage, onboarding_stage_changed_at: new Date().toISOString() };
    const { data, error } = await supabase.from("rh_colaboradores").update(patch).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar este colaborador.");
    setColaboradores(prev => prev.map(c => c.id === id ? { ...c, onboardingStage: stage, onboardingStageChangedAt: patch.onboarding_stage_changed_at } : c));
  }, []);

  // Exclui o REGISTRO de RH (rh_colaboradores) — pedido do Daniel (30/07/2026:
  // "a plataforma está criando uns funcionários/usuários estranhos, inclusive
  // testes"). Já é permitido hoje pela RLS existente (rh_colaboradores_rh_access,
  // FOR ALL pra admin/gerente_rh/rh — 20260703_rh_colaboradores.sql), só
  // faltava o hook e o botão. NÃO mexe em profiles/auth.users — quem tem
  // login vinculado (profileId) continua exigindo a exclusão de CONTA
  // separada em Configurações → Usuários (ou o botão em RHFuncionariosView
  // que chama as duas em sequência) — nunca cascateia sozinho, pra não
  // apagar o histórico de RH de alguém só desligado.
  const deleteColaborador = useCallback(async (id) => {
    const { error } = await supabase.from("rh_colaboradores").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setColaboradores(prev => prev.filter(c => c.id !== id));
  }, []);

  return { colaboradores, loading, createColaborador, updateColaborador, changeOnboardingStage, deleteColaborador, refetch: fetchAll };
}
