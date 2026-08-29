import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

export function useRHOnboarding({ userId } = {}) {
  const [templates, setTemplates] = useState([]);
  const [tarefas, setTarefas]     = useState([]);
  const [loading, setLoading]     = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: tplData }, { data: tarefasData }] = await Promise.all([
        supabase.from("rh_onboarding_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_onboarding_tarefas").select("*").order("data_limite", { ascending: true, nullsFirst: false }),
      ]);
      if (!isActive()) return;
      setTemplates(tplData || []);
      setTarefas(tarefasData || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channelName = `rh-onboarding-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_onboarding_templates" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_onboarding_tarefas" }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
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
  // (checklist_padrao) ou de uma lista avulsa de títulos. `responsavelIds`
  // (opcional) só é usado pelo fluxo de tarefa avulsa — aplicar um template
  // continua sem responsável (a pessoa atribui depois, tarefa por tarefa).
  const applyChecklist = useCallback(async (colaboradorId, items, templateId = null) => {
    const rows = items.map(item => ({
      colaborador_id: colaboradorId,
      template_id: templateId,
      titulo: item.titulo,
      data_limite: item.dataLimite || null,
      responsavel_ids: item.responsavelIds || [],
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
        responsavel_ids: item.responsavelIds || [],
        created_by: userId,
      }))
    );
    const { data: novas, error } = await supabase.from("rh_onboarding_tarefas").insert(rows).select();
    if (error) throw new Error(error.message);
    setTarefas(prev => [...(novas || []), ...prev]);
    return novas;
  }, [userId]);

  const updateTarefaStatus = useCallback(async (tarefaId, status) => {
    const { data, error } = await supabase.from("rh_onboarding_tarefas").update({ status, updated_at: new Date().toISOString() }).eq("id", tarefaId).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou. A policy de update aqui tem guarda própria
    // (o colaborador só mexe nas tarefas dele), então é um caso real.
    if (!data || data.length === 0) throw new Error("Não foi possível atualizar a tarefa de onboarding — verifique suas permissões.");
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
