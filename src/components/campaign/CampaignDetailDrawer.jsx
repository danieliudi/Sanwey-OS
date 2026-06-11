import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Trash2, Star, ExternalLink, Upload, File, FileImage, FileText,
  Download, Link, Check, Plus, FolderOpen, Activity, Paperclip, ListChecks,
  MessageSquare, ArrowLeft, ArrowRight,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS } from "../../constants/marketing-pipelines";
import { useMarketingCampaignAttachments } from "../../hooks/use-marketing-campaign-attachments";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.zip";

function fileIcon(mimeType) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("text")) return FileText;
  return File;
}

function humanSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Attachments panel ─────────────────────────────────────────────────────────

function AttachmentsPanel({ campaign, canDelete, currentUserId }) {
  const { attachments, loading, uploading, error, upload, remove, getSignedUrl } =
    useMarketingCampaignAttachments(campaign.id);
  const dropRef   = useRef(null);
  const inputRef  = useRef(null);
  const [dragOver, setDragOver]   = useState(false);
  const [fileError, setFileError] = useState(null);

  const doUpload = useCallback(async (file) => {
    if (file.size > MAX_FILE_BYTES) { setFileError("Arquivo muito grande (máx 50 MB)"); return; }
    setFileError(null);
    await upload(file, {
      companyIds:     campaign.companyIds,
      uploadedBy:     currentUserId,
      driveFolderUrl: campaign.driveFolderUrl,
      driveFolderId:  campaign.driveFolderId,
    });
  }, [upload, campaign, currentUserId]);

  const handleFiles = (files) => { for (const f of files) doUpload(f); };

  const handleDownload = useCallback(async (att) => {
    const url = await getSignedUrl(att.file_path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = att.file_name; a.click();
  }, [getSignedUrl]);

  return (
    <div className="space-y-3">
      <div
        ref={dropRef}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-6 gap-2 cursor-pointer transition-colors"
        style={{ borderColor: dragOver ? "#1E4D8C" : "#E5E7EB", background: dragOver ? "#EFF6FF" : "#FAFAFA" }}
      >
        <Upload size={20} style={{ color: dragOver ? "#1E4D8C" : NEUTRAL.slate }} />
        <div className="text-xs font-medium" style={{ color: NEUTRAL.slate }}>
          {uploading ? "Enviando…" : "Arraste ou clique para enviar"}
        </div>
        <div className="text-[10px]" style={{ color: "#9CA3AF" }}>
          PDF, Word, Excel, imagens, vídeos — máx 50 MB
          {campaign.driveFolderUrl && " · salvo no Google Drive"}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={e => { handleFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
        />
      </div>

      {fileError && (
        <div className="text-xs rounded-md px-3 py-2" style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
          {fileError}
        </div>
      )}
      {error && (
        <div className="text-xs rounded-md px-3 py-2" style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
          {error}
        </div>
      )}

      {loading && <div className="text-xs" style={{ color: NEUTRAL.slate }}>Carregando…</div>}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => {
            const Icon = fileIcon(att.mime_type);
            return (
              <div
                key={att.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border"
                style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
              >
                <Icon size={16} style={{ color: NEUTRAL.slate, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: NEUTRAL.graphite }}>{att.file_name}</div>
                  <div className="text-[10px]" style={{ color: NEUTRAL.slate }}>
                    {humanSize(att.file_size)}
                    {att.drive_url && " · Drive"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {att.drive_url && (
                    <a href={att.drive_url} target="_blank" rel="noreferrer" title="Abrir no Drive"
                      onClick={e => e.stopPropagation()}
                      className="p-1 rounded-lg"
                      style={{ color: NEUTRAL.slate }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    title="Baixar"
                    onClick={() => handleDownload(att)}
                    className="p-1 rounded-lg"
                    style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer" }}
                  >
                    <Download size={13} />
                  </button>
                  {canDelete && (
                    <button
                      title="Remover"
                      onClick={() => remove(att)}
                      className="p-1 rounded-lg"
                      style={{ color: "#DC2626", background: "none", border: "none", cursor: "pointer" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && attachments.length === 0 && (
        <div className="text-xs text-center py-4" style={{ color: NEUTRAL.slate }}>
          Nenhum arquivo anexado ainda.
        </div>
      )}
    </div>
  );
}

// ── Checklist panel ────────────────────────────────────────────────────────────

function ChecklistPanel({ campaign, onUpdate, readOnly }) {
  const [items, setItems]       = useState(campaign.approvalChecklist || []);
  const [newLabel, setNewLabel] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { setItems(campaign.approvalChecklist || []); }, [campaign.id, campaign.approvalChecklist]);

  const save = useCallback((updated) => {
    setItems(updated);
    onUpdate(campaign.id, updated);
  }, [campaign.id, onUpdate]);

  const toggle    = (idx) => save(items.map((item, i) => i === idx ? { ...item, done: !item.done } : item));
  const removeItem = (idx) => save(items.filter((_, i) => i !== idx));
  const addItem   = () => {
    const label = newLabel.trim();
    if (!label) return;
    save([...items, { label, done: false }]);
    setNewLabel("");
    inputRef.current?.focus();
  };

  const done = items.filter(i => i.done).length;

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="text-xs" style={{ color: NEUTRAL.slate }}>{done}/{items.length} itens confirmados</div>
      )}
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer"
            style={{ borderColor: item.done ? "#BBF7D0" : "#E5E7EB", background: item.done ? "#F0FDF4" : "#FAFAFA" }}
            onClick={() => toggle(idx)}
          >
            <div
              className="flex items-center justify-center rounded-md flex-shrink-0 transition-colors"
              style={{ width: 18, height: 18, border: item.done ? "none" : "2px solid #D1D5DB", background: item.done ? "#16A34A" : "transparent" }}
            >
              {item.done && <Check size={11} style={{ color: "#FFF" }} strokeWidth={3} />}
            </div>
            <span className="flex-1 text-xs" style={{ color: item.done ? "#15803D" : NEUTRAL.graphite, textDecoration: item.done ? "line-through" : "none" }}>
              {item.label}
            </span>
            {!readOnly && (
              <button
                onClick={e => { e.stopPropagation(); removeItem(idx); }}
                className="p-0.5 rounded"
                style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Novo item de aprovação…"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
            className="flex-1 text-xs rounded-xl border px-3 py-2 outline-none"
            style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
            onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
            onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
          />
          <button
            onClick={addItem}
            disabled={!newLabel.trim()}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl"
            style={{ background: newLabel.trim() ? "#1E4D8C" : "#F3F4F6", color: newLabel.trim() ? "#FFF" : NEUTRAL.slate, border: "none", cursor: newLabel.trim() ? "pointer" : "default" }}
          >
            <Plus size={12} />
            Adicionar
          </button>
        </div>
      )}
      {items.length === 0 && readOnly && (
        <div className="text-xs text-center py-4" style={{ color: NEUTRAL.slate }}>Nenhum item de aprovação configurado.</div>
      )}
    </div>
  );
}

// ── Activity log ──────────────────────────────────────────────────────────────

function ActivityLog({ activities }) {
  if (!activities || activities.length === 0) {
    return <div className="text-xs text-center py-4" style={{ color: NEUTRAL.slate }}>Sem atividades registradas.</div>;
  }
  return (
    <div className="space-y-2">
      {[...activities].reverse().map((act, i) => (
        <div key={i} className="flex gap-2.5 text-xs" style={{ color: NEUTRAL.graphite }}>
          <div className="mt-0.5 flex-shrink-0 rounded-full" style={{ width: 6, height: 6, background: NEUTRAL.slate, marginTop: 6 }} />
          <div className="flex-1">
            <span>{act.text || act.message || JSON.stringify(act)}</span>
            {act.at && (
              <span className="ml-1.5" style={{ color: NEUTRAL.slate, fontSize: 10 }}>{formatDateBR(act.at)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: NEUTRAL.slate }}>{label}</div>
      {children}
    </div>
  );
}

function ReadValue({ value, empty = "—" }) {
  return <div className="text-sm" style={{ color: value ? NEUTRAL.graphite : "#9CA3AF" }}>{value || empty}</div>;
}

function EditInput({ value, onChange, type = "text", placeholder = "" }) {
  return (
    <input
      type={type}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
      style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
      onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
      onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
    />
  );
}

function EditSelect({ value, onChange, options, placeholder = "Selecionar…" }) {
  return (
    <select
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
      style={{ borderColor: "#E5E7EB", color: value ? NEUTRAL.graphite : "#9CA3AF", background: "#FFFFFF" }}
      onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
      onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

// ── Comments tab ──────────────────────────────────────────────────────────────

function ComentariosTab({ campaign, canWrite, isAgencia, onUpdate }) {
  const [notes, setNotes]     = useState(campaign.notes || []);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => { setNotes(campaign.notes || []); }, [campaign.id, campaign.notes]);

  const handleAdd = async () => {
    const text = newNote.trim();
    if (!text || !canWrite || isAgencia) return;
    setSaving(true);
    const now = new Date().toISOString();
    const updatedNotes      = [...notes, { text, createdAt: now }];
    const updatedActivities = [...(campaign.activities || []), { text: "Comentário adicionado", at: now }];
    try {
      await onUpdate?.(campaign.id, { notes: updatedNotes, activities: updatedActivities });
      setNotes(updatedNotes);
      setNewNote("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {canWrite && !isAgencia && (
        <div className="space-y-2">
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Escreva um comentário…"
            rows={3}
            className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none"
            style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
            onFocus={e => { e.target.style.borderColor = "#1E4D8C"; }}
            onBlur={e => { e.target.style.borderColor = "#E5E7EB"; }}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAdd(); } }}
          />
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={!newNote.trim() || saving}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl"
              style={{ background: newNote.trim() ? "#1E4D8C" : "#F3F4F6", color: newNote.trim() ? "#FFF" : NEUTRAL.slate, border: "none", cursor: newNote.trim() ? "pointer" : "default" }}
            >
              {saving ? "Salvando…" : "Comentar"}
            </button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <div className="text-xs text-center py-4" style={{ color: NEUTRAL.slate }}>Nenhum comentário ainda.</div>
      ) : (
        <div className="space-y-2">
          {[...notes].reverse().map((note, i) => (
            <div key={i} className="p-3 rounded-xl border" style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}>
              <div className="text-xs whitespace-pre-wrap" style={{ color: NEUTRAL.graphite }}>{note.text}</div>
              {note.createdAt && (
                <div className="text-[10px] mt-1" style={{ color: NEUTRAL.slate }}>{formatDateBR(note.createdAt)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Marketing stage bar ───────────────────────────────────────────────────────

function MarketingStageBar({ currentStageId }) {
  const nonTerminal = MARKETING_STAGES.filter(s => !s.terminal);
  const currentIdx  = nonTerminal.findIndex(s => s.id === currentStageId);
  const stageData   = MARKETING_STAGES.find(s => s.id === currentStageId);
  const isTerminal  = Boolean(stageData?.terminal);

  return (
    <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
      <div className="text-[10px] font-semibold mb-3 tracking-widest uppercase" style={{ color: NEUTRAL.slate }}>
        Etapa atual
      </div>
      <div className="flex items-start">
        {nonTerminal.map((s, idx) => {
          const done   = isTerminal || idx < currentIdx;
          const active = !isTerminal && idx === currentIdx;
          const prevDone = idx > 0 && (isTerminal || (idx - 1) < currentIdx);

          return (
            <React.Fragment key={s.id}>
              {idx > 0 && (
                <div style={{ flex: 1, height: 2, marginTop: 9, background: prevDone ? nonTerminal[idx - 1].color : "#E5E7EB", transition: "background 0.2s" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: done ? s.color : active ? s.color : "#F1F3F5",
                  border: `2px solid ${done || active ? s.color : "#D4D4D8"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.2s",
                }}>
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
                </div>
                <div style={{
                  fontSize: 9, marginTop: 4, textAlign: "center",
                  color: active ? s.color : done ? NEUTRAL.slate : "#C4C4C8",
                  fontWeight: active ? 700 : 400, maxWidth: 42, lineHeight: 1.2,
                  transition: "color 0.2s",
                }}>
                  {s.name}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "details",  label: "Detalhes",    icon: FileText },
  { id: "creative", label: "Criativo",    icon: ListChecks },
  { id: "files",    label: "Arquivos",    icon: Paperclip },
  { id: "comments", label: "Comentários", icon: MessageSquare },
  { id: "activity", label: "Atividade",   icon: Activity },
];

export function CampaignDetailDrawer({
  campaign,
  onClose,
  onUpdate,
  onDelete,
  users = [],
  canWrite,
  currentUser,
}) {
  const [tab, setTab]                   = useState("details");
  const [draft, setDraft]               = useState({});
  const [mobileTab, setMobileTab]       = useState("info");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const saveTimeout  = useRef(null);
  const pendingPatch = useRef({});

  const isAgencia = currentUser?.role === "agencia";

  const flushPending = useCallback(() => {
    if (saveTimeout.current) { clearTimeout(saveTimeout.current); saveTimeout.current = null; }
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    if (campaign?.id && Object.keys(patch).length > 0) onUpdate?.(campaign.id, patch);
  }, [campaign?.id, onUpdate]);

  useEffect(() => () => { flushPending(); }, [campaign?.id, flushPending]);

  useEffect(() => {
    setDraft({});
    setMobileTab("info");
    pendingPatch.current = {};
  }, [campaign?.id]);

  const get = (field) => field in draft ? draft[field] : campaign[field];

  const set = useCallback((field, value) => {
    if (isAgencia) return;
    setDraft(prev => ({ ...prev, [field]: value }));
    pendingPatch.current = { ...pendingPatch.current, [field]: value };
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const patch = pendingPatch.current;
      pendingPatch.current = {};
      saveTimeout.current = null;
      if (Object.keys(patch).length > 0) onUpdate?.(campaign.id, patch);
    }, 600);
  }, [campaign?.id, onUpdate, isAgencia]);

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete?.(campaign.id); onClose?.(); }
    finally { setDeleting(false); }
  };

  const stageIdx = MARKETING_STAGES.findIndex(s => s.id === get("stage"));
  const stage    = MARKETING_STAGES[stageIdx] || null;

  const stageNav = useMemo(() => {
    if (stageIdx < 0) return { prev: null, next: null };
    return {
      prev: stageIdx > 0 ? MARKETING_STAGES[stageIdx - 1] : null,
      next: stageIdx < MARKETING_STAGES.length - 1 ? MARKETING_STAGES[stageIdx + 1] : null,
    };
  }, [stageIdx]);

  const moveToStage = useCallback((toStageId) => {
    if (!campaign || !toStageId) return;
    onUpdate?.(campaign.id, { stage: toStageId, stageChangedAt: new Date().toISOString() });
  }, [campaign, onUpdate]);

  const ownerUser = users.find(u => u.id === get("owner"));

  if (!campaign) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex lg:items-center lg:justify-center lg:p-6"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full flex-1 flex flex-col lg:flex-none lg:max-w-6xl lg:rounded-2xl lg:max-h-[92vh]"
        style={{ background: "#FFFFFF", boxShadow: "0 24px 64px rgba(32,26,26,0.18)", overflow: "hidden", height: "100%" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-10 flex flex-col shrink-0" style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}>
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" style={{ background: "none", border: "none", color: NEUTRAL.slate }}>
              <X size={20} />
            </button>
            <div className="flex-1 mx-3 text-center min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: NEUTRAL.graphite }}>{get("name")}</div>
              {stage && <div className="text-xs font-semibold" style={{ color: stage.color }}>{stage.name}</div>}
            </div>
            {canWrite && (
              <button
                onClick={() => onUpdate?.(campaign.id, { starred: !campaign.starred })}
                className="p-1.5 rounded-lg"
                style={{ background: "none", border: "none", cursor: "pointer", color: campaign.starred ? "#F59E0B" : "#9CA3AF" }}
              >
                <Star size={16} fill={campaign.starred ? "#F59E0B" : "none"} />
              </button>
            )}
          </div>
          <div className="flex border-t" style={{ borderColor: "#E5E7EB" }}>
            {[{ id: "info", label: "INFORMAÇÕES" }, { id: "stage", label: "FASE ATUAL" }].map(t => (
              <button
                key={t.id}
                onClick={() => setMobileTab(t.id)}
                className="flex-1 py-2.5 text-xs font-bold tracking-wider cursor-pointer"
                style={{ background: "none", border: "none", borderBottom: `2px solid ${mobileTab === t.id ? "#1E4D8C" : "transparent"}`, color: mobileTab === t.id ? "#1E4D8C" : NEUTRAL.slate }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop header */}
        <div
          className="hidden lg:flex sticky top-0 z-10 px-5 py-3.5 border-b items-center justify-between shrink-0"
          style={{ background: "rgba(255,255,255,0.97)", borderColor: "#E5E7EB", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {stage && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: stage.color + "22", color: stage.color, border: `1px solid ${stage.color}44` }}>
                {stage.name}
              </span>
            )}
            {get("channel") && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "#F3F4F6", color: NEUTRAL.graphite, border: "1px solid #E5E7EB" }}>
                {get("channel")}
              </span>
            )}
            {isAgencia && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A" }}>
                Visitante
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canWrite && !isAgencia && (
              <button
                onClick={() => setConfirmDelete(v => !v)}
                title="Excluir campanha"
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: NEUTRAL.slate, background: "none", border: "none" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#B91C1C"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; }}
              >
                <Trash2 size={16} />
              </button>
            )}
            {canWrite && (
              <button
                onClick={() => onUpdate?.(campaign.id, { starred: !campaign.starred })}
                className="p-1.5 rounded-lg"
                style={{ background: "none", border: "none", cursor: "pointer", color: campaign.starred ? "#F59E0B" : "#9CA3AF" }}
              >
                <Star size={16} fill={campaign.starred ? "#F59E0B" : "none"} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: NEUTRAL.slate, background: "none", border: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Confirm delete bar */}
        {confirmDelete && canWrite && !isAgencia && (
          <div className="shrink-0 px-5 py-2.5 flex items-center gap-3 border-b" style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
            <span className="text-xs font-semibold flex-1" style={{ color: "#B91C1C" }}>Confirmar exclusão desta campanha?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl"
              style={{ background: "#DC2626", color: "#FFF", border: "none", cursor: "pointer" }}
            >
              {deleting ? "Excluindo…" : "Sim, excluir"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs rounded-xl border"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFF", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* ── BODY: 3 columns ── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

          {/* ── LEFT sidebar ── */}
          <aside
            className={`w-full lg:w-[300px] flex-1 min-h-0 lg:flex-none lg:shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r p-5 space-y-4 pb-4 lg:pb-5${mobileTab !== "info" ? " hidden lg:block" : ""}`}
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
          >
            {/* Campaign name */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold mb-1" style={{ fontSize: 18, color: NEUTRAL.graphite, letterSpacing: "-0.02em", wordBreak: "break-word" }}>
                  {get("name")}
                </h2>
                <div className="text-xs" style={{ color: NEUTRAL.slate }}>
                  {(get("companyIds") || []).map(id => COMPANIES[id]?.short || id).join(", ") || <span className="italic">Sem empresa</span>}
                </div>
              </div>
              {get("performanceScore") > 0 && (
                <div
                  className="hidden lg:flex items-center justify-center rounded-full shrink-0 font-bold"
                  style={{ width: 48, height: 48, background: "#1E4D8C14", color: "#1E4D8C", border: "2px solid #1E4D8C30", fontSize: 16 }}
                >
                  {get("performanceScore")}
                </div>
              )}
            </div>

            {/* Company pills */}
            {(get("companyIds") || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(get("companyIds") || []).map(id => {
                  const co = COMPANIES[id];
                  if (!co) return null;
                  return (
                    <span key={id} className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: co.primary + "18", color: co.primary, border: `1px solid ${co.primary}30` }}>
                      {co.short}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-2" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NEUTRAL.slate, letterSpacing: "0.08em" }}>Budget</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: NEUTRAL.graphite }}>
                  {get("budget") > 0 ? formatK(get("budget")) : "—"}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NEUTRAL.slate, letterSpacing: "0.08em" }}>Canal</div>
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: NEUTRAL.graphite }}>
                  {get("channel") || "—"}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NEUTRAL.slate, letterSpacing: "0.08em" }}>KPI</div>
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: NEUTRAL.graphite }}>
                  {get("kpi") || "—"}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: NEUTRAL.slate, letterSpacing: "0.08em" }}>Lançamento</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: NEUTRAL.graphite }}>
                  {get("launchDate") ? formatDateBR(get("launchDate")) : "—"}
                </div>
              </div>
            </div>

            {/* Agency */}
            {get("agencyName") && (
              <div className="rounded-lg p-2.5" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: NEUTRAL.slate }}>Agência</div>
                <div className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>{get("agencyName")}</div>
              </div>
            )}

            {/* Drive link */}
            {get("driveFolderUrl") && (
              <a
                href={get("driveFolderUrl")}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium"
                style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", color: "#1E4D8C", textDecoration: "none" }}
              >
                <FolderOpen size={13} />
                Pasta no Google Drive
                <ExternalLink size={11} style={{ marginLeft: "auto" }} />
              </a>
            )}

            {/* Tab nav */}
            <div className="pt-1">
              <div className="flex flex-col gap-0.5">
                {TABS.map(t => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left w-full transition-colors cursor-pointer"
                      style={{
                        background:  active ? "#1E4D8C14" : "transparent",
                        color:       active ? "#1E4D8C" : NEUTRAL.slate,
                        border:      "none",
                        borderLeft:  `3px solid ${active ? "#1E4D8C" : "transparent"}`,
                      }}
                    >
                      <Icon size={14} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* ── CENTER content ── */}
          <main
            className={`flex-1 min-h-0 overflow-y-auto p-5 space-y-4${mobileTab !== "info" ? " hidden lg:block" : ""}`}
          >
            <MarketingStageBar currentStageId={get("stage")} />

            {tab === "details" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Nome da campanha">
                      {isAgencia
                        ? <ReadValue value={get("name")} />
                        : <EditInput value={get("name")} onChange={v => set("name", v)} placeholder="Nome da campanha" />}
                    </Field>
                  </div>

                  <div className="col-span-2">
                    <Field label="Empresas">
                      {isAgencia
                        ? <ReadValue value={(get("companyIds") || []).map(id => COMPANIES[id]?.short || id).join(", ")} />
                        : (
                          <div className="flex flex-wrap gap-2">
                            {COMPANY_IDS.map(id => {
                              const selected = (get("companyIds") || []).includes(id);
                              const co = COMPANIES[id];
                              return (
                                <button
                                  key={id}
                                  onClick={() => {
                                    const cur = get("companyIds") || [];
                                    set("companyIds", selected ? cur.filter(c => c !== id) : [...cur, id]);
                                  }}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                                  style={{ borderColor: selected ? co.primary : "#E5E7EB", background: selected ? co.primary + "22" : "#FFFFFF", color: selected ? co.primary : NEUTRAL.slate, cursor: "pointer" }}
                                >
                                  {selected && <Check size={10} strokeWidth={3} />}
                                  {co.short}
                                </button>
                              );
                            })}
                          </div>
                        )}
                    </Field>
                  </div>

                  <Field label="Canal">
                    {isAgencia
                      ? <ReadValue value={get("channel")} />
                      : <EditSelect value={get("channel")} onChange={v => set("channel", v)} options={MARKETING_CHANNELS} placeholder="Selecionar canal" />}
                  </Field>

                  <Field label="KPI principal">
                    {isAgencia
                      ? <ReadValue value={get("kpi")} />
                      : <EditSelect value={get("kpi")} onChange={v => set("kpi", v)} options={MARKETING_KPIS} placeholder="Selecionar KPI" />}
                  </Field>

                  <Field label="Budget (R$)">
                    {isAgencia
                      ? <ReadValue value={get("budget") > 0 ? formatK(get("budget")) : null} />
                      : <EditInput value={get("budget") || ""} onChange={v => set("budget", parseFloat(v) || 0)} type="number" placeholder="0" />}
                  </Field>

                  <Field label="Score de performance">
                    {isAgencia
                      ? <ReadValue value={get("performanceScore") > 0 ? String(get("performanceScore")) : null} />
                      : <EditInput value={get("performanceScore") || ""} onChange={v => set("performanceScore", parseInt(v) || 0)} type="number" placeholder="0–100" />}
                  </Field>

                  <Field label="Data de lançamento">
                    {isAgencia
                      ? <ReadValue value={get("launchDate") ? formatDateBR(get("launchDate")) : null} />
                      : <EditInput value={get("launchDate") ? String(get("launchDate")).slice(0, 10) : ""} onChange={v => set("launchDate", v ? new Date(v).toISOString() : null)} type="date" />}
                  </Field>

                  <Field label="Data de encerramento">
                    {isAgencia
                      ? <ReadValue value={get("endDate") ? formatDateBR(get("endDate")) : null} />
                      : <EditInput value={get("endDate") ? String(get("endDate")).slice(0, 10) : ""} onChange={v => set("endDate", v ? new Date(v).toISOString() : null)} type="date" />}
                  </Field>

                  <div className="col-span-2">
                    <Field label="Responsável interno">
                      {isAgencia
                        ? <ReadValue value={ownerUser?.name} />
                        : (
                          <EditSelect
                            value={get("owner")}
                            onChange={v => set("owner", v || null)}
                            options={users.filter(u => ["marketing", "gerente_marketing", "admin"].includes(u.role)).map(u => ({ value: u.id, label: u.name }))}
                            placeholder="Nenhum responsável"
                          />
                        )}
                    </Field>
                  </div>

                  <div className="col-span-2">
                    <Field label="Agência">
                      {isAgencia
                        ? <ReadValue value={get("agencyName")} />
                        : <EditInput value={get("agencyName")} onChange={v => set("agencyName", v)} placeholder="Nome da agência" />}
                    </Field>
                  </div>

                  <div className="col-span-2">
                    <Field label="Link UTM / Campanha">
                      {isAgencia
                        ? (get("utmUrl")
                          ? <a href={get("utmUrl")} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: "#1E4D8C" }}>
                              <Link size={11} /> {get("utmUrl")}
                            </a>
                          : <ReadValue value={null} />)
                        : <EditInput value={get("utmUrl")} onChange={v => set("utmUrl", v)} placeholder="https://…" />}
                    </Field>
                  </div>

                  <div className="col-span-2">
                    <Field label="Pasta Google Drive">
                      <div className="flex gap-2">
                        {isAgencia
                          ? (get("driveFolderUrl")
                            ? <a href={get("driveFolderUrl")} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: "#1E4D8C" }}>
                                <FolderOpen size={11} /> Abrir pasta no Drive
                              </a>
                            : <ReadValue value={null} />)
                          : (
                            <>
                              <EditInput
                                value={get("driveFolderUrl")}
                                onChange={v => {
                                  set("driveFolderUrl", v);
                                  const m = v?.match(/\/folders\/([a-zA-Z0-9_-]+)/);
                                  if (m) set("driveFolderId", m[1]);
                                  else set("driveFolderId", null);
                                }}
                                placeholder="https://drive.google.com/drive/folders/…"
                              />
                              {get("driveFolderUrl") && (
                                <a href={get("driveFolderUrl")} target="_blank" rel="noreferrer"
                                  className="flex items-center px-2.5 rounded-xl text-xs"
                                  style={{ background: "#F3F4F6", color: NEUTRAL.slate, border: "1px solid #E5E7EB", textDecoration: "none" }}>
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </>
                          )}
                      </div>
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {tab === "creative" && (
              <ChecklistPanel
                campaign={campaign}
                onUpdate={(id, checklist) => onUpdate?.(id, { approvalChecklist: checklist })}
                readOnly={false}
              />
            )}

            {tab === "files" && (
              <AttachmentsPanel
                campaign={campaign}
                canDelete={canWrite && !isAgencia}
                currentUserId={currentUser?.id}
              />
            )}

            {tab === "comments" && (
              <ComentariosTab
                campaign={campaign}
                canWrite={canWrite}
                isAgencia={isAgencia}
                onUpdate={onUpdate}
              />
            )}

            {tab === "activity" && (
              <ActivityLog activities={campaign.activities || []} />
            )}
          </main>

          {/* Mobile FASE ATUAL panel */}
          {mobileTab === "stage" && (
            <div className="lg:hidden flex-1 overflow-y-auto p-4 pb-24 space-y-2">
              {MARKETING_STAGES.map((s, idx) => {
                const isCurrent = s.id === get("stage");
                const isPast    = idx < stageIdx;
                return (
                  <button
                    key={s.id}
                    onClick={() => { if (canWrite) moveToStage(s.id); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer"
                    style={{ background: isCurrent ? s.color + "14" : "#FFFFFF", borderColor: isCurrent ? s.color : "#E5E7EB", textAlign: "left" }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: isCurrent ? s.color : isPast ? s.color + "44" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isPast
                        ? <Check size={14} color="#FFFFFF" />
                        : <span style={{ width: 8, height: 8, borderRadius: "50%", background: isCurrent ? "#FFFFFF" : s.color + "66", display: "block" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: isCurrent ? s.color : NEUTRAL.graphite }}>{s.name}</div>
                      {s.sla && <div className="text-xs" style={{ color: NEUTRAL.slate }}>SLA {s.sla}d</div>}
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.color, color: "#FFFFFF" }}>ATUAL</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── RIGHT sidebar ── */}
          <aside
            className="hidden lg:block w-full lg:w-[220px] shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l p-5"
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
          >
            <div className="text-xs font-semibold mb-3" style={{ color: NEUTRAL.graphite, letterSpacing: "0.02em" }}>
              Mover campanha para etapa
            </div>
            <div className="space-y-2">
              {stageNav.next && (
                <button
                  onClick={() => canWrite && moveToStage(stageNav.next.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                  style={{ background: stageNav.next.color + "14", color: stageNav.next.color, border: `1px solid ${stageNav.next.color}30` }}
                  onMouseEnter={e => { e.currentTarget.style.background = stageNav.next.color + "22"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = stageNav.next.color + "14"; }}
                >
                  <span>{stageNav.next.name}</span>
                  <ArrowRight size={14} />
                </button>
              )}
              {stageNav.prev && (
                <button
                  onClick={() => canWrite && moveToStage(stageNav.prev.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{ background: "#FFFFFF", color: NEUTRAL.graphite, border: "1px solid #E5E7EB" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
                >
                  <ArrowLeft size={13} />
                  <span>{stageNav.prev.name}</span>
                </button>
              )}
            </div>
          </aside>
        </div>

        {/* Mobile sticky footer — Avançar CTA */}
        <div className="lg:hidden shrink-0 border-t px-4 py-3" style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}>
          {stageNav.next ? (
            <button
              onClick={() => canWrite && moveToStage(stageNav.next.id)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm cursor-pointer"
              style={{ background: stageNav.next.color, color: "#FFFFFF", border: "none" }}
            >
              Avançar para {stageNav.next.name}
            </button>
          ) : (
            <div className="text-xs text-center py-3" style={{ color: NEUTRAL.slate }}>
              {stage?.terminal ? "Campanha encerrada" : "Última etapa"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
