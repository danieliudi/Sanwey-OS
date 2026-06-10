import React, { useCallback, useMemo, useState } from "react";
import { Plus, X, Package, Clock, MoreVertical, ArrowRight } from "lucide-react";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { DELIVERABLE_STAGES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatDateBR } from "../../utils/date";
import { useUsersById } from "../../hooks/use-users-by-id";

// ── SLA badge ────────────────────────────────────────────────────────────────

function slaBadge(stageChangedAt, sla) {
  if (!sla || !stageChangedAt) return null;
  const days = Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86400000);
  if (days > sla)          return { label: `${days}d`, bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
  if (days > sla * 0.7)   return { label: `${days}d`, bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  return                          { label: `${days}d`, bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0" };
}

// ── Deliverable card ─────────────────────────────────────────────────────────

function DeliverableCard({ item, ownerName, onDragStart, stages, onMoveToStage, canWrite }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = React.useRef(null);

  const stageObj   = stages.find(s => s.id === item.stage);
  const badge      = slaBadge(item.stageChangedAt, stageObj?.sla);
  const moveTargets = stages.filter(s => s.id !== item.stage);
  const isOverdue  = item.deadline && new Date(item.deadline) < new Date();

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      draggable={canWrite}
      onDragStart={() => canWrite && onDragStart?.(item)}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 1px 4px rgba(32,26,26,0.06)",
        position: "relative",
        cursor: canWrite ? "grab" : "default",
        transition: "box-shadow 0.12s, border-color 0.12s, transform 0.12s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(32,26,26,0.10)";
        e.currentTarget.style.borderColor = "#e9bcb6";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(32,26,26,0.06)";
        e.currentTarget.style.borderColor = "#E5E7EB";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35, flex: 1, color: NEUTRAL.graphite }}>
          {item.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {badge && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                padding: "2px 6px",
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 700,
                background: badge.bg,
                color: badge.text,
                border: `1px solid ${badge.border}`,
                letterSpacing: "-0.01em",
              }}
            >
              <Clock size={8} strokeWidth={2.5} />
              {badge.label}
            </span>
          )}
          {canWrite && moveTargets.length > 0 && onMoveToStage && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                title="Mover para outra etapa"
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: NEUTRAL.slate,
                  cursor: "pointer",
                  padding: 2,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#fef1f0"; e.currentTarget.style.color = "#b5000b"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; }}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(32,26,26,0.12)",
                    zIndex: 50,
                    minWidth: 180,
                    overflow: "hidden",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Mover para
                  </div>
                  {moveTargets.map(s => (
                    <button
                      key={s.id}
                      onClick={e => { e.stopPropagation(); onMoveToStage(item.id, s.id); setMenuOpen(false); }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        color: NEUTRAL.graphite,
                        textAlign: "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#fef1f0"; e.currentTarget.style.color = "#b5000b"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.graphite; }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                      {s.name}
                      <ArrowRight size={11} style={{ marginLeft: "auto", opacity: 0.4 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: NEUTRAL.slate }}>
        {ownerName ? (
          <span style={{ padding: "2px 7px", borderRadius: 99, background: "#F3F4F6", color: NEUTRAL.slate, fontWeight: 500 }}>
            {ownerName}
          </span>
        ) : <span />}
        {item.deadline && (
          <span style={{ color: isOverdue ? "#DC2626" : NEUTRAL.slate, fontWeight: isOverdue ? 600 : 400 }}>
            {formatDateBR(item.deadline)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Quick-create form ─────────────────────────────────────────────────────────

function DeliverableCreateForm({ stageId, currentUser, users, campaigns, onAdd, onCancel }) {
  const [title, setTitle]           = useState("");
  const [assignee, setAssignee]     = useState(currentUser?.id || "");
  const [deadline, setDeadline]     = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [companyIds, setCompanyIds] = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const toggleCompany = (id) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        title:          title.trim(),
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        assignee:       assignee || null,
        deadline:       deadline ? new Date(deadline).toISOString() : null,
        companyIds,
        notes:          [],
        campaignId:     campaignId || null,
        createdBy:      currentUser?.id || null,
      });
      onCancel();
    } catch (err) {
      setError(err?.message || "Erro ao criar entrega.");
    } finally {
      setSaving(false);
    }
  };

  const focusBlue = e => { e.target.style.borderColor = "#1E4D8C"; };
  const blurGray  = e => { e.target.style.borderColor = "#D1D5DB"; };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-0 mb-2 rounded-xl border p-2.5 space-y-2"
      style={{ background: "#FFFFFF", borderColor: "#E0E7FF" }}
    >
      <input
        autoFocus
        type="text"
        placeholder="Título da entrega *"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full text-xs rounded-xl border px-2.5 py-1.5 outline-none"
        style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite }}
        onFocus={focusBlue}
        onBlur={blurGray}
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
              style={{
                padding: "2px 8px",
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 600,
                border: `1px solid ${sel ? co.primary : "#E5E7EB"}`,
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
      {campaigns.length > 0 && (
        <select
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          className="w-full text-xs rounded-xl border outline-none px-2 py-1.5"
          style={{ borderColor: "#D1D5DB", color: campaignId ? NEUTRAL.graphite : NEUTRAL.slate }}
        >
          <option value="">Campanha relacionada (opcional)</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <div className="flex gap-1.5">
        <select
          value={assignee}
          onChange={e => setAssignee(e.target.value)}
          className="flex-1 text-xs rounded-xl border outline-none px-2 py-1.5"
          style={{ borderColor: "#D1D5DB", color: assignee ? NEUTRAL.graphite : NEUTRAL.slate }}
        >
          <option value="">Responsável</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input
          type="date"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          className="flex-1 text-xs rounded-xl border px-2.5 py-1.5 outline-none"
          style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite }}
          onFocus={focusBlue}
          onBlur={blurGray}
        />
      </div>
      {error && (
        <div className="text-[11px] rounded-lg px-2 py-1.5" style={{ background: "#FEF2F2", color: "#B91C1C" }}>{error}</div>
      )}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="flex-1 text-xs font-semibold py-1.5 rounded-xl"
          style={{ background: "#1E4D8C", color: "#FFF", opacity: saving || !title.trim() ? 0.5 : 1, border: "none", cursor: saving || !title.trim() ? "default" : "pointer" }}
        >
          {saving ? "Salvando…" : "Criar entrega"}
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

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }) {
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
      <div style={{ fontSize: 10, fontWeight: 600, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || NEUTRAL.graphite, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function EntregasView({ user, users = [] }) {
  const {
    deliverables,
    loading,
    canWrite,
    createDeliverable,
    changeStage,
  } = useMarketingDeliverables({ userId: user?.id, role: user?.role });

  const { campaigns } = useMarketingCampaigns({ userId: user?.id, role: user?.role });

  const usersById = useUsersById(users);

  const [draggedItem, setDraggedItem]     = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [quickAddStage, setQuickAddStage] = useState(null);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedItem || !canWrite) return;
    if (draggedItem.stage !== toStage) await changeStage(draggedItem.id, toStage);
    setDraggedItem(null);
    setDragOverStage(null);
  }, [draggedItem, canWrite, changeStage]);

  const handleQuickAdd = useCallback(async (stageIdOrItem, action) => {
    if (action === "open") { setQuickAddStage(stageIdOrItem); return; }
    await createDeliverable(stageIdOrItem);
    setQuickAddStage(null);
  }, [createDeliverable]);

  const kpis = useMemo(() => ({
    total:      deliverables.length,
    pendente:   deliverables.filter(d => d.stage === "pendente").length,
    produzindo: deliverables.filter(d => d.stage === "produzindo").length,
    entregue:   deliverables.filter(d => d.stage === "entregue").length,
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
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            Kanban de entregas de campanha
          </p>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <KpiCard label="Total"       value={String(kpis.total)} />
        <KpiCard label="Pendente"    value={String(kpis.pendente)} />
        <KpiCard label="Produzindo"  value={String(kpis.produzindo)} color="#D97706" />
        <KpiCard label="Entregue"    value={String(kpis.entregue)}   color="#16A34A" />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-sm text-center py-8" style={{ color: NEUTRAL.slate }}>Carregando entregas…</div>
      )}

      {/* Kanban board */}
      {!loading && (
        <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
          <div
            className="flex gap-3"
            style={{ minWidth: `${DELIVERABLE_STAGES.length * 260}px` }}
          >
            {DELIVERABLE_STAGES.map(stage => {
              const stageItems = deliverables.filter(d => d.stage === stage.id);
              const count  = stageItems.length;
              const isOver = dragOverStage === stage.id;

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
                    </div>
                  </div>

                  {/* Cards area */}
                  <div
                    className="px-2 pt-0.5 pb-1 space-y-2 flex-1 overflow-y-auto"
                    style={{ maxHeight: "62vh", minHeight: 80 }}
                  >
                    {stageItems.length === 0 && quickAddStage !== stage.id ? (
                      <div
                        className="flex flex-col items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs gap-1"
                        style={{
                          borderColor: isOver ? stage.color + "40" : "#E5E7EB",
                          color: NEUTRAL.slate,
                        }}
                      >
                        {isOver ? (
                          <>
                            <Plus size={16} style={{ opacity: 0.5 }} />
                            <span>Soltar aqui</span>
                          </>
                        ) : (
                          <>
                            <span style={{ opacity: 0.5 }}>Sem entregas</span>
                            {!stage.terminal && canWrite && (
                              <span style={{ opacity: 0.4, fontSize: 10 }}>
                                Arraste um card ou use o botão abaixo
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      stageItems.map(item => (
                        <DeliverableCard
                          key={item.id}
                          item={item}
                          ownerName={usersById.get(item.assignee)?.name || null}
                          onDragStart={setDraggedItem}
                          stages={DELIVERABLE_STAGES}
                          onMoveToStage={canWrite ? changeStage : null}
                          canWrite={canWrite}
                        />
                      ))
                    )}

                    {quickAddStage === stage.id ? (
                      <DeliverableCreateForm
                        stageId={stage.id}
                        currentUser={user}
                        users={users}
                        campaigns={campaigns}
                        onAdd={handleQuickAdd}
                        onCancel={() => setQuickAddStage(null)}
                      />
                    ) : (
                      canWrite && stageItems.length > 0 && (
                        <button
                          onClick={() => setQuickAddStage(stage.id)}
                          className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs transition-opacity"
                          style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer", opacity: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "#F3F4F6"; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = "0"; e.currentTarget.style.background = "none"; }}
                        >
                          <Plus size={13} /> Nova entrega
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

      {!loading && (
        <p className="text-xs text-center mt-3" style={{ color: NEUTRAL.slate }}>
          Arraste para mover entre etapas · Use o botão flutuante para criar nova entrega
        </p>
      )}
    </div>

    {/* FAB */}
    {canWrite && (
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
        onClick={() => setQuickAddStage("pendente")}
        onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        aria-label="Criar nova entrega"
      >
        <Plus size={20} />
        Nova entrega
      </button>
    )}
    </>
  );
}
