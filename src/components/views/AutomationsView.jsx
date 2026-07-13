import React, { useMemo, useState } from "react";
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, ArrowRight,
  AlertCircle, Tag, MoveRight, Settings2, ChevronDown, ChevronUp, X, Info,
  Share2, Building2, GitBranch, CornerDownRight, ClipboardList,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES, defaultPipelines } from "../../constants/pipelines";
import { AUTOMATION_TEMPLATES } from "../../constants/automation-templates";
import { MARKETING_AUTOMATION_TEMPLATES } from "../../constants/marketing-pipelines";
import { useAutomations } from "../../hooks/use-automations";
import { EmptyState } from "../ui/EmptyState";

// ── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { id: "stage_change",  label: "Mudança de etapa",     icon: MoveRight,    desc: "Quando um card muda de etapa" },
  { id: "field_value",   label: "Valor de campo",       icon: Settings2,    desc: "Quando um campo atinge um valor" },
  { id: "time_in_stage", label: "Tempo na etapa",       icon: AlertCircle,  desc: "Quando um card fica X dias sem avançar" },
  { id: "pending_required_field", label: "Campo obrigatório pendente", icon: ClipboardList, desc: "Quando um card fica X dias na etapa com campo obrigatório vazio" },
  { id: "lead_created",  label: "Card criado",          icon: Plus,         desc: "Quando um novo card é criado" },
];

const ACTION_TYPES = [
  { id: "move_stage",  label: "Mover para etapa",  icon: MoveRight,   desc: "Move o card automaticamente" },
  { id: "set_field",   label: "Alterar campo",     icon: Settings2,   desc: "Atualiza o valor de um campo" },
  { id: "add_badge",   label: "Adicionar badge",   icon: Tag,         desc: "Adiciona uma etiqueta visual ao card" },
  { id: "notify",      label: "Notificação/alerta",icon: AlertCircle, desc: "Exibe alerta no painel" },
  { id: "create_deliverable", label: "Criar entrega em Marketing", icon: Share2,     desc: "Aciona outra área — cria um card em Entregas" },
  { id: "enrich_cnpj",        label: "Enriquecer com CNPJ",        icon: Building2,  desc: "Busca setor/cidade/estado automaticamente" },
];

const LEAD_FIELDS = [
  { id: "value",    label: "Valor (R$)" },
  { id: "fitScore", label: "FitScore" },
  { id: "owner",    label: "Responsável" },
  { id: "urgency",  label: "Urgência" },
];

// Único enum reconhecido pelo UrgencyTag (src/components/ui/UrgencyTag.jsx) —
// evita repetir o bug de "Prioridade" gravando um valor livre num campo que,
// na prática, só a UI reconhece um conjunto fechado de valores.
const URGENCY_VALUES = [
  { id: "critico",     label: "Crítico" },
  { id: "alto",        label: "Alto" },
  { id: "medio",       label: "Médio" },
  { id: "informativo", label: "Informativo" },
  { id: "imediato",    label: "Imediato" },
  { id: "30d",         label: "30 dias" },
  { id: "90d",         label: "90 dias" },
  { id: "indefinido",  label: "Indefinido" },
];

const OPERATORS = [
  { id: "eq",           label: "é igual a" },
  { id: "neq",          label: "é diferente de" },
  { id: "gt",           label: "maior que" },
  { id: "lt",           label: "menor que" },
  { id: "contains",     label: "contém" },
  { id: "is_empty",     label: "está vazio" },
  { id: "is_not_empty", label: "não está vazio" },
];

const NO_VALUE_OPERATORS = new Set(["is_empty", "is_not_empty"]);

const BADGE_COLORS = [
  { hex: "#6366F1", label: "Índigo" },
  { hex: "#F59E0B", label: "Âmbar" },
  { hex: "#EF4444", label: "Vermelho" },
  { hex: "#10B981", label: "Verde" },
  { hex: "#3B82F6", label: "Azul" },
  { hex: "#8B5CF6", label: "Roxo" },
];

const COMPANY_OPTIONS = [
  { id: "all",       label: "Todas as empresas" },
  { id: "industria", label: "Sanwey" },
  { id: "resibag",   label: "Resibag" },
];

// ── Main view ────────────────────────────────────────────────────────────────

