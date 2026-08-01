import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, File, FileImage, FileSpreadsheet, FileText, Hash, Image, Lock,
  MessageSquare, Paperclip, Plus, Search, Send, Smile, Users, X,
} from "lucide-react";
import { useChat, useChannelMessages } from "../../hooks/use-chat";
import { useChatAttachments } from "../../hooks/use-chat-attachments";
import { useChatStickers } from "../../hooks/use-chat-stickers";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { supabase } from "../../lib/supabase";
import { Modal } from "../ui/Modal";
import { EmptyState } from "../ui/EmptyState";
import { CHAT_EMOJI_CATEGORIES } from "../../constants/chat-emojis";
import { findBannedWord } from "../../utils/language-filter";

const STICKERS_BUCKET = "chat-stickers";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp";

// Réplica local do vocabulário ícone-por-mimetype/formatBytes de
// LeadDetailDrawer.jsx:1756-1776 — 2ª ocorrência na plataforma (regra 4 do
// CLAUDE.md só manda extrair pra shared/ na 3ª).
const CHAT_FILE_ICON_MAP = {
  "application/pdf": FileText,
  "image/jpeg": FileImage,
  "image/png": FileImage,
  "image/gif": FileImage,
  "image/webp": FileImage,
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
};

function ChatFileIcon({ mimeType, size = 16 }) {
  const Icon = CHAT_FILE_ICON_MAP[mimeType] || File;
  return <Icon size={size} />;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MANAGER_ROLES = ["admin", "gerente", "gerente_marketing", "gerente_rh", "diretoria"];

function isManager(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  return roles.some(r => MANAGER_ROLES.includes(r));
}

function shortTimeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function channelTitle(channel) {
  if (!channel) return "";
  if (channel.kind === "dm") return channel.dmPeerName || "Conversa";
  return channel.name || "Canal";
}

// Avatar tingido (não sólido): `bg` vem do banco como cor saturada e ficaria
// ilegível com texto fixo nos dois temas — color-mix sobre var(--surface)
// mantém contraste no claro e no escuro.
function Avatar({ name, initials, bg, size = 30 }) {
  const label = initials || (name || "?").slice(0, 2).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        lineHeight: 1,
        background: bg ? `color-mix(in srgb, ${bg} 18%, var(--surface))` : "var(--surface-alt)",
        color: bg || "var(--text-dim)",
        border: "1px solid var(--border)",
      }}
    >
      {label}
    </div>
  );
}

function ChannelIcon({ channel, size = 30 }) {
  if (channel.kind === "dm") {
    return <Avatar name={channel.dmPeerName} initials={channel.dmPeerInitials} bg={channel.dmPeerAvatarBg} size={size} />;
  }
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        background: "var(--surface-alt)",
        color: "var(--text-dim)",
        border: "1px solid var(--border)",
      }}
    >
      {channel.icon || <Hash size={Math.round(size * 0.45)} />}
    </div>
  );
}

function UnreadBadge({ count }) {
  return (
    <span
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        minWidth: 17,
        height: 17,
        padding: "0 5px",
        background: "var(--danger)",
        color: "var(--on-accent)",
        fontSize: 10,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ChannelRow({ channel, selected, onSelect }) {
  const unread = channel.unreadCount > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(channel.id)}
      className="w-full flex items-center gap-2.5 px-2 py-2 text-left rounded-md transition-colors"
      style={{
        background: selected ? "var(--surface-alt)" : "transparent",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <ChannelIcon channel={channel} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="flex-1 truncate"
            style={{ fontSize: 13, fontWeight: unread ? 800 : 600, color: "var(--text)" }}
          >
            {channelTitle(channel)}
          </span>
          {channel.lastMessageAt && (
            <span className="shrink-0" style={{ fontSize: 10, color: "var(--text-faint)" }}>
              {shortTimeAgo(channel.lastMessageAt)}
            </span>
          )}
          {unread && <UnreadBadge count={channel.unreadCount} />}
        </div>
        <div className="truncate" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1 }}>
          {channel.lastMessageBody || "Sem mensagens ainda"}
        </div>
      </div>
    </button>
  );
}

