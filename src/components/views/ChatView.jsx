import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive, ArchiveRestore, ArrowLeft, Check, File, FileImage, FileSpreadsheet, FileText,
  Hash, Image, Lock, LogOut, Mic, MessageSquare, Pause, Paperclip, Play, Plus, Search,
  Send, Settings, Smile, Trash2, Users, X,
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
import { RH_DEPARTMENTS } from "../../constants/rh-config";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";

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
  return channel.name || (channel.readOnly ? "Canal" : "Grupo");
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

const CHANNEL_ICON_PRESETS = [
  { icon: "💬", label: "Conversa geral" },
  { icon: "📢", label: "Avisos/comunicados" },
  { icon: "📣", label: "Divulgação/campanha" },
  { icon: "💼", label: "Trabalho/projeto" },
  { icon: "🎉", label: "Social/celebração" },
  { icon: "🛠️", label: "Suporte/operacional" },
  { icon: "📊", label: "Relatórios/métricas" },
  { icon: "🎯", label: "Metas/resultados" },
  { icon: "💡", label: "Ideias/brainstorm" },
  { icon: "📅", label: "Agenda/eventos" },
  { icon: "🧾", label: "Financeiro" },
  { icon: "🚀", label: "Lançamento" },
  { icon: "🧑‍🤝‍🧑", label: "RH/pessoas" },
  { icon: "✈️", label: "Viagens" },
  { icon: "📦", label: "Compras/logística" },
  { icon: "🌎", label: "Comex/internacional" },
  { icon: "🌱", label: "ESG/sustentabilidade" },
  { icon: "⚠️", label: "Urgente/alerta" },
];

