import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "rh_pipeline_stages";

function rowToStage(r) {
  return {
    id: r.id,
    domain: r.domain,
    stageKey: r.stage_key,
    name: r.name,
    color: r.color,
    orderIdx: r.order_idx ?? 0,
    probability: r.probability,
    slaDays: r.sla_days,
    terminal: Boolean(r.terminal),
    won: Boolean(r.won),
    lost: Boolean(r.lost),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function stageToRow(s) {
  return {
    stage_key: s.stageKey,
    name: s.name,
    color: s.color,
    order_idx: s.orderIdx ?? 0,
    probability: s.probability,
    sla_days: s.slaDays,
    terminal: !!s.terminal,
    won: !!s.won,
    lost: !!s.lost,
  };
}

export function useRHPipelineStages(domain) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("domain", domain)
        .order("order_idx", { ascending: true });
      if (err) throw err;
      if (!activeRef.current) return;
      setStages((data || []).map(rowToStage));
    } catch (e) {
      if (!activeRef.current) return;
      setError(e);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    activeRef.current = true;
    if (!isSupabaseConfigured) { setLoading(false); return; }
    fetchAll();
    // Nome de canal único por instância — evita colisão quando o hook é
    // usado por múltiplos componentes ao mesmo tempo.
    const channelName = `rh-pipeline-stages-${domain}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (!activeRef.current) return;
        const matches = payload.new?.domain === domain || payload.old?.domain === domain;
        if (!matches) return;
        if (payload.eventType === "DELETE") {
          setStages(prev => prev.filter(s => s.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          setStages(prev => prev.some(s => s.id === payload.new.id)
            ? prev
            : [...prev, rowToStage(payload.new)].sort((a, b) => a.orderIdx - b.orderIdx));
        } else if (payload.eventType === "UPDATE") {
          setStages(prev => prev
            .map(s => s.id === payload.new.id ? rowToStage(payload.new) : s)
            .sort((a, b) => a.orderIdx - b.orderIdx));
        }
      })
      .subscribe();
    return () => { activeRef.current = false; supabase.removeChannel(channel); };
  }, [fetchAll, domain]);

  const addStage = useCallback(async (stage) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const row = { ...stageToRow(stage), domain };
    const { data, error: err } = await supabase
      .from(TABLE).insert(row).select().single();
    if (err) throw err;
    return rowToStage(data);
  }, [domain]);

  const updateStage = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const row = stageToRow({ ...patch });
    // Remove chaves undefined para não sobrescrever com NULL.
    Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
    const { error: err } = await supabase
      .from(TABLE).update(row).eq("id", id);
    if (err) throw err;
  }, []);

  const deleteStage = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const { error: err } = await supabase
      .from(TABLE).delete().eq("id", id);
    if (err) throw err;
  }, []);

  const reorderStages = useCallback(async (orderedIds) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    // Atualiza order_idx em sequência.
    await Promise.all(orderedIds.map((id, idx) =>
      supabase.from(TABLE).update({ order_idx: idx }).eq("id", id)
    ));
  }, []);

  return {
    stages: [...stages].sort((a, b) => a.orderIdx - b.orderIdx),
    loading,
    error,
    addStage,
    updateStage,
    deleteStage,
    reorderStages,
    refetch: fetchAll,
  };
}

export default useRHPipelineStages;
