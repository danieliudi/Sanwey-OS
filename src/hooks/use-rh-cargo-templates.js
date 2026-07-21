import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

export function useRHCargoTemplates({ userId } = {}) {
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_cargo_templates").select("*").order("name", { ascending: true });
      if (!activeRef.current) return;
      setCargos(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channelName = `rh-cargo-templates-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_cargo_templates" }, debouncedFetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createCargo = useCallback(async (data) => {
    const row = { ...data, created_by: userId };
    const { data: novo, error } = await supabase.from("rh_cargo_templates").insert(row).select().single();
    if (error) throw new Error(error.message);
    setCargos(prev => [...prev, novo].sort((a, b) => a.name.localeCompare(b.name)));
    return novo;
  }, [userId]);

  const updateCargo = useCallback(async (id, patch) => {
    const { error } = await supabase.from("rh_cargo_templates").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    setCargos(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const deleteCargo = useCallback(async (id) => {
    const { error } = await supabase.from("rh_cargo_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setCargos(prev => prev.filter(c => c.id !== id));
  }, []);

  return { cargos, loading, createCargo, updateCargo, deleteCargo, refetch: fetchAll };
}