// Mockup "Chat: grupos e canais de aviso", aprovado 10/08/2026 — dois modos
// de membro: "Pessoa por pessoa" (igual ao NewConversationModal, reaproveita
// `dmCandidates` — mesma trava de visibilidade que já rege quem pode
// conversar no privado) e "Por grupo" (filtro por departamento/empresa,
// sincronizado ao vivo com profiles via trigger no banco — ver migration
// 20260902_chat_channel_groups_sync.sql). Os dois modos não são mutuamente
// exclusivos no banco (RPC aceita os dois ao mesmo tempo), mas a UI só
// mostra um por vez pra não confundir — trocar de aba não perde a seleção
// já feita no outro modo.
function CreateChannelModal({ open, onClose, candidates, onCreate }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(CHANNEL_ICON_PRESETS[0].icon);
  const [description, setDescription] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [memberMode, setMemberMode] = useState("pessoas"); // "pessoas" | "grupo"
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [matchCount, setMatchCount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(""); setIcon(CHANNEL_ICON_PRESETS[0].icon); setDescription(""); setReadOnly(false);
    setMemberMode("pessoas"); setQuery(""); setSelectedIds([]);
    setDepartments([]); setCompanies([]); setMatchCount(null); setSaving(false); setError(null);
  }, [open]);

  // Preview "N pessoas correspondem" — só busca quando há pelo menos um
  // filtro marcado (departamento vazio + empresa vazia bateria com todo
  // mundo, e mostrar isso sem a pessoa ter escolhido nada ainda confunde
  // mais do que ajuda).
  useEffect(() => {
    if (memberMode !== "grupo" || (departments.length === 0 && companies.length === 0)) {
      setMatchCount(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc("chat_count_profiles_matching_filter", {
        p_filter: { departments, companies },
      });
      if (!cancelled && !err) setMatchCount(data);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [memberMode, departments, companies]);

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(c => (c.name || "").toLowerCase().includes(q));
  }, [candidates, query]);

  const toggleId = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleDept = (d) => setDepartments(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleCompany = (c) => setCompanies(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const canSave = name.trim().length > 0 && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        icon,
        description: description.trim() || null,
        readOnly,
        memberIds: memberMode === "pessoas" ? selectedIds : [],
        syncFilter: memberMode === "grupo" && (departments.length > 0 || companies.length > 0)
          ? { departments, companies }
          : null,
      });
      onClose();
    } catch (e) {
      setError(e?.message || (readOnly ? "Não foi possível criar o canal." : "Não foi possível criar o grupo."));
    } finally {
      setSaving(false);
    }
  };

  const segStyle = (active) => ({
    flex: 1, textAlign: "center", padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
    background: active ? "var(--accent)" : "var(--surface)", color: active ? "var(--on-accent)" : "var(--text-dim)",
    border: "none",
  });
  const chipStyle = (active) => ({
    fontSize: 11.5, fontWeight: 600, padding: "6px 10px", borderRadius: 999, cursor: "pointer",
    border: `1.5px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
    background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--text-dim)",
  });

  return (
    <Modal open={open} onClose={onClose} title={readOnly ? "Criar canal" : "Criar grupo"} width={460}>
      <div className="px-6 py-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {CHANNEL_ICON_PRESETS.map(({ icon: ic, label }) => (
            <button
              key={ic}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => setIcon(ic)}
              style={{
                width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer",
                border: `1.5px solid ${icon === ic ? "var(--accent)" : "var(--border)"}`,
                background: icon === ic ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface)",
              }}
            >
              {ic}
            </button>
          ))}
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={readOnly ? "Nome do canal" : "Nome do grupo"}
          className="w-full py-2 px-3 rounded-md border outline-none mb-2"
          style={{ fontSize: 13, borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descrição (opcional)"
          className="w-full py-2 px-3 rounded-md border outline-none mb-4"
          style={{ fontSize: 13, borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
        />

        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6 }}>
          Tipo
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setReadOnly(false)}
            className="text-left rounded-lg p-2.5"
            style={{ border: `1.5px solid ${!readOnly ? "var(--accent)" : "var(--border)"}`, background: !readOnly ? "color-mix(in srgb, var(--accent) 7%, transparent)" : "var(--surface)", cursor: "pointer" }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>💬 Grupo</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Qualquer membro posta</div>
          </button>
          <button
            type="button"
            onClick={() => setReadOnly(true)}
            className="text-left rounded-lg p-2.5"
            style={{ border: `1.5px solid ${readOnly ? "var(--accent)" : "var(--border)"}`, background: readOnly ? "color-mix(in srgb, var(--accent) 7%, transparent)" : "var(--surface)", cursor: "pointer" }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>📢 Canal</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Só gestor/admin posta, resto só lê</div>
          </button>
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6 }}>
          Membros
        </div>
        <div className="flex rounded-md overflow-hidden border mb-3" style={{ borderColor: "var(--border-strong)" }}>
          <button type="button" style={segStyle(memberMode === "pessoas")} onClick={() => setMemberMode("pessoas")}>Pessoa por pessoa</button>
          <button type="button" style={segStyle(memberMode === "grupo")} onClick={() => setMemberMode("grupo")}>Por grupo</button>
        </div>

        {memberMode === "pessoas" ? (
          <>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por nome…"
                className="w-full py-2 rounded-md border outline-none"
                style={{ paddingLeft: 32, paddingRight: 10, fontSize: 12.5, borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
              />
            </div>
            <div className="flex flex-col" style={{ maxHeight: 200, overflowY: "auto" }}>
              {filteredCandidates.length === 0 ? (
                <div className="px-1 py-3 text-center" style={{ fontSize: 12, color: "var(--text-faint)" }}>Nenhum contato encontrado.</div>
              ) : filteredCandidates.map(c => {
                const sel = selectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleId(c.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 text-left rounded-md"
                    style={{ background: sel ? "var(--accent-tint, var(--surface-alt))" : "transparent", border: "none", cursor: "pointer" }}
                  >
                    <Avatar name={c.name} initials={c.initials} bg={c.avatarBg} size={26} />
                    <span className="flex-1 truncate" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{c.name}</span>
                    {sel && <Check size={14} style={{ color: "var(--accent)" }} />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", marginBottom: 6 }}>Departamento</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {RH_DEPARTMENTS.map(d => (
                <button key={d} type="button" style={chipStyle(departments.includes(d))} onClick={() => toggleDept(d)}>{d}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", marginBottom: 6 }}>Empresa</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {COMPANY_IDS.map(id => (
                <button key={id} type="button" style={chipStyle(companies.includes(id))} onClick={() => toggleCompany(id)}>{COMPANIES[id].name}</button>
              ))}
            </div>
            {matchCount !== null && (
              <div className="rounded-md px-3 py-2 mb-2" style={{ background: "var(--surface-alt)", fontSize: 11.5, color: "var(--text-faint)", fontFamily: "ui-monospace, monospace" }}>
                {matchCount} pessoa{matchCount === 1 ? "" : "s"} correspondem a este filtro agora — a lista se ajusta sozinha se alguém mudar de departamento ou empresa depois.
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-md px-3 py-2 mt-3" style={{ background: "var(--danger-bg)", color: "var(--danger)", fontSize: 12 }}>{error}</div>
        )}
      </div>
      <div className="px-6 py-3 flex items-center justify-end gap-2 border-t" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
        <button type="button" onClick={onClose} className="rounded-md px-3 py-2" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", background: "transparent", border: "1px solid var(--border-strong)", cursor: "pointer" }}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="rounded-md px-4 py-2"
          style={{ fontSize: 12.5, fontWeight: 700, color: "var(--on-accent)", background: "var(--accent)", border: "none", cursor: canSave ? "pointer" : "default", opacity: canSave ? 1 : 0.6 }}
        >
          {saving ? "Criando…" : (readOnly ? "Criar canal" : "Criar grupo")}
        </button>
      </div>
    </Modal>
  );
}

// "Gerenciar grupo/canal" (mockup aprovado 11/08/2026 — pedido do Daniel:
// "falta a função de poder editar aquele canal/grupo, para adicionar e
// deletar usuários, mudar nome"). Quem pode editar (`canManage`) é
// recalculado no client a partir do roster carregado — mesma regra que o
// backend já aplica em `chat_can_manage` (gestor da plataforma OU admin
// deste grupo), então um clique num controle sem permissão nunca chega a
// acontecer, mas o RPC segue sendo a fonte de verdade (decisão B do mockup:
// grupo sincronizado por departamento fica com a lista de membros só-leitura,
// sem os controles de adicionar/remover).
function ManageChannelModal({
  open, onClose, channel, currentUser, dmCandidates,
  updateChannel, addMember, removeMember, leaveChannel, setMemberAdmin, onLeft,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [members, setMembers] = useState([]);
  const [syncFilter, setSyncFilter] = useState(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [addQuery, setAddQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [memberBusyId, setMemberBusyId] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const channelId = channel?.id ?? null;

  const loadRoster = useCallback(async () => {
    if (!channelId) return;
    setMembersLoading(true);
    const [rosterRes, channelRes] = await Promise.all([
      supabase.rpc("chat_channel_roster", { p_channel_id: channelId }),
      supabase.from("chat_channels").select("sync_filter").eq("id", channelId).single(),
    ]);
    setMembers(rosterRes.data || []);
    setSyncFilter(channelRes.data?.sync_filter ?? null);
    setMembersLoading(false);
  }, [channelId]);

  // Depende só de `open`/`channelId` (não do objeto `channel` inteiro) de
  // propósito — achado do QA (11/08/2026): `channels` ganha referência nova
  // a cada mensagem recebida em QUALQUER canal da plataforma (realtime sem
  // filtro por canal em use-chat.js), então depender de `channel` reabria
  // este efeito e resetava nome/descrição digitados no meio da edição.
  useEffect(() => {
    if (!open || !channel) return;
    setName(channel.name || "");
    setDescription(channel.description || "");
    setReadOnly(Boolean(channel.readOnly));
    setAddQuery("");
    setError(null);
    setSaving(false);
    setMemberBusyId(null);
    setLeaving(false);
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channelId, loadRoster]);

  // `!membersLoading` no gate — achado do QA: sem isso, trocar rápido de
  // canal reaproveitava o roster antigo (de outro canal) por um instante e
  // podia mostrar controles de edição pra quem não administra o canal atual.
  const canManage = useMemo(() => {
    if (membersLoading || !currentUser) return false;
    if (isManager(currentUser)) return true;
    return members.some(m => m.user_id === currentUser.id && m.is_admin);
  }, [members, membersLoading, currentUser]);

  const isSynced = Boolean(syncFilter);

  const addCandidates = useMemo(() => {
    const memberIds = new Set(members.map(m => m.user_id));
    const q = addQuery.trim().toLowerCase();
    return dmCandidates
      .filter(c => !memberIds.has(c.id))
      .filter(c => !q || (c.name || "").toLowerCase().includes(q));
  }, [dmCandidates, members, addQuery]);

  const save = async () => {
    if (!channelId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateChannel({ channelId, name: name.trim(), description: description.trim() || null, readOnly });
      onClose();
    } catch (e) {
      setError(e?.message || "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (userId) => {
    setMemberBusyId(userId);
    setError(null);
    try {
      await addMember(channelId, userId);
      await loadRoster();
    } catch (e) {
      setError(e?.message || "Não foi possível adicionar essa pessoa.");
    } finally {
      setMemberBusyId(null);
    }
  };

  // Achado do QA: remover a si mesmo pelo ✕ do próprio card (em vez do botão
  // "Sair") deixava estado incoerente — chat_remove_member não atualiza
  // `channels` no hook nem fecha a conversa (só chat_leave_channel faz isso).
  // O botão ✕ já não aparece na própria linha (ver render abaixo), mas esta
  // trava fica como reforço caso a função seja chamada por outro caminho.
  const handleRemove = async (userId) => {
    if (userId === currentUser?.id) { handleLeave(); return; }
    setMemberBusyId(userId);
    setError(null);
    try {
      await removeMember(channelId, userId);
      await loadRoster();
    } catch (e) {
      setError(e?.message || "Não foi possível remover essa pessoa.");
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleToggleAdmin = async (userId, nextIsAdmin) => {
    setMemberBusyId(userId);
    setError(null);
    try {
      await setMemberAdmin(channelId, userId, nextIsAdmin);
      await loadRoster();
    } catch (e) {
      setError(e?.message || "Não foi possível atualizar o admin.");
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm(`Sair de "${channel?.name || (readOnly ? "Canal" : "Grupo")}"? Você deixa de receber mensagens dele.`)) return;
    setLeaving(true);
    setError(null);
    try {
      await leaveChannel(channelId);
      onLeft?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Não foi possível sair.");
      setLeaving(false);
    }
  };

  if (!channel) return null;
  const isDm = channel.kind === "dm";

  return (
    <Modal open={open} onClose={onClose} title={isDm ? "Conversa" : (readOnly ? "Gerenciar canal" : "Gerenciar grupo")} width={460}>
      <div className="px-6 py-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {isDm ? (
          <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Conversas diretas não têm configurações de grupo.</div>
        ) : (
          <>
            {canManage ? (
              <>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={readOnly ? "Nome do canal" : "Nome do grupo"}
                  className="w-full py-2 px-3 rounded-md border outline-none mb-2"
                  style={{ fontSize: 13, borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
                />
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descrição (opcional)"
                  className="w-full py-2 px-3 rounded-md border outline-none mb-4"
                  style={{ fontSize: 13, borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
                />
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6 }}>
                  Tipo
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setReadOnly(false)}
                    className="text-left rounded-lg p-2.5"
                    style={{ border: `1.5px solid ${!readOnly ? "var(--accent)" : "var(--border)"}`, background: !readOnly ? "color-mix(in srgb, var(--accent) 7%, transparent)" : "var(--surface)", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>💬 Grupo</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Qualquer membro posta</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReadOnly(true)}
                    className="text-left rounded-lg p-2.5"
                    style={{ border: `1.5px solid ${readOnly ? "var(--accent)" : "var(--border)"}`, background: readOnly ? "color-mix(in srgb, var(--accent) 7%, transparent)" : "var(--surface)", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>📢 Canal</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Só gestor/admin posta, resto só lê</div>
                  </button>
                </div>
              </>
            ) : (
              <div className="mb-4">
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{channel.name}</div>
                {channel.description && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{channel.description}</div>}
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)" }}>
                Membros {!membersLoading && `· ${members.length}`}
              </div>
            </div>

            {isSynced && (
              <div className="rounded-md px-3 py-2 mb-2" style={{ background: "var(--surface-alt)", fontSize: 11.5, color: "var(--text-faint)" }}>
                Este grupo é sincronizado automaticamente por departamento/empresa — a lista de membros é só leitura aqui; quem entra e sai é decidido pelo cadastro na aba Usuários.
              </div>
            )}

            {membersLoading ? (
              <div className="px-1 py-3" style={{ fontSize: 12, color: "var(--text-faint)" }}>Carregando membros…</div>
            ) : (
              <div className="flex flex-col mb-3" style={{ maxHeight: 180, overflowY: "auto" }}>
                {members.map(m => (
                  <div key={m.user_id} className="w-full flex items-center gap-2.5 px-1 py-1.5">
                    <Avatar name={m.name} initials={m.initials} bg={m.avatar_bg} size={26} />
                    <span className="flex-1 truncate" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                      {m.name}{m.user_id === currentUser?.id ? " (você)" : ""}
                    </span>
                    {canManage && !isSynced ? (
                      <button
                        type="button"
                        onClick={() => handleToggleAdmin(m.user_id, !m.is_admin)}
                        disabled={memberBusyId === m.user_id}
                        title={m.is_admin ? "Tirar admin" : "Tornar admin"}
                        className="shrink-0 rounded-full px-2 py-0.5"
                        style={{
                          fontSize: 10, fontWeight: 700, cursor: memberBusyId === m.user_id ? "default" : "pointer", border: "none",
                          background: m.is_admin ? "var(--surface-alt)" : "transparent",
                          color: m.is_admin ? "var(--text-dim)" : "var(--text-faint)",
                        }}
                      >
                        {m.is_admin ? "admin" : "tornar admin"}
                      </button>
                    ) : m.is_admin && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5"
                        style={{ fontSize: 10, fontWeight: 700, background: "var(--surface-alt)", color: "var(--text-dim)" }}
                      >
                        admin
                      </span>
                    )}
                    {canManage && !isSynced && m.user_id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => handleRemove(m.user_id)}
                        disabled={memberBusyId === m.user_id}
                        title="Remover do grupo/canal"
                        aria-label="Remover"
                        className="flex items-center justify-center rounded-md shrink-0"
                        style={{ width: 24, height: 24, background: "none", border: "none", color: "var(--text-faint)", cursor: memberBusyId === m.user_id ? "default" : "pointer" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && !isSynced && !membersLoading && (
              <>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} />
                  <input
                    value={addQuery}
                    onChange={e => setAddQuery(e.target.value)}
                    placeholder="Adicionar pessoa…"
                    className="w-full py-2 rounded-md border outline-none"
                    style={{ paddingLeft: 32, paddingRight: 10, fontSize: 12.5, borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
                  />
                </div>
                {addQuery.trim() && (
                  <div className="flex flex-col mb-2" style={{ maxHeight: 160, overflowY: "auto" }}>
                    {addCandidates.length === 0 ? (
                      <div className="px-1 py-2" style={{ fontSize: 12, color: "var(--text-faint)" }}>Ninguém encontrado.</div>
                    ) : addCandidates.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAdd(c.id)}
                        disabled={memberBusyId === c.id}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 text-left rounded-md"
                        style={{ background: "transparent", border: "none", cursor: memberBusyId === c.id ? "default" : "pointer" }}
                      >
                        <Avatar name={c.name} initials={c.initials} bg={c.avatarBg} size={26} />
                        <span className="flex-1 truncate" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{c.name}</span>
                        <Plus size={14} style={{ color: "var(--accent)" }} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="rounded-md px-3 py-2 mt-2" style={{ background: "var(--danger-bg)", color: "var(--danger)", fontSize: 12 }}>{error}</div>
            )}
          </>
        )}
      </div>
      {!isDm && (
        <div className="px-6 py-3 flex items-center justify-between gap-2 border-t" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <button
            type="button"
            onClick={handleLeave}
            disabled={leaving}
            className="flex items-center gap-1.5 rounded-md px-3 py-2"
            style={{ fontSize: 12.5, fontWeight: 600, color: "var(--danger)", background: "transparent", border: "1px solid var(--border-strong)", cursor: leaving ? "default" : "pointer" }}
          >
            <LogOut size={13} /> Sair
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-2" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", background: "transparent", border: "1px solid var(--border-strong)", cursor: "pointer" }}>
              {canManage ? "Cancelar" : "Fechar"}
            </button>
            {canManage && (
              <button
                type="button"
                onClick={save}
                disabled={saving || !name.trim()}
                className="rounded-md px-4 py-2"
                style={{ fontSize: 12.5, fontWeight: 700, color: "var(--on-accent)", background: "var(--accent)", border: "none", cursor: (saving || !name.trim()) ? "default" : "pointer", opacity: (saving || !name.trim()) ? 0.6 : 1 }}
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ChatView({ currentUser, initialChannelId, onInitialChannelConsumed }) {
  const {
    channels, dmCandidates, loading, markRead, sendMessage, startDm,
    archiveChannel, unarchiveChannel, createChannel,
    updateChannel, addMember, removeMember, leaveChannel, setMemberAdmin,
  } = useChat({ userId: currentUser?.id });
  const { uploadAttachment } = useChatAttachments();
  const { stickers, getPublicUrl: getStickerPublicUrl } = useChatStickers();
  const [selectedId, setSelectedId] = useState(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const mobileFabRef = useRef(null);
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
    { value: "canais", label: `Grupos e canais · ${filterCounts.canais}` },
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
  // Grupo (interativo) vs Canal (avisos, só leitura pra quem não é gestor/admin) —
  // mesma lista `canais` (kind === "canal", nome de coluna preservado),
  // só dividida na hora de renderizar a rail (rename decidido com o Daniel 11/08/2026).
  const grupos = useMemo(() => canais.filter(c => !c.readOnly), [canais]);
  const canaisAvisos = useMemo(() => canais.filter(c => c.readOnly), [canais]);

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

  const handleCreateChannel = async (payload) => {
    const channelId = await createChannel(payload);
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
              com os chips de filtro logo abaixo (o FAB mobile abre um menu
              de ações com as mesmas duas opções pra manager, ver bloco do
              FAB). "Criar canal" só pra quem já pode postar em canal
              somente-leitura hoje (mesmo gate de chat_is_manager no banco,
              `isManager`/`manager` local) — mockup aprovado 10/08/2026. */}
          <div className="hidden lg:flex gap-1.5">
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 transition-opacity"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              <Plus size={14} /> Conversa
            </button>
            {isManager(currentUser) && (
              <button
                type="button"
                onClick={() => setNewChannelOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 transition-opacity"
                style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border-strong)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                <Hash size={13} /> Grupo
              </button>
            )}
          </div>
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
                  {railGroup("Grupos", grupos)}
                  {railGroup("Canais", canaisAvisos)}
                  {railGroup("Diretas", diretas)}
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {!mobileShowThread && (
        <>
          <button
            ref={mobileFabRef}
            type="button"
            onClick={() => { if (manager) setFabMenuOpen(o => !o); else setNewOpen(true); }}
            title={manager ? "Nova conversa ou canal" : "Nova conversa"}
            aria-label={manager ? "Nova conversa ou canal" : "Nova conversa"}
            className="lg:hidden fixed flex items-center justify-center rounded-full active:scale-95 transition-transform"
            style={{
              bottom: 80, right: 20, width: 52, height: 52, zIndex: 40,
              background: "var(--accent)", color: "var(--on-accent)",
              border: "none", boxShadow: "var(--shadow-pop)", cursor: "pointer",
            }}
          >
            <Plus size={22} style={{ transform: fabMenuOpen ? "rotate(45deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {/* "Criar canal" no FAB mobile só pra manager (mesmo gate de
              chat_is_manager/isManager do botão de header desktop) — o FAB
              sozinho não tem espaço pra dois botões lado a lado como o
              desktop, então vira um menu de ações reaproveitando o
              ComposerPopover já usado pelo emoji/figurinha (mesmo padrão de
              posicionamento por portal, não uma 2ª implementação). Corrige
              paridade mobile/desktop: mockup aprovado 10/08/2026 previa as
              duas opções no FAB, mas só "Nova conversa" tinha ponto de
              entrada mobile. */}
          {manager && (
            <ComposerPopover anchorRef={mobileFabRef} open={fabMenuOpen} onClose={() => setFabMenuOpen(false)} width={168}>
              <button
                type="button"
                onClick={() => { setFabMenuOpen(false); setNewOpen(true); }}
                className="w-full flex items-center gap-2 rounded-md px-2 py-2.5 text-left transition-opacity"
                style={{ background: "transparent", border: "none", color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                <Plus size={14} /> Conversa
              </button>
              <button
                type="button"
                onClick={() => { setFabMenuOpen(false); setNewChannelOpen(true); }}
                className="w-full flex items-center gap-2 rounded-md px-2 py-2.5 text-left transition-opacity"
                style={{ background: "transparent", border: "none", color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                <Hash size={13} /> Grupo
              </button>
            </ComposerPopover>
          )}
        </>
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
                  ? "Assim que você fizer parte de um grupo ou canal, ou iniciar uma conversa direta, ela aparece aqui."
                  : "Escolha um grupo, canal ou conversa direta na lista ao lado."
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
                      {selected.description || (selected.readOnly ? "Canal" : "Grupo")}
                    </>
                  )}
                </div>
              </div>
              {selected.kind !== "dm" && (
                <button
                  type="button"
                  data-tour="chat-manage-channel"
                  onClick={() => setManageOpen(true)}
                  title={selected.readOnly ? "Gerenciar canal" : "Gerenciar grupo"}
                  aria-label={selected.readOnly ? "Gerenciar canal" : "Gerenciar grupo"}
                  className="flex items-center justify-center rounded-md shrink-0"
                  style={{ width: 28, height: 28, background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  <Settings size={16} />
                </button>
              )}
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
      <CreateChannelModal
        open={newChannelOpen}
        onClose={() => setNewChannelOpen(false)}
        candidates={dmCandidates}
        onCreate={handleCreateChannel}
      />
      <ManageChannelModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        channel={selected}
        currentUser={currentUser}
        dmCandidates={dmCandidates}
        updateChannel={updateChannel}
        addMember={addMember}
        removeMember={removeMember}
        leaveChannel={leaveChannel}
        setMemberAdmin={setMemberAdmin}
        onLeft={() => { setSelectedId(null); setMobileShowThread(false); }}
      />
    </div>
  );
}

export default ChatView;
