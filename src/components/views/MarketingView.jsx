import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Megaphone, Star, ChevronDown, TrendingUp, Download, LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import {
  MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS, CHANNEL_COLORS,
} from "../../constants/marketing-pipelines";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { usePersonalEvents } from "../../hooks/use-personal-events";
import { CampaignKanbanCard } from "../campaign/CampaignKanbanCard";
import { CampaignDetailDrawer } from "../campaign/CampaignDetailDrawer";
import { CampaignCalendar } from "../campaign/CampaignCalendar";
import { useUsersById } from "../../hooks/use-users-by-id";
import { formatK } from "../../utils/currency";
import { Select } from "../ui/Select";

// ── Create modal ─────────────────────────────────────────────────────────────

function CampaignCreateModal({ stageId, currentUser, users, onAdd, onClose }) {
  const stage = MARKETING_STAGES.find(s => s.id === stageId);

  const [name, setName]             = useState("");
  const [channel, setChannel]       = useState("");
  const [kpi, setKpi]               = useState("");
  const [companyIds, setCompanyIds] = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [budget, setBudget]         = useState("");
  const [owner, setOwner]           = useState(currentUser?.id || "");
  const [launchDate, setLaunchDate] = useState("");
  const [endDate, setEndDate]       = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const toggleCompany = (id) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        name:           name.trim(),
        channel:        channel || null,
        kpi:            kpi || null,
        budget:         parseFloat(budget) || 0,
        companyIds,
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        owner:          owner || null,
        launchDate:     launchDate ? new Date(launchDate).toISOString() : null,
        endDate:        endDate ? new Date(endDate).toISOString() : null,
        agencyName:     agencyName.trim() || null,
        createdBy:      currentUser?.id || null,
        notes:          [],
        activities:     [],
        starred:        false,
        approvalChecklist: [],
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar campanha.");
    } finally {
      setSaving(false);
    }
  };

  const focusBlue = e => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = e => { e.target.style.borderColor = "var(--border-strong)"; };
  const labelSt   = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  const inputSt   = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>
              Nova campanha
            </div>
            {stage && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{stage.name}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex", alignItems: "center" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          {/* Nome */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Nome da campanha <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              autoFocus
              type="text"
              placeholder="Ex: Campanha de Verão 2026"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt}
              onFocus={focusBlue}
              onBlur={blurGray}
            />
          </div>

          {/* Empresa */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Empresa <span style={{ color: "var(--danger)" }}>*</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COMPANY_IDS.map(id => {
                const co = COMPANIES[id];
                const sel = companyIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCompany(id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 600,
                      border: `1px solid ${sel ? co.primary : "var(--border)"}`,
                      background: sel ? co.primary + "22" : "var(--surface)",
                      color: sel ? co.primary : "var(--text-dim)",
                      cursor: "pointer",
                      transition: "all 0.1s",
                    }}
                  >
                    {co.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canal + KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Canal</label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={{ ...inputSt, color: channel ? "var(--text)" : "var(--text-dim)" }}
              >
                <option value="">Selecionar</option>
                {MARKETING_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>KPI principal</label>
              <select
                value={kpi}
                onChange={e => setKpi(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={{ ...inputSt, color: kpi ? "var(--text)" : "var(--text-dim)" }}
              >
                <option value="">Selecionar</option>
                {MARKETING_KPIS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          {/* Budget + Responsável */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Budget (R$)</label>
              <input
                type="number"
                placeholder="0"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt}
                onFocus={focusBlue}
                onBlur={blurGray}
              />
            </div>
            <div>
              <label style={labelSt}>Responsável</label>
              <select
                value={owner}
                onChange={e => setOwner(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={{ ...inputSt, color: owner ? "var(--text)" : "var(--text-dim)" }}
              >
                <option value="">Selecionar</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Lançamento + Encerramento */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Data de lançamento</label>
              <input
                type="date"
                value={launchDate}
                onChange={e => setLaunchDate(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt}
                onFocus={focusBlue}
                onBlur={blurGray}
              />
            </div>
            <div>
              <label style={labelSt}>Encerramento</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt}
                onFocus={focusBlue}
                onBlur={blurGray}
              />
            </div>
          </div>

          {/* Agência */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelSt}>Agência (opcional)</label>
            <input
              type="text"
              placeholder="Nome da agência"
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt}
              onFocus={focusBlue}
              onBlur={blurGray}
            />
          </div>

          {error && (
            <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "#FFF", opacity: saving || !name.trim() ? 0.5 : 1, border: "none", cursor: saving || !name.trim() ? "default" : "pointer" }}
          >
            {saving ? "Criando…" : "Criar campanha"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, red }) {
  return (
    <div
      className="rounded-xl border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        padding: "12px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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
          color: red ? "var(--danger)" : "var(--text)",
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

function KpiBar({ campaigns }) {
  const active      = campaigns.filter(c => !["encerrado"].includes(c.stage)).length;
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const live        = campaigns.filter(c => c.stage === "ao_vivo").length;
  const urgent      = campaigns.filter(c => {
    if (!c.launchDate) return false;
    const d = Math.floor((new Date(c.launchDate).getTime() - Date.now()) / 86400000);
    return d <= 7 && d >= 0 && !["ao_vivo", "encerrado", "analise"].includes(c.stage);
  }).length;

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", marginBottom: 4 }}
    >
      <KpiCard label="Campanhas ativas" value={String(active)} />
      <KpiCard label="Budget total"     value={formatK(totalBudget)} />
      <KpiCard label="Ao Vivo"          value={String(live)} />
      <KpiCard label="URGENTE"          value={String(urgent)} red={urgent > 0} />
    </div>
  );
}

// ── Analytics panel (collapsible) ────────────────────────────────────────────

function AnalyticsPanel({ campaigns }) {
  const [open, setOpen] = useState(false);

  const stageStats = useMemo(() => {
    const nonTerminal = MARKETING_STAGES.filter(s => !s.terminal);
    return nonTerminal.map(stage => {
      const stageCampaigns = campaigns.filter(c => c.stage === stage.id);
      const count       = stageCampaigns.length;
      const totalBudget = stageCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
      const daysArr = stageCampaigns
        .filter(c => c.stageChangedAt)
        .map(c => Math.floor((Date.now() - new Date(c.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)));
      const avgDays = daysArr.length > 0
        ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length)
        : null;
      return { stage, count, totalBudget, avgDays };
    });
  }, [campaigns]);

  const maxCount  = Math.max(...stageStats.map(s => s.count), 1);
  const maxBudget = Math.max(...stageStats.map(s => s.totalBudget), 1);

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
        <span>Análise das campanhas</span>
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
            {stageStats.map(({ stage, count, totalBudget, avgDays }) => (
              <div key={stage.id}>
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
                    {count} · {formatK(totalBudget)}
                  </div>
                </div>

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
                      width: `${(totalBudget / maxBudget) * 100}%`,
                      background: stage.color,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

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

// ── View toggle button ────────────────────────────────────────────────────────

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

// ── Main view ─────────────────────────────────────────────────────────────────

export function MarketingView({ user, users = [], evaluateAutomations, pushNotification }) {
  const {
    campaigns,
    loading,
    canWrite,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    changeStage,
    toggleStar,
    updateChecklist,
  } = useMarketingCampaigns({ userId: user?.id, role: user?.role });

  const fireAutomations = useCallback((campaign, prev, eventType) => {
    if (!evaluateAutomations) return;
    const { patches: _p, notifications } = evaluateAutomations(campaign, prev, eventType, "marketing");
    notifications.forEach(n => {
      if (pushNotification) {
        pushNotification({
          type: "automation",
          title: `Automação: ${n.ruleName}`,
          body: n.message,
          campaignId: campaign.id,
        });
      }
    });
  }, [evaluateAutomations, pushNotification]);

  const {
    events:        personalEvents,
    createEvent:   createPersonalEvent,
    updateEvent:   updatePersonalEvent,
    deleteEvent:   deletePersonalEvent,
  } = usePersonalEvents({ userId: user?.id });

  const usersById = useUsersById(users);

  const isManager  = user?.role === "gerente_marketing" || user?.role === "admin";
  const isAgencia  = user?.role === "agencia";

  const [selected, setSelected]               = useState(null);
  const [draggedCampaign, setDraggedCampaign] = useState(null);
  const [dragOverStage, setDragOverStage]     = useState(null);
  const [quickAddStage, setQuickAddStage]     = useState(null);
  const [filterCompany, setFilterCompany]     = useState("all");
  const [filterChannel, setFilterChannel]     = useState("all");
  const [filterStarred, setFilterStarred]     = useState(false);
  const [ownerFilter, setOwnerFilter]         = useState("all");
  const [viewMode, setViewMode]               = useState("kanban");
  const [expandedMobileStages, setExpandedMobileStages] = useState(() => new Set(["briefing"]));
  const toggleMobileStage = (id) => setExpandedMobileStages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (filterCompany !== "all" && !(c.companyIds || []).includes(filterCompany)) return false;
      if (filterChannel !== "all" && c.channel !== filterChannel) return false;
      if (filterStarred && !c.starred) return false;
      if (isManager && ownerFilter !== "all" && c.owner !== ownerFilter) return false;
      return true;
    });
  }, [campaigns, filterCompany, filterChannel, filterStarred, ownerFilter, isManager]);

  const ownerOptions = useMemo(() => {
    const ids = Array.from(new Set(filteredCampaigns.map(c => c.owner).filter(Boolean)));
    return [
      { value: "all", label: "Todos os responsáveis" },
      ...ids.map(id => ({ value: id, label: usersById.get(id)?.name || id })),
    ];
  }, [filteredCampaigns, usersById]);

  const exportCampaignsCSV = useCallback(() => {
    const rows = [
      ["Nome", "Canal", "Budget", "KPI", "Etapa", "Empresas", "Lançamento"].join(","),
      ...filteredCampaigns.map(c => [
        `"${c.name}"`, c.channel || "", c.budget, c.kpi || "",
        c.stage, (c.companyIds || []).join(";"),
        c.launchDate ? c.launchDate.slice(0, 10) : "",
      ].join(","))
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "campanhas.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [filteredCampaigns]);

  const handleDragStart = useCallback((campaign) => setDraggedCampaign(campaign), []);
  const handleDragOver  = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleDragEnd   = useCallback(() => { setDraggedCampaign(null); setDragOverStage(null); }, []);

  const handleStageChange = useCallback(async (campaignId, toStage) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    const prev = campaign ? { ...campaign } : null;
    await changeStage(campaignId, toStage);
    if (campaign) {
      fireAutomations({ ...campaign, stage: toStage }, prev, "stage_change");
    }
  }, [campaigns, changeStage, fireAutomations]);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedCampaign || !canWrite) return;
    if (draggedCampaign.stage !== toStage) {
      await handleStageChange(draggedCampaign.id, toStage);
    }
    setDraggedCampaign(null);
    setDragOverStage(null);
  }, [draggedCampaign, canWrite, handleStageChange]);

  const handleUpdate = useCallback(async (id, patch) => {
    if (isAgencia && Object.keys(patch).length === 1 && "approvalChecklist" in patch) {
      await updateChecklist(id, patch.approvalChecklist);
      if (selected?.id === id) setSelected(prev => ({ ...prev, ...patch }));
      return;
    }
    if (!canWrite) return;
    const current = campaigns.find(c => c.id === id);
    await updateCampaign(id, patch);
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...patch }));
    if (current && patch.stage && patch.stage !== current.stage) {
      fireAutomations({ ...current, ...patch }, current, "stage_change");
    } else if (current && patch.budget !== undefined) {
      fireAutomations({ ...current, ...patch }, current, "field_value");
    }
  }, [canWrite, isAgencia, updateCampaign, updateChecklist, selected, campaigns, fireAutomations]);

  const handleDelete = useCallback(async (id) => {
    if (!canWrite) return;
    await deleteCampaign(id);
  }, [canWrite, deleteCampaign]);

  const handleQuickAdd = useCallback(async (campaign) => {
    const created = await createCampaign(campaign);
    if (created) {
      fireAutomations(created, null, "lead_created");
      fireAutomations(created, null, "field_value");
    }
  }, [createCampaign, fireAutomations]);

  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return campaigns.find(c => c.id === selected.id) || selected;
  }, [campaigns, selected]);

  return (
    <>
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Marketing
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Kanban de campanhas {isAgencia ? "· acesso de visitante" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCampaignsCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
            title="Exportar campanhas como CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
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
              active={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              icon={CalendarIcon}
              label="Calendário"
            />
          </div>
          {isManager && (
            <Select
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
              options={ownerOptions}
              className="w-full sm:w-48"
            />
          )}
        </div>
      </div>

      {/* KPI bar */}
      {viewMode === "kanban" && <KpiBar campaigns={filteredCampaigns} />}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <select
          value={filterCompany}
          onChange={e => setFilterCompany(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todas as empresas</option>
          {COMPANY_IDS.map(id => (
            <option key={id} value={id}>{COMPANIES[id]?.short}</option>
          ))}
        </select>
        <select
          value={filterChannel}
          onChange={e => setFilterChannel(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todos os canais</option>
          {MARKETING_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setFilterStarred(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-colors"
          style={{
            borderColor: filterStarred ? "#F59E0B" : "var(--border)",
            background:  filterStarred ? "var(--amber-bg)" : "var(--surface)",
            color:       filterStarred ? "var(--warning)" : "var(--text-dim)",
            cursor:      "pointer",
          }}
        >
          <Star size={11} fill={filterStarred ? "#F59E0B" : "none"} />
          Destaques
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>
          Carregando campanhas…
        </div>
      )}

      {/* Calendar view */}
      {!loading && viewMode === "calendar" && (
        <CampaignCalendar
          campaigns={filteredCampaigns}
          personalEvents={personalEvents}
          usersById={usersById}
          onSelectCampaign={setSelected}
          onCreatePersonalEvent={createPersonalEvent}
          onUpdatePersonalEvent={updatePersonalEvent}
          onDeletePersonalEvent={deletePersonalEvent}
          canWrite={canWrite || user?.role !== "agencia"}
          calendarToken={user?.calendarToken ?? null}
          supabaseUrl={import.meta.env.VITE_SUPABASE_URL ?? null}
        />
      )}

      {/* Kanban board */}
      {!loading && viewMode === "kanban" && (<>
        {/* Mobile kanban: vertical collapsible stages */}
        <div className="lg:hidden space-y-1.5 pb-24">
          {MARKETING_STAGES.map(stage => {
            const stageCampaigns = filteredCampaigns.filter(c => c.stage === stage.id);
            const expanded = expandedMobileStages.has(stage.id);
            const totalBudget = stageCampaigns.reduce((s, c) => s + (c.budget || 0), 0);
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
                    {totalBudget > 0 && <span className="text-xs font-semibold" style={{ color: stage.color + "99" }}>{formatK(totalBudget)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: stage.color }}>{stageCampaigns.length}</span>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${stage.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: stage.color, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                      <ChevronDown size={13} />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="p-2.5 space-y-2" style={{ background: "var(--surface)" }}>
                    {stageCampaigns.length === 0 ? (
                      <div className="text-center py-4 text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma campanha nesta etapa</div>
                    ) : (
                      stageCampaigns.map(c => (
                        <CampaignKanbanCard
                          key={c.id}
                          campaign={c}
                          ownerName={usersById.get(c.owner)?.name || null}
                          onClick={setSelected}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          stages={MARKETING_STAGES}
                          onMoveToStage={handleStageChange}
                        />
                      ))
                    )}
                    {canWrite && !stage.terminal && (
                      <button
                        onClick={() => setQuickAddStage(stage.id)}
                        className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                        style={{ background: stage.color + "18", color: stage.color, border: `1px dashed ${stage.color}44` }}
                      >
                        <Plus size={12} />
                        Nova campanha
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
          <div
            className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none z-10"
            style={{ background: "linear-gradient(to left, var(--bg) 0%, transparent 100%)" }}
          />
          <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
            <div
              className="flex gap-3"
              style={{ minWidth: `${MARKETING_STAGES.length * 284}px` }}
            >
              {MARKETING_STAGES.map(stage => {
                const stageCampaigns = filteredCampaigns.filter(c => c.stage === stage.id);
                const count       = stageCampaigns.length;
                const totalBudget = stageCampaigns.reduce((s, c) => s + (c.budget || 0), 0);
                const isOver      = dragOverStage === stage.id;

                return (
                  <div
                    key={stage.id}
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(stage.id)}
                    className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
                    style={{
                      width: 272,
                      minWidth: 272,
                      background: isOver ? "var(--surface-alt)" : "var(--surface-alt)",
                      borderColor: isOver ? stage.color + "70" : "var(--border)",
                      boxShadow: isOver ? `0 0 0 2px ${stage.color}30` : "0 1px 2px rgba(0,0,0,0.03)",
                      minHeight: 480,
                      flexShrink: 0,
                    }}
                  >
                    {/* 4px top color band */}
                    <div style={{ height: 4, background: stage.color, flexShrink: 0 }} />

                    {/* Column header */}
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
                          <span>{stage.name}</span>
                          <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>({count})</span>
                        </div>
                        <div className="text-xs mt-0.5 font-semibold" style={{ color: "var(--text-dim)" }}>
                          {totalBudget > 0 ? formatK(totalBudget) : "R$ 0"}
                          {stage.sla && <span style={{ fontWeight: 400, marginLeft: 6 }}>· SLA {stage.sla}d</span>}
                        </div>
                      </div>
                      {canWrite && !stage.terminal && (
                        <button
                          onClick={() => setQuickAddStage(quickAddStage === stage.id ? null : stage.id)}
                          className="flex items-center justify-center rounded-md transition-colors"
                          style={{ width: 28, height: 28, color: "var(--text-dim)", background: "transparent", border: "1px solid transparent", flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                          title="Adicionar campanha nesta etapa"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    {/* Cards */}
                    <div
                      className="px-2 pt-0.5 pb-1 space-y-2 flex-1 overflow-y-auto"
                      style={{ maxHeight: "62vh", minHeight: 80 }}
                    >
                      {stageCampaigns.length === 0 ? (
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
                              <span style={{ opacity: 0.5 }}>Nenhuma campanha nesta etapa</span>
                              {!stage.terminal && canWrite && (
                                <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        stageCampaigns.map(c => (
                          <CampaignKanbanCard
                            key={c.id}
                            campaign={c}
                            ownerName={usersById.get(c.owner)?.name || null}
                            onClick={setSelected}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            stages={MARKETING_STAGES}
                            onMoveToStage={handleStageChange}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>)}

      {/* Analytics panel */}
      {!loading && viewMode === "kanban" && filteredCampaigns.length > 0 && (
        <AnalyticsPanel campaigns={filteredCampaigns} />
      )}

      {!loading && viewMode === "kanban" && (
        <p className="text-xs text-center mt-3" style={{ color: "var(--text-dim)" }}>
          Arraste para mover · Use "+" no cabeçalho ou o botão flutuante para criar · Clique no card para ver detalhes
        </p>
      )}

      {/* Detail drawer */}
      {syncSelected && (
        <CampaignDetailDrawer
          campaign={syncSelected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          users={Array.from(usersById.values())}
          canWrite={canWrite}
          currentUser={user}
        />
      )}
    </div>

    {/* Create modal */}
    {quickAddStage && (
      <CampaignCreateModal
        stageId={quickAddStage}
        currentUser={user}
        users={users}
        onAdd={handleQuickAdd}
        onClose={() => setQuickAddStage(null)}
      />
    )}

    {/* FAB — create new campaign (kanban mode only) */}
    {viewMode === "kanban" && canWrite && (
      <button
        className="fixed z-30 flex items-center gap-2 font-semibold shadow-lg left-6 lg:left-[312px] bottom-20 lg:bottom-6"
        style={{
          height: 52,
          padding: "0 20px",
          background: "var(--accent)",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 26,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(30,77,140,0.35)",
        }}
        onClick={() => setQuickAddStage("briefing")}
        onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        aria-label="Criar nova campanha"
      >
        <Plus size={20} />
        Nova campanha
      </button>
    )}
    </>
  );
}
