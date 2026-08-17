import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const UNIQUE_VIOLATION = "23505";

export function useRHFeedback({ userId, enabled = true } = {}) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading]     = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_avaliacoes").select("*").order("created_at", { ascending: false });
      if (!activeRef.current) return;
      setFeedbacks(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    activeRef.current = true;
    if (!enabled) { setLoading(false); return; }
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channelName = `rh-feedback-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_avaliacoes" }, debouncedFetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll, enabled]);

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
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Desfecho estruturado (Onda 2): promovido/mantido/reavaliar/reprovado +
    // contexto (salário antigo→novo, prazo de reavaliação). Os efeitos
    // colaterais (ajuste de salário, novo ciclo de reavaliação) ficam na tela,
    // onde updateColaborador/createPendingCycle estão disponíveis.
    if (data.desfecho !== undefined) patch.desfecho = data.desfecho || null;
    if (data.desfechoMeta !== undefined) patch.desfecho_meta = data.desfechoMeta || {};
    const { data: saved, error } = await supabase.from("rh_avaliacoes").update(patch).eq("id", avaliacaoId).select();
    if (error) throw new Error(error.message);
    if (!saved || saved.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta avaliação.");
    setFeedbacks(prev => prev.map(f => f.id === avaliacaoId ? { ...f, ...patch } : f));
  }, [feedbacks]);

  // Autoavaliação: o próprio colaborador só pode tocar o campo self_rating,
  // por isso passa por uma RPC estreita em vez de update direto na tabela.
  const submitSelfRating = useCallback(async (avaliacaoId, rating) => {
    const { error } = await supabase.rpc("rh_submit_self_rating", { p_avaliacao_id: avaliacaoId, p_self_rating: rating });
    if (error) throw new Error(error.message);
    setFeedbacks(prev => prev.map(f => f.id === avaliacaoId ? { ...f, self_rating: rating } : f));
  }, []);

  // Mover card entre rascunho/em_andamento no Kanban — mover pra "concluido"
  // passa pelo fluxo dedicado (CompletarFeedbackModal via completeFeedback),
  // não por aqui, já que fechar um ciclo exige preencher a nota do gestor.
  const changeFeedbackStage = useCallback(async (id, stage) => {
    const patch = { status: stage, status_changed_at: new Date().toISOString() };
    const { data, error } = await supabase.from("rh_avaliacoes").update(patch).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta avaliação.");
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const updateFeedbackCustomFields = useCallback(async (id, customFields) => {
    const { data, error } = await supabase.from("rh_avaliacoes").update({ custom_fields: customFields }).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta avaliação.");
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, custom_fields: customFields } : f));
  }, []);

  // Múltiplos avaliadores (FASE 5) — o trigger no banco só sincroniza
  // escalar → array (sempre garante que evaluator_id está em evaluator_ids),
  // nunca o inverso. Se mandássemos só evaluator_ids e o usuário tivesse
  // removido o avaliador escalar da lista, o trigger reinseriria esse id de
  // volta silenciosamente. Por isso escrevemos os dois: evaluator_id vira o
  // primeiro da lista (mesma convenção de "principal = primeiro" usada em
  // Leads/Campanhas/Compras).
  const updateFeedbackEvaluators = useCallback(async (id, evaluatorIds) => {
    const evaluatorId = evaluatorIds[0] || null;
    const { data, error } = await supabase.from("rh_avaliacoes").update({ evaluator_id: evaluatorId, evaluator_ids: evaluatorIds }).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta avaliação.");
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, evaluator_id: evaluatorId, evaluator_ids: evaluatorIds } : f));
  }, []);

  const deleteFeedback = useCallback(async (id) => {
    const { error } = await supabase.from("rh_avaliacoes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setFeedbacks(prev => prev.filter(f => f.id !== id));
  }, []);

  const addFeedbackActivity = useCallback(async (id, entry) => {
    const current = feedbacks.find(f => f.id === id);
    if (!current) return;
    const nextActivities = [...(Array.isArray(current.activities) ? current.activities : []), entry];
    const { data, error } = await supabase.from("rh_avaliacoes").update({ activities: nextActivities }).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta avaliação.");
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, activities: nextActivities } : f));
  }, [feedbacks]);

  const updateFeedbackActivity = useCallback(async (id, activityId, patch) => {
    const current = feedbacks.find(f => f.id === id);
    if (!current) return;
    const nextActivities = (Array.isArray(current.activities) ? current.activities : [])
      .map(a => (a.id === activityId ? { ...a, ...patch } : a));
    const { data, error } = await supabase.from("rh_avaliacoes").update({ activities: nextActivities }).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta avaliação.");
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, activities: nextActivities } : f));
  }, [feedbacks]);

  return useMemo(() => ({
    feedbacks,
    loading,
    createFeedback,
    createPendingCycle,
    completeFeedback,
    submitSelfRating,
    changeFeedbackStage,
    updateFeedbackCustomFields,
    updateFeedbackEvaluators,
    deleteFeedback,
    addFeedbackActivity,
    updateFeedbackActivity,
    refetch: fetchAll,
  }), [feedbacks, loading, createFeedback, createPendingCycle, completeFeedback, submitSelfRating, changeFeedbackStage, updateFeedbackCustomFields, updateFeedbackEvaluators, deleteFeedback, addFeedbackActivity, updateFeedbackActivity, fetchAll]);
}
