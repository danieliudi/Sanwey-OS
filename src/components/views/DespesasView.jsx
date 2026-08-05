import React, { useMemo, useState, useEffect, useRef } from "react";
import { Plus, X, DollarSign, Trash2, Pencil, Upload, FileText, ExternalLink, Loader2, ShoppingCart, Clock, CheckCircle2, Search } from "lucide-react";
import { useMarketingExpenses, useMarketingExpenseItems } from "../../hooks/use-marketing-expenses";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingTasks } from "../../hooks/use-marketing-tasks";
import { EXPENSE_CATEGORIES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatK, formatBRL } from "../../utils/currency";
import { CurrencyInput } from "../ui/CurrencyInput";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { formatDateBR, localDateInputToISOString, parseDateInput } from "../../utils/date";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../shared/PageHeader";
import { StatCard } from "../ui/StatCard";
import { EntityMultiSelect } from "../shared/EntityMultiSelect";

const RECEIPT_BUCKET = "marketing-attachments";

// Ano usado pelo filtro "Ano": data da fatura quando existir, senão o
// vencimento (que toda despesa tem) — decidido com o Daniel, mockup
// aprovado 05/08. parseDateInput (não `new Date` cru) evita o bug de
// data-only virando meia-noite UTC e "voltando" um dia em fuso negativo.
function expenseYear(expense) {
  const raw = expense.invoiceDate || expense.dueDate;
  if (!raw) return null;
  const d = parseDateInput(raw);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

const EMPTY_FORM = {
  description: "",
  category:    "Outros",
  amount:      "",
  status:      "pendente",
  dueDate:     "",
  invoiceDate: "",
  campaignId:  null,
  companyIds:  [],
  deliverableIds: [],
  taskIds:     [],
  notes:       "",
  receiptUrl:  null,
};

function StatusBadge({ status }) {
  const isPago = status === "pago";
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{
        background: isPago ? "var(--success-bg)" : "var(--warning-bg)",
        color:      isPago ? "var(--success)" : "var(--warning)",
        border:     `1px solid ${isPago ? "color-mix(in srgb, var(--success) 35%, transparent)" : "color-mix(in srgb, var(--warning) 35%, transparent)"}`,
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

function ExpenseModal({ initial, campaigns = [], deliverables = [], tasks = [], onSave, onClose, currentUser }) {
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

  // Sem filtro por empresa aqui — o dropdown de "Campanha relacionada" logo
  // abaixo também não filtra `campaigns` por empresa hoje, os 3 seletores
  // seguem a mesma regra pra não introduzir uma assimetria nova.
  const filteredDeliverables = useMemo(
    () => form.campaignId ? deliverables.filter(d => d.campaignId === form.campaignId) : deliverables,
    [deliverables, form.campaignId]
  );
  const filteredTasks = useMemo(
    () => form.campaignId ? tasks.filter(t => t.campaignId === form.campaignId) : tasks,
    [tasks, form.campaignId]
  );

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

          <div>
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Campanha relacionada (opcional)
            </div>
            <select
              value={form.campaignId || ""}
              onChange={e => set("campaignId", e.target.value || null)}
              className="w-full text-sm rounded-xl border outline-none px-3 py-2"
              style={{ borderColor: "var(--border-strong)", color: form.campaignId ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
            >
              <option value="">{campaigns.length === 0 ? "Nenhuma campanha cadastrada ainda" : "Sem campanha vinculada"}</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Entregas vinculadas (opcional)
            </div>
            <EntityMultiSelect
              value={form.deliverableIds}
              onChange={v => set("deliverableIds", v)}
              options={filteredDeliverables.map(d => ({ id: d.id, label: d.title }))}
              placeholder="Selecionar entregas…"
              emptyLabel="Nenhuma entrega disponível."
            />
          </div>

          <div>
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Tarefas vinculadas (opcional)
            </div>
            <EntityMultiSelect
              value={form.taskIds}
              onChange={v => set("taskIds", v)}
              options={filteredTasks.map(t => ({ id: t.id, label: t.title }))}
              placeholder="Selecionar tarefas…"
              emptyLabel="Nenhuma tarefa disponível."
            />
          </div>

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
                  placeholder="Valor"
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
            <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !form.description.trim()}
              className="flex-1 text-sm font-semibold py-2 rounded-xl"
              style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving || !form.description.trim() ? 0.5 : 1, border: "none", cursor: saving || !form.description.trim() ? "default" : "pointer" }}
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

function LinkedChips({ items = [] }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const shown = expanded ? items : items.slice(0, 2);
  const overflow = items.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {shown.map(it => (
        <span key={it.id} title={it.label} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold truncate"
          style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", maxWidth: 90 }}>
          {it.label}
        </span>
      ))}
      {overflow > 0 && (
        <button type="button" onClick={() => setExpanded(true)}
          className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)", cursor: "pointer" }}>
          +{overflow} mais
        </button>
      )}
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

  const { deliverables } = useMarketingDeliverables({ userId: user?.id, role: user?.role, roles: user?.roles });
  const { tasks } = useMarketingTasks({ userId: user?.id, role: user?.role, roles: user?.roles });
  const { fetchAllItems } = useMarketingExpenseItems();

  const campaignMap = useMemo(() => Object.fromEntries(campaigns.map(c => [c.id, c])), [campaigns]);
  const deliverableMap = useMemo(() => Object.fromEntries(deliverables.map(d => [d.id, d])), [deliverables]);
  const taskMap = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus]     = useState("all");
  const [filterCompany, setFilterCompany]   = useState("all");
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterYear, setFilterYear]         = useState("all");
  const [filterItem, setFilterItem]         = useState("");
  const [modalExpense, setModalExpense]      = useState(null);
  const [modalOpen, setModalOpen]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Todos os itens de todas as despesas, carregados uma vez — alimenta o
  // filtro "Item" (busca por descrição de linha, ex.: "Seguro", não pela
  // Categoria da despesa inteira). Ver DespesasView:653-680 pro cálculo.
  const [allItems, setAllItems] = useState([]);
  const [allItemsLoading, setAllItemsLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchAllItems()
      .then(data => { if (alive) setAllItems(data); })
      .finally(() => { if (alive) setAllItemsLoading(false); });
    return () => { alive = false; };
  }, [fetchAllItems]);

  const itemsByExpense = useMemo(() => {
    const map = {};
    for (const it of allItems) {
      (map[it.expenseId] ||= []).push(it);
    }
    return map;
  }, [allItems]);

  const years = useMemo(() => {
    const set = new Set();
    expenses.forEach(e => { const y = expenseYear(e); if (y) set.add(y); });
    return Array.from(set).sort((a, b) => b - a);
  }, [expenses]);

  const itemQuery = filterItem.trim().toLowerCase();

  // Item ativo muda o que "bater o filtro" significa: uma despesa com itens
  // detalhados só entra se ALGUM item bater (a soma usada no card de total
  // é só desses itens, não da despesa inteira); uma despesa sem item nenhum
  // cai no fallback de buscar na própria Descrição, valendo o valor cheio
  // (decisão confirmada com o Daniel, mockup 05/08).
  const { filtered, itemTotal } = useMemo(() => {
    const rows = expenses
      .filter(e => {
        if (filterCategory !== "all" && e.category !== filterCategory) return false;
        if (filterStatus !== "all" && e.status !== filterStatus) return false;
        if (filterCompany !== "all" && !(e.companyIds || []).includes(filterCompany)) return false;
        if (filterCampaign !== "all" && e.campaignId !== filterCampaign) return false;
        if (filterYear !== "all" && String(expenseYear(e)) !== filterYear) return false;
        return true;
      })
      .map(e => {
        if (!itemQuery) return { expense: e, matchedAmount: null };
        const items = itemsByExpense[e.id] || [];
        if (items.length === 0) {
          if (!e.description?.toLowerCase().includes(itemQuery)) return null;
          return { expense: e, matchedAmount: e.amount || 0 };
        }
        const matches = items.filter(it => it.description?.toLowerCase().includes(itemQuery));
        if (matches.length === 0) return null;
        return { expense: e, matchedAmount: matches.reduce((s, it) => s + it.quantity * it.unitValue, 0) };
      })
      .filter(Boolean);
    return {
      filtered: rows.map(r => r.expense),
      itemTotal: itemQuery ? rows.reduce((s, r) => s + (r.matchedAmount || 0), 0) : null,
    };
  }, [expenses, filterCategory, filterStatus, filterCompany, filterCampaign, filterYear, itemQuery, itemsByExpense]);

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
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
            >
              <Plus size={15} />
              Nova Despesa
            </button>
          )
        }
      />

      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4${itemQuery ? " lg:grid-cols-4" : ""}`}>
        <StatCard icon={DollarSign}  value={formatK(totals.all)}      label="Total" />
        <StatCard icon={Clock}       value={formatK(totals.pendente)} label="Pendente" valueColor="var(--warning)" />
        <StatCard icon={CheckCircle2} value={formatK(totals.pago)}    label="Pago"     valueColor="var(--success)" />
        {itemQuery && (
          <StatCard
            icon={Search}
            value={formatK(itemTotal || 0)}
            label={`Total em "${filterItem.trim()}"`}
            tooltip="Soma só das linhas de item que batem a busca — não da despesa inteira, que pode ter outros itens junto."
          />
        )}
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
        <select
          value={filterCampaign}
          onChange={e => setFilterCampaign(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todas as campanhas</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todos os anos</option>
          {years.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <div
          className="relative flex items-center rounded-xl border px-2.5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          title={allItemsLoading ? "Carregando itens…" : undefined}
        >
          <Search size={12} style={{ color: "var(--text-faint)" }} />
          <input
            type="text"
            value={filterItem}
            onChange={e => setFilterItem(e.target.value)}
            placeholder="Buscar item…"
            className="text-xs outline-none py-1.5 px-1.5 bg-transparent"
            style={{ color: "var(--text)", width: 120 }}
          />
        </div>
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
                {["Descrição", "Campanha", "Entregas", "Tarefas", "Categoria", "Empresa(s)", "Valor", "Vencimento", "Status", ""].map(h => (
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
                  <td colSpan={10} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>
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
                  <td className="px-4 py-3 text-xs" style={{ maxWidth: 160 }}>
                    <LinkedChips items={(expense.deliverableIds || []).map(id => deliverableMap[id]).filter(Boolean).map(d => ({ id: d.id, label: d.title }))} />
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ maxWidth: 160 }}>
                    <LinkedChips items={(expense.taskIds || []).map(id => taskMap[id]).filter(Boolean).map(t => ({ id: t.id, label: t.title }))} />
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
                            style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
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
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
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
          deliverables={deliverables}
          tasks={tasks}
          onSave={handleSave}
          onClose={closeModal}
          currentUser={user}
        />
      )}
    </div>
  );
}
