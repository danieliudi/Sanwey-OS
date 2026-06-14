import React, { useMemo, useState } from "react";
import { Plus, X, DollarSign, Trash2, Pencil } from "lucide-react";
import { useMarketingExpenses } from "../../hooks/use-marketing-expenses";
import { EXPENSE_CATEGORIES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";

const EMPTY_FORM = {
  description: "",
  category:    "Outros",
  amount:      "",
  status:      "pendente",
  dueDate:     "",
  campaignId:  null,
  companyIds:  [],
  notes:       "",
};

function StatusBadge({ status }) {
  const isPago = status === "pago";
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{
        background: isPago ? "#DCFCE7" : "#FEF3C7",
        color:      isPago ? "var(--success)" : "var(--warning)",
        border:     `1px solid ${isPago ? "#BBF7D0" : "#FDE68A"}`,
      }}
    >
      {isPago ? "Pago" : "Pendente"}
    </span>
  );
}

function ExpenseModal({ initial, users, onSave, onClose, currentUser }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    companyIds: currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : [],
    ...initial,
    amount: initial?.amount != null ? String(initial.amount) : "",
    dueDate: initial?.dueDate ? initial.dueDate.slice(0, 10) : "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleCompany = (id) => {
    set("companyIds", form.companyIds.includes(id)
      ? form.companyIds.filter(c => c !== id)
      : [...form.companyIds, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { setError("Descrição obrigatória."); return; }
    if (form.companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        amount:  parseFloat(form.amount) || 0,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao salvar despesa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(32,26,26,0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(32,26,26,0.18)",
          width: "100%",
          maxWidth: 460,
          padding: 24,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-base" style={{ color: "var(--text)" }}>
            {initial?.id ? "Editar despesa" : "Nova despesa"}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4, borderRadius: 6 }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Descrição *"
            value={form.description}
            onChange={e => set("description", e.target.value)}
            className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
            onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
          />

          <div className="flex gap-2">
            <select
              value={form.category}
              onChange={e => set("category", e.target.value)}
              className="flex-1 text-sm rounded-xl border outline-none px-3 py-2"
              style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
            >
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={form.status}
              onChange={e => set("status", e.target.value)}
              className="flex-1 text-sm rounded-xl border outline-none px-3 py-2"
              style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Valor R$"
              value={form.amount}
              onChange={e => set("amount", e.target.value)}
              min="0"
              step="0.01"
              className="flex-1 text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
              onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
            />
            <input
              type="date"
              value={form.dueDate}
              onChange={e => set("dueDate", e.target.value)}
              className="flex-1 text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border-strong)", color: form.dueDate ? "var(--text)" : "var(--text-dim)" }}
              onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
            />
          </div>

          <div>
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Empresas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMPANY_IDS.map(id => {
                const co = COMPANIES[id];
                const sel = form.companyIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCompany(id)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors"
                    style={{
                      borderColor: sel ? co.primary : "var(--border)",
                      background:  sel ? co.primary + "22" : "var(--surface)",
                      color:       sel ? co.primary : "var(--text-dim)",
                      cursor:      "pointer",
                    }}
                  >
                    {co.short}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            placeholder="Observações"
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            rows={2}
            className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
            onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
          />

          {error && (
            <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "#FEF2F2", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !form.description.trim()}
              className="flex-1 text-sm font-semibold py-2 rounded-xl"
              style={{ background: "#1E4D8C", color: "#FFF", opacity: saving || !form.description.trim() ? 0.5 : 1, border: "none", cursor: saving || !form.description.trim() ? "default" : "pointer" }}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 text-sm rounded-xl border"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DespesasView({ user, users = [] }) {
  const {
    expenses,
    loading,
    canWrite,
    createExpense,
    updateExpense,
    deleteExpense,
  } = useMarketingExpenses({ userId: user?.id, role: user?.role });

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus]     = useState("all");
  const [filterCompany, setFilterCompany]   = useState("all");
  const [modalExpense, setModalExpense]      = useState(null);
  const [modalOpen, setModalOpen]           = useState(false);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (filterCategory !== "all" && e.category !== filterCategory) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      if (filterCompany !== "all" && !(e.companyIds || []).includes(filterCompany)) return false;
      return true;
    });
  }, [expenses, filterCategory, filterStatus, filterCompany]);

  const totals = useMemo(() => ({
    all:      filtered.reduce((s, e) => s + (e.amount || 0), 0),
    pendente: filtered.filter(e => e.status === "pendente").reduce((s, e) => s + (e.amount || 0), 0),
    pago:     filtered.filter(e => e.status === "pago").reduce((s, e) => s + (e.amount || 0), 0),
  }), [filtered]);

  const handleSave = async (form) => {
    if (form.id) {
      await updateExpense(form.id, form);
    } else {
      await createExpense(form);
    }
  };

  const openNew = () => {
    setModalExpense(null);
    setModalOpen(true);
  };

  const openEdit = (expense) => {
    setModalExpense(expense);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalExpense(null);
  };

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Despesas
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Controle de gastos e investimentos de marketing · Total filtrado: {formatK(totals.all)}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#1E4D8C", color: "#FFF", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#163a6b"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#1E4D8C"; }}
          >
            <Plus size={15} />
            Nova Despesa
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total",    value: totals.all },
          { label: "Pendente", value: totals.pendente, amber: true },
          { label: "Pago",     value: totals.pago,     green: true },
        ].map(k => (
          <div
            key={k.label}
            className="rounded-xl border px-4 py-3"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>
              {k.label}
            </div>
            <div
              className="text-xl font-bold"
              style={{
                color: k.amber ? "var(--warning)" : k.green ? "var(--success)" : "var(--text)",
                letterSpacing: "-0.02em",
              }}
            >
              {formatK(k.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todas as categorias</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
        </select>
        <select
          value={filterCompany}
          onChange={e => setFilterCompany(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todas as empresas</option>
          {COMPANY_IDS.map(id => (
            <option key={id} value={id}>{COMPANIES[id]?.short}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>
          Carregando despesas…
        </div>
      )}

      {!loading && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                {["Descrição", "Categoria", "Empresa(s)", "Valor", "Vencimento", "Status", ""].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>
                    Nenhuma despesa encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
              {filtered.map(expense => (
                <tr
                  key={expense.id}
                  style={{ borderBottom: "1px solid #E5E7EB" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: NEUTRAL.graphite, maxWidth: 220 }}>
                    <div className="truncate">{expense.description}</div>
                    {expense.notes && (
                      <div className="text-[11px] truncate mt-0.5" style={{ color: NEUTRAL.slate }}>
                        {expense.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: NEUTRAL.slate }}>
                    {expense.category}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(expense.companyIds || []).map(id => {
                        const co = COMPANIES[id];
                        if (!co) return null;
                        return (
                          <span
                            key={id}
                            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: co.primary + "22", color: co.primary }}
                          >
                            {co.short}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: NEUTRAL.graphite }}>
                    {formatK(expense.amount || 0)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: NEUTRAL.slate }}>
                    {formatDateBR(expense.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={expense.status} />
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(expense)}
                          title="Editar"
                          style={{
                            background: "none",
                            border: "none",
                            color: NEUTRAL.slate,
                            cursor: "pointer",
                            padding: 4,
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.color = "#1E4D8C"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = NEUTRAL.slate; }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Excluir esta despesa?")) deleteExpense(expense.id);
                          }}
                          title="Excluir"
                          style={{
                            background: "none",
                            border: "none",
                            color: NEUTRAL.slate,
                            cursor: "pointer",
                            padding: 4,
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#DC2626"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = NEUTRAL.slate; }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <ExpenseModal
          initial={modalExpense}
          users={users}
          onSave={handleSave}
          onClose={closeModal}
          currentUser={user}
        />
      )}
    </div>
  );
}