export function AutomationsView({ leads, pipelines, activeCompany, currentUser }) {
  const { automations, addAutomation, deleteAutomation, toggleAutomation, stats } = useAutomations({ userId: currentUser?.id });
  const [showBuilder, setShowBuilder] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [moduleTab, setModuleTab] = useState("all");
  // Quando o usuário clica num template, pré-preenche o builder.
  const [builderInitial, setBuilderInitial] = useState(null);

  const openBuilder = (initial = null) => {
    setBuilderInitial(initial);
    setShowBuilder(true);
  };
  const closeBuilder = () => {
    setShowBuilder(false);
    setBuilderInitial(null);
  };

  const allStages = useMemo(() => {
    const p = pipelines || defaultPipelines();
    const seen = new Map();
    for (const stages of Object.values(p)) {
      for (const s of stages) {
        if (!seen.has(s.id)) seen.set(s.id, s);
      }
    }
    return Array.from(seen.values());
  }, [pipelines]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Automações
            </h1>
            <span
              className="inline-flex items-center justify-center rounded-full cursor-help"
              style={{ width: 18, height: 18, background: "var(--surface-alt)", color: "var(--text-dim)" }}
              title={
                "Regras automáticas que executam sozinhas — sem IA, sem aprovação.\n\n" +
                "Use para ações mecânicas e previsíveis:\n" +
                "• Mover card após X dias parado\n" +
                "• Aplicar badge ao criar lead\n" +
                "• Notificar mudança de etapa\n\n" +
                "Diferenças:\n" +
                "• Time de Agentes → sugere ações via IA, você decide se aprova\n" +
                "• Aba IA do card → assistente sob demanda para um lead específico"
              }
            >
              <Info size={11} />
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            Regras automáticas sem IA, compartilhadas com a equipe — {stats.enabled} ativa{stats.enabled !== 1 ? "s" : ""} de {stats.total}
          </p>
        </div>
        <button
          onClick={() => openBuilder()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#FFFFFF" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
        >
          <Plus size={15} />
          Nova automação
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TRIGGER_TYPES.map(t => {
          const Icon = t.icon;
          const count = stats.byType[t.id] || 0;
          return (
            <div
              key={t.id}
              className="rounded-xl border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
            >
              <Icon size={16} style={{ color: "var(--text-dim)" }} />
              <div>
                <div className="text-lg font-bold leading-none" style={{ color: "var(--text)" }}>{count}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{t.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {automations.length === 0 && (
        <EmptyState
          icon={Zap}
          title="Nenhuma automação criada"
          description="Escolha um template abaixo para começar — ou crie do zero se preferir."
          action={
            <button
              onClick={() => openBuilder()}
              className="mt-1 text-xs"
              style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Criar automação personalizada
            </button>
          }
        />
      )}

      {/* Galeria de templates — mostra sempre que houver poucos automatismos
          configurados (≤ 3). Quando o time já tem muitos, escondemos pra
          não ocupar espaço. */}
      {automations.length <= 3 && (
        <TemplateGallery onUseTemplate={(t) => openBuilder(t.rule)} />
      )}

      {/* Module filter tabs */}
      {automations.length > 0 && (
        <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
          {[
            { id: "all",       label: `Todas (${automations.length})` },
            { id: "crm",       label: `CRM (${stats.byModule?.crm || 0})` },
            { id: "marketing", label: `Marketing (${stats.byModule?.marketing || 0})` },
            { id: "universal", label: `Universal (${stats.byModule?.universal || 0})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setModuleTab(t.id)}
              className="px-3 py-2 text-xs font-medium border-b-2 transition-colors"
              style={{
                borderBottomColor: moduleTab === t.id ? "var(--accent)" : "transparent",
                color:             moduleTab === t.id ? "var(--accent)" : "var(--text-dim)",
                background:        "none",
                border:            "none",
                borderBottom:      `2px solid ${moduleTab === t.id ? "var(--accent)" : "transparent"}`,
                cursor:            "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Automation list */}
      {automations.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="divide-y" style={{ borderColor: "var(--surface-alt)" }}>
            {automations.filter(rule => moduleTab === "all" || (rule.module ?? "crm") === moduleTab).map(rule => (
              <AutomationRow
                key={rule.id}
                rule={rule}
                allStages={allStages}
                expanded={expandedId === rule.id}
                onExpand={() => setExpandedId(id => id === rule.id ? null : rule.id)}
                onToggle={() => toggleAutomation(rule.id)}
                onDelete={() => deleteAutomation(rule.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <HowItWorks />

      {/* Builder modal */}
      {showBuilder && (
        <AutomationBuilder
          allStages={allStages}
          initialRule={builderInitial}
          onSave={(rule) => { addAutomation(rule); closeBuilder(); }}
          onClose={closeBuilder}
        />
      )}
    </div>
  );
}

// ── Helpers de leitura (ação singular antiga ou thenActions novo) ────────────

function thenActionsOf(rule) {
  if (Array.isArray(rule.thenActions) && rule.thenActions.length) return rule.thenActions;
  if (rule.action) return [rule.action];
  return [];
}

function actionSummary(a, allStages) {
  if (!a) return "—";
  if (a.type === "move_stage") {
    const stage = allStages.find(s => s.id === a.targetStage)?.name || a.targetStage;
    return `Mover para ${stage}`;
  }
  if (a.type === "set_field")  return `${a.field} = "${a.fieldValue}"`;
  if (a.type === "add_badge")  return `Badge: ${a.badge}`;
  if (a.type === "notify")     return `Alerta: ${a.message}`;
  if (a.type === "create_deliverable") return `Entrega: "${a.deliverableTitle || "Onboarding: {empresa}"}"`;
  if (a.type === "enrich_cnpj") return "Busca CNPJ automática";
  return ACTION_TYPES.find(t => t.id === a.type)?.desc || "—";
}

function conditionGroupsSummary(groups) {
  if (!groups?.length) return null;
  return groups
    .map(g => (g.conditions || [])
      .map(c => {
        const op = OPERATORS.find(o => o.id === c.operator)?.label || c.operator;
        return NO_VALUE_OPERATORS.has(c.operator) ? `${c.field} ${op}` : `${c.field} ${op} "${c.value}"`;
      })
      .join(" E "))
    .join(" OU ");
}

// ── Automation row ────────────────────────────────────────────────────────────

function AutomationRow({ rule, allStages, expanded, onExpand, onToggle, onDelete }) {
  const triggerType = TRIGGER_TYPES.find(t => t.id === rule.trigger?.type);
  const TriggerIcon = triggerType?.icon || Zap;
  const company     = COMPANY_OPTIONS.find(c => c.id === rule.companyId);
  const thenActions = thenActionsOf(rule);
  const hasConditions = (rule.conditionGroups || []).length > 0;

  const triggerLabel = useMemo(() => {
    const t = rule.trigger;
    if (!t) return "—";
    if (t.type === "stage_change") {
      const from = allStages.find(s => s.id === t.fromStage)?.name || "qualquer etapa";
      const to   = allStages.find(s => s.id === t.toStage)?.name   || "qualquer etapa";
      return `${from} → ${to}`;
    }
    if (t.type === "field_value") {
      const op = OPERATORS.find(o => o.id === t.operator)?.label || t.operator;
      return `${t.field} ${op} "${t.value}"`;
    }
    if (t.type === "time_in_stage") {
      const stage = allStages.find(s => s.id === t.stageId)?.name || "etapa";
      return `${t.days || 0} dias em ${stage}`;
    }
    if (t.type === "pending_required_field") {
      const stage = allStages.find(s => s.id === t.stageId)?.name || "qualquer etapa";
      return `${t.days || 0} dias com campo pendente em ${stage}`;
    }
    return triggerType?.desc || "—";
  }, [rule.trigger, allStages, triggerType]);

  const actionLabel = thenActions.length > 1
    ? `${thenActions.length} ações`
    : actionSummary(thenActions[0], allStages);

  return (
    <div style={{ background: rule.enabled ? "var(--surface)" : "var(--surface-alt)" }}>
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className="shrink-0"
          title={rule.enabled ? "Desativar" : "Ativar"}
        >
          {rule.enabled
            ? <ToggleRight size={22} style={{ color: "var(--accent)" }} />
            : <ToggleLeft  size={22} style={{ color: "var(--text-faint)" }} />
          }
        </button>

        {/* Main info — clickable to expand */}
        <button className="flex-1 min-w-0 text-left flex items-center gap-3" onClick={onExpand}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: rule.enabled ? "var(--text)" : "var(--text-dim)" }}>
                {rule.name || "Sem nome"}
              </span>
              {company && company.id !== "all" && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: COMPANIES[rule.companyId]?.primary + "18" || "var(--surface-alt)", color: COMPANIES[rule.companyId]?.primary || "var(--text-dim)" }}
                >
                  {company.label}
                </span>
              )}
              {rule.module && rule.module !== "crm" && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: rule.module === "marketing" ? "#FDF4FF" : "#F0FDF4",
                    color:      rule.module === "marketing" ? "#7C3AED" : "var(--success)",
                    border:     `1px solid ${rule.module === "marketing" ? "#E9D5FF" : "#BBF7D0"}`,
                  }}
                >
                  {rule.module === "marketing" ? "Marketing" : "Universal"}
                </span>
              )}
              {hasConditions && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1"
                  style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                  title="Tem condições adicionais (E/OU) refinando o gatilho"
                >
                  <GitBranch size={9} />
                  condições
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap" style={{ color: "var(--text-dim)" }}>
              <TriggerIcon size={11} />
              <span>{triggerLabel}</span>
              <ArrowRight size={10} />
              <span>{actionLabel}</span>
            </div>
          </div>
          <span style={{ color: "var(--text-dim)" }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="shrink-0 p-1.5 rounded-lg"
          style={{ color: "var(--text-faint)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}
          title="Excluir automação"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-1"
          style={{ borderTop: "1px solid var(--surface-alt)" }}
        >
          <AutomationDetail rule={rule} allStages={allStages} />
        </div>
      )}
    </div>
  );
}

// ── Automation detail (expanded) ─────────────────────────────────────────────

function AutomationDetail({ rule, allStages }) {
  const t = rule.trigger;
  const thenActions = thenActionsOf(rule);
  const elseActions = rule.elseActions || [];
  const groups = rule.conditionGroups || [];

  return (
    <div className="space-y-3 mt-2">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>Gatilho</div>
          <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>
            {TRIGGER_TYPES.find(t2 => t2.id === t?.type)?.label || t?.type}
          </div>
          {t?.type === "stage_change" && (
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>
              De: <b>{allStages.find(s => s.id === t.fromStage)?.name || "Qualquer"}</b>
              {" → "}
              Para: <b>{allStages.find(s => s.id === t.toStage)?.name || "Qualquer"}</b>
            </div>
          )}
          {t?.type === "field_value" && (
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>
              Campo <b>{t.field}</b> {OPERATORS.find(o => o.id === t.operator)?.label} <b>"{t.value}"</b>
            </div>
          )}
          {t?.type === "time_in_stage" && (
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>
              <b>{t.days || 0} dias</b> na etapa <b>{allStages.find(s => s.id === t.stageId)?.name || t.stageId}</b>
            </div>
          )}
          {t?.type === "pending_required_field" && (
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>
              <b>{t.days || 0} dias</b> com campo obrigatório vazio em <b>{allStages.find(s => s.id === t.stageId)?.name || "qualquer etapa"}</b>
            </div>
          )}
          {t?.type === "lead_created" && (
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>Ao criar novo card</div>
          )}
        </div>

        <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
            {groups.length > 0 ? "Então (condição atendida)" : "Ação"}
          </div>
          {thenActions.length === 0 && <div className="text-xs" style={{ color: "var(--text-dim)" }}>—</div>}
          {thenActions.map((a, i) => (
            <div key={i} className="text-xs" style={{ color: "var(--text-dim)" }}>
              <b style={{ color: "var(--text)" }}>{ACTION_TYPES.find(a2 => a2.id === a?.type)?.label || a?.type}</b>
              {": "}{actionSummary(a, allStages)}
            </div>
          ))}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-dim)" }}>
            <GitBranch size={11} />
            Condições (refinam o gatilho acima)
          </div>
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>{conditionGroupsSummary(groups)}</div>

          {elseActions.length > 0 && (
            <div className="pt-2 mt-1" style={{ borderTop: "1px dashed var(--border)" }}>
              <div className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-dim)" }}>
                <CornerDownRight size={11} />
                Senão (condição não atendida)
              </div>
              {elseActions.map((a, i) => (
                <div key={i} className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                  <b style={{ color: "var(--text)" }}>{ACTION_TYPES.find(a2 => a2.id === a?.type)?.label || a?.type}</b>
                  {": "}{actionSummary(a, allStages)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Builder modal ─────────────────────────────────────────────────────────────

const MODULE_OPTIONS = [
  { id: "crm",       label: "CRM" },
  { id: "marketing", label: "Marketing" },
  { id: "universal", label: "Universal" },
];

const EMPTY_ACTION = { type: "move_stage", targetStage: "" };
const EMPTY_CONDITION = { field: "", operator: "eq", value: "" };

const EMPTY_RULE = {
  name: "",
  companyId: "all",
  module: "crm",
  trigger: { type: "stage_change", fromStage: "", toStage: "" },
  conditionGroups: [],
  thenActions: [{ ...EMPTY_ACTION }],
  elseActions: [],
};

function AutomationBuilder({ allStages, initialRule, onSave, onClose }) {
  // initialRule vem dos templates (clique em "Usar template") ou de uma regra
  // antiga com `action` singular — normaliza pro shape novo (thenActions[]).
  const [rule, setRule] = useState(() => {
    if (!initialRule) return EMPTY_RULE;
    const thenActions = Array.isArray(initialRule.thenActions) && initialRule.thenActions.length
      ? initialRule.thenActions
      : (initialRule.action ? [{ ...initialRule.action }] : [{ ...EMPTY_ACTION }]);
    return {
      ...EMPTY_RULE,
      ...initialRule,
      trigger: { ...EMPTY_RULE.trigger, ...(initialRule.trigger || {}) },
      conditionGroups: initialRule.conditionGroups || [],
      thenActions,
      elseActions: initialRule.elseActions || [],
    };
  });
  // Quando o template já tem tudo preenchido, começa direto na etapa de
  // ação (revisão final). Quando não, segue do zero.
  const [step, setStep] = useState(initialRule ? 3 : 0);

  const hasConditions = rule.conditionGroups.length > 0;
  const steps = hasConditions
    ? ["Identificação", "Gatilho", "Condições", "Então / Senão"]
    : ["Identificação", "Gatilho", "Condições", "Ação"];

  const canNext = () => {
    if (step === 0) return rule.name.trim().length > 0;
    if (step === 1) return validateTrigger(rule.trigger);
    if (step === 2) return true; // condições são opcionais
    if (step === 3) return rule.thenActions.length > 0 && rule.thenActions.every(validateAction);
    return false;
  };

  const handleSave = () => {
    if (!canNext()) return;
    onSave(rule);
  };

  const setTrigger = (patch) => setRule(r => ({ ...r, trigger: { ...r.trigger, ...patch } }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "var(--surface)", maxHeight: "90vh" }}
      >
        {/* Modal header */}
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--surface-alt)" }}>
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: "var(--accent)" }} />
            <span className="font-bold text-sm" style={{ color: "var(--text)" }}>Nova automação</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 flex items-center gap-0 flex-wrap">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <button
                onClick={() => i < step && setStep(i)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{
                  color: i === step ? "var(--accent)" : i < step ? "var(--text-dim)" : "var(--border-strong)",
                  cursor: i < step ? "pointer" : "default",
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: i === step ? "var(--accent)" : i < step ? "var(--border)" : "var(--surface-alt)",
                    color: i === step ? "#FFFFFF" : i < step ? "var(--text-dim)" : "var(--border-strong)",
                  }}
                >
                  {i + 1}
                </span>
                {s}
              </button>
              {i < steps.length - 1 && (
                <span className="mx-2 text-xs" style={{ color: "var(--border)" }}>›</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 0 && (
            <StepIdentification rule={rule} setRule={setRule} />
          )}
          {step === 1 && (
            <StepTrigger rule={rule} allStages={allStages} setTrigger={setTrigger} />
          )}
          {step === 2 && (
            <StepConditions rule={rule} setRule={setRule} />
          )}
          {step === 3 && (
            <StepActions rule={rule} allStages={allStages} setRule={setRule} hasConditions={hasConditions} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--surface-alt)" }}>
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 rounded-xl text-sm border font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            {step === 0 ? "Cancelar" : "Voltar"}
          </button>
          {step < 3 ? (
            <button
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: canNext() ? "var(--accent)" : "var(--border)",
                color: canNext() ? "#FFFFFF" : "var(--text-faint)",
              }}
              onMouseEnter={e => { if (canNext()) e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={e => { if (canNext()) e.currentTarget.style.background = "var(--accent)"; }}
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!canNext()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: canNext() ? "var(--accent)" : "var(--border)",
                color: canNext() ? "#FFFFFF" : "var(--text-faint)",
              }}
              onMouseEnter={e => { if (canNext()) e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={e => { if (canNext()) e.currentTarget.style.background = "var(--accent)"; }}
            >
              <Zap size={13} />
              Criar automação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Builder steps ─────────────────────────────────────────────────────────────

function StepIdentification({ rule, setRule }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Nome da automação <span style={{ color: "#EF4444" }}>*</span>
        </label>
        <input
          type="text"
          value={rule.name}
          onChange={e => setRule(r => ({ ...r, name: e.target.value }))}
          placeholder="Ex: Mover lead ganho para onboarding"
          className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
          onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
          onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Módulo</label>
        <div className="flex gap-2">
          {MODULE_OPTIONS.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setRule(r => ({ ...r, module: m.id }))}
              className="flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors"
              style={{
                borderColor: (rule.module ?? "crm") === m.id ? "var(--accent)" : "var(--border)",
                background:  "var(--surface-alt)",
                color:       (rule.module ?? "crm") === m.id ? "var(--accent)" : "var(--text-dim)",
                cursor:      "pointer",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-dim)" }}>
          {(rule.module ?? "crm") === "crm" ? "Avalia leads no pipeline de CRM." :
           (rule.module ?? "crm") === "marketing" ? "Avalia campanhas no Kanban de Marketing." :
           "Avalia em todos os módulos."}
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Empresa</label>
        <select
          value={rule.companyId}
          onChange={e => setRule(r => ({ ...r, companyId: e.target.value }))}
          className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          {COMPANY_OPTIONS.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StepTrigger({ rule, allStages, setTrigger }) {
  const t = rule.trigger;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>
          Tipo de gatilho
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TRIGGER_TYPES.map(type => {
            const Icon = type.icon;
            const active = t.type === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setTrigger({ type: type.id })}
                className="flex items-start gap-2.5 p-3 rounded-xl border text-left"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: "var(--surface-alt)",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--bg)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
              >
                <Icon size={14} style={{ color: active ? "var(--accent)" : "var(--text-dim)", marginTop: 1 }} />
                <div>
                  <div className="text-xs font-semibold" style={{ color: active ? "var(--accent)" : "var(--text)" }}>
                    {type.label}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>{type.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trigger config */}
      {t.type === "stage_change" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>De (etapa)</label>
            <select
              value={t.fromStage || ""}
              onChange={e => setTrigger({ fromStage: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            >
              <option value="">Qualquer etapa</option>
              {allStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Para (etapa)</label>
            <select
              value={t.toStage || ""}
              onChange={e => setTrigger({ toStage: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            >
              <option value="">Qualquer etapa</option>
              {allStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {t.type === "field_value" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Campo</label>
            <select
              value={t.field || ""}
              onChange={e => setTrigger({ field: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            >
              <option value="">Selecionar campo...</option>
              {LEAD_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Operador</label>
              <select
                value={t.operator || "eq"}
                onChange={e => setTrigger({ operator: e.target.value })}
                className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              >
                {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            {!NO_VALUE_OPERATORS.has(t.operator) && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Valor</label>
                <input
                  type="text"
                  value={t.value || ""}
                  onChange={e => setTrigger({ value: e.target.value })}
                  placeholder="Valor..."
                  className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {t.type === "time_in_stage" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Etapa</label>
            <select
              value={t.stageId || ""}
              onChange={e => setTrigger({ stageId: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            >
              <option value="">Qualquer etapa</option>
              {allStages.filter(s => !s.terminal).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Dias parado</label>
            <input
              type="number"
              min="1"
              value={t.days || ""}
              onChange={e => setTrigger({ days: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 7"
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>
        </div>
      )}

      {t.type === "pending_required_field" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Etapa</label>
            <select
              value={t.stageId || ""}
              onChange={e => setTrigger({ stageId: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            >
              <option value="">Qualquer etapa</option>
              {allStages.filter(s => !s.terminal).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>Dias com campo pendente</label>
            <input
              type="number"
              min="1"
              value={t.days || ""}
              onChange={e => setTrigger({ days: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 3"
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>
        </div>
      )}

      {t.type === "lead_created" && (
        <div
          className="rounded-xl border px-4 py-3 text-xs"
          style={{ borderColor: "#BFDBFE", background: "var(--surface-alt)", color: "#1E40AF" }}
        >
          Este gatilho dispara sempre que um novo card é criado no pipeline.
        </div>
      )}
    </div>
  );
}

// ── Step: Condições (grupos AND/OR, opcional) ────────────────────────────────

function StepConditions({ rule, setRule }) {
  const groups = rule.conditionGroups;

  const addGroup = () => setRule(r => ({
    ...r,
    conditionGroups: [...r.conditionGroups, { logic: "AND", conditions: [{ ...EMPTY_CONDITION }] }],
  }));

  const removeGroup = (gi) => setRule(r => ({
    ...r,
    conditionGroups: r.conditionGroups.filter((_, i) => i !== gi),
  }));

  const addCondition = (gi) => setRule(r => ({
    ...r,
    conditionGroups: r.conditionGroups.map((g, i) => i === gi ? { ...g, conditions: [...g.conditions, { ...EMPTY_CONDITION }] } : g),
  }));

  const removeCondition = (gi, ci) => setRule(r => ({
    ...r,
    conditionGroups: r.conditionGroups.map((g, i) => i === gi ? { ...g, conditions: g.conditions.filter((_, j) => j !== ci) } : g),
  }));

  const patchCondition = (gi, ci, patch) => setRule(r => ({
    ...r,
    conditionGroups: r.conditionGroups.map((g, i) => i === gi
      ? { ...g, conditions: g.conditions.map((c, j) => j === ci ? { ...c, ...patch } : c) }
      : g),
  }));

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border px-4 py-3 text-xs"
        style={{ borderColor: "var(--border)", background: "var(--surface-alt)", color: "var(--text-dim)" }}
      >
        Opcional — refina o gatilho acima. Condições dentro do <b>mesmo grupo</b> exigem <b>E</b> (todas precisam ser verdadeiras);
        <b> grupos diferentes</b> são combinados por <b>OU</b> (basta um grupo passar). Sem grupos, só o gatilho decide.
      </div>

      {groups.length === 0 && (
        <button
          onClick={addGroup}
          className="w-full flex items-center justify-center gap-1.5 p-3 text-xs font-semibold rounded-xl border-2 border-dashed"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface-alt)" }}
        >
          <GitBranch size={13} />
          Adicionar condições
        </button>
      )}

      {groups.map((group, gi) => (
        <div key={gi} className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
              {gi === 0 ? "Grupo 1" : `OU · Grupo ${gi + 1}`}
            </span>
            <button
              onClick={() => removeGroup(gi)}
              className="p-1 rounded"
              style={{ color: "var(--text-faint)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-faint)"; }}
              title="Remover grupo"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {group.conditions.map((c, ci) => (
            <div key={ci} className="flex items-center gap-1.5">
              {ci > 0 && (
                <span className="text-[10px] font-bold px-1.5 shrink-0" style={{ color: "var(--text-dim)" }}>E</span>
              )}
              <select
                value={c.field}
                onChange={e => patchCondition(gi, ci, { field: e.target.value })}
                className="flex-1 min-w-0 text-xs rounded-lg border px-2 py-1.5 outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              >
                <option value="">Campo...</option>
                {LEAD_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <select
                value={c.operator}
                onChange={e => patchCondition(gi, ci, { operator: e.target.value })}
                className="text-xs rounded-lg border px-2 py-1.5 outline-none shrink-0"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", width: 128 }}
              >
                {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              {!NO_VALUE_OPERATORS.has(c.operator) && (
                <input
                  type="text"
                  value={c.value}
                  onChange={e => patchCondition(gi, ci, { value: e.target.value })}
                  placeholder="Valor"
                  className="w-20 text-xs rounded-lg border px-2 py-1.5 outline-none shrink-0"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}
                />
              )}
              {group.conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(gi, ci)}
                  className="p-1 rounded shrink-0"
                  style={{ color: "var(--text-faint)" }}
                  title="Remover condição"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={() => addCondition(gi)}
            className="text-[11px] font-semibold flex items-center gap-1"
            style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
          >
            <Plus size={10} /> Adicionar condição (E)
          </button>
        </div>
      ))}

      {groups.length > 0 && (
        <button
          onClick={addGroup}
          className="w-full flex items-center justify-center gap-1.5 p-2.5 text-xs font-semibold rounded-xl border-2 border-dashed"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface-alt)" }}
        >
          <Plus size={12} /> Adicionar grupo (OU)
        </button>
      )}
    </div>
  );
}

// ── Step: Ações (then / else) ────────────────────────────────────────────────

function StepActions({ rule, allStages, setRule, hasConditions }) {
  const patchThen = (updater) => setRule(r => ({ ...r, thenActions: updater(r.thenActions) }));
  const patchElse = (updater) => setRule(r => ({ ...r, elseActions: updater(r.elseActions || []) }));

  return (
    <div className="space-y-5">
      <ActionListEditor
        title={hasConditions ? "Então (se a condição passar)" : "Ação"}
        actions={rule.thenActions}
        setActions={patchThen}
        allStages={allStages}
        allowEmpty={false}
      />

      {hasConditions && (
        <div className="pt-3" style={{ borderTop: "1px dashed var(--border)" }}>
          <ActionListEditor
            title="Senão (se a condição não passar)"
            actions={rule.elseActions || []}
            setActions={patchElse}
            allStages={allStages}
            allowEmpty
          />
        </div>
      )}
    </div>
  );
}

function ActionListEditor({ title, actions, setActions, allStages, allowEmpty }) {
  const addAction = () => setActions(list => [...list, { ...EMPTY_ACTION }]);
  const removeAction = (i) => setActions(list => list.filter((_, j) => j !== i));
  const patchAction = (i, patch) => setActions(list => list.map((a, j) => j === i ? { ...a, ...patch } : a));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold" style={{ color: "var(--text)" }}>{title}</label>
        <button
          onClick={addAction}
          className="text-[11px] font-semibold flex items-center gap-1"
          style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
        >
          <Plus size={10} /> Adicionar ação
        </button>
      </div>

      {actions.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          {allowEmpty ? "Nenhuma ação — não faz nada quando cai no senão." : "Adicione ao menos uma ação."}
        </p>
      )}

      {actions.map((action, i) => (
        <div key={i} className="rounded-xl border p-3 space-y-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
              Ação {i + 1}
            </span>
            {actions.length > (allowEmpty ? 0 : 1) && (
              <button
                onClick={() => removeAction(i)}
                className="p-1 rounded"
                style={{ color: "var(--text-faint)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-faint)"; }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {ACTION_TYPES.map(type => {
              const Icon = type.icon;
              const active = action.type === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => patchAction(i, { type: type.id })}
                  className="flex items-center gap-1.5 p-2 rounded-lg border text-left"
                  style={{
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    background: "var(--surface-alt)",
                  }}
                >
                  <Icon size={12} style={{ color: active ? "var(--accent)" : "var(--text-dim)" }} />
                  <span className="text-[11px] font-semibold" style={{ color: active ? "var(--accent)" : "var(--text)" }}>
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>

          <ActionConfig action={action} allStages={allStages} setAction={(patch) => patchAction(i, patch)} />
        </div>
      ))}
    </div>
  );
}

function ActionConfig({ action: a, allStages, setAction }) {
  if (a.type === "move_stage") {
    return (
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text)" }}>Mover para</label>
        <select
          value={a.targetStage || ""}
          onChange={e => setAction({ targetStage: e.target.value })}
          className="w-full text-xs rounded-lg border px-2.5 py-2 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="">Selecionar etapa...</option>
          {allStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
    );
  }

  if (a.type === "set_field") {
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text)" }}>Campo</label>
          <select
            value={a.field || ""}
            onChange={e => setAction({ field: e.target.value })}
            className="w-full text-xs rounded-lg border px-2.5 py-2 outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
          >
            <option value="">Selecionar campo...</option>
            {LEAD_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text)" }}>Novo valor</label>
          {a.field === "urgency" ? (
            <select
              value={a.fieldValue || ""}
              onChange={e => setAction({ fieldValue: e.target.value })}
              className="w-full text-xs rounded-lg border px-2.5 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            >
              <option value="">Selecionar urgência...</option>
              {URGENCY_VALUES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={a.fieldValue || ""}
              onChange={e => setAction({ fieldValue: e.target.value })}
              placeholder="Valor a definir..."
              className="w-full text-xs rounded-lg border px-2.5 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            />
          )}
        </div>
      </div>
    );
  }

  if (a.type === "add_badge") {
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text)" }}>Texto do badge</label>
          <input
            type="text"
            value={a.badge || ""}
            onChange={e => setAction({ badge: e.target.value })}
            placeholder="Ex: Urgente, Hot lead, VIP..."
            className="w-full text-xs rounded-lg border px-2.5 py-2 outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>Cor do badge</label>
          <div className="flex gap-1.5 flex-wrap">
            {BADGE_COLORS.map(c => (
              <button
                key={c.hex}
                onClick={() => setAction({ badgeColor: c.hex })}
                className="w-6 h-6 rounded-full border-2 transition-transform"
                style={{
                  background: c.hex,
                  borderColor: a.badgeColor === c.hex ? "var(--text)" : "transparent",
                  transform: a.badgeColor === c.hex ? "scale(1.2)" : "scale(1)",
                }}
                title={c.label}
              />
            ))}
          </div>
        </div>
        {a.badge && (
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>Preview:</span>
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: (a.badgeColor || "#6366F1") + "20", color: a.badgeColor || "#6366F1" }}
            >
              {a.badge}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (a.type === "notify") {
    return (
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text)" }}>Mensagem do alerta</label>
        <textarea
          value={a.message || ""}
          onChange={e => setAction({ message: e.target.value })}
          placeholder="Ex: Lead sem movimento há 7 dias — revisar estratégia"
          rows={2}
          className="w-full text-xs rounded-lg border px-2.5 py-2 outline-none resize-none"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        />
      </div>
    );
  }

  if (a.type === "create_deliverable") {
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text)" }}>Título da entrega</label>
          <input
            type="text"
            value={a.deliverableTitle || ""}
            onChange={e => setAction({ deliverableTitle: e.target.value })}
            placeholder="Onboarding: {empresa}"
            className="w-full text-xs rounded-lg border px-2.5 py-2 outline-none"
            style={{ borderColor: "#E5E7EB", color: "var(--text)" }}
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>Use {"{empresa}"} para inserir o nome do negócio automaticamente.</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text)" }}>Prioridade</label>
          <select
            value={a.deliverablePriority || "media"}
            onChange={e => setAction({ deliverablePriority: e.target.value })}
            className="w-full text-xs rounded-lg border px-2.5 py-2 outline-none"
            style={{ borderColor: "#E5E7EB", color: "var(--text)", background: "#FFFFFF" }}
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>
      </div>
    );
  }

  if (a.type === "enrich_cnpj") {
    return (
      <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
        Ao disparar, busca o CNPJ do lead automaticamente e preenche setor, cidade, estado e situação — só nos campos que ainda estiverem vazios.
      </p>
    );
  }

  return null;
}

// ── How it works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        style={{ background: "var(--surface-alt)" }}
      >
        <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>Como as automações funcionam?</span>
        {open ? <ChevronUp size={13} style={{ color: "var(--text-dim)" }} /> : <ChevronDown size={13} style={{ color: "var(--text-dim)" }} />}
      </button>
      {open && (
        <div className="px-4 py-3 text-xs space-y-2" style={{ color: "var(--text-dim)", borderTop: "1px solid var(--surface-alt)" }}>
          <p>As automações são <strong>regras compartilhadas com a equipe</strong> (salvas no banco, não só no seu navegador), avaliadas sempre que um card é atualizado — sem IA e sem custo por execução. Duas ações (criar entrega e enriquecer com CNPJ) chamam uma API real quando disparam; as demais são só lógica local.</p>
          <p><strong>Gatilhos disponíveis:</strong> mudança de etapa, valor de campo, tempo parado em etapa, campo obrigatório pendente há X dias, criação de card.</p>
          <p><strong>Condições (opcional):</strong> refine o gatilho com grupos de condições — condições no mesmo grupo exigem E, grupos diferentes são combinados por OU. Com condições, você pode definir ações para "então" (passou) e "senão" (não passou).</p>
          <p><strong>Ações disponíveis:</strong> mover o card para outra etapa, alterar um campo, adicionar badge visual, exibir alerta, criar entrega em Marketing, ou enriquecer com dados de CNPJ — cada regra pode disparar mais de uma.</p>
          <p>As regras são avaliadas em sequência, na ordem de criação. Se múltiplas regras dispararem no mesmo evento, todas serão executadas.</p>
          <p className="font-medium" style={{ color: "#1E40AF" }}>Para automações que dependem de tempo (ex: 7 dias sem mover), o avaliador roda ao abrir o CRM ou ao interagir com um card.</p>
        </div>
      )}
    </div>
  );
}

// ── Validation helpers ────────────────────────────────────────────────────────

function validateTrigger(t) {
  if (!t?.type) return false;
  if (t.type === "field_value") {
    if (!t.field || !t.operator) return false;
    return NO_VALUE_OPERATORS.has(t.operator) || Boolean(t.value);
  }
  if (t.type === "time_in_stage") return (t.days || 0) > 0;
  if (t.type === "pending_required_field") return (t.days || 0) > 0;
  return true;
}

function validateAction(a) {
  if (!a?.type) return false;
  if (a.type === "move_stage")         return Boolean(a.targetStage);
  if (a.type === "set_field")          return Boolean(a.field);
  if (a.type === "add_badge")          return Boolean(a.badge);
  if (a.type === "notify")             return Boolean(a.message?.trim());
  if (a.type === "create_deliverable") return true; // título tem valor padrão
  if (a.type === "enrich_cnpj")        return true; // sem configuração obrigatória
  return false;
}

// ── Template gallery ─────────────────────────────────────────────────────────

function TemplateGallery({ onUseTemplate }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
        <div>
          <div className="flex items-center gap-1.5">
            <Zap size={14} style={{ color: "var(--accent)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>
              Templates prontos
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
            Use como ponto de partida — depois você pode ajustar antes de salvar.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {[...AUTOMATION_TEMPLATES, ...MARKETING_AUTOMATION_TEMPLATES].map(t => (
          <button
            key={t.id}
            onClick={() => onUseTemplate(t)}
            className="text-left rounded-lg border p-3 transition-all cursor-pointer"
            style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.background = "var(--surface-alt)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "var(--surface-alt)";
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none mt-0.5">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold leading-snug" style={{ color: "var(--text)" }}>
                  {t.title}
                </div>
                <div className="text-[11px] mt-1 leading-snug" style={{ color: "var(--text-dim)" }}>
                  {t.summary}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--accent)" }}>
                <Plus size={10} />
                Usar este template
              </div>
              {t.rule?.module && t.rule.module !== "crm" && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                  style={{
                    background: t.rule.module === "marketing" ? "#FDF4FF" : "#F0FDF4",
                    color:      t.rule.module === "marketing" ? "#7C3AED" : "var(--success)",
                  }}
                >
                  {t.rule.module === "marketing" ? "Marketing" : "Universal"}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default AutomationsView;
