import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Prestação de contas em lote: o vendedor agrupa despesas do mês num
// "envelope" e manda pro gestor decidir de uma vez. `enviado_em` nullable é
// o único controle de estado (NULL = rascunho, timestamp = enviada) — sem
// coluna de status separada, ver migration 20260827_crm_viagem_prestacoes.sql.
export function useCRMViagemPrestacoes({ userId, enabled = true } = {}) {
  const [prestacoes, setPrestacoes] = useState([]);
  const [loading, setLoading]       = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("crm_viagem_prestacoes").select("*").order("created_at", { ascending: false });
      if (!activeRef.current) return;
      setPrestacoes(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    activeRef.current = true;
    if (!enabled) { setLoading(false); return; }
    fetchAll();
    if (!isSupabaseConfigured) return;
    // Nome de canal único por instância (mesmo motivo de
    // use-crm-despesas.js/use-crm-viagens.js: um nome fixo colide quando a
    // tela de Planejamento e a de Gestão têm o hook montado ao mesmo tempo).
    const channelName = `crm-viagem-prestacoes-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_viagem_prestacoes" }, debouncedFetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll, enabled]);

  const createPrestacao = useCallback(async ({ titulo }) => {
    const row = { titulo, vendedor_id: userId };
    const { data: nova, error } = await supabase.from("crm_viagem_prestacoes").insert(row).select().single();
    if (error) throw new Error(error.message);
    setPrestacoes(prev => [nova, ...prev]);
    return nova;
  }, [userId]);

  const enviarPrestacao = useCallback(async (id) => {
    const patch = { enviado_em: new Date().toISOString() };
    const { error } = await supabase.from("crm_viagem_prestacoes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setPrestacoes(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const deletePrestacao = useCallback(async (id) => {
    const { error } = await supabase.from("crm_viagem_prestacoes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setPrestacoes(prev => prev.filter(p => p.id !== id));
  }, []);

  return {
    prestacoes,
    loading,
    createPrestacao,
    enviarPrestacao,
    deletePrestacao,
    refetch: fetchAll,
  };
}
