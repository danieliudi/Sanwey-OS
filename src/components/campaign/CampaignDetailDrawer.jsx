import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Trash2, Star, ExternalLink, Upload, File, FileImage, FileText,
  Download, Link, Check, Plus, FolderOpen, Activity, Paperclip, ListChecks,
  MessageSquare, ArrowLeft, ArrowRight, Sparkles, Mail, FileDown,
  RotateCcw, Copy, Loader2, AlertCircle, Package,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS, DELIVERABLE_STAGES, DELIVERABLE_PRIORITIES } from "../../constants/marketing-pipelines";
import { useMarketingCampaignAttachments } from "../../hooks/use-marketing-campaign-attachments";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useAI } from "../../hooks/use-ai";
import { campaignStageSuggestionPrompt } from "../../constants/ai-prompts";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.zip";
const PURPLE = "#7C3AED";

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

// ── Pill SideTabs ─────────────────────────────────────────────────────────────

const SIDE_TABS = [
  { id: "form",        label: "Form",        icon: FileText },
  { id: "atividades",  label: "Atividades",  icon: Activity },
  { id: "ia",          label: "IA",          icon: Sparkles },
  { id: "arquivos",    label: "Arquivos",    icon: Paperclip },
  { id: "criativo",    label: "Checklist",   icon: ListChecks },
  { id: "entregas",    label: "Entregas",    icon: Package },
  { id: "comentarios", label: "Comentários", icon: MessageSquare },
  { id: "email",       label: "Email",       icon: Mail },
  { id: "pdf",         label: "PDF",         icon: FileDown },
];

