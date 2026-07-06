import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function useCRMViagens({ userId } = {}) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]     = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("crm_viagem_registros").select("*").order("data_planejada", { ascending: false });
      if (!activeRef.current) return;
      setRegistros(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("crm-viagem-registros")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_viagem_registros" }, fetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
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
    const { error } = await supabase.from("crm_viagem_registros").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
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
