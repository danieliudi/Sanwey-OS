import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const TABLE = "personal_tasks";

function rowToTask(r) {
  return {
    id:          r.id,
    userId:      r.user_id,
    title:       r.title,
    description: r.description ?? null,
    priority:    r.priority ?? "media",
    status:      r.status ?? "a_fazer",
    dueDate:     r.due_date ?? null,
    completedAt: r.completed_at ?? null,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  };
}

function taskToRow(data) {
  const row = {};
  if (data.title       !== undefined) row.title        = data.title;
  if (data.description !== undefined) row.description  = data.description;
  if (data.priority    !== undefined) row.priority     = data.priority;
  if (data.status      !== undefined) row.status       = data.status;
  if (data.dueDate      !== undefined) row.due_date     = data.dueDate;
  if (data.completedAt !== undefined) row.completed_at = data.completedAt;
  return row;
}

// Tarefas Pessoais — feature opt-in (settings.personalTasksEnabled em
// Configurações → Meu perfil, default desligado), privada por usuário:
// personal_tasks tem RLS com `user_id = auth.uid()` sem nenhuma exceção de
// papel/gerência (ver migration 20260826_personal_tasks.sql), então o
// filtro `.eq("user_id", userId)" abaixo é só uma otimização de query —
// mesmo sem ele, o banco já não devolveria linha de outro usuário.
//
// `enabled` (default true) deixa o hook inerte — sem fetch nem subscription
// — pra quem não ligou o opt-in, que é a maioria por padrão (feature nasce
// desligada). App.jsx passa `enabled: settings.personalTasksEnabled` pra
// não gerar tráfego Realtime à toa pra quem nunca usa a tela.
export function usePersonalTasks({ userId, enabled = true } = {}) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const active = isSupabaseConfigured && enabled && Boolean(userId);

  const fetchTasks = useCallback(async () => {
    if (!active) { setTasks([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (err) throw err;
      setTasks((data || []).map(rowToTask));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [active, userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Debounce de refetch em postgres_changes (regra do CLAUDE.md, src/utils/
  // debounce.js) — colapsa uma rajada de eventos (ex.: mover vários cards
  // seguidos no Kanban) num único refetch, em vez de um por evento.
  useEffect(() => {
    if (!active) return;
    const debouncedFetch = debounce(() => fetchTasks(), 400);
    const channel = supabase
      .channel(`personal_tasks_rt_${userId}`)
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  TABLE,
        filter: `user_id=eq.${userId}`,
      }, () => debouncedFetch())
      .subscribe();
    return () => {
      debouncedFetch.cancel();
      supabase.removeChannel(channel);
    };
  }, [active, userId, fetchTasks]);

  const createTask = useCallback(async (data) => {
    if (!active) return null;
    const row = { ...taskToRow(data), user_id: userId };
    const { data: created, error: err } = await supabase.from(TABLE).insert(row).select().single();
    if (err) throw err;
    const task = rowToTask(created);
    setTasks(prev => prev.some(t => t.id === task.id) ? prev : [task, ...prev]);
    return task;
  }, [active, userId]);

  // Patch genérico — usado tanto pra edição de campos quanto pra mudança de
  // status (MoveStageMenu do Kanban chama isto com { status: novoStatus }).
  const updateTask = useCallback(async (id, patch) => {
    if (!active) return;
    const row = taskToRow(patch);
    const { error: err } = await supabase.from(TABLE).update(row).eq("id", id);
    if (err) throw err;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, [active]);

  const deleteTask = useCallback(async (id) => {
    if (!active) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [active]);

  // Conveniência do checkbox (List) e do atalho "Feito"/"Reabrir" (Kanban):
  // alterna entre status:'feito' e status:'a_fazer', setando/limpando
  // completed_at junto — reabrir uma tarefa feita volta pra 'a_fazer' (não
  // pra 'fazendo'), decisão simples: "desmarcar" é o oposto direto de
  // "marcar", sem tentar adivinhar em qual etapa intermediária ela estava.
  const toggleDone = useCallback(async (id) => {
    const current = tasks.find(t => t.id === id);
    if (!current) return;
    const done = current.status === "feito";
    await updateTask(id, {
      status:      done ? "a_fazer" : "feito",
      completedAt: done ? null : new Date().toISOString(),
    });
  }, [tasks, updateTask]);

  const openCount = useMemo(() => tasks.filter(t => t.status !== "feito").length, [tasks]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    toggleDone,
    openCount,
    refetch: fetchTasks,
  };
}

export default usePersonalTasks;
