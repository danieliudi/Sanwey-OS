import React, { useMemo, useState, useEffect, useRef } from "react";
import { Plus, X, DollarSign, Trash2, Pencil, Upload, FileText, ExternalLink, Loader2, ShoppingCart, Clock, CheckCircle2, Search, Wallet, Target } from "lucide-react";
import { useMarketingExpenses, useMarketingExpenseItems } from "../../hooks/use-marketing-expenses";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingTasks } from "../../hooks/use-marketing-tasks";
import { useMarketingBudgets } from "../../hooks/use-marketing-budgets";
import { useMarketingPurchaseRequests } from "../../hooks/use-marketing-purchase-requests";
import { EXPENSE_CATEGORIES, MANUAL_EXPENSE_CATEGORIES, SYSTEM_EXPENSE_CATEGORIES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatK, formatBRL } from "../../utils/currency";
import { CurrencyInput } from "../ui/CurrencyInput";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { formatDateBR, localDateInputToISOString } from "../../utils/date";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../shared/PageHeader";
import { StatCard } from "../ui/StatCard";
import { EntityMultiSelect } from "../shared/EntityMultiSelect";
import { Tabs } from "../shared/Tabs";
import { Modal } from "../ui/Modal";
import { EmptyState } from "../ui/EmptyState";
import { HelpTooltip } from "../ui/HelpTooltip";
import { computeRoleFlags } from "../../utils/module-access";
import {
  computeBudgetUsage,
  computeBudgetTotals,
  computeBudgetGaps,
  formatBudgetPct,
  expenseFiscalYear,
  BUDGET_STATUS_STYLE,
  PURCHASE_BUDGET_CATEGORY,
} from "../../utils/marketing-budget";

const RECEIPT_BUCKET = "marketing-attachments";

