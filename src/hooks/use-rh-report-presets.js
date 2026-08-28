import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Presets compartilhados pela empresa (decisão do Daniel, 23/07) — tabela
// rh_report_presets, RLS: RH escreve, diretoria lê.
export function useRHReportPresets({ userId } = {}) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_report_presets").select("*").order("name", { ascending: true });
      if (!isActive()) return;
      setPresets(data || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const channelName = `rh-report-presets-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_report_presets" }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createPreset = useCallback(async ({ name, metricKeys }) => {
    const { data: novo, error } = await supabase
      .from("rh_report_presets")
      .insert({ name, metric_keys: metricKeys, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setPresets(prev => [...prev, novo].sort((a, b) => a.name.localeCompare(b.name)));
    return novo;
  }, [userId]);

  const deletePreset = useCallback(async (id) => {
    const { error } = await supabase.from("rh_report_presets").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  return { presets, loading, createPreset, deletePreset, refetch: fetchAll };
}
