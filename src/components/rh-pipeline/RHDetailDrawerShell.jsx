import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Paperclip, ListChecks, History, ArrowRight, Sparkles,
  Plus, Upload, Download, Trash2, Check, X,
  File, FileImage, FileSpreadsheet, FileText, AlertCircle,
} from "lucide-react";
import { useRHAttachments } from "../../hooks/use-rh-attachments";
import { useRHChecklists } from "../../hooks/use-rh-checklists";
import { useRHStageHistory } from "../../hooks/use-rh-stage-history";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { resolveVisibleFields } from "../../utils/field-conditions";
import { CommentsPanel } from "../shared/CommentsPanel";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { DetailDrawerTabs } from "../shared/DetailDrawerTabs";
import { RecordAIPanel } from "../shared/RecordAIPanel";
import { genericCardSummaryPrompt } from "../../constants/ai-prompts";

function PlaceholderPanel({ icon: Icon, title, hint }) {
  return (
    <div className="p-6 rounded-xl border text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="inline-flex items-center justify-center mb-3" style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "var(--surface-alt)",
      }}>
        <Icon size={18} color={"var(--text-dim)"} />
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>{title}</div>
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{hint}</div>
    </div>
  );
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Resolve o nome real de quem criou uma atividade/comentário a partir de
// `users` (agora disponível neste shell) — antes disso, qualquer autor que
// não fosse o currentUser virava o placeholder genérico "Colaborador" (bug
// de FASE 4). Fallback pra "Colaborador" só sobrevive quando o autor existe
// mas não foi encontrado em `users` (ex: usuário removido).
function authorLabel(createdBy, currentUser, users = []) {
  if (!createdBy) return "Sistema";
  if (currentUser && createdBy === currentUser.id) return currentUser.name || "Você";
  const found = users.find(u => u.id === createdBy);
  return found?.name || "Colaborador";
}

// ── Atividades ────────────────────────────────────────────────────────────────

