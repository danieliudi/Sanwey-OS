import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FileText, ListChecks, Paperclip, StickyNote, Plus, Upload, Download,
  Trash2, Check, X, AlertCircle, File as FileIcon, Send, Settings2,
} from "lucide-react";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { DetailDrawerTabs } from "../shared/DetailDrawerTabs";
import { StageNavigator } from "../shared/StageNavigator";
import { EditableTitle } from "../shared/EditableTitle";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { resolveVisibleFields } from "../../utils/field-conditions";
import { usePersonalTaskChecklists } from "../../hooks/use-personal-task-checklists";
import { usePersonalTaskAttachments } from "../../hooks/use-personal-task-attachments";
import { formatDateBR } from "../../utils/date";
import { PERSONAL_TASK_PRIORITIES, RECURRENCE_OPTIONS } from "../../constants/personal-tasks";
import { RecurrencePicker } from "./RecurrencePicker";
import { PersonalTagsPicker } from "./PersonalTagsPicker";

const inputBase = {
  width: "100%", fontSize: 13, borderRadius: 6,
  border: "1px solid var(--border-strong)", padding: "7px 10px",
  background: "var(--surface)", color: "var(--text)", outline: "none",
};
const focusBorder = e => { e.target.style.borderColor = "var(--accent)"; };
const blurBorder  = e => { e.target.style.borderColor = "var(--border-strong)"; };

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Detalhes ────────────────────────────────────────────────── */

