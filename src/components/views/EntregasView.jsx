import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Package, Clock, MoreVertical, ArrowRight } from "lucide-react";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { DELIVERABLE_STAGES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatDateBR } from "../../utils/date";
import { useUsersById } from "../../hooks/use-users-by-id";

function slaBadge(stageChangedAt, sla) {
  if (!sla || !stageChangedAt) return null;
  const days = Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86400000);
  if (days > sla) return { label: `${days}d`, bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
  if (days > sla * 0.7) return { label: `${days}d`, bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  return { label: `${days}d`, bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0" };
}

function DeliverableCard({ item, ownerName, onClick, onDragStart, stages, onMoveToStage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const stageObj = stages.find(s => s.id === item.stage);
  const badge = slaBadge(item.stageChangedAt, stageObj?.sla);
  const moveTargets = stages.filter(s => s.id !== item.stage && !s.terminal);

  const isOverdue = item.deadline && new Date(item.deadline) < new Date();

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(item)}
      onClick={() => { if (!menuOpen) onClick?.(item); }}
      className="p-3 rounded-xl cursor-pointer transition-all duration-150"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: "0 1px 4px rgba(32,26,26,0.06)",
        position: "relative",
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
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-semibold text-[13px] leading-snug flex-1" style={{ color: NEUTRAL.graphite }}>
          {item.title}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {badge && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
              style={{
                fontSize: 10,
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
          {moveTargets.length > 0 && onMoveToStage && (
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
                  <div
                    style={{
                      padding: "6px 12px 4px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: NEUTRAL.slate,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Mover para
                  </div>
                  {moveTargets.map(s => (
                    <button
                      key={s.id}
                      onClick={e => {
                        e.stopPropagation();
                        onMoveToStage(item.id, s.id);
                        setMenuOpen(false);
                      }}
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
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: s.color,
                          flexShrink: 0,
                        }}
                      />
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

      <div className="flex items-center justify-between text-[11px]" style={{ color: NEUTRAL.slate }}>
        {ownerName ? (
          <span
            className="px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "#F3F4F6", color: NEUTRAL.slate }}
          >
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

function DeliverableCreateForm({ stageId, currentUser, users, onAdd, onCancel }) {
  const [title, setTitle]       = useState("");
  const [assignee, setAssignee] = useState(currentUser?.id || "");
  const [deadline, setDeadline] = useState("");
  const [companyIds, setCompanyIds] = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const toggleCompany = (id) => {
    setCompanyIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        title:      title.trim(),
        stage:      stageId,
        stageChangedAt: new Date().toISOString(),
        assignee:   assignee || null,
        deadline:   deadline ? new Date(deadline).toISOString() : null,
        companyIds,
        notes:      [],
        campaignId: null,
        createdBy:  currentUser?.id || null,
      });
      onCancel();
    } catch (err) {
      setError(err?.message || "Erro ao criar entrega.");
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
        placeholder="Título da entrega *"
        value={title}
        onChange={e => setTitle(e.target.value)}
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

export function EntregasView({ user, users = [] }) {
  const {
    deliverables,
    loading,
    canWrite,
    createDeliverable,
    changeStage,
  } = useMarketingDeliverables({ userId: user?.id, role: user?.role });

  const usersById = useUsersById(users);

  const [draggedItem, setDraggedItem]     = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [quickAddStage, setQuickAddStage] = useState(null);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedItem || !canWrite) return;
    if (draggedItem.stage !== toStage) {
      await changeStage(draggedItem.id, toStage);
    }
    setDraggedItem(null);
    setDragOverStage(null);
  }, [draggedItem, canWrite, changeStage]);

  const handleQuickAdd = useCallback(async (stageIdOrItem, action) => {
    if (action === "open") {
      setQuickAddStage(stageIdOrItem);
      return;
    }
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
    <div>
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
        {canWrite && (
          <button
            onClick={() => setQuickAddStage("pendente")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#1E4D8C", color: "#FFF", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#163a6b"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#1E4D8C"; }}
          >
            <Plus size={15} />
            Nova entrega
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total",      value: kpis.total },
          { label: "Pendente",   value: kpis.pendente },
          { label: "Produzindo", value: kpis.produzindo },
          { label: "Entregue",   value: kpis.entregue },
        ].map(k => (
          <div
            key={k.label}
            className="rounded-xl border px-4 py-3"
            style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: NEUTRAL.slate }}>
              {k.label}
            </div>
            <div className="text-xl font-bold" style={{ color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-sm text-center py-8" style={{ color: NEUTRAL.slate }}>
          Carregando entregas…
        </div>
      )}

      {!loading && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 520 }}>
          {DELIVERABLE_STAGES.map(stage => {
            const stageItems = deliverables.filter(d => d.stage === stage.id);
            const isDragOver = dragOverStage === stage.id;

            return (
              <div
                key={stage.id}
                className="flex flex-col rounded-2xl min-w-[240px]"
                style={{
                  background:  isDragOver ? "#EFF6FF" : NEUTRAL.lightGray,
                  border:      `1px solid ${isDragOver ? "#1E4D8C" : "#E5E7EB"}`,
                  minHeight:   480,
                  flexShrink:  0,
                  transition:  "background 0.15s, border-color 0.15s",
                  overflow:    "hidden",
                }}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDrop={e => { e.preventDefault(); handleDrop(stage.id); }}
              >
                <div
                  style={{ height: 4, background: stage.color, flexShrink: 0 }}
                />
                <div className="px-3 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "#E5E7EB" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>{stage.name}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: stage.color + "22", color: stage.color }}
                    >
                      {stageItems.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {stageItems.length === 0 && quickAddStage !== stage.id && (
                    <div
                      className="flex items-center justify-center rounded-xl text-xs"
                      style={{
                        height: 80,
                        border: "2px dashed #E5E7EB",
                        color: NEUTRAL.slate,
                        opacity: 0.6,
                      }}
                    >
                      Sem entregas
                    </div>
                  )}

                  {stageItems.map(item => (
                    <DeliverableCard
                      key={item.id}
                      item={item}
                      ownerName={usersById.get(item.assignee)?.name || null}
                      onClick={() => {}}
                      onDragStart={setDraggedItem}
                      stages={DELIVERABLE_STAGES}
                      onMoveToStage={canWrite ? (id, toStage) => changeStage(id, toStage) : null}
                    />
                  ))}

                  {quickAddStage === stage.id ? (
                    <DeliverableCreateForm
                      stageId={stage.id}
                      currentUser={user}
                      users={users}
                      onAdd={handleQuickAdd}
                      onCancel={() => setQuickAddStage(null)}
                    />
                  ) : (
                    canWrite && (
                      <button
                        onClick={() => handleQuickAdd(stage.id, "open")}
                        className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs opacity-0 hover:opacity-100 transition-opacity"
                        style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer" }}
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
      )}
    </div>
  );
}
