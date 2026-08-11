import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "lead_emails";

function rowToEmail(r) {
  return {
    id: r.id,
    leadId: r.lead_id,
    templateId: r.template_id,
    toEmail: r.to_email,
    subject: r.subject,
    bodyHtml: r.body_html,
    sentBy: r.sent_by,
    sentAt: r.sent_at,
    status: r.status,
    errorMessage: r.error_message,
  };
}

// Histórico de envio real (via edge function send-crm-email, ver hook
// abaixo) — substitui o mailto: que só sabia dizer "iniciado". RLS de
// lead_emails espelha activities_select (mesma visibilidade do lead).
export function useLeadEmails(leadId) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !leadId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("lead_id", leadId)
      .order("sent_at", { ascending: false });
    if (!error) setEmails((data || []).map(rowToEmail));
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Retorna { success: true } ou { success: false, error }. Não lança —
  // quem chama decide como mostrar o erro (AppToast, mesmo padrão do resto
  // da plataforma).
  const sendEmail = useCallback(async ({ toEmail, subject, bodyHtml, templateId }) => {
    if (!isSupabaseConfigured || !leadId) return { success: false, error: "Não configurado." };
    setSending(true);
    setSendError(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-crm-email", {
        body: { leadId, toEmail, subject, bodyHtml, templateId: templateId || null },
      });
      if (error) {
        // supabase-js embrulha erro HTTP (4xx/5xx) em FunctionsHttpError —
        // o corpo real (com a mensagem em pt-BR da edge function) vem em
        // error.context, não em error.message (que só diz "Edge Function
        // returned a non-2xx status code").
        let msg = error.message;
        try {
          const parsed = await error.context?.json();
          if (parsed?.error) msg = parsed.error;
        } catch { /* corpo não era JSON — mantém a mensagem genérica */ }
        setSendError(msg);
        return { success: false, error: msg };
      }
      if (!data?.success) {
        setSendError(data?.error || "Falha ao enviar e-mail.");
        return { success: false, error: data?.error };
      }
      await fetchAll();
      return { success: true };
    } finally {
      setSending(false);
    }
  }, [leadId, fetchAll]);

  return { emails, loading, sending, sendError, sendEmail, refetch: fetchAll };
}

export default useLeadEmails;
