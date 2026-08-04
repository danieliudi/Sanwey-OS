import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

/**
 * Rule-based automation engine — no AI, zero API calls. Compartilhado pela
 * equipe via Supabase (antes vivia em localStorage, por navegador).
 *
 * Automation shape (camelCase, como usado pelo resto do app):
 * {
 *   id, name, companyId, module, enabled,
 *   trigger: {
 *     type: "stage_change" | "field_value" | "time_in_stage" | "pending_required_field" | "lead_created",
 *     board?,                    // só module="marketing": "campanhas" | "entregas" — qual quadro
 *                                // esta regra observa (AutomationsView.jsx > StepIdentification).
 *                                // Ausente = "campanhas" (automações de marketing salvas antes de
 *                                // Entregas ganhar automação, ou templates antigos) — nunca tratar
 *                                // como "qualquer quadro", sempre como esse default explícito.
 *     fromStage?, toStage?,      // stage_change
 *     field?, operator?, value?, // field_value
 *     days?, stageId?,           // time_in_stage, pending_required_field (stageId opcional nesse último)
 *   },
 *   // Refinamento OPCIONAL do trigger — grupos combinados em OR, condições
 *   // dentro de um grupo combinadas em AND (mesmo padrão do field_conditions
 *   // do Pipefy). Grupo vazio = só o trigger decide (comportamento antigo).
 *   conditionGroups: [ { logic: "AND", conditions: [{ field, operator, value }, ...] }, ... ],
 *   thenActions: [ action, ... ],  // roda quando trigger dispara E conditionGroups passa (ou está vazio)
 *   elseActions: [ action, ... ],  // roda quando trigger dispara mas conditionGroups não passa
 *   createdAt, createdBy,
 * }
 *
 * action shape (cada item de thenActions/elseActions):
 * {
 *   type: "move_stage" | "set_field" | "add_badge" | "notify" | "create_deliverable" | "enrich_cnpj",
 *   targetStage?, field?, fieldValue?, badge?, badgeColor?, message?,
 *   deliverableTitle?, deliverablePriority?,
 * }
 *
 * create_deliverable e enrich_cnpj não retornam um patch síncrono — geram um
 * item em `sideEffects`, que quem chama evaluateAutomations (App.jsx) executa
 * de fato (insert cross-módulo / chamada à Edge Function de CNPJ).
 */

