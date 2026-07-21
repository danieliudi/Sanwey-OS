import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Movimentações de cargo/salário (Onda 3, itens 8+9): histórico + fluxo de
// aprovação da diretoria. Nasce 'pendente'; a aprovação (RPC, só diretoria)
// aplica o salário/cargo no cadastro do colaborador de forma atômica.
export function useRHMovimentacoes({ userId } = {}) {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_movimentacoes").select("*").order("created_at", { ascending: false });
      if (!activeRef.current) return;
      setMovimentacoes(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channelName = `rh-movimentacoes-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_movimentacoes" }, debouncedFetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  // Cria uma movimentação PENDENTE. Snapshot do estado anterior fica na própria
  // linha (salario_anterior/cargo_anterior), então o histórico não depende de
  // quando o colaborador for lido depois.
  const createMovimentacao = useCallback(async (data) => {
    const row = {
      colaborador_id: data.colaboradorId,
      tipo: data.tipo || "promocao",
      cargo_anterior: data.cargoAnterior ?? null,
      cargo_novo: data.cargoNovo ?? null,
      department_anterior: data.departmentAnterior ?? null,
      department_novo: data.departmentNovo ?? null,
      salario_anterior: data.salarioAnterior ?? null,
      salario_novo: data.salarioNovo ?? null,
      effective_date: data.effectiveDate || null,
      motivo: data.motivo || null,
      avaliacao_id: data.avaliacaoId ?? null,
      requested_by: userId ?? null,
      status: "pendente",
    };
    const { data: novo, error } = await supabase.from("rh_movimentacoes").insert(row).select().single();
    if (error) throw new Error(error.message);
    setMovimentacoes(prev => [novo, ...prev]);
    return novo;
  }, [userId]);

  const aprovar = useCallback(async (id) => {
    const { data, error } = await supabase.rpc("approve_rh_movimentacao", { p_id: id });
    if (error) throw new Error(error.message);
    const updated = Array.isArray(data) ? data[0] : data;
    if (updated) setMovimentacoes(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
    return updated;
  }, []);

  const recusar = useCallback(async (id, motivo) => {
    const { data, error } = await supabase.rpc("reject_rh_movimentacao", { p_id: id, p_motivo: motivo || null });
    if (error) throw new Error(error.message);
    const updated = Array.isArray(data) ? data[0] : data;
    if (updated) setMovimentacoes(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
    return updated;
  }, []);

  return useMemo(() => ({
    movimentacoes,
    loading,
    createMovimentacao,
    aprovar,
    recusar,
    refetch: fetchAll,
  }), [movimentacoes, loading, createMovimentacao, aprovar, recusar, fetchAll]);
}
