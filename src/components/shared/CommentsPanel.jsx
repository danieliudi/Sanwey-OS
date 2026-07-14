import React, { useMemo, useRef, useState } from "react";
import { Send, AtSign } from "lucide-react";

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

export function CommentsPanel({ comments = [], currentUser, mentionableUsers = [], onAddComment, disabled = false }) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // string | null — texto após o "@" atual
  const [mentionStart, setMentionStart] = useState(null);
  const [pickedMentions, setPickedMentions] = useState([]); // [{id, name}]
  const textareaRef = useRef(null);

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

  return (
    <div>
      <div className="text-xs font-semibold mb-2.5" style={{ color: "var(--text)", letterSpacing: "0.02em" }}>
        Comentários
      </div>

      <div className="space-y-3 mb-3" style={{ maxHeight: 260, overflowY: "auto" }}>
        {comments.length === 0 ? (
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Nenhum comentário ainda.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar name={c.authorName} avatarBg={c.avatarBg} avatarUrl={c.avatarUrl} initials={c.initials} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                    {c.authorName || "Sistema"}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{timeAgo(c.createdAt)}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {renderTextWithMentions(c.text, (c.mentionedNames || []))}
                </div>
              </div>
            </div>
          ))
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
              placeholder="Escreva um comentário… use @ para mencionar alguém"
              rows={2}
              className="flex-1 text-xs rounded-lg border px-2.5 py-2 outline-none resize-none"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
            />
            <button
              onClick={handleSubmit}
              disabled={!draft.trim() || submitting}
              title="Enviar (Enter)"
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 32, height: 32, background: "var(--accent)", color: "#FFF", border: "none", cursor: draft.trim() ? "pointer" : "default", opacity: draft.trim() ? 1 : 0.5 }}
            >
              <Send size={13} />
            </button>
          </div>
          <div className="flex items-center gap-1 mt-1" style={{ color: "var(--text-faint)" }}>
            <AtSign size={10} />
            <span className="text-[10px]">Digite @ para mencionar e notificar alguém com acesso a este card.</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommentsPanel;
