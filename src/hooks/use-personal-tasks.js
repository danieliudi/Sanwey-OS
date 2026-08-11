import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";
import { toLocalISODate } from "../utils/date";

const TABLE = "personal_tasks";

// Contador de módulo, não por-hook — garante nome de canal único mesmo
// quando duas instâncias deste hook montam no mesmo milissegundo (ex.: o
// badge do menu em App.jsx e a tela PersonalTasksView.jsx, ambas montadas
// ao mesmo tempo quando a feature está ligada e o usuário abre a tela).
let personalTasksChannelSeq = 0;

function rowToTask(r) {
  return {
    id:          r.id,
    userId:      r.user_id,
    title:       r.title,
    description: r.description ?? null,
    priority:    r.priority ?? "media",
    status:      r.status ?? "a_fazer",
    dueDate:     r.due_date ?? null,
    dueTime:     r.due_time ?? null,
    tags:        r.tags ?? [],
    recurrence:  r.recurrence ?? "none",
    recurrenceConfig: r.recurrence_config ?? {},
    customFields: r.custom_fields ?? {},
    notes:       r.notes ?? [],
    completedAt: r.completed_at ?? null,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
    // Preenchido só quando a tarefa nasce do "Repetir email" no Funil de
    // Vendas (LeadDetailDrawer > aba Email) — deep link de volta pro lead.
    relatedLeadId: r.related_lead_id ?? null,
  };
}

function taskToRow(data) {
  const row = {};
  if (data.title       !== undefined) row.title        = data.title;
  if (data.description !== undefined) row.description  = data.description;
  if (data.priority    !== undefined) row.priority     = data.priority;
  if (data.status      !== undefined) row.status       = data.status;
  if (data.dueDate      !== undefined) row.due_date     = data.dueDate;
  if (data.dueTime      !== undefined) row.due_time     = data.dueTime;
  if (data.tags         !== undefined) row.tags         = data.tags;
  if (data.recurrence   !== undefined) row.recurrence   = data.recurrence;
  if (data.recurrenceConfig !== undefined) row.recurrence_config = data.recurrenceConfig;
  if (data.customFields !== undefined) row.custom_fields = data.customFields;
  if (data.notes        !== undefined) row.notes        = data.notes;
  if (data.completedAt !== undefined) row.completed_at = data.completedAt;
  if (data.relatedLeadId !== undefined) row.related_lead_id = data.relatedLeadId;
  return row;
}

