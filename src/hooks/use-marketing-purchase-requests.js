import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_purchase_requests";

// slaDays: estimativas razoáveis pro fluxo de compras (decisão de produto,
// não técnica — docs/design-spec-analise-generica-kanbans.md §1.3), usadas
// só pela Análise genérica do board; trocar os números não exige outra
// mudança de código.
export const PURCHASE_STAGES = [
  { id: "solicitado",         name: "Solicitado",          slaDays: 2 },
  { id: "cotacao",            name: "Cotação",             slaDays: 5 },
  { id: "aprovado",           name: "Aprovado",             slaDays: 3 },
  { id: "pedido_fornecedor",  name: "Pedido ao Fornecedor", slaDays: 10 },
  { id: "entrega_parcial",    name: "Entrega Parcial",      slaDays: 7 },
  { id: "entregue",           name: "Entregue",             slaDays: 3 },
  { id: "pago",               name: "Pago", terminal: true, slaDays: 5 },
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
    activities:      Array.isArray(r.activities) ? r.activities : [],
    expenseId:       r.expense_id ?? null,
    createdBy:       r.created_by ?? null,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
    // Redesign da etapa "Cotação" + campos por etapa (item do usuário).
    quoteOptions:            Array.isArray(r.quote_options) ? r.quote_options : [],
    paymentTerms:            r.payment_terms ?? null,
    supplierOrderCode:       r.supplier_order_code ?? null,
    deliveryDeadline:        r.delivery_deadline ?? null,
    partialDeliveredQty:     r.partial_delivered_qty != null ? Number(r.partial_delivered_qty) : null,
    partialRemainingQty:     r.partial_remaining_qty != null ? Number(r.partial_remaining_qty) : null,
    partialNewDeadline:      r.partial_new_deadline ?? null,
    partialNotes:            r.partial_notes ?? null,
    invoiceNumber:           r.invoice_number ?? null,
    paymentControlNumber:    r.payment_control_number ?? null,
    deliveredAt:             r.delivered_at ?? null,
    receivedBy:              r.received_by ?? null,
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
  if (p.activities !== undefined)     row.activities = p.activities || [];
  if (p.quoteOptions !== undefined)         row.quote_options = p.quoteOptions || [];
  if (p.paymentTerms !== undefined)         row.payment_terms = p.paymentTerms || null;
  if (p.supplierOrderCode !== undefined)    row.supplier_order_code = p.supplierOrderCode || null;
  if (p.deliveryDeadline !== undefined)     row.delivery_deadline = p.deliveryDeadline || null;
  if (p.partialDeliveredQty !== undefined)  row.partial_delivered_qty = p.partialDeliveredQty === "" ? null : p.partialDeliveredQty;
  if (p.partialRemainingQty !== undefined)  row.partial_remaining_qty = p.partialRemainingQty === "" ? null : p.partialRemainingQty;
  if (p.partialNewDeadline !== undefined)   row.partial_new_deadline = p.partialNewDeadline || null;
  if (p.partialNotes !== undefined)         row.partial_notes = p.partialNotes || null;
  if (p.invoiceNumber !== undefined)        row.invoice_number = p.invoiceNumber || null;
  if (p.paymentControlNumber !== undefined) row.payment_control_number = p.paymentControlNumber || null;
  if (p.deliveredAt !== undefined)          row.delivered_at = p.deliveredAt || null;
  if (p.receivedBy !== undefined)           row.received_by = p.receivedBy || null;
  return row;
}

