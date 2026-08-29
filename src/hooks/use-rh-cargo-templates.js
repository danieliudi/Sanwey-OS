import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

export function useRHCargoTemplates({ userId } = {}) {
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_cargo_templates").select("*").order("name", { ascending: true });
      if (!isActive()) return;
      setCargos(data || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const channelName = `rh-cargo-templates-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_cargo_templates" }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
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
    const { data, error } = await supabase.from("rh_cargo_templates").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o cargo — verifique suas permissões.");
    setCargos(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const deleteCargo = useCallback(async (id) => {
    const { error } = await supabase.from("rh_cargo_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setCargos(prev => prev.filter(c => c.id !== id));
  }, []);

  return { cargos, loading, createCargo, updateCargo, deleteCargo, refetch: fetchAll };
}
