import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart, Plus, LayoutGrid, List, CalendarDays as CalendarIcon, TrendingUp,
  ChevronLeft, ChevronRight, ChevronDown, X, XCircle, MessageCircle,
} from "lucide-react";
import { useMarketingPurchaseRequests, PURCHASE_STAGES, PURCHASE_REJECTED_STAGE } from "../../hooks/use-marketing-purchase-requests";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { PurchaseRequestDetailDrawer } from "../campaign/PurchaseRequestDetailDrawer";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { MARKETING_UNIT_IDS, MARKETING_UNIT_LABELS, MARKETING_UNIT_COLORS } from "../../constants/companies";
import { formatK, formatBRL } from "../../utils/currency";
import { stageTextColor } from "../../utils/stage-colors";
import { formatDateBR, parseDateInput } from "../../utils/date";
import { AvatarStack } from "../shared/AvatarStack";
import { MobileTableCards } from "../shared/MobileTableCards";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { CopyPublicLinkButton } from "../shared/CopyPublicLinkButton";
import { terminalCardBackground, terminalTextColor, terminalAccentOpacity } from "../shared/terminal-card-style";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadNotesComment } from "../../lib/comment-badge";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";

const STAGE_COLORS = {
  solicitado:        "#D97706",
  cotacao:           "#CA8A04",
  aprovado:          "#2563EB",
  pedido_fornecedor: "#7C3AED",
  entrega_parcial:   "#0891B2",
  entregue:          "#16A34A",
  pago:              "#15803D",
  rejeitado:         "#DC2626",
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const inputBase = {
  width: "100%", fontSize: 13, borderRadius: 8,
  border: "1px solid var(--border)", padding: "7px 10px",
  background: "var(--surface)", color: "var(--text)", outline: "none",
};

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* ── Kanban card ──────────────────────────────────────────────────────── */
// showMoveOptions=false (board desktop, drag-and-drop já cobre mover): o menu
// "..." fica só com a opção de excluir — vira direto o ícone de lixeira, sem
// dropdown intermediário (ver MoveStageMenu). O acordeão mobile, sem
// drag-and-drop, continua passando showMoveOptions=true (default), único
// jeito de mover um card lá.
function PurchaseKanbanCard({ purchase, supplier, users, onClick, draggable, onDragStart, onDragEnd, stages, onMoveToStage, onDeleteCard, onDuplicateCard, unread, showMoveOptions = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const responsibleIds = purchase.responsibleIds?.length ? purchase.responsibleIds : (purchase.responsibleId ? [purchase.responsibleId] : []);
  const resolvedResponsible = responsibleIds.map(id => users?.find(u => u.id === id)).filter(Boolean);
  const firstResponsible = resolvedResponsible[0];
  // "pago" é a etapa terminal do fluxo de compras (mesmo flag `terminal` das
  // etapas de rh_pipeline_stages) — card lê como arquivado, mesmo tratamento
  // dos outros 4 Kanbans (ver src/components/shared/terminal-card-style.js).
  const currentStage = (stages || PURCHASE_STAGES).find(s => s.id === purchase.stage);
  const isTerminal = Boolean(currentStage?.terminal);
  // Solicitado só avança pra Cotação (comparação de fornecedores); Cotação
  // só avança pra Aprovado (via approvePurchase — mantém approved_by/
  // approved_at corretos, e o vencedor é escolhido no drawer). Pular etapas
  // no menu deixaria a aprovação sem essa decisão registrada. As demais
  // etapas avançam livremente entre si; "pago" (terminal) só por
  // arrastar/drawer, não aparece no menu — mesmo padrão de Entregas/Vagas.
  const moveTargets = !showMoveOptions ? [] : purchase.stage === "solicitado"
    ? (stages || PURCHASE_STAGES).filter(s => s.id === "cotacao")
    : purchase.stage === "cotacao"
    ? (stages || PURCHASE_STAGES).filter(s => s.id === "aprovado")
    : (stages || PURCHASE_STAGES).filter(s => s.id !== purchase.stage && !s.terminal);
  return (
    <div
      draggable={draggable}
      onDragStart={() => draggable && onDragStart?.(purchase)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => { if (!menuOpen) onClick(purchase); }}
      className="p-3.5 rounded-lg cursor-pointer transition-all duration-150"
      style={{ background: terminalCardBackground(isTerminal), border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-pop)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {purchase.requestNumber && (
          <span className="font-mono font-bold text-xs" style={{ color: "var(--accent)", opacity: terminalAccentOpacity(isTerminal) }}>{purchase.requestNumber}</span>
        )}
        <div className="flex items-center gap-1.5 ml-auto" onClick={e => e.stopPropagation()}>
          {unread && (
            <span
              title="Comentário novo"
              className="inline-flex items-center justify-center rounded-full"
              style={{ width: 16, height: 16, background: "var(--accent)", color: "var(--on-accent)", opacity: terminalAccentOpacity(isTerminal) }}
            >
              <MessageCircle size={9} strokeWidth={2.5} fill="currentColor" />
            </span>
          )}
          {purchase.totalValue != null && (
            <span className="text-xs font-bold" style={{ color: terminalTextColor(isTerminal) }}>{formatK(purchase.totalValue)}</span>
          )}
          {((onMoveToStage && moveTargets.length > 0) || onDeleteCard || onDuplicateCard) && (
            <MoveStageMenu
              targets={moveTargets.map(s => {
                const list = stages || PURCHASE_STAGES;
                const dir = list.findIndex(x => x.id === s.id) < list.findIndex(x => x.id === purchase.stage) ? "before" : "after";
                return { key: s.id, name: s.name, color: STAGE_COLORS[s.id], direction: dir };
              })}
              onMove={onMoveToStage ? (key) => onMoveToStage(purchase.id, key) : undefined}
              onOpenChange={setMenuOpen}
              onDelete={onDeleteCard ? () => onDeleteCard(purchase.id) : undefined}
              onDuplicate={onDuplicateCard ? () => onDuplicateCard(purchase.id) : undefined}
            />
          )}
        </div>
      </div>
      <div className="font-semibold text-[13px] leading-snug mb-2" style={{ color: terminalTextColor(isTerminal) }}>
        {purchase.itemName}
      </div>
      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--text-dim)" }}>
        <span className="truncate" style={{ maxWidth: "70%" }}>{supplier?.name || "Sem fornecedor"}</span>
        {purchase.dueDate && (
          // due_date é date-only ("AAAA-MM-DD"); comparar contra o instante
          // atual (new Date()) fazia o item acender vermelho ~21h da véspera
          // (meia-noite UTC vira 21h BRT) e durante todo o próprio dia de
          // vencimento. Agora compara início-do-dia local. Achado da auditoria.
          <span style={{ color: parseDateInput(purchase.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) ? "var(--danger)" : "var(--text-dim)", fontWeight: 500, opacity: terminalAccentOpacity(isTerminal) }}>
            {formatDateBR(purchase.dueDate)}
          </span>
        )}
      </div>
      {resolvedResponsible.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2" style={{ opacity: terminalAccentOpacity(isTerminal) }}>
          <AvatarStack users={resolvedResponsible} size={18} max={2} />
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>{firstResponsible?.name}</span>
        </div>
      )}
    </div>
  );
}

/* ── Create modal (formulário interno, mesmos campos do público) ────── */
function CreateModal({ currentUser, onCreate, onClose }) {
  const [form, setForm] = useState({
    itemName:       "",
    description:    "",
    requesterName:  currentUser?.name || "",
    dueDate:        "",
    companyIds:     currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : [],
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  // Guarda contra descarte acidental: fechar por clique-fora/ESC/Cancelar com
  // o formulário preenchido pede confirmação. Achado da 2ª auditoria.
  const initialSnapshotRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = JSON.stringify(form);
  if (initialSnapshotRef.current === null) initialSnapshotRef.current = stateRef.current;
  const guardedClose = useCallback(() => {
    if (stateRef.current !== initialSnapshotRef.current
        && !window.confirm("Descartar os dados preenchidos? As informações não salvas serão perdidas.")) return;
    onClose();
  }, [onClose]);
  useEscToClose(guardedClose);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleCompany = (id) => setForm(prev => ({
    ...prev,
    companyIds: prev.companyIds.includes(id) ? prev.companyIds.filter(c => c !== id) : [...prev.companyIds, id],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.itemName.trim() || !form.requesterName.trim()) { setError("Item e solicitante são obrigatórios."); return; }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        itemName:       form.itemName.trim(),
        description:    form.description.trim() || null,
        requesterName:  form.requesterName.trim(),
        dueDate:        form.dueDate || null,
        companyIds:     form.companyIds,
        stage:          "solicitado",
        requestedBy:    currentUser?.id || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao criar solicitação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--overlay-scrim)" }}>
      <form onSubmit={handleSubmit} className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: "var(--text)" }}>Nova solicitação de compra</h3>
          <button type="button" onClick={guardedClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Item a comprar *</label>
            <input value={form.itemName} onChange={e => set("itemName", e.target.value)} placeholder="Ex: Brinde personalizado para feira"
              className="w-full text-sm rounded-lg px-3 py-2 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Descrição</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
              className="w-full text-sm rounded-lg px-3 py-2 border resize-none" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Solicitante *</label>
              <input value={form.requesterName} onChange={e => set("requesterName", e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Prazo desejado</label>
              <input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Empresas</label>
            <div className="flex gap-2">
              {MARKETING_UNIT_IDS.map(id => (
                <button key={id} type="button" onClick={() => toggleCompany(id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={form.companyIds.includes(id)
                    ? { background: MARKETING_UNIT_COLORS[id], color: "#fff", borderColor: MARKETING_UNIT_COLORS[id] }
                    : { background: "var(--surface-alt)", color: "var(--text-dim)", borderColor: "var(--border)" }}>
                  {MARKETING_UNIT_LABELS[id] || id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</div>}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={guardedClose} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Criando…" : "Criar solicitação"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Kanban view ──────────────────────────────────────────────────────── */
function KanbanBoard({ purchasesByStage, suppliersById, usersById, users, onCardClick, onDragStart, onDragEnd, onMoveToStage, onDeleteCard, onDuplicateCard, dragOverStage, onColumnDragOver, onColumnDragLeave, onColumnDrop, getUnread, getSortCriteria, setSortCriteria }) {
  const [boardRef, boardHeight] = useAvailableHeight(16);
  return (
    <div className="hidden lg:block relative">
      <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
        <div className="flex gap-2 h-full" style={{ minWidth: `${PURCHASE_STAGES.length * 280}px` }}>
          {PURCHASE_STAGES.map(stage => {
            const color = STAGE_COLORS[stage.id] || "var(--text-dim)";
            const items = purchasesByStage[stage.id] || [];
            const isOver = dragOverStage === stage.id;
            return (
              <div key={stage.id}
                onDragOver={e => onColumnDragOver(e, stage.id)}
                onDragLeave={onColumnDragLeave}
                onDrop={() => onColumnDrop(stage.id)}
                className="flex flex-col rounded-lg transition-all duration-150"
                style={{
                  width: 272,
                  minWidth: 272,
                  height: "100%",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  background: isOver ? color + "14" : "var(--surface-alt)",
                  boxShadow: isOver ? `0 0 0 2px ${color}30` : "none",
                }}>
                <KanbanColumnHeader
                  color={color}
                  name={stage.name}
                  count={items.length}
                  bandHeight={4}
                  letterSpacing="normal"
                  nameColor={color}
                  nameFontSize={14}
                  nameFontWeight={700}
                  uppercase={false}
                  countFontSize={12}
                  truncateName={false}
                  actions={
                    <KanbanColumnSortMenu
                      criteria={getSortCriteria(stage.id)}
                      onChange={(v) => setSortCriteria(stage.id, v)}
                      options={["recent", "deadline", "alpha"]}
                    />
                  }
                />
                <div className="px-2 pt-2 pb-2 flex-1 overflow-y-auto" style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-xs" style={{ color: "var(--text-dim)", opacity: 0.6 }}>
                      {isOver ? "Soltar aqui" : "Nenhuma solicitação"}
                    </div>
                  ) : (
                    items.map(p => (
                      <PurchaseKanbanCard
                        key={p.id}
                        purchase={p}
                        supplier={suppliersById.get(p.supplierId)}
                        users={users}
                        onClick={onCardClick}
                        draggable
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onMoveToStage={onMoveToStage}
                        onDeleteCard={onDeleteCard}
                        onDuplicateCard={onDuplicateCard}
                        showMoveOptions={false}
                        unread={getUnread?.(p)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </KanbanBoardScrollArea>
    </div>
  );
}

function MobileKanban({ purchasesByStage, suppliersById, usersById, users, onCardClick, onMoveToStage, onDeleteCard, onDuplicateCard, getUnread, getSortCriteria, setSortCriteria }) {
  const [expanded, setExpanded] = useState(() => new Set(["solicitado"]));
  const toggle = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="lg:hidden space-y-1.5 pb-8">
      {PURCHASE_STAGES.map(stage => {
        const color = STAGE_COLORS[stage.id] || "var(--text-dim)";
        const items = purchasesByStage[stage.id] || [];
        const isOpen = expanded.has(stage.id);
        return (
          <div key={stage.id} className="rounded-xl overflow-hidden border" style={{ borderColor: color + "28" }}>
            <button className="w-full flex items-center justify-between px-4 py-3 cursor-pointer" style={{ background: color + "12", border: "none" }}
              onClick={() => toggle(stage.id)}>
              <span className="font-bold text-sm" style={{ color }}>{stage.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color }}>{items.length}</span>
                <div onClick={e => e.stopPropagation()}>
                  <KanbanColumnSortMenu
                    criteria={getSortCriteria(stage.id)}
                    onChange={(v) => setSortCriteria(stage.id, v)}
                    options={["recent", "deadline", "alpha"]}
                    accentColor={color}
                  />
                </div>
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", color, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                  <ChevronDown size={13} />
                </div>
              </div>
            </button>
            {isOpen && (
              <div className="p-2.5 space-y-2" style={{ background: "var(--surface-alt)" }}>
                {items.length === 0
                  ? <div className="text-center py-3 text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma solicitação</div>
                  : items.map(p => (
                    <PurchaseKanbanCard key={p.id} purchase={p} supplier={suppliersById.get(p.supplierId)} users={users} onClick={onCardClick} onMoveToStage={onMoveToStage} onDeleteCard={onDeleteCard} onDuplicateCard={onDuplicateCard} unread={getUnread?.(p)} />
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Tabela ───────────────────────────────────────────────────────────── */
function TableView({ purchases, suppliersById, usersById, users, onRowClick }) {
  return (
    <>
    <MobileTableCards
      rows={purchases}
      onRowClick={onRowClick}
      emptyMessage="Nenhuma solicitação encontrada."
      title={(p) => p.itemName}
      chips={(p) => {
        const color = STAGE_COLORS[p.stage] || "var(--text-dim)";
        const stageInfo = PURCHASE_STAGES.find(s => s.id === p.stage) || (p.stage === PURCHASE_REJECTED_STAGE ? { name: "Rejeitado" } : null);
        return [{ label: stageInfo?.name || p.stage, color }];
      }}
      right={(p) => (
        <span className="text-sm font-semibold" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {p.totalValue != null ? formatBRL(p.totalValue) : "—"}
        </span>
      )}
      meta={(p) => [p.requestNumber, suppliersById.get(p.supplierId)?.name].filter(Boolean).join(" · ") || "—"}
      metaRight={(p) => {
        const responsibleIds = p.responsibleIds?.length ? p.responsibleIds : (p.responsibleId ? [p.responsibleId] : []);
        const resolvedResponsible = responsibleIds.map(id => usersById.get(id)).filter(Boolean);
        return (
          <>
            {resolvedResponsible.length > 0 && <AvatarStack users={resolvedResponsible} size={18} max={2} />}
            <span>{formatDateBR(p.dueDate)}</span>
          </>
        );
      }}
    />
    <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Protocolo", "Item", "Fornecedor", "Valor", "Vencimento", "Etapa", "Responsável"].map(h => (
              <th key={h} className={h === "Valor" ? "text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" : "text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide"} style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {purchases.length === 0 && (
            <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhuma solicitação encontrada.</td></tr>
          )}
          {purchases.map(p => {
            const color = STAGE_COLORS[p.stage] || "var(--text-dim)";
            const stageInfo = PURCHASE_STAGES.find(s => s.id === p.stage) || (p.stage === PURCHASE_REJECTED_STAGE ? { name: "Rejeitado" } : null);
            const responsibleIds = p.responsibleIds?.length ? p.responsibleIds : (p.responsibleId ? [p.responsibleId] : []);
            const resolvedResponsible = responsibleIds.map(id => usersById.get(id)).filter(Boolean);
            return (
              <tr key={p.id} onClick={() => onRowClick(p)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: "var(--accent)" }}>{p.requestNumber}</td>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)", maxWidth: 220 }}>
                  <div className="truncate">{p.itemName}</div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{suppliersById.get(p.supplierId)?.name || "—"}</td>
                <td className="px-4 py-3 text-sm font-semibold text-right" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{p.totalValue != null ? formatBRL(p.totalValue) : "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{formatDateBR(p.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: color + "18", color: stageTextColor(color), border: `1px solid ${color}40` }}>
                    {stageInfo?.name || p.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>
                  {resolvedResponsible.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <AvatarStack users={resolvedResponsible} size={18} max={2} />
                      <span>{resolvedResponsible[0].name}</span>
                    </div>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

/* ── Calendário ───────────────────────────────────────────────────────── */
function CalendarView({ purchases, onPillClick }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const p of purchases) {
      if (!p.dueDate) continue;
      // Mesmo bug de fuso do vencido acima: date-only via new Date() cai um
      // dia antes em BRT. parseDateInput constrói meia-noite local.
      const d = parseDateInput(p.dueDate);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    }
    return map;
  }, [purchases]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const today = new Date();
  const month = cursor.getMonth();

  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronRight size={16} />
          </button>
          <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>
            {MONTHS[month]} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{cursor.getFullYear()}</span>
          </h2>
        </div>
        <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          Hoje
        </button>
      </div>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
        {WEEKDAYS.map(w => (
          <div key={w} className="px-2 py-2 text-[10px] font-bold text-center" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(88px, auto)" }}>
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const k = dayKey(d);
          const items = byDay.get(k) || [];
          return (
            <div key={i} className="p-1.5 border-r border-b flex flex-col gap-1"
              style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: inMonth ? 1 : 0.4 }}>
              <span className="text-xs font-semibold leading-none" style={isToday
                ? { width: 20, height: 20, borderRadius: "50%", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "var(--on-accent)" }
                : { color: inMonth ? "var(--text)" : "var(--text-dim)" }}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map(p => {
                  const color = STAGE_COLORS[p.stage] || "var(--text-dim)";
                  return (
                    <span key={p.id} onClick={() => onPillClick(p)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: color + "18", color: stageTextColor(color) }}
                      title={`${p.requestNumber} · ${p.itemName}`}>
                      {p.itemName}
                    </span>
                  );
                })}
                {items.length > 3 && (
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>+{items.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main view ────────────────────────────────────────────────────────── */
export function ComprasMarketingView({ user, users = [], notifyMentions }) {
  const {
    purchases, loading, error,
    createPurchase, updatePurchase, deletePurchase, duplicatePurchase,
    approvePurchase, rejectPurchase, getLastPurchasePrice,
  } = useMarketingPurchaseRequests();

  const { suppliers } = useMarketingSuppliers({ userId: user?.id, role: user?.role, roles: user?.roles });

  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics"
  const [showCreate, setShowCreate] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [stageError, setStageError] = useState(null);

  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);
  const suppliersById = useMemo(() => new Map((suppliers || []).map(s => [s.id, s])), [suppliers]);

  const visiblePurchases = useMemo(() => purchases.filter(p => p.stage !== PURCHASE_REJECTED_STAGE), [purchases]);
  const rejectedPurchases = useMemo(() => purchases.filter(p => p.stage === PURCHASE_REJECTED_STAGE), [purchases]);

  // Ordenar cards dentro de cada coluna — cada etapa guarda seu próprio
  // critério (ver KanbanColumnSortMenu). PURCHASE_STAGES é hardcoded (regra
  // 2 do CLAUDE.md — exceção deliberada de Compras), então o bucket usa
  // stage.id fixo desse array em vez de rh_pipeline_stages.
  const { getCriteria: getSortCriteria, setCriteria: setSortCriteria } = useKanbanColumnSort("marketing-compras");
  const purchasesByStage = useMemo(() => {
    const bucket = Object.create(null);
    for (const s of PURCHASE_STAGES) bucket[s.id] = [];
    for (const p of visiblePurchases) {
      if (bucket[p.stage]) bucket[p.stage].push(p);
    }
    for (const s of PURCHASE_STAGES) {
      bucket[s.id] = sortKanbanItems(bucket[s.id], getSortCriteria(s.id), {
        deadline: p => p.dueDate,
        name: p => p.itemName,
        createdAt: p => p.createdAt,
      });
    }
    return bucket;
  }, [visiblePurchases, getSortCriteria]);

  const purchasesRef = useRef(purchases);
  useEffect(() => { purchasesRef.current = purchases; }, [purchases]);

  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return purchases.find(p => p.id === selected.id) || selected;
  }, [purchases, selected]);

  const { viewedAt: purchaseViewedAt, markViewed: markPurchaseViewed } = useRecordViews("purchase_requests", user?.id);
  const getPurchaseUnread = useCallback((p) => hasUnreadNotesComment(p, purchaseViewedAt, user?.id), [purchaseViewedAt, user?.id]);
  useEffect(() => { if (selected?.id) markPurchaseViewed(selected.id); }, [selected?.id]);

  // Fecha o drawer ao mover de etapa e reabre pouco depois já com a etapa
  // nova — mesmo padrão de EntregasView/MarketingView (reopenAfterMove).
  const reopenAfterStageMove = useCallback((id) => {
    reopenAfterMove(setSelected, () => purchasesRef.current.find(p => p.id === id) || null);
  }, []);

  const handleCreate = useCallback(async (purchase) => { await createPurchase(purchase); }, [createPurchase]);

  // Excluir direto pelo card (menu "..." → lixeira) — deletePurchase já
  // existia no hook (hard delete, RLS permite a qualquer usuário de
  // marketing em qualquer etapa) mas não estava conectado a nenhum lugar da
  // tela; card e drawer não ofereciam exclusão nenhuma até agora.
  const handleDeletePurchase = useCallback(async (id) => {
    setStageError(null);
    try {
      await deletePurchase(id);
      setSelected(prev => (prev?.id === id ? null : prev));
    } catch (err) {
      setStageError(err?.message || "Não foi possível excluir a solicitação.");
    }
  }, [deletePurchase]);

  // Duplicar direto pelo card (menu "..." → Duplicar) — cópia nasce em
  // "solicitado" (1ª etapa), com o usuário atual como novo solicitante; board
  // não abre o drawer da cópia, só some do modal e o card novo aparece na
  // 1ª coluna, igual criação manual.
  const handleDuplicatePurchase = useCallback(async (id) => {
    setStageError(null);
    const source = purchasesRef.current.find(p => p.id === id);
    if (!source) return;
    try {
      await duplicatePurchase(source, user?.id || null);
    } catch (err) {
      setStageError(err?.message || "Não foi possível duplicar a solicitação.");
    }
  }, [duplicatePurchase, user?.id]);

  // "Solicitado" só avança pra "Cotação" (comparar fornecedores, plain
  // update); "Cotação" só avança pra "Aprovado" via approvePurchase (RPC) —
  // grava approved_by/approved_at, o que um updatePurchase direto não faz
  // (o vencedor da cotação normalmente é escolhido no drawer, não aqui).
  // As demais etapas usam updatePurchase normal; "pago" exige nota fiscal
  // (trigger no banco), erro vira mensagem em vez de falhar silencioso.
  const attemptStageChange = useCallback(async (id, toStage) => {
    const purchase = purchasesRef.current.find(p => p.id === id);
    if (!purchase || purchase.stage === toStage) return;
    setStageError(null);
    try {
      if (purchase.stage === "solicitado") {
        if (toStage !== "cotacao") {
          setStageError(`Não dá pra mover "${purchase.itemName}" direto pra essa etapa — passe por Cotação primeiro.`);
          return;
        }
        await updatePurchase(id, { stage: toStage });
      } else if (purchase.stage === "cotacao") {
        if (toStage !== "aprovado") {
          setStageError(`Não dá pra mover "${purchase.itemName}" direto pra essa etapa — aprove a solicitação primeiro.`);
          return;
        }
        // Mesmo gate do drawer (canApproveNow): com cotações registradas, a
        // aprovação exige fornecedor vencedor. O board não tem onde escolher,
        // então abre o drawer pra decisão em vez de aprovar sem vencedor.
        const quoted = Array.isArray(purchase.quoteOptions) ? purchase.quoteOptions.filter(q => q?.supplierId) : [];
        const winnerId = quoted.some(q => q.supplierId === purchase.supplierId) ? purchase.supplierId : null;
        if (quoted.length > 0 && !winnerId) {
          setStageError(`"${purchase.itemName}" tem cotações registradas — escolha o fornecedor vencedor no detalhe pra aprovar.`);
          setSelected(purchase);
          return;
        }
        await approvePurchase(id, user?.id || null, winnerId);
      } else {
        await updatePurchase(id, { stage: toStage });
      }
    } catch (err) {
      setStageError(err?.message || `Não foi possível mover "${purchase.itemName}".`);
    }
  }, [approvePurchase, updatePurchase, user?.id]);

  const handleDragStart = useCallback((item) => setDraggedItem(item), []);
  const handleDragEnd   = useCallback(() => setDraggedItem(null), []);
  const handleColumnDragOver  = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleColumnDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleColumnDrop = useCallback(async (toStage) => {
    setDragOverStage(null);
    if (!draggedItem) return;
    const item = draggedItem;
    setDraggedItem(null);
    if (item.stage !== toStage) await attemptStageChange(item.id, toStage);
  }, [draggedItem, attemptStageChange]);

  const analyticsStages = useMemo(
    () => PURCHASE_STAGES.filter(s => !s.terminal).map(s => ({ key: s.id, name: s.name, color: STAGE_COLORS[s.id], slaDays: s.slaDays })),
    []
  );

  // Tempo médio de aprovação: created_at (nasce em "solicitado") → approved_at
  // (gravado só por approvePurchase/RPC) — só entram solicitações que já
  // passaram por aprovação, "solicitado"/"cotação" ainda abertas não contam.
  const purchaseSpecificStats = useMemo(() => {
    const totalValue = visiblePurchases.reduce((s, p) => s + (p.totalValue || 0), 0);
    const approvedWithDates = visiblePurchases.filter(p => p.approvedAt && p.createdAt);
    const avgApprovalDays = approvedWithDates.length > 0
      ? Math.round(approvedWithDates.reduce((s, p) => s + (new Date(p.approvedAt).getTime() - new Date(p.createdAt).getTime()) / 86400000, 0) / approvedWithDates.length)
      : null;
    return [
      { label: "Valor Total", value: formatK(totalValue) },
      { label: "Tempo médio de aprovação", value: avgApprovalDays !== null ? `${avgApprovalDays}d` : "—" },
    ];
  }, [visiblePurchases]);

  return (
    <div>
      <KanbanBoardHeader className="mb-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <ShoppingCart size={18} />
            </div>
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Compras de Marketing
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)", marginLeft: 48 }}>
            Solicitações de compra de itens prontos (brindes, uniformes, materiais impressos) executadas pelo Marketing
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CopyPublicLinkButton url={`${window.location.origin}/solicitar-compra`} label="Copiar link público" title={`${window.location.origin}/solicitar-compra`} variant="strong" />
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
            <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}  label="Kanban" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "table"}    onClick={() => setViewMode("table")}    icon={List}        label="Tabela" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarIcon} label="Calendário" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "analytics"} onClick={() => setViewMode("analytics")} icon={TrendingUp} label="Análise" iconOnlyMobile />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 font-semibold"
            style={{
              background: "var(--accent)",
              color: "var(--on-accent)",
              border: "none",
              borderRadius: 10,
              padding: "6px 16px",
              fontSize: 13,
              cursor: "pointer",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            <Plus size={14} />
            Nova solicitação
          </button>
        </div>
      </div>
      </KanbanBoardHeader>

      {viewMode === "kanban" && <KanbanFab label="Nova solicitação" onClick={() => setShowCreate(true)} />}

      {/* Rejected strip — tira fina, não uma coluna do kanban */}
      {rejectedPurchases.length > 0 && (
        <div className="mb-4 rounded-xl border" style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)", background: "var(--danger-bg)" }}>
          <button onClick={() => setShowRejected(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer" style={{ background: "none", border: "none" }}>
            <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--danger)" }}>
              <XCircle size={13} />
              {rejectedPurchases.length} solicitaç{rejectedPurchases.length !== 1 ? "ões" : "ão"} rejeitada{rejectedPurchases.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-semibold" style={{ color: "var(--danger)" }}>{showRejected ? "Ocultar" : "Ver"}</span>
          </button>
          {showRejected && (
            <div className="px-4 pb-3 space-y-1.5">
              {rejectedPurchases.map(p => (
                <div key={p.id} onClick={() => setSelected(p)}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-lg cursor-pointer"
                  style={{ background: "var(--surface)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}>
                  <span>
                    <span className="font-mono font-bold mr-1.5" style={{ color: "var(--danger)" }}>{p.requestNumber}</span>
                    {p.itemName}
                  </span>
                  <span style={{ color: "var(--text-dim)" }}>{formatDateBR(p.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</div>
      )}

      {stageError && (
        <div className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>{stageError}</div>
      )}

      {loading ? (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando solicitações…</div>
      ) : viewMode === "kanban" ? (
        <>
          <MobileKanban purchasesByStage={purchasesByStage} suppliersById={suppliersById} usersById={usersById} users={users} onCardClick={setSelected} onMoveToStage={attemptStageChange} onDeleteCard={handleDeletePurchase} onDuplicateCard={handleDuplicatePurchase} getUnread={getPurchaseUnread} getSortCriteria={getSortCriteria} setSortCriteria={setSortCriteria} />
          <KanbanBoard
            purchasesByStage={purchasesByStage} suppliersById={suppliersById} usersById={usersById} users={users} onCardClick={setSelected}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onMoveToStage={attemptStageChange}
            onDeleteCard={handleDeletePurchase}
            onDuplicateCard={handleDuplicatePurchase}
            dragOverStage={dragOverStage}
            onColumnDragOver={handleColumnDragOver}
            onColumnDragLeave={handleColumnDragLeave}
            onColumnDrop={handleColumnDrop}
            getUnread={getPurchaseUnread}
            getSortCriteria={getSortCriteria}
            setSortCriteria={setSortCriteria}
          />
        </>
      ) : viewMode === "table" ? (
        <TableView purchases={visiblePurchases} suppliersById={suppliersById} usersById={usersById} onRowClick={setSelected} />
      ) : viewMode === "analytics" ? (
        <KanbanAnalyticsPanel
          stages={analyticsStages}
          records={visiblePurchases}
          getStageKey={p => p.stage}
          getStageEnteredAt={p => p.stageChangedAt}
          specificStats={purchaseSpecificStats}
          getOwnerIds={p => p.responsibleIds?.length ? p.responsibleIds : (p.responsibleId ? [p.responsibleId] : [])}
          usersById={usersById}
        />
      ) : (
        <CalendarView purchases={visiblePurchases} onPillClick={setSelected} />
      )}

      {showCreate && (
        <CreateModal currentUser={user} onCreate={handleCreate} onClose={() => setShowCreate(false)} />
      )}

      {syncSelected && (
        <PurchaseRequestDetailDrawer
          purchase={syncSelected}
          onClose={() => setSelected(null)}
          onUpdate={updatePurchase}
          onStageMoved={reopenAfterStageMove}
          approvePurchase={approvePurchase}
          rejectPurchase={rejectPurchase}
          getLastPurchasePrice={getLastPurchasePrice}
          suppliers={suppliers}
          users={users}
          currentUser={user}
          notifyMentions={notifyMentions}
        />
      )}
    </div>
  );
}

export default ComprasMarketingView;
