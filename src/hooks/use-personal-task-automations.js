import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "personal_task_automations";

/**
 * Automação pessoal do Meu To-Do — mesmo vocabulário trigger/condition_groups/
 * then_actions/else_actions do motor de `automations` (use-automations.js),
 * mas reimplementado aqui (não importado de lá) porque o motor original é
 * amarrado ao shape de lead/campanha/entrega (company_id, module, board) e à
 * tabela compartilhada entre empresa inteira — automação pessoal é dado só
 * do dono (ver comentário na migration personal_task_dependencies_and_automations).
 *
 * Escopo desta 1ª entrega (aprovado 11/08/2026): gatilhos "stage_change" e
 * "field_value" (síncronos, disparam na hora — mesma mecânica do motor
 * original). "due_date_near" (baseado em tempo) ficou de fora por depender
 * de infra de polling/dedupe persistente que o sino de lembrete existente
 * (use-notifications.js) não tem hoje — não faz sentido arriscar notificação
 * duplicada/perdida só pra cumprir escopo; registrado como próximo passo.
 *
 * action shape: { type: "move_stage"|"set_field"|"notify"|"create_task", ... }
 * - move_stage: targetStage
 * - set_field: só "priority" por ora (tags é array, semântica de merge
 *   ficaria ambígua numa automação simples — escopo deliberadamente menor)
 * - notify: message (vira AppToast, mesmo padrão de `automationNotice` já
 *   usado em EntregasView/MarketingView)
 * - create_task: title (aceita {título} como variável), priority, dueInDays
 */

function rowToRule(r) {
  return {
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    trigger: r.trigger || {},
    conditionGroups: Array.isArray(r.condition_groups) ? r.condition_groups : [],
    thenActions: Array.isArray(r.then_actions) ? r.then_actions : [],
    elseActions: Array.isArray(r.else_actions) ? r.else_actions : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function ruleToRow(rule, extras = {}) {
  return {
    name: rule.name,
    enabled: rule.enabled ?? true,
    trigger: rule.trigger || {},
    condition_groups: Array.isArray(rule.conditionGroups) ? rule.conditionGroups : [],
    then_actions: Array.isArray(rule.thenActions) ? rule.thenActions : [],
    else_actions: Array.isArray(rule.elseActions) ? rule.elseActions : [],
    ...extras,
  };
}

function matchOperator(actual, operator, expected) {
  switch (operator) {
    case "eq":           return actual === expected;
    case "neq":           return actual !== expected;
    case "contains":       return actual.toLowerCase().includes(expected.toLowerCase());
    case "is_empty":       return actual.trim() === "";
    case "is_not_empty":   return actual.trim() !== "";
    default:               return actual === expected;
  }
}

function fieldValueOf(task, field) {
  if (field === "tags") return (task.tags || []).join(",");
  return String(task[field] ?? "");
}

export function usePersonalTaskAutomations(userId) {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: true });
    if (!error) setAutomations((data || []).map(rowToRule));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addAutomation = useCallback(async (rule) => {
    if (!isSupabaseConfigured || !userId) return null;
    const { data, error } = await supabase.from(TABLE).insert(ruleToRow(rule, { user_id: userId })).select().single();
    if (error) throw new Error(error.message);
    const mapped = rowToRule(data);
    setAutomations(prev => [...prev, mapped]);
    return mapped;
  }, [userId]);

  const updateAutomation = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) return;
    const current = automations.find(a => a.id === id);
    const { error } = await supabase.from(TABLE).update(ruleToRow({ ...current, ...patch }, { updated_at: new Date().toISOString() })).eq("id", id);
    if (error) throw new Error(error.message);
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, [automations]);

  const deleteAutomation = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    await supabase.from(TABLE).delete().eq("id", id);
    setAutomations(prev => prev.filter(a => a.id !== id));
  }, []);

  const toggleAutomation = useCallback(async (id) => {
    const current = automations.find(a => a.id === id);
    if (!current) return;
    await updateAutomation(id, { enabled: !current.enabled });
  }, [automations, updateAutomation]);

  // eventType: "stage_change" | "field_value" — chamado pelo mesmo ponto que
  // já dispara a mudança (PersonalTasksView.handleMove / onFieldChange do
  // drawer), igual ao padrão de evaluateAutomations do motor original.
  const evaluateAutomations = useCallback((task, prev, eventType) => {
    const patches = [];
    const notifications = [];
    const sideEffects = [];

    for (const rule of automations) {
      if (!rule.enabled) continue;
      const { trigger } = rule;
      let triggered = false;

      if (trigger.type === "stage_change" && eventType === "stage_change") {
        const fromOk = !trigger.fromStage || (prev && prev.status === trigger.fromStage);
        const toOk   = !trigger.toStage   || task.status === trigger.toStage;
        triggered = fromOk && toOk;
      }
      if (trigger.type === "field_value" && eventType === "field_value") {
        triggered = matchOperator(fieldValueOf(task, trigger.field), trigger.operator, String(trigger.value ?? ""));
      }
      if (!triggered) continue;

      const groups = rule.conditionGroups || [];
      const conditionsPass = groups.length === 0 || groups.some(group =>
        (group.conditions || []).every(c => matchOperator(fieldValueOf(task, c.field), c.operator, String(c.value ?? "")))
      );
      const actionsToRun = conditionsPass ? (rule.thenActions || []) : (rule.elseActions || []);

      for (const action of actionsToRun) {
        if (!action?.type) continue;
        if (action.type === "move_stage" && action.targetStage && task.status !== action.targetStage) {
          patches.push({ patch: { status: action.targetStage, completedAt: action.targetStage === "feito" ? new Date().toISOString() : null }, ruleName: rule.name });
        }
        if (action.type === "set_field" && action.field === "priority" && action.fieldValue) {
          patches.push({ patch: { priority: action.fieldValue }, ruleName: rule.name });
        }
        if (action.type === "notify") {
          notifications.push({ message: action.message || `Automação "${rule.name}" disparada.`, ruleName: rule.name });
        }
        if (action.type === "create_task") {
          sideEffects.push({
            type: "create_task",
            title: (action.title || "Nova tarefa").replace("{título}", task.title || ""),
            priority: action.priority || "media",
            dueDate: Number.isInteger(action.dueInDays)
              ? new Date(Date.now() + action.dueInDays * 86400000).toISOString().slice(0, 10)
              : null,
            ruleName: rule.name,
          });
        }
      }
    }

    return { patches, notifications, sideEffects };
  }, [automations]);

  return {
    automations,
    loading,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    evaluateAutomations,
    refetch: fetchAll,
  };
}

export default usePersonalTaskAutomations;