// Card de anexo dentro da bolha — imagem inline (com URL assinada, bucket
// privado) ou card ícone+nome+tamanho pra outros tipos. Cores adaptam se é
// bolha própria (fundo var(--accent)) ou de terceiro (fundo var(--surface)).
function ChatAttachmentView({ attachment, own }) {
  const { getSignedUrl } = useChatAttachments();
  const [url, setUrl] = useState(null);
  const isSticker = attachment.type === "sticker";
  const isImage = isSticker || (attachment.mime || "").startsWith("image/");

  useEffect(() => {
    // Figurinha vive no bucket público chat-stickers — getPublicUrl é
    // síncrono (não é round-trip de rede), ao contrário do signed URL do
    // bucket privado chat-attachments usado pelos anexos de arquivo.
    if (isSticker) {
      const { data } = supabase.storage.from(STICKERS_BUCKET).getPublicUrl(attachment.path);
      setUrl(data?.publicUrl || null);
      return;
    }
    let alive = true;
    getSignedUrl(attachment.path).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [attachment.path, isSticker, getSignedUrl]);

  if (isImage) {
    if (!url) {
      return <div style={{ width: 160, height: 120, borderRadius: 12, background: own ? "rgba(255,255,255,0.15)" : "var(--surface-alt)" }} />;
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={attachment.name} style={{ maxWidth: 240, maxHeight: 240, borderRadius: 12, display: "block" }} />
      </a>
    );
  }

  const content = (
    <div
      className="flex items-center gap-2"
      style={{ padding: "6px 8px", borderRadius: 10, background: own ? "rgba(255,255,255,0.15)" : "var(--surface-alt)" }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 28, height: 28, borderRadius: 8, background: own ? "rgba(255,255,255,0.15)" : "var(--surface-alt)", color: own ? "var(--on-accent)" : "var(--text-dim)" }}
      >
        <ChatFileIcon mimeType={attachment.mime} size={14} />
      </div>
      <div className="min-w-0">
        <div className="truncate" style={{ fontSize: 12, fontWeight: 600, color: own ? "var(--on-accent)" : "var(--text)", maxWidth: 160 }}>
          {attachment.name}
        </div>
        <div style={{ fontSize: 10, color: own ? "var(--on-accent)" : "var(--text-faint)", opacity: own ? 0.85 : 1 }}>
          {formatBytes(attachment.size)}
        </div>
      </div>
    </div>
  );

  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{content}</a>
  ) : content;
}

function MessageBubble({ message, own }) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  return (
    <div className={`flex items-end gap-2${own ? " flex-row-reverse" : ""}`}>
      {!own && <Avatar name={message.authorName} initials={message.authorInitials} bg={message.authorAvatarBg} size={26} />}
      <div className="flex flex-col min-w-0" style={{ maxWidth: "78%", alignItems: own ? "flex-end" : "flex-start" }}>
        {!own && (
          <span className="truncate px-1" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", maxWidth: "100%" }}>
            {message.authorName || "Sistema"}
          </span>
        )}
        <div
          className="rounded-2xl px-3 py-2"
          style={{
            marginTop: 2,
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: own ? "var(--accent)" : "var(--surface)",
            color: own ? "var(--on-accent)" : "var(--text)",
            border: own ? "1px solid var(--accent)" : "1px solid var(--border)",
            borderBottomRightRadius: own ? 4 : 16,
            borderBottomLeftRadius: own ? 16 : 4,
          }}
        >
          {message.body && <div>{message.body}</div>}
          {attachments.length > 0 && (
            <div className="flex flex-col" style={{ gap: 6, marginTop: message.body ? 6 : 0 }}>
              {attachments.map((att, idx) => (
                <ChatAttachmentView key={att.path || idx} attachment={att} own={own} />
              ))}
            </div>
          )}
        </div>
        <span className="px-1" style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
          {shortTimeAgo(message.createdAt)}{message.editedAt ? " · (editado)" : ""}
        </span>
      </div>
    </div>
  );
}

