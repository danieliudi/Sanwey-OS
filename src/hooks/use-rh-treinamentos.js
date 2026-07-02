import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function useRHTreinamentos({ userId } = {}) {
  const [treinamentos, setTreinamentos] = useState([]);
  const [atribuicoes, setAtribuicoes]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: trData }, { data: atrData }] = await Promise.all([
        supabase.from("rh_treinamentos").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_treinamento_atribuicoes").select("*").order("created_at", { ascending: false }),
      ]);
      if (!activeRef.current) return;
      setTreinamentos(trData || []);
      setAtribuicoes(atrData || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("rh-treinamentos")
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_treinamentos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_treinamento_atribuicoes" }, fetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createTreinamento = useCallback(async (data) => {
    const row = { ...data, created_by: userId };
    const { data: novo, error } = await supabase.from("rh_treinamentos").insert(row).select().single();
    if (error) throw new Error(error.message);
    setTreinamentos(prev => [novo, ...prev]);
    return novo;
  }, [userId]);

  const assignToUsers = useCallback(async (treinamentoId, colaboradorIds) => {
    const rows = colaboradorIds.map(colaboradorId => ({ treinamento_id: treinamentoId, colaborador_id: colaboradorId, created_by: userId }));
    const { data: novas, error } = await supabase
      .from("rh_treinamento_atribuicoes")
      .upsert(rows, { onConflict: "treinamento_id,colaborador_id", ignoreDuplicates: true })
      .select();
    if (error) throw new Error(error.message);
    await fetchAll();
    return novas;
  }, [userId, fetchAll]);

  const updateAtribuicaoStatus = useCallback(async (atribuicaoId, status) => {
    const patch = { status, data_conclusao: status === "concluido" ? new Date().toISOString() : null };
    const { error } = await supabase.from("rh_treinamento_atribuicoes").update(patch).eq("id", atribuicaoId);
    if (error) throw new Error(error.message);
    setAtribuicoes(prev => prev.map(a => a.id === atribuicaoId ? { ...a, ...patch } : a));
  }, []);

  return useMemo(() => ({
    treinamentos,
    atribuicoes,
    loading,
    createTreinamento,
    assignToUsers,
    updateAtribuicaoStatus,
    refetch: fetchAll,
  }), [treinamentos, atribuicoes, loading, createTreinamento, assignToUsers, updateAtribuicaoStatus, fetchAll]);
}
