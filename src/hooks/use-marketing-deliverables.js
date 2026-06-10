import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_deliverables";

function rowToDeliverable(r) {
  return {
    id:             r.id,
    companyIds:     Array.isArray(r.company_ids) ? r.company_ids : [],
    campaignId:     r.campaign_id ?? null,
    title:          r.title,
    stage:          r.stage,
    stageChangedAt: r.stage_changed_at ?? null,
    assignee:       r.assignee ?? null,
    deadline:       r.deadline ?? null,
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
    stage:            d.stage ?? "pendente",
    stage_changed_at: d.stageChangedAt ?? new Date().toISOString(),
    assignee:         d.assignee ?? null,
    deadline:         d.deadline ?? null,
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
    // Optimistic: add immediately without waiting for real-time
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
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from(TABLE)
      .update({ stage, stage_changed_at: now })
      .eq("id", id);
    if (err) throw err;
    setDeliverables(prev =>
      prev.map(d => d.id === id ? { ...d, stage, stageChangedAt: now } : d)
    );
  }, [canWrite]);

  return {
    deliverables,
    loading,
    error,
    canWrite,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    changeStage,
    refetch: fetchAll,
  };
}
