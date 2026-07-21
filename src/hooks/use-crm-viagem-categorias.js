import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

export function useCRMViagemCategorias({ userId } = {}) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading]       = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("crm_viagem_categorias").select("*").eq("ativo", true).order("nome", { ascending: true });
      if (!activeRef.current) return;
      setCategorias(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channelName = `crm-viagem-categorias-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_viagem_categorias" }, debouncedFetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createCategoria = useCallback(async (nome) => {
    const { data: nova, error } = await supabase.from("crm_viagem_categorias").insert({ nome, created_by: userId }).select().single();
    if (error) throw new Error(error.message);
    setCategorias(prev => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
    return nova;
  }, [userId]);

  const desativarCategoria = useCallback(async (id) => {
    const { error } = await supabase.from("crm_viagem_categorias").update({ ativo: false }).eq("id", id);
    if (error) throw new Error(error.message);
    setCategorias(prev => prev.filter(c => c.id !== id));
  }, []);

  return { categorias, loading, createCategoria, desativarCategoria, refetch: fetchAll };
}
