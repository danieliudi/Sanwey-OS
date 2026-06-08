import React, { useMemo, useState } from "react";
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, ArrowRight,
  AlertCircle, Tag, MoveRight, Settings2, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES, defaultPipelines } from "../../constants/pipelines";
import { AUTOMATION_TEMPLATES } from "../../constants/automation-templates";
import { useAutomations } from "../../hooks/use-automations";

// ── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { id: "stage_change",  label: "Mudança de etapa",     icon: MoveRight,    desc: "Quando um card muda de etapa" },
  { id: "field_value",   label: "Valor de campo",       icon: Settings2,    desc: "Quando um campo atinge um valor" },
  { id: "time_in_stage", label: "Tempo na etapa",       icon: AlertCircle,  desc: "Quando um card fica X dias sem avançar" },
  { id: "lead_created",  label: "Card criado",          icon: Plus,         desc: "Quando um novo card é criado" },
];

const ACTION_TYPES = [
  { id: "move_stage",  label: "Mover para etapa",  icon: MoveRight,   desc: "Move o card automaticamente" },
  { id: "set_field",   label: "Alterar campo",     icon: Settings2,   desc: "Atualiza o valor de um campo" },
  { id: "add_badge",   label: "Adicionar badge",   icon: Tag,         desc: "Adiciona uma etiqueta visual ao card" },
  { id: "notify",      label: "Notificação/alerta",icon: AlertCircle, desc: "Exibe alerta no painel" },
];

const LEAD_FIELDS = [
  { id: "value",    label: "Valor (R$)" },
  { id: "fitScore", label: "FitScore" },
  { id: "owner",    label: "Responsável" },
  { id: "priority", label: "Prioridade" },
];

const OPERATORS = [
  { id: "eq",       label: "é igual a" },
  { id: "neq",      label: "é diferente de" },
  { id: "gt",       label: "maior que" },
  { id: "lt",       label: "menor que" },
  { id: "contains", label: "contém" },
];

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
  { id: "industria", label: "Sanwey Indústria" },
  { id: "resibag",   label: "Resibag" },
  { id: "montemor",  label: "Montemor" },
];

// ── Main view ────────────────────────────────────────────────────────────────

