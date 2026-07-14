import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "notifications";
const LIMIT = 50;

// Notificações que precisam chegar a OUTRO usuário (hoje: @menção em
// comentário) — ao contrário de useNotifications (puramente local/
// localStorage, só o próprio navegador), esta fonte é persistida no banco
// e chega via Realtime pra sessão do destinatário real.
function rowToNotification(r) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link || null,
    read: Boolean(r.read_at),
    createdAt: r.created_at,
    server: true, // distingue de notificações locais na lista mesclada
  };
}

export function useServerNotifications({ currentUser } = {}) {
  const [notifications, setNotifications] = useState([]);
  const userId = currentUser?.id;

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setNotifications([]); return; }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (!error) setNotifications((data || []).map(rowToNotification));
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    const channel = supabase
      .channel(`notifications_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `recipient_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setNotifications(prev => prev.some(n => n.id === payload.new.id) ? prev : [rowToNotification(payload.new), ...prev].slice(0, LIMIT));
        } else if (payload.eventType === "UPDATE") {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? rowToNotification(payload.new) : n));
        } else if (payload.eventType === "DELETE") {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from(TABLE).update({ read_at: new Date().toISOString() }).eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from(TABLE).update({ read_at: new Date().toISOString() }).eq("recipient_id", userId).is("read_at", null);
  }, [userId]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    setNotifications([]);
    await supabase.from(TABLE).delete().eq("recipient_id", userId);
  }, [userId]);

  // Dispara notificação pros usuários @mencionados num comentário — chame
  // depois de salvar o comentário em si. `link` é um objeto genérico
  // { module, id } que o NotificationCenter usa pra navegar até o card.
  const notifyMentions = useCallback(async (mentionedIds, { title, body, link } = {}) => {
    if (!isSupabaseConfigured || !mentionedIds?.length) return;
    try {
      await supabase.rpc("create_mention_notifications", {
        p_recipient_ids: mentionedIds,
        p_type: "mention",
        p_title: title || "Você foi mencionado",
        p_body: body || null,
        p_link: link || null,
      });
    } catch {
      // Não bloqueia o fluxo de comentário por causa de notificação —
      // o comentário em si já foi salvo com sucesso antes desta chamada.
    }
  }, []);

  return { notifications, markRead, markAllRead, clearAll, notifyMentions, refetch: fetchAll };
}