function RHActivitiesPanel({ activities, currentUser, users }) {
  const sorted = useMemo(() => {
    return [...(activities || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [activities]);

  if (sorted.length === 0) {
    return (
      <PlaceholderPanel
        icon={Activity}
        title="Atividades"
        hint="Movimentações de etapa e eventos aparecem aqui."
      />
    );
  }

  return (
    <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="text-xs font-semibold mb-3" style={{ color: "var(--text)" }}>
        Atividades
      </div>
      <ol className="space-y-3">
        {sorted.slice(0, 20).map((a, i) => (
          <li key={a.id ?? i} className="text-xs" style={{ color: "var(--text)" }}>
            <div>
              <span style={{ color: "var(--text-dim)" }}>{authorLabel(a.createdBy, currentUser, users)} </span>
              {a.body}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
              {formatTimestamp(a.createdAt)}
            </div>
          </li>
        ))}
        {sorted.length > 20 && (
          <li className="text-[10px]" style={{ color: "var(--text-dim)" }}>
            +{sorted.length - 20} eventos anteriores
          </li>
        )}
      </ol>
    </div>
  );
}

// ── Anexos ────────────────────────────────────────────────────────────────────

const FILE_ICON_MAP = {
  "application/pdf": FileText,
  "image/jpeg": FileImage,
  "image/png": FileImage,
  "image/gif": FileImage,
  "image/webp": FileImage,
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
};

function FileIcon({ mimeType }) {
  const Icon = FILE_ICON_MAP[mimeType] || File;
  return <Icon size={16} />;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// readOnly esconde anexar/remover — usado pro colaborador só ver e baixar
// (ex: holerite/ponto, que só o RH anexa) sem poder mexer no que já existe.
export function RHAttachmentsPanel({ domain, recordId, currentUser, readOnly = false }) {
  const { attachments, loading, uploading, error, upload, remove, getSignedUrl } = useRHAttachments(domain, recordId);
  const [downloadingId, setDownloadingId] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = useCallback((files) => {
    Array.from(files).forEach(file => upload(file, { uploadedBy: currentUser?.id || null }));
  }, [upload, currentUser]);

  const handleView = useCallback(async (att) => {
    setDownloadingId(att.id);
    try {
      const url = await getSignedUrl(att.file_path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  }, [getSignedUrl]);

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{
              background: "var(--accent)",
              color: "var(--on-accent)",
              border: "none",
              opacity: uploading ? 0.6 : 1,
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            <Upload size={12} />
            {uploading ? "Enviando…" : "Anexar arquivo"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; } }}
          />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {loading && (
        <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      )}

      {!loading && attachments.length === 0 && (
        <div className="text-xs text-center py-2 italic" style={{ color: "var(--text-dim)" }}>
          Nenhum arquivo anexado ainda.
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div
              key={att.id}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}
              >
                <FileIcon mimeType={att.mime_type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                  {att.file_name}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                  {formatBytes(att.file_size)}
                  {att.created_at && (
                    <> · {new Date(att.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleView(att)}
                disabled={downloadingId === att.id}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                title="Abrir arquivo"
                aria-label="Abrir arquivo"
              >
                <Download size={13} />
              </button>
              {!readOnly && (
                <button
                  onClick={() => remove(att)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#B91C1C"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  title="Remover arquivo"
                  aria-label="Remover arquivo"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Checklists ────────────────────────────────────────────────────────────────

export function RHChecklistsPanel({ domain, recordId, currentUser }) {
  const { checklists, loading, error, createChecklist, deleteChecklist, addItem, toggleItem, removeItem, renameChecklist } = useRHChecklists(domain, recordId);
  const [newTitle, setNewTitle] = useState("");
  const [creatingTitle, setCreatingTitle] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [addingText, setAddingText] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState("");

  const handleCreate = async () => {
    const t = newTitle.trim() || "Checklist";
    setCreatingTitle(false);
    setNewTitle("");
    await createChecklist({ title: t, createdBy: currentUser?.id });
  };

  const handleAddItemEnter = async (checklistId) => {
    const t = addingText.trim();
    if (!t) return;
    setAddingText("");
    await addItem(checklistId, t);
    // mantém o input aberto para o próximo item
  };

  const handleAddItemBlur = async (checklistId) => {
    const t = addingText.trim();
    setAddingText("");
    setAddingTo(null);
    if (t) await addItem(checklistId, t);
  };

  const handleRename = async (id) => {
    const t = editingTitleText.trim();
    setEditingTitleId(null);
    setEditingTitleText("");
    if (t) await renameChecklist(id, t);
  };

  if (loading) return <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Carregando…</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {checklists.length === 0 && !creatingTitle && (
        <div className="text-xs text-center py-2 italic" style={{ color: "var(--text-dim)" }}>
          Nenhum checklist criado ainda.
        </div>
      )}

      {checklists.map(cl => {
        const items = Array.isArray(cl.items) ? cl.items : [];
        const doneCount = items.filter(it => it.done).length;
        const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

        return (
          <div key={cl.id} className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--surface-alt)" }}>
              <ListChecks size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
              {editingTitleId === cl.id ? (
                <input
                  autoFocus
                  value={editingTitleText}
                  onChange={e => setEditingTitleText(e.target.value)}
                  onBlur={() => handleRename(cl.id)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(cl.id); if (e.key === "Escape") { setEditingTitleId(null); } }}
                  className="flex-1 text-xs font-semibold outline-none bg-transparent border-b"
                  style={{ color: "var(--text)", borderColor: "var(--accent)" }}
                />
              ) : (
                <button
                  className="flex-1 text-left text-xs font-semibold"
                  style={{ color: "var(--text)", background: "none", border: "none", cursor: "text" }}
                  onDoubleClick={() => { setEditingTitleId(cl.id); setEditingTitleText(cl.title); }}
                  title="Clique duplo para renomear"
                >
                  {cl.title}
                </button>
              )}
              {items.length > 0 && (
                <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--text-dim)" }}>
                  {doneCount}/{items.length}
                </span>
              )}
              <button
                onClick={() => deleteChecklist(cl.id)}
                className="p-1 rounded transition-colors shrink-0"
                style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#B91C1C"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                title="Remover checklist"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Progress bar */}
            {items.length > 0 && (
              <div className="px-3 pt-2" style={{ paddingBottom: 0 }}>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, background: progress === 100 ? "#16A34A" : "var(--accent)" }}
                  />
                </div>
              </div>
            )}

            {/* Items */}
            <div className="p-3 space-y-1.5">
              {items.map(it => (
                <div key={it.id} className="flex items-start gap-2 group">
                  <button
                    onClick={() => toggleItem(cl.id, it.id)}
                    className="mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all"
                    style={{
                      background: it.done ? "var(--accent)" : "var(--surface)",
                      borderColor: it.done ? "var(--accent)" : "var(--border-strong)",
                      cursor: "pointer",
                    }}
                    aria-label={it.done ? "Desmarcar" : "Marcar como feito"}
                  >
                    {it.done && <Check size={10} style={{ color: "#FFFFFF" }} />}
                  </button>
                  <span
                    className="flex-1 text-xs leading-5"
                    style={{
                      color: it.done ? "var(--text-dim)" : "var(--text)",
                      textDecoration: it.done ? "line-through" : "none",
                    }}
                  >
                    {it.text}
                  </span>
                  <button
                    onClick={() => removeItem(cl.id, it.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                    style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#B91C1C"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                    title="Remover item"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}

              {/* Add item inline */}
              {addingTo === cl.id ? (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-4 h-4 rounded border shrink-0" style={{ borderColor: "var(--border-strong)" }} />
                  <input
                    autoFocus
                    value={addingText}
                    onChange={e => setAddingText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAddItemEnter(cl.id); if (e.key === "Escape") { setAddingTo(null); setAddingText(""); } }}
                    onBlur={() => handleAddItemBlur(cl.id)}
                    placeholder="Nova tarefa..."
                    className="flex-1 text-xs outline-none border-b pb-0.5"
                    style={{ color: "var(--text)", borderColor: "var(--accent)", background: "transparent" }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => { setAddingTo(cl.id); setAddingText(""); }}
                  className="flex items-center gap-1.5 text-xs mt-1 transition-colors"
                  style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  <Plus size={11} />
                  Adicionar item
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* New checklist */}
      {creatingTitle ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreatingTitle(false); setNewTitle(""); } }}
            onBlur={handleCreate}
            placeholder="Nome do checklist..."
            className="flex-1 text-xs rounded-lg border px-3 py-2 outline-none"
            style={{ borderColor: "var(--accent)", color: "var(--text)" }}
          />
        </div>
      ) : (
        <button
          onClick={() => setCreatingTitle(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed text-xs font-semibold transition-colors"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "transparent" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-dim)"; }}
        >
          <Plus size={12} />
          Novo checklist
        </button>
      )}
    </div>
  );
}

// ── Histórico ─────────────────────────────────────────────────────────────────

function stageLabel(key, stages) {
  if (!key) return "—";
  const found = stages?.find(s => (s.stageKey ?? s.id) === key);
  return found?.name || key;
}

export function RHStageHistoryPanel({ domain, recordId, stages, currentUser, users }) {
  const { entries, loading } = useRHStageHistory(domain, recordId);

  if (loading) {
    return <div className="text-xs text-center py-6" style={{ color: "var(--text-dim)" }}>Carregando…</div>;
  }
  if (entries.length === 0) {
    return (
      <PlaceholderPanel
        icon={History}
        title="Histórico"
        hint="Toda mudança de etapa vai aparecer aqui, com data e quem moveu."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((e, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
            {i < entries.length - 1 && <span style={{ width: 1, flex: 1, minHeight: 16, background: "var(--border)", marginTop: 2 }} />}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="text-xs font-semibold flex items-center gap-1 flex-wrap" style={{ color: "var(--text)" }}>
              {e.fromStage ? (
                <>
                  {stageLabel(e.fromStage, stages)}
                  <ArrowRight size={10} style={{ color: "var(--text-dim)" }} />
                  {stageLabel(e.toStage, stages)}
                </>
              ) : (
                <>Criado em {stageLabel(e.toStage, stages)}</>
              )}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
              {authorLabel(e.changedBy, currentUser, users)} · {formatTimestamp(e.changedAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

// Compartilhado entre RHDetailDrawerShell (abas) e RHDetailComments
// (painel de comentários) — os dois consomem o mesmo `activities`/
// `onAddActivity`, só que renderizados em colunas diferentes do drawer
// agora (abas no centro, comentários sempre visíveis na lateral direita).
function useRHActivityComments({ activities = [], onAddActivity, onUpdateActivity, currentUser, users = [], notifyMentions, mentionLink, mentionContextLabel }) {
  // Normaliza o array genérico `activities` (jsonb, compartilhado com a aba
  // Atividades) pro formato que o CommentsPanel compartilhado espera —
  // resolvendo autor/avatar reais via `users` em vez do antigo placeholder
  // "Colaborador". `mentionedIds` só existe em comentários criados depois
  // da FASE 4; entradas antigas caem no default [] (sem menção pra realçar).
  const comments = useMemo(() => {
    return (activities || [])
      .filter(a => (a.type === "comment" || a.type === "note") && !a.deletedAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(a => {
        const isCurrentUser = currentUser && a.createdBy === currentUser.id;
        const author = isCurrentUser ? currentUser : users.find(u => u.id === a.createdBy);
        const mentionedNames = (a.mentionedIds || [])
          .map(id => users.find(u => u.id === id)?.name)
          .filter(Boolean);
        return {
          id: a.id,
          authorId: a.createdBy || null,
          authorName: author?.name || null,
          avatarBg: author?.avatarBg,
          avatarUrl: author?.avatarUrl,
          initials: author?.initials,
          text: a.body,
          mentionedNames,
          createdAt: a.createdAt,
          editedAt: a.editedAt || null,
        };
      });
  }, [activities, currentUser, users]);

  const handleAddComment = useCallback(async (text, mentionedIds) => {
    if (!onAddActivity) return;
    await onAddActivity({
      id: crypto.randomUUID(),
      type: "comment",
      body: text,
      createdBy: currentUser?.id || null,
      mentionedIds,
      createdAt: new Date().toISOString(),
    });
    if (mentionedIds?.length > 0 && notifyMentions) {
      await notifyMentions(mentionedIds, {
        title: `${currentUser?.name || "Alguém"} te mencionou`,
        body: mentionContextLabel ? `Em um comentário: ${mentionContextLabel}` : "Em um comentário",
        link: mentionLink,
      });
    }
  }, [onAddActivity, currentUser, notifyMentions, mentionLink, mentionContextLabel]);

  const handleUpdateComment = useCallback(async (activityId, patch) => {
    if (!onUpdateActivity) return;
    const { text, ...rest } = patch;
    await onUpdateActivity(activityId, text !== undefined ? { body: text, ...rest } : rest);
  }, [onUpdateActivity]);

  return { comments, handleAddComment, handleUpdateComment };
}

// Comentários — sempre visíveis na lateral direita, junto com a
// movimentação de card (mesma convenção do resto da plataforma). Separado
// de RHDetailDrawerShell (abas de Atividades/Histórico/Anexos/Checklists,
// que agora ficam no centro, igual Lead/Campanha) desde a unificação
// visual com a referência do Pipefy.
export function RHDetailComments({
  activities = [], onAddActivity, onUpdateActivity, currentUser,
  users = [], mentionableUsers, notifyMentions, mentionLink, mentionContextLabel,
}) {
  const effectiveMentionableUsers = useMemo(
    () => mentionableUsers || getMentionableUsers(users, { domain: "rh" }),
    [mentionableUsers, users]
  );
  const { comments, handleAddComment, handleUpdateComment } = useRHActivityComments({
    activities, onAddActivity, onUpdateActivity, currentUser, users, notifyMentions, mentionLink, mentionContextLabel,
  });

  return (
    <CommentsPanel
      comments={comments}
      currentUser={currentUser}
      mentionableUsers={effectiveMentionableUsers}
      onAddComment={handleAddComment}
      onUpdateComment={onUpdateActivity ? handleUpdateComment : undefined}
      disabled={!onAddActivity}
    />
  );
}

export function RHDetailDrawerShell({
  domain, recordId, activities = [], onAddActivity, currentUser,
  users = [], stages, formContent, record, recordTitle, domainLabel, fieldsDomain,
}) {
  const showChecklists = domain === "vagas" || domain === "candidatos" || domain === "comex";

  // Comex é o único módulo em que o domínio dos campos por etapa
  // (comex_importacao/comex_exportacao) não é o mesmo `domain` do shell.
  const stageFieldsHook = useRHStageFields(fieldsDomain || domain);

  const tabs = useMemo(() => {
    const list = [];
    if (formContent) list.push({ id: "form", label: "Form", icon: FileText });
    list.push(
      { id: "atividades", label: "Atividades", icon: Activity },
      { id: "historico", label: "Histórico", icon: History },
    );
    if (record) list.push({ id: "ia", label: "IA", icon: Sparkles });
    list.push({ id: "anexos", label: "Anexos", icon: Paperclip });
    if (showChecklists) list.push({ id: "checklists", label: "Checklists", icon: ListChecks });
    return list;
  }, [showChecklists, formContent, record]);

  const [tab, setTab] = useState(formContent ? "form" : "atividades");

  useEffect(() => {
    if (tab === "checklists" && !showChecklists) setTab("atividades");
  }, [showChecklists, tab]);

  useEffect(() => {
    if (tab === "form" && !formContent) setTab("atividades");
  }, [formContent, tab]);

  useEffect(() => {
    if (tab === "ia" && !record) setTab("atividades");
  }, [record, tab]);

  return (
    <div className="space-y-4">
      <DetailDrawerTabs tabs={tabs} activeId={tab} onChange={setTab} />

      {tab === "form" && formContent}

      {tab === "atividades" && (
        <RHActivitiesPanel activities={activities} currentUser={currentUser} users={users} />
      )}

      {tab === "historico" && (
        <RHStageHistoryPanel domain={domain} recordId={recordId} stages={stages} currentUser={currentUser} users={users} />
      )}

      {tab === "ia" && record && (
        <RecordAIPanel
          currentUser={currentUser}
          features={[{
            id: "summary",
            label: "Resumo & Próximo passo",
            buildMessages: () => {
              const currentStage = stages?.find(s => (s.stageKey ?? s.id) === record.stage);
              const daysInStage = record.stageChangedAt
                ? Math.floor((Date.now() - new Date(record.stageChangedAt)) / 86400000)
                : 0;
              const recentComments = (activities || []).slice(-5).map(a => a.body).filter(Boolean);
              // Enviar os campos de etapa de RH (que podem conter dado
              // sensível) ao provedor de IA foi decisão explícita do Daniel
              // em 29/07/2026, não descuido.
              const recordValues = record.customFields || record.custom_fields || {};
              const customFields = resolveVisibleFields(stageFieldsHook.getFields(record.stage), recordValues)
                .map(f => {
                  const v = recordValues[f.fieldKey];
                  if (v === null || v === undefined || v === "") return null;
                  if (Array.isArray(v)) return v.length ? { label: f.label, value: v.join(", ") } : null;
                  if (typeof v === "boolean") return { label: f.label, value: v ? "Sim" : "Não" };
                  return { label: f.label, value: String(v) };
                })
                .filter(Boolean);
              return genericCardSummaryPrompt({
                title: recordTitle,
                domainLabel,
                stageName: currentStage?.name,
                slaDays: currentStage?.slaDays,
                daysInStage,
                customFields,
                recentComments,
              });
            },
          }]}
          defaultFeatureId="summary"
        />
      )}

      {tab === "anexos" && (
        <RHAttachmentsPanel domain={domain} recordId={recordId} currentUser={currentUser} />
      )}

      {tab === "checklists" && showChecklists && (
        <RHChecklistsPanel domain={domain} recordId={recordId} currentUser={currentUser} />
      )}
    </div>
  );
}

export default RHDetailDrawerShell;
