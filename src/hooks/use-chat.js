import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const MESSAGES_TABLE = "chat_messages";
// O payload do Realtime não traz relacionamento — o autor vem por este join.
const MESSAGE_SELECT = "id, channel_id, author_id, body, attachments, created_at, edited_at, author:profiles(id, name, initials, avatar_bg)";

function rowToChannel(r) {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name ?? null,
    icon: r.icon ?? null,
    description: r.description ?? null,
    readOnly: Boolean(r.read_only),
    updatedAt: r.updated_at ?? null,
    lastReadAt: r.last_read_at ?? null,
    archivedAt: r.archived_at ?? null,
    unreadCount: Number(r.unread_count) || 0,
    lastMessageBody: r.last_message_body ?? null,
    lastMessageAt: r.last_message_at ?? null,
    lastMessageAuthor: r.last_message_author ?? null,
    dmPeerId: r.dm_peer_id ?? null,
    dmPeerName: r.dm_peer_name ?? null,
    dmPeerInitials: r.dm_peer_initials ?? null,
    dmPeerAvatarBg: r.dm_peer_avatar_bg ?? null,
  };
}

function rowToMessage(r) {
  const author = r.author || null;
  return {
    id: r.id,
    channelId: r.channel_id,
    authorId: r.author_id ?? null,
    authorName: author?.name ?? null,
    authorInitials: author?.initials ?? null,
    authorAvatarBg: author?.avatar_bg ?? null,
    body: r.body,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    createdAt: r.created_at,
    editedAt: r.edited_at ?? null,
  };
}

// Réplica mínima de channelTitle/attachment labels de ChatView.jsx — só o
// necessário pro toast (spec seção 5), que não tem acesso ao componente de
// tela (dispara de dentro do hook, reaproveitando o mesmo evento Realtime
// que já atualiza unreadCount).
function channelDisplayName(channel) {
  if (!channel) return "Conversa";
  if (channel.kind === "dm") return channel.dmPeerName || "Conversa";
  return channel.name || "Canal";
}

function messagePreviewLabel(message) {
  if (message.body) return message.body;
  const first = message.attachments?.[0];
  if (!first) return "";
  if (first.type === "sticker") return "Figurinha";
  if (first.type === "audio") return "Mensagem de áudio";
  return "Anexo enviado";
}

function rowToDmCandidate(r) {
  return {
    id: r.id,
    name: r.name,
    initials: r.initials ?? null,
    avatarBg: r.avatar_bg ?? null,
    avatarUrl: r.avatar_url ?? null,
    jobTitle: r.job_title ?? null,
    department: r.department ?? null,
  };
}

