import React, { useMemo, useState, useEffect, useRef } from "react";
import { Plus, X, DollarSign, Trash2, Pencil, Upload, FileText, ExternalLink, Loader2, AlertCircle, ShoppingCart, Clock, CheckCircle2 } from "lucide-react";
import { useMarketingExpenses, useMarketingExpenseItems } from "../../hooks/use-marketing-expenses";
import { EXPENSE_CATEGORIES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatK, formatBRL } from "../../utils/currency";
import { CurrencyInput } from "../ui/CurrencyInput";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { formatDateBR, localDateInputToISOString } from "../../utils/date";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../shared/PageHeader";
import { StatCard } from "../ui/StatCard";

const RECEIPT_BUCKET = "marketing-attachments";

const EMPTY_FORM = {
  description: "",
  category:    "Outros",
  amount:      "",
  status:      "pendente",
  dueDate:     "",
  invoiceDate: "",
  campaignId:  null,
  companyIds:  [],
  notes:       "",
  receiptUrl:  null,
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

function ExpenseItemRow({ row, onChange, onRemove }) {
  const quantity = parseFloat(String(row.quantity).replace(",", ".")) || 0;
  const unitValue = Number(row.unitValue) || 0;
  const rowTotal = quantity * unitValue;
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <input
          type="text"
          placeholder="Descrição do item"
          value={row.description}
          onChange={e => onChange({ description: e.target.value })}
          className="flex-1 text-xs rounded-lg border px-2.5 py-1.5 outline-none"
          style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
          onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
          onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
        />
        <button
          type="button"
          onClick={onRemove}
          title="Remover item"
          style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-dim)"; }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Qtd"
          value={row.quantity}
          onChange={e => onChange({ quantity: e.target.value })}
          className="text-xs rounded-lg border px-2 py-1.5 outline-none"
          style={{ width: 56, borderColor: "var(--border-strong)", color: "var(--text)" }}
          onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
          onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
        />
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>×</span>
        <div className="flex-1">
          <CurrencyInput
            placeholder="Valor unit."
            value={row.unitValue}
            onChange={v => onChange({ unitValue: v })}
            className="w-full text-xs rounded-lg border px-2.5 py-1.5 outline-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
          />
        </div>
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>=</span>
        <div
          className="text-xs font-semibold text-right shrink-0"
          style={{ width: 80, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
        >
          {formatBRL(rowTotal)}
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({ initial, campaigns = [], onSave, onClose, currentUser }) {
  // Id gerado no cliente pra despesas novas — permite subir a nota fiscal
  // pro Storage (path `expense-invoices/${id}/...`) antes mesmo do primeiro
  // save, casando o nome da pasta com o id real da linha criada (em vez de
  // subir só depois do save, ou usar "new" como pasta órfã).
  const [id] = useState(() => initial?.id || crypto.randomUUID());
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    companyIds: currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : [],
    ...initial,
    amount: initial?.amount != null ? String(initial.amount) : "",
    dueDate: initial?.dueDate ? initial.dueDate.slice(0, 10) : "",
    invoiceDate: initial?.invoiceDate ? initial.invoiceDate.slice(0, 10) : "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [uploading, setUploading] = useState(false);
  useEscToClose(onClose);

  const { fetchItems, createExpenseItem, updateExpenseItem, deleteExpenseItem } = useMarketingExpenseItems();
  const isEditing = Boolean(initial?.id);
  const [rows, setRows] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(isEditing);
  const originalItemsRef = useRef([]);

  useEffect(() => {
    if (!isEditing) return;
    let alive = true;
    fetchItems(id)
      .then(data => {
        if (!alive) return;
        originalItemsRef.current = data;
        setRows(data.map(it => ({
          key: it.id,
          dbId: it.id,
          description: it.description,
          quantity: String(it.quantity),
          unitValue: it.unitValue,
        })));
      })
      .catch(err => { if (alive) setError(err?.message || "Erro ao carregar itens da despesa."); })
      .finally(() => { if (alive) setItemsLoading(false); });
    return () => { alive = false; };
  }, [isEditing, id, fetchItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const addRow = () => setRows(prev => [...prev, { key: crypto.randomUUID(), dbId: null, description: "", quantity: "1", unitValue: "" }]);
  const removeRow = (key) => setRows(prev => prev.filter(r => r.key !== key));
  const updateRow = (key, patch) => setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));

  const hasItems = rows.length > 0;
  const validRows = useMemo(() => rows.filter(r => r.description.trim()), [rows]);
  const computedTotal = useMemo(() => validRows.reduce((sum, r) => {
    const q = parseFloat(String(r.quantity).replace(",", ".")) || 0;
    const u = Number(r.unitValue) || 0;
    return sum + q * u;
  }, 0), [validRows]);

  // Enquanto há itens, o campo Valor é só exibição (o trigger do banco recalcula
  // amount a partir da soma dos itens) — mantemos form.amount em sincronia pra
  // já deixar o valor certo pronto assim que o último item for removido e o
  // campo voltar a ficar editável direto.
  useEffect(() => {
    if (hasItems) setForm(f => ({ ...f, amount: computedTotal }));
  }, [hasItems, computedTotal]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleCompany = (id) => {
    set("companyIds", form.companyIds.includes(id)
      ? form.companyIds.filter(c => c !== id)
      : [...form.companyIds, id]
    );
  };

  const handleUploadReceipt = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `expense-invoices/${id}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
      if (uploadErr) throw uploadErr;
      set("receiptUrl", path);
    } catch (err) {
      setError(err?.message || "Erro ao enviar nota fiscal.");
    } finally {
      setUploading(false);
    }
  };

  const handleViewReceipt = async () => {
    if (!form.receiptUrl) return;
    const { data, error: err } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(form.receiptUrl, 300);
    if (!err && data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { setError("Descrição obrigatória."); return; }
    if (form.companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    // Espelha o guard trigger do banco (marketing_expenses_require_receipt) —
    // dá um erro inline em vez do usuário levar a exceção crua do Postgres.
    if (form.status === "pago" && !form.receiptUrl) {
      setError("Despesa paga exige nota fiscal anexada.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const parentPayload = {
        ...form,
        id,
        dueDate:     localDateInputToISOString(form.dueDate),
        invoiceDate: form.invoiceDate || null,
      };

      const syncItems = async () => {
        const keptDbIds = new Set(validRows.filter(r => r.dbId).map(r => r.dbId));
        const toDelete = originalItemsRef.current.filter(it => !keptDbIds.has(it.id));
        for (const it of toDelete) {
          await deleteExpenseItem(it.id);
        }
        for (const row of validRows) {
          const quantity = parseFloat(String(row.quantity).replace(",", ".")) || 0;
          const unitValue = Number(row.unitValue) || 0;
          if (row.dbId) {
            const orig = originalItemsRef.current.find(it => it.id === row.dbId);
            if (!orig || orig.description !== row.description || orig.quantity !== quantity || orig.unitValue !== unitValue) {
              await updateExpenseItem(row.dbId, { description: row.description, quantity, unitValue });
            }
          } else {
            await createExpenseItem({ expenseId: id, description: row.description, quantity, unitValue });
          }
        }
      };

      // Itens novos só podem ser gravados depois que a despesa (pai) existe —
      // FK expense_id. Mas se o último item de uma despesa que já tinha itens
      // está sendo removido, marketing_expense_items_sync_amount_trg zera
      // `amount` no delete — precisa sincronizar os itens ANTES de gravar o
      // valor manual, senão o trigger sobrescreveria o que o usuário digitou.
      const willHaveItems  = validRows.length > 0;
      const isLosingLastItem = !willHaveItems && originalItemsRef.current.length > 0;

      if (isLosingLastItem) {
        await syncItems();
        await onSave({ ...parentPayload, amount: parseFloat(form.amount) || 0 });
      } else {
        await onSave({ ...parentPayload, amount: willHaveItems ? computedTotal : (parseFloat(form.amount) || 0) });
        await syncItems();
      }

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
          boxShadow: "var(--shadow-pop)",
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
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
          />

          {campaigns.length > 0 && (
            <select
              value={form.campaignId || ""}
              onChange={e => set("campaignId", e.target.value || null)}
              className="w-full text-sm rounded-xl border outline-none px-3 py-2"
              style={{ borderColor: "var(--border-strong)", color: form.campaignId ? "var(--text)" : "var(--text-dim)", background: "var(--surface)" }}
            >
              <option value="">Sem campanha vinculada</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

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

          {hasItems ? (
            <div className="space-y-2">
              <div
                className="w-full text-sm rounded-xl border px-3 py-2"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface-alt)" }}
                title="Recalculado automaticamente a partir dos itens abaixo"
              >
                Total (calculado a partir dos itens):{" "}
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{formatBRL(computedTotal)}</span>
              </div>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => set("dueDate", e.target.value)}
                title="Vencimento"
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={{ borderColor: "var(--border-strong)", color: form.dueDate ? "var(--text)" : "var(--text-dim)" }}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <CurrencyInput
                  prefix={null}
                  placeholder="Valor R$"
                  value={form.amount}
                  onChange={v => set("amount", v)}
                  className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                  style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
                  onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
                />
              </div>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => set("dueDate", e.target.value)}
                title="Vencimento"
                className="flex-1 text-sm rounded-xl border px-3 py-2 outline-none"
                style={{ borderColor: "var(--border-strong)", color: form.dueDate ? "var(--text)" : "var(--text-dim)" }}
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                Itens
              </div>
              {itemsLoading && (
                <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>Carregando…</span>
              )}
            </div>

            {rows.length > 0 && (
              <div className="space-y-2 mb-2">
                {rows.map(row => (
                  <ExpenseItemRow
                    key={row.key}
                    row={row}
                    onChange={patch => updateRow(row.key, patch)}
                    onRemove={() => removeRow(row.key)}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addRow}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold"
              style={{ borderColor: "var(--border)", borderStyle: "dashed", color: "var(--text-dim)", background: "transparent", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <Plus size={12} />
              Adicionar item
            </button>
          </div>

          <div>
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Data da fatura
            </div>
            <input
              type="date"
              value={form.invoiceDate}
              onChange={e => set("invoiceDate", e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border-strong)", color: form.invoiceDate ? "var(--text)" : "var(--text-dim)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
            />
          </div>

          <div>
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Nota fiscal
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {form.receiptUrl && (
                <button
                  type="button"
                  onClick={handleViewReceipt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", cursor: "pointer" }}
                >
                  <FileText size={12} />
                  Ver nota fiscal
                  <ExternalLink size={11} />
                </button>
              )}
              <label
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? "Enviando…" : form.receiptUrl ? "Substituir" : "Anexar nota fiscal"}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(f); e.target.value = ""; }}
                />
              </label>
            </div>
            {form.status === "pago" && !form.receiptUrl && (
              <div className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: "var(--warning)" }}>
                <AlertCircle size={11} />
                Obrigatória para marcar como paga.
              </div>
            )}
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
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
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
              style={{ background: "var(--accent)", color: "#FFF", opacity: saving || !form.description.trim() ? 0.5 : 1, border: "none", cursor: saving || !form.description.trim() ? "default" : "pointer" }}
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

export function DespesasView({ user, users = [], campaigns = [] }) {
  const {
    expenses,
    loading,
    canWrite,
    createExpense,
    updateExpense,
    deleteExpense,
  } = useMarketingExpenses({ userId: user?.id, role: user?.role });

  const campaignMap = useMemo(() => Object.fromEntries(campaigns.map(c => [c.id, c])), [campaigns]);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus]     = useState("all");
  const [filterCompany, setFilterCompany]   = useState("all");
  const [modalExpense, setModalExpense]      = useState(null);
  const [modalOpen, setModalOpen]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
    // A modal sempre traz um `form.id` (gerado no cliente pra permitir subir
    // a nota fiscal antes do primeiro save) — quem decide entre criar/editar
    // é a presença de `modalExpense` (a despesa que abriu o modal), não mais
    // `form.id`.
    if (modalExpense) {
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
      <PageHeader
        icon={DollarSign}
        title="Despesas"
        subtitle={`Controle de gastos e investimentos de marketing · Total filtrado: ${formatK(totals.all)}`}
        actions={
          canWrite && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#FFF", border: "none", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
            >
              <Plus size={15} />
              Nova Despesa
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard icon={DollarSign}  value={formatK(totals.all)}      label="Total" />
        <StatCard icon={Clock}       value={formatK(totals.pendente)} label="Pendente" valueColor="var(--warning)" />
        <StatCard icon={CheckCircle2} value={formatK(totals.pago)}    label="Pago"     valueColor="var(--success)" />
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
        <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                {["Descrição", "Campanha", "Categoria", "Empresa(s)", "Valor", "Vencimento", "Status", ""].map(h => (
                  <th
                    key={h}
                    className={h === "Valor" ? "text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" : "text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide"}
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
                  <td colSpan={8} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>
                    Nenhuma despesa encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
              {filtered.map(expense => (
                <tr
                  key={expense.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)", maxWidth: 220 }}>
                    <div className="flex items-center gap-1.5">
                      <div className="truncate">{expense.description}</div>
                      {/* Marcada pelo trigger de auto-registro do Kanban de Compras
                          (marketing_purchase_requests_sync_expense) — só um aviso
                          visual, sem deep-link pra solicitação de origem. */}
                      {expense.notes?.includes("Origem: compra ") && (
                        <span
                          title="Criada automaticamente a partir de uma compra aprovada"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0"
                          style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                        >
                          <ShoppingCart size={9} />
                          Origem: Compras
                        </span>
                      )}
                    </div>
                    {expense.notes && (
                      <div className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-dim)" }}>
                        {expense.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)", maxWidth: 140 }}>
                    {expense.campaignId && campaignMap[expense.campaignId]
                      ? <span className="truncate block" title={campaignMap[expense.campaignId].name}>{campaignMap[expense.campaignId].name}</span>
                      : <span style={{ color: "var(--text-faint)" }}>—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>
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
                  {/* Valor exato na célula (formatK só nos KPIs/totais) +
                      alinhado à direita com tabular-nums pra comparar coluna
                      abaixo. Achado da 2ª auditoria. */}
                  <td className="px-4 py-3 text-sm font-semibold text-right" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                    {formatBRL(expense.amount || 0)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>
                    {formatDateBR(expense.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={expense.status} />
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      confirmDeleteId === expense.id ? (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-[11px]" style={{ color: "var(--text)" }}>Excluir?</span>
                          <button
                            onClick={() => { deleteExpense(expense.id); setConfirmDeleteId(null); }}
                            style={{ background: "var(--danger)", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(expense)}
                            title="Editar"
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--text-dim)",
                              cursor: "pointer",
                              padding: 4,
                              borderRadius: 6,
                              display: "flex",
                              alignItems: "center",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-dim)"; }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(expense.id)}
                            title="Excluir"
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--text-dim)",
                              cursor: "pointer",
                              padding: 4,
                              borderRadius: 6,
                              display: "flex",
                              alignItems: "center",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "var(--danger)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-dim)"; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )
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
          campaigns={campaigns}
          onSave={handleSave}
          onClose={closeModal}
          currentUser={user}
        />
      )}
    </div>
  );
}