function rowToRule(r) {
  return {
    id: r.id,
    name: r.name,
    companyId: r.company_id,
    module: r.module,
    enabled: r.enabled,
    trigger: r.trigger || {},
    conditionGroups: Array.isArray(r.condition_groups) ? r.condition_groups : [],
    thenActions: Array.isArray(r.then_actions) ? r.then_actions : [],
    elseActions: Array.isArray(r.else_actions) ? r.else_actions : [],
    // paused_reason (Agent Builder, PRD docs/prd-agent-builder.md seção 4):
    // intervenção do sistema (chave quebrada, ou nasce sem chave configurada)
    // — independente de `enabled`, que é intenção do usuário.
    pausedReason: r.paused_reason ?? null,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Aceita tanto o shape novo (thenActions/elseActions/conditionGroups) quanto o
// antigo (action singular, usado pelos templates existentes) — normaliza pra
// sempre persistir then_actions como array.
function ruleToRow(rule, extras = {}) {
  const thenActions = Array.isArray(rule.thenActions) && rule.thenActions.length
    ? rule.thenActions
    : (rule.action ? [rule.action] : []);
  return {
    name: rule.name,
    company_id: rule.companyId ?? "all",
    module: rule.module ?? "crm",
    enabled: rule.enabled ?? true,
    trigger: rule.trigger || {},
    condition_groups: Array.isArray(rule.conditionGroups) ? rule.conditionGroups : [],
    then_actions: thenActions,
    else_actions: Array.isArray(rule.elseActions) ? rule.elseActions : [],
    // undefined (não mencionado no patch) preserva o valor atual da coluna —
    // só grava null explicitamente quando o chamador passa pausedReason: null
    // de propósito (ex.: reativar manualmente um agente pausado).
    ...(rule.pausedReason !== undefined ? { paused_reason: rule.pausedReason } : {}),
    ...extras,
  };
}

export function useAutomations({ userId } = {}) {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!activeRef.current) return;
      setAutomations((data || []).map(rowToRule));
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(`automations-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "automations" }, (payload) => {
        if (!activeRef.current) return;
        if (payload.eventType === "DELETE") {
          setAutomations(prev => prev.filter(a => a.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          setAutomations(prev => prev.some(a => a.id === payload.new.id)
            ? prev
            : [...prev, rowToRule(payload.new)]);
        } else if (payload.eventType === "UPDATE") {
          setAutomations(prev => prev.map(a => a.id === payload.new.id ? rowToRule(payload.new) : a));
        }
      })
      .subscribe();
    return () => { activeRef.current = false; supabase.removeChannel(channel); };
  }, [fetchAll]);

  const addAutomation = useCallback(async (rule) => {
    if (!isSupabaseConfigured) return;
    const row = ruleToRow(rule, { created_by: userId || null });
    const { data, error } = await supabase.from("automations").insert(row).select().single();
    if (error) throw new Error(error.message);
    const mapped = rowToRule(data);
    setAutomations(prev => prev.some(a => a.id === mapped.id) ? prev : [...prev, mapped]);
    return mapped;
  }, [userId]);

  const updateAutomation = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) return;
    const current = automations.find(a => a.id === id);
    const row = ruleToRow({ ...current, ...patch }, { updated_at: new Date().toISOString() });
    const { error } = await supabase.from("automations").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, [automations]);

  const deleteAutomation = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("automations").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setAutomations(prev => prev.filter(a => a.id !== id));
  }, []);

  const toggleAutomation = useCallback(async (id) => {
    const current = automations.find(a => a.id === id);
    if (!current) return;
    await updateAutomation(id, { enabled: !current.enabled });
  }, [automations, updateAutomation]);

  /**
   * Evaluate all enabled automations against an entity change.
   *
   * @param {object} lead        - current entity state (after the triggering event)
   * @param {object|null} prev   - previous entity state (null = newly created)
   * @param {string} eventType   - "stage_change" | "field_value" | "lead_created" | etc.
   * @param {"crm"|"marketing"|"universal"} [module="crm"] - scope filter
   * @param {"campanhas"|"entregas"} [board] - só relevante quando module="marketing":
   *   qual quadro disparou o evento. Quem chama passa isso explicitamente
   *   (MarketingView.jsx passa "campanhas", EntregasView.jsx passa "entregas")
   *   — indefinido só deveria acontecer em chamadas antigas/module="crm".
   */
  const evaluateAutomations = useCallback((lead, prev, eventType, module = "crm", board) => {
    const patches = [];
    const notifications = [];
    const sideEffects = [];

    for (const rule of automations) {
      if (!rule.enabled) continue;
      // Module filter: rule must match requested module or be universal.
      const ruleModule = rule.module ?? "crm";
      if (ruleModule !== "universal" && ruleModule !== module) continue;
      if (rule.companyId !== "all" && rule.companyId !== lead.companyId) continue;

      const { trigger } = rule;

      // ── Isolamento por quadro (Campanhas vs. Entregas) ──────────────────
      // Dentro do módulo "marketing" agora existem dois quadros que chamam
      // evaluateAutomations (antes só Campanhas chamava) — uma regra criada
      // pra um quadro nunca pode disparar no outro. Regra sem trigger.board
      // salvo é sempre tratada como "campanhas" (toda automação de marketing
      // criada antes de Entregas ganhar automação não tem esse campo —
      // precisa continuar dando exatamente o mesmo resultado de antes).
      // Regras "universal" cruzam módulos livremente (comportamento de
      // sempre), MAS quando o gatilho é stage_change também respeitam o
      // quadro do evento — ids de etapa podem colidir entre quadros (ex.:
      // "revisao" existe tanto em Campanhas quanto em Entregas), então sem
      // essa checagem uma automação universal de "mover pra Revisão"
      // dispararia nos dois quadros por engano.
      if (module === "marketing" && (ruleModule === "marketing" || trigger.type === "stage_change")) {
        const ruleBoard  = rule.trigger?.board ?? "campanhas";
        const eventBoard = board ?? "campanhas";
        if (ruleBoard !== eventBoard) continue;
      }

      // ── Trigger matching ──────────────────────────────────────────────────
      let triggered = false;

      if (trigger.type === "lead_created" && eventType === "lead_created") {
        triggered = true;
      }

      if (trigger.type === "stage_change" && eventType === "stage_change") {
        const fromOk = !trigger.fromStage || (prev && prev.stage === trigger.fromStage);
        const toOk   = !trigger.toStage   || lead.stage === trigger.toStage;
        triggered = fromOk && toOk;
      }

      if (trigger.type === "field_value" && eventType === "field_value") {
        const actual = String(lead[trigger.field] ?? "");
        triggered = matchOperator(actual, trigger.operator, String(trigger.value ?? ""));
      }

      if (trigger.type === "time_in_stage" && eventType === "time_in_stage") {
        const inStageOk = !trigger.stageId || lead.stage === trigger.stageId;
        const days = trigger.days || 0;
        if (inStageOk && lead.stageChangedAt) {
          const elapsed = (Date.now() - new Date(lead.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24);
          triggered = elapsed >= days;
        }
      }

      // Nudge de campo obrigatório pendente — mesma mecânica do time_in_stage
      // (tempo desde stageChangedAt), só que também exige que a etapa atual
      // ainda tenha campo obrigatório vazio. `lead._missingRequiredFields` é
      // computado por quem chama evaluateAutomations (precisa dos defs de
      // campo por etapa, que este hook não conhece).
      if (trigger.type === "pending_required_field" && eventType === "pending_required_field") {
        const inStageOk = !trigger.stageId || lead.stage === trigger.stageId;
        const days = trigger.days || 0;
        const hasMissing = Array.isArray(lead._missingRequiredFields) && lead._missingRequiredFields.length > 0;
        if (inStageOk && hasMissing && lead.stageChangedAt) {
          const elapsed = (Date.now() - new Date(lead.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24);
          triggered = elapsed >= days;
        }
      }

      if (!triggered) continue;

      // ── Refinamento por condições agrupadas (AND dentro do grupo, OR entre
      //    grupos) — grupo vazio = só o trigger decide, sempre passa. ─────────
      const groups = rule.conditionGroups || [];
      const conditionsPass = groups.length === 0 || groups.some(group =>
        (group.conditions || []).every(c =>
          matchOperator(String(lead[c.field] ?? ""), c.operator, String(c.value ?? ""))
        )
      );

      const actionsToRun = conditionsPass ? (rule.thenActions || []) : (rule.elseActions || []);
      for (const action of actionsToRun) {
        runAction(action, rule, lead, { patches, notifications, sideEffects });
      }
    }

    return { patches, notifications, sideEffects };
  }, [automations]);

  // Summaries for the UI
  const stats = {
    total: automations.length,
    enabled: automations.filter(a => a.enabled).length,
    byType: automations.reduce((acc, a) => {
      const t = a.trigger?.type;
      if (t) acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {}),
    byModule: automations.reduce((acc, a) => {
      const m = a.module ?? "crm";
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {}),
  };

  return {
    automations,
    loading,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    evaluateAutomations,
    stats,
    refetch: fetchAll,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function matchOperator(actual, operator, expected) {
  switch (operator) {
    case "eq":            return actual === expected;
    case "neq":            return actual !== expected;
    case "contains":       return actual.toLowerCase().includes(expected.toLowerCase());
    case "gt":             return parseFloat(actual) > parseFloat(expected);
    case "lt":             return parseFloat(actual) < parseFloat(expected);
    case "gte":            return parseFloat(actual) >= parseFloat(expected);
    case "lte":            return parseFloat(actual) <= parseFloat(expected);
    case "is_empty":       return actual.trim() === "";
    case "is_not_empty":   return actual.trim() !== "";
    default:               return actual === expected;
  }
}

function runAction(action, rule, lead, { patches, notifications, sideEffects }) {
  if (!action?.type) return;

  if (action.type === "move_stage" && action.targetStage && lead.stage !== action.targetStage) {
    patches.push({
      leadId: lead.id,
      patch: {
        stage: action.targetStage,
        stageChangedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      },
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }

  if (action.type === "set_field" && action.field) {
    patches.push({
      leadId: lead.id,
      patch: { [action.field]: action.fieldValue ?? "" },
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }

  if (action.type === "add_badge") {
    const existing = lead.badges || [];
    const badge = { label: action.badge || "Auto", color: action.badgeColor || "#6366F1" };
    const alreadyHas = existing.some(b => b.label === badge.label);
    if (!alreadyHas) {
      patches.push({
        leadId: lead.id,
        patch: { badges: [...existing, badge] },
        ruleId: rule.id,
        ruleName: rule.name,
      });
    }
  }

  if (action.type === "assign_owner" && Array.isArray(action.assigneeIds) && action.assigneeIds.length > 0) {
    // Nome do campo de responsável varia por domínio: leads (CRM) e
    // campanhas usam owner/ownerIds (use-leads.js, use-marketing-campaigns.js);
    // entregas usam assignee/assigneeIds (use-marketing-deliverables.js) —
    // detectado pela forma do próprio objeto em vez de só rule.module/board,
    // pra cobrir também automações "universal" que cruzam módulos.
    const usesAssigneeShape = "assigneeIds" in lead || "assignee" in lead;
    const idsField    = usesAssigneeShape ? "assigneeIds" : "ownerIds";
    const singleField = usesAssigneeShape ? "assignee"    : "owner";
    const current = Array.isArray(lead[idsField]) && lead[idsField].length
      ? lead[idsField]
      : (lead[singleField] ? [lead[singleField]] : []);
    // "Substituir" (default) troca a lista inteira; "Adicionar" faz união
    // com quem já está, sem duplicar.
    const nextIds = action.mode === "add"
      ? Array.from(new Set([...current, ...action.assigneeIds]))
      : [...action.assigneeIds];
    patches.push({
      leadId: lead.id,
      patch: { [idsField]: nextIds, [singleField]: nextIds[0] || null },
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }

  if (action.type === "notify") {
    notifications.push({
      leadId: lead.id,
      message: action.message || `Automação "${rule.name}" disparada`,
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }

  if (action.type === "create_deliverable") {
    sideEffects.push({
      type: "create_deliverable",
      leadId: lead.id,
      title: (action.deliverableTitle || "Onboarding: {empresa}").replace("{empresa}", lead.company || "cliente"),
      companyIds: [lead.companyId],
      description: `Gerado automaticamente pela automação "${rule.name}" a partir do negócio "${lead.company}".`,
      priority: action.deliverablePriority || "media",
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }

  if (action.type === "enrich_cnpj") {
    sideEffects.push({
      type: "enrich_cnpj",
      leadId: lead.id,
      cnpj: lead.cnpj,
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }
}

export default useAutomations;
