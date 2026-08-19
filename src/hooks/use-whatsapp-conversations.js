import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// WhatsApp Fase 1 (19/08/2026) — deliberadamente só leitura. Nada escreve
// aqui ainda: sem número dedicado aprovado no Meta Business Manager nem
// template de mensagem homologado, não há como enviar nada de verdade (ver
// docs/design-spec-whatsapp-fase1.md). A tabela existe pronta pra ser
// populada pelo webhook real na Fase 2 — este hook só busca o que já
// existir, pra a aba no LeadDetailDrawer não ficar vazia sem motivo quando
// esse dia chegar.
export function useWhatsappConversation(leadId) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !leadId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: conversations, error: cErr } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cErr) throw cErr;
      const current = conversations?.[0] || null;
      setConversation(current);
      if (current) {
        const { data: msgs, error: mErr } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", current.id)
          .order("created_at", { ascending: true });
        if (mErr) throw mErr;
        setMessages(msgs || []);
      } else {
        setMessages([]);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { conversation, messages, loading, error, refetch: fetchAll };
}

export default useWhatsappConversation;
