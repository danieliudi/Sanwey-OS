import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Assinatura eletrônica via D4Sign (item 12) — histórico de envios por
// domain/recordId (mesmo padrão genérico multi-domínio de rh_stage_history)
// + ação de enviar um documento já em Storage pra assinatura.

function rowToRequest(r) {
  return {
    id: r.id,
    domain: r.domain,
    recordId: r.record_id,
    status: r.status,
    signers: r.signers || [],
    sourceStoragePath: r.source_storage_path,
    d4signDocumentUuid: r.d4sign_document_uuid,
    signedFilePath: r.signed_file_path,
    sentAt: r.sent_at,
    signedAt: r.signed_at,
    lastWebhookEvent: r.last_webhook_event,
    lastWebhookAt: r.last_webhook_at,
    createdAt: r.created_at,
  };
}

export function useRHSignatureRequests({ domain, recordId, enabled = true } = {}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled || !domain || !recordId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("rh_signature_requests")
      .select("*")
      .eq("domain", domain)
      .eq("record_id", recordId)
      .order("created_at", { ascending: false });
    if (!error) setRequests((data || []).map(rowToRequest));
    setLoading(false);
  }, [domain, recordId, enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled || !domain || !recordId) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`rh-signature-requests-${domain}-${recordId}-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_signature_requests", filter: `record_id=eq.${recordId}` }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [domain, recordId, enabled, fetchAll]);

  const sendForSignature = useCallback(async ({ signers, sourceStoragePath, message }) => {
    setSending(true);
    setSendError(null);
    try {
      const { data, error } = await supabase.functions.invoke("d4sign-send", {
        body: {
          domain, recordId, signers,
          sourceStorageBucket: "rh-documentos-assinatura",
          sourceStoragePath, message,
        },
      });
      if (error) throw error;
      if (data?.configured === false) {
        throw new Error("D4Sign ainda não está configurado (faltam as credenciais no Supabase).");
      }
      if (data?.error) throw new Error(data.error);
      await fetchAll();
      return data;
    } catch (e) {
      setSendError(e.message || "Erro ao enviar para assinatura.");
      throw e;
    } finally {
      setSending(false);
    }
  }, [domain, recordId, fetchAll]);

  const uploadSourceDocument = useCallback(async (file) => {
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${domain}/${recordId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("rh-documentos-assinatura").upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    return path;
  }, [domain, recordId]);

  return { requests, loading, sending, sendError, sendForSignature, uploadSourceDocument, refetch: fetchAll };
}

export default useRHSignatureRequests;
