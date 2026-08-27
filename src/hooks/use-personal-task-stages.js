import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "personal_task_stages";

function rowToStage(r) {
  return {
    id: r.id,
    stageKey: r.stage_key,
    name: r.name,
    color: r.color,
    orderIdx: r.order_idx ?? 0,
    terminal: Boolean(r.terminal),
  };
}

// Mesmo formato de use-rh-pipeline-stages.js, mas escopado por usuário (não
// por domain/empresa) — RLS de personal_task_stages já garante o isolamento,
// então a query nem precisa filtrar por user_id explicitamente.
export function usePersonalTaskStages(userId) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setStages([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("order_idx", { ascending: true });
    if (!activeRef.current) return;
    if (!error) setStages((data || []).map(rowToStage));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    return () => { activeRef.current = false; };
  }, [fetchAll]);

  const addStage = useCallback(async (stage) => {
    if (!isSupabaseConfigured || !userId) throw new Error("Supabase não configurado");
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id: userId,
        stage_key: stage.stageKey,
        name: stage.name,
        color: stage.color,
        order_idx: stage.orderIdx ?? 0,
        terminal: !!stage.terminal,
      })
      .select().single();
    if (error) throw error;
    return rowToStage(data);
  }, [userId]);

  const updateStage = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const row = {};
    if ("name" in patch) row.name = patch.name;
    if ("color" in patch) row.color = patch.color;
    if ("orderIdx" in patch) row.order_idx = patch.orderIdx;
    if ("terminal" in patch) row.terminal = !!patch.terminal;
    const { error } = await supabase.from(TABLE).update(row).eq("id", id);
    if (error) throw error;
  }, []);

  const deleteStage = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  }, []);

  const reorderStages = useCallback(async (orderedIds) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    await Promise.all(orderedIds.map((id, idx) => supabase.from(TABLE).update({ order_idx: idx }).eq("id", id)));
  }, []);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.orderIdx - b.orderIdx), [stages]);

  return { stages: sortedStages, loading, addStage, updateStage, deleteStage, reorderStages, refetch: fetchAll };
}

export default usePersonalTaskStages;
