import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, X, Package, TrendingUp, ChevronDown, Star, Download,
  Filter, CalendarDays, LayoutGrid,
} from "lucide-react";
import { DeliverableKanbanCard } from "../campaign/DeliverableKanbanCard";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingCampaigns }    from "../../hooks/use-marketing-campaigns";
import {
  DELIVERABLE_STAGES, DELIVERABLE_DEPARTMENTS, DELIVERABLE_PRIORITIES,
} from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatDateBR } from "../../utils/date";
import { useUsersById }  from "../../hooks/use-users-by-id";
import { DeliverableDetailDrawer } from "../campaign/DeliverableDetailDrawer";

const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };

/* ── CSV export ─────────────────────────────────────────────── */
function exportCSV(deliverables) {
  const headers = ["Título","Solicitante","Departamento","Prioridade","Prazo","Etapa","Empresas","Criado em"];
  const rows = deliverables.map(d => [
    d.title,
    d.requesterName || "",
    d.department    || "",
    PRIORITY_LABELS[d.priority] || d.priority || "",
    d.deadline ? formatDateBR(d.deadline) : "",
    DELIVERABLE_STAGES.find(s => s.id === d.stage)?.name || d.stage,
    (d.companyIds || []).map(id => COMPANIES[id]?.short || id).join(";"),
    d.createdAt ? new Date(d.createdAt).toLocaleDateString("pt-BR") : "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "entregas.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ── Create modal ────────────────────────────────────────────── */
function DeliverableCreateModal({ stageId, currentUser, users, campaigns, onAdd, onClose }) {
  const stage = DELIVERABLE_STAGES.find(s => s.id === stageId);

  const [title,         setTitle]         = useState("");
  const [requesterName, setRequester]     = useState("");
  const [department,    setDepartment]    = useState("");
  const [description,   setDescription]  = useState("");
  const [priority,      setPriority]      = useState("media");
  const [deadline,      setDeadline]      = useState("");
  const [companyIds,    setCompanyIds]    = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [campaignId,    setCampaignId]    = useState("");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState(null);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const toggleCompany = (id) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    setSaving(true); setError(null);
    try {
      await onAdd({
        title:          title.trim(),
        requesterName:  requesterName.trim() || null,
        department:     department || null,
        description:    description.trim() || null,
        priority,
        deadline:       deadline ? new Date(deadline).toISOString() : null,
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        companyIds,
        campaignId:     campaignId || null,
        notes:          [],
        activities:     [{ type: "created", description: "Entregável criado", at: new Date().toISOString() }],
        createdBy:      currentUser?.id || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar entrega.");
    } finally {
      setSaving(false);
    }
  };

  const focusBlue = e => { e.target.style.borderColor = "#1E4D8C"; };
  const blurGray  = e => { e.target.style.borderColor = "#D1D5DB"; };
  const labelSt   = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  const inputSt   = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>Novo Entregável</div>
            {stage && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: NEUTRAL.slate }}>{stage.name}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 6, borderRadius: 8, display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Nome do Solicitante</label>
            <input autoFocus type="text" placeholder="Nome de quem está solicitando"
              value={requesterName} onChange={e => setRequester(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Departamento</label>
            <select value={department} onChange={e => setDepartment(e.target.value)}
              className="w-full text-sm rounded-xl border outline-none px-3 py-2"
              style={{ ...inputSt, color: department ? NEUTRAL.graphite : NEUTRAL.slate }}>
              <option value="">Escolha uma opção</option>
              {DELIVERABLE_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Descrição do Entregável</label>
            <textarea placeholder="Detalhes do entregável solicitado"
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ ...inputSt, resize: "vertical" }} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Título resumido</label>
            <input type="text" placeholder="Ex: Banner para Instagram"
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Prazo</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div>
              <label style={labelSt}>* Prioridade</label>
              <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                {DELIVERABLE_PRIORITIES.map(p => (
                  <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                    style={{ flex: 1, padding: "5px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${priority === p.id ? p.color : "#E5E7EB"}`, background: priority === p.id ? p.color + "18" : "#FFF", color: priority === p.id ? p.color : NEUTRAL.slate, cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Empresa</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COMPANY_IDS.map(id => {
                const co = COMPANIES[id]; const sel = companyIds.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleCompany(id)}
                    style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${sel ? co.primary : "#E5E7EB"}`, background: sel ? co.primary + "22" : "#FFF", color: sel ? co.primary : NEUTRAL.slate, cursor: "pointer" }}>
                    {co.short}
                  </button>
                );
              })}
            </div>
          </div>

          {campaigns.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>Campanha relacionada</label>
              <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={{ ...inputSt, color: campaignId ? NEUTRAL.graphite : NEUTRAL.slate }}>
                <option value="">Nenhuma (opcional)</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}

          <button type="submit" disabled={saving || !title.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "#1E4D8C", color: "#FFF", opacity: (saving || !title.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !title.trim()) ? "default" : "pointer" }}>
            {saving ? "Criando…" : "Criar novo card"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Analytics panel ─────────────────────────────────────────── */
function AnalyticsPanel({ deliverables }) {
  const [open, setOpen] = useState(false);

  const stageStats = useMemo(() => DELIVERABLE_STAGES.map(stage => {
    const items   = deliverables.filter(d => d.stage === stage.id);
    const overdue = items.filter(d => d.deadline && new Date(d.deadline) < new Date()).length;
    const daysArr = items.filter(d => d.stageChangedAt).map(d => Math.floor((Date.now() - new Date(d.stageChangedAt).getTime()) / 86400000));
    const avgDays = daysArr.length > 0 ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : null;
    return { stage, count: items.length, overdue, avgDays };
  }), [deliverables]);

  const maxCount = Math.max(...stageStats.map(s => s.count), 1);

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
        style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
        onMouseEnter={e => { e.currentTarget.style.color = NEUTRAL.graphite; }}
        onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; }}>
        <TrendingUp size={13} strokeWidth={2} />
        <span>Análise das entregas</span>
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div className="rounded-2xl border mt-3 p-5" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
          <div className="text-xs font-semibold mb-4" style={{ color: NEUTRAL.slate }}>Distribuição por etapa</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {stageStats.map(({ stage, count, overdue, avgDays }) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: NEUTRAL.graphite }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block", flexShrink: 0 }} />
                    {stage.name}
                  </div>
                  <div className="text-xs" style={{ color: overdue > 0 ? "#DC2626" : NEUTRAL.slate }}>
                    {count}{overdue > 0 ? ` · ${overdue} atrasada${overdue !== 1 ? "s" : ""}` : ""}
                  </div>
                </div>
                <div style={{ height: 6, background: "#F1F3F5", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: stage.color, borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: NEUTRAL.slate }}>
                  {avgDays !== null ? `Média ${avgDays}d · SLA: ${stage.sla ?? "—"}d` : count > 0 ? "Sem tempo registrado" : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────────── */
function KpiCard({ label, value, color }) {
  return (
    <div className="rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB", padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || NEUTRAL.graphite, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

/* ── View toggle button ──────────────────────────────────────── */
function ViewToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
        background: active ? "#1E4D8C" : "#FFFFFF",
        color:      active ? "#FFFFFF"  : NEUTRAL.slate,
        border: `1px solid ${active ? "#1E4D8C" : "#E5E7EB"}`,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

/* ── Main view ───────────────────────────────────────────────── */
export function EntregasView({ user, users = [] }) {
  const {
    deliverables, loading, canWrite,
    createDeliverable, updateDeliverable, deleteDeliverable,
    changeStage, toggleStar,
  } = useMarketingDeliverables({ userId: user?.id, role: user?.role });

  const { campaigns } = useMarketingCampaigns({ userId: user?.id, role: user?.role });
  const usersById = useUsersById(users);

  const [draggedItem,    setDraggedItem]    = useState(null);
  const [dragOverStage,  setDragOverStage]  = useState(null);
  const [quickAddStage,  setQuickAddStage]  = useState(null);
  const [selected,       setSelected]       = useState(null);
  const [viewMode,       setViewMode]       = useState("kanban");
  const [expandedMobileStages, setExpandedMobileStages] = useState(() => new Set(["solicitacao"]));
  const toggleMobileStage = (id) => setExpandedMobileStages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* Filters */
  const [ownerFilter,    setOwnerFilter]    = useState("");
  const [companyFilter,  setCompanyFilter]  = useState([]);
  const [starredOnly,    setStarredOnly]    = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);

  const isManager = user?.role === "admin" || user?.role === "gerente_marketing";

  const toggleCompanyFilter = (id) =>
    setCompanyFilter(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const activeFilterCount = (ownerFilter ? 1 : 0) + companyFilter.length + (starredOnly ? 1 : 0);

  /* Filtered deliverables */
  const filtered = useMemo(() => {
    let list = deliverables;
    if (ownerFilter)             list = list.filter(d => d.assignee === ownerFilter);
    if (companyFilter.length > 0) list = list.filter(d => companyFilter.some(c => d.companyIds?.includes(c)));
    if (starredOnly)             list = list.filter(d => d.starred);
    return list;
  }, [deliverables, ownerFilter, companyFilter, starredOnly]);

  const handleDragStart = useCallback((item) => setDraggedItem(item), []);
  const handleDragOver  = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleDragEnd   = useCallback(() => { setDraggedItem(null); setDragOverStage(null); }, []);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedItem || !canWrite) return;
    if (draggedItem.stage !== toStage) await changeStage(draggedItem.id, toStage);
    setDraggedItem(null); setDragOverStage(null);
  }, [draggedItem, canWrite, changeStage]);

  const handleQuickAdd = useCallback(async (item) => { await createDeliverable(item); }, [createDeliverable]);

  const handleUpdate = useCallback(async (id, patch) => {
    await updateDeliverable(id, patch);
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  }, [updateDeliverable]);

  const handleDelete = useCallback(async (id) => { await deleteDeliverable(id); }, [deleteDeliverable]);

  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return deliverables.find(d => d.id === selected.id) || selected;
  }, [deliverables, selected]);

  const kpis = useMemo(() => ({
    total:       deliverables.length,
    solicitacao: deliverables.filter(d => d.stage === "solicitacao").length,
    em_producao: deliverables.filter(d => d.stage === "em_producao").length,
    entregue:    deliverables.filter(d => d.stage === "entregue").length,
  }), [deliverables]);

  return (
    <>
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Package size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
              Entregas
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>Kanban de entregas de campanha</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* View toggle */}
          <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 3 }}>
            <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}   label="Kanban"     />
            <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarDays} label="Calendário" />
          </div>
          {/* Export CSV */}
          <button
            onClick={() => exportCSV(filtered)}
            title="Exportar CSV"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 500, color: NEUTRAL.slate, cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.color = NEUTRAL.graphite; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.color = NEUTRAL.slate; }}
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <KpiCard label="Total"       value={String(kpis.total)} />
        <KpiCard label="Solicitação" value={String(kpis.solicitacao)} />
        <KpiCard label="Em Produção" value={String(kpis.em_producao)} color="#D97706" />
        <KpiCard label="Entregue"    value={String(kpis.entregue)} color="#16A34A" />
      </div>

      {/* Filter toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: `1px solid ${showFilters || activeFilterCount > 0 ? "#1E4D8C" : "#E5E7EB"}`, background: showFilters || activeFilterCount > 0 ? "#EFF6FF" : "#FFF", color: showFilters || activeFilterCount > 0 ? "#1E4D8C" : NEUTRAL.slate, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
          <Filter size={12} />
          Filtros
          {activeFilterCount > 0 && (
            <span style={{ background: "#1E4D8C", color: "#FFF", borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "1px 5px", marginLeft: 2 }}>{activeFilterCount}</span>
          )}
        </button>

        {showFilters && (
          <>
            {/* Owner filter (managers only) */}
            {isManager && (
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, color: ownerFilter ? NEUTRAL.graphite : NEUTRAL.slate, background: "#FFF", outline: "none", cursor: "pointer" }}>
                <option value="">Todos responsáveis</option>
                {Array.from(usersById.values()).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}

            {/* Company filter */}
            {COMPANY_IDS.map(id => {
              const co  = COMPANIES[id];
              const sel = companyFilter.includes(id);
              return (
                <button key={id} onClick={() => toggleCompanyFilter(id)}
                  style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${sel ? co.primary : "#E5E7EB"}`, background: sel ? co.primary + "22" : "#FFF", color: sel ? co.primary : NEUTRAL.slate, cursor: "pointer" }}>
                  {co.short}
                </button>
              );
            })}

            {/* Starred */}
            <button onClick={() => setStarredOnly(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: `1px solid ${starredOnly ? "#F59E0B" : "#E5E7EB"}`, background: starredOnly ? "#FFFBEB" : "#FFF", color: starredOnly ? "#D97706" : NEUTRAL.slate, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <Star size={11} fill={starredOnly ? "#F59E0B" : "none"} />
              Favoritos
            </button>

            {activeFilterCount > 0 && (
              <button onClick={() => { setOwnerFilter(""); setCompanyFilter([]); setStarredOnly(false); }}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                <X size={11} /> Limpar
              </button>
            )}
          </>
        )}
      </div>

      {loading && <div className="text-sm text-center py-8" style={{ color: NEUTRAL.slate }}>Carregando entregas…</div>}

      {!loading && viewMode === "kanban" && (<>
        {/* Mobile kanban: vertical collapsible stages */}
        <div className="lg:hidden space-y-1.5 pb-24">
          {DELIVERABLE_STAGES.map(stage => {
            const stageItems = filtered.filter(d => d.stage === stage.id);
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
                    {stage.sla && <span className="text-xs" style={{ color: stage.color + "88" }}>SLA {stage.sla}d</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: stage.color }}>{stageItems.length}</span>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${stage.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: stage.color, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                      <ChevronDown size={13} />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="p-2.5 space-y-2" style={{ background: "#FAFAFA" }}>
                    {stageItems.length === 0 ? (
                      <div className="text-center py-4 text-xs" style={{ color: NEUTRAL.slate }}>Nenhuma entrega nesta etapa</div>
                    ) : (
                      stageItems.map(item => (
                        <DeliverableKanbanCard
                          key={item.id}
                          item={item}
                          ownerName={usersById.get(item.assignee)?.name || null}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          canWrite={canWrite}
                          onClick={setSelected}
                          stages={DELIVERABLE_STAGES}
                          onMoveToStage={canWrite ? changeStage : null}
                          onToggleStar={canWrite ? toggleStar : null}
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
                        Nova entrega
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
          <div className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none z-10"
            style={{ background: "linear-gradient(to left, #DEDAD6 0%, transparent 100%)" }} />
          <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
            <div className="flex gap-3" style={{ minWidth: `${DELIVERABLE_STAGES.length * 284}px` }}>
              {DELIVERABLE_STAGES.map(stage => {
                const stageItems = filtered.filter(d => d.stage === stage.id);
                const isOver     = dragOverStage === stage.id;

                return (
                  <div key={stage.id}
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(stage.id)}
                    className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
                    style={{ width: 272, minWidth: 272, background: isOver ? "#F0F7FF" : "#fef1f0", borderColor: isOver ? stage.color + "70" : "#E5E7EB", boxShadow: isOver ? `0 0 0 2px ${stage.color}30` : "0 1px 2px rgba(0,0,0,0.03)", minHeight: 480, flexShrink: 0 }}>
                    <div style={{ height: 4, background: stage.color, flexShrink: 0 }} />
                    <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2"
                      style={{ borderBottom: "1px solid #E5E7EB", background: "#FFFFFF" }}>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold flex items-center gap-1.5"
                          style={{ color: NEUTRAL.graphite, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          <span>{stage.name}</span>
                          <span style={{ color: NEUTRAL.slate, fontWeight: 500 }}>({stageItems.length})</span>
                        </div>
                        {stage.sla && <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>SLA {stage.sla}d</div>}
                      </div>
                      {canWrite && !stage.terminal && (
                        <button onClick={() => setQuickAddStage(stage.id)}
                          className="flex items-center justify-center rounded-md transition-colors"
                          style={{ width: 28, height: 28, color: NEUTRAL.slate, background: "transparent", border: "1px solid transparent", flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = NEUTRAL.graphite; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; }}
                          title="Adicionar entrega">
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    <div className="px-2 pt-0.5 pb-1 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: "62vh", minHeight: 80 }}>
                      {stageItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs gap-1"
                          style={{ borderColor: isOver ? stage.color + "40" : "#E5E7EB", color: NEUTRAL.slate }}>
                          {isOver ? (
                            <>
                              <Plus size={16} style={{ opacity: 0.5 }} />
                              <span>Soltar aqui</span>
                            </>
                          ) : (
                            <>
                              <span style={{ opacity: 0.5 }}>Nenhuma entrega nesta etapa</span>
                              {!stage.terminal && canWrite && (
                                <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        stageItems.map(item => (
                          <DeliverableKanbanCard
                            key={item.id}
                            item={item}
                            ownerName={usersById.get(item.assignee)?.name || null}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            canWrite={canWrite}
                            onClick={setSelected}
                            stages={DELIVERABLE_STAGES}
                            onMoveToStage={canWrite ? changeStage : null}
                            onToggleStar={canWrite ? toggleStar : null}
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

      {!loading && viewMode === "calendar" && (
        <div className="text-center py-16" style={{ color: NEUTRAL.slate }}>
          <CalendarDays size={40} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
          <div className="font-semibold" style={{ fontSize: 15, marginBottom: 6, color: NEUTRAL.graphite }}>Vista de calendário em breve</div>
          <div className="text-sm" style={{ color: NEUTRAL.slate }}>As entregas serão exibidas por prazo nesta visão.</div>
        </div>
      )}

      {!loading && viewMode === "kanban" && deliverables.length > 0 && <AnalyticsPanel deliverables={deliverables} />}

      {!loading && viewMode === "kanban" && (
        <p className="text-xs text-center mt-3" style={{ color: NEUTRAL.slate }}>
          Arraste para mover · "+" para criar · Clique para ver detalhes
        </p>
      )}
    </div>

    {quickAddStage && (
      <DeliverableCreateModal
        stageId={quickAddStage}
        currentUser={user}
        users={users}
        campaigns={campaigns}
        onAdd={handleQuickAdd}
        onClose={() => setQuickAddStage(null)}
      />
    )}

    {syncSelected && (
      <DeliverableDetailDrawer
        item={syncSelected}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        users={Array.from(usersById.values())}
        canWrite={canWrite}
        userId={user?.id}
        currentUser={user}
      />
    )}

    {canWrite && viewMode === "kanban" && (
      <button
        className="fixed z-30 flex items-center gap-2 font-semibold shadow-lg left-6 lg:left-[312px] bottom-20 lg:bottom-6"
        style={{ height: 52, padding: "0 20px", background: "#1E4D8C", color: "#FFFFFF", border: "none", borderRadius: 26, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(30,77,140,0.35)" }}
        onClick={() => setQuickAddStage("solicitacao")}
        onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        aria-label="Criar nova entrega">
        <Plus size={20} />
        Nova entrega
      </button>
    )}
    </>
  );
}
