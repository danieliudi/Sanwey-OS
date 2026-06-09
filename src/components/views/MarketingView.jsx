import React, { useCallback, useMemo, useState } from "react";
import { Plus, X, Megaphone, Star } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import {
  MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS, CHANNEL_COLORS,
} from "../../constants/marketing-pipelines";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { CampaignKanbanCard } from "../campaign/CampaignKanbanCard";
import { CampaignDetailDrawer } from "../campaign/CampaignDetailDrawer";
import { useUsersById } from "../../hooks/use-users-by-id";
import { formatK } from "../../utils/currency";

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

      {/* Company multi-select */}
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

// ── KPI summary bar ───────────────────────────────────────────────────────────

function KpiBar({ campaigns }) {
  const active    = campaigns.filter(c => !["encerrado"].includes(c.stage)).length;
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const live      = campaigns.filter(c => c.stage === "ao_vivo").length;
  const urgent    = campaigns.filter(c => {
    if (!c.launchDate) return false;
    const d = Math.floor((new Date(c.launchDate).getTime() - Date.now()) / 86400000);
    return d <= 7 && d >= 0 && !["ao_vivo","encerrado","analise"].includes(c.stage);
  }).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {[
        { label: "Campanhas ativas", value: String(active) },
        { label: "Budget total",     value: formatK(totalBudget) },
        { label: "Ao Vivo",          value: String(live) },
        { label: "URGENTE",          value: String(urgent), red: urgent > 0 },
      ].map(k => (
        <div
          key={k.label}
          className="rounded-xl border px-4 py-3"
          style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: NEUTRAL.slate }}>
            {k.label}
          </div>
          <div className="text-xl font-bold" style={{ color: k.red ? "#DC2626" : NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({ stage, campaigns, canWrite, usersById, onCardClick, onDragStart, onDragOver, onDrop, dragOver, quickAddStage, onQuickAdd, onCancelQuickAdd, currentUser, users }) {
  const count = campaigns.length;
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0);

  return (
    <div
      className="flex flex-col rounded-2xl min-w-[240px]"
      style={{
        background:  "#F8F9FA",
        border:      "1px solid #E5E7EB",
        minHeight:   480,
        flexShrink:  0,
        transition:  "background 0.15s",
        ...(dragOver ? { background: "#EFF6FF", borderColor: "#1E4D8C" } : {}),
      }}
      onDragOver={e => { e.preventDefault(); onDragOver(stage.id); }}
      onDrop={e => { e.preventDefault(); onDrop(stage.id); }}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex items-center gap-2">
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block", flexShrink: 0 }}
          />
          <span className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>{stage.name}</span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: stage.color + "22", color: stage.color }}
          >
            {count}
          </span>
        </div>
        {totalBudget > 0 && (
          <span className="text-[10px]" style={{ color: NEUTRAL.slate }}>{formatK(totalBudget)}</span>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {campaigns.map(c => (
          <CampaignKanbanCard
            key={c.id}
            campaign={c}
            ownerName={usersById.get(c.owner)?.name || null}
            onClick={onCardClick}
            onDragStart={onDragStart}
            stages={MARKETING_STAGES}
          />
        ))}

        {quickAddStage === stage.id ? (
          <CampaignCreateForm
            stageId={stage.id}
            currentUser={currentUser}
            users={users}
            onAdd={onQuickAdd}
            onCancel={onCancelQuickAdd}
          />
        ) : (
          canWrite && (
            <button
              onClick={() => onQuickAdd(stage.id, "open")}
              className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs opacity-0 hover:opacity-100 transition-opacity"
              style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer" }}
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

  const [selected, setSelected]           = useState(null);
  const [draggedCampaign, setDraggedCampaign] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [quickAddStage, setQuickAddStage] = useState(null);
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStarred, setFilterStarred] = useState(false);

  const isAgencia = user?.role === "agencia";

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (filterCompany !== "all" && !(c.companyIds || []).includes(filterCompany)) return false;
      if (filterChannel !== "all" && c.channel !== filterChannel) return false;
      if (filterStarred && !c.starred) return false;
      return true;
    });
  }, [campaigns, filterCompany, filterChannel, filterStarred]);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedCampaign || !canWrite) return;
    if (draggedCampaign.stage !== toStage) {
      await changeStage(draggedCampaign.id, toStage);
    }
    setDraggedCampaign(null);
    setDragOverStage(null);
  }, [draggedCampaign, canWrite, changeStage]);

  const handleUpdate = useCallback(async (id, patch) => {
    // Allow checklist updates for agencia
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
    // stageIdOrCampaign is a campaign object
    await createCampaign(stageIdOrCampaign);
    setQuickAddStage(null);
  }, [createCampaign]);

  // Keep selected campaign in sync
  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return campaigns.find(c => c.id === selected.id) || selected;
  }, [campaigns, selected]);

  return (
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
        {canWrite && (
          <button
            onClick={() => setQuickAddStage("briefing")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#1E4D8C", color: "#FFF", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#163a6b"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#1E4D8C"; }}
          >
            <Plus size={15} />
            Nova campanha
          </button>
        )}
      </div>

      {/* KPI bar */}
      <KpiBar campaigns={filteredCampaigns} />

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

      {/* Kanban board */}
      {!loading && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 520 }}>
          {MARKETING_STAGES.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              campaigns={filteredCampaigns.filter(c => c.stage === stage.id)}
              canWrite={canWrite}
              usersById={usersById}
              onCardClick={setSelected}
              onDragStart={c => setDraggedCampaign(c)}
              onDragOver={setDragOverStage}
              onDrop={handleDrop}
              dragOver={dragOverStage === stage.id}
              quickAddStage={quickAddStage}
              onQuickAdd={handleQuickAdd}
              onCancelQuickAdd={() => setQuickAddStage(null)}
              currentUser={user}
              users={[]}
            />
          ))}
        </div>
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
  );
}
