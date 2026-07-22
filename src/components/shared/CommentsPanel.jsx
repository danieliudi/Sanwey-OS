import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, AtSign, MessageCircle, Pencil, Trash2, Check, X } from "lucide-react";

// Painel de comentários unificado (FASE 4) — usado em todo drawer/modal da
// plataforma que precise de comentários: mesmo formato de comentário em
// todo lugar ({ id, authorId, authorName, avatarBg, avatarUrl, initials,
// text, mentionedIds, createdAt }), autor sempre visível (nome + avatar,
// nunca "Colaborador" genérico), e @menção com autocomplete restrito a
// `mentionableUsers` (já filtrado pelo chamador via getMentionableUsers).
//
// Quem chama é responsável por: normalizar os comentários já existentes
// (alguns módulos guardavam só {text, createdAt}, sem autor — para esses,
// authorName fica undefined e cai no fallback "Sistema" abaixo) e por
// persistir o retorno de onAddComment(text, mentionedIds).

const EDIT_WINDOW_MS = 12 * 60 * 60 * 1000;

function withinEditWindow(createdAt) {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Avatar({ name, avatarBg, avatarUrl, initials, size = 24 }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  const label = initials || (name || "?").slice(0, 2).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: avatarBg || "#1D4ED8", color: "#FFF" }}
    >
      {label}
    </div>
  );
}

