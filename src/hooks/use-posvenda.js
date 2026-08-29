import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "posvenda_cases";

function rowToCase(r) {
  return {
    id:             r.id,
    companyId:      r.company_id,
    leadId:         r.lead_id,
    // Cliente do cadastro central. `clientName` continua sendo o texto livre
    // exibido (fallback pros casos sem vínculo) — `clientId` é o que liga o
    // caso à linha do tempo do cliente (FASE 3).
    clientId:       r.client_id ?? null,
    clientName:     r.client_name,
    value:          Number(r.value) || 0,
    ownerIds:       Array.isArray(r.owner_ids) ? r.owner_ids : [],
    stage:          r.stage,
    stageChangedAt: r.stage_changed_at ?? null,
    notes:          Array.isArray(r.notes) ? r.notes : [],
    customFields:   r.custom_fields || {},
    createdBy:      r.created_by ?? null,
    createdAt:      r.created_at ?? null,
    negotiationStartedAt: r.negotiation_started_at ?? null,
    updatedAt:      r.updated_at ?? null,
  };
}

function caseToRow(c) {
  return {
    company_id:       c.companyId,
    lead_id:          c.leadId ?? null,
    client_id:        c.clientId ?? null,
    client_name:      c.clientName,
    value:            c.value ?? 0,
    owner_ids:        c.ownerIds ?? [],
    stage:            c.stage ?? "onboarding_cliente",
    stage_changed_at: c.stageChangedAt ?? new Date().toISOString(),
    notes:            c.notes ?? [],
    custom_fields:    c.customFields ?? {},
    negotiation_started_at: c.negotiationStartedAt ?? null,
  };
}

export function usePosvenda({ userId, role, roles } = {}) {
  const [cases, setCases]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const roleList = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
  const canWrite = roleList.some(r => ["admin", "gerente", "vendedor"].includes(r));

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setCases((data || []).map(rowToCase));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channelName = `posvenda_cases_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "INSERT") {
          setCases(prev =>
            prev.some(c => c.id === payload.new.id)
              ? prev.map(c => c.id === payload.new.id ? rowToCase(payload.new) : c)
              : [rowToCase(payload.new), ...prev]
          );
        } else if (payload.eventType === "UPDATE") {
          setCases(prev => prev.map(c => c.id === payload.new.id ? rowToCase(payload.new) : c));
        } else if (payload.eventType === "DELETE") {
          setCases(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createCase = useCallback(async (kase) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = caseToRow(kase);
    row.created_by = userId;
    const { data, error: err } = await supabase.from(TABLE).insert(row).select().single();
    if (err) throw err;
    const created = rowToCase(data);
    setCases(prev => prev.some(c => c.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, [canWrite, userId]);

  const updateCase = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = cases.find(c => c.id === id);
    if (!current) return;
    const row = caseToRow({ ...current, ...patch });
    const { data, error: err } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (err) throw err;
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o caso de pós-venda — verifique suas permissões.");
    setCases(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, [canWrite, cases]);

  const deleteCase = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setCases(prev => prev.filter(c => c.id !== id));
  }, [canWrite]);

  const changeStage = useCallback(async (id, stage) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const now = new Date().toISOString();
    const { data, error: err } = await supabase
      .from(TABLE)
      .update({ stage, stage_changed_at: now })
      .eq("id", id)
      .select();
    if (err) throw err;
    // Zero linha = RLS barrou. Sem isso o card ficava na etapa nova só na
    // tela e voltava sozinho no próximo refetch, sem explicação.
    if (!data || data.length === 0) throw new Error("Não foi possível mover o caso de etapa — verifique suas permissões.");
    setCases(prev => prev.map(c => c.id === id ? { ...c, stage, stageChangedAt: now } : c));
  }, [canWrite]);

  return {
    cases,
    loading,
    error,
    canWrite,
    createCase,
    updateCase,
    deleteCase,
    changeStage,
    refetch: fetchAll,
  };
}

// Ação "Enviar para Pós-venda" — chamada de dentro do LeadDetailDrawer, um
// negócio (Ganho) por vez, sem precisar montar o hook inteiro (que também
// assina realtime de TODOS os cases da empresa) só pra um insert avulso.
// Mesma lógica do "Contratar" em Recrutamento: cria um registro NOVO aqui,
// o negócio de origem em `leads` continua existindo, só marcado como já
// enviado (ver App.jsx `updateLead` pro patch de `sentToPosvendaAt`).
export async function createPosvendaCaseFromLead(lead, userId) {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
  const row = caseToRow({
    companyId:  lead.companyId,
    leadId:     lead.id,
    // Herda o cliente já vinculado ao negócio — sem isto o caso nasceria sem
    // client_id mesmo vindo de um negócio que conhece o cliente (buraco 3).
    clientId:   lead.clientId ?? null,
    clientName: lead.company,
    value:      lead.value,
    ownerIds:   lead.ownerIds && lead.ownerIds.length ? lead.ownerIds : (lead.owner ? [lead.owner] : []),
    stage:      "onboarding_cliente",
  });
  row.created_by = userId;
  const { data, error: err } = await supabase.from(TABLE).insert(row).select().single();
  if (err) throw err;
  return rowToCase(data);
}

export default usePosvenda;
