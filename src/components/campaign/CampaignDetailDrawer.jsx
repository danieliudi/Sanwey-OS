import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Trash2, Star, ExternalLink, Upload, File, FileImage, FileText,
  Download, Link, Check, Plus, FolderOpen, Activity, Paperclip, ListChecks,
  Sparkles, ChevronRight, History, Layers,
  Loader2, Package,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS, DELIVERABLE_STAGES, DELIVERABLE_PRIORITIES, PERFORMANCE_HINT_BY_KPI, DEFAULT_PERFORMANCE_HINT } from "../../constants/marketing-pipelines";
import { useMarketingCampaignAttachments } from "../../hooks/use-marketing-campaign-attachments";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingTasks } from "../../hooks/use-marketing-tasks";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { HelpTooltip } from "../ui/HelpTooltip";
import { CurrencyInput } from "../ui/CurrencyInput";
import { CommentsPanel } from "../shared/CommentsPanel";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";
import { StageNavigator } from "../shared/StageNavigator";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { DetailDrawerTabs } from "../shared/DetailDrawerTabs";
import { EditableTitle } from "../shared/EditableTitle";
import { RHStageHistoryPanel } from "../rh-pipeline/RHDetailDrawerShell";
import { resolveVisibleFields } from "../../utils/field-conditions";
import { RecordAIPanel } from "../shared/RecordAIPanel";
import { campaignStageSuggestionPrompt, genericCardSummaryPrompt } from "../../constants/ai-prompts";
import { formatK } from "../../utils/currency";
import { formatDateBR, localDateInputToISOString } from "../../utils/date";
import { EVENT_CHECKLIST_TEMPLATE } from "../../constants/event-checklist-template";
import { supabase } from "../../lib/supabase";
import { Modal } from "../ui/Modal";

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
  { id: "fase",        label: "Fase atual",  icon: Layers },
  { id: "form",        label: "Form",        icon: FileText },
  { id: "atividades",  label: "Atividades",  icon: Activity },
  { id: "historico",   label: "Histórico",   icon: History },
  { id: "ia",          label: "IA",          icon: Sparkles },
  { id: "arquivos",    label: "Arquivos",    icon: Paperclip },
  { id: "criativo",    label: "Checklist",   icon: ListChecks },
  { id: "entregas",    label: "Entregas",    icon: Package },
];

// ── AI panel ──────────────────────────────────────────────────────────────────

function CampaignAIPanel({ campaign, currentUser, stage, stageFields = [], recentComments = [] }) {
  const daysInStage = campaign.stageChangedAt
    ? Math.floor((Date.now() - new Date(campaign.stageChangedAt)) / 86400000)
    : 0;

  const features = [
    {
      id: "summary",
      label: "Resumo & Próximo passo",
      buildMessages: () => genericCardSummaryPrompt({
        title: campaign.name,
        domainLabel: "Campanhas",
        stageName: stage?.name || campaign.stage,
        slaDays: stage?.sla,
        daysInStage,
        customFields: stageFields,
        recentComments,
      }),
    },
    {
      id: "stage-suggestion",
      label: "Sugestão de etapa",
      buildMessages: () => campaignStageSuggestionPrompt(campaign),
    },
  ];

  return (
    <RecordAIPanel
      currentUser={currentUser}
      features={features}
      defaultFeatureId="summary"
    />
  );
}

// ── Checklist de evento (N segmentos → N marketing_tasks + rh_checklists) ────

