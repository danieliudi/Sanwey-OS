import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

export function useRHOnboarding({ userId } = {}) {
  const [templates, setTemplates] = useState([]);
  const [tarefas, setTarefas]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: tplData }, { data: tarefasData }] = await Promise.all([
        supabase.from("rh_onboarding_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_onboarding_tarefas").select("*").order("data_limite", { ascending: true, nullsFirst: false }),
      ]);
      if (!activeRef.current) return;
      setTemplates(tplData || []);
      setTarefas(tarefasData || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channelName = `rh-onboarding-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_onboarding_templates" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_onboarding_tarefas" }, debouncedFetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createTemplate = useCallback(async (data) => {
    const row = { ...data, created_by: userId };
    const { data: novo, error } = await supabase.from("rh_onboarding_templates").insert(row).select().single();
    if (error) throw new Error(error.message);
    setTemplates(prev => [novo, ...prev]);
    return novo;
  }, [userId]);

  // Cria as tarefas do checklist para um colaborador — a partir de um template
  // (checklist_padrao) ou de uma lista avulsa de títulos.
  const applyChecklist = useCallback(async (colaboradorId, items, templateId = null) => {
    const rows = items.map(item => ({
      colaborador_id: colaboradorId,
      template_id: templateId,
      titulo: item.titulo,
      data_limite: item.dataLimite || null,
      created_by: userId,
    }));
    const { data: novas, error } = await supabase.from("rh_onboarding_tarefas").insert(rows).select();
    if (error) throw new Error(error.message);
    setTarefas(prev => [...(novas || []), ...prev]);
    return novas;
  }, [userId]);

  // Tarefa em lote (Onda 2, item 7): cria a MESMA tarefa (ex: "entrega de
  // uniforme", "aviso de segurança NR") pra vários colaboradores de uma vez —
  // colaboradorIds × items num único insert, sem template. Espelha o formato
  // de assignToUsers dos treinamentos.
  const applyTaskToMany = useCallback(async (colaboradorIds, items) => {
    const ids = [...new Set(colaboradorIds)].filter(Boolean);
    if (!ids.length || !items?.length) return [];
    const rows = ids.flatMap((colaboradorId) =>
      items.map((item) => ({
        colaborador_id: colaboradorId,
        template_id: null,
        titulo: item.titulo,
        data_limite: item.dataLimite || null,
        created_by: userId,
      }))
    );
    const { data: novas, error } = await supabase.from("rh_onboarding_tarefas").insert(rows).select();
    if (error) throw new Error(error.message);
    setTarefas(prev => [...(novas || []), ...prev]);
    return novas;
  }, [userId]);

  const updateTarefaStatus = useCallback(async (tarefaId, status) => {
    const { error } = await supabase.from("rh_onboarding_tarefas").update({ status, updated_at: new Date().toISOString() }).eq("id", tarefaId);
    if (error) throw new Error(error.message);
    setTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, status } : t));
  }, []);

  const deleteTarefa = useCallback(async (tarefaId) => {
    const { error } = await supabase.from("rh_onboarding_tarefas").delete().eq("id", tarefaId);
    if (error) throw new Error(error.message);
    setTarefas(prev => prev.filter(t => t.id !== tarefaId));
  }, []);

  return useMemo(() => ({
    templates,
    tarefas,
    loading,
    createTemplate,
    applyChecklist,
    applyTaskToMany,
    updateTarefaStatus,
    deleteTarefa,
    refetch: fetchAll,
  }), [templates, tarefas, loading, createTemplate, applyChecklist, applyTaskToMany, updateTarefaStatus, deleteTarefa, fetchAll]);
}
