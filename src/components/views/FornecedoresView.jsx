import React, { useMemo, useState } from "react";
import {
  Truck, Plus, Pencil, Trash2, Mail, Phone, Building2,
} from "lucide-react";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { EmptyState } from "../ui/EmptyState";

const CATEGORY_LABELS = {
  agencia: "Agência",
  grafica: "Gráfica",
  confeccao: "Confecção",
  stand_feira: "Stand de Feira",
  outro: "Outro",
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }));

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--overlay-scrim)" }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--overlay-scrim)" }}
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

// Cotações agora vivem junto com Compras de Marketing (etapa "Cotação" no
// kanban de ComprasMarketingView) — o fluxo formal antigo por e-mail, com
// aba própria aqui, foi aposentado a pedido do usuário.
export function FornecedoresView({ user }) {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>Fornecedores</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
          Agências, gráficas, confecções e outros parceiros de marketing
        </p>
      </div>

      <SuppliersTab user={user} />
    </div>
  );
}

export default FornecedoresView;