function SideTabs({ activeId, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {SIDE_TABS.map(t => {
        const active = t.id === activeId;
        const Icon   = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
            style={{
              background:  active ? "var(--surface)" : "transparent",
              color:       active ? "var(--accent)" : "var(--text-dim)",
              border:      `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >
            <Icon size={11} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Placeholder panel ─────────────────────────────────────────────────────────

function PlaceholderPanel({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <div className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{label}</div>
      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>em breve</span>
    </div>
  );
}

// ── AI panel ──────────────────────────────────────────────────────────────────

function CampaignAIPanel({ campaign, currentUser }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [copied,  setCopied]  = useState(false);

  const handleGenerate = async () => {
    if (!isConfigured) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setCopied(false);
    try {
      const text = await complete(campaignStageSuggestionPrompt(campaign));
      setResult(text);
    } catch (err) {
      setError(err.message || "Erro ao gerar resposta.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl border" style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles size={13} style={{ color: PURPLE }} />
          <span className="text-xs font-semibold" style={{ color: PURPLE }}>Sugestão de próxima etapa</span>
          {!isConfigured && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-auto"
              style={{ background: "#FEF3C7", color: "#92400E" }}>
              configure nas Configurações
            </span>
          )}
        </div>
        <p className="text-[11px] mb-2.5 leading-relaxed" style={{ color: "#5B21B6" }}>
          A IA analisa etapa, SLA, checklist e datas para recomendar se é hora de avançar.
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading || !isConfigured}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
          style={{
            background: !isConfigured ? "var(--border)" : PURPLE,
            color:      !isConfigured ? "var(--text-dim)" : "#FFFFFF",
            border: "none",
            cursor: loading || !isConfigured ? "not-allowed" : "pointer",
            opacity: loading ? 0.8 : 1,
          }}
          title={!isConfigured ? "Configure sua LLM nas Configurações → Integrações de IA" : undefined}
          onMouseEnter={e => { if (!loading && isConfigured) e.currentTarget.style.filter = "brightness(0.9)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? "Analisando…" : "Analisar campanha"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-xl"
          style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}>
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-xs leading-relaxed whitespace-pre-line p-3 rounded-xl border"
            style={{ background: "var(--surface)", borderColor: "#DDD6FE", color: "var(--text)" }}>
            {result}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer"
              style={{ background: "var(--surface)", color: "var(--text-dim)", borderColor: "var(--border)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = PURPLE; e.currentTarget.style.color = PURPLE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              <RotateCcw size={10} />
              Regenerar
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer"
              style={{
                background: copied ? "#F0FDF4" : "var(--surface)",
                color:      copied ? "var(--success)" : "var(--text-dim)",
                borderColor: copied ? "#BBF7D0" : "var(--border)",
              }}
              onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--text)"; e.currentTarget.style.color = "var(--text)"; } }}
              onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; } }}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
        style={{ borderColor: dragOver ? "var(--accent)" : "var(--border)", background: dragOver ? "var(--surface-alt)" : "var(--surface-alt)" }}
      >
        <Upload size={20} style={{ color: dragOver ? "var(--accent)" : "var(--text-dim)" }} />
        <div className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>
          {uploading ? "Enviando…" : "Arraste ou clique para enviar"}
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>
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
        <div className="text-xs rounded-md px-3 py-2" style={{ background: "#FEF2F2", color: "var(--danger)", border: "1px solid #FECACA" }}>
          {fileError}
        </div>
      )}
      {error && (
        <div className="text-xs rounded-md px-3 py-2" style={{ background: "#FEF2F2", color: "var(--danger)", border: "1px solid #FECACA" }}>
          {error}
        </div>
      )}
      {loading && <div className="text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</div>}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => {
            const Icon = fileIcon(att.mime_type);
            return (
              <div
                key={att.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border"
                style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
              >
                <Icon size={16} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{att.file_name}</div>
                  <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                    {humanSize(att.file_size)}
                    {att.drive_url && " · Drive"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {att.drive_url && (
                    <a href={att.drive_url} target="_blank" rel="noreferrer" title="Abrir no Drive"
                      onClick={e => e.stopPropagation()}
                      className="p-1 rounded-lg"
                      style={{ color: "var(--text-dim)" }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    title="Baixar"
                    onClick={() => handleDownload(att)}
                    className="p-1 rounded-lg"
                    style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <Download size={13} />
                  </button>
                  {canDelete && (
                    <button
                      title="Remover"
                      onClick={() => remove(att)}
                      className="p-1 rounded-lg"
                      style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}
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
        <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>
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
        <div className="text-xs" style={{ color: "var(--text-dim)" }}>{done}/{items.length} itens confirmados</div>
      )}
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer"
            style={{ borderColor: item.done ? "#BBF7D0" : "var(--border)", background: item.done ? "#F0FDF4" : "var(--surface-alt)" }}
            onClick={() => toggle(idx)}
          >
            <div
              className="flex items-center justify-center rounded-md flex-shrink-0 transition-colors"
              style={{ width: 18, height: 18, border: item.done ? "none" : "2px solid var(--border-strong)", background: item.done ? "var(--success)" : "transparent" }}
            >
              {item.done && <Check size={11} style={{ color: "#FFF" }} strokeWidth={3} />}
            </div>
            <span className="flex-1 text-xs" style={{ color: item.done ? "var(--success)" : "var(--text)", textDecoration: item.done ? "line-through" : "none" }}>
              {item.label}
            </span>
            {!readOnly && (
              <button
                onClick={e => { e.stopPropagation(); removeItem(idx); }}
                className="p-0.5 rounded"
                style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}
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
            className="flex-1 min-w-0 text-xs rounded-xl border px-3 py-2 outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
          />
          <button
            onClick={addItem}
            disabled={!newLabel.trim()}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl"
            style={{ background: newLabel.trim() ? "var(--accent)" : "var(--surface-alt)", color: newLabel.trim() ? "#FFF" : "var(--text-dim)", border: "none", cursor: newLabel.trim() ? "pointer" : "default" }}
          >
            <Plus size={12} />
            Adicionar
          </button>
        </div>
      )}
      {items.length === 0 && readOnly && (
        <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Nenhum item de aprovação configurado.</div>
      )}
    </div>
  );
}

// ── Activity log ──────────────────────────────────────────────────────────────

function ActivityLog({ activities }) {
  if (!activities || activities.length === 0) {
    return <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Sem atividades registradas.</div>;
  }
  return (
    <div className="space-y-2">
      {[...activities].reverse().map((act, i) => (
        <div key={i} className="flex gap-2.5 text-xs" style={{ color: "var(--text)" }}>
          <div className="mt-0.5 flex-shrink-0 rounded-full" style={{ width: 6, height: 6, background: "var(--text-dim)", marginTop: 6 }} />
          <div className="flex-1">
            <span>{act.text || act.message || act.description || JSON.stringify(act)}</span>
            {act.at && (
              <span className="ml-1.5" style={{ color: "var(--text-dim)", fontSize: 10 }}>{formatDateBR(act.at)}</span>
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
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>{label}</div>
      {children}
    </div>
  );
}

function ReadValue({ value, empty = "—" }) {
  return <div className="text-sm" style={{ color: value ? "var(--text)" : "var(--text-faint)" }}>{value || empty}</div>;
}

function EditInput({ value, onChange, type = "text", placeholder = "" }) {
  return (
    <input
      type={type}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
      style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
      onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
      onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
    />
  );
}

function EditSelect({ value, onChange, options, placeholder = "Selecionar…" }) {
  return (
    <select
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
      style={{ borderColor: "var(--border)", color: value ? "var(--text)" : "var(--text-faint)", background: "var(--surface)" }}
      onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
      onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
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
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAdd(); } }}
          />
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={!newNote.trim() || saving}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl"
              style={{ background: newNote.trim() ? "var(--accent)" : "var(--surface-alt)", color: newNote.trim() ? "#FFF" : "var(--text-dim)", border: "none", cursor: newNote.trim() ? "pointer" : "default" }}
            >
              {saving ? "Salvando…" : "Comentar"}
            </button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Nenhum comentário ainda.</div>
      ) : (
        <div className="space-y-2">
          {[...notes].reverse().map((note, i) => (
            <div key={i} className="p-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
              <div className="text-xs whitespace-pre-wrap" style={{ color: "var(--text)" }}>{note.text}</div>
              {note.createdAt && (
                <div className="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>{formatDateBR(note.createdAt)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Entregas tab ─────────────────────────────────────────────────────────────

function EntregasTab({ campaign, canWrite }) {
  const { deliverables, loading, createDeliverable } = useMarketingDeliverables({
    campaignId: campaign.id,
  });
  const [creating, setCreating] = useState(false);
  const [title, setTitle]       = useState("");
  const [saving, setSaving]     = useState(false);

  const stageMap = useMemo(() => {
    const m = {};
    DELIVERABLE_STAGES.forEach(s => { m[s.id] = s; });
    return m;
  }, []);

  const priorityMap = useMemo(() => {
    const m = {};
    DELIVERABLE_PRIORITIES.forEach(p => { m[p.id] = p; });
    return m;
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createDeliverable({
        title: title.trim(),
        campaignId: campaign.id,
        companyIds: campaign.companyIds || [],
        stage: "solicitacao",
        stageChangedAt: new Date().toISOString(),
        priority: "media",
      });
      setTitle("");
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {canWrite && !creating && (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface-alt)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--color-industria)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text-dim)"; }}
        >
          <Plus size={14} />
          Nova entrega para esta campanha
        </button>
      )}
      {creating && (
        <div className="p-3 rounded-xl border space-y-2" style={{ borderColor: "var(--border)" }}>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            placeholder="Título da entrega..."
            className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
            style={{ borderColor: "var(--border-strong)", fontSize: 13 }}
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !title.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: "var(--color-industria)", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Criando..." : "Criar"}
            </button>
            <button onClick={() => setCreating(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: "var(--text-dim)" }} /></div>
      ) : deliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: "var(--text-faint)" }}>
          <Package size={28} strokeWidth={1.2} />
          <span className="text-xs">Nenhuma entrega vinculada</span>
        </div>
      ) : (
        <div className="space-y-2">
          {deliverables.map(d => {
            const stage = stageMap[d.stage];
            const prio  = priorityMap[d.priority];
            return (
              <div key={d.id} className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: stage?.color || "var(--text-faint)", marginTop: 4, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{d.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px]" style={{ color: stage?.color || "var(--text-dim)" }}>{stage?.name || d.stage}</span>
                    {prio && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: prio.color + "1A", color: prio.color }}>
                        {prio.label}
                      </span>
                    )}
                    {d.deadline && (
                      <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>até {formatDateBR(d.deadline)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Stage-specific field helpers ─────────────────────────────────────────────

function UserPickerField({ label, required, value, onChange, users, disabled }) {
  const selectedUser = users.find(u => u.id === value);
  return (
    <div>
      <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
        {required && <span style={{ color: "var(--accent)" }}>* </span>}{label}
      </div>
      {selectedUser ? (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: selectedUser.avatarBg || "var(--accent)" }}>
              {selectedUser.initials}
            </div>
            {selectedUser.name}
            {!disabled && (
              <button onClick={() => onChange(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: 2, color: "var(--text-faint)", display: "flex" }}>
                <X size={11} />
              </button>
            )}
          </div>
          {!disabled && (
            <button onClick={() => onChange(null)} className="text-xs" style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Alterar
            </button>
          )}
        </div>
      ) : (
        !disabled && (
          <select
            value=""
            onChange={e => e.target.value && onChange(e.target.value)}
            className="text-xs rounded-lg border outline-none w-full py-1.5 px-2"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
          >
            <option value="">+ Adicionar responsável</option>
            {users.filter(u => ["marketing","gerente_marketing","admin","gerente"].includes(u.role)).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )
      )}
    </div>
  );
}

function BriefingFields({ getCf, setCf, users, disabled, onOpenAttachments }) {
  const statuses = [
    { value: "em_andamento", label: "Em andamento" },
    { value: "concluido",    label: "Concluído" },
    { value: "pendente",     label: "Pendente" },
  ];
  return (
    <div className="border-t pt-4 space-y-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Planejamento
      </div>

      <UserPickerField
        label="Responsável pelo Planejamento"
        required
        value={getCf("briefing_owner")}
        onChange={v => setCf("briefing_owner", v)}
        users={users}
        disabled={disabled}
      />

      <div>
        <div className="text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Status do Planejamento
        </div>
        <div className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>Informe o status atual do planejamento.</div>
        <div className="space-y-1.5">
          {statuses.map(s => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer" style={{ opacity: disabled ? 0.6 : 1 }}>
              <input
                type="radio"
                name="briefing_status"
                value={s.value}
                checked={getCf("briefing_status") === s.value}
                onChange={() => !disabled && setCf("briefing_status", s.value)}
                style={{ accentColor: "var(--accent)" }}
                disabled={disabled}
              />
              <span className="text-xs" style={{ color: "var(--text)" }}>{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Recursos Necessários</div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Liste os recursos necessários para o planejamento.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("briefing_resources") || "—"}</div>
          : <textarea
              value={getCf("briefing_resources") || ""}
              onChange={e => setCf("briefing_resources", e.target.value)}
              placeholder="Digite aqui ..."
              rows={3}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none resize-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Data de Revisão</div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Informe a data para revisão do planejamento.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("briefing_review_date") ? new Date(getCf("briefing_review_date")).toLocaleDateString("pt-BR") : "—"}</div>
          : <input
              type="date"
              value={getCf("briefing_review_date") ? String(getCf("briefing_review_date")).slice(0, 10) : ""}
              onChange={e => setCf("briefing_review_date", e.target.value || null)}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Anexos do Planejamento</div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Adicione documentos ou arquivos relevantes ao planejamento.</div>
        <button
          onClick={onOpenAttachments}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Plus size={12} />
          Adicionar novos arquivos
        </button>
      </div>
    </div>
  );
}

const DEFAULT_CHECKLIST = [
  { id: "arte",       label: "Arte finalizada" },
  { id: "textos",     label: "Textos revisados" },
  { id: "orcamento",  label: "Orçamento aprovado" },
  { id: "links",      label: "Links testados" },
  { id: "legal",      label: "Conformidade legal verificada" },
];

function AprovacaoFields({ getCf, setCf, users, disabled }) {
  const storedChecklist = getCf("aprovacao_checklist");
  const checklist = Array.isArray(storedChecklist)
    ? storedChecklist
    : DEFAULT_CHECKLIST.map(item => ({ ...item, checked: false }));

  const toggleCheck = (id) => {
    if (disabled) return;
    const updated = checklist.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setCf("aprovacao_checklist", updated);
  };

  return (
    <div className="border-t pt-4 space-y-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Aprovação
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Aprovação do Documento
        </div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Confirmação de que o documento foi aprovado internamente.</div>
        <div className="space-y-1.5">
          {[{ value: "aprovado", label: "Aprovado" }, { value: "reprovado", label: "Reprovado" }].map(s => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer" style={{ opacity: disabled ? 0.6 : 1 }}>
              <input
                type="radio"
                name="aprovacao_status"
                value={s.value}
                checked={getCf("aprovacao_status") === s.value}
                onChange={() => !disabled && setCf("aprovacao_status", s.value)}
                style={{ accentColor: "var(--accent)" }}
                disabled={disabled}
              />
              <span className="text-xs" style={{ color: "var(--text)" }}>{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <UserPickerField
        label="Responsável pela Aprovação"
        required
        value={getCf("aprovacao_owner")}
        onChange={v => setCf("aprovacao_owner", v)}
        users={users}
        disabled={disabled}
      />

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Data de Aprovação
        </div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Data em que a aprovação foi realizada.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("aprovacao_date") ? new Date(getCf("aprovacao_date")).toLocaleDateString("pt-BR") : "—"}</div>
          : <input
              type="date"
              value={getCf("aprovacao_date") ? String(getCf("aprovacao_date")).slice(0, 10) : ""}
              onChange={e => setCf("aprovacao_date", e.target.value || null)}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Comentários sobre a Aprovação</div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Comentários adicionais sobre o processo de aprovação.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("aprovacao_comments") || "—"}</div>
          : <textarea
              value={getCf("aprovacao_comments") || ""}
              onChange={e => setCf("aprovacao_comments", e.target.value)}
              placeholder="Digite aqui ..."
              rows={3}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none resize-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Checklist de Requisitos
        </div>
        <div className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>Lista dos requisitos que devem ser cumpridos para aprovação.</div>
        <div className="space-y-2">
          {checklist.map(item => (
            <label key={item.id} className="flex items-center gap-2 cursor-pointer" style={{ opacity: disabled ? 0.6 : 1 }}>
              <input
                type="checkbox"
                checked={!!item.checked}
                onChange={() => toggleCheck(item.id)}
                style={{ accentColor: "var(--accent)", width: 14, height: 14 }}
                disabled={disabled}
              />
              <span className="text-xs" style={{ color: "var(--text)", textDecoration: item.checked ? "line-through" : "none", opacity: item.checked ? 0.6 : 1 }}>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

const ANALYSIS_METHODS = [
  "Google Analytics",
  "Meta Ads Manager",
  "Pesquisa de satisfação",
  "Teste A/B",
  "Relatório de mídia paga",
  "Análise qualitativa",
  "Outro",
];

function ProducaoFields({ getCf, setCf, users, disabled }) {
  const statuses = [
    { value: "nao_iniciado", label: "Não Iniciado" },
    { value: "em_progresso", label: "Em Progresso" },
    { value: "concluido",    label: "Concluído" },
  ];
  return (
    <div className="border-t pt-4 space-y-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Execução
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Execução da Tarefa
        </div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Descrição detalhada da tarefa a ser executada.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("producao_task") || "—"}</div>
          : <textarea
              value={getCf("producao_task") || ""}
              onChange={e => setCf("producao_task", e.target.value)}
              placeholder="Digite aqui ..."
              rows={3}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none resize-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Data de Execução
        </div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Data em que a execução da tarefa será realizada.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("producao_date") ? new Date(getCf("producao_date")).toLocaleDateString("pt-BR") : "—"}</div>
          : <input
              type="date"
              value={getCf("producao_date") ? String(getCf("producao_date")).slice(0, 10) : ""}
              onChange={e => setCf("producao_date", e.target.value || null)}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>

      <UserPickerField
        label="Responsável pela Execução"
        required
        value={getCf("producao_owner")}
        onChange={v => setCf("producao_owner", v)}
        users={users}
        disabled={disabled}
      />

      <div>
        <div className="text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Status da Execução
        </div>
        <div className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>Status atual da execução da tarefa.</div>
        <div className="space-y-1.5">
          {statuses.map(s => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer" style={{ opacity: disabled ? 0.6 : 1 }}>
              <input
                type="radio"
                name="producao_status"
                value={s.value}
                checked={getCf("producao_status") === s.value}
                onChange={() => !disabled && setCf("producao_status", s.value)}
                style={{ accentColor: "var(--accent)" }}
                disabled={disabled}
              />
              <span className="text-xs" style={{ color: "var(--text)" }}>{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Recursos Utilizados</div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Lista de recursos utilizados durante a execução.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("producao_resources") || "—"}</div>
          : <textarea
              value={getCf("producao_resources") || ""}
              onChange={e => setCf("producao_resources", e.target.value)}
              placeholder="Digite aqui ..."
              rows={3}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none resize-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>
    </div>
  );
}

function RevisaoFields({ getCf, setCf, users, disabled }) {
  return (
    <div className="border-t pt-4 space-y-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Análise dos Resultados
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Métodos de Análise
        </div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Selecione os métodos utilizados para análise dos resultados.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("revisao_method") || "—"}</div>
          : <select
              value={getCf("revisao_method") || ""}
              onChange={e => setCf("revisao_method", e.target.value || null)}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: getCf("revisao_method") ? "var(--text)" : "var(--text-faint)", background: "var(--surface)" }}
            >
              <option value="">Escolha uma opção</option>
              {ANALYSIS_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        }
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
          <span style={{ color: "var(--accent)" }}>* </span>Data de Conclusão da Análise
        </div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Informe a data em que a análise dos resultados foi concluída.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("revisao_date") ? new Date(getCf("revisao_date")).toLocaleDateString("pt-BR") : "—"}</div>
          : <input
              type="date"
              value={getCf("revisao_date") ? String(getCf("revisao_date")).slice(0, 10) : ""}
              onChange={e => setCf("revisao_date", e.target.value || null)}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>

      <UserPickerField
        label="Responsável pela Análise"
        required
        value={getCf("revisao_owner")}
        onChange={v => setCf("revisao_owner", v)}
        users={users}
        disabled={disabled}
      />

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Resumo dos Resultados</div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Forneça um resumo detalhado dos resultados obtidos.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("revisao_summary") || "—"}</div>
          : <textarea
              value={getCf("revisao_summary") || ""}
              onChange={e => setCf("revisao_summary", e.target.value)}
              placeholder="Digite aqui ..."
              rows={3}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none resize-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>

      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>Feedback sobre os Resultados</div>
        <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Adicione comentários ou feedback sobre os resultados analisados.</div>
        {disabled
          ? <div className="text-xs" style={{ color: "var(--text)" }}>{getCf("revisao_feedback") || "—"}</div>
          : <textarea
              value={getCf("revisao_feedback") || ""}
              onChange={e => setCf("revisao_feedback", e.target.value)}
              placeholder="Digite aqui ..."
              rows={3}
              className="w-full text-xs rounded-lg border px-3 py-2 outline-none resize-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
        }
      </div>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function CampaignDetailDrawer({
  campaign,
  onClose,
  onUpdate,
  onDelete,
  users = [],
  canWrite,
  currentUser,
}) {
  const [sideTab, setSideTab]           = useState("form");
  const [draft, setDraft]               = useState({});
  const [mobileTab, setMobileTab]       = useState("info");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const saveTimeout  = useRef(null);
  const pendingPatch = useRef({});

  const isAgencia = currentUser?.role === "agencia";
  const isManager = ["admin", "gerente_marketing"].includes(currentUser?.role);

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
    setSideTab("form");
    pendingPatch.current = {};
  }, [campaign?.id]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

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

  const getCf = (key) => (get("customFields") || {})[key];
  const setCf = (key, val) => set("customFields", { ...(get("customFields") || {}), [key]: val });

  if (!campaign) return null;

  // ── Render left tab content ─────────────────────────────────────────────────
  function LeftTabContent() {
    if (sideTab === "form") {
      return (
        <div className="space-y-3">
          <Field label="Nome da campanha">
            {isAgencia
              ? <ReadValue value={get("name")} />
              : <EditInput value={get("name")} onChange={v => set("name", v)} placeholder="Nome da campanha" />}
          </Field>

          <Field label="Empresas">
            {isAgencia
              ? <ReadValue value={(get("companyIds") || []).map(id => COMPANIES[id]?.short || id).join(", ")} />
              : (
                <div className="flex flex-wrap gap-1.5">
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
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
                        style={{ borderColor: selected ? co.primary : "var(--border)", background: selected ? co.primary + "22" : "var(--surface)", color: selected ? co.primary : "var(--text-dim)", cursor: "pointer" }}
                      >
                        {selected && <Check size={9} strokeWidth={3} />}
                        {co.short}
                      </button>
                    );
                  })}
                </div>
              )}
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Canal">
              {isAgencia ? <ReadValue value={get("channel")} /> : <EditSelect value={get("channel")} onChange={v => set("channel", v)} options={MARKETING_CHANNELS} placeholder="Canal" />}
            </Field>
            <Field label="KPI">
              {isAgencia ? <ReadValue value={get("kpi")} /> : <EditSelect value={get("kpi")} onChange={v => set("kpi", v)} options={MARKETING_KPIS} placeholder="KPI" />}
            </Field>
            <Field label="Budget (R$)">
              {isAgencia ? <ReadValue value={get("budget") > 0 ? formatK(get("budget")) : null} /> : <EditInput value={get("budget") || ""} onChange={v => set("budget", parseFloat(v) || 0)} type="number" placeholder="0" />}
            </Field>
            <Field label="Performance">
              {isAgencia ? <ReadValue value={get("performanceScore") > 0 ? String(get("performanceScore")) : null} /> : <EditInput value={get("performanceScore") || ""} onChange={v => set("performanceScore", parseInt(v) || 0)} type="number" placeholder="0–100" />}
            </Field>
            <Field label="Lançamento">
              {isAgencia ? <ReadValue value={get("launchDate") ? formatDateBR(get("launchDate")) : null} /> : <EditInput value={get("launchDate") ? String(get("launchDate")).slice(0, 10) : ""} onChange={v => set("launchDate", v ? new Date(v).toISOString() : null)} type="date" />}
            </Field>
            <Field label="Encerramento">
              {isAgencia ? <ReadValue value={get("endDate") ? formatDateBR(get("endDate")) : null} /> : <EditInput value={get("endDate") ? String(get("endDate")).slice(0, 10) : ""} onChange={v => set("endDate", v ? new Date(v).toISOString() : null)} type="date" />}
            </Field>
          </div>

          <Field label="Responsável interno">
            {isAgencia
              ? <ReadValue value={ownerUser?.name} />
              : (
                <EditSelect
                  value={get("owner")}
                  onChange={v => set("owner", v || null)}
                  options={users.filter(u => ["marketing","gerente_marketing","admin"].includes(u.role)).map(u => ({ value: u.id, label: u.name }))}
                  placeholder="Nenhum responsável"
                />
              )}
          </Field>

          <Field label="Agência">
            {isAgencia ? <ReadValue value={get("agencyName")} /> : <EditInput value={get("agencyName")} onChange={v => set("agencyName", v)} placeholder="Nome da agência" />}
          </Field>

          <Field label="Link UTM">
            {isAgencia
              ? (get("utmUrl")
                ? <a href={get("utmUrl")} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: "var(--accent)" }}><Link size={11} /> {get("utmUrl")}</a>
                : <ReadValue value={null} />)
              : <EditInput value={get("utmUrl")} onChange={v => set("utmUrl", v)} placeholder="https://…" />}
          </Field>

          <Field label="Pasta Google Drive">
            <div className="flex gap-2">
              {isAgencia
                ? (get("driveFolderUrl")
                  ? <a href={get("driveFolderUrl")} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: "var(--accent)" }}><FolderOpen size={11} /> Abrir pasta</a>
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
                      placeholder="https://drive.google.com/…"
                    />
                    {get("driveFolderUrl") && (
                      <a href={get("driveFolderUrl")} target="_blank" rel="noreferrer"
                        className="flex items-center px-2 rounded-xl text-xs shrink-0"
                        style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)", textDecoration: "none" }}>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </>
                )}
            </div>
          </Field>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-dim)" }}>
              Brief da campanha
            </div>
            {isAgencia
              ? <div className="text-sm" style={{ color: "var(--text)" }}>{get("customFields")?.brief || "—"}</div>
              : (
                <textarea
                  value={get("customFields")?.brief || ""}
                  onChange={e => set("customFields", { ...(get("customFields") || {}), brief: e.target.value })}
                  placeholder="Descreva o briefing desta campanha…"
                  rows={4}
                  className="w-full text-xs rounded-xl border px-3 py-2 outline-none resize-none"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                  onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
                />
              )}
          </div>
          <ActivityLog activities={campaign.activities || []} />
        </div>
      );
    }
    if (sideTab === "atividades") {
      return <ActivityLog activities={campaign.activities || []} />;
    }
    if (sideTab === "ia") {
      return (
        <CampaignAIPanel
          campaign={{ ...campaign, ...draft }}
          currentUser={currentUser}
        />
      );
    }
    if (sideTab === "arquivos") {
      return (
        <AttachmentsPanel
          campaign={campaign}
          canDelete={canWrite && !isAgencia}
          currentUserId={currentUser?.id}
        />
      );
    }
    if (sideTab === "criativo") {
      return (
        <ChecklistPanel
          campaign={campaign}
          onUpdate={(id, checklist) => onUpdate?.(id, { approvalChecklist: checklist })}
          readOnly={isAgencia || !canWrite}
        />
      );
    }
    if (sideTab === "comentarios") {
      return (
        <ComentariosTab
          campaign={campaign}
          canWrite={canWrite}
          isAgencia={isAgencia}
          onUpdate={onUpdate}
        />
      );
    }
    if (sideTab === "entregas") {
      return <EntregasTab campaign={campaign} canWrite={canWrite} />;
    }
    if (sideTab === "email") return <PlaceholderPanel label="Integração de e-mail" />;
    if (sideTab === "pdf")   return <PlaceholderPanel label="Exportar PDF" />;
    return null;
  }

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
        style={{ background: "var(--surface)", boxShadow: "0 24px 64px rgba(32,26,26,0.18)", overflow: "hidden", height: "100%" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-10 flex flex-col shrink-0" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" style={{ background: "none", border: "none", color: "var(--text-dim)" }}>
              <X size={20} />
            </button>
            <div className="flex-1 mx-3 text-center min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{get("name")}</div>
              {stage && <div className="text-xs font-semibold" style={{ color: stage.color }}>{stage.name}</div>}
            </div>
            {canWrite && (
              <button
                onClick={() => onUpdate?.(campaign.id, { starred: !campaign.starred })}
                className="p-1.5 rounded-lg"
                style={{ background: "none", border: "none", cursor: "pointer", color: campaign.starred ? "#F59E0B" : "var(--text-faint)" }}
              >
                <Star size={16} fill={campaign.starred ? "#F59E0B" : "none"} />
              </button>
            )}
          </div>
          <div className="flex border-t" style={{ borderColor: "var(--border)" }}>
            {[{ id: "info", label: "INFORMAÇÕES" }, { id: "stage", label: "FASE ATUAL" }].map(t => (
              <button
                key={t.id}
                onClick={() => setMobileTab(t.id)}
                className="flex-1 py-2.5 text-xs font-bold tracking-wider cursor-pointer"
                style={{ background: "none", border: "none", borderBottom: `2px solid ${mobileTab === t.id ? "var(--accent)" : "transparent"}`, color: mobileTab === t.id ? "var(--accent)" : "var(--text-dim)" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop header */}
        <div
          className="hidden lg:flex sticky top-0 z-10 px-5 py-3.5 border-b items-center justify-between shrink-0"
          style={{ background: "rgba(255,255,255,0.97)", borderColor: "var(--border)", backdropFilter: "blur(8px)" }}
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
                style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}>
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
                style={{ color: "var(--text-dim)", background: "none", border: "none" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                <Trash2 size={16} />
              </button>
            )}
            {canWrite && (
              <button
                onClick={() => onUpdate?.(campaign.id, { starred: !campaign.starred })}
                className="p-1.5 rounded-lg"
                style={{ background: "none", border: "none", cursor: "pointer", color: campaign.starred ? "#F59E0B" : "var(--text-faint)" }}
              >
                <Star size={16} fill={campaign.starred ? "#F59E0B" : "none"} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: "var(--text-dim)", background: "none", border: "none" }}
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
            <span className="text-xs font-semibold flex-1" style={{ color: "var(--danger)" }}>Confirmar exclusão desta campanha?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl"
              style={{ background: "var(--danger)", color: "#FFF", border: "none", cursor: "pointer" }}
            >
              {deleting ? "Excluindo…" : "Sim, excluir"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs rounded-xl border"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* ── BODY: 3 columns ── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

          {/* ── LEFT sidebar ── */}
          <aside
            className={`w-full lg:w-[300px] flex-1 min-h-0 lg:flex-none lg:shrink-0 overflow-y-auto overflow-x-hidden border-b lg:border-b-0 lg:border-r p-5 space-y-4 pb-4 lg:pb-5${mobileTab !== "info" ? " hidden lg:flex lg:flex-col" : ""}`}
            style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
          >
            {/* Campaign name */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold mb-1" style={{ fontSize: 18, color: "var(--text)", letterSpacing: "-0.02em", wordBreak: "break-word" }}>
                  {get("name")}
                </h2>
                <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {(get("companyIds") || []).map(id => COMPANIES[id]?.short || id).join(", ") || <span className="italic">Sem empresa</span>}
                </div>
              </div>
              {get("performanceScore") > 0 && (
                <div
                  className="hidden lg:flex items-center justify-center rounded-full shrink-0 font-bold"
                  style={{ width: 48, height: 48, background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)", border: "2px solid color-mix(in srgb, var(--accent) 19%, transparent)", fontSize: 16 }}
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
              <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Budget</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: "var(--text)" }}>
                  {get("budget") > 0 ? formatK(get("budget")) : "—"}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Canal</div>
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: "var(--text)" }}>
                  {get("channel") || "—"}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>KPI</div>
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: "var(--text)" }}>
                  {get("kpi") || "—"}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Lançamento</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: "var(--text)" }}>
                  {get("launchDate") ? formatDateBR(get("launchDate")) : "—"}
                </div>
              </div>
            </div>

            {/* Agency */}
            {get("agencyName") && (
              <div className="rounded-lg p-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-dim)" }}>Agência</div>
                <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>{get("agencyName")}</div>
              </div>
            )}

            {/* Drive link */}
            {get("driveFolderUrl") && (
              <a
                href={get("driveFolderUrl")}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--accent)", textDecoration: "none" }}
              >
                <FolderOpen size={13} />
                Pasta no Google Drive
                <ExternalLink size={11} style={{ marginLeft: "auto" }} />
              </a>
            )}

            {/* ── Pill SideTabs ── */}
            <div className="pt-1 border-t" style={{ borderColor: "var(--border)" }}>
              <SideTabs activeId={sideTab} onChange={setSideTab} />
            </div>

            {/* ── Tab content ── */}
            <div className="flex-1">
              <LeftTabContent />
            </div>
          </aside>

          {/* ── CENTER content ── */}
          <main
            className={`flex-1 min-h-0 overflow-y-auto p-5 space-y-4${mobileTab !== "stage" ? " hidden lg:block" : ""}`}
          >
            <div className="space-y-4">
              {/* Stage-specific fields */}
              {stage?.id === "briefing" && (
                <BriefingFields
                  getCf={getCf}
                  setCf={setCf}
                  users={users}
                  disabled={!canWrite || isAgencia}
                  onOpenAttachments={() => setSideTab("attachments")}
                />
              )}
              {stage?.id === "aprovacao" && (
                <AprovacaoFields
                  getCf={getCf}
                  setCf={setCf}
                  users={users}
                  disabled={!canWrite || isAgencia}
                />
              )}
              {stage?.id === "producao" && (
                <ProducaoFields
                  getCf={getCf}
                  setCf={setCf}
                  users={users}
                  disabled={!canWrite || isAgencia}
                />
              )}
              {stage?.id === "revisao" && (
                <RevisaoFields
                  getCf={getCf}
                  setCf={setCf}
                  users={users}
                  disabled={!canWrite || isAgencia}
                />
              )}
            </div>
          </main>

          {/* ── RIGHT sidebar ── */}
          <aside
            className="hidden lg:flex lg:flex-col w-full lg:w-[220px] shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l p-5 gap-4"
            style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
          >
            <div>
              <div className="text-xs font-semibold mb-3" style={{ color: "var(--text)", letterSpacing: "0.02em" }}>
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
                    style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
                  >
                    <ArrowLeft size={13} />
                    <span>{stageNav.prev.name}</span>
                  </button>
                )}
              </div>
            </div>

            {/* AI move link */}
            <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setSideTab("ia")}
                className="flex items-center gap-1.5 text-xs w-full cursor-pointer"
                style={{ background: "none", border: "none", color: "var(--text-dim)", padding: 0, textAlign: "left" }}
                onMouseEnter={e => { e.currentTarget.style.color = PURPLE; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                <Sparkles size={12} />
                Mover cards com IA
              </button>
              {isManager && (
                <button
                  className="flex items-center gap-1.5 text-xs w-full cursor-pointer"
                  style={{ background: "none", border: "none", color: "var(--text-dim)", padding: 0, textAlign: "left", opacity: 0.7 }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.opacity = "0.7"; }}
                  title="Configure automações de mover cards nas Configurações"
                >
                  <Activity size={12} />
                  Configurar mover cards
                </button>
              )}
            </div>
          </aside>
        </div>

        {/* Mobile sticky footer — Avançar CTA */}
        <div className="lg:hidden shrink-0 border-t px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {stageNav.next ? (
            <button
              onClick={() => canWrite && moveToStage(stageNav.next.id)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm cursor-pointer"
              style={{ background: stageNav.next.color, color: "#FFFFFF", border: "none" }}
            >
              Avançar para {stageNav.next.name}
            </button>
          ) : (
            <div className="text-xs text-center py-3" style={{ color: "var(--text-dim)" }}>
              {stage?.terminal ? "Campanha encerrada" : "Última etapa"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