// Realça trechos "@Nome" já reconhecidos (presentes em mentionedNames) no
// texto renderizado — puramente visual, não altera o texto salvo.
function renderTextWithMentions(text, mentionedNames = []) {
  if (!mentionedNames.length) return text;
  const pattern = new RegExp(`(@(?:${mentionedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    mentionedNames.some(n => part === `@${n}`)
      ? <strong key={i} style={{ color: "var(--accent)", fontWeight: 700 }}>{part}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

export function CommentsPanel({ comments = [], currentUser, mentionableUsers = [], onAddComment, onUpdateComment, disabled = false }) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // string | null — texto após o "@" atual
  const [mentionStart, setMentionStart] = useState(null);
  const [pickedMentions, setPickedMentions] = useState([]); // [{id, name}]
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const textareaRef = useRef(null);
  const feedRef = useRef(null);

  // Feed estilo chat: mais antigo em cima, mais novo embaixo (como
  // WhatsApp/Slack) — os chamadores ordenam por "mais recente primeiro"
  // pra outros usos (ex: aba Atividades), então inverte só na renderização.
  const chronological = useMemo(() => [...comments].reverse(), [comments]);

  const prevCountRef = useRef(comments.length);
  useEffect(() => {
    if (comments.length !== prevCountRef.current) {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
      prevCountRef.current = comments.length;
    }
  }, [comments.length]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionableUsers
      .filter(u => u.id !== currentUser?.id && u.name?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, mentionableUsers, currentUser]);

  const handleChange = (e) => {
    const val = e.target.value;
    setDraft(val);
    const caret = e.target.selectionStart;
    const upToCaret = val.slice(0, caret);
    const at = upToCaret.lastIndexOf("@");
    if (at === -1 || /\s/.test(upToCaret.slice(at + 1))) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }
    setMentionQuery(upToCaret.slice(at + 1));
    setMentionStart(at);
  };

  const pickMention = (user) => {
    if (mentionStart === null) return;
    const caret = textareaRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, mentionStart);
    const after = draft.slice(caret);
    const inserted = `@${user.name} `;
    setDraft(before + inserted + after);
    setPickedMentions(prev => prev.some(p => p.id === user.id) ? prev : [...prev, { id: user.id, name: user.name }]);
    setMentionQuery(null);
    setMentionStart(null);
    requestAnimationFrame(() => {
      const pos = (before + inserted).length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || submitting) return;
    // Só considera "mencionado" quem realmente sobrou no texto final —
    // evita notificar alguém cujo "@Nome " foi apagado depois de escolhido.
    const mentionedIds = pickedMentions.filter(m => text.includes(`@${m.name}`)).map(m => m.id);
    setSubmitting(true);
    try {
      await onAddComment(text, mentionedIds);
      setDraft("");
      setPickedMentions([]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape" && mentionQuery !== null) {
      setMentionQuery(null);
      setMentionStart(null);
    }
  };

  const startEdit = (c) => {
    setConfirmingDeleteId(null);
    setEditingId(c.id);
    setEditDraft(c.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async (c) => {
    const text = editDraft.trim();
    if (!text || !onUpdateComment) return;
    if (text === c.text) {
      cancelEdit();
      return;
    }
    await onUpdateComment(c.id, { text, editedAt: new Date().toISOString() });
    cancelEdit();
  };

  const handleDelete = async (c) => {
    if (!onUpdateComment) return;
    await onUpdateComment(c.id, { deletedAt: new Date().toISOString() });
    setConfirmingDeleteId(null);
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-1.5 mb-2.5 shrink-0">
        <MessageCircle size={13} style={{ color: "var(--text-dim)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text)", letterSpacing: "0.02em" }}>
          Comentários
        </span>
        {comments.length > 0 && (
          <span className="text-[10px] font-medium" style={{ color: "var(--text-faint)" }}>{comments.length}</span>
        )}
      </div>

      <div
        ref={feedRef}
        className="flex flex-col gap-3 mb-3 pr-1"
        style={{ maxHeight: 420, overflowY: "auto" }}
      >
        {chronological.length === 0 ? (
          <div className="text-xs rounded-xl px-3 py-4 text-center" style={{ color: "var(--text-faint)", background: "var(--surface-alt)" }}>
            Nenhum comentário ainda. Seja o primeiro a comentar.
          </div>
        ) : (
          chronological.map((c) => {
            const isOwn = !!currentUser && c.authorId === currentUser.id;
            const isAdmin = Boolean(currentUser?.roles?.includes("admin") || currentUser?.role === "admin");
            // Editar: sempre só o próprio autor, e só dentro de 12h do createdAt.
            // Excluir: autor dentro das 12h, OU admin a qualquer momento (nunca
            // edita comentário alheio, só exclui) — pedido explícito do usuário.
            const canEdit = isOwn && withinEditWindow(c.createdAt) && !!c.id && !!onUpdateComment;
            const canDelete = !!c.id && !!onUpdateComment && (isAdmin || (isOwn && withinEditWindow(c.createdAt)));
            const isEditing = editingId === c.id;
            const isConfirmingDelete = confirmingDeleteId === c.id;
            return (
              <div key={c.id} className={`group flex items-end gap-2${isOwn ? " flex-row-reverse justify-end" : ""}`}>
                {!isOwn && <Avatar name={c.authorName} avatarBg={c.avatarBg} avatarUrl={c.avatarUrl} initials={c.initials} size={26} />}
                <div className="flex flex-col min-w-0" style={{ maxWidth: "84%", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                  {!isOwn && (
                    <span className="text-[11px] font-semibold mb-0.5 px-1 truncate" style={{ color: "var(--text-dim)", maxWidth: "100%" }}>
                      {c.authorName || "Sistema"}
                    </span>
                  )}
                  {isEditing ? (
                    <div className="flex flex-col gap-1.5" style={{ width: "100%", minWidth: 200 }}>
                      <textarea
                        autoFocus
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(c); }
                          else if (e.key === "Escape") cancelEdit();
                        }}
                        rows={2}
                        className="text-xs rounded-xl border px-3 py-2 outline-none resize-none"
                        style={{ borderColor: "var(--accent)", background: "var(--surface-alt)", color: "var(--text)", lineHeight: 1.4 }}
                      />
                      <div className="flex items-center gap-1.5 px-1" style={{ justifyContent: isOwn ? "flex-end" : "flex-start" }}>
                        <button
                          onClick={() => saveEdit(c)}
                          disabled={!editDraft.trim()}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
                          style={{ background: "var(--accent)", color: "#FFF", border: "none", cursor: "pointer", opacity: editDraft.trim() ? 1 : 0.5 }}
                        >
                          <Check size={11} /> Salvar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium"
                          style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)", cursor: "pointer" }}
                        >
                          <X size={11} /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex items-center gap-1${isOwn ? " flex-row-reverse" : ""}`}>
                      <div
                        className="rounded-2xl px-3 py-2 text-xs"
                        style={{
                          // Tingido (não sólido) mesmo pra "minhas" mensagens — um
                          // fundo sólido var(--accent) com texto branco fica
                          // ilegível no dark mode, onde --accent vira quase-branco.
                          // color-mix sobre var(--surface) garante contraste com
                          // var(--text) nos dois temas.
                          background: isOwn ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface-alt)",
                          color: "var(--text)",
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          borderBottomRightRadius: isOwn ? 4 : 16,
                          borderBottomLeftRadius: isOwn ? 16 : 4,
                        }}
                      >
                        {renderTextWithMentions(c.text, (c.mentionedNames || []))}
                      </div>
                      {(canEdit || canDelete) && !isConfirmingDelete && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {canEdit && (
                            <button
                              onClick={() => startEdit(c)}
                              title="Editar comentário"
                              className="flex items-center justify-center rounded-full"
                              style={{ width: 22, height: 22, background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer" }}
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setConfirmingDeleteId(c.id)}
                              title="Excluir comentário"
                              className="flex items-center justify-center rounded-full"
                              style={{ width: 22, height: 22, background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer" }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      {isConfirmingDelete && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDelete(c)}
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: "var(--danger)", color: "#FFF", border: "none", cursor: "pointer" }}
                          >
                            Excluir?
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            className="flex items-center justify-center rounded-full"
                            style={{ width: 20, height: 20, background: "none", border: "1px solid var(--border)", color: "var(--text-faint)", cursor: "pointer" }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <span className="text-[10px] mt-0.5 px-1" style={{ color: "var(--text-faint)" }}>
                    {timeAgo(c.createdAt)}{c.editedAt ? " · (editado)" : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!disabled && (
        <div style={{ position: "relative" }}>
          {mentionMatches.length > 0 && (
            <div
              className="rounded-lg border overflow-hidden"
              style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4, background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-pop)", zIndex: 20 }}
            >
              {mentionMatches.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => pickMention(u)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer"
                  style={{ background: "none", border: "none" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <Avatar name={u.name} avatarBg={u.avatarBg} avatarUrl={u.avatarUrl} initials={u.initials} size={20} />
                  <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{u.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Escreva um comentário… use @ para mencionar"
              rows={1}
              className="flex-1 text-xs rounded-2xl border px-3.5 py-2.5 outline-none resize-none"
              style={{ borderColor: "var(--border)", background: "var(--surface-alt)", color: "var(--text)", lineHeight: 1.4 }}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
            <button
              onClick={handleSubmit}
              disabled={!draft.trim() || submitting}
              title="Enviar (Enter)"
              className="flex items-center justify-center rounded-full shrink-0 transition-opacity"
              style={{ width: 34, height: 34, background: "var(--accent)", color: "#FFF", border: "none", cursor: draft.trim() ? "pointer" : "default", opacity: draft.trim() ? 1 : 0.4 }}
            >
              <Send size={14} />
            </button>
          </div>
          {!draft && (
            <div className="flex items-center gap-1 mt-1.5 px-1" style={{ color: "var(--text-faint)" }}>
              <AtSign size={10} />
              <span className="text-[10px]">Digite @ pra mencionar e notificar alguém com acesso a este card</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CommentsPanel;