function DetailsTab({ task, onFieldChange, saveStatus, tagsHook }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <SectionLabel>Detalhes da tarefa</SectionLabel>
        {saveStatus && (
          <span style={{ fontSize: 10, marginLeft: "auto", color: saveStatus === "saved" ? "var(--success)" : "var(--text-dim)" }}>
            {saveStatus === "saving" ? "Salvando…" : "✓ Salvo"}
          </span>
        )}
      </div>

      <FieldRow label="Descrição">
        <textarea
          value={task.description || ""}
          rows={3}
          placeholder="Detalhes da tarefa…"
          onChange={e => onFieldChange("description", e.target.value)}
          style={{ ...inputBase, resize: "vertical" }}
          onFocus={focusBorder} onBlur={blurBorder}
        />
      </FieldRow>

      <FieldRow label="Prioridade">
        <div style={{ display: "flex", gap: 6 }}>
          {PERSONAL_TASK_PRIORITIES.map(p => (
            <button key={p.id} type="button" onClick={() => onFieldChange("priority", p.id)}
              style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${task.priority === p.id ? p.color : "var(--border)"}`,
                background: task.priority === p.id ? p.color + "18" : "var(--surface)",
                color: task.priority === p.id ? p.color : "var(--text-dim)" }}>
              {p.label}
            </button>
          ))}
        </div>
      </FieldRow>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FieldRow label="Prazo">
          <input type="date" value={task.dueDate || ""} onChange={e => onFieldChange("dueDate", e.target.value || null)}
            style={inputBase} onFocus={focusBorder} onBlur={blurBorder} />
        </FieldRow>
        <FieldRow label="Hora">
          <input type="time" value={task.dueTime || ""} disabled={!task.dueDate}
            onChange={e => onFieldChange("dueTime", e.target.value || null)}
            style={{ ...inputBase, opacity: task.dueDate ? 1 : 0.5 }} onFocus={focusBorder} onBlur={blurBorder} />
        </FieldRow>
      </div>

      <FieldRow label="Repetir">
        <RecurrencePicker
          recurrence={task.recurrence || "none"}
          recurrenceConfig={task.recurrenceConfig}
          onRecurrenceChange={(v) => onFieldChange("recurrence", v)}
          onConfigChange={(v) => onFieldChange("recurrenceConfig", v)}
        />
      </FieldRow>

      <FieldRow label="Etiquetas">
        <PersonalTagsPicker
          value={task.tags || []}
          onChange={(tags) => onFieldChange("tags", tags)}
          tagsHook={tagsHook}
        />
      </FieldRow>
    </div>
  );
}

/* ── Campos desta etapa ──────────────────────────────────────── */

// Mesmo motor do Editor de campos genérico (StageFieldsPanel/RHStageFieldInput/
// field-conditions.js) — aqui só consumindo os campos configurados pra esta
// etapa da Lista Pessoal via PersonalStageFieldsPanel.
function StageFieldsTab({ task, stageFieldsHook, onFieldChange }) {
  const defs = stageFieldsHook.getFields(task.status);
  const values = task.customFields || {};
  const visibleDefs = resolveVisibleFields(defs, values);

  if (visibleDefs.length === 0) {
    return (
      <div className="text-xs text-center py-6 italic" style={{ color: "var(--text-dim)" }}>
        Nenhum campo configurado pra esta etapa ainda. Use o ícone de engrenagem no cabeçalho da coluna, no Kanban, pra adicionar.
      </div>
    );
  }

  return (
    <div>
      {visibleDefs.map(f => (
        <FieldRow key={f.id} label={f.label}>
          <RHStageFieldInput
            field={f}
            value={values[f.fieldKey] ?? ""}
            onChange={(val) => onFieldChange("customFields", { ...values, [f.fieldKey]: val })}
          />
        </FieldRow>
      ))}
    </div>
  );
}

/* ── Checklist ───────────────────────────────────────────────── */

function ChecklistTab({ taskId, userId }) {
  const { checklists, loading, error, createChecklist, deleteChecklist, addItem, toggleItem, removeItem, renameChecklist } = usePersonalTaskChecklists(taskId, userId);
  const [creatingTitle, setCreatingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addingTo, setAddingTo] = useState(null);
  const [addingText, setAddingText] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState("");

  const handleCreate = async () => {
    const t = newTitle.trim() || "Checklist";
    setCreatingTitle(false);
    setNewTitle("");
    await createChecklist({ title: t });
  };

  if (loading) return <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Carregando…</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" />{error}
        </div>
      )}

      {checklists.length === 0 && !creatingTitle && (
        <div className="text-xs text-center py-2 italic" style={{ color: "var(--text-dim)" }}>Nenhum checklist criado ainda.</div>
      )}

      {checklists.map(cl => {
        const items = Array.isArray(cl.items) ? cl.items : [];
        const doneCount = items.filter(it => it.done).length;
        const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
        return (
          <div key={cl.id} className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--surface-alt)" }}>
              <ListChecks size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
              {editingTitleId === cl.id ? (
                <input autoFocus value={editingTitleText} onChange={e => setEditingTitleText(e.target.value)}
                  onBlur={async () => { const t = editingTitleText.trim(); setEditingTitleId(null); if (t) await renameChecklist(cl.id, t); }}
                  onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingTitleId(null); }}
                  className="flex-1 text-xs font-semibold outline-none bg-transparent border-b"
                  style={{ color: "var(--text)", borderColor: "var(--accent)" }} />
              ) : (
                <button className="flex-1 text-left text-xs font-semibold" style={{ color: "var(--text)", background: "none", border: "none", cursor: "text" }}
                  onDoubleClick={() => { setEditingTitleId(cl.id); setEditingTitleText(cl.title); }} title="Clique duplo para renomear">
                  {cl.title}
                </button>
              )}
              {items.length > 0 && <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--text-dim)" }}>{doneCount}/{items.length}</span>}
              <button onClick={() => deleteChecklist(cl.id)} className="p-1 rounded shrink-0" style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }} onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}>
                <Trash2 size={12} />
              </button>
            </div>
            {items.length > 0 && (
              <div className="px-3 pt-2">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: progress === 100 ? "var(--success)" : "var(--accent)" }} />
                </div>
              </div>
            )}
            <div className="p-3 space-y-1.5">
              {items.map(it => (
                <div key={it.id} className="flex items-start gap-2 group">
                  <button onClick={() => toggleItem(cl.id, it.id)} className="mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center"
                    style={{ background: it.done ? "var(--accent)" : "var(--surface)", borderColor: it.done ? "var(--accent)" : "var(--border-strong)", cursor: "pointer" }}>
                    {it.done && <Check size={10} style={{ color: "#FFFFFF" }} />}
                  </button>
                  <span className="flex-1 text-xs leading-5" style={{ color: it.done ? "var(--text-dim)" : "var(--text)", textDecoration: it.done ? "line-through" : "none" }}>{it.text}</span>
                  <button onClick={() => removeItem(cl.id, it.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded" style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }} onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
              {addingTo === cl.id ? (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-4 h-4 rounded border shrink-0" style={{ borderColor: "var(--border-strong)" }} />
                  <input autoFocus value={addingText} onChange={e => setAddingText(e.target.value)}
                    onKeyDown={async e => { if (e.key === "Enter") { const t = addingText.trim(); setAddingText(""); if (t) await addItem(cl.id, t); } if (e.key === "Escape") setAddingTo(null); }}
                    onBlur={async () => { const t = addingText.trim(); setAddingText(""); setAddingTo(null); if (t) await addItem(cl.id, t); }}
                    placeholder="Nova tarefa..." className="flex-1 text-xs outline-none border-b pb-0.5" style={{ color: "var(--text)", borderColor: "var(--accent)", background: "transparent" }} />
                </div>
              ) : (
                <button onClick={() => { setAddingTo(cl.id); setAddingText(""); }} className="flex items-center gap-1.5 text-xs mt-1" style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }} onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}>
                  <Plus size={11} />Adicionar item
                </button>
              )}
            </div>
          </div>
        );
      })}

      {creatingTitle ? (
        <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreatingTitle(false); }}
          onBlur={handleCreate} placeholder="Nome do checklist..."
          className="w-full text-xs rounded-lg border px-3 py-2 outline-none" style={{ borderColor: "var(--accent)", color: "var(--text)" }} />
      ) : (
        <button onClick={() => setCreatingTitle(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed text-xs font-semibold"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "transparent", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-dim)"; }}>
          <Plus size={12} />Novo checklist
        </button>
      )}
    </div>
  );
}

/* ── Anexos ──────────────────────────────────────────────────── */

function AttachmentsTab({ taskId, userId }) {
  const { attachments, loading, uploading, error, upload, remove, getSignedUrl } = usePersonalTaskAttachments(taskId, userId);
  const [openingId, setOpeningId] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = useCallback((files) => {
    Array.from(files).forEach(file => upload(file));
  }, [upload]);

  const handleView = useCallback(async (att) => {
    setOpeningId(att.id);
    try {
      const url = await getSignedUrl(att.file_path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  }, [getSignedUrl]);

  return (
    <div className="space-y-3">
      <div>
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", opacity: uploading ? 0.6 : 1 }}>
          <Upload size={12} />{uploading ? "Enviando…" : "Anexar arquivo"}
        </button>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; } }} />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" />{error}
        </div>
      )}

      {loading && <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Carregando…</div>}

      {!loading && attachments.length === 0 && (
        <div className="text-xs text-center py-2 italic" style={{ color: "var(--text-dim)" }}>Nenhum arquivo anexado ainda.</div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                <FileIcon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{att.file_name}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                  {formatBytes(att.file_size)}
                  {att.created_at && <> · {new Date(att.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>}
                </div>
              </div>
              <button onClick={() => handleView(att)} disabled={openingId === att.id} className="p-1.5 rounded-lg" style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                title="Abrir arquivo" aria-label="Abrir arquivo">
                <Download size={13} />
              </button>
              <button onClick={() => remove(att)} className="p-1.5 rounded-lg" style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                title="Remover arquivo" aria-label="Remover arquivo">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Notas ───────────────────────────────────────────────────── */

// Substitui "comentários" (que pressupõe outra pessoa lendo) — decisão A do
// mockup aprovado: log com carimbo de data/hora, sem menção/notificação a
// terceiros, já que a Lista Pessoal é 100% privada.
function NotesTab({ task, onUpdate }) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const notes = useMemo(() => [...(task.notes || [])].reverse(), [task.notes]);

  const handleAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    try {
      const entry = { id: crypto.randomUUID(), body, createdAt: new Date().toISOString() };
      await onUpdate(task.id, { notes: [...(task.notes || []), entry] });
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(); }}
          placeholder="Registrar uma nota (ex: 'liguei, ficou de retornar quinta')…"
          rows={2}
          style={{ ...inputBase, resize: "vertical", flex: 1 }}
          onFocus={focusBorder} onBlur={blurBorder}
        />
        <button onClick={handleAdd} disabled={saving || !draft.trim()}
          className="p-2.5 rounded-lg shrink-0"
          style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: draft.trim() ? "pointer" : "default", opacity: draft.trim() ? 1 : 0.5 }}
          title="Adicionar nota" aria-label="Adicionar nota">
          <Send size={14} />
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="text-xs text-center py-4 italic" style={{ color: "var(--text-dim)" }}>Nenhuma nota registrada ainda.</div>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <div key={n.id} className="p-2.5 rounded-lg" style={{ background: "var(--surface-alt)" }}>
              <div className="text-xs whitespace-pre-wrap" style={{ color: "var(--text)" }}>{n.body}</div>
              <div className="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>
                {new Date(n.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Shell ───────────────────────────────────────────────────── */

export function PersonalTaskDetailDrawer({ task, userId, columns, tagsHook, stageFieldsHook, onClose, onUpdate, onDelete, onSetStatus }) {
  const [centerTab, setCenterTab] = useState("detalhes");
  const [saveStatus, setSaveStatus] = useState(null);
  const draftRef = useRef({});
  const debounceRef = useRef(null);

  const handleFieldChange = useCallback((key, value) => {
    draftRef.current = { ...draftRef.current, [key]: value };
    setSaveStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const patch = draftRef.current;
      draftRef.current = {};
      await onUpdate(task.id, patch);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    }, 500);
  }, [task.id, onUpdate]);

  // Espelha o rascunho local sobre o task vindo de props — evita que a tela
  // "pisque" de volta pro valor antigo enquanto o debounce não gravou ainda.
  const displayTask = { ...task, ...draftRef.current };

  const priorityInfo = PERSONAL_TASK_PRIORITIES.find(p => p.id === task.priority);
  const statusInfo = columns.find(s => s.id === task.status);
  const moveTargets = columns.filter(s => s.id !== task.status);

  const header = (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {statusInfo && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: statusInfo.color + "22", color: statusInfo.color, border: `1px solid ${statusInfo.color}44` }}>
            {statusInfo.name}
          </span>
        )}
        {priorityInfo && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: priorityInfo.color + "18", color: priorityInfo.color, border: `1px solid ${priorityInfo.color}40` }}>
            {priorityInfo.label}
          </span>
        )}
      </div>
      <EditableTitle value={task.title} canWrite onSave={(v) => onUpdate(task.id, { title: v })} />
    </div>
  );

  const left = (
    <>
      <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Prazo</div>
        <div className="text-xs font-bold mt-0.5" style={{ color: "var(--text)" }}>
          {task.dueDate ? `${formatDateBR(task.dueDate)}${task.dueTime ? ` · ${task.dueTime}` : ""}` : "Sem prazo"}
        </div>
      </div>

      {task.recurrence && task.recurrence !== "none" && (
        <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Repete</div>
          <div className="text-xs font-bold mt-0.5" style={{ color: "var(--text)" }}>
            {RECURRENCE_OPTIONS.find(r => r.id === task.recurrence)?.label}
          </div>
        </div>
      )}

      {task.tags?.length > 0 && (
        <div>
          <SectionLabel>Etiquetas</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "var(--surface-alt)", color: "var(--accent)" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const center = (
    <>
      <DetailDrawerTabs
        tabs={[
          { id: "detalhes",  label: "Detalhes",  icon: FileText },
          { id: "campos",    label: "Campos",    icon: Settings2 },
          { id: "checklist", label: "Checklist", icon: ListChecks },
          { id: "anexos",    label: "Anexos",    icon: Paperclip },
          { id: "notas",     label: "Notas",      icon: StickyNote },
        ]}
        activeId={centerTab}
        onChange={setCenterTab}
      />
      {centerTab === "detalhes"  && <DetailsTab task={displayTask} onFieldChange={handleFieldChange} saveStatus={saveStatus} tagsHook={tagsHook} />}
      {centerTab === "campos"    && <StageFieldsTab task={displayTask} stageFieldsHook={stageFieldsHook} onFieldChange={handleFieldChange} />}
      {centerTab === "checklist" && <ChecklistTab taskId={task.id} userId={userId} />}
      {centerTab === "anexos"    && <AttachmentsTab taskId={task.id} userId={userId} />}
      {centerTab === "notas"     && <NotesTab task={task} onUpdate={onUpdate} />}
    </>
  );

  const right = (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        Mover para
      </div>
      <StageNavigator
        targets={moveTargets}
        onMove={(statusId) => onSetStatus(task.id, statusId)}
        getKey={(s) => s.id}
      />
    </div>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={() => onDelete(task.id)}
      deleteLabel="Excluir tarefa"
    />
  );
}

export default PersonalTaskDetailDrawer;
