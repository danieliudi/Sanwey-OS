import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, ArrowRight,
  AlertCircle, Tag, MoveRight, Settings2, ChevronDown, ChevronUp, X, Info,
  Share2, Building2, GitBranch, CornerDownRight, ClipboardList,
  Bot, MoreVertical, Clock, ArrowUpRight,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { DEFAULT_PIPELINE_STAGES, defaultPipelines } from "../../constants/pipelines";
import { AUTOMATION_TEMPLATES } from "../../constants/automation-templates";
import { MARKETING_AUTOMATION_TEMPLATES, MARKETING_STAGES } from "../../constants/marketing-pipelines";
import { useAutomations } from "../../hooks/use-automations";
import { useAgentRunsSummary } from "../../hooks/use-agent-runs-summary";
import { relativeTime } from "../../utils/date";
import { EmptyState } from "../ui/EmptyState";
import { Tabs } from "../shared/Tabs";
import { Card, CardGrid } from "../shared/Card";
import { AgentBuilderWizard } from "../agents/AgentBuilderWizard";

const FILTER_AUTOMATION_STORAGE_KEY = "agentActionsFilterAutomationId";

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

// Campos de campanha (module="marketing") — antes o wizard usava LEAD_FIELDS
// pra qualquer módulo, então uma automação de Marketing só conseguia
// referenciar campos de lead que campanha nem tem (FitScore, Urgência).
const MARKETING_FIELDS = [
  { id: "budget",           label: "Orçamento (R$)" },
  { id: "kpi",              label: "KPI" },
  { id: "performanceScore", label: "Performance" },
  { id: "channel",          label: "Canal" },
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

export function AutomationsView({ leads, pipelines, activeCompany, currentUser, onNavigate }) {
  const { automations, addAutomation, updateAutomation, deleteAutomation, toggleAutomation, stats } = useAutomations({ userId: currentUser?.id });
  const agentRunsSummary = useAgentRunsSummary();
  const location = useLocation();
  const [showBuilder, setShowBuilder] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [moduleTab, setModuleTab] = useState("all");
  // "automations" | "agents" — chega direto em "agents" quando navegado a
  // partir do atalho "Criar agente de IA" de outra tela (ex.: Fornecedores RH).
  const [mainTab, setMainTab] = useState(location.state?.initialTab === "agents" ? "agents" : "automations");
  // Quando o usuário clica num template, pré-preenche o builder.
  const [builderInitial, setBuilderInitial] = useState(null);
  // Wizard do Agent Builder (AgentBuilderWizard) — totalmente separado do
  // AutomationBuilder técnico acima; `agentWizardRule` != null = modo edição.
  const [agentWizardOpen, setAgentWizardOpen] = useState(false);
  const [agentWizardRule, setAgentWizardRule] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const openBuilder = (initial = null) => {
    setBuilderInitial(initial);
    setShowBuilder(true);
  };
  const closeBuilder = () => {
    setShowBuilder(false);
    setBuilderInitial(null);
  };

  const openAgentWizard = (rule = null) => {
    setAgentWizardRule(rule);
    setAgentWizardOpen(true);
  };
  const closeAgentWizard = () => {
    setAgentWizardOpen(false);
    setAgentWizardRule(null);
  };

  const goToSuggestions = (automationId) => {
    try { sessionStorage.setItem(FILTER_AUTOMATION_STORAGE_KEY, automationId); } catch {}
    onNavigate?.("agents");
  };

  // Agentes de IA (thenActions[0].type === "suggest_with_ai") vivem numa aba
  // separada — o AutomationBuilder técnico acima nunca ramifica pra IA
  // (decisão do PRD, docs/prd-agent-builder.md seção 3).
  const commonAutomations = useMemo(
    () => automations.filter(rule => thenActionsOf(rule)[0]?.type !== "suggest_with_ai"),
    [automations]
  );
  const aiAgents = useMemo(
    () => automations.filter(rule => thenActionsOf(rule)[0]?.type === "suggest_with_ai"),
    [automations]
  );

  // Contagens da aba "automations" derivadas de commonAutomations, não do
  // `stats` cru do hook (que soma tudo, incluindo agentes) — senão "Todas (N)"
  // no filtro de módulo diverge do que a lista realmente mostra.
  const commonStats = useMemo(() => ({
    total: commonAutomations.length,
    enabled: commonAutomations.filter(a => a.enabled).length,
  }), [commonAutomations]);
  const agentStats = useMemo(() => ({
    total: aiAgents.length,
    enabled: aiAgents.filter(a => a.enabled && !a.pausedReason).length,
  }), [aiAgents]);

  // Etapas do CRM (funil de vendas, por empresa) — é o que o builder usa pra
  // uma automação module="crm"/"universal". Mantido separado de MARKETING_STAGES
  // porque o wizard (StepTrigger/StepActions) precisa mostrar só as etapas do
  // módulo escolhido em "Identificação", não uma lista misturada.
  const crmStages = useMemo(() => {
    const p = pipelines || defaultPipelines();
    const seen = new Map();
    for (const stages of Object.values(p)) {
      for (const s of stages) {
        if (!seen.has(s.id)) seen.set(s.id, s);
      }
    }
    return Array.from(seen.values());
  }, [pipelines]);

  // Lista combinada (CRM + Marketing) só pra resolver nome de etapa em
  // exibição de automações já salvas (AutomationRow/AutomationDetail), que
  // não sabem de antemão qual módulo cada regra pertence. Os ids de CRM e
  // Marketing não colidem, então o merge é seguro.
  const allStages = useMemo(() => {
    const seen = new Map(crmStages.map(s => [s.id, s]));
    for (const s of MARKETING_STAGES) {
      if (!seen.has(s.id)) seen.set(s.id, s);
    }
    return Array.from(seen.values());
  }, [crmStages]);

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
            {mainTab === "agents"
              ? <>Agentes de IA com aprovação humana — {agentStats.enabled} ativo{agentStats.enabled !== 1 ? "s" : ""} de {agentStats.total}</>
              : <>Regras automáticas sem IA, compartilhadas com a equipe — {commonStats.enabled} ativa{commonStats.enabled !== 1 ? "s" : ""} de {commonStats.total}</>
            }
          </p>
        </div>
        <button
          onClick={() => mainTab === "agents" ? openAgentWizard() : openBuilder()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
        >
          <Plus size={15} />
          {mainTab === "agents" ? "Novo agente de IA" : "Nova automação"}
        </button>
      </div>

      {/* Automações comuns vs. Agentes de IA — duas abas da mesma tela,
          mesmo motor por baixo (docs/prd-agent-builder.md seção 3). */}
      <Tabs
        tabs={[
          { id: "automations", label: "Automações", icon: Zap, count: commonAutomations.length },
          { id: "agents",      label: "Agentes de IA", icon: Bot, count: aiAgents.length },
        ]}
        active={mainTab}
        onChange={setMainTab}
      />

      {mainTab === "automations" && (
        <>
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
          {commonAutomations.length === 0 && (
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
          {commonAutomations.length <= 3 && (
            <TemplateGallery onUseTemplate={(t) => openBuilder(t.rule)} />
          )}

          {/* Module filter tabs */}
          {commonAutomations.length > 0 && (
            <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--border)", scrollbarWidth: "none" }}>
              {[
                { id: "all",       label: `Todas (${commonAutomations.length})` },
                { id: "crm",       label: `CRM (${stats.byModule?.crm || 0})` },
                { id: "marketing", label: `Marketing (${stats.byModule?.marketing || 0})` },
                { id: "universal", label: `Universal (${stats.byModule?.universal || 0})` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setModuleTab(t.id)}
                  className="px-3 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 whitespace-nowrap"
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
          {commonAutomations.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div className="divide-y" style={{ borderColor: "var(--surface-alt)" }}>
                {commonAutomations.filter(rule => moduleTab === "all" || (rule.module ?? "crm") === moduleTab).map(rule => (
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
        </>
      )}

      {mainTab === "agents" && (
        <AgentsPanel
          aiAgents={aiAgents}
          agentRunsSummary={agentRunsSummary}
          confirmDeleteId={confirmDeleteId}
          setConfirmDeleteId={setConfirmDeleteId}
          onCreate={() => openAgentWizard()}
          onEdit={(rule) => openAgentWizard(rule)}
          onToggle={(rule) => toggleAutomation(rule.id)}
          onDelete={(rule) => deleteAutomation(rule.id)}
          onGoToSuggestions={goToSuggestions}
        />
      )}

      {/* Builder modal (automações comuns) */}
      {showBuilder && (
        <AutomationBuilder
          crmStages={crmStages}
          initialRule={builderInitial}
          onSave={(rule) => { addAutomation(rule); closeBuilder(); }}
          onClose={closeBuilder}
        />
      )}

      {/* Assistente do Agent Builder (docs/prd-agent-builder.md seção 3) —
          ele mesmo chama useAutomations() e persiste, não recebe onSave. */}
      {agentWizardOpen && (
        <AgentBuilderWizard
          currentUser={currentUser}
          initialRule={agentWizardRule}
          onClose={closeAgentWizard}
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

// ── Agentes de IA (Agent Builder, docs/prd-agent-builder.md seção 3) ─────────
// "Meus agentes de IA": cartão por agente, com status/última execução/link
// pras sugestões geradas — só o piloto Fornecedores RH por enquanto, mas
// o registro abaixo é onde um 2º módulo (seção 6 do PRD) ganharia entrada.

const AGENT_MODULE_LABELS = {
  "rh-fornecedores": "Fornecedores (RH)",
};

function AgentStatusBadge({ rule }) {
  if (rule.pausedReason) {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold inline-block max-w-[170px] truncate align-bottom"
        style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
        title={rule.pausedReason}
      >
        {rule.pausedReason}
      </span>
    );
  }
  if (!rule.enabled) {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
      >
        Pausado manualmente
      </span>
    );
  }
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: "var(--success-bg)", color: "var(--success)" }}
    >
      Ativo
    </span>
  );
}

function AgentCardMenu({ rule, onEdit, onToggle, onDeleteRequest }) {
  const [open, setOpen] = useState(false);
  const itemSt = { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", fontSize: 12, textAlign: "left" };
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Ações do agente"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex", borderRadius: 6 }}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-pop)", minWidth: 160, zIndex: 20, overflow: "hidden" }}>
            <button onClick={() => { setOpen(false); onEdit(); }} style={{ ...itemSt, color: "var(--text)" }}>
              <Settings2 size={13} /> Editar
            </button>
            <button onClick={() => { setOpen(false); onToggle(); }} style={{ ...itemSt, color: "var(--text)" }}>
              {rule.enabled ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
              {rule.enabled ? "Pausar" : "Reativar"}
            </button>
            <button onClick={() => { setOpen(false); onDeleteRequest(); }} style={{ ...itemSt, color: "var(--danger)" }}>
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AgentCard({ rule, lastRunAt, confirmingDelete, onEdit, onToggle, onDeleteRequest, onDeleteConfirm, onDeleteCancel, onGoToSuggestions }) {
  const trigger = rule.trigger || {};
  const meta = trigger.type === "date_approaching"
    ? `Avisa ${trigger.days ?? "?"} dia(s) antes do vencimento`
    : null;

  return (
    <Card
      icon={<Bot size={18} />}
      iconBg="var(--accent-tint)"
      title={rule.name || "Sem nome"}
      meta={meta}
      badges={
        <>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
          >
            {AGENT_MODULE_LABELS[rule.module] || rule.module}
          </span>
          <AgentStatusBadge rule={rule} />
        </>
      }
      headerAction={
        confirmingDelete ? (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[11px]" style={{ color: "var(--text)" }}>Excluir?</span>
            <button
              onClick={onDeleteConfirm}
              style={{ background: "var(--danger)", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Excluir
            </button>
            <button
              onClick={onDeleteCancel}
              style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <AgentCardMenu rule={rule} onEdit={onEdit} onToggle={onToggle} onDeleteRequest={onDeleteRequest} />
        )
      }
      footer={
        <div className="flex flex-col gap-1.5 w-full">
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-dim)", fontWeight: 500 }}>
            <Clock size={11} />
            {lastRunAt ? `Última execução ${relativeTime(lastRunAt)}` : "Nunca executado"}
          </span>
          <button
            onClick={onGoToSuggestions}
            className="flex items-center gap-1 self-start"
            style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0 }}
          >
            Ver sugestões geradas
            <ArrowUpRight size={12} />
          </button>
        </div>
      }
    />
  );
}

function AgentsPanel({ aiAgents, agentRunsSummary, confirmDeleteId, setConfirmDeleteId, onCreate, onEdit, onToggle, onDelete, onGoToSuggestions }) {
  if (aiAgents.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="Nenhum agente de IA criado"
        description="Crie um agente guiado — toda sugestão gerada passa por aprovação humana antes de sair da plataforma."
        action={
          <button
            onClick={onCreate}
            className="mt-1 text-xs"
            style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Criar agente de IA
          </button>
        }
      />
    );
  }

  return (
    <CardGrid>
      {aiAgents.map(rule => (
        <AgentCard
          key={rule.id}
          rule={rule}
          lastRunAt={agentRunsSummary.get(rule.id)?.lastRunAt || null}
          confirmingDelete={confirmDeleteId === rule.id}
          onEdit={() => onEdit(rule)}
          onToggle={() => onToggle(rule)}
          onDeleteRequest={() => setConfirmDeleteId(rule.id)}
          onDeleteConfirm={() => { onDelete(rule); setConfirmDeleteId(null); }}
          onDeleteCancel={() => setConfirmDeleteId(null)}
          onGoToSuggestions={() => onGoToSuggestions(rule.id)}
        />
      ))}
    </CardGrid>
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

function AutomationBuilder({ crmStages, initialRule, onSave, onClose }) {
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
  useEscToClose(onClose);

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

  // Etapas do módulo escolhido em "Identificação" — antes disso o wizard
  // sempre usava as etapas do CRM (funil de vendas), mesmo pra module="marketing"
  // (bug real: escolher Marketing não trocava as opções de "De/Para etapa").
  const moduleStages = rule.module === "marketing" ? MARKETING_STAGES : crmStages;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)" }}
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
            <StepTrigger rule={rule} allStages={moduleStages} setTrigger={setTrigger} />
          )}
          {step === 2 && (
            <StepConditions rule={rule} setRule={setRule} />
          )}
          {step === 3 && (
            <StepActions rule={rule} allStages={moduleStages} setRule={setRule} hasConditions={hasConditions} />
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
  const fields = rule.module === "marketing" ? MARKETING_FIELDS : LEAD_FIELDS;

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
              {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
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
  const fields = rule.module === "marketing" ? MARKETING_FIELDS : LEAD_FIELDS;

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
                {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
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
  const fields = rule.module === "marketing" ? MARKETING_FIELDS : LEAD_FIELDS;

  return (
    <div className="space-y-5">
      <ActionListEditor
        title={hasConditions ? "Então (se a condição passar)" : "Ação"}
        actions={rule.thenActions}
        setActions={patchThen}
        allStages={allStages}
        fields={fields}
        allowEmpty={false}
      />

      {hasConditions && (
        <div className="pt-3" style={{ borderTop: "1px dashed var(--border)" }}>
          <ActionListEditor
            title="Senão (se a condição não passar)"
            actions={rule.elseActions || []}
            setActions={patchElse}
            allStages={allStages}
            fields={fields}
            allowEmpty
          />
        </div>
      )}
    </div>
  );
}

function ActionListEditor({ title, actions, setActions, allStages, fields, allowEmpty }) {
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

          <ActionConfig action={action} allStages={allStages} fields={fields} setAction={(patch) => patchAction(i, patch)} />
        </div>
      ))}
    </div>
  );
}

function ActionConfig({ action: a, allStages, fields, setAction }) {
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
            {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
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
