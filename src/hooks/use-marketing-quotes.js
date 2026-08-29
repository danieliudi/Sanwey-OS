import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const TABLE = "marketing_supplier_quotes";

function rowToQuote(r) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    supplier: r.marketing_suppliers ? {
      id: r.marketing_suppliers.id,
      name: r.marketing_suppliers.name,
      email: r.marketing_suppliers.email,
      category: r.marketing_suppliers.category,
    } : null,
    companyIds: Array.isArray(r.company_ids) ? r.company_ids : [],
    title: r.title,
    description: r.description ?? null,
    deadline: r.deadline ?? null,
    status: r.status ?? "pendente",
    requestedBy: r.requested_by ?? null,
    approvedBy: r.approved_by ?? null,
    approvedAt: r.approved_at ?? null,
    rejectedReason: r.rejected_reason ?? null,
    sentAt: r.sent_at ?? null,
    emailError: r.email_error ?? null,
    responseNotes: r.response_notes ?? null,
    // numeric vem como string do PostgREST — coage pra número aqui (senão
    // formatBRL exibia "R$ 0" e qualquer soma quebrava). Achado da auditoria.
    responseValue: r.response_value != null ? Number(r.response_value) : null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

function quoteToRow(q, extras = {}) {
  return {
    supplier_id: q.supplierId,
    company_ids: q.companyIds ?? [],
    title: q.title,
    description: q.description ?? null,
    deadline: q.deadline ?? null,
    ...extras,
  };
}

const SELECT = "*, marketing_suppliers(id, name, email, category)";

export function useMarketingQuotes({ userId, role, roles, enabled = true } = {}) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  // roles[] cobre cargo adicional (ex: gerente_marketing como cargo
  // secundário) — role sozinho (cargo principal) fica só de fallback pra
  // chamadas antigas que ainda não passam o array.
  const roleList = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
  const canWrite = roleList.some(r => ["admin", "marketing", "gerente_marketing"].includes(r));
  const canApprove = roleList.some(r => ["admin", "gerente_marketing"].includes(r));

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setQuotes((data || []).map(rowToQuote));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`marketing-quotes-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createQuote = useCallback(async (quote) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = quoteToRow(quote, { requested_by: userId ?? null, status: "pendente" });
    const { data, error: err } = await supabase.from(TABLE).insert(row).select(SELECT).single();
    if (err) throw err;
    const created = rowToQuote(data);
    setQuotes(prev => [created, ...prev]);
    return created;
  }, [canWrite, userId]);

  // Aprova (RPC atômica) e, se der certo, chama a edge function que
  // efetivamente manda o e-mail pro fornecedor. Se o envio falhar, a
  // cotação fica "aprovada" com email_error preenchido — dá pra tentar de
  // novo com resendQuoteEmail sem reaprovar.
  const approveAndSendQuote = useCallback(async (id) => {
    if (!canApprove) return { ok: false, error: "Sem permissão para aprovar" };
    const { error: rpcErr } = await supabase.rpc("approve_marketing_quote", { p_quote_id: id });
    if (rpcErr) return { ok: false, error: rpcErr.message };
    return resendQuoteEmail(id);
  }, [canApprove]); // eslint-disable-line react-hooks/exhaustive-deps

  const resendQuoteEmail = useCallback(async (id) => {
    if (!canApprove) return { ok: false, error: "Sem permissão para enviar" };
    setSendingId(id);
    try {
      const { data, error: err } = await supabase.functions.invoke("send-quote-request", {
        body: { quote_id: id },
      });
      if (err) return { ok: false, error: err.message };
      if (data?.error) return { ok: false, error: data.error };
      await fetchAll();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    } finally {
      setSendingId(null);
    }
  }, [canApprove, fetchAll]);

  const rejectQuote = useCallback(async (id, reason) => {
    if (!canApprove) return { ok: false, error: "Sem permissão para rejeitar" };
    const { error: err } = await supabase.rpc("reject_marketing_quote", { p_quote_id: id, p_reason: reason || null });
    if (err) return { ok: false, error: err.message };
    return { ok: true };
  }, [canApprove]);

  const recordResponse = useCallback(async (id, { notes, value }) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { data, error: err } = await supabase.from(TABLE).update({
      status: "respondida",
      response_notes: notes ?? null,
      response_value: value ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select();
    if (err) throw err;
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível registrar a resposta da cotação — verifique suas permissões.");
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: "respondida", responseNotes: notes ?? null, responseValue: value ?? null } : q));
  }, [canWrite]);

  const deleteQuote = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setQuotes(prev => prev.filter(q => q.id !== id));
  }, [canWrite]);

  return {
    quotes, loading, error, canWrite, canApprove, sendingId,
    createQuote, approveAndSendQuote, resendQuoteEmail, rejectQuote, recordResponse, deleteQuote,
    refetch: fetchAll,
  };
}

export default useMarketingQuotes;
