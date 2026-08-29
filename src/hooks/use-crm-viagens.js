import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

export function useCRMViagens({ userId } = {}) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]     = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("crm_viagem_registros").select("*").order("data_planejada", { ascending: false });
      if (!isActive()) return;
      setRegistros(data || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const channelName = `crm-viagem-registros-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_viagem_registros" }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createRegistro = useCallback(async (data) => {
    const row = { ...data, vendedor_id: userId, created_by: userId };
    const { data: novo, error } = await supabase.from("crm_viagem_registros").insert(row).select().single();
    if (error) throw new Error(error.message);
    setRegistros(prev => [novo, ...prev]);
    return novo;
  }, [userId]);

  const updateRegistro = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from("crm_viagem_registros").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar a visita — verifique suas permissões.");
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const marcarRealizado = useCallback(async (id, { destinoRealizado, resumoRealizado, dataRealizada }) => {
    await updateRegistro(id, {
      status: "realizado",
      destino_realizado: destinoRealizado || null,
      resumo_realizado: resumoRealizado || null,
      data_realizada: dataRealizada,
    });
  }, [updateRegistro]);

  const marcarNaoRealizado = useCallback(async (id, motivoDivergencia) => {
    await updateRegistro(id, { status: "nao_realizado", motivo_divergencia: motivoDivergencia || null });
  }, [updateRegistro]);

  const cancelarRegistro = useCallback(async (id) => {
    await updateRegistro(id, { status: "cancelado" });
  }, [updateRegistro]);

  const deleteRegistro = useCallback(async (id) => {
    const { error } = await supabase.from("crm_viagem_registros").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setRegistros(prev => prev.filter(r => r.id !== id));
  }, []);

  return {
    registros,
    loading,
    createRegistro,
    updateRegistro,
    marcarRealizado,
    marcarNaoRealizado,
    cancelarRegistro,
    deleteRegistro,
    refetch: fetchAll,
  };
}
