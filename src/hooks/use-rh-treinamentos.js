import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

function vencimentoDate(atribuicao, treinamento) {
  if (!treinamento?.validade_dias || !atribuicao?.data_conclusao) return null;
  const d = new Date(atribuicao.data_conclusao);
  d.setDate(d.getDate() + Number(treinamento.validade_dias));
  return d;
}

export function useRHTreinamentos({ userId } = {}) {
  const [treinamentos, setTreinamentos] = useState([]);
  const [atribuicoes, setAtribuicoes]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const activeRef = useRef(true);
  const reconciliandoRef = useRef(false);

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
    const channelName = `rh-treinamentos-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_treinamentos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_treinamento_atribuicoes" }, fetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  // Reconciliação de "vencido": antes era só um cálculo no cliente
  // (data_conclusao + validade_dias no passado); agora vira o stage_key de
  // verdade gravado no banco, igual ao card de qualquer outro Kanban.
  // Roda ao abrir a tela (sem cron/job agendado, que não existe aqui),
  // mesmo padrão do nextPendingCycle do Feedback.
  useEffect(() => {
    if (loading || reconciliandoRef.current || treinamentos.length === 0 || atribuicoes.length === 0) return;
    const treinamentosById = new Map(treinamentos.map(t => [t.id, t]));
    const paraVencer = atribuicoes.filter(a => {
      if (a.status !== "concluido") return false;
      const venc = vencimentoDate(a, treinamentosById.get(a.treinamento_id));
      return Boolean(venc && venc.getTime() < Date.now());
    });
    if (paraVencer.length === 0) return;
    reconciliandoRef.current = true;
    (async () => {
      const now = new Date().toISOString();
      for (const a of paraVencer) {
        await supabase.from("rh_treinamento_atribuicoes").update({ status: "vencido", status_changed_at: now }).eq("id", a.id);
      }
      setAtribuicoes(prev => prev.map(a => paraVencer.some(p => p.id === a.id) ? { ...a, status: "vencido", status_changed_at: now } : a));
    })();
  }, [loading, treinamentos, atribuicoes]);

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

  // Mover card entre pendente/concluído/vencido no board por treinamento —
  // generaliza updateAtribuicaoStatus (mantida abaixo pros dois call sites
  // já existentes: checkbox de autoatendimento e botão "Revalidar").
  const changeAtribuicaoStage = useCallback(async (atribuicaoId, stage) => {
    const patch = { status: stage, status_changed_at: new Date().toISOString() };
    if (stage === "concluido") patch.data_conclusao = new Date().toISOString();
    if (stage === "pendente") patch.data_conclusao = null;
    const { error } = await supabase.from("rh_treinamento_atribuicoes").update(patch).eq("id", atribuicaoId);
    if (error) throw new Error(error.message);
    setAtribuicoes(prev => prev.map(a => a.id === atribuicaoId ? { ...a, ...patch } : a));
  }, []);

  const updateAtribuicaoStatus = useCallback(async (atribuicaoId, status) => {
    await changeAtribuicaoStage(atribuicaoId, status);
  }, [changeAtribuicaoStage]);

  const updateAtribuicaoCustomFields = useCallback(async (atribuicaoId, customFields) => {
    const { error } = await supabase.from("rh_treinamento_atribuicoes").update({ custom_fields: customFields }).eq("id", atribuicaoId);
    if (error) throw new Error(error.message);
    setAtribuicoes(prev => prev.map(a => a.id === atribuicaoId ? { ...a, custom_fields: customFields } : a));
  }, []);

  const addAtribuicaoActivity = useCallback(async (atribuicaoId, entry) => {
    const current = atribuicoes.find(a => a.id === atribuicaoId);
    if (!current) return;
    const nextActivities = [...(Array.isArray(current.activities) ? current.activities : []), entry];
    const { error } = await supabase.from("rh_treinamento_atribuicoes").update({ activities: nextActivities }).eq("id", atribuicaoId);
    if (error) throw new Error(error.message);
    setAtribuicoes(prev => prev.map(a => a.id === atribuicaoId ? { ...a, activities: nextActivities } : a));
  }, [atribuicoes]);

  const updateTreinamento = useCallback(async (id, patch) => {
    const { error } = await supabase.from("rh_treinamentos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    setTreinamentos(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  return useMemo(() => ({
    treinamentos,
    atribuicoes,
    loading,
    createTreinamento,
    updateTreinamento,
    assignToUsers,
    updateAtribuicaoStatus,
    changeAtribuicaoStage,
    updateAtribuicaoCustomFields,
    addAtribuicaoActivity,
    refetch: fetchAll,
  }), [treinamentos, atribuicoes, loading, createTreinamento, updateTreinamento, assignToUsers, updateAtribuicaoStatus, changeAtribuicaoStage, updateAtribuicaoCustomFields, addAtribuicaoActivity, fetchAll]);
}
