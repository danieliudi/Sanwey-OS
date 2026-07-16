import React, { useMemo, useState } from "react";
import {
  Truck, Plus, Pencil, Trash2, Mail, Phone, Building2, CheckCircle2, XCircle,
  Clock, Send, AlertCircle, FileText, Settings2, RefreshCw,
} from "lucide-react";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { useMarketingQuotes } from "../../hooks/use-marketing-quotes";
import { useMarketingQuoteTemplate } from "../../hooks/use-marketing-quote-template";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { CurrencyInput } from "../ui/CurrencyInput";
import { formatDateBR } from "../../utils/date";
import { formatBRL } from "../../utils/currency";
import { EmptyState } from "../ui/EmptyState";

const CATEGORY_LABELS = {
  agencia: "Agência",
  grafica: "Gráfica",
  confeccao: "Confecção",
  stand_feira: "Stand de Feira",
  outro: "Outro",
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }));

const QUOTE_STATUS_CONFIG = {
  pendente:   { label: "Pendente",   color: "#D97706", bg: "#FEF3C7", icon: Clock },
  aprovada:   { label: "Aprovada",   color: "#16A34A", bg: "#DCFCE7", icon: CheckCircle2 },
  rejeitada:  { label: "Rejeitada",  color: "#DC2626", bg: "#FEE2E2", icon: XCircle },
  enviada:    { label: "Enviada",    color: "#2563EB", bg: "#DBEAFE", icon: Send },
  respondida: { label: "Respondida", color: "#7C3AED", bg: "#EDE9FE", icon: FileText },
};

