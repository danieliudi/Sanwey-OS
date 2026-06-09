import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Trash2, Star, ExternalLink, Upload, File, FileImage, FileText,
  Download, Link, Check, Plus, FolderOpen, Activity, Paperclip, ListChecks,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS, CHANNEL_COLORS } from "../../constants/marketing-pipelines";
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
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Attachments panel ─────────────────────────────────────────────────────────

function AttachmentsPanel({ campaign, canDelete, currentUserId }) {
  const { attachments, loading, uploading, error, upload, remove, getSignedUrl } =
    useMarketingCampaignAttachments(campaign.id);
  const dropRef      = useRef(null);
  const inputRef     = useRef(null);
  const [dragOver, setDragOver] = useState(false);
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

  const handleFiles = (files) => {
    for (const f of files) doUpload(f);
  };

  const handleDownload = useCallback(async (att) => {
    const url = await getSignedUrl(att.file_path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = att.file_name; a.click();
  }, [getSignedUrl]);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
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
  const [items, setItems] = useState(campaign.approvalChecklist || []);
  const [newLabel, setNewLabel] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { setItems(campaign.approvalChecklist || []); }, [campaign.id, campaign.approvalChecklist]);

  const save = useCallback((updated) => {
    setItems(updated);
    onUpdate(campaign.id, updated);
  }, [campaign.id, onUpdate]);

  const toggle = (idx) => {
    const updated = items.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    );
    save(updated);
  };

  const addItem = () => {
    const label = newLabel.trim();
    if (!label) return;
    save([...items, { label, done: false }]);
    setNewLabel("");
    inputRef.current?.focus();
  };

  const removeItem = (idx) => {
    save(items.filter((_, i) => i !== idx));
  };

  const done = items.filter(i => i.done).length;

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="text-xs" style={{ color: NEUTRAL.slate }}>
          {done}/{items.length} itens confirmados
        </div>
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
              style={{
                width: 18, height: 18,
                border: item.done ? "none" : "2px solid #D1D5DB",
                background: item.done ? "#16A34A" : "transparent",
              }}
            >
              {item.done && <Check size={11} style={{ color: "#FFF" }} strokeWidth={3} />}
            </div>
            <span
              className="flex-1 text-xs"
              style={{ color: item.done ? "#15803D" : NEUTRAL.graphite, textDecoration: item.done ? "line-through" : "none" }}
            >
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
        <div className="text-xs text-center py-4" style={{ color: NEUTRAL.slate }}>
          Nenhum item de aprovação configurado.
        </div>
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
          <div
            className="mt-0.5 flex-shrink-0 rounded-full"
            style={{ width: 6, height: 6, background: NEUTRAL.slate, marginTop: 6 }}
          />
          <div className="flex-1">
            <span>{act.text || act.message || JSON.stringify(act)}</span>
            {act.at && (
              <span className="ml-1.5" style={{ color: NEUTRAL.slate, fontSize: 10 }}>
                {formatDateBR(act.at)}
              </span>
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
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: NEUTRAL.slate }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ReadValue({ value, empty = "—" }) {
  return (
    <div className="text-sm" style={{ color: value ? NEUTRAL.graphite : "#9CA3AF" }}>
      {value || empty}
    </div>
  );
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

// ── Main drawer ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "details",   label: "Detalhes",  icon: FileText },
  { id: "creative",  label: "Criativo",  icon: ListChecks },
  { id: "files",     label: "Arquivos",  icon: Paperclip },
  { id: "activity",  label: "Atividade", icon: Activity },
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
  const [tab, setTab] = useState("details");
  const [draft, setDraft] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const saveTimeout = useRef(null);
  const pendingPatch = useRef({});

  const isAgencia = currentUser?.role === "agencia";

  const flushPending = useCallback(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    if (campaign?.id && Object.keys(patch).length > 0) {
      onUpdate?.(campaign.id, patch);
    }
  }, [campaign?.id, onUpdate]);

  // Flush when switching campaigns or unmounting (close)
  useEffect(() => {
    return () => { flushPending(); };
  }, [campaign?.id, flushPending]);

  useEffect(() => {
    setDraft({});
    pendingPatch.current = {};
  }, [campaign?.id]);

  const get = (field) =>
    field in draft ? draft[field] : campaign[field];

  const set = useCallback((field, value) => {
    if (isAgencia) return;
    setDraft(prev => ({ ...prev, [field]: value }));
    pendingPatch.current = { ...pendingPatch.current, [field]: value };
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const patch = pendingPatch.current;
      pendingPatch.current = {};
      saveTimeout.current = null;
      if (Object.keys(patch).length > 0) {
        onUpdate?.(campaign.id, patch);
      }
    }, 600);
  }, [campaign?.id, onUpdate, isAgencia]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.(campaign.id);
      onClose?.();
    } finally {
      setDeleting(false);
    }
  };

  const ownerUser = users.find(u => u.id === get("owner"));
  const stage = MARKETING_STAGES.find(s => s.id === get("stage"));
  const channelStyle = get("channel") ? (CHANNEL_COLORS[get("channel")] || null) : null;

  if (!campaign) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.25)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl"
        style={{ width: "min(520px, 100vw)", background: "#FFFFFF" }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-start justify-between gap-3"
          style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {stage && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: stage.color + "22", color: stage.color, border: `1px solid ${stage.color}44` }}
                >
                  {stage.name}
                </span>
              )}
              {channelStyle && get("channel") && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: channelStyle.bg, color: channelStyle.text, border: `1px solid ${channelStyle.border}` }}
                >
                  {get("channel")}
                </span>
              )}
              {isAgencia && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A" }}
                >
                  Visitante
                </span>
              )}
            </div>
            <h2 className="font-bold text-base mt-1 leading-snug" style={{ color: NEUTRAL.graphite }}>
              {get("name")}
            </h2>
            <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>
              {(get("companyIds") || []).map(id => COMPANIES[id]?.short || id).join(", ")}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canWrite && (
              <button
                title={campaign.starred ? "Remover destaque" : "Destacar"}
                onClick={() => onUpdate?.(campaign.id, { starred: !campaign.starred })}
                className="p-1.5 rounded-lg"
                style={{ background: "none", border: "none", cursor: "pointer", color: campaign.starred ? "#F59E0B" : "#9CA3AF" }}
              >
                <Star size={16} fill={campaign.starred ? "#F59E0B" : "none"} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg"
              style={{ background: "none", border: "none", cursor: "pointer", color: NEUTRAL.slate }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stage selector */}
        {canWrite && (
          <div className="px-5 py-2 border-b" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {MARKETING_STAGES.map(s => (
                <button
                  key={s.id}
                  onClick={() => onUpdate?.(campaign.id, { stage: s.id, stageChangedAt: new Date().toISOString() })}
                  className="flex-shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors"
                  style={{
                    borderColor: s.id === get("stage") ? s.color : "#E5E7EB",
                    background:  s.id === get("stage") ? s.color + "22" : "#FFFFFF",
                    color:       s.id === get("stage") ? s.color : NEUTRAL.slate,
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "#E5E7EB" }}>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors"
                style={{
                  borderBottomColor: tab === t.id ? "#1E4D8C" : "transparent",
                  color:             tab === t.id ? "#1E4D8C" : NEUTRAL.slate,
                  background:        "none",
                  border:            "none",
                  borderBottom:      `2px solid ${tab === t.id ? "#1E4D8C" : "transparent"}`,
                  cursor:            "pointer",
                }}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "details" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Campaign name */}
                <div className="col-span-2">
                  <Field label="Nome da campanha">
                    {isAgencia
                      ? <ReadValue value={get("name")} />
                      : <EditInput value={get("name")} onChange={v => set("name", v)} placeholder="Nome da campanha" />}
                  </Field>
                </div>

                {/* Empresas */}
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
                                  const updated = selected
                                    ? cur.filter(c => c !== id)
                                    : [...cur, id];
                                  set("companyIds", updated);
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                                style={{
                                  borderColor: selected ? co.primary : "#E5E7EB",
                                  background:  selected ? co.primary + "22" : "#FFFFFF",
                                  color:       selected ? co.primary : NEUTRAL.slate,
                                  cursor:      "pointer",
                                }}
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

                {/* Channel */}
                <Field label="Canal">
                  {isAgencia
                    ? <ReadValue value={get("channel")} />
                    : <EditSelect value={get("channel")} onChange={v => set("channel", v)} options={MARKETING_CHANNELS} placeholder="Selecionar canal" />}
                </Field>

                {/* KPI */}
                <Field label="KPI principal">
                  {isAgencia
                    ? <ReadValue value={get("kpi")} />
                    : <EditSelect value={get("kpi")} onChange={v => set("kpi", v)} options={MARKETING_KPIS} placeholder="Selecionar KPI" />}
                </Field>

                {/* Budget */}
                <Field label="Budget (R$)">
                  {isAgencia
                    ? <ReadValue value={get("budget") > 0 ? formatK(get("budget")) : null} />
                    : <EditInput value={get("budget") || ""} onChange={v => set("budget", parseFloat(v) || 0)} type="number" placeholder="0" />}
                </Field>

                {/* Performance score */}
                <Field label="Score de performance">
                  {isAgencia
                    ? <ReadValue value={get("performanceScore") > 0 ? String(get("performanceScore")) : null} />
                    : <EditInput value={get("performanceScore") || ""} onChange={v => set("performanceScore", parseInt(v) || 0)} type="number" placeholder="0–100" />}
                </Field>

                {/* Launch date */}
                <Field label="Data de lançamento">
                  {isAgencia
                    ? <ReadValue value={get("launchDate") ? formatDateBR(get("launchDate")) : null} />
                    : <EditInput value={get("launchDate") ? String(get("launchDate")).slice(0, 10) : ""} onChange={v => set("launchDate", v ? new Date(v).toISOString() : null)} type="date" />}
                </Field>

                {/* End date */}
                <Field label="Data de encerramento">
                  {isAgencia
                    ? <ReadValue value={get("endDate") ? formatDateBR(get("endDate")) : null} />
                    : <EditInput value={get("endDate") ? String(get("endDate")).slice(0, 10) : ""} onChange={v => set("endDate", v ? new Date(v).toISOString() : null)} type="date" />}
                </Field>

                {/* Owner */}
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

                {/* Agency */}
                <div className="col-span-2">
                  <Field label="Agência">
                    {isAgencia
                      ? <ReadValue value={get("agencyName")} />
                      : <EditInput value={get("agencyName")} onChange={v => set("agencyName", v)} placeholder="Nome da agência" />}
                  </Field>
                </div>

                {/* UTM URL */}
                <div className="col-span-2">
                  <Field label="Link UTM / Campanha">
                    {isAgencia
                      ? (
                        get("utmUrl")
                          ? <a href={get("utmUrl")} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: "#1E4D8C" }}>
                              <Link size={11} /> {get("utmUrl")}
                            </a>
                          : <ReadValue value={null} />
                      )
                      : <EditInput value={get("utmUrl")} onChange={v => set("utmUrl", v)} placeholder="https://…" />}
                  </Field>
                </div>

                {/* Drive folder */}
                <div className="col-span-2">
                  <Field label="Pasta Google Drive">
                    <div className="flex gap-2">
                      {isAgencia
                        ? (
                          get("driveFolderUrl")
                            ? <a href={get("driveFolderUrl")} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: "#1E4D8C" }}>
                                <FolderOpen size={11} /> Abrir pasta no Drive
                              </a>
                            : <ReadValue value={null} />
                        )
                        : (
                          <>
                            <EditInput value={get("driveFolderUrl")} onChange={v => {
                              set("driveFolderUrl", v);
                              // extract folder ID from URL
                              const m = v?.match(/\/folders\/([a-zA-Z0-9_-]+)/);
                              if (m) set("driveFolderId", m[1]);
                              else set("driveFolderId", null);
                            }} placeholder="https://drive.google.com/drive/folders/…" />
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

              {/* Delete button (not for agencia) */}
              {canWrite && !isAgencia && (
                <div className="pt-4 border-t" style={{ borderColor: "#E5E7EB" }}>
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "#B91C1C" }}>Confirmar exclusão?</span>
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
                        style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFF" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; }}
                    >
                      <Trash2 size={13} /> Excluir campanha
                    </button>
                  )}
                </div>
              )}
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

          {tab === "activity" && (
            <ActivityLog activities={campaign.activities || []} />
          )}
        </div>
      </div>
    </>
  );
}