function ApplyEventChecklistButton({ campaign, currentUser }) {
  const { tasks, loading } = useMarketingTasks({
    userId: currentUser?.id,
    roles: currentUser?.roles,
    campaignId: campaign.id,
  });
  const [applying, setApplying] = useState(false);

  // Idempotência real (não só estado local da sessão do drawer): tasks já vem
  // filtrado por campaignId, então isso continua correto ao fechar e reabrir
  // o drawer, sem precisar de flag própria. `loading` trava o clique
  // enquanto essa checagem ainda não voltou do banco (senão dava pra clicar
  // duas vezes antes do fetch inicial confirmar que já tinha sido aplicado).
  const alreadyApplied = tasks.some(t =>
    EVENT_CHECKLIST_TEMPLATE.some(seg => seg.segment === t.title)
  );

  const [applyError, setApplyError] = useState(null);

  const [confirming, setConfirming] = useState(false);
  // selection[segIdx][itemIdx] = boolean. Inicializado com tudo true toda vez que o modal abre.
  const [selection, setSelection] = useState(() => EVENT_CHECKLIST_TEMPLATE.map(seg => seg.items.map(() => true)));
  const [expandedSegments, setExpandedSegments] = useState(() => new Set());

  const openConfirm = () => {
    if (applying || loading || alreadyApplied) return;
    setSelection(EVENT_CHECKLIST_TEMPLATE.map(seg => seg.items.map(() => true)));
    setExpandedSegments(new Set());
    setApplyError(null);
    setConfirming(true);
  };

  function segmentState(segIdx) {
    const items = selection[segIdx];
    if (items.every(Boolean)) return "checked";
    if (items.every(v => !v)) return "unchecked";
    return "indeterminate";
  }
  const taskCount = selection.filter(items => items.some(Boolean)).length;
  const itemCount = selection.reduce((sum, items) => sum + items.filter(Boolean).length, 0);
  const allState = taskCount === 0 ? "unchecked" : (itemCount === EVENT_CHECKLIST_TEMPLATE.reduce((s, seg) => s + seg.items.length, 0) ? "checked" : "indeterminate");

  function toggleSegment(segIdx) {
    const makeChecked = segmentState(segIdx) !== "checked";
    setSelection(prev => prev.map((items, i) => i === segIdx ? items.map(() => makeChecked) : items));
  }
  function toggleItem(segIdx, itemIdx) {
    setSelection(prev => prev.map((items, i) => i === segIdx ? items.map((v, j) => j === itemIdx ? !v : v) : items));
  }
  function toggleAll() {
    const makeChecked = allState !== "checked";
    setSelection(EVENT_CHECKLIST_TEMPLATE.map(seg => seg.items.map(() => makeChecked)));
  }
  function toggleExpand(segIdx) {
    setExpandedSegments(prev => { const next = new Set(prev); next.has(segIdx) ? next.delete(segIdx) : next.add(segIdx); return next; });
  }

  // RPC atômica (apply_event_checklist_template, com advisory lock por
  // campanha) no lugar do laço client-side — evita a janela de corrida entre
  // 2 sessões aplicando o checklist quase ao mesmo tempo (achado real de QA).
  const handleApply = async () => {
    if (applying || loading) return;
    const segmentsToApply = EVENT_CHECKLIST_TEMPLATE
      .map((seg, segIdx) => ({ segment: seg.segment, items: seg.items.filter((_, itemIdx) => selection[segIdx][itemIdx]) }))
      .filter(seg => seg.items.length > 0);
    if (segmentsToApply.length === 0) return;
    setApplying(true);
    setApplyError(null);
    try {
      const { error: err } = await supabase.rpc("apply_event_checklist_template", {
        p_campaign_id:  campaign.id,
        p_company_ids:  campaign.companyIds || [],
        p_owner_ids:    campaign.ownerIds || [],
        p_segments:     segmentsToApply,
      });
      if (err) throw err;
      setConfirming(false);
    } catch (err) {
      setApplyError(err?.message || "Erro ao aplicar checklist de evento.");
    } finally {
      setApplying(false);
    }
  };

  if (alreadyApplied && !applying) {
    return (
      <div className="text-xs" style={{ color: "var(--text-dim)" }}>
        <Check size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />
        Checklist de evento já aplicado — veja em Tarefas
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={openConfirm}
        disabled={applying || loading}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl"
        style={{
          background: "var(--accent)",
          color: "var(--on-accent)",
          border: "none",
          cursor: (applying || loading) ? "not-allowed" : "pointer",
          opacity: (applying || loading) ? 0.7 : 1,
        }}
      >
        <ListChecks size={12} />
        {applying ? "Aplicando…" : "Aplicar checklist de evento"}
      </button>
      {applyError && !confirming && (
        <div className="text-xs" style={{ color: "var(--danger)" }}>
          {applyError}
        </div>
      )}

      <Modal open={confirming} onClose={() => { if (!applying) { setConfirming(false); setApplyError(null); } }} title="Aplicar checklist de evento" width={480}>
        <div className="px-6 pt-1 pb-3 text-xs" style={{ color: "var(--text-dim)" }}>
          Cria um card de tarefa por segmento marcado abaixo, cada um com seu checklist já preenchido. Desmarque o
          que não se aplica a este evento — dá pra desmarcar o segmento inteiro ou só alguns itens dele.
        </div>

        <div className="flex items-center justify-between px-6 py-2.5" style={{ background: "var(--surface-alt)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text)", background: "none", border: "none", cursor: "pointer" }}>
            <TriStateCheckbox state={allState} />
            Selecionar todos
          </button>
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>{taskCount} tarefa{taskCount !== 1 ? "s" : ""} · {itemCount} ite{itemCount !== 1 ? "ns" : "m"} selecionado{itemCount !== 1 ? "s" : ""}</span>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
          {EVENT_CHECKLIST_TEMPLATE.map((seg, segIdx) => (
            <div key={seg.segment} style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-start gap-2.5 px-6 py-3 cursor-pointer" onClick={() => toggleExpand(segIdx)}>
                <button onClick={e => { e.stopPropagation(); toggleSegment(segIdx); }} style={{ background: "none", border: "none", padding: 0, marginTop: 1 }}>
                  <TriStateCheckbox state={segmentState(segIdx)} />
                </button>
                <ChevronRight size={14} style={{ color: "var(--text-faint)", flexShrink: 0, marginTop: 2, transform: expandedSegments.has(segIdx) ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold" style={{ color: segmentState(segIdx) === "unchecked" ? "var(--text-faint)" : "var(--text)" }}>{seg.segment}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                    {selection[segIdx].filter(Boolean).length}/{seg.items.length} itens selecionados
                    {segmentState(segIdx) === "unchecked" && " · tarefa não será criada"}
                  </div>
                </div>
              </div>
              {expandedSegments.has(segIdx) && (
                <div className="pb-2" style={{ paddingLeft: 60, paddingRight: 24 }}>
                  {seg.items.map((item, itemIdx) => (
                    <label key={item} className="flex items-center gap-2.5 py-1 cursor-pointer" style={{ fontSize: 12.5 }}>
                      <input type="checkbox" checked={selection[segIdx][itemIdx]} onChange={() => toggleItem(segIdx, itemIdx)} style={{ width: 14, height: 14, accentColor: "var(--accent)" }} />
                      <span style={{ color: selection[segIdx][itemIdx] ? "var(--text-dim)" : "var(--text-faint)", textDecoration: selection[segIdx][itemIdx] ? "none" : "line-through" }}>{item}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => { setConfirming(false); setApplyError(null); }} disabled={applying} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "transparent" }}>
            Cancelar
          </button>
          <button onClick={handleApply} disabled={applying || taskCount === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", opacity: (applying || taskCount === 0) ? 0.6 : 1, cursor: (applying || taskCount === 0) ? "not-allowed" : "pointer" }}>
            <ListChecks size={13} />
            {applying ? "Aplicando…" : `Aplicar (${taskCount})`}
          </button>
        </div>

        {applyError && (
          <div className="px-6 pb-4 text-xs" style={{ color: "var(--danger)" }}>{applyError}</div>
        )}
      </Modal>
    </div>
  );
}

function TriStateCheckbox({ state }) {
  const size = 16;
  if (state === "checked") {
    return (
      <span
        className="inline-flex items-center justify-center rounded-sm flex-shrink-0"
        style={{ width: size, height: size, background: "var(--accent)", border: "none" }}
      >
        <Check size={11} strokeWidth={3} style={{ color: "var(--on-accent)" }} />
      </span>
    );
  }
  if (state === "indeterminate") {
    return (
      <span
        className="inline-flex items-center justify-center rounded-sm flex-shrink-0"
        style={{ width: size, height: size, background: "transparent", border: "1.5px solid var(--accent)" }}
      >
        <span style={{ width: 8, height: 2, background: "var(--accent)", borderRadius: 1 }} />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm flex-shrink-0"
      style={{ width: size, height: size, background: "transparent", border: "1.5px solid var(--border-strong)" }}
    />
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
    // Sem target="_blank" o clique navegava a própria aba pro arquivo cru —
    // a URL assinada é de outra origem (*.supabase.co), e o navegador ignora
    // o atributo `download` de um <a> cross-origin, então virava navegação
    // de verdade, sem nenhuma UI do app pra sair de lá. Mesmo padrão já
    // usado em LeadDetailDrawer.jsx.
    const a = document.createElement("a");
    a.href = url;
    a.download = att.file_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
        <div className="text-xs rounded-md px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}>
          {fileError}
        </div>
      )}
      {error && (
        <div className="text-xs rounded-md px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}>
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
            style={{ background: newLabel.trim() ? "var(--accent)" : "var(--surface-alt)", color: newLabel.trim() ? "var(--on-accent)" : "var(--text-dim)", border: "none", cursor: newLabel.trim() ? "pointer" : "default" }}
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

export function ActivityLog({ activities }) {
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

function Field({ label, children, hint }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{label}</div>
        <HelpTooltip text={hint} size={11} />
      </div>
      {children}
    </div>
  );
}

function ReadValue({ value, empty = "—" }) {
  return <div className="text-sm" style={{ color: value ? "var(--text)" : "var(--text-faint)" }}>{value || empty}</div>;
}

// Formata valor de campo customizado (rh_pipeline_stage_fields) pra exibição
// somente-leitura (visitante/agência) — mesma ideia do getCf/setCf abaixo,
// mas sem editor.
function formatCustomFieldValue(v) {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
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

// ── Entregas tab ─────────────────────────────────────────────────────────────

function EntregasTab({ campaign, canWrite, currentUser }) {
  // Achado da auditoria de plataforma: sem role/roles, o canWrite interno do
  // hook ficava sempre false e createDeliverable virava um no-op silencioso
  // (retornava null sem erro) mesmo pra quem tinha permissão de verdade.
  const { deliverables, loading, createDeliverable } = useMarketingDeliverables({
    campaignId: campaign.id,
    userId: currentUser?.id,
    role: currentUser?.role,
    roles: currentUser?.roles,
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
  onStageMoved,
  onUpdate,
  onMoveToStage,
  onDelete,
  users = [],
  canWrite,
  currentUser,
  notifyMentions,
  stages,
}) {
  // Etapas dinâmicas (rh_pipeline_stages, já buscadas pelo pai) — cai pro
  // MARKETING_STAGES fixo só se a lista do banco vier vazia. Antes este
  // drawer sempre usava a lista fixa das 6 etapas originais, então renomear/
  // adicionar/remover etapa via "Editar etapas" quebrava o badge, a
  // navegação prev/next e o "mover para etapa" pra qualquer campanha fora
  // dessas 6 — enquanto o Kanban ao lado já mostrava a etapa nova certinho.
  // Achado da auditoria de fricção de 18/07.
  const effectiveStages = stages?.length ? stages : MARKETING_STAGES;
  const [sideTab, setSideTab]           = useState("fase");
  const [draft, setDraft]               = useState({});
  const [attemptedMove, setAttemptedMove] = useState(false);
  const saveTimeout  = useRef(null);
  const pendingPatch = useRef({});

  const isAgencia = currentUser?.role === "agencia";

  // Vínculo opcional a um fornecedor de marketing (categoria "agência") —
  // escopa quem tem role="agencia" e um fornecedor vinculado ao próprio login
  // a só enxergar esta campanha se for a mesma agência (ver
  // 20260718_marketing_agencia_supplier_scoping.sql). Só existia na criação
  // (CampaignCreateModal) até agora — campanhas já criadas não tinham como
  // ganhar/trocar esse vínculo depois, então nunca apareciam vinculadas.
  const { suppliers: allSuppliers } = useMarketingSuppliers({});
  const agencySuppliers = useMemo(
    () => allSuppliers.filter(s => s.category === "agencia" && s.isActive),
    [allSuppliers]
  );

  const flushPending = useCallback(() => {
    if (saveTimeout.current) { clearTimeout(saveTimeout.current); saveTimeout.current = null; }
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    if (campaign?.id && Object.keys(patch).length > 0) onUpdate?.(campaign.id, patch);
  }, [campaign?.id, onUpdate]);

  useEffect(() => () => { flushPending(); }, [campaign?.id, flushPending]);

  useEffect(() => {
    setDraft({});
    setSideTab("fase");
    setAttemptedMove(false);
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

  const stageIdx = effectiveStages.findIndex(s => s.id === get("stage"));
  const stage    = effectiveStages[stageIdx] || null;

  const moveToStage = useCallback(async (toStageId) => {
    if (!campaign || !toStageId) return;
    // Passa pela mesma validação de campo obrigatório (estático + dinâmico)
    // do drag-and-drop/"Mover para" do board — antes esse botão chamava
    // onUpdate direto e contornava a checagem por completo (achado BUG-11
    // da auditoria de QA: só Campanhas tinha esse bypass, Tarefas/Entregas
    // já tinham sido corrigidos).
    if (onMoveToStage) {
      const ok = await onMoveToStage(campaign.id, toStageId);
      if (ok === false) { setAttemptedMove(true); return; }
      setAttemptedMove(false);
      if (onStageMoved) { onClose?.(); onStageMoved(campaign.id); }
      return;
    }
    onUpdate?.(campaign.id, { stage: toStageId, stageChangedAt: new Date().toISOString() });
    // Fecha o drawer agora (sinal visual de que moveu) e reabre já na etapa
    // nova — em vez de só trocar o conteúdo por baixo do drawer aberto.
    if (onStageMoved) { onClose?.(); onStageMoved(campaign.id); }
  }, [campaign, onUpdate, onMoveToStage, onStageMoved, onClose]);

  // FASE 5: mais de um responsável por campanha — resolve owner_ids (com
  // fallback pro owner escalar em campanhas legadas) contra a lista de
  // usuários pro AssigneeMultiSelect/AvatarStack abaixo.
  const ownerIds = get("ownerIds")?.length ? get("ownerIds") : (get("owner") ? [get("owner")] : []);
  const resolvedOwners = ownerIds.map(id => users.find(u => u.id === id)).filter(Boolean);

  const getCf = (key) => (get("customFields") || {})[key];
  const setCf = (key, val) => set("customFields", { ...(get("customFields") || {}), [key]: val });

  // Campos customizados configurados pelo admin via "Editar campos desta
  // etapa" (rh_pipeline_stage_fields, domain="marketing") — coexistem no
  // mesmo customFields jsonb usado pelos campos fixos acima (getCf/setCf),
  // só que com fieldKey escolhido pelo admin em vez de hardcoded.
  const stageFieldsHook = useRHStageFields("marketing");
  const customDefs = stageFieldsHook.getFields(get("stage"));
  const visibleCustomDefs = resolveVisibleFields(customDefs, get("customFields") || {});

  const aiStageFields = visibleCustomDefs
    .map(f => ({ label: f.label, value: formatCustomFieldValue(getCf(f.fieldKey)) }))
    .filter(f => f.value !== null);
  const aiRecentComments = (campaign?.notes || [])
    .filter(n => !n.deletedAt && n.text)
    .map(n => n.text);

  // Quem pode ser @mencionado nos comentários desta campanha — mesmo padrão
  // usado no LeadDetailDrawer, mas com escopo "marketing" e incluindo a
  // agência (que já tem acesso de leitura a campanhas/entregas).
  const mentionableUsers = useMemo(() => (
    getMentionableUsers(users, { domain: "marketing", includeAgencia: true })
  ), [users]);

  // Normaliza campaign.notes ({text, createdAt}, sem autor nas entradas
  // antigas) pro formato que CommentsPanel espera — nunca inventamos um
  // autor pras entradas antigas que não tinham authorId.
  const comments = useMemo(() => {
    const notes = Array.isArray(campaign?.notes) ? campaign.notes : [];
    const resolveMentionNames = (ids) => (ids || [])
      .map(id => (users || []).find(u => u.id === id)?.name)
      .filter(Boolean);
    return [...notes].filter(n => !n.deletedAt).reverse().map((n, i) => {
      const author = n.authorId ? (users || []).find(u => u.id === n.authorId) : null;
      return {
        id: n.id || `note-${i}-${n.createdAt || ""}`,
        authorId: n.authorId || null,
        authorName: n.authorName || author?.name || null,
        avatarBg: author?.avatarBg,
        avatarUrl: author?.avatarUrl,
        initials: author?.initials,
        text: n.text,
        mentionedNames: resolveMentionNames(n.mentionedIds),
        createdAt: n.createdAt,
        editedAt: n.editedAt || null,
      };
    });
  }, [campaign?.notes, users]);

  const onUpdateComment = useCallback(async (id, patch) => {
    if (!campaign) return;
    const updatedNotes = (campaign.notes || []).map(n => (n.id === id ? { ...n, ...patch } : n));
    await onUpdate?.(campaign.id, { notes: updatedNotes });
  }, [campaign, onUpdate]);

  const onAddComment = useCallback(async (text, mentionedIds) => {
    if (!campaign) return;
    const newNote = {
      id: crypto.randomUUID(),
      authorId: currentUser?.id || null,
      authorName: currentUser?.name || null,
      avatarBg: currentUser?.avatarBg,
      text,
      mentionedIds,
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [...(campaign.notes || []), newNote];
    await onUpdate?.(campaign.id, { notes: updatedNotes });
    if (mentionedIds?.length > 0 && notifyMentions) {
      notifyMentions(mentionedIds, {
        title: `${currentUser?.name || "Alguém"} te mencionou`,
        body: `Em um comentário na campanha "${campaign.name}"`,
        link: { module: "campaigns", id: campaign.id },
      });
    }
  }, [campaign, onUpdate, currentUser, notifyMentions]);

  if (!campaign) return null;

  // ── Render center tab content ───────────────────────────────────────────────
  function CenterTabContent() {
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
              {isAgencia ? <ReadValue value={get("channel")} /> : <EditSelect value={get("channel")} onChange={v => set("channel", v)} options={MARKETING_CHANNELS} placeholder="Selecionar canal" />}
            </Field>
            <Field label="KPI">
              {isAgencia ? <ReadValue value={get("kpi")} /> : <EditSelect value={get("kpi")} onChange={v => set("kpi", v)} options={MARKETING_KPIS} placeholder="Selecionar KPI" />}
            </Field>
            <Field label={isAgencia ? "Orçamento" : "Orçamento (R$)"}>
              {isAgencia ? <ReadValue value={get("budget") > 0 ? formatK(get("budget")) : null} /> : (
                <CurrencyInput
                  prefix={null}
                  value={get("budget") || ""}
                  onChange={v => set("budget", v === "" ? 0 : v)}
                  placeholder="0,00"
                  className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                  onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
                />
              )}
            </Field>
            <Field label="Performance" hint={PERFORMANCE_HINT_BY_KPI[get("kpi")] || DEFAULT_PERFORMANCE_HINT}>
              {isAgencia ? <ReadValue value={get("performanceScore") > 0 ? String(get("performanceScore")) : null} /> : <EditInput value={get("performanceScore") || ""} onChange={v => set("performanceScore", parseInt(v) || 0)} type="number" placeholder="0–100" />}
            </Field>
            <Field label="Lançamento">
              {isAgencia ? <ReadValue value={get("launchDate") ? formatDateBR(get("launchDate")) : null} /> : <EditInput value={get("launchDate") ? String(get("launchDate")).slice(0, 10) : ""} onChange={v => set("launchDate", localDateInputToISOString(v))} type="date" />}
            </Field>
            <Field label="Encerramento">
              {isAgencia ? <ReadValue value={get("endDate") ? formatDateBR(get("endDate")) : null} /> : <EditInput value={get("endDate") ? String(get("endDate")).slice(0, 10) : ""} onChange={v => set("endDate", localDateInputToISOString(v))} type="date" />}
            </Field>
          </div>

          {!isAgencia && agencySuppliers.length > 0 && (
            <Field
              label="Fornecedor (Agência)"
              hint="Login da agência vinculada só vê as próprias campanhas/entregas. Sem fornecedor, qualquer agência enxerga esta campanha."
            >
              <EditSelect
                value={get("supplierId")}
                onChange={v => set("supplierId", v || null)}
                options={agencySuppliers.map(s => ({ value: s.id, label: s.name }))}
                placeholder="Nenhum (visível a todas as agências)"
              />
            </Field>
          )}

          {canWrite && !isAgencia && get("channel") === "Evento" && (
            <ApplyEventChecklistButton campaign={campaign} currentUser={currentUser} />
          )}

          <Field label="Responsável interno">
            {isAgencia
              ? <AvatarStack users={resolvedOwners} size={20} max={3} />
              : (
                <AssigneeMultiSelect
                  value={ownerIds}
                  onChange={ids => set("ownerIds", ids)}
                  options={users.filter(u => ["marketing","gerente_marketing","admin"].includes(u.role))}
                  placeholder="Nenhum responsável"
                />
              )}
          </Field>

          <Field label="Responsável pela Execução">
            {isAgencia ? <ReadValue value={get("execResponsible")} /> : <EditInput value={get("execResponsible")} onChange={v => set("execResponsible", v)} placeholder="Nome do responsável pela execução" />}
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
        </div>
      );
    }
    if (sideTab === "fase") {
      const hasFixedStageFields = ["briefing", "aprovacao", "producao", "revisao"].includes(stage?.id);
      if (!hasFixedStageFields && visibleCustomDefs.length === 0) {
        return <div className="text-xs" style={{ color: "var(--text-dim)" }}>Nenhum campo adicional para esta etapa.</div>;
      }
      return (
        <div className="space-y-3">
          {/* Campos específicos da etapa atual */}
          {stage?.id === "briefing" && (
            <BriefingFields
              getCf={getCf}
              setCf={setCf}
              users={users}
              disabled={!canWrite || isAgencia}
              onOpenAttachments={() => setSideTab("arquivos")}
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

          {/* Campos adicionais configurados via "Editar campos desta
              etapa" (rh_pipeline_stage_fields) — além dos campos fixos
              acima, que continuam intactos. */}
          {visibleCustomDefs.length > 0 && (
            <div className="border-t pt-4 space-y-4" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                Campos adicionais da etapa
              </div>
              {visibleCustomDefs.map(f => (
                <div key={f.id}>
                  <div className="text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
                    {f.effectiveRequired && <span style={{ color: "var(--accent)" }}>* </span>}
                    {f.label}
                  </div>
                  {f.helpText && (
                    <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>{f.helpText}</div>
                  )}
                  {(!canWrite || isAgencia) ? (
                    <ReadValue value={formatCustomFieldValue(getCf(f.fieldKey))} />
                  ) : (
                    <RHStageFieldInput
                      field={f}
                      value={getCf(f.fieldKey)}
                      onChange={val => setCf(f.fieldKey, val)}
                      users={users}
                      touched={attemptedMove}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (sideTab === "atividades") {
      return <ActivityLog activities={campaign.activities || []} />;
    }
    if (sideTab === "historico") {
      return (
        <RHStageHistoryPanel
          domain="marketing"
          recordId={campaign.id}
          stages={effectiveStages}
          currentUser={currentUser}
          users={users}
        />
      );
    }
    if (sideTab === "ia") {
      return (
        <CampaignAIPanel
          campaign={{ ...campaign, ...draft }}
          currentUser={currentUser}
          stage={stage}
          stageFields={aiStageFields}
          recentComments={aiRecentComments}
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
    if (sideTab === "entregas") {
      return <EntregasTab campaign={campaign} canWrite={canWrite} currentUser={currentUser} />;
    }
    return null;
  }

  const header = (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
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
      <div className="flex items-center gap-2">
        <EditableTitle
          value={get("name")}
          canWrite={canWrite}
          onSave={(v) => set("name", v)}
        />
        {canWrite && (
          <button
            onClick={() => onUpdate?.(campaign.id, { starred: !campaign.starred })}
            className="p-1 rounded-lg shrink-0"
            style={{ background: "none", border: "none", cursor: "pointer", color: campaign.starred ? "#F59E0B" : "var(--text-faint)" }}
            title={campaign.starred ? "Remover destaque" : "Destacar campanha"}
          >
            <Star size={16} fill={campaign.starred ? "#F59E0B" : "none"} />
          </button>
        )}
      </div>
    </div>
  );

  const left = (
    <>
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
    </>
  );

  const center = (
    <>
      <DetailDrawerTabs tabs={SIDE_TABS} activeId={sideTab} onChange={setSideTab} />
      {CenterTabContent()}
    </>
  );

  const right = (
    <>
      {canWrite && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" }}>
            Mover para
          </div>
          <StageNavigator
            targets={effectiveStages.filter(s => s.id !== stage?.id)}
            onMove={moveToStage}
            getKey={(s) => s.id}
          />
        </div>
      )}

      <CommentsPanel
        comments={comments}
        currentUser={currentUser}
        mentionableUsers={mentionableUsers}
        onAddComment={onAddComment}
        onUpdateComment={onUpdateComment}
      />

      {/* AI move link */}
      <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
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
      </div>
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && !isAgencia && onDelete ? () => onDelete(campaign.id) : undefined}
      deleteLabel="Excluir campanha"
    />
  );
}
