import React, { useCallback, useMemo, useState } from "react";
import { Plus, X, Megaphone, Star, ChevronDown, TrendingUp, Download, LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import {
  MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS, CHANNEL_COLORS,
} from "../../constants/marketing-pipelines";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { CampaignKanbanCard } from "../campaign/CampaignKanbanCard";
import { CampaignDetailDrawer } from "../campaign/CampaignDetailDrawer";
import { useUsersById } from "../../hooks/use-users-by-id";
import { formatK } from "../../utils/currency";
import { Select } from "../ui/Select";

// ── Quick-create form ────────────────────────────────────────────────────────

function CampaignCreateForm({ stageId, currentUser, users, onAdd, onCancel }) {
  const [name, setName]         = useState("");
  const [channel, setChannel]   = useState("");
  const [companyIds, setCompanyIds] = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [budget, setBudget]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const toggleCompany = (id) => {
    setCompanyIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        id:          crypto.randomUUID?.() || `mkt_${Date.now()}`,
        name:        name.trim(),
        channel:     channel || null,
        budget:      parseFloat(budget) || 0,
        companyIds,
        stage:       stageId,
        stageChangedAt: new Date().toISOString(),
        createdBy:   currentUser?.id || null,
        notes:       [],
        activities:  [],
        starred:     false,
        approvalChecklist: [],
      });
      onCancel();
    } catch (err) {
      setError(err?.message || "Erro ao criar campanha.");
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
        autoFocus
        type="text"
        placeholder="Nome da campanha *"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full text-xs rounded-xl border px-2.5 py-1.5 outline-none"
        style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite }}
        onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
        onBlur={e => { e.target.style.borderColor = "#D1D5DB"; }}
      />

      <div className="flex flex-wrap gap-1.5">
        {COMPANY_IDS.map(id => {
          const co = COMPANIES[id];
          const sel = companyIds.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleCompany(id)}
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors"
              style={{
                borderColor: sel ? co.primary : "#E5E7EB",
                background:  sel ? co.primary + "22" : "#FFF",
                color:       sel ? co.primary : NEUTRAL.slate,
                cursor:      "pointer",
              }}
            >
              {co.short}
            </button>
          );
        })}
      </div>

      <div className="flex gap-1.5">
        <select
          value={channel}
          onChange={e => setChannel(e.target.value)}
          className="flex-1 text-xs rounded-xl border outline-none px-2 py-1.5"
          style={{ borderColor: "#D1D5DB", color: channel ? NEUTRAL.graphite : NEUTRAL.slate }}
        >
          <option value="">Canal</option>
          {MARKETING_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="number"
          placeholder="Budget R$"
          value={budget}
          onChange={e => setBudget(e.target.value)}
          className="flex-1 text-xs rounded-xl border px-2.5 py-1.5 outline-none"
          style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite }}
          onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
          onBlur={e => { e.target.style.borderColor = "#D1D5DB"; }}
        />
      </div>

      {error && (
        <div className="text-[11px] rounded-lg px-2 py-1.5" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 text-xs font-semibold py-1.5 rounded-xl"
          style={{ background: "#1E4D8C", color: "#FFF", opacity: saving || !name.trim() ? 0.5 : 1, border: "none", cursor: saving || !name.trim() ? "default" : "pointer" }}
        >
          {saving ? "Salvando…" : "Criar campanha"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 text-xs rounded-xl border"
          style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFF", cursor: "pointer" }}
        >
          <X size={12} />
        </button>
      </div>
    </form>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, red }) {
  return (
    <div
      className="rounded-xl border"
      style={{
        background: "#FFFFFF",
        borderColor: "#E5E7EB",
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
          color: red ? "#DC2626" : NEUTRAL.graphite,
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
        style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
        onMouseEnter={e => { e.currentTarget.style.color = NEUTRAL.graphite; }}
        onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; }}
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
          style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}
        >
          <div className="text-xs font-semibold mb-4" style={{ color: NEUTRAL.slate }}>
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

// ── View toggle button ────────────────────────────────────────────────────────

function ViewToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
      style={{
        background: active ? "#1E4D8C" : "#FFFFFF",
        color: active ? "#FFFFFF" : NEUTRAL.slate,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F3F4F6"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#FFFFFF"; }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function MarketingView({ user, users = [] }) {
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

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedCampaign || !canWrite) return;
    if (draggedCampaign.stage !== toStage) {
      await changeStage(draggedCampaign.id, toStage);
    }
    setDraggedCampaign(null);
    setDragOverStage(null);
  }, [draggedCampaign, canWrite, changeStage]);

  const handleUpdate = useCallback(async (id, patch) => {
    if (isAgencia && Object.keys(patch).length === 1 && "approvalChecklist" in patch) {
      await updateChecklist(id, patch.approvalChecklist);
      if (selected?.id === id) setSelected(prev => ({ ...prev, ...patch }));
      return;
    }
    if (!canWrite) return;
    await updateCampaign(id, patch);
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...patch }));
  }, [canWrite, isAgencia, updateCampaign, updateChecklist, selected]);

  const handleDelete = useCallback(async (id) => {
    if (!canWrite) return;
    await deleteCampaign(id);
  }, [canWrite, deleteCampaign]);

  const handleQuickAdd = useCallback(async (stageIdOrCampaign, action) => {
    if (action === "open") {
      setQuickAddStage(stageIdOrCampaign);
      return;
    }
    await createCampaign(stageIdOrCampaign);
    setQuickAddStage(null);
  }, [createCampaign]);

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
            <Megaphone size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
              Marketing
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            Kanban de campanhas {isAgencia ? "· acesso de visitante" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canWrite && (
            <button
              onClick={() => setQuickAddStage("briefing")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "#1E4D8C", color: "#FFF", border: "none", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#163a6b"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#1E4D8C"; }}
            >
              <Plus size={15} />
              Nova Campanha
            </button>
          )}
          <button
            onClick={exportCampaignsCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
            style={{ background: "#FFFFFF", borderColor: "#E5E7EB", color: NEUTRAL.slate }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = NEUTRAL.graphite; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.color = NEUTRAL.slate; }}
            title="Exportar campanhas como CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          <div
            className="inline-flex rounded-lg border overflow-hidden"
            style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}
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
          style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFF" }}
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
          style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFF" }}
        >
          <option value="all">Todos os canais</option>
          {MARKETING_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setFilterStarred(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-colors"
          style={{
            borderColor: filterStarred ? "#F59E0B" : "#E5E7EB",
            background:  filterStarred ? "#FEF3C7" : "#FFF",
            color:       filterStarred ? "#D97706" : NEUTRAL.slate,
            cursor:      "pointer",
          }}
        >
          <Star size={11} fill={filterStarred ? "#F59E0B" : "none"} />
          Destaques
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-sm text-center py-8" style={{ color: NEUTRAL.slate }}>
          Carregando campanhas…
        </div>
      )}

      {/* Calendar placeholder */}
      {!loading && viewMode === "calendar" && (
        <div className="text-center py-16" style={{ color: NEUTRAL.slate }}>
          <CalendarIcon size={40} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
          <div className="font-semibold">Vista de calendário em breve</div>
        </div>
      )}

      {/* Kanban board */}
      {!loading && viewMode === "kanban" && (
        <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
          <div
            className="flex gap-3"
            style={{ minWidth: `${MARKETING_STAGES.length * 260}px` }}
          >
            {MARKETING_STAGES.map(stage => {
              const stageCampaigns = filteredCampaigns.filter(c => c.stage === stage.id);
              const count       = stageCampaigns.length;
              const totalBudget = stageCampaigns.reduce((s, c) => s + (c.budget || 0), 0);
              const isOver      = dragOverStage === stage.id;

              return (
                <div
                  key={stage.id}
                  onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
                  onDrop={e => { e.preventDefault(); handleDrop(stage.id); }}
                  className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
                  style={{
                    width: 248,
                    minWidth: 248,
                    background: isOver ? "#F0F7FF" : "#fef1f0",
                    borderColor: isOver ? stage.color + "70" : "#E5E7EB",
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
                    style={{ borderBottom: "1px solid #E5E7EB", background: "#FFFFFF" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-semibold flex items-center gap-1.5"
                        style={{
                          color: NEUTRAL.graphite,
                          fontSize: 11,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        <span>{stage.name}</span>
                        <span style={{ color: NEUTRAL.slate, fontWeight: 500 }}>({count})</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate, fontWeight: 600 }}>
                        {totalBudget > 0 ? formatK(totalBudget) : "R$ 0"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canWrite && !stage.terminal && (
                        <button
                          onClick={() => setQuickAddStage(stage.id)}
                          title="Nova campanha"
                          style={{
                            width: 24,
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "transparent",
                            border: "1px solid #E5E7EB",
                            borderRadius: 6,
                            color: NEUTRAL.slate,
                            cursor: "pointer",
                            flexShrink: 0,
                            transition: "background 0.12s, border-color 0.12s, color 0.12s",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = "#1E4D8C";
                            e.currentTarget.style.borderColor = "#1E4D8C";
                            e.currentTarget.style.color = "#FFF";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderColor = "#E5E7EB";
                            e.currentTarget.style.color = NEUTRAL.slate;
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cards */}
                  <div
                    className="px-2 pt-0.5 pb-1 space-y-2 flex-1 overflow-y-auto"
                    style={{ maxHeight: "62vh", minHeight: 80 }}
                  >
                    {stageCampaigns.length === 0 ? (
                      <div
                        className="flex flex-col items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs gap-1"
                        style={{ borderColor: isOver ? stage.color + "40" : "#E5E7EB", color: NEUTRAL.slate }}
                      >
                        {isOver ? (
                          <>
                            <Plus size={16} style={{ opacity: 0.5 }} />
                            <span>Soltar aqui</span>
                          </>
                        ) : (
                          <>
                            <span style={{ opacity: 0.5 }}>Nenhuma campanha</span>
                            {!stage.terminal && canWrite && (
                              <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card ou use o + acima</span>
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
                          onDragStart={c => setDraggedCampaign(c)}
                          stages={MARKETING_STAGES}
                          onMoveToStage={changeStage}
                        />
                      ))
                    )}

                    {quickAddStage === stage.id ? (
                      <CampaignCreateForm
                        stageId={stage.id}
                        currentUser={user}
                        users={users}
                        onAdd={handleQuickAdd}
                        onCancel={() => setQuickAddStage(null)}
                      />
                    ) : (
                      canWrite && stageCampaigns.length > 0 && (
                        <button
                          onClick={() => setQuickAddStage(stage.id)}
                          className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs transition-opacity"
                          style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer", opacity: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "#F3F4F6"; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = "0"; e.currentTarget.style.background = "none"; }}
                        >
                          <Plus size={13} /> Nova campanha
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Analytics panel */}
      {!loading && viewMode === "kanban" && filteredCampaigns.length > 0 && (
        <AnalyticsPanel campaigns={filteredCampaigns} />
      )}

      {!loading && viewMode === "kanban" && (
        <p className="text-xs text-center mt-3" style={{ color: NEUTRAL.slate }}>
          Arraste para mover entre etapas · Clique no card para ver detalhes
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

    {/* FAB — create new campaign (kanban mode only) */}
    {viewMode === "kanban" && canWrite && (
      <button
        className="fixed z-30 flex items-center gap-2 font-semibold shadow-lg left-6 lg:left-[312px] bottom-20 lg:bottom-6"
        style={{
          height: 52,
          padding: "0 20px",
          background: "#1E4D8C",
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