// Casca compartilhada dos popovers do composer (emoji e figurinha) — mesmo
// padrão de posicionamento via portal de MoveStageMenu.jsx (position: fixed,
// cálculo por getBoundingClientRect do botão-gatilho, fecha em clique fora/
// scroll/resize/Escape). Abre pra cima, já que o composer fica sempre no
// rodapé da tela. Extraído aqui pra não reimplementar o mesmo cálculo de
// posição uma 2ª vez no mesmo arquivo (figurinha reaproveita, não copia).
function ComposerPopover({ anchorRef, open, onClose, width, children }) {
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (anchorRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      onClose();
    };
    const close = () => onClose();
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => { if (!open) setPos(null); }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !popRef.current) return;
    const btnRect = anchorRef.current.getBoundingClientRect();
    const popRect = popRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(btnRect.left, window.innerWidth - popRect.width - 8));
    setPos({ bottom: window.innerHeight - btnRect.top + 4, left });
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popRef}
      style={{
        position: "fixed",
        bottom: pos?.bottom,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-pop)",
        zIndex: 2000,
        width,
        padding: 10,
      }}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

function EmojiPopover({ anchorRef, open, onClose, onPick }) {
  return (
    <ComposerPopover anchorRef={anchorRef} open={open} onClose={onClose} width={288}>
      {CHAT_EMOJI_CATEGORIES.map((cat, i) => (
        <div key={cat.id}>
          <div
            style={{
              padding: i === 0 ? "8px 4px 4px" : "12px 4px 4px",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "var(--text-faint)",
            }}
          >
            {cat.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 32px)", gap: 2 }}>
            {cat.emojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                style={{ width: 32, height: 32, fontSize: 18, borderRadius: "var(--radius-sm)", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </ComposerPopover>
  );
}

// Grid 4 colunas de figurinhas — clique envia a mensagem na hora (não fica
// pendente como anexo de arquivo, ver spec seção b/e.2).
function StickerPopover({ anchorRef, open, onClose, stickers, getPublicUrl, onPick }) {
  return (
    <ComposerPopover anchorRef={anchorRef} open={open} onClose={onClose} width={300}>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {stickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 text-center" style={{ padding: 24 }}>
            <Image size={18} color="var(--text-faint)" />
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              Nenhuma figurinha disponível ainda.
            </span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {stickers.map(sticker => (
              <button
                key={sticker.id}
                type="button"
                title={sticker.name}
                onClick={() => onPick(sticker)}
                style={{
                  aspectRatio: "1", padding: 4, background: "var(--surface-alt)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-md)", cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <img
                  src={getPublicUrl(sticker.image_path)}
                  alt={sticker.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </ComposerPopover>
  );
}

function NewConversationModal({ open, onClose, candidates, onPick }) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setQuery(""); setBusyId(null); setError(null); }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(c => (c.name || "").toLowerCase().includes(q));
  }, [candidates, query]);

  const pick = async (candidate) => {
    setBusyId(candidate.id);
    setError(null);
    try {
      await onPick(candidate.id);
    } catch (e) {
      setError(e?.message || "Não foi possível iniciar a conversa.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova conversa" width={440}>
      <div className="px-6 py-4">
        {candidates.length === 0 ? (
          <div
            className="rounded-lg px-4 py-5 text-center"
            style={{ background: "var(--surface-alt)", color: "var(--text-dim)", fontSize: 13, lineHeight: 1.5 }}
          >
            Você ainda não tem contatos liberados para conversa direta. Fale pelos canais do seu setor.
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-faint)" }}
              />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por nome…"
                className="w-full py-2 rounded-md border outline-none"
                style={{
                  paddingLeft: 36,
                  paddingRight: 12,
                  fontSize: 13,
                  borderColor: "var(--border-strong)",
                  background: "var(--surface)",
                  color: "var(--text)",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
              />
            </div>

            {error && (
              <div
                className="rounded-md px-3 py-2 mb-2"
                style={{ background: "var(--danger-bg)", color: "var(--danger)", fontSize: 12 }}
              >
                {error}
              </div>
            )}

            <div className="flex flex-col" style={{ maxHeight: 320, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div className="px-1 py-4 text-center" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  Nenhum contato encontrado.
                </div>
              ) : (
                filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busyId != null}
                    onClick={() => pick(c)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 text-left rounded-md transition-colors"
                    style={{ background: "transparent", border: "none", cursor: busyId != null ? "default" : "pointer", opacity: busyId != null && busyId !== c.id ? 0.5 : 1 }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Avatar name={c.name} initials={c.initials} bg={c.avatarBg} size={30} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.name}</div>
                      {(c.jobTitle || c.department) && (
                        <div className="truncate" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                          {[c.jobTitle, c.department].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ChatView({ currentUser }) {
  const { channels, dmCandidates, loading, markRead, sendMessage, startDm } = useChat({ userId: currentUser?.id });
  const { uploadAttachment } = useChatAttachments();
  const { stickers, getPublicUrl: getStickerPublicUrl } = useChatStickers();
  const [selectedId, setSelectedId] = useState(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const feedRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const stickerBtnRef = useRef(null);
  const fileInputRef = useRef(null);

  const [shellRef, shellHeight] = useAvailableHeight(20, [loading]);

  const selected = useMemo(() => channels.find(c => c.id === selectedId) || null, [channels, selectedId]);
  const { messages, loading: messagesLoading } = useChannelMessages(selectedId);

  const canais = useMemo(() => channels.filter(c => c.kind === "canal"), [channels]);
  const diretas = useMemo(() => channels.filter(c => c.kind === "dm"), [channels]);

  const manager = isManager(currentUser);
  const readOnlyForMe = Boolean(selected?.readOnly) && !manager;

  useEffect(() => {
    setDraft("");
    setSendError(null);
    setPendingAttachments(prev => { prev.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); }); return []; });
    setEmojiOpen(false);
    setStickerOpen(false);
  }, [selectedId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, selectedId]);

  const handleSelect = (channelId) => {
    setSelectedId(channelId);
    setMobileShowThread(true);
    markRead(channelId);
  };

  const handleStartDm = async (targetId) => {
    const channelId = await startDm(targetId);
    setNewOpen(false);
    if (channelId) handleSelect(channelId);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if ((!text && pendingAttachments.length === 0) || !selectedId || sending) return;

    const banned = findBannedWord(text);
    if (banned) {
      setSendError("Essa mensagem tem uma palavra não permitida no Chat — ajuste antes de enviar.");
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const uploaded = [];
      for (const pending of pendingAttachments) {
        const record = await uploadAttachment(pending.file, selectedId);
        if (record) uploaded.push(record);
      }
      await sendMessage(selectedId, text, uploaded);
      pendingAttachments.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
      setDraft("");
      setPendingAttachments([]);
    } catch (e) {
      setSendError(e?.message || "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji) => {
    setDraft(d => d + emoji);
    textareaRef.current?.focus();
  };

  // Figurinha É a mensagem — envia direto ao clicar, sem passar pela preview
  // strip de anexo pendente (spec seção b/e.2).
  const handlePickSticker = async (sticker) => {
    setStickerOpen(false);
    if (!selectedId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(selectedId, "", [{ type: "sticker", path: sticker.image_path, name: sticker.name }]);
    } catch (e) {
      setSendError(e?.message || "Não foi possível enviar a figurinha.");
    } finally {
      setSending(false);
    }
  };

  const handleFilesSelected = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const accepted = files.filter(f => f.size <= MAX_ATTACHMENT_BYTES);
    if (accepted.length < files.length) {
      setSendError("Cada arquivo anexado pode ter no máximo 10 MB.");
    }
    const withPreview = accepted.map(file => ({
      file,
      previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setPendingAttachments(prev => [...prev, ...withPreview]);
  };

  const removePendingAttachment = (index) => {
    setPendingAttachments(prev => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const railGroup = (label, list) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="px-2 mb-1" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>
          {label}
        </div>
        <div className="flex flex-col gap-0.5">
          {list.map(c => (
            <ChannelRow key={c.id} channel={c} selected={c.id === selectedId} onSelect={handleSelect} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={shellRef}
      className="flex gap-3"
      style={{ height: shellHeight, minHeight: 0 }}
    >
      <aside
        className={`${mobileShowThread ? "hidden" : "flex"} lg:flex flex-col w-full lg:w-[240px] lg:shrink-0 rounded-lg border overflow-hidden`}
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="px-3 pt-3 pb-2 shrink-0">
          <h1 className="font-bold leading-tight mb-2" style={{ fontSize: 18, color: "var(--text)", letterSpacing: "-0.01em" }}>
            Chat
          </h1>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-md py-2 transition-opacity"
            style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={14} /> Nova conversa
          </button>
        </div>

        <div className="flex-1 px-1.5 pb-2" style={{ minHeight: 0, overflowY: "auto" }}>
          {loading ? (
            <div className="px-2 py-3" style={{ fontSize: 12, color: "var(--text-faint)" }}>Carregando conversas…</div>
          ) : channels.length === 0 ? (
            <div className="px-2 py-3" style={{ fontSize: 12, color: "var(--text-faint)" }}>Nenhuma conversa ainda.</div>
          ) : (
            <>
              {railGroup("Canais", canais)}
              {railGroup("Diretas", diretas)}
            </>
          )}
        </div>
      </aside>

      <section
        className={`${mobileShowThread ? "flex" : "hidden"} lg:flex flex-col flex-1 min-w-0 rounded-lg border overflow-hidden`}
        style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}
      >
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={MessageSquare}
              title={channels.length === 0 ? "Nenhuma conversa ainda" : "Selecione uma conversa"}
              description={
                channels.length === 0
                  ? "Assim que você fizer parte de um canal ou iniciar uma conversa direta, ela aparece aqui."
                  : "Escolha um canal ou uma conversa direta na lista ao lado."
              }
            />
          </div>
        ) : (
          <>
            <header
              className="flex items-center gap-2.5 px-3 py-2.5 border-b shrink-0"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <button
                type="button"
                onClick={() => setMobileShowThread(false)}
                title="Voltar"
                aria-label="Voltar"
                className="lg:hidden flex items-center justify-center rounded-md shrink-0"
                style={{ width: 28, height: 28, background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
              >
                <ArrowLeft size={17} />
              </button>
              <ChannelIcon channel={selected} size={32} />
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                  {channelTitle(selected)}
                </div>
                <div className="truncate flex items-center gap-1" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                  {selected.kind === "dm" ? (
                    <>
                      <Users size={11} /> Conversa direta
                    </>
                  ) : (
                    <>
                      {selected.readOnly && <Lock size={11} />}
                      {selected.description || "Canal"}
                    </>
                  )}
                </div>
              </div>
            </header>

            <div ref={feedRef} className="flex-1 flex flex-col gap-3 px-3 py-4" style={{ minHeight: 0, overflowY: "auto" }}>
              {messagesLoading && messages.length === 0 ? (
                <div className="text-center py-6" style={{ fontSize: 12, color: "var(--text-faint)" }}>Carregando mensagens…</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-6" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  Nenhuma mensagem por aqui ainda.
                </div>
              ) : (
                messages.map(m => (
                  <MessageBubble key={m.id} message={m} own={m.authorId === currentUser?.id} />
                ))
              )}
            </div>

            <div className="px-3 py-2.5 border-t shrink-0" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              {sendError && (
                <div
                  className="rounded-md px-3 py-1.5 mb-2"
                  style={{ background: "var(--danger-bg)", color: "var(--danger)", fontSize: 12 }}
                >
                  {sendError}
                </div>
              )}
              {readOnlyForMe ? (
                <div
                  className="flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5"
                  style={{ background: "var(--surface-alt)", color: "var(--text-faint)", fontSize: 12 }}
                >
                  <Lock size={12} /> Somente leitura — apenas a Direção publica neste canal
                </div>
              ) : (
                <>
                  {pendingAttachments.length > 0 && (
                    <div className="flex gap-2" style={{ overflowX: "auto", paddingBottom: 8 }}>
                      {pendingAttachments.map((pending, idx) => (
                        <div key={idx} style={{ position: "relative", flexShrink: 0 }}>
                          {pending.previewUrl ? (
                            <img
                              src={pending.previewUrl}
                              alt={pending.file.name}
                              style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}
                            />
                          ) : (
                            <div
                              className="flex items-center gap-2"
                              style={{ height: 64, minWidth: 120, padding: 8, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}
                            >
                              <ChatFileIcon mimeType={pending.file.type} />
                              <div className="min-w-0">
                                <div className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", maxWidth: 90 }}>
                                  {pending.file.name}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{formatBytes(pending.file.size)}</div>
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removePendingAttachment(idx)}
                            title="Remover anexo"
                            aria-label="Remover anexo"
                            className="flex items-center justify-center"
                            style={{
                              position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%",
                              background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)", cursor: "pointer",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }}
                            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <button
                      ref={emojiBtnRef}
                      type="button"
                      onClick={() => setEmojiOpen(v => !v)}
                      title="Emoji"
                      aria-label="Emoji"
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{
                        width: 32, height: 32, background: emojiOpen ? "var(--surface-alt)" : "transparent",
                        border: "none", color: emojiOpen ? "var(--accent)" : "var(--text-dim)", cursor: "pointer",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { if (!emojiOpen) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; } }}
                    >
                      <Smile size={18} />
                    </button>
                    <button
                      ref={stickerBtnRef}
                      type="button"
                      onClick={() => setStickerOpen(v => !v)}
                      title="Figurinha"
                      aria-label="Figurinha"
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{
                        width: 32, height: 32, background: stickerOpen ? "var(--surface-alt)" : "transparent",
                        border: "none", color: stickerOpen ? "var(--accent)" : "var(--text-dim)", cursor: "pointer",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { if (!stickerOpen) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; } }}
                    >
                      <Image size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Anexar arquivo"
                      aria-label="Anexar arquivo"
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{ width: 32, height: 32, background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                    >
                      <Paperclip size={18} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      accept={ATTACHMENT_ACCEPT}
                      onChange={e => { if (e.target.files?.length) handleFilesSelected(e.target.files); e.target.value = ""; }}
                    />
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={e => { setDraft(e.target.value); if (sendError) setSendError(null); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Escreva uma mensagem…"
                      rows={2}
                      className="flex-1 rounded-2xl border px-3.5 py-2.5 outline-none resize-none"
                      style={{ fontSize: 13, lineHeight: 1.4, borderColor: "var(--border)", background: "var(--surface-alt)", color: "var(--text)" }}
                      onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={(!draft.trim() && pendingAttachments.length === 0) || sending}
                      title="Enviar (Enter)"
                      className="flex items-center justify-center rounded-full shrink-0 transition-opacity"
                      style={{
                        width: 34,
                        height: 34,
                        background: "var(--accent)",
                        color: "var(--on-accent)",
                        border: "none",
                        cursor: (draft.trim() || pendingAttachments.length > 0) && !sending ? "pointer" : "default",
                        opacity: (draft.trim() || pendingAttachments.length > 0) && !sending ? 1 : 0.4,
                      }}
                    >
                      <Send size={14} />
                    </button>
                  </div>

                  <EmojiPopover
                    anchorRef={emojiBtnRef}
                    open={emojiOpen}
                    onClose={() => setEmojiOpen(false)}
                    onPick={insertEmoji}
                  />
                  <StickerPopover
                    anchorRef={stickerBtnRef}
                    open={stickerOpen}
                    onClose={() => setStickerOpen(false)}
                    stickers={stickers}
                    getPublicUrl={getStickerPublicUrl}
                    onPick={handlePickSticker}
                  />
                </>
              )}
            </div>
          </>
        )}
      </section>

      <NewConversationModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        candidates={dmCandidates}
        onPick={handleStartDm}
      />
    </div>
  );
}

export default ChatView;