export function useMarketingPurchaseRequests({ enabled = true } = {}) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading]     = useState(isSupabaseConfigured && enabled);
  const [error, setError]         = useState(null);
  const purchasesRef = useRef([]);
  useEffect(() => { purchasesRef.current = purchases; }, [purchases]);

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
    const created = rowToPurchase(data);
    // Update otimista — não depender só do realtime (a publicação do banco
    // não tinha essa tabela até agora, então o card só aparecia com refresh
    // manual; ver migration enable_realtime_publication_all_tables).
    setPurchases(prev => prev.some(p => p.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, []);

  // Transições de etapa client-side (fora das RPCs approve/reject, que já
  // gravam `activities` no banco) precisam do mesmo registro de histórico —
  // centralizado aqui (não em cada chamador) porque tanto o drawer quanto o
  // drag-and-drop do board (ComprasMarketingView.attemptStageChange) chamam
  // updatePurchase direto pra mover de etapa.
  const updatePurchase = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) return;
    let effectivePatch = patch;
    if (patch.stage !== undefined && patch.activities === undefined) {
      const current = purchasesRef.current.find(p => p.id === id);
      const stageName = PURCHASE_STAGES.find(s => s.id === patch.stage)?.name || patch.stage;
      effectivePatch = {
        ...patch,
        activities: [
          ...(current?.activities || []),
          { type: "stage_change", description: `Movido para ${stageName}`, at: new Date().toISOString() },
        ],
      };
    }
    const row = purchaseToRow(effectivePatch);
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, ...effectivePatch } : p));
    const { data, error: err } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (err) {
      setError(err.message || String(err));
      fetchAll();
      throw err;
    }
    if (!data || data.length === 0) {
      const blocked = "Não foi possível salvar — sem permissão pra editar esta solicitação.";
      setError(blocked);
      fetchAll();
      throw new Error(blocked);
    }
  }, [fetchAll]);

  // "Duplicar card" (menu "..." dos boards) — mesmo raciocínio de
  // duplicateTask (use-marketing-tasks.js): cria uma solicitação NOVA, sempre
  // na 1ª etapa (PURCHASE_STAGES[0] = "solicitado"), nunca herdando nada do
  // ciclo de vida da compra original (requestNumber é sequência própria,
  // aprovação/rejeição e nota fiscal não fazem sentido numa solicitação que
  // ainda nem foi cotada). Também não copia quoteOptions/supplierOrderCode/
  // deliveryDeadline/partial* — são progresso de um ciclo de cotação/entrega
  // específico daquela solicitação, não do item em si.
  const duplicatePurchase = useCallback(async (source, requestedBy) => {
    return createPurchase({
      itemName:       `${source.itemName} (cópia)`,
      description:    source.description,
      quantity:       source.quantity,
      unitPrice:      source.unitPrice,
      totalValue:     source.totalValue,
      requesterName:  source.requesterName,
      requesterEmail: source.requesterEmail,
      requesterPhone: source.requesterPhone,
      requestedBy:    requestedBy ?? null,
      responsibleId:  source.responsibleId,
      responsibleIds: source.responsibleIds,
      dueDate:        source.dueDate,
      companyIds:     source.companyIds,
      stage:          "solicitado",
      // NÃO copiar: notes, activities, requestNumber, approvedBy/approvedAt/
      // rejectedReason, invoiceDate/invoiceUrl/invoiceNumber/expenseId/
      // paymentControlNumber, deliveredAt/receivedBy, quoteOptions,
      // supplierOrderCode, deliveryDeadline, partialDeliveredQty/
      // partialRemainingQty/partialNewDeadline/partialNotes.
      // NÃO copiar supplierId/paymentTerms: são o resultado de uma cotação
      // já concluída do ciclo original — sem quoteOptions (não copiado), a
      // cópia teria fornecedor pré-preenchido sem nenhuma cotação avaliada,
      // e approve_purchase_request reaprovaria esse fornecedor em silêncio
      // se ninguém trocar antes de aprovar (achado real de QA).
    });
  }, [createPurchase]);

  const deletePurchase = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setPurchases(prev => prev.filter(p => p.id !== id));
  }, []);

  // Aprovação/rejeição passam pela RPC (gate de gerente_marketing/admin
  // aplicado no servidor, ver approve_purchase_request/reject_purchase_request).
  const approvePurchase = useCallback(async (id, responsibleId, supplierId) => {
    if (!isSupabaseConfigured) return;
    const { data, error: err } = await supabase.rpc("approve_purchase_request", {
      p_id: id,
      p_responsible_id: responsibleId || null,
      p_supplier_id: supplierId || null,
    });
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
    duplicatePurchase,
    approvePurchase,
    rejectPurchase,
    getLastPurchasePrice,
    refetch: fetchAll,
  };
}
