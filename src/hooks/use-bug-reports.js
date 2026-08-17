import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const TABLE = "bug_reports";
const SELECT = "*, reporter:reported_by(name), resolver:resolved_by(name)";

export function useBugReports({ userId, isAdmin, enabled = true } = {}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT)
      .order("created_at", { ascending: false });
    if (!error) setReports(data || []);
    setLoading(false);
  }, [enabled]);

  useEffect(() => { if (enabled) fetchAll(); else setLoading(false); }, [fetchAll, enabled]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const channelName = `bug_reports_rt_${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createReport = useCallback(async (data) => {
    const { data: novo, error } = await supabase
      .from(TABLE)
      .insert({ ...data, reported_by: userId })
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    setReports(prev => [novo, ...prev]);
    return novo;
  }, [userId]);

  // Mover card entre etapas do Kanban de triagem — usado tanto pelo
  // drag-and-drop/"Mover para" quanto pela análise automática diária (que
  // move pra "em_analise" ao começar e "correcao_proposta" ao abrir o PR).
  const changeStage = useCallback(async (id, stage) => {
    const patch = { stage };
    const { data, error } = await supabase.from(TABLE).update(patch).eq("id", id).select(SELECT);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar este bug.");
    setReports(prev => prev.map(r => r.id === id ? data[0] : r));
  }, []);

  // Aprovar a correção proposta — só admin (RLS trava o resto). O merge do
  // PR em si é feito pela UI via GitHub, isto só registra a decisão e move
  // o card pra "Corrigido".
  const approveDiagnosis = useCallback(async (id, resolutionNote) => {
    if (!isAdmin) return;
    const patch = {
      stage: "corrigido",
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote || null,
    };
    const { data, error } = await supabase.from(TABLE).update(patch).eq("id", id).select(SELECT);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível aprovar — sem permissão.");
    setReports(prev => prev.map(r => r.id === id ? data[0] : r));
  }, [isAdmin, userId]);

  // Devolver com motivo — volta pra "Reportado" pra uma nova rodada de
  // análise; limpa o PR/branch anteriores (foram rejeitados), mas mantém o
  // diagnóstico anterior como histórico (fica só no card, não editável).
  const rejectDiagnosis = useCallback(async (id, resolutionNote) => {
    if (!isAdmin) return;
    const patch = {
      stage: "reportado",
      pr_url: null,
      branch_name: null,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote || null,
    };
    const { data, error } = await supabase.from(TABLE).update(patch).eq("id", id).select(SELECT);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível devolver — sem permissão.");
    setReports(prev => prev.map(r => r.id === id ? data[0] : r));
  }, [isAdmin, userId]);

  // Escrito pela análise automática diária (edge function/rotina, chave de
  // serviço) — mantido aqui só pra uso manual/teste a partir da UI admin.
  const updateDiagnosis = useCallback(async (id, patch) => {
    if (!isAdmin) return;
    const { data, error } = await supabase.from(TABLE).update(patch).eq("id", id).select(SELECT);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão.");
    setReports(prev => prev.map(r => r.id === id ? data[0] : r));
  }, [isAdmin]);

  const addNote = useCallback(async (id, note) => {
    const current = reports.find(r => r.id === id);
    if (!current) return;
    const nextNotes = [...(Array.isArray(current.notes) ? current.notes : []), note];
    const { data, error } = await supabase.from(TABLE).update({ notes: nextNotes }).eq("id", id).select(SELECT);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra comentar neste bug.");
    setReports(prev => prev.map(r => r.id === id ? data[0] : r));
  }, [reports]);

  const updateNote = useCallback(async (id, noteId, patch) => {
    const current = reports.find(r => r.id === id);
    if (!current) return;
    const nextNotes = (Array.isArray(current.notes) ? current.notes : [])
      .map(n => (n.id === noteId ? { ...n, ...patch } : n));
    const { data, error } = await supabase.from(TABLE).update({ notes: nextNotes }).eq("id", id).select(SELECT);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra comentar neste bug.");
    setReports(prev => prev.map(r => r.id === id ? data[0] : r));
  }, [reports]);

  const deleteReport = useCallback(async (id) => {
    if (!isAdmin) return;
    const { data, error } = await supabase.from(TABLE).delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível excluir — sem permissão ou já removido.");
    setReports(prev => prev.filter(r => r.id !== id));
  }, [isAdmin]);

  return {
    reports,
    loading,
    createReport,
    changeStage,
    approveDiagnosis,
    rejectDiagnosis,
    updateDiagnosis,
    addNote,
    updateNote,
    deleteReport,
    refetch: fetchAll,
  };
}
