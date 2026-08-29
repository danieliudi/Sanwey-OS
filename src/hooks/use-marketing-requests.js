import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_requests";

function rowToRequest(r) {
  return {
    id:               r.id,
    requestNumber:    r.request_number ?? null,
    category:         r.category ?? "material",
    title:            r.title,
    description:      r.description ?? null,
    department:       r.department ?? null,
    requesterName:    r.requester_name ?? null,
    requesterEmail:   r.requester_email ?? null,
    requestType:      r.request_type ?? null,
    priority:         r.priority ?? "media",
    deadline:         r.deadline ?? null,
    companyIds:       Array.isArray(r.company_ids) ? r.company_ids : [],
    budget:           r.budget ?? null,
    approverName:     r.approver_name ?? null,
    status:           r.status ?? "pendente",
    rejectionReason:  r.rejection_reason ?? null,
    notes:            r.notes ?? null,
    approvedAt:       r.approved_at ?? null,
    approvedBy:       r.approved_by ?? null,
    deliverableId:    r.deliverable_id ?? null,
    taskId:           r.task_id ?? null,
    purchaseRequestId: r.purchase_request_id ?? null,
    emailError:       r.email_error ?? null,
    isDemo:           r.is_demo ?? false,
    createdAt:        r.created_at ?? null,
    updatedAt:        r.updated_at ?? null,
  };
}

function requestToRow(req, extras = {}) {
  return {
    request_number:   req.requestNumber ?? null,
    category:         req.category ?? "material",
    title:            req.title,
    description:      req.description ?? null,
    department:       req.department ?? null,
    requester_name:   req.requesterName ?? null,
    requester_email:  req.requesterEmail ?? null,
    request_type:     req.requestType ?? null,
    priority:         req.priority ?? "media",
    deadline:         req.deadline ?? null,
    company_ids:      req.companyIds ?? [],
    budget:           req.budget ?? null,
    approver_name:    req.approverName ?? null,
    status:           req.status ?? "pendente",
    rejection_reason: req.rejectionReason ?? null,
    notes:            req.notes ?? null,
    approved_at:      req.approvedAt ?? null,
    approved_by:      req.approvedBy ?? null,
    deliverable_id:   req.deliverableId ?? null,
    is_demo:          req.isDemo ?? false,
    ...extras,
  };
}