export function AutomationsView({ leads, pipelines, activeCompany }) {
  const { automations, addAutomation, deleteAutomation, toggleAutomation, stats } = useAutomations();
  const [showBuilder, setShowBuilder] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
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
            <Zap size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
              Automações
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            Regras automáticas sem IA — {stats.enabled} ativa{stats.enabled !== 1 ? "s" : ""} de {stats.total}
          </p>
        </div>
        <button
          onClick={() => openBuilder()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#1E4D8C", color: "#FFFFFF" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#163a6b"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#1E4D8C"; }}
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
              style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
            >
              <Icon size={16} style={{ color: NEUTRAL.slate }} />
              <div>
                <div className="text-lg font-bold leading-none" style={{ color: NEUTRAL.graphite }}>{count}</div>
                <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>{t.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {automations.length === 0 && (
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 gap-3"
          style={{ borderColor: "#E5E7EB" }}
        >
          <Zap size={32} style={{ color: "#D1D5DB" }} />
          <p className="text-sm font-semibold" style={{ color: NEUTRAL.slate }}>Nenhuma automação criada</p>
          <p className="text-xs text-center max-w-md" style={{ color: "#9CA3AF" }}>
            Escolha um template abaixo para começar — ou crie do zero se preferir.
          </p>
          <button
            onClick={() => openBuilder()}
            className="mt-1 text-xs"
            style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Criar automação personalizada
          </button>
        </div>
      )}

      {/* Galeria de templates — mostra sempre que houver poucos automatismos
          configurados (≤ 3). Quando o time já tem muitos, escondemos pra
          não ocupar espaço. */}
      {automations.length <= 3 && (
        <TemplateGallery onUseTemplate={(t) => openBuilder(t.rule)} />
      )}

      {/* Automation list */}
      {automations.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {automations.map(rule => (
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

// ── Automation row ────────────────────────────────────────────────────────────

function AutomationRow({ rule, allStages, expanded, onExpand, onToggle, onDelete }) {
  const triggerType = TRIGGER_TYPES.find(t => t.id === rule.trigger?.type);
  const actionType  = ACTION_TYPES.find(a => a.id === rule.action?.type);
  const TriggerIcon = triggerType?.icon || Zap;
  const ActionIcon  = actionType?.icon || Zap;
  const company     = COMPANY_OPTIONS.find(c => c.id === rule.companyId);

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
    return triggerType?.desc || "—";
  }, [rule.trigger, allStages, triggerType]);

  const actionLabel = useMemo(() => {
    const a = rule.action;
    if (!a) return "—";
    if (a.type === "move_stage") {
      const stage = allStages.find(s => s.id === a.targetStage)?.name || a.targetStage;
      return `Mover para ${stage}`;
    }
    if (a.type === "set_field")  return `${a.field} = "${a.fieldValue}"`;
    if (a.type === "add_badge")  return `Badge: ${a.badge}`;
    if (a.type === "notify")     return `Alerta: ${a.message}`;
    return actionType?.desc || "—";
  }, [rule.action, allStages, actionType]);

  return (
    <div style={{ background: rule.enabled ? "#FFFFFF" : "#FAFAFA" }}>
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className="shrink-0"
          title={rule.enabled ? "Desativar" : "Ativar"}
        >
          {rule.enabled
            ? <ToggleRight size={22} style={{ color: "#1E4D8C" }} />
            : <ToggleLeft  size={22} style={{ color: "#9CA3AF" }} />
          }
        </button>

        {/* Main info — clickable to expand */}
        <button className="flex-1 min-w-0 text-left flex items-center gap-3" onClick={onExpand}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: rule.enabled ? NEUTRAL.graphite : NEUTRAL.slate }}>
                {rule.name || "Sem nome"}
              </span>
              {company && company.id !== "all" && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: COMPANIES[rule.companyId]?.primary + "18" || "#F3F4F6", color: COMPANIES[rule.companyId]?.primary || NEUTRAL.slate }}
                >
                  {company.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap" style={{ color: NEUTRAL.slate }}>
              <TriggerIcon size={11} />
              <span>{triggerLabel}</span>
              <ArrowRight size={10} />
              <ActionIcon size={11} />
              <span>{actionLabel}</span>
            </div>
          </div>
          <span style={{ color: NEUTRAL.slate }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="shrink-0 p-1.5 rounded-lg"
          style={{ color: "#9CA3AF" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; }}
          title="Excluir automação"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-1"
          style={{ borderTop: "1px solid #F3F4F6" }}
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
  const a = rule.action;

  return (
    <div className="grid sm:grid-cols-2 gap-4 mt-2">
      <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}>
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: NEUTRAL.slate }}>Gatilho</div>
        <div className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>
          {TRIGGER_TYPES.find(t2 => t2.id === t?.type)?.label || t?.type}
        </div>
        {t?.type === "stage_change" && (
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>
            De: <b>{allStages.find(s => s.id === t.fromStage)?.name || "Qualquer"}</b>
            {" → "}
            Para: <b>{allStages.find(s => s.id === t.toStage)?.name || "Qualquer"}</b>
          </div>
        )}
        {t?.type === "field_value" && (
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>
            Campo <b>{t.field}</b> {OPERATORS.find(o => o.id === t.operator)?.label} <b>"{t.value}"</b>
          </div>
        )}
        {t?.type === "time_in_stage" && (
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>
            <b>{t.days || 0} dias</b> na etapa <b>{allStages.find(s => s.id === t.stageId)?.name || t.stageId}</b>
          </div>
        )}
        {t?.type === "lead_created" && (
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>Ao criar novo card</div>
        )}
      </div>

      <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}>
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: NEUTRAL.slate }}>Ação</div>
        <div className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>
          {ACTION_TYPES.find(a2 => a2.id === a?.type)?.label || a?.type}
        </div>
        {a?.type === "move_stage" && (
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>
            Mover para <b>{allStages.find(s => s.id === a.targetStage)?.name || a.targetStage}</b>
          </div>
        )}
        {a?.type === "set_field" && (
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>
            Definir <b>{a.field}</b> = "<b>{a.fieldValue}</b>"
          </div>
        )}
        {a?.type === "add_badge" && (
          <div className="flex items-center gap-2 mt-1">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: (a.badgeColor || "#6366F1") + "20", color: a.badgeColor || "#6366F1" }}
            >
              {a.badge || "Badge"}
            </span>
          </div>
        )}
        {a?.type === "notify" && (
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>"{a.message}"</div>
        )}
      </div>
    </div>
  );
}

