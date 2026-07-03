import { useCallback, useMemo } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";

/**
 * Rule-based automation engine — no AI, zero API calls.
 *
 * Automation shape:
 * {
 *   id: string,
 *   name: string,
 *   companyId: string | "all",
 *   enabled: boolean,
 *   trigger: {
 *     type: "stage_change" | "field_value" | "time_in_stage" | "lead_created",
 *     fromStage?: string,    // stage_change: source (empty = any)
 *     toStage?: string,      // stage_change: destination (empty = any)
 *     field?: string,        // field_value: which field
 *     operator?: string,     // field_value: "eq" | "gt" | "lt" | "contains"
 *     value?: string,        // field_value: comparison value
 *     days?: number,         // time_in_stage: days since stageChangedAt
 *     stageId?: string,      // time_in_stage: which stage
 *   },
 *   action: {
 *     type: "move_stage" | "set_field" | "add_badge" | "notify" | "create_deliverable" | "enrich_cnpj",
 *     targetStage?: string,       // move_stage
 *     field?: string,             // set_field
 *     fieldValue?: string,        // set_field
 *     badge?: string,             // add_badge: label text
 *     badgeColor?: string,        // add_badge: hex color
 *     message?: string,           // notify: alert message
 *     deliverableTitle?: string,  // create_deliverable: título do card criado em Marketing → Entregas
 *     deliverablePriority?: string, // create_deliverable: "baixa" | "media" | "alta"
 *   },
 *   createdAt: string,
 * }
 *
 * create_deliverable e enrich_cnpj não retornam um patch síncrono — geram um
 * item em `sideEffects`, que quem chama evaluateAutomations (App.jsx) executa
 * de fato (insert cross-módulo / chamada à Edge Function de CNPJ).
 */

export function useAutomations() {
  const [automations, setAutomations] = usePersistentState(STORAGE_KEYS.automations, []);

  const addAutomation = useCallback((rule) => {
    setAutomations(prev => [
      ...prev,
      {
        ...rule,
        module: rule.module ?? "crm",
        id: crypto.randomUUID(),
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [setAutomations]);

  const updateAutomation = useCallback((id, patch) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, [setAutomations]);

  const deleteAutomation = useCallback((id) => {
    setAutomations(prev => prev.filter(a => a.id !== id));
  }, [setAutomations]);

  const toggleAutomation = useCallback((id) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }, [setAutomations]);

  /**
   * Evaluate all enabled automations against an entity change.
   *
   * @param {object} lead        - current entity state (after the triggering event)
   * @param {object|null} prev   - previous entity state (null = newly created)
   * @param {string} eventType   - "stage_change" | "field_value" | "lead_created" | etc.
   * @param {"crm"|"marketing"|"universal"} [module="crm"] - scope filter
   */
  const evaluateAutomations = useCallback((lead, prev, eventType, module = "crm") => {
    const patches = [];
    const notifications = [];
    const sideEffects = [];

    for (const rule of automations) {
      if (!rule.enabled) continue;
      // Module filter: rule must match requested module or be universal.
      // Rules without a module field are treated as "crm" (backwards compat).
      const ruleModule = rule.module ?? "crm";
      if (ruleModule !== "universal" && ruleModule !== module) continue;
      if (rule.companyId !== "all" && rule.companyId !== lead.companyId) continue;

      const { trigger, action } = rule;

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

      if (!triggered) continue;

      // ── Action execution ──────────────────────────────────────────────────
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
        const existing = lead._badges || [];
        const badge = { label: action.badge || "Auto", color: action.badgeColor || "#6366F1" };
        const alreadyHas = existing.some(b => b.label === badge.label);
        if (!alreadyHas) {
          patches.push({
            leadId: lead.id,
            patch: { _badges: [...existing, badge] },
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }
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

    return { patches, notifications, sideEffects };
  }, [automations]);

  // Summaries for the UI
  const stats = useMemo(() => ({
    total: automations.length,
    enabled: automations.filter(a => a.enabled).length,
    byType: automations.reduce((acc, a) => {
      acc[a.trigger.type] = (acc[a.trigger.type] || 0) + 1;
      return acc;
    }, {}),
    byModule: automations.reduce((acc, a) => {
      const m = a.module ?? "crm";
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {}),
  }), [automations]);

  return {
    automations,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    evaluateAutomations,
    stats,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function matchOperator(actual, operator, expected) {
  switch (operator) {
    case "eq":       return actual === expected;
    case "neq":      return actual !== expected;
    case "contains": return actual.toLowerCase().includes(expected.toLowerCase());
    case "gt":       return parseFloat(actual) > parseFloat(expected);
    case "lt":       return parseFloat(actual) < parseFloat(expected);
    case "gte":      return parseFloat(actual) >= parseFloat(expected);
    case "lte":      return parseFloat(actual) <= parseFloat(expected);
    default:         return actual === expected;
  }
}

export default useAutomations;
