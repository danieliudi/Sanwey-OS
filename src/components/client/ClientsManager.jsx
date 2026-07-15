import React, { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Users, X, Database } from "lucide-react";
import { Modal } from "../ui/Modal";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { CLIENT_CATEGORIES, clientCategoryLabel, clientCategoryColor } from "../../constants/client-categories";
import { formatDateBR } from "../../utils/date";

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const EMPTY = { name: "", category: "", city: "", state: "", cnpj: "", companyIds: [], notes: "" };

function CategoryTag({ value }) {
  if (!value) return <span style={{ color: "#9CA3AF" }}>—</span>;
  const color = clientCategoryColor(value);
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + "1A", color }}>
      {clientCategoryLabel(value)}
    </span>
  );
}

export function ClientsManager({ clients = [], loading, leads = [], onCreate, onUpdate, onDelete, canDelete, onOpenImport }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = novo, obj = editando
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  // Empresas que realmente já venderam pra cada cliente (negócio "ganho"),
  // derivado dos leads em vez do tag manual — mais confiável pra detectar cross-sell.
  const wonCompaniesByClient = useMemo(() => {
    const map = new Map();
    for (const l of leads) {
      if (!l.clientId || l.stage !== "ganho" || !l.companyId) continue;
      if (!map.has(l.clientId)) map.set(l.clientId, new Set());
      map.get(l.clientId).add(l.companyId);
    }
    return map;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.city || "").toLowerCase().includes(q) ||
      (c.cnpj || "").includes(q) ||
      clientCategoryLabel(c.category).toLowerCase().includes(q));
  }, [clients, query]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || "", category: c.category || "", city: c.city || "",
      state: c.state || "", cnpj: c.cnpj || "", companyIds: c.companyIds || [], notes: c.notes || "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await onUpdate?.(editing.id, form);
      else await onCreate?.(form);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleCompany = (id) => {
    setForm(f => ({
      ...f,
      companyIds: f.companyIds.includes(id) ? f.companyIds.filter(x => x !== id) : [...f.companyIds, id],
    }));
  };

  const inputStyle = { borderColor: "#E5E7EB", color: "var(--text)", outline: "none", background: "var(--surface)" };
  const onFocusRed = e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = "0 0 0 3px rgba(199,33,43,0.12)"; };
  const onBlurRed = e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; };

  return (
    <div className="p-5 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2" style={{ fontSize: 15, color: "var(--text)" }}>
            <Users size={16} /> Clientes
          </h2>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Cadastro central de clientes — usado para vincular aos cards do Pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenImport && (
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border"
              style={{ borderColor: "#E5E7EB", color: "var(--text)", background: "#FFFFFF", cursor: "pointer" }}
            >
              <Database size={15} /> Importar planilha
            </button>
          )}
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--color-industria)", border: "none", cursor: "pointer" }}
          >
            <Plus size={15} /> Novo cliente
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border" style={{ borderColor: "#E5E7EB", background: "var(--surface)" }}>
        <Search size={15} style={{ color: "var(--text-dim)" }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nome, cidade, CNPJ ou categoria…"
          className="flex-1 text-sm outline-none"
          style={{ border: "none", background: "transparent", color: "var(--text)" }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>
          {query ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Nome", "Categoria", "Cidade / UF", "CNPJ", "Cross-sell", "Criado em", ""].map((h, i) => (
                  <th key={i} className="text-left font-bold uppercase"
                    style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--text-dim)", padding: "10px 12px", borderBottom: "1px solid #E5E7EB" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid #F1F1F1" }}>
                  <td style={{ padding: "12px", fontSize: 13 }}>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{c.name}</span>
                  </td>
                  <td style={{ padding: "12px" }}><CategoryTag value={c.category} /></td>
                  <td style={{ padding: "12px", fontSize: 13, color: "var(--text)" }}>
                    {[c.city, c.state].filter(Boolean).join(" / ") || <span style={{ color: "#9CA3AF" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px", fontSize: 12, fontFamily: "monospace", color: "var(--text-dim)" }}>
                    {c.cnpj || "—"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div className="flex flex-wrap gap-1">
                      {COMPANY_IDS.map(id => {
                        const co = COMPANIES[id];
                        const won = wonCompaniesByClient.get(c.id)?.has(id);
                        return (
                          <span key={id} title={won ? `Já vende para ${co.name}` : `Oportunidade de cross-sell em ${co.name}`}
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={won
                              ? { background: co.primary + "1A", color: co.primary }
                              : { background: "#F3F4F6", color: "#9CA3AF" }}>
                            {co.short}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ padding: "12px", fontSize: 13, color: "var(--text-dim)" }}>
                    {c.createdAt ? formatDateBR(c.createdAt) : "—"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(c)} title="Editar"
                      className="p-1.5 rounded-lg" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)" }}>
                      <Pencil size={14} />
                    </button>
                    {canDelete && (
                      <button onClick={() => setConfirmId(c.id)} title="Excluir"
                        className="p-1.5 rounded-lg" style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar cliente" : "Novo cliente"} width={480}>
        <div className="px-6 py-5 space-y-3.5">
          <div>
            <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nome *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome do cliente" autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed}>
                <option value="">—</option>
                {CLIENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>CNPJ</label>
              <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cidade</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Cidade"
                className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>UF</label>
              <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed}>
                <option value="">—</option>
                {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Empresas relacionadas</label>
            <div className="flex flex-wrap gap-2">
              {COMPANY_IDS.map(id => {
                const co = COMPANIES[id];
                const sel = form.companyIds.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleCompany(id)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{ borderColor: sel ? co.primary : "#E5E7EB", background: sel ? co.primary + "1A" : "#FFFFFF", color: sel ? co.primary : "var(--text-dim)", cursor: "pointer" }}>
                    {co.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Notas internas…"
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "#E5E7EB", color: "var(--text-dim)", background: "#FFFFFF", cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={save} disabled={!form.name.trim() || saving}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white"
              style={{ background: "var(--color-industria)", border: "none", opacity: (!form.name.trim() || saving) ? 0.5 : 1, cursor: (!form.name.trim() || saving) ? "not-allowed" : "pointer" }}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar cliente"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={Boolean(confirmId)} onClose={() => setConfirmId(null)} title="Excluir cliente" width={400}>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
            Tem certeza que deseja excluir este cliente? Os cards vinculados perderão a referência.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmId(null)} className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "#E5E7EB", color: "var(--text-dim)", background: "#FFFFFF", cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={async () => { await onDelete?.(confirmId); setConfirmId(null); }}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white"
              style={{ background: "#DC2626", border: "none", cursor: "pointer" }}>
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