function StatusBadge({ status }) {
  const cfg = QUOTE_STATUS_CONFIG[status] || QUOTE_STATUS_CONFIG.pendente;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

/* ── Supplier form modal ─────────────────────────────────────────── */
function SupplierModal({ supplier, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: supplier?.name || "",
    category: supplier?.category || "outro",
    contactName: supplier?.contactName || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    notes: supplier?.notes || "",
    companyIds: supplier?.companyIds || [],
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEscToClose(onClose);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleCompany = (id) => setForm(prev => ({
    ...prev,
    companyIds: prev.companyIds.includes(id) ? prev.companyIds.filter(c => c !== id) : [...prev.companyIds, id],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError("Nome e e-mail são obrigatórios."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao salvar fornecedor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <h3 className="font-bold text-base mb-4" style={{ color: "var(--text)" }}>
          {supplier ? "Editar fornecedor" : "Novo fornecedor"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Nome *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Categoria</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}>
              {CATEGORY_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>E-mail *</label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Contato</label>
              <input value={form.contactName} onChange={e => set("contactName", e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
                style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Telefone</label>
              <input value={form.phone} onChange={e => set("phone", e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
                style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Empresas atendidas</label>
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
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Observações</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
              className="w-full text-sm rounded-lg px-3 py-2 border resize-none"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
          </div>
        </div>

        {error && <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{error}</div>}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Suppliers tab ───────────────────────────────────────────────── */
function SuppliersTab({ user }) {
  const { suppliers, loading, canWrite, createSupplier, updateSupplier, deleteSupplier } =
    useMarketingSuppliers({ userId: user?.id, role: user?.role, roles: user?.roles });
  const [editing, setEditing] = useState(null); // supplier | "new" | null
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="flex justify-end">
          <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}>
            <Plus size={13} /> Novo fornecedor
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--text-dim)" }}>Carregando fornecedores…</div>
      ) : suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="Nenhum fornecedor cadastrado" description="Cadastre agências, gráficas, confecções e outros parceiros de marketing." />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {suppliers.map(s => (
            <div key={s.id} className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{s.name}</div>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                    {CATEGORY_LABELS[s.category] || s.category}
                  </span>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing(s)} style={{ color: "var(--text-dim)" }}><Pencil size={13} /></button>
                    <button onClick={() => setConfirmDelete(s)} style={{ color: "#DC2626" }}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-dim)" }}>
                <div className="flex items-center gap-1"><Mail size={10} /> {s.email}</div>
                {s.phone && <div className="flex items-center gap-1"><Phone size={10} /> {s.phone}</div>}
                {s.companyIds.length > 0 && (
                  <div className="flex items-center gap-1"><Building2 size={10} /> {s.companyIds.map(id => COMPANIES[id]?.short || id).join(", ")}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SupplierModal
          supplier={editing === "new" ? null : editing}
          onSave={(form) => editing === "new" ? createSupplier(form) : updateSupplier(editing.id, form)}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
            <h3 className="font-bold text-base mb-2" style={{ color: "var(--text)" }}>Excluir fornecedor?</h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
              "{confirmDelete.name}" será removido. Cotações já enviadas continuam no histórico.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
              <button onClick={async () => { await deleteSupplier(confirmDelete.id); setConfirmDelete(null); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#DC2626", color: "#fff" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── New quote modal ─────────────────────────────────────────────── */
function NewQuoteModal({ suppliers, onSave, onClose }) {
  const [form, setForm] = useState({ supplierId: suppliers[0]?.id || "", title: "", description: "", deadline: "", companyIds: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEscToClose(onClose);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleCompany = (id) => setForm(prev => ({
    ...prev, companyIds: prev.companyIds.includes(id) ? prev.companyIds.filter(c => c !== id) : [...prev.companyIds, id],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId || !form.title.trim()) { setError("Fornecedor e título são obrigatórios."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, deadline: form.deadline || null });
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao criar cotação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <h3 className="font-bold text-base mb-4" style={{ color: "var(--text)" }}>Nova solicitação de cotação</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Fornecedor *</label>
            <select value={form.supplierId} onChange={e => set("supplierId", e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({CATEGORY_LABELS[s.category]})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Título *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ex: Banner para feira X"
              className="w-full text-sm rounded-lg px-3 py-2 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Descrição / itens</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
              className="w-full text-sm rounded-lg px-3 py-2 border resize-none" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Prazo desejado</label>
            <input type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
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
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Enviando…" : "Criar solicitação"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Reject quote modal ──────────────────────────────────────────── */
function RejectQuoteModal({ quote, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEscToClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <h3 className="font-bold text-base mb-1" style={{ color: "var(--text)" }}>Rejeitar cotação</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>"{quote.title}"</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Motivo (opcional)…"
          className="w-full text-sm rounded-lg px-3 py-2 resize-none border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button onClick={async () => { setSaving(true); await onConfirm(reason); }} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#DC2626", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Rejeitando…" : "Confirmar rejeição"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Record response modal ───────────────────────────────────────── */
function RecordResponseModal({ quote, onConfirm, onClose }) {
  const [notes, setNotes] = useState("");
  const [value, setValue] = useState(null);
  const [saving, setSaving] = useState(false);
  useEscToClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <h3 className="font-bold text-base mb-1" style={{ color: "var(--text)" }}>Registrar resposta do fornecedor</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>"{quote.title}"</p>
        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Valor cotado (opcional)</label>
        <CurrencyInput value={value} onChange={setValue} placeholder="0,00"
          style={{ width: "100%", fontSize: 14, borderRadius: 8, padding: "8px 12px", border: "1px solid var(--border)", background: "var(--surface-alt)", color: "var(--text)", marginBottom: 12 }} />
        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Observações</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Prazo de entrega, condições, etc."
          className="w-full text-sm rounded-lg px-3 py-2 resize-none border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button onClick={async () => { setSaving(true); await onConfirm({ notes, value }); }} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Template editor modal ───────────────────────────────────────── */
function TemplateModal({ template, onSave, onClose }) {
  const [subject, setSubject] = useState(template?.subject || "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml || "");
  const [saving, setSaving] = useState(false);
  useEscToClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-6 w-full max-w-2xl" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <h3 className="font-bold text-base mb-1" style={{ color: "var(--text)" }}>Template do e-mail de cotação</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
          Campos disponíveis: {"{{SUPPLIER_NAME}}"}, {"{{TITLE}}"}, {"{{DESCRIPTION}}"}, {"{{DEADLINE}}"}, {"{{REQUESTED_BY}}"}, {"{{COMPANY_NAMES}}"}
        </p>
        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Assunto</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border mb-3"
          style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Corpo (HTML)</label>
        <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} rows={10}
          className="w-full text-xs font-mono rounded-lg px-3 py-2 border resize-y" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }} />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button onClick={async () => { setSaving(true); await onSave({ subject, bodyHtml }); setSaving(false); onClose(); }} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar template"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Quote card ───────────────────────────────────────────────────── */
function QuoteCard({ quote, canApprove, sending, onApprove, onReject, onResend, onRecordResponse }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusBadge status={quote.status} />
          </div>
          <h3 className="font-semibold text-sm leading-snug mb-1" style={{ color: "var(--text)" }}>{quote.title}</h3>
          <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: "var(--text-dim)" }}>
            <span className="font-medium" style={{ color: "var(--text)" }}>{quote.supplier?.name || "—"}</span>
            {quote.deadline && <span>Prazo: {formatDateBR(quote.deadline)}</span>}
            {quote.companyIds?.length > 0 && (
              <span className="flex items-center gap-1"><Building2 size={10} /> {quote.companyIds.map(id => COMPANIES[id]?.short || id).join(", ")}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canApprove && quote.status === "pendente" && (
            <>
              <button onClick={() => onApprove(quote)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "#DCFCE7", color: "#15803D" }}>
                <CheckCircle2 size={13} /> Aprovar e enviar
              </button>
              <button onClick={() => onReject(quote)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "#FEE2E2", color: "#DC2626" }}>
                <XCircle size={13} /> Rejeitar
              </button>
            </>
          )}
          {canApprove && quote.status === "aprovada" && quote.emailError && (
            <button onClick={() => onResend(quote)} disabled={sending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "#FEF3C7", color: "#D97706" }}>
              <RefreshCw size={13} /> {sending ? "Enviando…" : "Tentar enviar de novo"}
            </button>
          )}
          {quote.status === "enviada" && (
            <button onClick={() => onRecordResponse(quote)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--surface-alt)", color: "var(--text)" }}>
              <FileText size={13} /> Registrar resposta
            </button>
          )}
        </div>
      </div>

      {quote.description && (
        <p className="mt-2 text-sm" style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{quote.description}</p>
      )}

      {quote.status === "rejeitada" && quote.rejectedReason && (
        <div className="mt-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
          <strong>Motivo:</strong> {quote.rejectedReason}
        </div>
      )}

      {quote.status === "aprovada" && quote.emailError && (
        <div className="mt-2 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5" style={{ background: "#FEF3C7", color: "#92400E" }}>
          <AlertCircle size={12} /> Falha ao enviar e-mail: {quote.emailError}
        </div>
      )}

      {quote.status === "respondida" && (
        <div className="mt-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#EDE9FE", color: "#5B21B6" }}>
          {quote.responseValue != null && <strong>{formatBRL(quote.responseValue)}</strong>}
          {quote.responseNotes && <span> — {quote.responseNotes}</span>}
        </div>
      )}

      <div className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
        Criada em {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("pt-BR") : "—"}
        {quote.sentAt && <> · Enviada em {new Date(quote.sentAt).toLocaleDateString("pt-BR")}</>}
      </div>
    </div>
  );
}

/* ── Quotes tab ───────────────────────────────────────────────────── */
function QuotesTab({ user }) {
  const { suppliers } = useMarketingSuppliers({ userId: user?.id, role: user?.role, roles: user?.roles });
  const {
    quotes, loading, error, canWrite, canApprove, sendingId,
    createQuote, approveAndSendQuote, resendQuoteEmail, rejectQuote, recordResponse,
  } = useMarketingQuotes({ userId: user?.id, role: user?.role, roles: user?.roles });
  const { template, saveTemplate } = useMarketingQuoteTemplate({ enabled: canApprove });

  const [statusFilter, setStatusFilter] = useState("pendente");
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [rejectingQuote, setRejectingQuote] = useState(null);
  const [respondingQuote, setRespondingQuote] = useState(null);
  const [actionError, setActionError] = useState(null);

  const filtered = useMemo(() => statusFilter === "all" ? quotes : quotes.filter(q => q.status === statusFilter), [quotes, statusFilter]);
  const counts = useMemo(() => ({
    pendente: quotes.filter(q => q.status === "pendente").length,
    aprovada: quotes.filter(q => q.status === "aprovada").length,
    enviada: quotes.filter(q => q.status === "enviada").length,
    respondida: quotes.filter(q => q.status === "respondida").length,
  }), [quotes]);

  const handleApprove = async (quote) => {
    setActionError(null);
    const res = await approveAndSendQuote(quote.id);
    if (!res.ok) setActionError(`Cotação aprovada, mas o e-mail não pôde ser enviado: ${res.error}`);
  };

  const handleResend = async (quote) => {
    setActionError(null);
    const res = await resendQuoteEmail(quote.id);
    if (!res.ok) setActionError(`Falha ao enviar e-mail: ${res.error}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { id: "pendente", label: "Pendentes", count: counts.pendente },
            { id: "aprovada", label: "Aprovadas", count: counts.aprovada },
            { id: "enviada", label: "Enviadas", count: counts.enviada },
            { id: "respondida", label: "Respondidas", count: counts.respondida },
            { id: "all", label: "Todas", count: quotes.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={statusFilter === tab.id ? { background: "var(--accent)", color: "#fff" } : { background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
              {tab.label}
              <span className="text-xs px-1.5 rounded-full font-bold" style={statusFilter === tab.id ? { background: "rgba(255,255,255,0.25)", color: "#fff" } : { background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {canApprove && (
            <button onClick={() => setShowTemplate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
              <Settings2 size={13} /> Template
            </button>
          )}
          {canWrite && suppliers.length > 0 && (
            <button onClick={() => setShowNewQuote(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
              <Plus size={13} /> Nova cotação
            </button>
          )}
        </div>
      </div>

      {canWrite && suppliers.length === 0 && (
        <div className="text-sm px-4 py-3 rounded-xl" style={{ background: "#FEF3C7", color: "#92400E" }}>
          Cadastre ao menos um fornecedor na aba "Fornecedores" antes de criar uma solicitação de cotação.
        </div>
      )}

      {(error || actionError) && (
        <div className="text-sm px-4 py-3 rounded-xl" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{error || actionError}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--text-dim)" }}>Carregando cotações…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Send} title="Nenhuma cotação encontrada" description="Solicitações de cotação enviadas a fornecedores aparecerão aqui." />
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <QuoteCard
              key={q.id}
              quote={q}
              canApprove={canApprove}
              sending={sendingId === q.id}
              onApprove={handleApprove}
              onReject={(quote) => { setActionError(null); setRejectingQuote(quote); }}
              onResend={handleResend}
              onRecordResponse={(quote) => setRespondingQuote(quote)}
            />
          ))}
        </div>
      )}

      {showNewQuote && (
        <NewQuoteModal suppliers={suppliers} onSave={(form) => createQuote(form)} onClose={() => setShowNewQuote(false)} />
      )}
      {showTemplate && (
        <TemplateModal template={template} onSave={(t) => saveTemplate(t, user?.id)} onClose={() => setShowTemplate(false)} />
      )}
      {rejectingQuote && (
        <RejectQuoteModal
          quote={rejectingQuote}
          onConfirm={async (reason) => {
            const res = await rejectQuote(rejectingQuote.id, reason);
            if (!res.ok) setActionError(res.error);
            setRejectingQuote(null);
          }}
          onClose={() => setRejectingQuote(null)}
        />
      )}
      {respondingQuote && (
        <RecordResponseModal
          quote={respondingQuote}
          onConfirm={async ({ notes, value }) => { await recordResponse(respondingQuote.id, { notes, value }); setRespondingQuote(null); }}
          onClose={() => setRespondingQuote(null)}
        />
      )}
    </div>
  );
}

/* ── Main view ────────────────────────────────────────────────────── */
export function FornecedoresView({ user }) {
  const [tab, setTab] = useState("fornecedores");

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>Fornecedores</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
          Agências, gráficas, confecções e outros parceiros de marketing — cadastro e cotações
        </p>
      </div>

      <div className="flex items-center gap-1">
        {[{ id: "fornecedores", label: "Fornecedores" }, { id: "cotacoes", label: "Cotações" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={tab === t.id ? { background: "var(--accent)", color: "#fff" } : { background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fornecedores" ? <SuppliersTab user={user} /> : <QuotesTab user={user} />}
    </div>
  );
}

export default FornecedoresView;
