import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart, Plus, LayoutGrid, List, CalendarDays as CalendarIcon,
  ChevronLeft, ChevronRight, Copy, X, XCircle, Check,
} from "lucide-react";
import { useMarketingPurchaseRequests, PURCHASE_STAGES, PURCHASE_REJECTED_STAGE } from "../../hooks/use-marketing-purchase-requests";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { PurchaseRequestDetailDrawer } from "../campaign/PurchaseRequestDetailDrawer";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";
import { EmptyState } from "../ui/EmptyState";

const STAGE_COLORS = {
  solicitado:        "#D97706",
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
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

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

/* ── View toggle button (Kanban/Tabela/Calendário) ───────────────────── */
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
        border: "none",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

/* ── Copy public link ────────────────────────────────────────────────── */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/solicitar-compra`;
  const handleCopy = () => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title={url}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
      style={{
        background: copied ? "#DCFCE7" : "var(--surface)",
        borderColor: copied ? "#BBF7D0" : "var(--border)",
        color: copied ? "#15803D" : "var(--text-dim)",
        cursor: "pointer",
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Link copiado!" : "Copiar link público"}
    </button>
  );
}

/* ── Kanban card ──────────────────────────────────────────────────────── */
function PurchaseKanbanCard({ purchase, supplier, responsibleUser, onClick }) {
  return (
    <div
      onClick={() => onClick(purchase)}
      className="p-3.5 rounded-lg cursor-pointer transition-all duration-150"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-pop)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {purchase.requestNumber && (
          <span className="font-mono font-bold text-xs" style={{ color: "var(--accent)" }}>{purchase.requestNumber}</span>
        )}
        {purchase.totalValue != null && (
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{formatK(purchase.totalValue)}</span>
        )}
      </div>
      <div className="font-semibold text-[13px] leading-snug mb-2" style={{ color: "var(--text)" }}>
        {purchase.itemName}
      </div>
      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--text-dim)" }}>
        <span className="truncate" style={{ maxWidth: "70%" }}>{supplier?.name || "Sem fornecedor"}</span>
        {purchase.dueDate && (
          <span style={{ color: new Date(purchase.dueDate) < new Date() ? "#DC2626" : "var(--text-dim)", fontWeight: 500 }}>
            {formatDateBR(purchase.dueDate)}
          </span>
        )}
      </div>
      {responsibleUser && (
        <div className="flex items-center gap-1.5 mt-2">
          <div
            className="flex items-center justify-center rounded-full font-bold shrink-0"
            style={{ width: 18, height: 18, fontSize: 9, background: responsibleUser.avatarBg || "#1D4ED8", color: "#FFF" }}
          >
            {responsibleUser.initials || "?"}
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>{responsibleUser.name}</span>
        </div>
      )}
    </div>
  );
}

/* ── Create modal (formulário interno, mesmos campos do público) ────── */
function CreateModal({ currentUser, onCreate, onClose }) {
  useEscToClose(onClose);
  const [form, setForm] = useState({
    itemName:       "",
    description:    "",
    requesterName:  currentUser?.name || "",
    requesterEmail: currentUser?.email || "",
    requesterPhone: "",
    dueDate:        "",
    companyIds:     currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : [],
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

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
        requesterEmail: form.requesterEmail.trim() || null,
        requesterPhone: form.requesterPhone.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: "var(--text)" }}>Nova solicitação de compra</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>E-mail</label>
              <input type="email" value={form.requesterEmail} onChange={e => set("requesterEmail", e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Telefone</label>
              <input value={form.requesterPhone} onChange={e => set("requesterPhone", e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Empresas</label>
            <div className="flex gap-2">
              {COMPANY_IDS.map(id => (
                <button key={id} type="button" onClick={() => toggleCompany(id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                  style={form.companyIds.includes(id)
                    ? { background: COMPANIES[id]?.primary, color: "#fff", borderColor: COMPANIES[id]?.primary }
                    : { background: "var(--surface-alt)", color: "var(--text-dim)", borderColor: "var(--border)" }}>
                  {COMPANIES[id]?.short || id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{error}</div>}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Criando…" : "Criar solicitação"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Kanban view ──────────────────────────────────────────────────────── */
function KanbanBoard({ purchases, suppliersById, usersById, onCardClick }) {
  return (
    <div className="hidden lg:block relative">
      <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
        <div className="flex gap-3" style={{ minWidth: `${PURCHASE_STAGES.length * 260}px` }}>
          {PURCHASE_STAGES.map(stage => {
            const color = STAGE_COLORS[stage.id] || "var(--text-dim)";
            const items = purchases.filter(p => p.stage === stage.id);
            return (
              <div key={stage.id}
                className="flex flex-col rounded-xl border overflow-hidden"
                style={{ width: 252, minWidth: 252, background: "var(--surface-alt)", borderColor: "var(--border)", minHeight: 420, flexShrink: 0 }}>
                <div style={{ height: 6, background: color, flexShrink: 0 }} />
                <div className="px-3.5 pt-3 pb-2.5" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                  <div className="font-semibold flex items-center gap-1.5" style={{ color: "var(--text)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {stage.name}
                    <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>({items.length})</span>
                  </div>
                </div>
                <div className="px-2 pt-2 pb-2 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: "62vh" }}>
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-xs" style={{ color: "var(--text-dim)", opacity: 0.6 }}>
                      Nenhuma solicitação
                    </div>
                  ) : (
                    items.map(p => (
                      <PurchaseKanbanCard
                        key={p.id}
                        purchase={p}
                        supplier={suppliersById.get(p.supplierId)}
                        responsibleUser={usersById.get(p.responsibleId)}
                        onClick={onCardClick}
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
  );
}

function MobileKanban({ purchases, suppliersById, usersById, onCardClick }) {
  const [expanded, setExpanded] = useState(() => new Set(["solicitado"]));
  const toggle = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="lg:hidden space-y-1.5 pb-8">
      {PURCHASE_STAGES.map(stage => {
        const color = STAGE_COLORS[stage.id] || "var(--text-dim)";
        const items = purchases.filter(p => p.stage === stage.id);
        const isOpen = expanded.has(stage.id);
        return (
          <div key={stage.id} className="rounded-xl overflow-hidden border" style={{ borderColor: color + "28" }}>
            <button className="w-full flex items-center justify-between px-4 py-3 cursor-pointer" style={{ background: color + "12", border: "none" }}
              onClick={() => toggle(stage.id)}>
              <span className="font-bold text-sm" style={{ color }}>{stage.name}</span>
              <span className="font-bold text-sm" style={{ color }}>{items.length}</span>
            </button>
            {isOpen && (
              <div className="p-2.5 space-y-2" style={{ background: "var(--surface-alt)" }}>
                {items.length === 0
                  ? <div className="text-center py-3 text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma solicitação</div>
                  : items.map(p => (
                    <PurchaseKanbanCard key={p.id} purchase={p} supplier={suppliersById.get(p.supplierId)} responsibleUser={usersById.get(p.responsibleId)} onClick={onCardClick} />
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
function TableView({ purchases, suppliersById, usersById, onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Protocolo", "Item", "Fornecedor", "Valor", "Vencimento", "Etapa", "Responsável"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
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
            const responsible = usersById.get(p.responsibleId);
            return (
              <tr key={p.id} onClick={() => onRowClick(p)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: "var(--accent)" }}>{p.requestNumber}</td>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)", maxWidth: 220 }}>
                  <div className="truncate">{p.itemName}</div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{suppliersById.get(p.supplierId)?.name || "—"}</td>
                <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text)" }}>{p.totalValue != null ? formatK(p.totalValue) : "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{formatDateBR(p.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: color + "18", color, border: `1px solid ${color}40` }}>
                    {stageInfo?.name || p.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{responsible?.name || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
      const d = new Date(p.dueDate.slice ? p.dueDate.slice(0, 10) : p.dueDate);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    }
    return map;
  }, [purchases]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
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
          <div key={w} className="px-2 py-2 text-[10px] font-bold uppercase text-center" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>{w}</div>
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
              style={{ borderColor: "#F0F0F0", background: isToday ? "#FFFBEB" : "var(--surface)", opacity: inMonth ? 1 : 0.4 }}>
              <span className="text-xs font-semibold leading-none" style={{ color: isToday ? "var(--warning)" : inMonth ? "var(--text)" : "var(--text-dim)" }}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map(p => {
                  const color = STAGE_COLORS[p.stage] || "var(--text-dim)";
                  return (
                    <span key={p.id} onClick={() => onPillClick(p)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: color + "18", color }}
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
    createPurchase, updatePurchase,
    approvePurchase, rejectPurchase, getLastPurchasePrice,
  } = useMarketingPurchaseRequests();

  const { suppliers } = useMarketingSuppliers({ userId: user?.id, role: user?.role });

  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table" | "calendar"
  const [showCreate, setShowCreate] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [selected, setSelected] = useState(null);

  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);
  const suppliersById = useMemo(() => new Map((suppliers || []).map(s => [s.id, s])), [suppliers]);

  const visiblePurchases = useMemo(() => purchases.filter(p => p.stage !== PURCHASE_REJECTED_STAGE), [purchases]);
  const rejectedPurchases = useMemo(() => purchases.filter(p => p.stage === PURCHASE_REJECTED_STAGE), [purchases]);

  const purchasesRef = useRef(purchases);
  useEffect(() => { purchasesRef.current = purchases; }, [purchases]);

  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return purchases.find(p => p.id === selected.id) || selected;
  }, [purchases, selected]);

  // Fecha o drawer ao mover de etapa e reabre pouco depois já com a etapa
  // nova — mesmo padrão de EntregasView/MarketingView (reopenAfterMove).
  const reopenAfterStageMove = useCallback((id) => {
    reopenAfterMove(setSelected, () => purchasesRef.current.find(p => p.id === id) || null);
  }, []);

  const handleCreate = useCallback(async (purchase) => { await createPurchase(purchase); }, [createPurchase]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Compras de Marketing
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Solicitações de compra de itens prontos (brindes, uniformes, materiais impressos) executadas pelo Marketing
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CopyLinkButton />
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
            <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}  label="Kanban" />
            <ViewToggleButton active={viewMode === "table"}    onClick={() => setViewMode("table")}    icon={List}        label="Tabela" />
            <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarIcon} label="Calendário" />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#FFF", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            <Plus size={15} />
            Nova solicitação
          </button>
        </div>
      </div>

      {/* Rejected strip — tira fina, não uma coluna do kanban */}
      {rejectedPurchases.length > 0 && (
        <div className="mb-4 rounded-xl border" style={{ borderColor: "#FECACA", background: "#FEF2F2" }}>
          <button onClick={() => setShowRejected(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer" style={{ background: "none", border: "none" }}>
            <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#B91C1C" }}>
              <XCircle size={13} />
              {rejectedPurchases.length} solicitação{rejectedPurchases.length !== 1 ? "ões" : ""} rejeitada{rejectedPurchases.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-semibold" style={{ color: "#B91C1C" }}>{showRejected ? "Ocultar" : "Ver"}</span>
          </button>
          {showRejected && (
            <div className="px-4 pb-3 space-y-1.5">
              {rejectedPurchases.map(p => (
                <div key={p.id} onClick={() => setSelected(p)}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-lg cursor-pointer"
                  style={{ background: "var(--surface)", border: "1px solid #FECACA" }}>
                  <span>
                    <span className="font-mono font-bold mr-1.5" style={{ color: "#B91C1C" }}>{p.requestNumber}</span>
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
        <div className="text-sm px-4 py-3 rounded-xl mb-4" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando solicitações…</div>
      ) : visiblePurchases.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Nenhuma solicitação de compra" description="Solicitações enviadas pelo link público ou criadas internamente aparecerão aqui." />
      ) : viewMode === "kanban" ? (
        <>
          <MobileKanban purchases={visiblePurchases} suppliersById={suppliersById} usersById={usersById} onCardClick={setSelected} />
          <KanbanBoard purchases={visiblePurchases} suppliersById={suppliersById} usersById={usersById} onCardClick={setSelected} />
        </>
      ) : viewMode === "table" ? (
        <TableView purchases={visiblePurchases} suppliersById={suppliersById} usersById={usersById} onRowClick={setSelected} />
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
