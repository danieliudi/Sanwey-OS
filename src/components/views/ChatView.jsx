import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive, ArchiveRestore, ArrowLeft, File, FileImage, FileSpreadsheet, FileText,
  Hash, Image, Lock, Mic, MessageSquare, Pause, Paperclip, Play, Plus, Search,
  Send, Smile, Users, X,
} from "lucide-react";
import { useChat, useChannelMessages } from "../../hooks/use-chat";
import { useChatAttachments } from "../../hooks/use-chat-attachments";
import { useChatStickers } from "../../hooks/use-chat-stickers";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { supabase } from "../../lib/supabase";
import { Modal } from "../ui/Modal";
import { EmptyState } from "../ui/EmptyState";
import { Combobox } from "../shared/Combobox";
import { CHAT_EMOJI_CATEGORIES } from "../../constants/chat-emojis";
import { findBannedWord } from "../../utils/language-filter";

const STICKERS_BUCKET = "chat-stickers";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp";

// Arrastar mais que isso pra esquerda antes de soltar o microfone cancela a
// gravação sem enviar (spec seção 4).
const AUDIO_CANCEL_DRAG_PX = 60;

function formatClock(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

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

// Mensagem de áudio (spec seção 4) — player com botão de play/pause sobre um
// <audio> nativo escondido; barra decorativa estática no lugar da forma de
// onda real (fora de escopo, spec seção 6).
function ChatAudioAttachment({ attachment, own }) {
  const { getSignedUrl } = useChatAttachments();
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getSignedUrl(attachment.path).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [attachment.path, getSignedUrl]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play().catch(() => {});
  };

  return (
    <div
      className="flex items-center gap-2"
      style={{ padding: "6px 8px", borderRadius: 10, background: own ? "rgba(255,255,255,0.15)" : "var(--surface-alt)", minWidth: 190 }}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={!url}
        title={playing ? "Pausar" : "Reproduzir áudio"}
        aria-label={playing ? "Pausar" : "Reproduzir áudio"}
        className="flex items-center justify-center shrink-0 rounded-full"
        style={{ width: 28, height: 28, border: "none", cursor: url ? "pointer" : "default", background: "var(--accent)", color: "var(--on-accent)" }}
      >
        {playing ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: 1 }} />}
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <div className="flex-1" style={{ height: 3, borderRadius: 2, background: own ? "rgba(255,255,255,0.35)" : "var(--border)" }} />
        <span className="shrink-0" style={{ fontSize: 10, color: own ? "var(--on-accent)" : "var(--text-faint)", opacity: own ? 0.85 : 1 }}>
          {formatClock(Math.round(attachment.durationSeconds || 0))}
        </span>
      </div>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          hidden
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </div>
  );
}

// Dispatcher — áudio tem seu próprio player (hooks/fetch dedicados, ver
// ChatAudioAttachment acima); os demais tipos seguem pro renderer abaixo.
// Fica num componente à parte (em vez de um `if` antes dos hooks de
// ChatFileOrImageAttachment) pra não violar a regra de hooks nem duplicar o
// fetch de signed URL do áudio.
function ChatAttachmentView({ attachment, own }) {
  if (attachment.type === "audio") {
    return <ChatAudioAttachment attachment={attachment} own={own} />;
  }
  return <ChatFileOrImageAttachment attachment={attachment} own={own} />;
}