export function useMarketingRequests({ userId, role, roles, enabled = true } = {}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // roles[] cobre cargo adicional (ex: gerente_marketing como cargo
  // secundário) — role sozinho (cargo principal) fica só de fallback pra
  // chamadas antigas que ainda não passam o array.
  const roleList = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
  const canWrite = roleList.some(r => ["admin", "marketing", "gerente_marketing"].includes(r));

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
      setRequests((data || []).map(rowToRequest));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { if (enabled) fetchAll(); }, [fetchAll, enabled]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const channelName = `marketing_requests_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "INSERT") {
          setRequests(prev =>
            prev.some(r => r.id === payload.new.id)
              ? prev.map(r => r.id === payload.new.id ? rowToRequest(payload.new) : r)
              : [rowToRequest(payload.new), ...prev]
          );
        } else if (payload.eventType === "UPDATE") {
          setRequests(prev => prev.map(r => r.id === payload.new.id ? rowToRequest(payload.new) : r));
        } else if (payload.eventType === "DELETE") {
          setRequests(prev => prev.filter(r => r.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled]);

  const createRequest = useCallback(async (req) => {
    if (!isSupabaseConfigured) return null;
    const row = requestToRow(req);
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (err) throw err;
    const created = rowToRequest(data);
    setRequests(prev => prev.some(r => r.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, []);

  const updateRequest = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = requests.find(r => r.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const row = requestToRow(merged);
    // request_number só deve ir na escrita quando o patch pede explicitamente
    // (EditableProtocolNumber) — do contrário, qualquer edição de campo não
    // relacionado reenviaria o valor lido do estado local do componente (pode
    // estar desatualizado se outra pessoa mudou o número entretanto) e
    // dispararia à toa o trigger de sincronia do razão de protocolo, podendo
    // reverter silenciosamente um número já alterado por outra pessoa nesse
    // meio tempo (achado da auditoria).
    if (!("requestNumber" in patch)) delete row.request_number;
    const { data, error: err } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (err) throw err;
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar a solicitação — verifique suas permissões.");
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, [canWrite, requests]);

  const deleteRequest = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setRequests(prev => prev.filter(r => r.id !== id));
  }, [canWrite]);

  // Avisa o solicitante por e-mail (aprovado/rejeitado) via edge function —
  // nunca lança: falha de e-mail não pode desfazer uma aprovação/rejeição já
  // gravada. O erro fica em email_error (lido de volta do banco) pra tela
  // oferecer "tentar de novo" sem precisar re-aprovar/rejeitar.
  const sendStatusEmail = useCallback(async (id) => {
    try {
      const { data, error: err } = await supabase.functions.invoke("send-request-status-email", {
        body: { request_id: id },
      });
      const emailError = err ? (err.message || String(err)) : (data?.error || null);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, emailError } : r));
      return { ok: !emailError, error: emailError };
    } catch (e) {
      const emailError = e?.message || String(e);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, emailError } : r));
      return { ok: false, error: emailError };
    }
  }, []);

  // Cria a entrega e aprova a solicitação numa única transação no banco
  // (RPC approve_marketing_request) — substitui o antigo par
  // createDeliverable + approveRequest, que fazia 2 escritas separadas com
  // risco de deliverable órfão se a 2ª falhasse (achado da auditoria).
  const approveAndCreateDeliverable = useCallback(async (id, notes) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const { data, error: err } = await supabase.rpc("approve_marketing_request", {
      p_request_id: id,
      p_notes: notes || null,
    });
    if (err) throw err;
    const now = new Date().toISOString();
    setRequests(prev => prev.map(r =>
      r.id === id
        ? { ...r, status: "aprovado", approvedAt: now, approvedBy: userId ?? null, deliverableId: data ?? null }
        : r
    ));
    const emailResult = await sendStatusEmail(id);
    return { deliverableId: data, ...emailResult };
  }, [canWrite, userId, sendStatusEmail]);

  // Mesmo padrão de approveAndCreateDeliverable, mas cria uma tarefa interna
  // (marketing_tasks) em vez de uma entrega pra agência — escolha do
  // aprovador no momento de aprovar (ver approve_marketing_request_as_task).
  const approveAndCreateTask = useCallback(async (id, notes) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const { data, error: err } = await supabase.rpc("approve_marketing_request_as_task", {
      p_request_id: id,
      p_notes: notes || null,
    });
    if (err) throw err;
    const now = new Date().toISOString();
    setRequests(prev => prev.map(r =>
      r.id === id
        ? { ...r, status: "aprovado", approvedAt: now, approvedBy: userId ?? null, taskId: data ?? null }
        : r
    ));
    const emailResult = await sendStatusEmail(id);
    return { taskId: data, ...emailResult };
  }, [canWrite, userId, sendStatusEmail]);

  // Mesmo padrão de approveAndCreateTask, mas cria uma solicitação de compra
  // (marketing_purchase_requests) — único destino possível quando
  // category='compra' (sem escolha de Entrega/Tarefa, que só existe pra
  // Material de Marketing). Ver approve_marketing_request_as_purchase.
  const approveAndCreatePurchase = useCallback(async (id, notes) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const { data, error: err } = await supabase.rpc("approve_marketing_request_as_purchase", {
      p_request_id: id,
      p_notes: notes || null,
    });
    if (err) throw err;
    const now = new Date().toISOString();
    setRequests(prev => prev.map(r =>
      r.id === id
        ? { ...r, status: "aprovado", approvedAt: now, approvedBy: userId ?? null, purchaseRequestId: data ?? null }
        : r
    ));
    const emailResult = await sendStatusEmail(id);
    return { purchaseRequestId: data, ...emailResult };
  }, [canWrite, userId, sendStatusEmail]);

  // `.eq("status", "pendente")` + checagem de linha afetada — achado real de
  // QA adversarial (27/08/2026, Copiloto Fase 2): sem isso, um gestor
  // recusando uma solicitação que outro gestor já tinha aprovado por outro
  // caminho (aba diferente, fila de Pendências) sobrescrevia o status em
  // silêncio e ainda mandava e-mail de rejeição pro solicitante que já tinha
  // (ou ia ter) uma entrega/tarefa/compra criada — e uma falha de RLS também
  // engolia em silêncio, sem erro nenhum (mesma classe de bug já corrigida em
  // outros 11 hooks de update desta plataforma). O Postgres reavalia o WHERE
  // depois de travar a linha, então dois cliques concorrentes nunca fazem os
  // dois passarem — o 2º sempre vê 0 linhas afetadas.
  const rejectRequest = useCallback(async (id, reason) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const patch = {
      status:           "rejeitado",
      rejection_reason: reason ?? null,
    };
    const { data, error: err } = await supabase.from(TABLE).update(patch).eq("id", id).eq("status", "pendente").select();
    if (err) throw err;
    if (!data || data.length === 0) {
      throw new Error("Não foi possível recusar — a solicitação já foi decidida por outra pessoa, ou você não tem permissão.");
    }
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status: "rejeitado", rejectionReason: reason ?? null } : r
    ));
    return sendStatusEmail(id);
  }, [canWrite, sendStatusEmail]);

  const loadDemoRequests = useCallback(async (demoRequests) => {
    if (!isSupabaseConfigured) return;
    const rows = demoRequests.map(r => requestToRow({ ...r, isDemo: true }));
    for (let i = 0; i < rows.length; i += 10) {
      const chunk = rows.slice(i, i + 10);
      await supabase.from(TABLE).upsert(chunk, { onConflict: "id" });
    }
    await fetchAll();
  }, [fetchAll]);

  const clearDemoRequests = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.from(TABLE).delete().eq("is_demo", true);
    setRequests(prev => prev.filter(r => !r.isDemo));
  }, []);

  return {
    requests,
    loading,
    error,
    canWrite,
    createRequest,
    updateRequest,
    deleteRequest,
    approveAndCreateDeliverable,
    approveAndCreateTask,
    approveAndCreatePurchase,
    rejectRequest,
    sendStatusEmail,
    loadDemoRequests,
    clearDemoRequests,
    refetch: fetchAll,
  };
}
