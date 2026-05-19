import React, { useCallback, useMemo, useRef, useState } from "react";
import { Plus, X, ChevronDown, TrendingUp } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { Select } from "../ui/Select";
import { LeadKanbanCard } from "../lead/LeadKanbanCard";
import { useUsersById } from "../../hooks/use-users-by-id";
import { formatK } from "../../utils/currency";

const TERMINAL = new Set(["ganho", "perdido"]);

// ── Quick-add form ────────────────────────────────────────────────────────────

function QuickAddForm({ stageId, companyId, currentUser, users, usersById, onAdd, onCancel }) {
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [ownerId, setOwnerId] = useState(currentUser?.id || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const ownerOptions = useMemo(() => {
    const visible = (users || []).filter(u => u.companies?.includes(companyId) || u.role !== "vendedor");
    return visible.map(u => ({ value: u.id, label: u.name }));
  }, [users, companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company.trim()) return;
    setSaving(true);
    try {
      const lead = {
        id: crypto.randomUUID(),
        company: company.trim(),
        companyId,
        stage: stageId,
        owner: ownerId || currentUser?.id || null,
        value: parseFloat(value) || 0,
        fitScore: 0,
        starred: false,
        notes: [],
        daysAgo: 0,
        dateDetected: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        stageChangedAt: new Date().toISOString(),
        probability: 10,
        decisionMaker: { name: "—", role: "—" },
      };
      await onAdd(lead);
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-2 mb-2 rounded-xl border p-2.5 space-y-2"
      style={{ background: "#FFFFFF", borderColor: "#E0E7FF" }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Nome da empresa *"
        value={company}
        onChange={e => setCompany(e.target.value)}
        className="w-full text-xs rounded-lg border px-2.5 py-1.5 outline-none"
        style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite }}
        onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
        onBlur={e => { e.target.style.borderColor = "#D1D5DB"; }}
      />
      <div className="flex gap-1.5">
        <input
          type="number"
          placeholder="Valor (R$)"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="flex-1 min-w-0 text-xs rounded-lg border px-2.5 py-1.5 outline-none"
          style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite }}
          onFocus={e => { e.target.style.borderColor = "#6366F1"; }}
          onBlur={e => { e.target.style.borderColor = "#D1D5DB"; }}
        />
        {ownerOptions.length > 1 && (
          <select
            value={ownerId}
            onChange={e => setOwnerId(e.target.value)}
            className="flex-1 min-w-0 text-xs rounded-lg border px-2 py-1.5 outline-none"
            style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
          >
            <option value="">Responsável</option>
            {ownerOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={saving || !company.trim()}
          className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-opacity"
          style={{ background: "#1E4D8C", color: "#FFFFFF", opacity: saving || !company.trim() ? 0.5 : 1 }}
          onMouseEnter={e => { if (!saving && company.trim()) e.currentTarget.style.background = "#163a6b"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#1E4D8C"; }}
        >
          {saving ? "Salvando…" : "Criar card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 text-xs rounded-lg border"
          style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFFFFF" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
        >
          <X size={12} />
        </button>
      </div>
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
        background: "#FFFFFF",
        borderColor: "#E8E8E8",
        padding: "12px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: NEUTRAL.slate,
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
          color: NEUTRAL.graphite,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: NEUTRAL.slate, marginTop: 3 }}>{sub}</div>
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
        style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
        onMouseEnter={e => { e.currentTarget.style.color = NEUTRAL.graphite; }}
        onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; }}
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
          style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}
        >
          <div className="text-xs font-semibold mb-4" style={{ color: NEUTRAL.slate }}>
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
                    style={{ color: NEUTRAL.graphite }}
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
                  <div className="text-xs" style={{ color: NEUTRAL.slate }}>
                    {count} · {formatK(total)}
                  </div>
                </div>

                {/* Count bar */}
                <div
                  style={{
                    height: 6,
                    background: "#F1F3F5",
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
                    background: "#F1F3F5",
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
                <div style={{ fontSize: 10, color: NEUTRAL.slate }}>
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

export function CRMView({ user, activeCompany, leads, pipelines, users, onLeadClick, onStageChange, onAddLead, visibleStages, pipelineTransitions }) {
  const isGroupView = activeCompany === "all";
  const isManager = user.role === "gerente";
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [blockedDrop, setBlockedDrop] = useState(null);
  const [addingInStage, setAddingInStage] = useState(null);

  const usersById = useUsersById(users);

  const companyForPipeline = isGroupView ? (user.companies[0] || "industria") : activeCompany;
  const allStages = pipelines[companyForPipeline] || DEFAULT_PIPELINE_STAGES;
  const stages = useMemo(() => (
    visibleStages && visibleStages.length > 0
      ? allStages.filter(s => visibleStages.includes(s.id))
      : allStages
  ), [allStages, visibleStages]);

  const companyData = isGroupView ? null : COMPANIES[activeCompany];
  const accent = companyData?.primary || NEUTRAL.graphite;

  const companyScopedLeads = useMemo(() => {
    let s = leads;
    if (!isGroupView) s = s.filter(l => l.companyId === activeCompany);
    if (!isManager) s = s.filter(l => l.owner === user.id);
    return s;
  }, [leads, activeCompany, user.id, isGroupView, isManager]);

  const scopedLeads = useMemo(() => {
    if (isManager && ownerFilter !== "all") {
      return companyScopedLeads.filter(l => l.owner === ownerFilter);
    }
    return companyScopedLeads;
  }, [companyScopedLeads, ownerFilter, isManager]);

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
    const ids = Array.from(new Set(companyScopedLeads.map(l => l.owner).filter(Boolean)));
    return [
      { value: "all", label: "Todos os vendedores" },
      ...ids.map(id => ({ value: id, label: usersById.get(id)?.name || id })),
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
      onStageChange(draggedLead.id, stageId);
    }
    setDraggedLead(null);
    setDragOverStage(null);
  }, [draggedLead, onStageChange, pipelineTransitions]);

  const handleDragStart  = useCallback((lead) => setDraggedLead(lead), []);
  const handleDragOver   = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave  = useCallback(() => { setDragOverStage(null); }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Pipeline
          </h1>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            {scopedLeads.length} oportunidades
            {summary.pipelineValue > 0 && ` · ${formatK(summary.pipelineValue)} em aberto`}
            {summary.won > 0 && ` · ${summary.won} ganho${summary.won !== 1 ? "s" : ""}`}
            {summary.lost > 0 && ` · ${summary.lost} perdido${summary.lost !== 1 ? "s" : ""}`}
          </p>
        </div>
        {isManager && (
          <Select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            options={ownerOptions}
            className="w-52"
          />
        )}
      </div>

      {/* ── KPI bar ── */}
      {scopedLeads.length > 0 && (
        <KpiBar scopedLeads={scopedLeads} />
      )}

      {/* ── Kanban ── */}
      <div className="overflow-x-auto -mx-4 px-4 md:-mx-6 md:px-6 pb-4" style={{ scrollbarWidth: "thin" }}>
        <div
          className="flex gap-3"
          style={{ minWidth: `${stages.length * 284}px` }}
        >
          {stages.map(stage => {
            const bucket = byStage[stage.id] || { leads: [], total: 0 };
            const isOver    = dragOverStage === stage.id;
            const isBlocked = blockedDrop === stage.id;
            const colCompanyId = isGroupView ? (user.companies?.[0] || "industria") : activeCompany;
            const canAccept = !draggedLead || !pipelineTransitions
              ? true
              : pipelineTransitions.isTransitionAllowed(colCompanyId, draggedLead?.stage, stage.id);

            return (
              <div
                key={stage.id}
                onDragOver={e => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(stage.id, colCompanyId)}
                className="flex flex-col rounded-xl border transition-all duration-150"
                style={{
                  width: 272,
                  minWidth: 272,
                  background: isBlocked ? "#FEF2F2" : isOver ? "#F8FAFF" : "#F9F9F8",
                  borderColor: isBlocked ? "#FECACA" : isOver && canAccept ? stage.color + "60" : isOver && !canAccept ? "#FECACA" : "#E8E8E8",
                  borderTopWidth: 3,
                  borderTopColor: stage.color,
                  boxShadow: isBlocked ? "0 0 0 2px #FCA5A520" : isOver && canAccept ? `0 0 0 2px ${stage.color}30` : "none",
                }}
              >
                {/* Column header */}
                <div className="px-3.5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
                      {stage.name}
                    </div>
                    {isBlocked ? (
                      <div className="text-xs mt-0.5 font-semibold" style={{ color: "#B91C1C" }}>
                        Transição bloqueada
                      </div>
                    ) : bucket.total > 0 && (
                      <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>
                        {formatK(bucket.total)}
                      </div>
                    )}
                  </div>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: stage.color + "18", color: stage.color }}
                  >
                    {bucket.leads.length}
                  </div>
                </div>

                {/* Cards */}
                <div
                  className="px-2 pt-0.5 pb-1 space-y-2 flex-1 overflow-y-auto"
                  style={{ maxHeight: "62vh", minHeight: 80 }}
                >
                  {bucket.leads.length === 0 ? (
                    <div
                      className="flex items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs"
                      style={{ borderColor: isOver ? stage.color + "40" : "#E8E8E8", color: NEUTRAL.slate }}
                    >
                      {isOver ? "Soltar aqui" : "Sem leads"}
                    </div>
                  ) : (
                    bucket.leads.map(lead => {
                      const ownerName = lead.owner
                        ? (usersById.get(lead.owner)?.name?.split(" ")[0] || "—")
                        : null;
                      return (
                        <LeadKanbanCard
                          key={lead.id}
                          lead={lead}
                          ownerName={ownerName}
                          showOwnerFooter={isGroupView || isManager}
                          isGroupView={isGroupView}
                          onClick={onLeadClick}
                          onDragStart={handleDragStart}
                        />
                      );
                    })
                  )}
                </div>

                {/* Column footer */}
                {addingInStage === stage.id && !stage.terminal ? (
                  <QuickAddForm
                    stageId={stage.id}
                    companyId={isGroupView ? (user.companies?.[0] || "industria") : activeCompany}
                    currentUser={user}
                    users={users}
                    usersById={usersById}
                    onAdd={onAddLead}
                    onCancel={() => setAddingInStage(null)}
                  />
                ) : !stage.terminal && onAddLead && (
                  <button
                    onClick={() => setAddingInStage(stage.id)}
                    className="mx-2 mb-2 w-[calc(100%-16px)] flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors duration-150"
                    style={{ borderColor: "#E8E8E8", color: NEUTRAL.slate, background: "transparent", borderStyle: "dashed" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#F0F4FF"; e.currentTarget.style.color = "#1E4D8C"; e.currentTarget.style.borderColor = "#C7D2FE"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; e.currentTarget.style.borderColor = "#E8E8E8"; }}
                  >
                    <Plus size={12} />
                    Novo card
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Analytics panel ── */}
      {scopedLeads.length > 0 && (
        <AnalyticsPanel scopedLeads={scopedLeads} stages={stages} />
      )}

      <p className="text-xs text-center" style={{ color: NEUTRAL.slate }}>
        Arraste para mover entre etapas · Clique no card para ver detalhes
      </p>
    </div>
  );
}

export default CRMView;