// Card de anexo dentro da bolha — imagem inline (com URL assinada, bucket
// privado) ou card ícone+nome+tamanho pra outros tipos. Cores adaptam se é
// bolha própria (fundo var(--accent)) ou de terceiro (fundo var(--surface)).
function ChatFileOrImageAttachment({ attachment, own }) {
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
      <div className="flex flex-col min-w-0" style={{ maxWidth: "70%", alignItems: own ? "flex-end" : "flex-start" }}>
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

export function ChatView({ currentUser, initialChannelId, onInitialChannelConsumed }) {
  const {
    channels, dmCandidates, loading, markRead, sendMessage, startDm,
    archiveChannel, unarchiveChannel,
  } = useChat({ userId: currentUser?.id });
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
  // Filtros (spec seção 1) e "Arquivadas" (spec seção 2) — sem schema novo
  // pros filtros, `archivedAt` já vem pronto de use-chat.js.
  const [activeFilter, setActiveFilter] = useState("todas");
  const [showArchived, setShowArchived] = useState(false);
  // Gravação de áudio (spec seção 4).
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordCancelHint, setRecordCancelHint] = useState(false);
  const feedRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const stickerBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordStartXRef = useRef(null);
  const recordCancelRef = useRef(false);
  const recordSecondsRef = useRef(0);
  const recordTimerRef = useRef(null);
  const recordChannelIdRef = useRef(null);

  // No mobile, `MobileBottomNav` (App.jsx) fica fixa por cima dos últimos
  // 64px da viewport — abaixo do breakpoint "lg" (1024px, o mesmo usado por
  // ela e pela Sidebar). Ao contrário das telas de Kanban, que rolam a
  // página inteira e por isso ganham `pb-24` no wrapper, o Chat é um shell
  // de altura fixa sem scroll de página — então esse padding nunca ajuda, e
  // sem esse desconto o composer ficava com a base atrás da barra.
  const [isMobileNav, setIsMobileNav] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setIsMobileNav(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [shellRef, shellHeight] = useAvailableHeight(isMobileNav ? 84 : 20, [loading, isMobileNav]);

  const selected = useMemo(() => channels.find(c => c.id === selectedId) || null, [channels, selectedId]);
  const { messages, loading: messagesLoading } = useChannelMessages(selectedId);

  const archivedChannels = useMemo(() => channels.filter(c => c.archivedAt), [channels]);
  const activeChannels = useMemo(() => channels.filter(c => !c.archivedAt), [channels]);

  const filterCounts = useMemo(() => ({
    todas: activeChannels.length,
    "nao-lidas": activeChannels.filter(c => c.unreadCount > 0).length,
    canais: activeChannels.filter(c => c.kind === "canal").length,
    diretas: activeChannels.filter(c => c.kind === "dm").length,
  }), [activeChannels]);

  // Combobox único em vez de 4 pills lado a lado — na largura fixa de 240px
  // da sidebar, os 4 pills com selo de contagem não cabiam numa linha e
  // forçavam scroll horizontal (achado do Daniel, print de 03/08). Mesmo
  // componente já usado nos filtros do Funil de Vendas — a contagem entra
  // no próprio label em vez de badge separado, já que o Combobox não tem
  // slot pra isso.
  const filterOptions = useMemo(() => ([
    { value: "todas", label: `Todas · ${filterCounts.todas}` },
    { value: "nao-lidas", label: `Não lidas · ${filterCounts["nao-lidas"]}` },
    { value: "canais", label: `Canais · ${filterCounts.canais}` },
    { value: "diretas", label: `Diretas · ${filterCounts.diretas}` },
  ]), [filterCounts]);

  const filteredChannels = useMemo(() => {
    if (activeFilter === "nao-lidas") return activeChannels.filter(c => c.unreadCount > 0);
    if (activeFilter === "canais") return activeChannels.filter(c => c.kind === "canal");
    if (activeFilter === "diretas") return activeChannels.filter(c => c.kind === "dm");
    return activeChannels;
  }, [activeChannels, activeFilter]);

  const canais = useMemo(() => filteredChannels.filter(c => c.kind === "canal"), [filteredChannels]);
  const diretas = useMemo(() => filteredChannels.filter(c => c.kind === "dm"), [filteredChannels]);

  const manager = isManager(currentUser);
  const readOnlyForMe = Boolean(selected?.readOnly) && !manager;

  useEffect(() => {
    setDraft("");
    setSendError(null);
    setPendingAttachments(prev => { prev.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); }); return []; });
    setEmojiOpen(false);
    setStickerOpen(false);
    cancelActiveRecording();
  }, [selectedId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, selectedId]);

  const handleSelect = (channelId) => {
    setSelectedId(channelId);
    setMobileShowThread(true);
    setShowArchived(false);
    markRead(channelId);
  };

  // Deep-link vindo do toast de notificação (spec seção 5) — mesmo padrão já
  // usado em App.jsx pra campanha/funcionário (initialSelectedCampaignId):
  // consome o id assim que o canal aparece na lista e limpa de volta.
  useEffect(() => {
    if (!initialChannelId) return;
    if (!channels.some(c => c.id === initialChannelId)) return;
    handleSelect(initialChannelId);
    onInitialChannelConsumed?.();
  }, [initialChannelId, channels]);

  const handleToggleArchive = async () => {
    if (!selected) return;
    try {
      if (selected.archivedAt) {
        await unarchiveChannel(selected.id);
      } else {
        await archiveChannel(selected.id);
        setSelectedId(null);
        setMobileShowThread(false);
      }
    } catch (e) {
      setSendError(e?.message || "Não foi possível atualizar o arquivamento da conversa.");
    }
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

  // Mensagem de áudio (spec seção 4) — segurar o ícone de microfone grava,
  // soltar envia, arrastar mais de AUDIO_CANCEL_DRAG_PX pra esquerda antes de
  // soltar cancela sem enviar. Cobre mouse (desktop) e touch (mobile), sem
  // multi-touch/edge case exótico (fora de escopo, spec seção 6).
  const stopRecordingTracks = () => {
    clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    recordStreamRef.current?.getTracks().forEach(t => t.stop());
    recordStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const cancelActiveRecording = () => {
    if (!mediaRecorderRef.current) return;
    recordCancelRef.current = true;
    try { if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop(); } catch {}
    stopRecordingTracks();
    setRecording(false);
    setRecordCancelHint(false);
  };

  const startRecording = async (clientX) => {
    if (recording || readOnlyForMe || !selectedId || sending) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSendError("Este navegador não permite gravar áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : (MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "");
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      recordStreamRef.current = stream;
      recordChannelIdRef.current = selectedId;
      recordCancelRef.current = false;
      recordStartXRef.current = clientX;
      recordSecondsRef.current = 0;
      setRecordSeconds(0);
      setRecordCancelHint(false);
      setSendError(null);
      setRecording(true);
      recordTimerRef.current = setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);
      }, 1000);
    } catch (e) {
      setSendError("Não foi possível acessar o microfone.");
    }
  };

  const updateRecordingDrag = (clientX) => {
    if (recordStartXRef.current == null) return;
    const shouldCancel = (recordStartXRef.current - clientX) > AUDIO_CANCEL_DRAG_PX;
    recordCancelRef.current = shouldCancel;
    setRecordCancelHint(shouldCancel);
  };

  const finishRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    const canceled = recordCancelRef.current;
    const durationSeconds = recordSecondsRef.current;
    const channelId = recordChannelIdRef.current;

    await new Promise(resolve => {
      recorder.onstop = resolve;
      if (recorder.state !== "inactive") recorder.stop(); else resolve();
    });
    const chunks = audioChunksRef.current;
    // recorder.mimeType costuma vir com parâmetro de codec (ex.:
    // "audio/webm;codecs=opus") mesmo quando só "audio/webm" foi pedido —
    // o bucket (migration 20260815) só libera o mimetype base, sem esse
    // sufixo, então corta antes de subir.
    const baseMimeType = (recorder.mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
    stopRecordingTracks();
    setRecording(false);
    setRecordCancelHint(false);

    if (canceled || chunks.length === 0 || !channelId) return;

    const blob = new Blob(chunks, { type: baseMimeType });
    const ext = baseMimeType.includes("ogg") ? "ogg" : "webm";
    // `File` (maiúsculo) é o ícone importado de lucide-react no topo deste
    // arquivo — usa o construtor global explícito pra não colidir com ele.
    const file = new window.File([blob], `audio-${Date.now()}.${ext}`, { type: baseMimeType });

    setSending(true);
    setSendError(null);
    try {
      const record = await uploadAttachment(file, channelId);
      if (record) {
        await sendMessage(channelId, "", [{
          type: "audio", path: record.path, name: record.name,
          size: record.size, mime: record.mime, durationSeconds,
        }]);
      }
    } catch (e) {
      setSendError(e?.message || "Não foi possível enviar o áudio.");
    } finally {
      setSending(false);
    }
  };

  // Listeners globais só enquanto grava — o dedo/mouse não precisa continuar
  // sobre o botão pra arrastar-pra-cancelar funcionar.
  useEffect(() => {
    if (!recording) return;
    const onMove = (e) => updateRecordingDrag(e.touches ? e.touches[0].clientX : e.clientX);
    const onUp = () => finishRecording();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [recording]);

  useEffect(() => () => cancelActiveRecording(), []);

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
          {/* Desktop mantém o botão de header — no mobile ele vira o FAB
              fixo mais abaixo (spec seção 3), pra não competir por espaço
              com os chips de filtro logo abaixo. */}
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="hidden lg:flex w-full items-center justify-center gap-1.5 rounded-md py-2 transition-opacity"
            style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={14} /> Nova conversa
          </button>
        </div>

        {channels.length > 0 && (
          <div className="px-3 pb-2 shrink-0">
            <Combobox
              value={activeFilter}
              onChange={(key) => { setShowArchived(false); setActiveFilter(key); }}
              options={filterOptions}
              size="sm"
            />
          </div>
        )}

        <div className="flex-1 px-1.5 pb-2" style={{ minHeight: 0, overflowY: "auto" }}>
          {loading ? (
            <div className="px-2 py-3" style={{ fontSize: 12, color: "var(--text-faint)" }}>Carregando conversas…</div>
          ) : channels.length === 0 ? (
            <div className="px-2 py-3" style={{ fontSize: 12, color: "var(--text-faint)" }}>Nenhuma conversa ainda.</div>
          ) : showArchived ? (
            <>
              <button
                type="button"
                onClick={() => setShowArchived(false)}
                className="w-full flex items-center gap-1.5 px-1 py-2 mb-1 text-left"
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                <ArrowLeft size={14} /> Arquivadas
              </button>
              {archivedChannels.length === 0 ? (
                <div className="px-2 py-3" style={{ fontSize: 12, color: "var(--text-faint)" }}>Nenhuma conversa arquivada.</div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {archivedChannels.map(c => (
                    <ChannelRow key={c.id} channel={c} selected={c.id === selectedId} onSelect={handleSelect} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {archivedChannels.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className="w-full flex items-center gap-2 px-2 py-2 mb-2 text-left rounded-md"
                  style={{ background: "var(--surface-alt)", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.97)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
                >
                  <Archive size={14} style={{ color: "var(--text-dim)" }} />
                  <span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>Arquivadas</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)" }}>{archivedChannels.length}</span>
                </button>
              )}
              {canais.length === 0 && diretas.length === 0 ? (
                <div className="px-2 py-3" style={{ fontSize: 12, color: "var(--text-faint)" }}>Nenhuma conversa neste filtro.</div>
              ) : (
                <>
                  {railGroup("Canais", canais)}
                  {railGroup("Diretas", diretas)}
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {!mobileShowThread && (
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          title="Nova conversa"
          aria-label="Nova conversa"
          className="lg:hidden fixed flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{
            bottom: 80, right: 20, width: 52, height: 52, zIndex: 40,
            background: "var(--accent)", color: "var(--on-accent)",
            border: "none", boxShadow: "var(--shadow-pop)", cursor: "pointer",
          }}
        >
          <Plus size={22} />
        </button>
      )}

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
              <button
                type="button"
                onClick={handleToggleArchive}
                title={selected.archivedAt ? "Desarquivar conversa" : "Arquivar conversa"}
                aria-label={selected.archivedAt ? "Desarquivar conversa" : "Arquivar conversa"}
                className="flex items-center justify-center rounded-md shrink-0"
                style={{ width: 28, height: 28, background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                {selected.archivedAt ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </button>
            </header>

            <div ref={feedRef} className="flex-1 flex flex-col gap-3 px-5 py-4 sm:px-6" style={{ minHeight: 0, overflowY: "auto" }}>
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
                    {!recording && (
                      <>
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
                      </>
                    )}

                    {recording ? (
                      <div
                        className="flex-1 flex items-center gap-2 rounded-2xl px-3.5 py-2.5"
                        style={{ background: "var(--surface-alt)", border: `1px solid ${recordCancelHint ? "var(--danger)" : "var(--border)"}` }}
                      >
                        <span className="animate-pulse shrink-0" style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--danger)" }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                          {formatClock(recordSeconds)}
                        </span>
                        <span className="flex-1 truncate" style={{ fontSize: 11, color: recordCancelHint ? "var(--danger)" : "var(--text-faint)" }}>
                          {recordCancelHint ? "Solte para cancelar" : "◂ Arraste para a esquerda para cancelar"}
                        </span>
                      </div>
                    ) : (
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
                    )}

                    {recording || (!draft.trim() && pendingAttachments.length === 0) ? (
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); startRecording(e.clientX); }}
                        onTouchStart={e => { const t = e.touches[0]; if (t) startRecording(t.clientX); }}
                        title="Segure para gravar áudio"
                        aria-label="Gravar áudio"
                        className="flex items-center justify-center rounded-full shrink-0"
                        style={{
                          width: 34, height: 34,
                          background: recording ? "var(--danger)" : "var(--accent)",
                          color: "var(--on-accent)", border: "none", cursor: sending ? "default" : "pointer",
                          opacity: sending && !recording ? 0.4 : 1,
                        }}
                      >
                        <Mic size={16} />
                      </button>
                    ) : (
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
                    )}
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
