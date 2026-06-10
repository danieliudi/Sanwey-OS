import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_deliverables";

function rowToDeliverable(r) {
  return {
    id:             r.id,
    companyIds:     Array.isArray(r.company_ids) ? r.company_ids : [],
    campaignId:     r.campaign_id ?? null,

    // Formulário Inicial
    title:          r.title,
    requesterName:  r.requester_name ?? null,
    department:     r.department ?? null,
    description:    r.description ?? null,
    priority:       r.priority ?? "media",
    deadline:       r.deadline ?? null,

    // Etapa
    stage:          r.stage,
    stageChangedAt: r.stage_changed_at ?? null,

    // Top-level assignee (responsible — shown on card)
    assignee:       r.assignee ?? null,

    // Stage-specific data (all stages keyed by stage id)
    stageData:      r.stage_data ?? {},

    // Padrão
    starred:        r.starred ?? false,
    activities:     Array.isArray(r.activities) ? r.activities : [],
    notes:          Array.isArray(r.notes) ? r.notes : [],
    createdBy:      r.created_by ?? null,
    createdAt:      r.created_at ?? null,
    updatedAt:      r.updated_at ?? null,
  };
}

function deliverableToRow(d, extras = {}) {
  return {
    company_ids:      d.companyIds ?? [],
    campaign_id:      d.campaignId ?? null,

    title:            d.title,
    requester_name:   d.requesterName ?? null,
    department:       d.department ?? null,
    description:      d.description ?? null,
    priority:         d.priority ?? "media",
    deadline:         d.deadline ?? null,

    stage:            d.stage ?? "solicitacao",
    stage_changed_at: d.stageChangedAt ?? new Date().toISOString(),

    assignee:         d.assignee ?? null,
    stage_data:       d.stageData ?? {},

    starred:          d.starred ?? false,
    activities:       d.activities ?? [],
    notes:            d.notes ?? [],
    ...extras,
  };
}

export function useMarketingDeliverables({ userId, role } = {}) {
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const canWrite =
    role === "admin" ||
    role === "marketing" ||
    role === "gerente_marketing";

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
      setDeliverables((data || []).map(rowToDeliverable));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("marketing_deliverables_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "INSERT") {
          setDeliverables(prev =>
            prev.some(d => d.id === payload.new.id)
              ? prev.map(d => d.id === payload.new.id ? rowToDeliverable(payload.new) : d)
              : [rowToDeliverable(payload.new), ...prev]
          );
        } else if (payload.eventType === "UPDATE") {
          setDeliverables(prev => prev.map(d => d.id === payload.new.id ? rowToDeliverable(payload.new) : d));
        } else if (payload.eventType === "DELETE") {
          setDeliverables(prev => prev.filter(d => d.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createDeliverable = useCallback(async (deliverable) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = deliverableToRow(deliverable, { created_by: userId });
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (err) throw err;
    const created = rowToDeliverable(data);
    setDeliverables(prev => prev.some(d => d.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, [canWrite, userId]);

  const updateDeliverable = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = deliverables.find(d => d.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const row = deliverableToRow(merged);
    const { error: err } = await supabase.from(TABLE).update(row).eq("id", id);
    if (err) throw err;
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, [canWrite, deliverables]);

  const deleteDeliverable = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setDeliverables(prev => prev.filter(d => d.id !== id));
  }, [canWrite]);

  const changeStage = useCallback(async (id, stage) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const now      = new Date().toISOString();
    const current  = deliverables.find(d => d.id === id);
    const stageName = stage; // caller can pass a display name if needed
    const activity  = {
      type:        "stage_change",
      description: `Movido para ${stageName}`,
      at:          now,
    };
    const activities = [...(current?.activities || []), activity];
    const { error: err } = await supabase
      .from(TABLE)
      .update({ stage, stage_changed_at: now, activities })
      .eq("id", id);
    if (err) throw err;
    setDeliverables(prev =>
      prev.map(d => d.id === id ? { ...d, stage, stageChangedAt: now, activities } : d)
    );
  }, [canWrite, deliverables]);

  const toggleStar = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = deliverables.find(d => d.id === id);
    if (!current) return;
    const starred = !current.starred;
    const { error: err } = await supabase.from(TABLE).update({ starred }).eq("id", id);
    if (err) throw err;
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, starred } : d));
  }, [canWrite, deliverables]);

  return {
    deliverables,
    loading,
    error,
    canWrite,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    changeStage,
    toggleStar,
    refetch: fetchAll,
  };
}
