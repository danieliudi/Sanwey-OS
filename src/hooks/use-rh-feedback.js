import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const UNIQUE_VIOLATION = "23505";

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
    const channelName = `rh-feedback-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_avaliacoes" }, fetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  // Fluxo manual "Novo feedback": cria e já fecha num passo só (ad-hoc).
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

  // Ciclo automático (check-in de onboarding ou semestral recorrente): nasce
  // como rascunho, sem notas, esperando o RH (ou o colaborador) preencher.
  // Ignora violação de unicidade em silêncio — significa que outra aba/
  // outro RH já criou esse mesmo ciclo primeiro.
  const createPendingCycle = useCallback(async (colaboradorId, tipo, periodStart, periodEnd) => {
    const row = {
      user_id: colaboradorId,
      evaluator_id: userId,
      cycle: tipo,
      tipo,
      period_start: periodStart,
      period_end: periodEnd,
      status: "rascunho",
      conteudo: {},
    };
    const { data: novo, error } = await supabase.from("rh_avaliacoes").insert(row).select().single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return null;
      throw new Error(error.message);
    }
    setFeedbacks(prev => [novo, ...prev]);
    return novo;
  }, [userId]);

  // Fecha um ciclo pendente: preenche a avaliação do gestor e calcula a nota
  // final (média entre autoavaliação e avaliação do gestor, quando ambas
  // existirem — senão, a que estiver disponível).
  const completeFeedback = useCallback(async (avaliacaoId, data) => {
    const current = feedbacks.find(f => f.id === avaliacaoId);
    const selfRating = current?.self_rating ?? null;
    const managerRating = data.managerRating ?? null;
    const finalRating = selfRating != null && managerRating != null
      ? Math.round(((Number(selfRating) + Number(managerRating)) / 2) * 10) / 10
      : (managerRating ?? selfRating ?? null);
    const patch = {
      manager_rating: managerRating,
      final_rating: finalRating,
      conteudo: { pontos_fortes: data.pontosFortes || "", pontos_desenvolvimento: data.pontosDesenvolvimento || "" },
      notes: data.notas || null,
      status: "concluido",
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("rh_avaliacoes").update(patch).eq("id", avaliacaoId);
    if (error) throw new Error(error.message);
    setFeedbacks(prev => prev.map(f => f.id === avaliacaoId ? { ...f, ...patch } : f));
  }, [feedbacks]);

  // Autoavaliação: o próprio colaborador só pode tocar o campo self_rating,
  // por isso passa por uma RPC estreita em vez de update direto na tabela.
  const submitSelfRating = useCallback(async (avaliacaoId, rating) => {
    const { error } = await supabase.rpc("rh_submit_self_rating", { p_avaliacao_id: avaliacaoId, p_self_rating: rating });
    if (error) throw new Error(error.message);
    setFeedbacks(prev => prev.map(f => f.id === avaliacaoId ? { ...f, self_rating: rating } : f));
  }, []);

  return useMemo(() => ({
    feedbacks,
    loading,
    createFeedback,
    createPendingCycle,
    completeFeedback,
    submitSelfRating,
    refetch: fetchAll,
  }), [feedbacks, loading, createFeedback, createPendingCycle, completeFeedback, submitSelfRating, fetchAll]);
}
