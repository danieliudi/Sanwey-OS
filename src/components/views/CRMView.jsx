import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, ChevronDown, TrendingUp, Settings, LayoutGrid, Calendar as CalendarIcon, Download, Upload, Bot, Pencil, List, ArrowUpDown, ArrowUp, ArrowDown, Star, AlertCircle } from "lucide-react";
import { PipelineChatPanel } from "../ai/PipelineChatPanel";
import { exportLeadsCSV } from "../../utils/export-leads";
import { logExport } from "../../utils/log-export";
import { CurrencyInput } from "../ui/CurrencyInput";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { Select } from "../ui/Select";
import { LeadKanbanCard } from "../lead/LeadKanbanCard";
import { LeadCreateModal } from "../lead/LeadCreateModal";
import { LeadFormBuilder } from "../lead/LeadFormBuilder";
import { StageFieldEditorModal } from "../pipeline/StageFieldEditorModal";
import { PipelineStagesModal } from "../pipeline/PipelineStagesModal";
import { DynamicField, validateFields } from "../ui/DynamicField";
import { PipelineCalendarView } from "./PipelineCalendarView";
import { useUsersById } from "../../hooks/use-users-by-id";
import { useLeadFormConfig } from "../../hooks/use-lead-form-config";
import { useStageFields } from "../../hooks/use-stage-fields";
import { getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { formatK } from "../../utils/currency";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";

const TERMINAL = new Set(["ganho", "perdido"]);

// FASE 5: ids de todos os responsáveis de um lead — usa owner_ids quando
// disponível, com fallback pro owner escalar em leads legados que por
// algum motivo não tenham sido preenchidos pelo backfill da migração.
function getLeadOwnerIds(l) {
  return Array.isArray(l.ownerIds) && l.ownerIds.length ? l.ownerIds : (l.owner ? [l.owner] : []);
}

// ── Quick-add form ────────────────────────────────────────────────────────────

const SELECT_STYLE = {
  borderColor: "var(--border-strong)",
  color: "var(--text)",
  background: "var(--surface)",
  padding: "6px 22px 6px 8px",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 6px center",
  backgroundSize: "12px",
};

function QuickAddForm({ stageId, stage, companyId, currentUser, users, usersById, onAdd, onCancel, customFieldsDef = [] }) {
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [ownerIds, setOwnerIds] = useState(currentUser?.id ? [currentUser.id] : []);
  const [sector, setSector] = useState(currentUser?.sectors?.[0] || "");
  const [customValues, setCustomValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const updateCustom = useCallback((key, val) => {
    setCustomValues(prev => ({ ...prev, [key]: val }));
  }, []);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  // Opções pro AssigneeMultiSelect — objetos de usuário crus (id/name/
  // avatarBg/initials), mesmo escopo de sempre (empresa do card + papéis
  // que podem ser responsáveis).
  const ownerOptions = useMemo(() => {
    return (users || []).filter(u =>
      u.companies?.includes(companyId) &&
      (u.role === "vendedor" || u.role === "consultor" || u.role === "gerente" || u.role === "admin")
    );
  }, [users, companyId]);

  // crypto.randomUUID isn't available in every browser/context (older Safari,
  // non-secure contexts). Fall back to a Math.random-based v4-ish id so the
  // "Novo card" flow keeps working everywhere.
  const newId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "lead_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company.trim()) return;
    if (!sector) {
      setError("Selecione o setor.");
      return;
    }
    // Validar obrigatórios dos campos customizados antes do insert.
    const validationErrors = validateFields(customFieldsDef, customValues);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const closeDate = new Date(now.getTime() + 30 * 86400000);
      const primaryOwner = ownerIds[0] || currentUser?.id || null;
      const lead = {
        id: newId(),
        company: company.trim(),
        companyId,
        stage: stageId,
        status: stageId,
        owner: primaryOwner,
        ownerIds: ownerIds.length ? ownerIds : (primaryOwner ? [primaryOwner] : []),
        sector,
        value: parseFloat(value) || 0,
        fitScore: 0,
        starred: false,
        notes: [],
        daysAgo: 0,
        dateDetected: now.toISOString(),
        createdAt: now.toISOString(),
        lastActivity: now.toISOString(),
        stageChangedAt: now.toISOString(),
        closeDate: closeDate.toISOString(),
        probability: Number.isFinite(stage?.probability) ? stage.probability : 10,
        decisionMaker: { name: "—", role: "—" },
        customFields: customValues,
      };
      await onAdd(lead);
      onCancel();
    } catch (err) {
      setError(err?.message || "Não foi possível criar o card.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-2 mb-2 rounded-xl border p-2.5 space-y-2"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Nome da empresa *"
        value={company}
        onChange={e => setCompany(e.target.value)}
        className="w-full text-xs rounded-lg border px-2.5 py-1.5 outline-none"
        style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
        onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
        onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
      />
      <select
        value={sector}
        onChange={e => setSector(e.target.value)}
        className="w-full text-xs rounded-lg border outline-none"
        style={{
          ...SELECT_STYLE,
          borderColor: !sector ? "var(--accent)" : "var(--border-strong)",
          color: sector ? "var(--text)" : "var(--text-dim)",
        }}
        required
      >
        <option value="">Setor *</option>
        {CANONICAL_SECTORS.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <CurrencyInput
        value={value}
        onChange={setValue}
        className="w-full text-xs rounded-lg border px-2.5 py-1.5 outline-none"
        style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
        onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
        onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
      />
      {ownerOptions.length > 0 && (
        <AssigneeMultiSelect
          value={ownerIds}
          onChange={setOwnerIds}
          options={ownerOptions}
          placeholder="Responsável(is)"
        />
      )}
      {customFieldsDef.length > 0 && (
        <div className="space-y-2 pt-1 mt-1 border-t" style={{ borderColor: "var(--surface-alt)" }}>
          {customFieldsDef.map(f => (
            <DynamicField
              key={f.id}
              field={f}
              value={customValues[f.fieldKey]}
              onChange={(v) => updateCustom(f.fieldKey, v)}
              users={users}
            />
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={saving || !company.trim() || !sector}
          className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-opacity"
          style={{ background: "var(--accent)", color: "#FFFFFF", opacity: saving || !company.trim() || !sector ? 0.5 : 1 }}
          onMouseEnter={e => { if (!saving && company.trim() && sector) e.currentTarget.style.background = "var(--accent-hover)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
        >
          {saving ? "Salvando…" : "Criar card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 text-xs rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
        >
          <X size={12} />
        </button>
      </div>
      {error && (
        <div
          className="text-[11px] rounded-md px-2 py-1.5"
          style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}
        >
          {error}
        </div>
      )}
    </form>
  );
}

// ── KPI bar ───────────────────────────────────────────────────────────────────

function KpiBar({ scopedLeads }) {
  const m = useMemo(() => {
    let total = 0, totalValue = 0, weightedValue = 0, won = 0, lost = 0;
    for (const l of scopedLeads) {
      if (l.stage === "ganho")   { won++;  continue; }
      if (l.stage === "perdido") { lost++; continue; }
      total++;
      totalValue += l.value;
      // Handle both 0–1 and 0–100 probability formats
      const p = l.probability > 1 ? l.probability / 100 : l.probability;
      weightedValue += l.value * p;
    }
    const ticketMedio = total > 0 ? totalValue / total : 0;
    const convRate    = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null;
    return { total, totalValue, weightedValue, ticketMedio, convRate, won, lost };
  }, [scopedLeads]);

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", marginBottom: 4 }}
    >
      <KpiCard label="Oportunidades"  value={String(m.total)} />
      <KpiCard label="Valor total"    value={formatK(m.totalValue)} />
      <KpiCard label="Valor ponderado" value={formatK(m.weightedValue)} />
      <KpiCard label="Ticket médio"   value={m.total > 0 ? formatK(m.ticketMedio) : "—"} />
      <KpiCard
        label="Tx. conversão"
        value={m.convRate !== null ? `${m.convRate}%` : "—"}
        sub={m.convRate !== null ? `${m.won}G · ${m.lost}P` : "sem dados fechados"}
      />
    </div>
  );
}

function KpiCard({ label, value, sub }) {
  return (
    <div
      className="rounded-xl border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        padding: "12px 16px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Analytics panel (collapsible) ────────────────────────────────────────────

function AnalyticsPanel({ scopedLeads, stages }) {
  const [open, setOpen] = useState(false);

  const stageStats = useMemo(() => {
    const nonTerminal = stages.filter(s => !s.terminal);
    return nonTerminal.map(stage => {
      const stageLeads = scopedLeads.filter(l => l.stage === stage.id);
      const count = stageLeads.length;
      const total = stageLeads.reduce((sum, l) => sum + l.value, 0);
      const daysArr = stageLeads
        .filter(l => l.stageChangedAt)
        .map(l => Math.floor((Date.now() - new Date(l.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)));
      const avgDays = daysArr.length > 0
        ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length)
        : null;
      return { stage, count, total, avgDays };
    });
  }, [scopedLeads, stages]);

  const maxCount = Math.max(...stageStats.map(s => s.count), 1);
  const maxTotal = Math.max(...stageStats.map(s => s.total), 1);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
        style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
        onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
      >
        <TrendingUp size={13} strokeWidth={2} />
        <span>Análise do funil</span>
        <ChevronDown
          size={13}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {open && (
        <div
          className="rounded-2xl border mt-3 p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-xs font-semibold mb-4" style={{ color: "var(--text-dim)" }}>
            Distribuição por etapa
          </div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
          >
            {stageStats.map(({ stage, count, total, avgDays }) => (
              <div key={stage.id}>
                {/* Stage name + counts */}
                <div className="flex items-center justify-between mb-1.5">
                  <div
                    className="text-xs font-semibold flex items-center gap-1.5"
                    style={{ color: "var(--text)" }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: stage.color,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {stage.name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {count} · {formatK(total)}
                  </div>
                </div>

                {/* Count bar */}
                <div
                  style={{
                    height: 6,
                    background: "var(--surface-alt)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(count / maxCount) * 100}%`,
                      background: stage.color,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                {/* Value bar (lighter) */}
                <div
                  style={{
                    height: 3,
                    background: "var(--surface-alt)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 5,
                    opacity: 0.7,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(total / maxTotal) * 100}%`,
                      background: stage.color,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                {/* Avg days */}
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  {avgDays !== null
                    ? `Média ${avgDays}d nesta etapa`
                    : count > 0 ? "Sem tempo registrado" : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CRMView ───────────────────────────────────────────────────────────────────

export function CRMView({ user, activeCompany, accessibleCompanies, onCompanyChange, leads, pipelines, users, onLeadClick, onStageChange, onAddLead, visibleStages, pipelineTransitions, onViewExistingLead, clients, onCreateClient, autoOpenCreate, onAutoOpenHandled, onOpenImport, onReplacePipeline, onResetPipeline, onStarToggle }) {
  const isGroupView = activeCompany === "all";
  // roles[] cobre cargo adicional (ex: gerente como cargo secundário) —
  // user.role sozinho (cargo principal) fica só de fallback.
  const userRoleList = user.roles?.length ? user.roles : (user.role ? [user.role] : []);
  const isManager = userRoleList.includes("gerente") || userRoleList.includes("admin");
  const isConsultor = userRoleList.includes("consultor");

  // IDs of consultores supervised by this vendedor
  const subordinateIds = useMemo(() => {
    if (user.role !== "vendedor") return new Set();
    return new Set((users || []).filter(u => u.supervisorId === user.id).map(u => u.id));
  }, [users, user.id, user.role]);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "calendar"
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [blockedDrop, setBlockedDrop] = useState(null);
  const [stageError, setStageError] = useState(null);
  const [expandedMobileStages, setExpandedMobileStages] = useState(() => new Set(["prospeccao"]));
  const toggleMobileStage = (id) => setExpandedMobileStages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const usersById = useUsersById(users);
  const { formConfig, updateFormConfig } = useLeadFormConfig();
  const stageFields = useStageFields();
  const [createModalStage, setCreateModalStage] = useState(null); // { stageId, stage, companyId }
  const [showAIChat, setShowAIChat] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingStage, setEditingStage] = useState(null); // { stage, companyId }
  const [stageManagerOpen, setStageManagerOpen] = useState(false);

  // user.companies may still contain legacy ids ("comercial") that the DB
  // check constraint rejects — pick the first one that's actually valid.
  const firstValidCompany = (user.companies || []).find(c => COMPANY_IDS.includes(c)) || "industria";
  const companyForPipeline = isGroupView ? firstValidCompany : activeCompany;
  const allStages = pipelines[companyForPipeline] || DEFAULT_PIPELINE_STAGES;
  const stages = useMemo(() => (
    visibleStages && visibleStages.length > 0
      ? allStages.filter(s => visibleStages.includes(s.id))
      : allStages
  ), [allStages, visibleStages]);

  const companyData = isGroupView ? null : COMPANIES[activeCompany];
  const accent = companyData?.primary || "#37352F";

  useEffect(() => {
    if (!autoOpenCreate) return;
    const firstStage = stages.find(s => !s.terminal);
    if (firstStage) setCreateModalStage({ stageId: firstStage.id, stage: firstStage, companyId: isGroupView ? firstValidCompany : activeCompany });
    onAutoOpenHandled?.();
  }, [autoOpenCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  const companyScopedLeads = useMemo(() => {
    let s = leads;
    if (!isGroupView) s = s.filter(l => l.companyId === activeCompany);
    if (isConsultor) {
      // Consultor sees only their own leads (FASE 5: qualquer id em ownerIds, não só o owner escalar)
      s = s.filter(l => getLeadOwnerIds(l).includes(user.id));
    } else if (!isManager) {
      // Vendedor sees own leads + subordinates' leads
      s = s.filter(l => getLeadOwnerIds(l).some(id => id === user.id || subordinateIds.has(id)));
    }
    // Sector filter: if user has sectors, only show leads in those sectors (or without sector)
    if (user.sectors?.length && (user.role === "vendedor" || user.role === "consultor")) {
      s = s.filter(l => !l.sector || user.sectors.includes(l.sector));
    }
    return s;
  }, [leads, activeCompany, user.id, user.role, user.sectors, isGroupView, isManager, isConsultor, subordinateIds]);

  const scopedLeads = useMemo(() => {
    let s = companyScopedLeads;
    if (isManager && ownerFilter !== "all") {
      // FASE 5: filtro "mostrar leads do fulano" bate se fulano estiver em
      // QUALQUER posição de ownerIds, não só como owner (principal).
      s = s.filter(l => getLeadOwnerIds(l).includes(ownerFilter));
    }
    // Achado da 2ª auditoria: a estrela de favoritar existia na tabela mas
    // não filtrava nada — mesmo padrão "Só favoritos" já usado em
    // Entregas/Marketing.
    if (starredOnly) s = s.filter(l => l.starred);
    return s;
  }, [companyScopedLeads, ownerFilter, isManager, starredOnly]);

  const byStage = useMemo(() => {
    const bucket = Object.create(null);
    for (const s of stages) bucket[s.id] = { leads: [], total: 0 };
    for (const l of scopedLeads) {
      if (bucket[l.stage]) {
        bucket[l.stage].leads.push(l);
        bucket[l.stage].total += l.value;
      }
    }
    return bucket;
  }, [stages, scopedLeads]);

  const ownerOptions = useMemo(() => {
    const idSet = new Set();
    for (const l of companyScopedLeads) {
      for (const id of getLeadOwnerIds(l)) idSet.add(id);
    }
    return [
      { value: "all", label: "Todos os vendedores" },
      ...Array.from(idSet).map(id => ({ value: id, label: usersById.get(id)?.name || id })),
    ];
  }, [companyScopedLeads, usersById]);

  const summary = useMemo(() => {
    let pipelineValue = 0, won = 0, lost = 0;
    for (const l of scopedLeads) {
      if (l.stage === "ganho") won++;
      else if (l.stage === "perdido") lost++;
      else pipelineValue += l.value;
    }
    return { pipelineValue, won, lost };
  }, [scopedLeads]);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (estático ou condicional) vazio — vale tanto pro drag-and-drop quanto
  // pro "Mover para" do menu do card. Antes disso "required" era só o
  // asterisco visual, confirmado ao vivo que não travava nada (inclusive
  // corrompendo métricas do Painel Executivo com value/probability vazios).
  // Usa banner não-bloqueante em vez de alert() nativo — alert() trava
  // sessões automatizadas/headless sem handler de diálogo (achado da
  // auditoria de fricção de 18/07).
  const attemptStageChange = useCallback((leadId, targetStageId) => {
    const lead = scopedLeads.find(l => l.id === leadId) || leads.find(l => l.id === leadId);
    if (!lead) return;
    const fields = stageFields.getFields(lead.companyId, lead.stage);
    const missing = getMissingRequiredFields(fields, lead.customFields || {});
    if (missing.length > 0) {
      setStageError(`Não dá pra mover "${lead.company}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(fields, lead.customFields || {});
    if (invalid.length > 0) {
      setStageError(`Não dá pra mover "${lead.company}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setStageError(null);
    onStageChange(leadId, targetStageId);
  }, [scopedLeads, leads, stageFields, onStageChange]);

  // Badge "X/Y campos obrigatórios" no card (auditoria 10.3) — mesma fonte
  // de campos/valores do enforcement acima, só que sem bloquear nada.
  const getLeadCompleteness = useCallback((lead) => {
    const fields = stageFields.getFields(lead.companyId, lead.stage);
    return getFieldCompleteness(fields, lead.customFields || {});
  }, [stageFields]);

  const handleDrop = useCallback((stageId, companyId) => {
    if (draggedLead && draggedLead.stage !== stageId) {
      if (pipelineTransitions) {
        const allowed = pipelineTransitions.isTransitionAllowed(companyId, draggedLead.stage, stageId);
        if (!allowed) {
          setBlockedDrop(stageId);
          setTimeout(() => setBlockedDrop(null), 1500);
          setDraggedLead(null);
          setDragOverStage(null);
          return;
        }
      }
      attemptStageChange(draggedLead.id, stageId);
    }
    setDraggedLead(null);
    setDragOverStage(null);
  }, [draggedLead, attemptStageChange, pipelineTransitions]);

  const handleDragStart  = useCallback((lead) => setDraggedLead(lead), []);
  const handleDragOver   = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave  = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleDragEnd    = useCallback(() => { setDraggedLead(null); setDragOverStage(null); }, []);

  return (
    <>
    {stageError && (
      <div
        className="fixed z-50 flex items-start gap-2 p-3 rounded-xl text-sm shadow-lg"
        style={{ top: 16, right: 16, maxWidth: 380, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5" }}
      >
        <AlertCircle size={15} className="shrink-0 mt-0.5" />
        <span className="flex-1">{stageError}</span>
        <button onClick={() => setStageError(null)} className="shrink-0" style={{ color: "#B91C1C" }}>
          <X size={14} />
        </button>
      </div>
    )}
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Pipeline
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {scopedLeads.length} oportunidades
            {summary.pipelineValue > 0 && ` · ${formatK(summary.pipelineValue)} em aberto`}
            {summary.won > 0 && ` · ${summary.won} ganho${summary.won !== 1 ? "s" : ""}`}
            {summary.lost > 0 && ` · ${summary.lost} perdido${summary.lost !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Importar CSV */}
          {isManager && onOpenImport && (
            <button
              onClick={onOpenImport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
              title="Importar leads via CSV ou Excel"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Importar</span>
            </button>
          )}
          {/* Exportar CSV */}
          <button
            onClick={() => { exportLeadsCSV(scopedLeads, users, pipelines); logExport(user?.id, "leads_crm", scopedLeads.length); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text-dim)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--surface-alt)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.color = "var(--text-dim)";
            }}
            title="Exportar leads filtrados como CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          {/* Toggle Kanban / Calendário */}
          <div
            className="inline-flex rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            role="tablist"
          >
            <ViewToggleButton
              active={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
              icon={LayoutGrid}
              label="Kanban"
            />
            <ViewToggleButton
              active={viewMode === "table"}
              onClick={() => setViewMode("table")}
              icon={List}
              label="Tabela"
            />
            <ViewToggleButton
              active={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              icon={CalendarIcon}
              label="Calendário"
            />
          </div>
          <button
            onClick={() => setStarredOnly(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: `1px solid ${starredOnly ? "#F59E0B" : "var(--border)"}`, background: starredOnly ? "#FFFBEB" : "var(--surface)", color: starredOnly ? "var(--warning)" : "var(--text-dim)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >
            <Star size={11} fill={starredOnly ? "#F59E0B" : "none"} />
            Só favoritos
          </button>
          {isManager && !isGroupView && (
            <button
              onClick={() => setStageManagerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
            >
              <Pencil size={13} />
              Editar etapas
            </button>
          )}
          {isManager && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Select
                value={ownerFilter}
                onChange={e => setOwnerFilter(e.target.value)}
                options={ownerOptions}
                className="flex-1 min-w-0 sm:w-44"
                size="sm"
              />
              {accessibleCompanies && accessibleCompanies.filter(id => id !== "all").length > 1 && (
                <Select
                  value={activeCompany}
                  onChange={e => onCompanyChange(e.target.value)}
                  options={[
                    { value: "all", label: "Todas as empresas" },
                    ...accessibleCompanies.filter(id => id !== "all").map(id => ({
                      value: id,
                      label: COMPANIES[id]?.short || id,
                    })),
                  ]}
                  className="flex-1 min-w-0 sm:w-44"
                  size="sm"
                />
              )}
            </div>
          )}
          {viewMode === "kanban" && onAddLead && stages.filter(s => !s.terminal).length > 0 && (
            <button
              onClick={() => {
                const firstStage = stages.find(s => !s.terminal);
                if (firstStage) setCreateModalStage({ stageId: firstStage.id, stage: firstStage, companyId: isGroupView ? firstValidCompany : activeCompany });
              }}
              className="flex items-center gap-1.5 font-semibold"
              style={{
                background: "var(--accent)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 10,
                padding: "6px 16px",
                fontSize: 13,
                cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
              aria-label="Criar novo card"
            >
              <Plus size={14} />
              Novo card
            </button>
          )}
        </div>
      </div>

      {viewMode === "calendar" ? (
        <PipelineCalendarView
          leads={leads}
          user={user}
          activeCompany={activeCompany}
          onLeadClick={onLeadClick}
        />
      ) : viewMode === "table" ? (
        <LeadTableView
          leads={scopedLeads}
          stages={allStages}
          users={usersById}
          onLeadClick={onLeadClick}
          onStarToggle={onStarToggle}
          isGroupView={isGroupView}
        />
      ) : (<>
      {/* Mobile kanban: vertical collapsible stages */}
      <div className="lg:hidden space-y-1.5 pb-24">
        {stages.map(stage => {
          const bucket = byStage[stage.id] || { leads: [], total: 0 };
          const expanded = expandedMobileStages.has(stage.id);
          return (
            <div key={stage.id} className="rounded-xl overflow-hidden border" style={{ borderColor: stage.color + "28" }}>
              <button
                className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer"
                style={{ background: stage.color + "12", border: "none" }}
                onClick={() => toggleMobileStage(stage.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                  <span className="font-bold text-sm" style={{ color: stage.color }}>{stage.name}</span>
                  {bucket.total > 0 && <span className="text-xs font-semibold" style={{ color: stage.color + "99" }}>{formatK(bucket.total)}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: stage.color }}>{bucket.leads.length}</span>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${stage.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: stage.color, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                    <ChevronDown size={13} />
                  </div>
                </div>
              </button>
              {expanded && (
                <div className="p-2.5 space-y-2" style={{ background: "var(--surface-alt)" }}>
                  {bucket.leads.length === 0 ? (
                    <div className="text-center py-4 text-xs" style={{ color: "var(--text-dim)" }}>Nenhum negócio nesta etapa</div>
                  ) : (
                    bucket.leads.map(lead => (
                      <LeadKanbanCard
                        key={lead.id}
                        lead={lead}
                        users={users}
                        showOwnerFooter={isGroupView || isManager}
                        isGroupView={isGroupView}
                        onClick={onLeadClick}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        stages={stages}
                        onMoveToStage={attemptStageChange}
                        completeness={getLeadCompleteness(lead)}
                      />
                    ))
                  )}
                  {onAddLead && !stage.terminal && (
                    <button
                      onClick={() => setCreateModalStage({ stageId: stage.id, stage, companyId: isGroupView ? firstValidCompany : activeCompany })}
                      className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ background: stage.color + "18", color: stage.color, border: `1px dashed ${stage.color}44` }}
                    >
                      <Plus size={12} />
                      Nova oportunidade
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop kanban: horizontal scroll */}
      <div className="hidden lg:block relative">
        {/* Fade gradient indicating more stages exist to the right */}
        <div
          className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none z-10"
          style={{
            background: "linear-gradient(to left, #DEDAD6 0%, transparent 100%)",
          }}
        />
      <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
        <div
          className="flex gap-3"
          style={{ minWidth: `${stages.length * 284}px` }}
        >
          {stages.map(stage => {
            const bucket = byStage[stage.id] || { leads: [], total: 0 };
            const isOver    = dragOverStage === stage.id;
            const isBlocked = blockedDrop === stage.id;
            const colCompanyId = isGroupView ? firstValidCompany : activeCompany;
            const canAccept = !draggedLead || !pipelineTransitions
              ? true
              : pipelineTransitions.isTransitionAllowed(colCompanyId, draggedLead?.stage, stage.id);

            return (
              <div
                key={stage.id}
                onDragOver={e => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(stage.id, colCompanyId)}
                className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
                style={{
                  width: 272,
                  minWidth: 272,
                  background: isBlocked ? "#FEF2F2" : isOver && canAccept ? "var(--surface-alt)" : "var(--surface-alt)",
                  borderColor: isBlocked ? "#FECACA" : isOver && canAccept ? stage.color + "70" : isOver && !canAccept ? "#FECACA" : "var(--border)",
                  boxShadow: isBlocked ? "0 0 0 2px #FCA5A520" : isOver && canAccept ? `0 0 0 2px ${stage.color}30` : "var(--shadow-card)",
                }}
              >
                {/* Column header — top color band like HubSpot (mais grosso pra
                    dar mais peso visual à identidade de cor da etapa) */}
                <div
                  style={{
                    height: 8,
                    background: stage.color,
                    flexShrink: 0,
                  }}
                />
                <div
                  className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2"
                  style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-semibold flex items-center gap-1.5"
                      style={{
                        color: "var(--text)",
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      <span
                        title={stage.name}
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}
                      >
                        {stage.name}
                      </span>
                      <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0 }}>
                        ({bucket.leads.length})
                      </span>
                    </div>
                    {isBlocked ? (
                      <div className="text-xs mt-1 font-semibold" style={{ color: "#B91C1C" }}>
                        Transição bloqueada
                      </div>
                    ) : (
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)", fontWeight: 600 }}>
                        {bucket.total > 0 ? formatK(bucket.total) : "R$ 0"}
                      </div>
                    )}
                  </div>
                  {isManager && !stage.terminal && (
                    <button
                      onClick={() => setEditingStage({ stage, companyId: colCompanyId })}
                      className="flex items-center justify-center rounded-md cursor-pointer transition-colors"
                      style={{ width: 24, height: 24, flexShrink: 0, color: "var(--text-dim)", background: "transparent", border: "1px solid transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                      title="Editar campos desta etapa"
                    >
                      <Settings size={13} />
                    </button>
                  )}
                </div>

                {/* Cards */}
                <div
                  className="px-2 pt-2 pb-1 flex-1 overflow-y-auto"
                  style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "62vh", minHeight: 80 }}
                >
                  {bucket.leads.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs gap-1"
                      style={{ borderColor: isOver ? stage.color + "40" : "var(--border)", color: "var(--text-dim)" }}
                    >
                      {isOver ? (
                        <>
                          <Plus size={16} style={{ opacity: 0.5 }} />
                          <span>Soltar aqui</span>
                        </>
                      ) : (
                        <>
                          <span style={{ opacity: 0.5 }}>Nenhum negócio nesta etapa</span>
                          {!stage.terminal && <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>}
                        </>
                      )}
                    </div>
                  ) : (
                    bucket.leads.map(lead => (
                      <LeadKanbanCard
                        key={lead.id}
                        lead={lead}
                        users={users}
                        showOwnerFooter={isGroupView || isManager}
                        isGroupView={isGroupView}
                        onClick={onLeadClick}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        stages={stages}
                        onMoveToStage={attemptStageChange}
                        completeness={getLeadCompleteness(lead)}
                      />
                    ))
                  )}
                  {onAddLead && !stage.terminal && (
                    <button
                      onClick={() => setCreateModalStage({ stageId: stage.id, stage, companyId: isGroupView ? firstValidCompany : activeCompany })}
                      className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ background: stage.color + "18", color: stage.color, border: `1px dashed ${stage.color}44` }}
                    >
                      <Plus size={12} />
                      Nova oportunidade
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      </>)}

      {/* ── Analytics panel (apenas no kanban) ── */}
      {viewMode === "kanban" && scopedLeads.length > 0 && (
        <AnalyticsPanel scopedLeads={scopedLeads} stages={stages} />
      )}

      {viewMode === "kanban" && (
        <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
          Arraste para mover entre etapas · Clique no card para ver detalhes
        </p>
      )}

      {viewMode === "table" && (
        <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
          Clique numa linha para ver detalhes · Clique no cabeçalho para ordenar
        </p>
      )}

      {/* Lead create modal */}
      <LeadCreateModal
        open={Boolean(createModalStage)}
        onClose={() => setCreateModalStage(null)}
        stageId={createModalStage?.stageId}
        stage={createModalStage?.stage}
        companyId={createModalStage?.companyId}
        currentUser={user}
        users={users}
        onAdd={onAddLead}
        isManager={isManager}
        formConfig={formConfig}
        onUpdateFormConfig={updateFormConfig}
        existingLeads={leads}
        onViewExisting={(lead) => {
          if (onLeadClick) onLeadClick(lead);
          setCreateModalStage(null);
        }}
        clients={clients}
        createClient={onCreateClient}
      />

      {/* Form builder — acessível pelo modal de criação */}
      {showFormBuilder && (
        <LeadFormBuilder
          formConfig={formConfig}
          onSave={updateFormConfig}
          onClose={() => setShowFormBuilder(false)}
        />
      )}

      {/* Stage field editor */}
      <StageFieldEditorModal
        open={Boolean(editingStage)}
        onClose={() => setEditingStage(null)}
        stage={editingStage?.stage}
        companyId={editingStage?.companyId}
        stageFields={stageFields}
      />

      {/* Editor de etapas + matriz de transições (ex-PipelineBuilderView) */}
      <PipelineStagesModal
        open={stageManagerOpen}
        onClose={() => setStageManagerOpen(false)}
        companyId={companyForPipeline}
        stages={allStages}
        transitions={pipelineTransitions}
        leads={leads}
        onReplacePipeline={onReplacePipeline}
        onResetPipeline={onResetPipeline}
      />
    </div>

    {/* Floating AI button */}
    <button
      onClick={() => setShowAIChat(v => !v)}
      className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 hidden lg:flex items-center gap-2 px-4 py-3 rounded-full font-semibold text-sm transition-all active:scale-95"
      style={{ background: "var(--accent)", color: "#FFFFFF", boxShadow: "0 4px 16px rgba(181,0,11,0.30)", border: "none", cursor: "pointer" }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
    >
      <Bot size={16} />
      Perguntar à IA
    </button>

    <PipelineChatPanel
      leads={scopedLeads}
      users={users}
      currentUser={user}
      isOpen={showAIChat}
      onClose={() => setShowAIChat(false)}
    />

    </>
  );
}

// ── Lead Table View ───────────────────────────────────────────────────────────

const TABLE_COLS = [
  { id: "starred",   label: "",             width: 36,  sortable: false },
  { id: "company",   label: "Empresa",      width: null, sortable: true },
  { id: "stage",     label: "Etapa",        width: 140,  sortable: true },
  { id: "value",     label: "Valor",        width: 110,  sortable: true },
  { id: "fitScore",  label: "Fit",          width: 70,   sortable: true },
  { id: "sector",    label: "Setor",        width: 140,  sortable: true },
  { id: "owner",     label: "Responsável",  width: 140,  sortable: true },
  { id: "stageChangedAt", label: "Última mov.", width: 120, sortable: true },
];

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={11} style={{ color: "var(--border-strong)", flexShrink: 0 }} />;
  return sortDir === "asc"
    ? <ArrowUp size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
    : <ArrowDown size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />;
}

function LeadTableView({ leads, stages, users, onLeadClick, onStarToggle, isGroupView }) {
  const [sortCol, setSortCol] = useState("stageChangedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [hoveredRow, setHoveredRow] = useState(null);

  const stageMap = useMemo(() => {
    const m = {};
    (stages || []).forEach(s => { m[s.id] = s; });
    return m;
  }, [stages]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    const arr = [...leads];
    arr.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case "company":   va = a.company?.toLowerCase() || ""; vb = b.company?.toLowerCase() || ""; break;
        case "stage":     va = stageMap[a.stage]?.name || a.stage || ""; vb = stageMap[b.stage]?.name || b.stage || ""; break;
        case "value":     va = a.value || 0; vb = b.value || 0; break;
        case "fitScore":  va = a.fitScore || 0; vb = b.fitScore || 0; break;
        case "sector":    va = a.sector?.toLowerCase() || ""; vb = b.sector?.toLowerCase() || ""; break;
        case "owner": {
          // `users` é um Map (useUsersById) — ordena pelo primeiro responsável
          // (FASE 5: owner_ids pode ter mais de um, mantém critério simples).
          const aId = getLeadOwnerIds(a)[0];
          const bId = getLeadOwnerIds(b)[0];
          va = users?.get?.(aId)?.name?.toLowerCase() || "";
          vb = users?.get?.(bId)?.name?.toLowerCase() || "";
          break;
        }
        case "stageChangedAt": va = a.stageChangedAt || a.createdAt || ""; vb = b.stageChangedAt || b.createdAt || ""; break;
        default:          va = ""; vb = "";
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [leads, sortCol, sortDir, stageMap, users]);

  const fmt = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--text-dim)" }}>
        <List size={40} strokeWidth={1} />
        <span className="text-sm">Nenhum lead encontrado</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {TABLE_COLS.map(col => (
              <th
                key={col.id}
                style={{
                  width: col.width || undefined,
                  padding: col.id === "starred" ? "10px 8px 10px 12px" : "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "var(--text-dim)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: col.sortable ? "pointer" : "default",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
                onClick={col.sortable ? () => handleSort(col.id) : undefined}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {col.label}
                  {col.sortable && <SortIcon col={col.id} sortCol={sortCol} sortDir={sortDir} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead, idx) => {
            const stage = stageMap[lead.stage];
            // FASE 5: resolve todos os responsáveis (owner_ids, com fallback
            // pro owner escalar) contra o Map de usuários pro AvatarStack.
            const resolvedOwners = getLeadOwnerIds(lead).map(id => users?.get?.(id)).filter(Boolean);
            const isHovered = hoveredRow === lead.id;
            const companyInfo = isGroupView ? COMPANIES[lead.companyId] : null;
            return (
              <tr
                key={lead.id}
                onClick={() => onLeadClick?.(lead)}
                onMouseEnter={() => setHoveredRow(lead.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  borderBottom: idx < sorted.length - 1 ? "1px solid var(--surface-alt)" : "none",
                  background: isHovered ? "var(--surface-alt)" : "transparent",
                  cursor: "pointer",
                  transition: "background 100ms",
                }}
              >
                {/* Star — clicável (achado da 2ª auditoria: célula era só leitura) */}
                <td style={{ padding: "10px 4px 10px 12px", width: 36 }}>
                  {onStarToggle ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStarToggle(lead.id); }}
                      style={{ display: "flex", background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                      title={lead.starred ? "Remover dos favoritos" : "Marcar como favorito"}
                    >
                      <Star size={13} fill={lead.starred ? "#F59E0B" : "none"} color={lead.starred ? "#F59E0B" : "var(--text-dim)"} />
                    </button>
                  ) : (
                    lead.starred && <Star size={13} fill="#F59E0B" color="#F59E0B" />
                  )}
                </td>
                {/* Company */}
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {companyInfo && (
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                          background: companyInfo.primary, color: "#FFF",
                          fontSize: 9, fontWeight: 800,
                        }}
                      >
                        {companyInfo.short?.[0] || "?"}
                      </span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                        {lead.company}
                      </div>
                      {lead.sector && (
                        <div style={{ fontSize: 11, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lead.sector}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {/* Stage */}
                <td style={{ padding: "10px 12px" }}>
                  {stage ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                      <span style={{ color: stage.color, fontWeight: 600, fontSize: 12 }}>{stage.name}</span>
                    </span>
                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                {/* Value */}
                <td style={{ padding: "10px 12px", fontWeight: 600, color: lead.value > 0 ? "#15803D" : "var(--text-dim)" }}>
                  {lead.value > 0 ? `R$ ${formatK(lead.value)}` : "—"}
                </td>
                {/* Fit Score */}
                <td style={{ padding: "10px 12px" }}>
                  {lead.fitScore > 0 ? (
                    <span style={{
                      display: "inline-block",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: lead.fitScore >= 80 ? "#DCFCE7" : lead.fitScore >= 50 ? "#FEF3C7" : "#FEE2E2",
                      color: lead.fitScore >= 80 ? "#15803D" : lead.fitScore >= 50 ? "#B45309" : "#B91C1C",
                    }}>
                      {lead.fitScore}
                    </span>
                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                {/* Sector */}
                <td style={{ padding: "10px 12px", color: "var(--text-dim)", maxWidth: 140 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                    {lead.sector || "—"}
                  </span>
                </td>
                {/* Owner(s) */}
                <td style={{ padding: "10px 12px" }}>
                  {resolvedOwners.length > 0 ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <AvatarStack users={resolvedOwners} size={24} max={3} />
                      <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                        {resolvedOwners[0].name}
                      </span>
                    </span>
                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                {/* Last move */}
                <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 12 }}>
                  {fmt(lead.stageChangedAt || lead.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ViewToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
      style={{
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "#FFFFFF" : "var(--text-dim)",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

export default CRMView;
