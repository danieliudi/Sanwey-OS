import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_tasks";

function rowToTask(r) {
  return {
    id:                r.id,
    companyIds:        Array.isArray(r.company_ids) ? r.company_ids : [],
    campaignId:        r.campaign_id ?? null,
    // Feature futura (rollup/automação por etapa da campanha) — só lido e
    // repassado de volta no update, nunca escrito por nenhuma tela ainda.
    campaignStageKey:  r.campaign_stage_key ?? null,

    title:             r.title,
    description:       r.description ?? null,
    priority:          r.priority ?? "media",
    deadline:          r.deadline ?? null,

    stage:             r.stage,
    stageChangedAt:    r.stage_changed_at ?? null,

    // Sem coluna escalar `assignee` legada aqui (tabela nova) — diferente de
    // marketing_deliverables, que ainda carrega o fallback por causa de dado
    // pré-FASE 5.
    assigneeIds:       Array.isArray(r.assignee_ids) ? r.assignee_ids : [],

    customFields:      r.custom_fields && typeof r.custom_fields === "object" ? r.custom_fields : {},

    starred:           r.starred ?? false,
    activities:        Array.isArray(r.activities) ? r.activities : [],
    notes:             Array.isArray(r.notes) ? r.notes : [],
    createdBy:         r.created_by ?? null,
    createdAt:         r.created_at ?? null,
    updatedAt:         r.updated_at ?? null,
  };
}

function taskToRow(t, extras = {}) {
  return {
    company_ids:        t.companyIds ?? [],
    campaign_id:        t.campaignId ?? null,
    campaign_stage_key: t.campaignStageKey ?? null,

    title:              t.title,
    description:        t.description ?? null,
    priority:           t.priority ?? "media",
    deadline:           t.deadline ?? null,

    stage:              t.stage ?? "a_fazer",
    stage_changed_at:   t.stageChangedAt ?? new Date().toISOString(),

    assignee_ids:       t.assigneeIds ?? [],

    custom_fields:      t.customFields && typeof t.customFields === "object" ? t.customFields : {},

    starred:            t.starred ?? false,
    activities:         t.activities ?? [],
    notes:              t.notes ?? [],
    ...extras,
  };
}

export function useMarketingTasks({ userId, role, roles, campaignId } = {}) {
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // roles[] cobre cargo adicional (ex: gerente_marketing como cargo
  // secundário) — role sozinho (cargo principal) fica só de fallback pra
  // chamadas antigas que ainda não passam o array. Mesmo critério de
  // current_user_is_marketing() no banco.
  const roleList = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
  const canWrite = roleList.some(r => ["admin", "marketing", "gerente_marketing"].includes(r));

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from(TABLE).select("*").order("created_at", { ascending: false });
      if (campaignId) q = q.eq("campaign_id", campaignId);
      const { data, error: err } = await q;
      if (err) throw err;
      setTasks((data || []).map(rowToTask));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchAll(); }, [fetchAll, campaignId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channelName = `marketing_tasks_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        const matchesCampaign = !campaignId || payload.new?.campaign_id === campaignId;
        if (payload.eventType === "INSERT") {
          if (!matchesCampaign) return;
          setTasks(prev =>
            prev.some(t => t.id === payload.new.id)
              ? prev.map(t => t.id === payload.new.id ? rowToTask(payload.new) : t)
              : [rowToTask(payload.new), ...prev]
          );
        } else if (payload.eventType === "UPDATE") {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? rowToTask(payload.new) : t));
        } else if (payload.eventType === "DELETE") {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId]);

  const createTask = useCallback(async (task) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = taskToRow(task, { created_by: userId });
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (err) throw err;
    const created = rowToTask(data);
    setTasks(prev => prev.some(t => t.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, [canWrite, userId]);

  const updateTask = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = tasks.find(t => t.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const row = taskToRow(merged);
    const { data, error: err } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta tarefa.");
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, [canWrite, tasks]);

  // "Duplicar card" — cópia nasce sempre na 1ª etapa do seed
  // (20260764_marketing_tasks.sql:82 = "a_fazer"), nunca herda activities/
  // notes/stageChangedAt nem campaignStageKey (rollup calculado a partir da
  // campanha, não faz sentido herdar de outro card).
  const duplicateTask = useCallback(async (source, firstStageId) => {
    return createTask({
      companyIds:   source.companyIds,
      campaignId:   source.campaignId,
      title:        `${source.title} (cópia)`,
      description:  source.description,
      priority:     source.priority,
      deadline:     source.deadline,
      stage:        firstStageId,
      assigneeIds:  source.assigneeIds,
      customFields: source.customFields,
    });
  }, [createTask]);

  const deleteTask = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [canWrite]);

  const changeStage = useCallback(async (id, stage) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const now      = new Date().toISOString();
    const current  = tasks.find(t => t.id === id);
    const stageName = stage; // caller can pass a display name if needed
    const activity  = {
      type:        "stage_change",
      description: `Movido para ${stageName}`,
      at:          now,
    };
    const activities = [...(current?.activities || []), activity];
    const { data, error: err } = await supabase
      .from(TABLE)
      .update({ stage, stage_changed_at: now, activities })
      .eq("id", id)
      .select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta tarefa.");
    setTasks(prev =>
      prev.map(t => t.id === id ? { ...t, stage, stageChangedAt: now, activities } : t)
    );
  }, [canWrite, tasks]);

  const toggleStar = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = tasks.find(t => t.id === id);
    if (!current) return;
    const starred = !current.starred;
    const { data, error: err } = await supabase.from(TABLE).update({ starred }).eq("id", id).select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta tarefa.");
    setTasks(prev => prev.map(t => t.id === id ? { ...t, starred } : t));
  }, [canWrite, tasks]);

  return {
    tasks,
    loading,
    error,
    canWrite,
    createTask,
    updateTask,
    deleteTask,
    duplicateTask,
    changeStage,
    toggleStar,
    refetch: fetchAll,
  };
}
