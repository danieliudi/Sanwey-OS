import React, { useMemo, useState } from "react";
import {
  Truck, Plus, Trash2, Mail, Phone, Building2, Search,
} from "lucide-react";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { EmptyState } from "../ui/EmptyState";
import { StatCard } from "../ui/StatCard";
import { Modal } from "../ui/Modal";
import { FilterBar } from "../shared/FilterBar";
import { Card, CardGrid, CardSkeleton, GridListToggle } from "../shared/Card";
import { PageHeader } from "../shared/PageHeader";

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
    <Modal open onClose={onClose} title={supplier ? "Editar fornecedor" : "Novo fornecedor"} width={460}>
      <form onSubmit={handleSubmit} className="p-6">
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

        {error && <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</div>}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Delete confirmation modal ───────────────────────────────────── */
function ConfirmDeleteModal({ supplier, onConfirm, onClose }) {
  return (
    <Modal open onClose={onClose} title="Excluir fornecedor?" width={400}>
      <div className="p-6">
        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          "{supplier.name}" será removido. Cotações já enviadas continuam no histórico.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--danger)", color: "#fff" }}>Excluir</button>
        </div>
      </div>
    </Modal>
  );
}

// Cotações agora vivem junto com Compras de Marketing (etapa "Cotação" no
// kanban de ComprasMarketingView) — o fluxo formal antigo por e-mail, com
// aba própria aqui, foi aposentado a pedido do usuário.
export function FornecedoresView({ user }) {
  const { suppliers, loading, canWrite, createSupplier, updateSupplier, deleteSupplier } =
    useMarketingSuppliers({ userId: user?.id, role: user?.role, roles: user?.roles });
  const [editing, setEditing] = useState(null); // supplier | "new" | null
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [density, setDensity] = useState("grid");

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter(s => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (q && !(s.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [suppliers, search, categoryFilter]);

  const filtersActive = Boolean(search.trim()) || categoryFilter !== "all";
  const clearFilters = () => { setSearch(""); setCategoryFilter("all"); };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Truck}
        title="Fornecedores"
        subtitle="Agências, gráficas, confecções e outros parceiros de marketing"
        actions={
          canWrite && (
            <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}>
              <Plus size={14} /> Novo fornecedor
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3" style={{ maxWidth: 280 }}>
        <StatCard icon={Truck} value={suppliers.length} label="Fornecedores" />
      </div>

      <FilterBar
        search={{ value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Buscar fornecedor…" }}
        filters={[{
          id: "category",
          value: categoryFilter,
          onChange: (e) => setCategoryFilter(e.target.value),
          label: "Categoria",
          options: [{ value: "all", label: "Todas as categorias" }, ...CATEGORY_OPTIONS.map(c => ({ value: c.id, label: c.label }))],
        }]}
        trailing={<GridListToggle value={density} onChange={setDensity} />}
      />

      {loading ? (
        <CardGrid density={density}>
          {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} density={density} />)}
        </CardGrid>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nenhum fornecedor cadastrado"
          description="Cadastre agências, gráficas, confecções e outros parceiros de marketing."
          action={canWrite && (
            <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
              <Plus size={14} /> Novo fornecedor
            </button>
          )}
        />
      ) : filteredSuppliers.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum resultado pra estes filtros"
          description="Nenhum fornecedor corresponde à busca ou categoria selecionada. Tente outro termo ou limpe os filtros."
          action={
            <button onClick={clearFilters}
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Limpar filtros
            </button>
          }
        />
      ) : (
        <CardGrid density={density}>
          {filteredSuppliers.map(s => (
            <Card
              key={s.id}
              density={density}
              onClick={canWrite ? () => setEditing(s) : undefined}
              icon={<span style={{ fontSize: density === "list" ? 12 : 15, fontWeight: 700 }}>{(s.name || "").trim().charAt(0).toUpperCase() || "?"}</span>}
              title={s.name}
              meta={CATEGORY_LABELS[s.category] || s.category}
              footer={`${s.companyIds.length} empresa(s) atendida(s)`}
              menu={canWrite && (
                <button onClick={() => setConfirmDelete(s)} aria-label="Excluir fornecedor" style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              )}
            >
              <div className="space-y-1 text-xs" style={{ color: "var(--text-dim)" }}>
                <div className="flex items-center gap-1"><Mail size={10} /> {s.email}</div>
                {s.phone && <div className="flex items-center gap-1"><Phone size={10} /> {s.phone}</div>}
                {s.companyIds.length > 0 && (
                  <div className="flex items-center gap-1"><Building2 size={10} /> {s.companyIds.map(id => COMPANIES[id]?.short || id).join(", ")}</div>
                )}
              </div>
            </Card>
          ))}
        </CardGrid>
      )}

      {editing && (
        <SupplierModal
          supplier={editing === "new" ? null : editing}
          onSave={(form) => editing === "new" ? createSupplier(form) : updateSupplier(editing.id, form)}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          supplier={confirmDelete}
          onConfirm={async () => { await deleteSupplier(confirmDelete.id); setConfirmDelete(null); }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default FornecedoresView;
