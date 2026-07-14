import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_purchase_requests";

export const PURCHASE_STAGES = [
  { id: "solicitado",         name: "Solicitado" },
  { id: "aprovado",           name: "Aprovado" },
  { id: "pedido_fornecedor",  name: "Pedido ao Fornecedor" },
  { id: "entrega_parcial",    name: "Entrega Parcial" },
  { id: "entregue",           name: "Entregue" },
  { id: "pago",               name: "Pago", terminal: true },
];

// "Rejeitado" existe no banco mas não aparece como coluna do kanban — só é
// alcançado via reject_purchase_request (ação, não drag-and-drop).
export const PURCHASE_REJECTED_STAGE = "rejeitado";

function rowToPurchase(r) {
  return {
    id:              r.id,
    requestNumber:   r.request_number,
    itemName:        r.item_name,
    description:     r.description,
    supplierId:      r.supplier_id ?? null,
    quantity:        r.quantity != null ? Number(r.quantity) : null,
    unitPrice:       r.unit_price != null ? Number(r.unit_price) : null,
    totalValue:      r.total_value != null ? Number(r.total_value) : null,
    stage:           r.stage,
    stageChangedAt:  r.stage_changed_at,
    requesterName:   r.requester_name,
    requesterEmail:  r.requester_email,
    requesterPhone:  r.requester_phone,
    requestedBy:     r.requested_by ?? null,
    responsibleId:   r.responsible_id ?? null,
    responsibleIds:  Array.isArray(r.responsible_ids) ? r.responsible_ids : (r.responsible_id ? [r.responsible_id] : []),
    approvedBy:      r.approved_by ?? null,
    approvedAt:      r.approved_at,
    rejectedReason:  r.rejected_reason,
    dueDate:         r.due_date,
    invoiceDate:     r.invoice_date,
    invoiceUrl:      r.invoice_url,
    companyIds:      Array.isArray(r.company_ids) ? r.company_ids : [],
    notes:           Array.isArray(r.notes) ? r.notes : [],
    expenseId:       r.expense_id ?? null,
    createdBy:       r.created_by ?? null,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  };
}

function purchaseToRow(p) {
  const row = {};
  if (p.itemName !== undefined)       row.item_name = p.itemName;
  if (p.description !== undefined)    row.description = p.description || null;
  if (p.supplierId !== undefined)     row.supplier_id = p.supplierId || null;
  if (p.quantity !== undefined)       row.quantity = p.quantity === "" ? null : p.quantity;
  if (p.unitPrice !== undefined)      row.unit_price = p.unitPrice === "" ? null : p.unitPrice;
  if (p.totalValue !== undefined)     row.total_value = p.totalValue === "" ? null : p.totalValue;
  if (p.stage !== undefined)          row.stage = p.stage;
  // Requester/solicitante — precisavam estar aqui pra "Nova solicitação"
  // interna (ComprasMarketingView) gravar quem pediu; faltavam nesta direção
  // (rowToPurchase acima já os lia de volta normalmente).
  if (p.requesterName !== undefined)  row.requester_name = p.requesterName || null;
  if (p.requesterEmail !== undefined) row.requester_email = p.requesterEmail || null;
  if (p.requesterPhone !== undefined) row.requester_phone = p.requesterPhone || null;
  if (p.requestedBy !== undefined)    row.requested_by = p.requestedBy || null;
  if (p.responsibleId !== undefined)  row.responsible_id = p.responsibleId || null;
  if (p.responsibleIds !== undefined) row.responsible_ids = p.responsibleIds || [];
  if (p.dueDate !== undefined)        row.due_date = p.dueDate || null;
  if (p.invoiceDate !== undefined)    row.invoice_date = p.invoiceDate || null;
  if (p.invoiceUrl !== undefined)     row.invoice_url = p.invoiceUrl || null;
  if (p.companyIds !== undefined)     row.company_ids = p.companyIds || [];
  if (p.notes !== undefined)          row.notes = p.notes || [];
  return row;
}

export function useMarketingPurchaseRequests({ enabled = true } = {}) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading]     = useState(isSupabaseConfigured && enabled);
  const [error, setError]         = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setPurchases((data || []).map(rowToPurchase));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const channelName = `marketing_purchase_requests_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "INSERT") {
          setPurchases(prev => prev.some(p => p.id === payload.new.id) ? prev : [rowToPurchase(payload.new), ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setPurchases(prev => prev.map(p => p.id === payload.new.id ? rowToPurchase(payload.new) : p));
        } else if (payload.eventType === "DELETE") {
          setPurchases(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled]);

  const createPurchase = useCallback(async (purchase) => {
    if (!isSupabaseConfigured) return null;
    const row = purchaseToRow(purchase);
    const { data, error: err } = await supabase.from(TABLE).insert(row).select().single();
    if (err) throw err;
    return rowToPurchase(data);
  }, []);

  const updatePurchase = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) return;
    const row = purchaseToRow(patch);
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    const { error: err } = await supabase.from(TABLE).update(row).eq("id", id);
    if (err) {
      setError(err.message || String(err));
      fetchAll();
      throw err;
    }
  }, [fetchAll]);

  const deletePurchase = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setPurchases(prev => prev.filter(p => p.id !== id));
  }, []);

  // Aprovação/rejeição passam pela RPC (gate de gerente_marketing/admin
  // aplicado no servidor, ver approve_purchase_request/reject_purchase_request).
  const approvePurchase = useCallback(async (id, responsibleId) => {
    if (!isSupabaseConfigured) return;
    const { data, error: err } = await supabase.rpc("approve_purchase_request", { p_id: id, p_responsible_id: responsibleId || null });
    if (err) throw err;
    const row = rowToPurchase(data);
    setPurchases(prev => prev.map(p => p.id === id ? row : p));
    return row;
  }, []);

  const rejectPurchase = useCallback(async (id, reason) => {
    if (!isSupabaseConfigured) return;
    const { data, error: err } = await supabase.rpc("reject_purchase_request", { p_id: id, p_reason: reason || null });
    if (err) throw err;
    const row = rowToPurchase(data);
    setPurchases(prev => prev.map(p => p.id === id ? row : p));
    return row;
  }, []);

  // Comparação "valor pago no ano passado" (item 3 do pedido) — última
  // compra paga pro mesmo fornecedor + mesmo item.
  const getLastPurchasePrice = useCallback(async (supplierId, itemName) => {
    if (!isSupabaseConfigured || !supplierId || !itemName) return null;
    const { data, error: err } = await supabase.rpc("get_supplier_last_purchase_price", {
      p_supplier_id: supplierId,
      p_item_name: itemName,
    });
    if (err) throw err;
    return data && data[0] ? data[0] : null;
  }, []);

  return {
    purchases,
    loading,
    error,
    createPurchase,
    updatePurchase,
    deletePurchase,
    approvePurchase,
    rejectPurchase,
    getLastPurchasePrice,
    refetch: fetchAll,
  };
}
