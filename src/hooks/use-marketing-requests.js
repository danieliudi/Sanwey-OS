import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_requests";

function rowToRequest(r) {
  return {
    id:              r.id,
    requestNumber:   r.request_number ?? null,
    title:           r.title,
    description:     r.description ?? null,
    department:      r.department ?? null,
    requesterName:   r.requester_name ?? null,
    requesterEmail:  r.requester_email ?? null,
    requestType:     r.request_type ?? null,
    priority:        r.priority ?? "media",
    deadline:        r.deadline ?? null,
    companyIds:      Array.isArray(r.company_ids) ? r.company_ids : [],
    status:          r.status ?? "pendente",
    rejectionReason: r.rejection_reason ?? null,
    notes:           r.notes ?? null,
    approvedAt:      r.approved_at ?? null,
    approvedBy:      r.approved_by ?? null,
    deliverableId:   r.deliverable_id ?? null,
    isDemo:          r.is_demo ?? false,
    createdAt:       r.created_at ?? null,
    updatedAt:       r.updated_at ?? null,
  };
}

function requestToRow(req, extras = {}) {
  return {
    request_number:   req.requestNumber ?? null,
    title:            req.title,
    description:      req.description ?? null,
    department:       req.department ?? null,
    requester_name:   req.requesterName ?? null,
    requester_email:  req.requesterEmail ?? null,
    request_type:     req.requestType ?? null,
    priority:         req.priority ?? "media",
    deadline:         req.deadline ?? null,
    company_ids:      req.companyIds ?? [],
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
    const { error: err } = await supabase.from(TABLE).update(row).eq("id", id);
    if (err) throw err;
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, [canWrite, requests]);

  const deleteRequest = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setRequests(prev => prev.filter(r => r.id !== id));
  }, [canWrite]);

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
    return data;
  }, [canWrite, userId]);

  const rejectRequest = useCallback(async (id, reason) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const patch = {
      status:           "rejeitado",
      rejection_reason: reason ?? null,
    };
    const { error: err } = await supabase.from(TABLE).update(patch).eq("id", id);
    if (err) throw err;
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status: "rejeitado", rejectionReason: reason ?? null } : r
    ));
  }, [canWrite]);

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
    rejectRequest,
    loadDemoRequests,
    clearDemoRequests,
    refetch: fetchAll,
  };
}