// Ano usado pelo filtro "Ano" = ano da fatura quando existir, senão o
// vencimento (que toda despesa tem) — decidido com o Daniel, mockup aprovado
// 05/08. A regra vive em utils/marketing-budget.js (`expenseFiscalYear`) desde
// 10/08: era a mesma conta escrita aqui e, com createdAt, DIFERENTE no
// MarketingDashboardView — agora os três leem do mesmo helper. Não
// reintroduzir uma cópia local: um `new Date(str)` cru volta um dia em fuso
// negativo e num 01/01 trocaria o ano inteiro.

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
    // Sem vencimento E sem data de nota, a despesa não pertence a ano nenhum:
    // ela some do filtro "Ano", do teto por categoria e do burn rate, mas
    // continua no total da tabela — dois números contraditórios na mesma tela.
    // Uma das duas datas basta (a regra fiscal é nota → vencimento).
    if (!form.dueDate && !form.invoiceDate) {
      setError("Informe o vencimento ou a data da nota — é o que define o ano da despesa.");
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
              {/* MANUAL_ (não EXPENSE_CATEGORIES): "Compra de Marketing" é
                  categoria de sistema, criada pelo trigger a partir do board de
                  Compras — oferecê-la aqui convidaria a lançar à mão a mesma
                  despesa que o banco já cria sozinho. A opção só aparece quando
                  a despesa ABERTA já está nela (despesa gerada pela compra
                  sendo editada); sem isso o <select> renderia com um valor fora
                  das opções e o save reescreveria a categoria em silêncio. */}
              {(SYSTEM_EXPENSE_CATEGORIES.includes(form.category)
                ? EXPENSE_CATEGORIES
                : MANUAL_EXPENSE_CATEGORIES
              ).map(c => <option key={c} value={c}>{c}</option>)}
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

// ── Painel de Orçamento (teto por categoria) ─────────────────────────────────
// Mockup aprovado com o Daniel 10/08/2026. TODA a conta (as 3 faixas
// disjuntas, o ano fiscal, o escopo por empresa) vive em
// utils/marketing-budget.js — daqui pra baixo é só desenho. Se faltar um
// número, ele nasce no helper, nunca somado à mão nesta camada: é lá que está
// escrito por que stage='pago' fica FORA do comprometido (senão o mesmo
// dinheiro conta duas vezes).

function BudgetCompanyChips({ ids = [] }) {
  // Teto sem empresa NÃO é "Grupo (todas)": a RLS de marketing_budgets exige
  // `company_ids && current_user_companies()`, e array vazio não faz overlap
  // com nada no Postgres — um teto assim é invisível pro time de marketing
  // inteiro e não acompanha despesa nenhuma. O formulário passou a exigir ao
  // menos uma empresa; este chip existe só pra um teto legado gritar que
  // precisa ser editado, em vez de mostrar 0% como se estivesse saudável.
  if (!Array.isArray(ids) || ids.length === 0) {
    return (
      <span
        className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)" }}
        title="Teto sem empresa: não acompanha nenhuma despesa. Edite e selecione ao menos uma empresa."
      >
        Sem empresa
      </span>
    );
  }
  return (
    <>
      {ids.map(id => {
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
    </>
  );
}

function BudgetLegendItem({ swatch, label, value, tooltip }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-sm shrink-0" style={{ width: 10, height: 10, ...swatch }} />
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      {tooltip && <HelpTooltip text={tooltip} size={11} />}
      <span className="font-semibold" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {formatBRL(value)}
      </span>
    </span>
  );
}

function BudgetBar({ usage, canManage, onEdit, onDelete }) {
  const { budget, paid, pending, committed, total, pct, status } = usage;
  const amount = budget.amount || 0;
  const isOver = status === "estourado";
  const st = BUDGET_STATUS_STYLE[status] || BUDGET_STATUS_STYLE.ok;

  // Normalização do trilho: quando o gasto passa do teto, o denominador vira o
  // PRÓPRIO gasto — as 3 faixas continuam somando 100% da largura (nada vaza
  // pra fora do trilho) e o teto vira uma marca DENTRO da barra, mostrando
  // onde ele ficou. Sem isso, 130% de consumo desenharia 130% de largura.
  const denom = Math.max(amount, total);
  const widthOf = v => (denom > 0 ? `${Math.max(0, (v / denom) * 100)}%` : "0%");

  // --accent NUNCA sinaliza estouro: ele muda por frente comercial em runtime
  // (ficaria verde na Resibag). No estouro a barra inteira vira --danger e o
  // comprometido continua distinguível pela HACHURA, não pela cor.
  const bandColor  = isOver ? "var(--danger)" : "var(--accent)";
  const hatchColor = isOver ? "var(--danger)" : "var(--warning)";
  const hatchStyle = {
    backgroundImage: `repeating-linear-gradient(45deg, ${hatchColor} 0, ${hatchColor} 3px, transparent 3px, transparent 7px)`,
    backgroundColor: `color-mix(in srgb, ${hatchColor} 18%, transparent)`,
  };

  // Rótulo e cor saem do mesmo número (formatBudgetPct): com Math.round, 79,6%
  // imprimia "80%" ainda em cinza e 100,4% imprimia "100%" já em vermelho.
  const pctLabel = formatBudgetPct(pct, status);
  // Faixa 3 só existe pra categoria que as compras alimentam (o helper nem
  // calcula pras outras) — mostrar "Comprometido: R$ 0" em "Mídia Paga" seria
  // um zero que nunca vai mudar.
  const showCommitted = committed > 0 || budget.category === PURCHASE_BUDGET_CATEGORY;

  return (
    <div className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold break-words" style={{ color: "var(--text)" }}>
            {budget.category}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <BudgetCompanyChips ids={budget.companyIds} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs" style={{ color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
            <span className="font-bold" style={{ color: isOver ? "var(--danger)" : "var(--text)" }}>
              {formatBRL(total)}
            </span>
            {" de "}
            {formatBRL(amount)}
          </div>
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{ background: st.bg, color: st.color }}
            title={st.label}
          >
            {pctLabel}
          </span>
          {canManage && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onEdit}
                title="Editar teto"
                style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Excluir teto"
                style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="rounded-full overflow-hidden flex relative"
        style={{ height: 16, background: "var(--border)" }}
        role="img"
        aria-label={`${budget.category}: ${formatBRL(total)} de ${formatBRL(amount)} (${pctLabel})`}
      >
        <div style={{ width: widthOf(paid), background: bandColor, flexShrink: 0 }} title={`Pago: ${formatBRL(paid)}`} />
        <div style={{ width: widthOf(pending), background: bandColor, opacity: 0.5, flexShrink: 0 }} title={`A pagar: ${formatBRL(pending)}`} />
        <div style={{ width: widthOf(committed), flexShrink: 0, ...hatchStyle }} title={`Comprometido em compra: ${formatBRL(committed)}`} />
        {isOver && amount > 0 && (
          <span
            aria-hidden="true"
            title={`Teto: ${formatBRL(amount)}`}
            style={{ position: "absolute", top: 0, bottom: 0, left: `${(amount / denom) * 100}%`, width: 2, background: "var(--text)", opacity: 0.55 }}
          />
        )}
      </div>

      {/* Cor de texto pelo token do próprio status (--warning no "atenção"),
          nunca --amber solto: sobre --surface no tema claro, --amber fica em
          2,46:1 e some do card. */}
      <div
        className="mt-2 text-[11px] font-semibold"
        style={{ color: status === "ok" ? "var(--text-dim)" : st.color }}
      >
        {isOver
          ? (amount > 0
              ? `Estourou ${formatBRL(total - amount)} acima do teto (${pctLabel} do limite).`
              : `Teto zerado — ${formatBRL(total)} já lançados sem limite disponível.`)
          : `Disponível: ${formatBRL(Math.max(0, amount - total))}`}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
        <BudgetLegendItem swatch={{ background: bandColor }} label="Pago" value={paid} />
        <BudgetLegendItem swatch={{ background: bandColor, opacity: 0.5 }} label="A pagar" value={pending} />
        {showCommitted && (
          <BudgetLegendItem
            swatch={hatchStyle}
            label="Comprometido em compra"
            value={committed}
            tooltip="Compras já aprovadas que ainda não viraram despesa. Quando a compra é paga, o sistema cria a despesa sozinho e o valor migra para a faixa 'Pago' — nunca conta nas duas ao mesmo tempo."
          />
        )}
      </div>

      {budget.notes && (
        <div className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
          {budget.notes}
        </div>
      )}
    </div>
  );
}

function BudgetFormModal({ initial, budgets = [], defaultYear, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    category:   initial?.category   ?? EXPENSE_CATEGORIES[0],
    periodYear: initial?.periodYear ?? defaultYear,
    amount:     initial?.amount != null ? String(initial.amount) : "",
    companyIds: initial?.companyIds ?? [],
    notes:      initial?.notes ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const toggleCompany = (id) => set("companyIds",
    form.companyIds.includes(id) ? form.companyIds.filter(c => c !== id) : [...form.companyIds, id]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const year = Number(form.periodYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setError("Informe um ano válido (ex.: 2026).");
      return;
    }
    const value = form.amount === "" || form.amount == null ? 0 : Number(form.amount);
    if (!Number.isFinite(value) || value < 0) {
      setError("O valor do teto não pode ser negativo.");
      return;
    }

    // company_ids entra SEMPRE ordenado: a UNIQUE do banco é
    // (company_ids, category, period_year) e array no Postgres compara
    // elemento a elemento — sem ordenar, ["sanwey","resibag"] e
    // ["resibag","sanwey"] viram dois tetos distintos pro mesmo escopo real.
    const companyIds = COMPANY_IDS.filter(id => form.companyIds.includes(id));

    // Ao menos uma empresa é requisito do BANCO, não preferência de tela: as
    // policies de marketing_budgets exigem `company_ids && current_user_companies()`
    // e '{}' && qualquer coisa é FALSE no Postgres. Sem esta validação, um
    // gerente de marketing tomava a mensagem crua de violação de RLS ao salvar,
    // e um teto criado por admin sem empresa ficava invisível pro time todo.
    if (companyIds.length === 0) {
      setError("Selecione ao menos uma empresa para o teto.");
      return;
    }

    const clash = (budgets || []).find(b =>
      b.id !== initial?.id &&
      b.category === form.category &&
      Number(b.periodYear) === year &&
      (b.companyIds || []).join("|") === companyIds.join("|")
    );
    if (clash) {
      setError("Já existe um teto para essa categoria, ano e empresas.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        category:   form.category,
        periodYear: year,
        amount:     value,
        companyIds,
        notes:      (form.notes || "").trim() || null,
      });
      onClose();
    } catch (err) {
      // 23505 = unique_violation: a mesma checagem acima, só que ganha da
      // corrida entre dois gerentes salvando ao mesmo tempo.
      setError(err?.code === "23505"
        ? "Já existe um teto para essa categoria, ano e empresas."
        : (err?.message || "Erro ao salvar o teto."));
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" };

  return (
    <Modal open onClose={onClose} title={initial ? "Editar teto" : "Novo teto de orçamento"} width={440}>
      <form onSubmit={handleSubmit} className="p-6 space-y-3">
        <div>
          <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Categoria
          </div>
          <select
            autoFocus
            value={form.category}
            onChange={e => set("category", e.target.value)}
            className="w-full text-sm rounded-xl border outline-none px-3 py-2"
            style={selectStyle}
          >
            {/* EXPENSE_CATEGORIES (lista completa, não MANUAL_): "Compra de
                Marketing" é justamente a categoria onde o comprometido existe —
                deixá-la de fora aqui cegaria o teto pra todo dinheiro de compra. */}
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {form.category === PURCHASE_BUDGET_CATEGORY && (
            <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
              Única categoria com a faixa "Comprometido": compras aprovadas que ainda não viraram despesa entram aqui.
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Ano
            </div>
            <input
              type="number"
              min="2000"
              max="2100"
              step="1"
              value={form.periodYear}
              onChange={e => set("periodYear", e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
            />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Teto
            </div>
            <CurrencyInput
              placeholder="Valor do teto"
              value={form.amount}
              onChange={v => set("amount", v)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
            />
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
          <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
            Selecione ao menos uma empresa — o teto acompanha só as despesas e compras dessas empresas.
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Observação (opcional)
          </div>
          <textarea
            placeholder="Ex.: teto aprovado na reunião de planejamento"
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            rows={2}
            className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
          />
        </div>

        {error && (
          <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 text-sm font-semibold py-2 rounded-xl"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.5 : 1, border: "none", cursor: saving ? "default" : "pointer" }}
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
    </Modal>
  );
}

// Mesmo padrão de exclusão da referência canônica (FornecedoresView.jsx):
// Modal compartilhado + "Cancelar"/"Excluir" com o Excluir em var(--danger).
function ConfirmDeleteBudgetModal({ budget, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao excluir o teto.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Excluir teto?" width={400}>
      <div className="p-6">
        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          O teto de "{budget.category}" ({budget.periodYear}) será removido. As despesas e compras
          continuam registradas normalmente — só o limite deixa de ser acompanhado.
        </p>
        {error && (
          <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", opacity: deleting ? 0.6 : 1, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none", opacity: deleting ? 0.6 : 1, cursor: "pointer" }}
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Dinheiro real que NÃO aparece em nenhuma barra acima. Antes disso, três
// descartes aconteciam em silêncio (despesa sem data nenhuma, categoria sem
// teto, empresa fora do escopo dos tetos) e o painel podia parecer saudável
// com a maior parte do ano fora dele — a tabela ao lado, na mesma tela,
// mostrando outro total. O cálculo vive em computeBudgetGaps; aqui é só texto.
function BudgetGapsNotice({ gaps, year }) {
  if (!gaps) return null;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const lines = [];
  if (gaps.undated.count > 0) {
    lines.push(`${formatBRL(gaps.undated.amount)} em ${plural(gaps.undated.count, "despesa", "despesas")} sem data de nota nem vencimento — não entram em nenhum ano.`);
  }
  if (gaps.noBudget.count > 0) {
    lines.push(`${formatBRL(gaps.noBudget.amount)} em categorias sem teto em ${year}: ${gaps.noBudget.categories.join(", ")}.`);
  }
  if (gaps.outOfScope.count > 0) {
    lines.push(`${formatBRL(gaps.outOfScope.amount)} em ${plural(gaps.outOfScope.count, "lançamento", "lançamentos")} de empresas fora do escopo dos tetos acima.`);
  }
  if (lines.length === 0) return null;

  return (
    <div
      className="rounded-xl border px-3 py-2 mb-4 text-[11px]"
      style={{
        borderColor: "color-mix(in srgb, var(--warning) 35%, transparent)",
        background: "var(--warning-bg)",
        color: "var(--warning)",
      }}
    >
      <div className="font-bold mb-0.5">Fora do acompanhamento de teto</div>
      <ul className="list-disc pl-4 space-y-0.5">
        {lines.map(l => <li key={l}>{l}</li>)}
      </ul>
    </div>
  );
}

function BudgetPanel({
  usages, totals, gaps, year, onYearChange, yearOptions,
  companyFilter, onCompanyFilterChange,
  canManage, onNew, onEdit, onDelete,
  loading, committedLoading, error,
}) {
  const filterSelectStyle = { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" };
  const isOver = totals.status === "estourado";

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <select
          value={String(year)}
          onChange={e => onYearChange(Number(e.target.value))}
          title="Ano do orçamento"
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={filterSelectStyle}
        >
          {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <select
          value={companyFilter}
          onChange={e => onCompanyFilterChange(e.target.value)}
          title="Empresa"
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={filterSelectStyle}
        >
          <option value="all">Todas as empresas</option>
          {COMPANY_IDS.map(id => (
            <option key={id} value={id}>{COMPANIES[id]?.short}</option>
          ))}
        </select>
        {committedLoading && (
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>Carregando compras…</span>
        )}
        <div className="flex-1" />
        {canManage && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            <Plus size={13} />
            Definir teto
          </button>
        )}
      </div>

      {error && (
        <div className="text-[12px] rounded-lg px-3 py-2 mb-4" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {usages.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard
            dense
            icon={Target}
            value={formatK(totals.budgetAmount)}
            label="Teto total"
            tooltip="Soma dos tetos listados abaixo. Dois tetos com empresas diferentes são dois limites independentes — não há rateio entre eles."
          />
          <StatCard
            dense
            icon={DollarSign}
            value={formatK(totals.consumed)}
            label="Consumido"
            tooltip="Pago + a pagar nas categorias que têm teto cadastrado neste ano. Gasto em categoria sem teto aparece no aviso abaixo, não aqui. Cada despesa conta uma vez, mesmo quando bate em mais de um teto."
          />
          <StatCard
            dense
            icon={ShoppingCart}
            value={formatK(totals.committed)}
            label="Comprometido"
            valueColor="var(--warning)"
            tooltip="Compras aprovadas que ainda não viraram despesa (o mesmo vale para uma compra paga cuja despesa foi excluída). Some no total contra o teto, mas não é gasto registrado ainda."
          />
          {/* Estourado: o número do card é o PRÓPRIO estouro. Com
              Math.max(0, teto - total) ele virava "R$ 0" embaixo do rótulo
              vermelho "Estourado", e no mobile (dense esconde o sublabel) o
              card lia literalmente "R$ 0 / Estourado". */}
          <StatCard
            dense
            icon={Wallet}
            value={formatK(isOver
              ? totals.total - totals.budgetAmount
              : Math.max(0, totals.budgetAmount - totals.total))}
            label={isOver ? "Estourado" : "Disponível"}
            valueColor={isOver ? "var(--danger)" : undefined}
            sublabel={isOver ? "acima do teto" : undefined}
          />
        </div>
      )}

      {!loading && <BudgetGapsNotice gaps={gaps} year={year} />}

      {loading && (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>
          Carregando tetos…
        </div>
      )}

      {!loading && usages.length === 0 && (
        <div className="rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <EmptyState
            icon={Target}
            title={`Nenhum teto definido para ${year}`}
            description={
              canManage
                ? "Defina um teto por categoria para acompanhar quanto já foi pago, quanto ainda está a pagar e quanto está comprometido em compras aprovadas."
                : "Ainda não há teto de orçamento para este ano. Um gerente de marketing pode definir o primeiro."
            }
            action={canManage && (
              <button
                onClick={onNew}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
              >
                <Plus size={15} />
                Definir primeiro teto
              </button>
            )}
          />
        </div>
      )}

      {!loading && usages.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {usages.map(usage => (
            <BudgetBar
              key={usage.budget.id}
              usage={usage}
              canManage={canManage}
              onEdit={() => onEdit(usage.budget)}
              onDelete={() => onDelete(usage.budget)}
            />
          ))}
        </div>
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

  // Aba ativa (regra 6: componente Tabs compartilhado, nada de sistema de abas
  // novo). O painel de Orçamento é o único que precisa das compras — quem só
  // lança despesa não paga o fetch da tabela inteira de Compras.
  const [tab, setTab] = useState("despesas");

  const {
    budgets,
    loading: budgetsLoading,
    error: budgetsError,
    createBudget,
    updateBudget,
    deleteBudget,
  } = useMarketingBudgets({ userId: user?.id, role: user?.role, roles: user?.roles });

  const { purchases, loading: purchasesLoading } = useMarketingPurchaseRequests({ enabled: tab === "orcamento" });

  // Gate de gestão de teto = isMarketingManager (module-access.js:77), o mesmo
  // conjunto que current_user_is_marketing_manager() no banco. Analista de
  // marketing enxerga as barras, não os botões. Quem manda de verdade continua
  // sendo a RLS — isto só esconde um controle que falharia de qualquer jeito.
  const canManageBudgets = useMemo(
    () => computeRoleFlags(user?.roles?.length ? user.roles : (user?.role ? [user.role] : [])).isMarketingManager,
    [user?.roles, user?.role]
  );

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
  const [deleteError, setDeleteError]       = useState(null);

  // Ano do painel de Orçamento — separado de `filterYear` de propósito: o
  // filtro da tabela aceita "todos os anos", um teto é sempre de UM ano.
  const [budgetYear, setBudgetYear]           = useState(() => new Date().getFullYear());
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetEditing, setBudgetEditing]     = useState(null);
  const [budgetDeleting, setBudgetDeleting]   = useState(null);

  // Todos os itens de todas as despesas, carregados uma vez — alimenta o
  // filtro "Item" (busca por descrição de linha, ex.: "Seguro", não pela
  // Categoria da despesa inteira). Ver DespesasView:653-680 pro cálculo.
  const [allItems, setAllItems] = useState([]);
  const [allItemsLoading, setAllItemsLoading] = useState(true);
  const [allItemsLoadError, setAllItemsLoadError] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchAllItems()
      .then(data => { if (alive) setAllItems(data); })
      .catch(err => { if (alive) setAllItemsLoadError(err?.message || "Erro ao carregar itens das despesas."); })
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
    expenses.forEach(e => { const y = expenseFiscalYear(e); if (y) set.add(y); });
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
        if (filterYear !== "all" && String(expenseFiscalYear(e)) !== filterYear) return false;
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

  // Sempre inclui o ano corrente e o ano selecionado, além dos anos que já têm
  // teto — sem isso, excluir o último teto de um ano deixaria o <select> com um
  // valor fora das opções (classe de bug "campo sem opções renderizando vazio").
  const budgetYearOptions = useMemo(() => {
    const set = new Set([new Date().getFullYear(), budgetYear]);
    budgets.forEach(b => { if (b.periodYear) set.add(Number(b.periodYear)); });
    return Array.from(set).sort((a, b) => b - a);
  }, [budgets, budgetYear]);

  // O painel consome o MESMO escopo de empresa que a tabela (`filterCompany`),
  // nunca um recorte próprio — mesmo princípio da regra 11 do CLAUDE.md.
  const budgetUsages = useMemo(() => computeBudgetUsage({
    budgets,
    expenses,
    purchases,
    year: budgetYear,
    companyIds: filterCompany === "all" ? [] : [filterCompany],
  }).sort((a, b) => b.pct - a.pct), [budgets, expenses, purchases, budgetYear, filterCompany]);

  const budgetTotals = useMemo(() => computeBudgetTotals(budgetUsages), [budgetUsages]);

  // Contrapeso do agregado: quanto do ano ficou FORA das barras (sem data, sem
  // teto na categoria, ou de empresa fora do escopo dos tetos). Mesmo recorte
  // de ano/empresa que as barras usam — nunca um escopo próprio.
  const budgetGaps = useMemo(() => computeBudgetGaps({
    budgets,
    expenses,
    purchases,
    year: budgetYear,
    companyIds: filterCompany === "all" ? [] : [filterCompany],
  }), [budgets, expenses, purchases, budgetYear, filterCompany]);

  const openNewBudget = () => { setBudgetEditing(null); setBudgetModalOpen(true); };
  const openEditBudget = (budget) => { setBudgetEditing(budget); setBudgetModalOpen(true); };
  const closeBudgetModal = () => { setBudgetModalOpen(false); setBudgetEditing(null); };

  const handleSaveBudget = async (payload) => {
    if (budgetEditing) await updateBudget(budgetEditing.id, payload);
    else await createBudget(payload);
  };

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

  const handleDelete = async (expenseId) => {
    setDeleteError(null);
    try {
      await deleteExpense(expenseId);
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err?.message || "Erro ao excluir despesa.");
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

      {/* Abas fora do bloco condicional de conteúdo (mesmo espírito da regra 11:
          o cabeçalho da tela não reflui ao trocar de aba). Controles específicos
          de cada aba — filtros da tabela, ano do orçamento — vivem DENTRO da
          aba correspondente, nunca aqui em cima.
          `data-tour` = âncora do spotlight da regra 12. */}
      <div className="mb-4" data-tour="despesas-abas">
        <Tabs
          tabs={[
            { id: "despesas",  label: "Despesas",  icon: DollarSign },
            { id: "orcamento", label: "Orçamento", icon: Target },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "orcamento" ? (
        <BudgetPanel
          usages={budgetUsages}
          totals={budgetTotals}
          gaps={budgetGaps}
          year={budgetYear}
          onYearChange={setBudgetYear}
          yearOptions={budgetYearOptions}
          companyFilter={filterCompany}
          onCompanyFilterChange={setFilterCompany}
          canManage={canManageBudgets}
          onNew={openNewBudget}
          onEdit={openEditBudget}
          onDelete={setBudgetDeleting}
          loading={budgetsLoading}
          committedLoading={purchasesLoading}
          error={budgetsError}
        />
      ) : (
      <>
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

      {(allItemsLoadError || deleteError) && (
        <div className="text-[12px] rounded-lg px-3 py-2 mb-4" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          {deleteError || allItemsLoadError}
        </div>
      )}

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
                          {/* Despesa de categoria de sistema não foi digitada
                              por ninguém: o trigger a criou a partir de uma
                              compra paga. Excluir aqui não desfaz a compra
                              (a FK é ON DELETE SET NULL) — avisa antes, em vez
                              de deixar parecer uma duplicata inofensiva. */}
                          {SYSTEM_EXPENSE_CATEGORIES.includes(expense.category) ? (
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: "var(--warning)" }}
                              title="Esta despesa foi criada automaticamente pela compra paga correspondente. Excluí-la não cancela a compra — o valor volta a aparecer como 'comprometido' no painel de Orçamento."
                            >
                              Excluir? (veio de uma compra)
                            </span>
                          ) : (
                            <span className="text-[11px]" style={{ color: "var(--text)" }}>Excluir?</span>
                          )}
                          <button
                            onClick={() => handleDelete(expense.id)}
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
      </>
      )}

      {budgetModalOpen && (
        <BudgetFormModal
          initial={budgetEditing}
          budgets={budgets}
          defaultYear={budgetYear}
          onSave={handleSaveBudget}
          onClose={closeBudgetModal}
        />
      )}

      {budgetDeleting && (
        <ConfirmDeleteBudgetModal
          budget={budgetDeleting}
          onConfirm={() => deleteBudget(budgetDeleting.id)}
          onClose={() => setBudgetDeleting(null)}
        />
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
