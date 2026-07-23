import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_expenses";

function rowToExpense(r) {
  return {
    id:          r.id,
    companyIds:  Array.isArray(r.company_ids) ? r.company_ids : [],
    campaignId:  r.campaign_id ?? null,
    description: r.description,
    category:    r.category ?? "Outros",
    amount:      Number(r.amount || 0),
    status:      r.status,
    dueDate:     r.due_date ?? null,
    invoiceDate: r.invoice_date ?? null,
    notes:       r.notes ?? null,
    receiptUrl:  r.receipt_url ?? null,
    createdBy:   r.created_by ?? null,
    createdAt:   r.created_at ?? null,
    updatedAt:   r.updated_at ?? null,
  };
}

function expenseToRow(e, extras = {}) {
  return {
    // Id opcional — só presente quando o cliente já gerou o uuid antes do
    // primeiro save (DespesasView/ExpenseModal), pra poder subir a nota
    // fiscal no Storage com o mesmo id da linha que está prestes a criar.
    ...(e.id ? { id: e.id } : {}),
    company_ids:  e.companyIds ?? [],
    campaign_id:  e.campaignId ?? null,
    description:  e.description,
    category:     e.category ?? "Outros",
    amount:       e.amount ?? 0,
    status:       e.status ?? "pendente",
    due_date:     e.dueDate ?? null,
    invoice_date: e.invoiceDate ?? null,
    notes:        e.notes ?? null,
    receipt_url:  e.receiptUrl ?? null,
    ...extras,
  };
}

export function useMarketingExpenses({ userId, role } = {}) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const canWrite =
    role === "admin" ||
    role === "marketing" ||
    role === "gerente_marketing";

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setExpenses((data || []).map(rowToExpense));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channelName = `marketing_expenses_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "INSERT") {
          setExpenses(prev => prev.some(e => e.id === payload.new.id) ? prev : [rowToExpense(payload.new), ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setExpenses(prev => prev.map(e => e.id === payload.new.id ? rowToExpense(payload.new) : e));
        } else if (payload.eventType === "DELETE") {
          setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createExpense = useCallback(async (expense) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = expenseToRow(expense, { created_by: userId });
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (err) throw err;
    return rowToExpense(data);
  }, [canWrite, userId]);

  const updateExpense = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = expenses.find(e => e.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const row = expenseToRow(merged);
    const { error: err } = await supabase.from(TABLE).update(row).eq("id", id);
    if (err) throw err;
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, [canWrite, expenses]);

  const deleteExpense = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, [canWrite]);

  return {
    expenses,
    loading,
    error,
    canWrite,
    createExpense,
    updateExpense,
    deleteExpense,
    refetch: fetchAll,
  };
}

const ITEMS_TABLE = "marketing_expense_items";

function rowToExpenseItem(r) {
  return {
    id:          r.id,
    expenseId:   r.expense_id,
    description: r.description,
    quantity:    r.quantity != null ? Number(r.quantity) : 1,
    unitValue:   r.unit_value != null ? Number(r.unit_value) : 0,
  };
}

function expenseItemToRow(item) {
  return {
    expense_id:  item.expenseId,
    description: item.description,
    quantity:    item.quantity,
    unit_value:  item.unitValue,
  };
}

// Itens (quantidade × valor unitário) de uma despesa — marketing_expenses.amount
// é recalculado automaticamente pelo trigger marketing_expense_items_sync_amount_trg
// assim que um item é gravado/alterado/removido, então este hook nunca grava
// `amount` diretamente, só os itens.
export function useMarketingExpenseItems() {
  const fetchItems = useCallback(async (expenseId) => {
    if (!isSupabaseConfigured || !expenseId) return [];
    const { data, error: err } = await supabase
      .from(ITEMS_TABLE)
      .select("*")
      .eq("expense_id", expenseId)
      .order("created_at", { ascending: true });
    if (err) throw err;
    return (data || []).map(rowToExpenseItem);
  }, []);

  const createExpenseItem = useCallback(async (item) => {
    if (!isSupabaseConfigured) return null;
    const { data, error: err } = await supabase
      .from(ITEMS_TABLE)
      .insert(expenseItemToRow(item))
      .select()
      .single();
    if (err) throw err;
    return rowToExpenseItem(data);
  }, []);

  const updateExpenseItem = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) return;
    const row = {};
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.quantity !== undefined)    row.quantity = patch.quantity;
    if (patch.unitValue !== undefined)   row.unit_value = patch.unitValue;
    const { error: err } = await supabase.from(ITEMS_TABLE).update(row).eq("id", id);
    if (err) throw err;
  }, []);

  const deleteExpenseItem = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase.from(ITEMS_TABLE).delete().eq("id", id);
    if (err) throw err;
  }, []);

  return { fetchItems, createExpenseItem, updateExpenseItem, deleteExpenseItem };
}
