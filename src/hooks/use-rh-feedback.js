import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function useRHFeedback({ userId } = {}) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading]     = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_avaliacoes").select("*").order("created_at", { ascending: false });
      if (!activeRef.current) return;
      setFeedbacks(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("rh-feedback")
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_avaliacoes" }, fetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createFeedback = useCallback(async (data) => {
    const today = new Date().toISOString().slice(0, 10);
    const row = {
      user_id: data.colaboradorId,
      evaluator_id: userId,
      cycle: data.tipo,
      tipo: data.tipo,
      period_start: today,
      period_end: today,
      status: "concluido",
      final_rating: data.notaGeral ?? null,
      conteudo: { pontos_fortes: data.pontosFortes || "", pontos_desenvolvimento: data.pontosDesenvolvimento || "" },
      notes: data.notas || null,
    };
    const { data: novo, error } = await supabase.from("rh_avaliacoes").insert(row).select().single();
    if (error) throw new Error(error.message);
    setFeedbacks(prev => [novo, ...prev]);
    return novo;
  }, [userId]);

  return useMemo(() => ({
    feedbacks,
    loading,
    createFeedback,
    refetch: fetchAll,
  }), [feedbacks, loading, createFeedback, fetchAll]);
}
