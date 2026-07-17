import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Bem-estar (Onda 4, item 12): sessões + fila FIFO. RH lê a fila inteira (com
// nomes, pra chamar); a entrada é sempre pela RPC pública anônima.
export function useRHBemEstar({ userId } = {}) {
  const [sessoes, setSessoes] = useState([]);
  const [fila, setFila] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: sData }, { data: fData }] = await Promise.all([
        supabase.from("rh_bemestar_sessoes").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_bemestar_fila").select("*").order("senha", { ascending: true }),
      ]);
      if (!activeRef.current) return;
      setSessoes(sData || []);
      setFila(fData || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(`rh-bemestar-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_bemestar_sessoes" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_bemestar_fila" }, fetchAll)
      .subscribe();
    return () => { activeRef.current = false; supabase.removeChannel(channel); };
  }, [fetchAll]);

  const criarSessao = useCallback(async (data) => {
    const row = { titulo: data.titulo, descricao: data.descricao || null, data: data.data || null, created_by: userId };
    const { data: nova, error } = await supabase.from("rh_bemestar_sessoes").insert(row).select().single();
    if (error) throw new Error(error.message);
    setSessoes(prev => [nova, ...prev]);
    return nova;
  }, [userId]);

  const setSessaoStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from("rh_bemestar_sessoes").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    setSessoes(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const deletarSessao = useCallback(async (id) => {
    const { error } = await supabase.from("rh_bemestar_sessoes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setSessoes(prev => prev.filter(s => s.id !== id));
  }, []);

  const setFilaStatus = useCallback(async (id, status) => {
    const patch = { status };
    if (status === "chamado") patch.called_at = new Date().toISOString();
    const { error } = await supabase.from("rh_bemestar_fila").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setFila(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  // Chama o próximo da fila (menor senha ainda 'na_fila').
  const chamarProximo = useCallback(async (sessaoId) => {
    const proximo = fila
      .filter(f => f.sessao_id === sessaoId && f.status === "na_fila")
      .sort((a, b) => a.senha - b.senha)[0];
    if (!proximo) return null;
    await setFilaStatus(proximo.id, "chamado");
    return proximo;
  }, [fila, setFilaStatus]);

  return useMemo(() => ({
    sessoes, fila, loading,
    criarSessao, setSessaoStatus, deletarSessao, setFilaStatus, chamarProximo,
    refetch: fetchAll,
  }), [sessoes, fila, loading, criarSessao, setSessaoStatus, deletarSessao, setFilaStatus, chamarProximo, fetchAll]);
}
