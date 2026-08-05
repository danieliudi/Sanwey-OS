import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_expenses";
const DELIVERABLES_TABLE = "marketing_expense_deliverables";
const TASKS_TABLE = "marketing_expense_tasks";

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
    deliverableIds: Array.isArray(r.marketing_expense_deliverables)
      ? r.marketing_expense_deliverables.map(x => x.deliverable_id)
      : [],
    taskIds: Array.isArray(r.marketing_expense_tasks)
      ? r.marketing_expense_tasks.map(x => x.task_id)
      : [],
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
        .select("*, marketing_expense_deliverables(deliverable_id), marketing_expense_tasks(task_id)")
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
          // payload.new nunca traz o embed de marketing_expense_deliverables/
          // _tasks (Realtime não resolve joins) — preserva os arrays já
          // carregados no estado local em vez de sobrescrever com [].
          setExpenses(prev => prev.map(e => e.id === payload.new.id
            ? { ...rowToExpense(payload.new), deliverableIds: e.deliverableIds, taskIds: e.taskIds }
            : e));
        } else if (payload.eventType === "DELETE") {
          setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Diff-sync de uma tabela de junção (marketing_expense_deliverables/_tasks) —
  // deleta só o que saiu e insere só o que entrou, nunca apaga-e-recria tudo
  // (evita um DELETE+INSERT desnecessário disparando Realtime pra quem não
  // mudou nada).
  const syncExpenseLinks = useCallback(async (table, idColumn, expenseId, oldIds = [], newIds = []) => {
    const oldSet = new Set(oldIds);
    const newSet = new Set(newIds);
    const toAdd = newIds.filter(v => !oldSet.has(v));
    const toRemove = oldIds.filter(v => !newSet.has(v));
    if (toRemove.length > 0) {
      const { error: err } = await supabase
        .from(table)
        .delete()
        .eq("expense_id", expenseId)
        .in(idColumn, toRemove);
      if (err) throw err;
    }
    if (toAdd.length > 0) {
      const { error: err } = await supabase
        .from(table)
        .insert(toAdd.map(v => ({ expense_id: expenseId, [idColumn]: v })));
      if (err) throw err;
    }
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
    const deliverableIds = expense.deliverableIds ?? [];
    const taskIds = expense.taskIds ?? [];
    if (deliverableIds.length > 0) {
      const { error: dErr } = await supabase
        .from(DELIVERABLES_TABLE)
        .insert(deliverableIds.map(deliverable_id => ({ expense_id: data.id, deliverable_id })));
      if (dErr) throw dErr;
    }
    if (taskIds.length > 0) {
      const { error: tErr } = await supabase
        .from(TASKS_TABLE)
        .insert(taskIds.map(task_id => ({ expense_id: data.id, task_id })));
      if (tErr) throw tErr;
    }
    const created = { ...rowToExpense(data), deliverableIds, taskIds };
    setExpenses(prev => prev.some(e => e.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, [canWrite, userId]);

  const updateExpense = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = expenses.find(e => e.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const row = expenseToRow(merged);
    const { error: err } = await supabase.from(TABLE).update(row).eq("id", id);
    if (err) throw err;
    if ("deliverableIds" in patch) {
      await syncExpenseLinks(DELIVERABLES_TABLE, "deliverable_id", id, current.deliverableIds, patch.deliverableIds ?? []);
    }
    if ("taskIds" in patch) {
      await syncExpenseLinks(TASKS_TABLE, "task_id", id, current.taskIds, patch.taskIds ?? []);
    }
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, [canWrite, expenses, syncExpenseLinks]);

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

  // Todos os itens de todas as despesas, sem filtro por expense_id — usado
  // pelo filtro "Item" de DespesasView pra buscar por descrição de linha
  // (ex.: "Seguro") em vez de categoria. Volume esperado é baixo o bastante
  // (mesma premissa de useMarketingExpenses.fetchAll, que já traz tudo sem
  // paginação) pra buscar tudo de uma vez e filtrar no cliente.
  const fetchAllItems = useCallback(async () => {
    if (!isSupabaseConfigured) return [];
    const { data, error: err } = await supabase.from(ITEMS_TABLE).select("*");
    if (err) throw err;
    return (data || []).map(rowToExpenseItem);
  }, []);

  return { fetchItems, createExpenseItem, updateExpenseItem, deleteExpenseItem, fetchAllItems };
}