// ── Builder modal ─────────────────────────────────────────────────────────────

const EMPTY_RULE = {
  name: "",
  companyId: "all",
  trigger: { type: "stage_change", fromStage: "", toStage: "" },
  action:  { type: "move_stage",   targetStage: "" },
};

function AutomationBuilder({ allStages, initialRule, onSave, onClose }) {
  // initialRule vem dos templates (clique em "Usar template"). Garante
  // shape válido mesclando com EMPTY_RULE pra evitar quebrar a validação
  // se algum campo estiver faltando.
  const [rule, setRule] = useState(() => {
    if (!initialRule) return EMPTY_RULE;
    return {
      ...EMPTY_RULE,
      ...initialRule,
      trigger: { ...EMPTY_RULE.trigger, ...(initialRule.trigger || {}) },
      action:  { ...EMPTY_RULE.action,  ...(initialRule.action  || {}) },
    };
  });
  // Quando o template já tem tudo preenchido, começa direto na etapa de
  // ação (revisão final). Quando não, segue do zero.
  const [step, setStep] = useState(initialRule ? 2 : 0);

  const canNext = () => {
    if (step === 0) return rule.name.trim().length > 0;
    if (step === 1) return validateTrigger(rule.trigger);
    if (step === 2) return validateAction(rule.action);
    return false;
  };

  const handleSave = () => {
    if (!canNext()) return;
    onSave(rule);
  };

  const setTrigger = (patch) => setRule(r => ({ ...r, trigger: { ...r.trigger, ...patch } }));
  const setAction  = (patch) => setRule(r => ({ ...r, action:  { ...r.action,  ...patch } }));

  const steps = ["Identificação", "Gatilho", "Ação"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "#FFFFFF", maxHeight: "90vh" }}
      >
        {/* Modal header */}
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "#F3F4F6" }}>
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: "#1E4D8C" }} />
            <span className="font-bold text-sm" style={{ color: NEUTRAL.graphite }}>Nova automação</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: NEUTRAL.slate }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 flex items-center gap-0">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <button
                onClick={() => i < step && setStep(i)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{
                  color: i === step ? "#1E4D8C" : i < step ? "#6B7280" : "#D1D5DB",
                  cursor: i < step ? "pointer" : "default",
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: i === step ? "#1E4D8C" : i < step ? "#E5E7EB" : "#F3F4F6",
                    color: i === step ? "#FFFFFF" : i < step ? "#6B7280" : "#D1D5DB",
                  }}
                >
                  {i + 1}
                </span>
                {s}
              </button>
              {i < steps.length - 1 && (
                <span className="mx-2 text-xs" style={{ color: "#E5E7EB" }}>›</span>
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
            <StepAction rule={rule} allStages={allStages} setAction={setAction} />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "#F3F4F6" }}>
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 rounded-xl text-sm border font-medium"
            style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            {step === 0 ? "Cancelar" : "Voltar"}
          </button>
          {step < 2 ? (
            <button
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: canNext() ? "#1E4D8C" : "#E5E7EB",
                color: canNext() ? "#FFFFFF" : "#9CA3AF",
              }}
              onMouseEnter={e => { if (canNext()) e.currentTarget.style.background = "#163a6b"; }}
              onMouseLeave={e => { if (canNext()) e.currentTarget.style.background = "#1E4D8C"; }}
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!canNext()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: canNext() ? "#1E4D8C" : "#E5E7EB",
                color: canNext() ? "#FFFFFF" : "#9CA3AF",
              }}
              onMouseEnter={e => { if (canNext()) e.currentTarget.style.background = "#163a6b"; }}
              onMouseLeave={e => { if (canNext()) e.currentTarget.style.background = "#1E4D8C"; }}
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
        <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>
          Nome da automação <span style={{ color: "#EF4444" }}>*</span>
        </label>
        <input
          type="text"
          value={rule.name}
          onChange={e => setRule(r => ({ ...r, name: e.target.value }))}
          placeholder="Ex: Mover lead ganho para onboarding"
          className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none"
          style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
          onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
          onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Empresa</label>
        <select
          value={rule.companyId}
          onChange={e => setRule(r => ({ ...r, companyId: e.target.value }))}
          className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none"
          style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
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
        <label className="block text-xs font-semibold mb-2" style={{ color: NEUTRAL.graphite }}>
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
                  borderColor: active ? "#1E4D8C" : "#E5E7EB",
                  background: active ? "#EFF6FF" : "#FAFAFA",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#FAFAFA"; }}
              >
                <Icon size={14} style={{ color: active ? "#1E4D8C" : NEUTRAL.slate, marginTop: 1 }} />
                <div>
                  <div className="text-xs font-semibold" style={{ color: active ? "#1E4D8C" : NEUTRAL.graphite }}>
                    {type.label}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: NEUTRAL.slate }}>{type.desc}</div>
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
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>De (etapa)</label>
            <select
              value={t.fromStage || ""}
              onChange={e => setTrigger({ fromStage: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
            >
              <option value="">Qualquer etapa</option>
              {allStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Para (etapa)</label>
            <select
              value={t.toStage || ""}
              onChange={e => setTrigger({ toStage: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
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
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Campo</label>
            <select
              value={t.field || ""}
              onChange={e => setTrigger({ field: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
            >
              <option value="">Selecionar campo...</option>
              {LEAD_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Operador</label>
              <select
                value={t.operator || "eq"}
                onChange={e => setTrigger({ operator: e.target.value })}
                className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
                style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
              >
                {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Valor</label>
              <input
                type="text"
                value={t.value || ""}
                onChange={e => setTrigger({ value: e.target.value })}
                placeholder="Valor..."
                className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
                style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
                onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
                onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
              />
            </div>
          </div>
        </div>
      )}

      {t.type === "time_in_stage" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Etapa</label>
            <select
              value={t.stageId || ""}
              onChange={e => setTrigger({ stageId: e.target.value })}
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
            >
              <option value="">Qualquer etapa</option>
              {allStages.filter(s => !s.terminal).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Dias parado</label>
            <input
              type="number"
              min="1"
              value={t.days || ""}
              onChange={e => setTrigger({ days: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 7"
              className="w-full text-xs rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
              onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
              onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
            />
          </div>
        </div>
      )}

      {t.type === "lead_created" && (
        <div
          className="rounded-xl border px-4 py-3 text-xs"
          style={{ borderColor: "#BFDBFE", background: "#EFF6FF", color: "#1E40AF" }}
        >
          Este gatilho dispara sempre que um novo card é criado no pipeline.
        </div>
      )}
    </div>
  );
}

function StepAction({ rule, allStages, setAction }) {
  const a = rule.action;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-2" style={{ color: NEUTRAL.graphite }}>
          Tipo de ação
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ACTION_TYPES.map(type => {
            const Icon = type.icon;
            const active = a.type === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setAction({ type: type.id })}
                className="flex items-start gap-2.5 p-3 rounded-xl border text-left"
                style={{
                  borderColor: active ? "#1E4D8C" : "#E5E7EB",
                  background: active ? "#EFF6FF" : "#FAFAFA",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#FAFAFA"; }}
              >
                <Icon size={14} style={{ color: active ? "#1E4D8C" : NEUTRAL.slate, marginTop: 1 }} />
                <div>
                  <div className="text-xs font-semibold" style={{ color: active ? "#1E4D8C" : NEUTRAL.graphite }}>
                    {type.label}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: NEUTRAL.slate }}>{type.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action config */}
      {a.type === "move_stage" && (
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>
            Mover para
          </label>
          <select
            value={a.targetStage || ""}
            onChange={e => setAction({ targetStage: e.target.value })}
            className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none"
            style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
          >
            <option value="">Selecionar etapa...</option>
            {allStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {a.type === "set_field" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Campo</label>
            <select
              value={a.field || ""}
              onChange={e => setAction({ field: e.target.value })}
              className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
            >
              <option value="">Selecionar campo...</option>
              {LEAD_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Novo valor</label>
            <input
              type="text"
              value={a.fieldValue || ""}
              onChange={e => setAction({ fieldValue: e.target.value })}
              placeholder="Valor a definir..."
              className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
              onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
              onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
            />
          </div>
        </div>
      )}

      {a.type === "add_badge" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Texto do badge</label>
            <input
              type="text"
              value={a.badge || ""}
              onChange={e => setAction({ badge: e.target.value })}
              placeholder="Ex: Urgente, Hot lead, VIP..."
              className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
              onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
              onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: NEUTRAL.graphite }}>Cor do badge</label>
            <div className="flex gap-2 flex-wrap">
              {BADGE_COLORS.map(c => (
                <button
                  key={c.hex}
                  onClick={() => setAction({ badgeColor: c.hex })}
                  className="w-7 h-7 rounded-full border-2 transition-transform"
                  style={{
                    background: c.hex,
                    borderColor: a.badgeColor === c.hex ? NEUTRAL.graphite : "transparent",
                    transform: a.badgeColor === c.hex ? "scale(1.2)" : "scale(1)",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          {a.badge && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: NEUTRAL.slate }}>Preview:</span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: (a.badgeColor || "#6366F1") + "20", color: a.badgeColor || "#6366F1" }}
              >
                {a.badge}
              </span>
            </div>
          )}
        </div>
      )}

      {a.type === "notify" && (
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>Mensagem do alerta</label>
          <textarea
            value={a.message || ""}
            onChange={e => setAction({ message: e.target.value })}
            placeholder="Ex: Lead sem movimento há 7 dias — revisar estratégia"
            rows={3}
            className="w-full text-sm rounded-xl border px-3.5 py-2.5 outline-none resize-none"
            style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
            onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
            onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
          />
        </div>
      )}
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        style={{ background: "#F8F9FA" }}
      >
        <span className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>Como as automações funcionam?</span>
        {open ? <ChevronUp size={13} style={{ color: NEUTRAL.slate }} /> : <ChevronDown size={13} style={{ color: NEUTRAL.slate }} />}
      </button>
      {open && (
        <div className="px-4 py-3 text-xs space-y-2" style={{ color: NEUTRAL.slate, borderTop: "1px solid #F3F4F6" }}>
          <p>As automações são <strong>regras locais</strong>, avaliadas no browser sempre que um card é atualizado. Sem chamadas de API, sem IA — custo zero.</p>
          <p><strong>Gatilhos disponíveis:</strong> mudança de etapa, valor de campo, tempo parado em etapa, criação de card.</p>
          <p><strong>Ações disponíveis:</strong> mover o card para outra etapa, alterar um campo, adicionar badge visual, ou exibir alerta.</p>
          <p>As regras são avaliadas em sequência. Se múltiplas regras dispararem no mesmo evento, todas serão executadas na ordem de criação.</p>
          <p className="font-medium" style={{ color: "#1E40AF" }}>Para automações que dependem de tempo (ex: 7 dias sem mover), o avaliador roda ao abrir o CRM ou ao interagir com um card.</p>
        </div>
      )}
    </div>
  );
}

// ── Validation helpers ────────────────────────────────────────────────────────

function validateTrigger(t) {
  if (!t?.type) return false;
  if (t.type === "field_value") return Boolean(t.field && t.operator);
  if (t.type === "time_in_stage") return (t.days || 0) > 0;
  return true;
}

function validateAction(a) {
  if (!a?.type) return false;
  if (a.type === "move_stage") return Boolean(a.targetStage);
  if (a.type === "set_field")  return Boolean(a.field);
  if (a.type === "add_badge")  return Boolean(a.badge);
  if (a.type === "notify")     return Boolean(a.message?.trim());
  return false;
}

// ── Template gallery ─────────────────────────────────────────────────────────

function TemplateGallery({ onUseTemplate }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
        <div>
          <div className="flex items-center gap-1.5">
            <Zap size={14} style={{ color: "#1E4D8C" }} />
            <h3 className="text-sm font-bold" style={{ color: NEUTRAL.graphite }}>
              Templates prontos
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>
            Use como ponto de partida — depois você pode ajustar antes de salvar.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {AUTOMATION_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => onUseTemplate(t)}
            className="text-left rounded-lg border p-3 transition-all cursor-pointer"
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#1E4D8C";
              e.currentTarget.style.background = "#EFF6FF";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "#E5E7EB";
              e.currentTarget.style.background = "#FAFAFA";
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none mt-0.5">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold leading-snug" style={{ color: NEUTRAL.graphite }}>
                  {t.title}
                </div>
                <div className="text-[11px] mt-1 leading-snug" style={{ color: NEUTRAL.slate }}>
                  {t.summary}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[11px] font-semibold flex items-center gap-1" style={{ color: "#1E4D8C" }}>
              <Plus size={10} />
              Usar este template
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default AutomationsView;