// Dia do mês "clampado" pro último dia real do mês (decisão do mockup: dia
// 31 recorrente cai no último dia de fevereiro, não pula o mês).
function clampedMonthDay(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

// Próxima data cujo dia-da-semana esteja em `daysOfWeek` (0=domingo..6=sábado),
// estritamente depois de `base`.
function nextWeekdayOccurrence(base, daysOfWeek) {
  for (let i = 1; i <= 7; i++) {
    const candidate = new Date(base);
    candidate.setDate(candidate.getDate() + i);
    if (daysOfWeek.includes(candidate.getDay())) return candidate;
  }
  return null;
}

// Próxima ocorrência no `dayOfMonth`, estritamente depois de `base`.
function nextMonthDayOccurrence(base, dayOfMonth) {
  let year = base.getFullYear(), month = base.getMonth();
  let candidate = clampedMonthDay(year, month, dayOfMonth);
  if (candidate <= base) candidate = clampedMonthDay(year, month + 1, dayOfMonth);
  return candidate;
}

// Base pra recorrência: dia do prazo atual, ou hoje se a tarefa nunca teve
// prazo (não dá pra "repetir" uma data que não existe). `recurrenceConfig`
// ({ daysOfWeek: [...] } ou { dayOfMonth: N }) refina o padrão quando
// presente — ausente/vazio cai no comportamento antigo (+1 dia/+7 dias/+1 mês
// a partir do prazo atual), pra não quebrar tarefa recorrente criada antes
// desta rodada.
function nextOccurrenceDate(dueDate, recurrence, recurrenceConfig) {
  const base = dueDate ? new Date(`${dueDate}T00:00:00`) : new Date();
  const cfg = recurrenceConfig || {};

  if (recurrence === "weekly" && Array.isArray(cfg.daysOfWeek) && cfg.daysOfWeek.length > 0) {
    const next = nextWeekdayOccurrence(base, cfg.daysOfWeek);
    return next ? toLocalISODate(next) : null;
  }
  if (recurrence === "monthly" && Number.isInteger(cfg.dayOfMonth)) {
    return toLocalISODate(nextMonthDayOccurrence(base, cfg.dayOfMonth));
  }
  // "A cada X dias" (nasceu do "Repetir email" no Funil de Vendas, mas
  // disponível pra qualquer tarefa do Meu To-Do via RecurrencePicker) —
  // intervalo livre, não amarrado a semana/mês.
  if (recurrence === "custom" && Number.isInteger(cfg.intervalDays) && cfg.intervalDays > 0) {
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    next.setDate(next.getDate() + cfg.intervalDays);
    return toLocalISODate(next);
  }

  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  else return null;
  return toLocalISODate(next);
}

// Lista Pessoal (ex-"Tarefas Pessoais") — privada por usuário: personal_tasks
// tem RLS com `user_id = auth.uid()` sem nenhuma exceção de papel/gerência
// (ver migration 20260826_personal_tasks.sql), então o filtro
// `.eq("user_id", userId)` abaixo é só uma otimização de query — mesmo sem
// ele, o banco já não devolveria linha de outro usuário.
//
// A feature nasce LIGADA (settings.personalTasksEnabled, default true) e é
// desligável em Configurações → Preferências → Recursos. `enabled` deixa o
// hook inerte — sem fetch nem subscription — pra quem desligou, evitando
// tráfego Realtime à toa.
export function usePersonalTasks({ userId, enabled = true } = {}) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  // Id só desta instância do hook — ver personalTasksChannelSeq acima.
  const instanceIdRef = useRef(null);
  if (instanceIdRef.current === null) instanceIdRef.current = ++personalTasksChannelSeq;

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
      .channel(`personal_tasks_rt_${userId}_${instanceIdRef.current}`)
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

  // Único lugar que muda status: usado pelo checkbox (List), atalho
  // "Feito"/"Reabrir" (Kanban), drag-and-drop e MoveStageMenu — setando/
  // limpando completed_at junto (reabrir volta pra 'a_fazer', não pra
  // 'fazendo': "desmarcar" é o oposto direto de "marcar", sem adivinhar em
  // qual etapa intermediária ela estava). Concluir uma tarefa recorrente
  // ("Todo dia"/"Toda semana"/"Todo mês") gera a próxima ocorrência na hora
  // — mesmo título/descrição/prioridade/tags, status voltando pra 'a_fazer'.
  // Só dispara ao chegar em 'feito' vindo de outro status (não ao reabrir,
  // nem ao mover entre 'a_fazer'/'fazendo'), senão reabrir uma tarefa
  // recorrente ficaria duplicando linha.
  const setTaskStatus = useCallback(async (id, status) => {
    const current = tasks.find(t => t.id === id);
    if (!current) return;
    const becomingDone = status === "feito" && current.status !== "feito";
    await updateTask(id, {
      status,
      completedAt: status === "feito" ? new Date().toISOString() : null,
    });
    if (becomingDone && current.recurrence && current.recurrence !== "none") {
      await createTask({
        title:       current.title,
        description: current.description,
        priority:    current.priority,
        status:      "a_fazer",
        dueDate:     nextOccurrenceDate(current.dueDate, current.recurrence, current.recurrenceConfig),
        dueTime:     current.dueTime,
        tags:        current.tags,
        recurrence:  current.recurrence,
        recurrenceConfig: current.recurrenceConfig,
      });
    }
  }, [tasks, updateTask, createTask]);

  const toggleDone = useCallback(async (id) => {
    const current = tasks.find(t => t.id === id);
    if (!current) return;
    await setTaskStatus(id, current.status === "feito" ? "a_fazer" : "feito");
  }, [tasks, setTaskStatus]);

  const openCount = useMemo(() => tasks.filter(t => t.status !== "feito").length, [tasks]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    toggleDone,
    setTaskStatus,
    openCount,
    refetch: fetchTasks,
  };
}

export default usePersonalTasks;