// Chat interno. Sem fallback local (ao contrário de use-clients): conversa
// entre pessoas não faz sentido offline — sem Supabase o hook fica vazio.
export function useChat({ userId } = {}) {
  const [channels, setChannels] = useState([]);
  const [dmCandidates, setDmCandidates] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  // Sinal do toast Nível 1 (spec seção 5) — um objeto novo a cada mensagem
  // recebida de outra pessoa, pra quem consome (App.jsx) reagir com um
  // useEffect ainda que o conteúdo textual se repita.
  const [incomingMessage, setIncomingMessage] = useState(null);
  const activeRef = useRef(true);
  const channelsRef = useRef(channels);
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  const enabled = isSupabaseConfigured && Boolean(userId);

  const fetchChannels = useCallback(async () => {
    if (!enabled) { setChannels([]); setLoading(false); return; }
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase.rpc("chat_my_channels");
      if (err) throw err;
      if (!activeRef.current) return;
      setChannels((data || []).map(rowToChannel));
    } catch (e) {
      if (!activeRef.current) return;
      setError(e);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    activeRef.current = true;
    if (!enabled) { setChannels([]); setLoading(false); return () => { activeRef.current = false; }; }
    fetchChannels();
    const debouncedFetch = debounce(() => { if (activeRef.current) fetchChannels(); }, 400);
    // Toast Nível 1 (spec seção 5) — reaproveita o MESMO evento Realtime que
    // já dispara o debouncedFetch acima (não abre uma segunda subscription
    // só pra saber "chegou mensagem nova"). Só busca a linha completa (join
    // de autor) quando é de fato um INSERT de outra pessoa — update/delete e
    // mensagem própria não geram toast.
    const notifyIncoming = async (payload) => {
      if (payload.eventType !== "INSERT" || !payload.new || payload.new.author_id === userId) return;
      const { data } = await supabase
        .from(MESSAGES_TABLE)
        .select(MESSAGE_SELECT)
        .eq("id", payload.new.id)
        .maybeSingle();
      if (!activeRef.current) return;
      const message = rowToMessage(data || payload.new);
      const channel = channelsRef.current.find(c => c.id === message.channelId);
      setIncomingMessage({
        messageId: message.id,
        channelId: message.channelId,
        channelName: channelDisplayName(channel),
        senderName: message.authorName,
        senderInitials: message.authorInitials,
        senderAvatarBg: message.authorAvatarBg,
        preview: messagePreviewLabel(message),
        at: Date.now(),
      });
    };
    // Nome de canal único por instância — nome determinístico repetido entre
    // dois hooks derruba a conexão Realtime.
    const channelName = `chat-channels-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: MESSAGES_TABLE }, (payload) => {
        debouncedFetch();
        notifyIncoming(payload);
      })
      .subscribe();
    return () => {
      activeRef.current = false;
      debouncedFetch.cancel();
      supabase.removeChannel(channel);
    };
  }, [enabled, fetchChannels, userId]);

  useEffect(() => {
    if (!enabled) { setDmCandidates([]); return; }
    let alive = true;
    (async () => {
      const { data, error: err } = await supabase.rpc("chat_dm_candidates");
      if (!alive || err) return;
      setDmCandidates((data || []).map(rowToDmCandidate));
    })();
    return () => { alive = false; };
  }, [enabled]);

  const sendMessage = useCallback(async (channelId, body, attachments = []) => {
    const text = (body || "").trim();
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!channelId || (!text && !hasAttachments)) return null;
    const { data, error: err } = await supabase
      .from(MESSAGES_TABLE)
      .insert({ channel_id: channelId, author_id: userId, body: text, attachments: hasAttachments ? attachments : [] })
      .select(MESSAGE_SELECT)
      .single();
    if (err) throw err;
    return rowToMessage(data);
  }, [userId]);

  const markRead = useCallback(async (channelId) => {
    if (!enabled || !channelId) return;
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, unreadCount: 0 } : c));
    const { error: err } = await supabase.rpc("chat_mark_read", { p_channel: channelId });
    if (err) { setError(err); fetchChannels(); }
  }, [enabled, fetchChannels]);

  const startDm = useCallback(async (targetUserId) => {
    const { data, error: err } = await supabase.rpc("chat_start_dm", { p_target: targetUserId });
    if (err) throw err;
    await fetchChannels();
    return data;
  }, [fetchChannels]);

  const createChannel = useCallback(async ({ name, icon, description, memberIds, readOnly } = {}) => {
    const { data, error: err } = await supabase.rpc("chat_create_channel", {
      p_name: name,
      p_icon: icon ?? null,
      p_description: description ?? null,
      p_member_ids: Array.isArray(memberIds) ? memberIds : [],
      p_read_only: Boolean(readOnly),
    });
    if (err) throw err;
    await fetchChannels();
    return data;
  }, [fetchChannels]);

  // Arquivamento por participante (spec seção 2) — mesmo caminho de update
  // direto na própria linha que markRead já usa pra last_read_at (a policy
  // chat_members_update_self não distingue coluna).
  const archiveChannel = useCallback(async (channelId) => {
    if (!enabled || !channelId) return;
    const now = new Date().toISOString();
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, archivedAt: now } : c));
    const { error: err } = await supabase
      .from("chat_channel_members")
      .update({ archived_at: now })
      .eq("channel_id", channelId)
      .eq("user_id", userId);
    if (err) { setError(err); fetchChannels(); }
  }, [enabled, userId, fetchChannels]);

  const unarchiveChannel = useCallback(async (channelId) => {
    if (!enabled || !channelId) return;
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, archivedAt: null } : c));
    const { error: err } = await supabase
      .from("chat_channel_members")
      .update({ archived_at: null })
      .eq("channel_id", channelId)
      .eq("user_id", userId);
    if (err) { setError(err); fetchChannels(); }
  }, [enabled, userId, fetchChannels]);

  // Arquivado = silenciado (decisão do Daniel) — não conta no badge fora da
  // tela de Chat, mesmo com mensagens não lidas.
  const totalUnread = useMemo(
    () => channels.reduce((sum, c) => sum + (c.archivedAt ? 0 : (c.unreadCount || 0)), 0),
    [channels],
  );

  return useMemo(() => ({
    channels,
    dmCandidates,
    totalUnread,
    incomingMessage,
    loading,
    error,
    sendMessage,
    markRead,
    startDm,
    createChannel,
    archiveChannel,
    unarchiveChannel,
    refetch: fetchChannels,
  }), [channels, dmCandidates, totalUnread, incomingMessage, loading, error, sendMessage, markRead, startDm, createChannel, archiveChannel, unarchiveChannel, fetchChannels]);
}

export function useChannelMessages(channelId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const activeRef = useRef(true);

  const enabled = isSupabaseConfigured && Boolean(channelId);

  const fetchMessages = useCallback(async () => {
    if (!enabled) { setMessages([]); setLoading(false); return; }
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from(MESSAGES_TABLE)
        .select(MESSAGE_SELECT)
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (err) throw err;
      if (!activeRef.current) return;
      setMessages((data || []).map(rowToMessage));
    } catch (e) {
      if (!activeRef.current) return;
      setError(e);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [enabled, channelId]);

  useEffect(() => {
    activeRef.current = true;
    if (!enabled) { setMessages([]); setLoading(false); return () => { activeRef.current = false; }; }
    fetchMessages();
    const channelName = `chat-messages-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: MESSAGES_TABLE, filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          if (!activeRef.current || !payload.new?.id) return;
          const { data } = await supabase
            .from(MESSAGES_TABLE)
            .select(MESSAGE_SELECT)
            .eq("id", payload.new.id)
            .maybeSingle();
          if (!activeRef.current) return;
          const message = rowToMessage(data || payload.new);
          setMessages(prev => prev.some(m => m.id === message.id) ? prev : [...prev, message]);
        },
      )
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [enabled, channelId, fetchMessages]);

  return useMemo(() => ({
    messages,
    loading,
    error,
    refetch: fetchMessages,
  }), [messages, loading, error, fetchMessages]);
}

export default useChat;
