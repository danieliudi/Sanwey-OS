import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Trash2,
  FileText, Activity, Paperclip, CheckSquare, History,
  Sparkles, Layers,
  Upload, File, FileImage, Download, Plus,
  Check, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";
import { NEUTRAL, marketingUnitLabel } from "../../constants/companies";
import { DELIVERABLE_STAGES } from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";
import { useDeliverableAttachments }  from "../../hooks/use-deliverable-attachments";
import { useDeliverableChecklists }   from "../../hooks/use-deliverable-checklists";
import { useRHStageFields }           from "../../hooks/use-rh-stage-fields";
import { RHStageFieldInput }          from "../rh-pipeline/RHStageFieldInput";
import { resolveVisibleFields }       from "../../utils/field-conditions";
import { RecordAIPanel }              from "../shared/RecordAIPanel";
import { deliverableStageSuggestionPrompt, genericCardSummaryPrompt } from "../../constants/ai-prompts";
import { CommentsPanel }              from "../shared/CommentsPanel";
import { getMentionableUsers }        from "../../utils/mentionable-users";
import { AssigneeMultiSelect }        from "../shared/AssigneeMultiSelect";
import { EditableProtocolNumber }     from "../shared/EditableProtocolNumber";
import { StageNavigator }             from "../shared/StageNavigator";
import { SplitPanelDrawer }           from "../shared/SplitPanelDrawer";
import { DetailDrawerTabs }           from "../shared/DetailDrawerTabs";
import { EditableTitle }              from "../shared/EditableTitle";
import { RHStageHistoryPanel }        from "../rh-pipeline/RHDetailDrawerShell";

/* ── Priority helpers ───────────────────────────────────────── */
const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };
const PURPLE = "#7C3AED";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.zip";

/* ── Pill SideTabs ──────────────────────────────────────────── */
const SIDE_TABS = [
  { id: "fase",        label: "Fase atual",  icon: Layers },
  { id: "form",        label: "Form",        icon: FileText },
  { id: "atividades",  label: "Atividades",  icon: Activity },
  { id: "historico",   label: "Histórico",   icon: History },
  { id: "ia",          label: "IA",          icon: Sparkles },
  { id: "anexos",      label: "Anexos",      icon: Paperclip },
  { id: "checklists",  label: "Checklists",  icon: CheckSquare },
];

/* ── Deliverable AI panel ───────────────────────────────────── */
function DeliverableAIPanel({ item, currentUser, stage, stageFields = [], recentComments = [] }) {
  const daysInStage = item.stageChangedAt
    ? Math.floor((Date.now() - new Date(item.stageChangedAt)) / 86400000)
    : 0;

  const features = [
    {
      id: "summary",
      label: "Resumo & Próximo passo",
      buildMessages: () => genericCardSummaryPrompt({
        title: item.title,
        domainLabel: "Entregas",
        stageName: stage?.name || item.stage,
        slaDays: stage?.sla,
        daysInStage,
        customFields: stageFields,
        recentComments,
      }),
    },
    {
      id: "stage-suggestion",
      label: "Sugestão de etapa",
      buildMessages: () => deliverableStageSuggestionPrompt(item),
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

/* ── Shared input style ─────────────────────────────────────── */
const inputBase = {
  width: "100%", fontSize: 13, borderRadius: 6,
  border: "1px solid var(--border-strong)", padding: "7px 10px",
  background: "var(--surface)", color: "var(--text)", outline: "none",
};
const focusBorder = e => { e.target.style.borderColor = "var(--accent)"; };
const blurBorder  = e => { e.target.style.borderColor = "#D1D5DB"; };

/* ── Small primitives ───────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
      {children}
    </div>
  );
}

function FieldRow({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {required && <span style={{ color: "var(--danger)", marginRight: 2 }}>*</span>}
        {label}
      </div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5, lineHeight: 1.4 }}>{hint}</div>}
      {children}
    </div>
  );
}

function ReadValue({ value, empty = "—" }) {
  return (
    <div style={{ fontSize: 13, color: value ? "var(--text)" : "var(--text-dim)", lineHeight: 1.5 }}>
      {value || empty}
    </div>
  );
}

// Formata valor de campo customizado (rh_pipeline_stage_fields) pra exibição
// somente-leitura, quando o usuário não pode escrever.
function formatCustomFieldValue(v) {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

/* ── Atividades tab ─────────────────────────────────────────── */
function AtividadesTab({ activities }) {
  const sorted = [...(activities || [])].reverse();
  if (sorted.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", marginTop: 32 }}>Nenhuma atividade registrada.</div>;
  }
  const typeColor = { stage_change: "var(--accent)", field_save: "#16A34A", note_added: "#7C3AED", created: "#D97706" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {sorted.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColor[a.type] || "#9CA3AF", marginTop: 3 }} />
            {i < sorted.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 4 }} />}
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{a.description}</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
              {new Date(a.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Anexos tab ─────────────────────────────────────────────── */
function fileIconFn(mime) {
  if (!mime) return File;
  if (mime.startsWith("image/")) return FileImage;
  return FileText;
}
function humanSize(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function AnexosTab({ deliverableId, canWrite, userId }) {
  const { attachments, loading, uploading, error, upload, remove, getSignedUrl } =
    useDeliverableAttachments(deliverableId);
  const inputRef  = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileErr,  setFileErr]  = useState(null);

  const doUpload = useCallback(async (file) => {
    if (file.size > MAX_FILE_BYTES) { setFileErr("Arquivo muito grande (máx 50 MB)"); return; }
    setFileErr(null);
    await upload(file, { uploadedBy: userId });
  }, [upload, userId]);

  const handleFiles = (files) => { for (const f of Array.from(files)) doUpload(f); };

  const handleDownload = async (att) => {
    const url = await getSignedUrl(att.file_path);
    if (!url) return;
    // Sem target="_blank" o clique navegava a própria aba pro arquivo cru —
    // a URL assinada é de outra origem (*.supabase.co), e o navegador ignora
    // o atributo `download` de um <a> cross-origin, então virava navegação
    // de verdade, sem nenhuma UI do app (nem botão de voltar/fechar) pra
    // sair de lá. Mesmo padrão já usado em LeadDetailDrawer.jsx.
    const a = document.createElement("a");
    a.href = url;
    a.download = att.file_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {canWrite && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => inputRef.current?.click()}
          style={{
            borderRadius: 10, border: `2px dashed ${dragOver ? "var(--accent)" : "#D1D5DB"}`,
            background: dragOver ? "var(--surface-alt)" : "var(--surface)",
            padding: "20px 12px", textAlign: "center", cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <Upload size={18} style={{ color: dragOver ? "var(--accent)" : "var(--text-dim)", margin: "0 auto 6px" }} />
          <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
            {uploading ? "Enviando…" : "Arraste ou clique para enviar"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3 }}>PDF, Word, imagens, vídeos — máx 50 MB</div>
          <input ref={inputRef} type="file" accept={ACCEPTED} multiple style={{ display: "none" }}
            onChange={e => { handleFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        </div>
      )}

      {(fileErr || error) && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 6, padding: "7px 10px", fontSize: 11 }}>
          {fileErr || error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 16 }}>
          <Loader2 size={16} style={{ color: "var(--text-dim)" }} className="animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: "16px 0" }}>Nenhum anexo ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {attachments.map(att => {
            const Icon = fileIconFn(att.mime_type);
            return (
              <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-alt)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <Icon size={16} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.file_name}</div>
                  {att.file_size && <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{humanSize(att.file_size)}</div>}
                </div>
                <button onClick={() => handleDownload(att)} title="Baixar"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 4, display: "flex" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#E5E7EB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                  <Download size={14} />
                </button>
                {canWrite && (
                  <button onClick={() => remove(att)} title="Remover"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4, borderRadius: 4, display: "flex" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Checklists tab ─────────────────────────────────────────── */
function ChecklistsTab({ deliverableId, canWrite, userId }) {
  const { checklists, loading, createChecklist, deleteChecklist, addItem, toggleItem, removeItem } =
    useDeliverableChecklists(deliverableId);
  const [newTexts, setNewTexts] = useState({});
  const [creating, setCreating] = useState(false);

  const handleAddItem = async (cid) => {
    const text = (newTexts[cid] || "").trim();
    if (!text) return;
    await addItem(cid, text);
    setNewTexts(prev => ({ ...prev, [cid]: "" }));
  };

  if (loading) return <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: 20 }}>Carregando…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {checklists.map(cl => {
        const done  = (cl.items || []).filter(it => it.done).length;
        const total = (cl.items || []).length;
        const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={cl.id} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "var(--surface-alt)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text)" }}>{cl.title}</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{done}/{total} concluídos</div>
              </div>
              {total > 0 && (
                <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--success)" : "var(--accent)", transition: "width 0.3s" }} />
                </div>
              )}
              {canWrite && (
                <button onClick={() => deleteChecklist(cl.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 3, borderRadius: 4, display: "flex" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {(cl.items || []).map(it => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => canWrite && toggleItem(cl.id, it.id)}
                    style={{
                      width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${it.done ? "var(--success)" : "#D1D5DB"}`,
                      background: it.done ? "var(--success)" : "#FFF",
                      cursor: canWrite ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      transition: "all 0.15s",
                    }}>
                    {it.done && <Check size={10} color="#FFF" strokeWidth={3} />}
                  </button>
                  <span style={{ fontSize: 12, flex: 1, color: it.done ? "var(--text-dim)" : "var(--text)", textDecoration: it.done ? "line-through" : "none" }}>
                    {it.text}
                  </span>
                  {canWrite && (
                    <button onClick={() => removeItem(cl.id, it.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 2, display: "flex" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; }}>
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && (
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <input
                    value={newTexts[cl.id] || ""}
                    onChange={e => setNewTexts(prev => ({ ...prev, [cl.id]: e.target.value }))}
                    placeholder="Novo item…"
                    style={{ ...inputBase, fontSize: 12, padding: "5px 8px", flex: 1 }}
                    onFocus={focusBorder} onBlur={blurBorder}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(cl.id); } }}
                  />
                  <button onClick={() => handleAddItem(cl.id)}
                    style={{ background: "var(--accent)", border: "none", borderRadius: 6, color: "var(--on-accent)", padding: "0 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <Plus size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {canWrite && (
        <button
          onClick={async () => { setCreating(true); await createChecklist({ createdBy: userId }); setCreating(false); }}
          disabled={creating}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)", background: "transparent", border: "1px dashed #BFDBFE", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 500, justifyContent: "center" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
          <Plus size={13} />
          {creating ? "Criando…" : "Nova checklist"}
        </button>
      )}
      {checklists.length === 0 && !canWrite && (
        <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: "16px 0" }}>Nenhuma checklist ainda.</div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export function DeliverableDetailDrawer({ item, onClose, onStageMoved, onUpdate, onMoveToStage, onDelete, onResendCompleteEmail, campaigns = [], users = [], stages = [], canWrite, userId, currentUser, notifyMentions }) {
  // Etapas reais (rh_pipeline_stages, domain="marketing_deliverables"), com
  // fallback pro catálogo fixo só enquanto o fetch não resolveu — sem isso,
  // etapa custom criada pelo usuário (ex.: "Encaminhado à Agência") nunca
  // aparecia em "Mover entrega para fase" nem no Histórico, porque os dois
  // liam direto DELIVERABLE_STAGES (hardcoded, nunca atualizado).
  const effectiveStages = stages?.length ? stages : DELIVERABLE_STAGES;
  const [sideTab,      setSideTab]     = useState("fase");
  const [saveStatus,   setSaveStatus]  = useState(null); // 'saving' | 'saved' | 'error' | null
  const [moveError,    setMoveError]   = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Campos customizados configurados via "Editar campos desta etapa"
  // (rh_pipeline_stage_fields, domain="marketing_deliverables") —
  // persistidos em item.custom_fields. Única fonte do formulário por etapa
  // no centro do card: até 20260774/775, Entregas também tinha um formulário
  // fixo em código (STAGE_FIELDS) que "Editar campos desta etapa" não
  // alcançava — unificado nessas migrations. Mesmo padrão de draft +
  // debounce do OnboardingDrawer (RHOnboardingView.jsx).
  const stageFieldsHook = useRHStageFields("marketing_deliverables");
  const customDefs = stageFieldsHook.getFields(item.stage);
  const [customDraft, setCustomDraft] = useState({});
  const customDebounceRef = useRef(null);
  // Ref espelha o rascunho ACUMULADO — o timer precisa mesclar todos os campos
  // tocados, não só o último (senão editar A e B em <600ms grava só B). Flush
  // no cleanup pra não perder a edição ao fechar em <600ms. Achado da auditoria.
  const customDraftRef = useRef({});

  // "Responsáveis" — campo geral do registro (assignee_ids), não mais preso
  // à etapa "Solicitação" (era STAGE_FIELDS.solicitacao.assignee, só
  // editável enquanto o card estivesse lá). Mesmo padrão de draft + debounce
  // acima, um único campo.
  const [assigneeDraft, setAssigneeDraft] = useState(null); // null = sem edição pendente
  const assigneeDebounceRef = useRef(null);
  const itemRef = useRef(item);
  useEffect(() => { itemRef.current = item; }, [item]);

  useEffect(() => {
    setCustomDraft({});
    customDraftRef.current = {};
    setAssigneeDraft(null);
    setMoveError(null);
    setSaveStatus(null);
    setSideTab("fase");
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    if (assigneeDebounceRef.current) clearTimeout(assigneeDebounceRef.current);
    return () => {
      if (customDebounceRef.current) { clearTimeout(customDebounceRef.current); customDebounceRef.current = null; }
      if (Object.keys(customDraftRef.current).length > 0) {
        onUpdate(item.id, { customFields: { ...(item.customFields || {}), ...customDraftRef.current } });
      }
      if (assigneeDebounceRef.current) { clearTimeout(assigneeDebounceRef.current); assigneeDebounceRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const getCustomValue = (fieldKey) =>
    fieldKey in customDraft ? customDraft[fieldKey] : (item.customFields?.[fieldKey] ?? "");

  const handleCustomChange = (fieldKey, value) => {
    const next = { ...customDraftRef.current, [fieldKey]: value };
    customDraftRef.current = next;
    setCustomDraft(next);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    customDebounceRef.current = setTimeout(() => {
      const merged = { ...(item.customFields || {}), ...customDraftRef.current };
      onUpdate(item.id, { customFields: merged });
      customDebounceRef.current = null;
    }, 600);
  };

  const customValuesByKey = { ...(item.customFields || {}), ...customDraft };
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);

  const aiStageFields = visibleCustomDefs
    .map(f => ({ label: f.label, value: formatCustomFieldValue(getCustomValue(f.fieldKey)) }))
    .filter(f => f.value !== null);
  const aiRecentComments = (item.notes || [])
    .filter(n => !n.deletedAt && n.text)
    .map(n => n.text);

  const assigneeIds = assigneeDraft !== null
    ? assigneeDraft
    : (item.assigneeIds?.length ? item.assigneeIds : (item.assignee ? [item.assignee] : []));
  const resolvedAssignees = useMemo(
    () => assigneeIds.map(id => (users || []).find(u => u.id === id)).filter(Boolean),
    [assigneeIds, users]
  );

  const handleAssigneeChange = (ids) => {
    setAssigneeDraft(ids);
    setSaveStatus(null);
    if (assigneeDebounceRef.current) clearTimeout(assigneeDebounceRef.current);
    assigneeDebounceRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await onUpdate(itemRef.current.id, { assignee: ids[0] || null, assigneeIds: ids });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2500);
      } catch {
        setSaveStatus("error");
      }
      assigneeDebounceRef.current = null;
    }, 600);
  };

  // Quem pode ser @mencionado nos comentários desta entrega — mesmo escopo
  // usado no CampaignDetailDrawer (domain "marketing", incluindo agência,
  // que já tem acesso de leitura a entregas).
  const mentionableUsers = useMemo(() => (
    getMentionableUsers(users, { domain: "marketing", includeAgencia: true })
  ), [users]);

  // Normaliza item.notes ({text, createdAt}, sem autor nas entradas antigas)
  // pro formato que CommentsPanel espera — nunca inventamos um autor pras
  // entradas antigas que não tinham authorId.
  const comments = useMemo(() => {
    const notes = Array.isArray(item?.notes) ? item.notes : [];
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
  }, [item?.notes, users]);

  const onUpdateComment = useCallback(async (id, patch) => {
    if (!item) return;
    const updatedNotes = (item.notes || []).map(n => (n.id === id ? { ...n, ...patch } : n));
    await onUpdate(item.id, { notes: updatedNotes });
  }, [item, onUpdate]);

  const onAddComment = useCallback(async (text, mentionedIds) => {
    if (!item) return;
    const newNote = {
      id: crypto.randomUUID(),
      authorId: currentUser?.id || null,
      authorName: currentUser?.name || null,
      avatarBg: currentUser?.avatarBg,
      text,
      mentionedIds,
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [...(item.notes || []), newNote];
    await onUpdate(item.id, { notes: updatedNotes });
    if (mentionedIds?.length > 0 && notifyMentions) {
      notifyMentions(mentionedIds, {
        title: `${currentUser?.name || "Alguém"} te mencionou`,
        body: `Em um comentário na entrega "${item.title}"`,
        link: { module: "deliverables", id: item.id },
      });
    }
  }, [item, onUpdate, currentUser, notifyMentions]);

  const stageInfo  = effectiveStages.find(s => s.id === item.stage);

  const priorityColor = PRIORITY_COLORS[item.priority] || NEUTRAL.slate;
  const priorityLabel = PRIORITY_LABELS[item.priority] || item.priority;
  const companyLabels = (item.companyIds || []).map(marketingUnitLabel).join(", ");

  const handleMoveStage = async (stageId) => {
    // Passa pela mesma validação de campo obrigatório (estático + dinâmico)
    // do drag-and-drop/"Mover para" do board — antes esse botão chamava
    // onUpdate direto e contornava a checagem por completo.
    if (onMoveToStage) {
      const ok = await onMoveToStage(item.id, stageId);
      if (ok === false) return;
      setMoveError(null);
      onClose();
      onStageMoved?.(item.id);
      return;
    }
    const stageName = effectiveStages.find(s => s.id === stageId)?.name || stageId;
    try {
      await onUpdate(item.id, {
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        activities: [
          ...(item.activities || []),
          { type: "stage_change", description: `Movido para ${stageName}`, at: new Date().toISOString() },
        ],
      });
      setMoveError(null);
      onClose();
      onStageMoved?.(item.id);
    } catch (err) {
      // Antes usava alert() nativo — bloqueante, e trava sessões
      // automatizadas/headless sem handler de diálogo. Banner inline não
      // bloqueia nada.
      setMoveError(`Não foi possível mover "${item.title}": ${err?.message || "erro desconhecido"}.`);
    }
  };

  const handleResendEmail = async () => {
    if (!onResendCompleteEmail) return;
    setSendingEmail(true);
    try {
      await onResendCompleteEmail(item.id);
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Center tab content ────────────────────────────────────────────────────
  function CenterTabContent() {
    if (sideTab === "fase") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FieldRow label="Responsáveis">
            {canWrite ? (
              <AssigneeMultiSelect
                value={assigneeIds}
                onChange={handleAssigneeChange}
                options={users}
                placeholder="Selecionar responsáveis…"
              />
            ) : (
              <ReadValue value={resolvedAssignees.map(u => u.name).join(", ") || null} />
            )}
          </FieldRow>

          {campaigns.length > 0 && (
            <FieldRow
              label="Campanha relacionada"
              hint="Só era possível vincular ao criar a entrega — agora dá pra vincular/trocar depois."
            >
              {canWrite ? (
                <select
                  value={item.campaignId || ""}
                  onChange={e => onUpdate(item.id, { campaignId: e.target.value || null })}
                  style={{ ...inputBase }}
                  onFocus={focusBorder}
                  onBlur={blurBorder}
                >
                  <option value="">Nenhuma</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <ReadValue value={campaigns.find(c => c.id === item.campaignId)?.name || null} />
              )}
            </FieldRow>
          )}

          {/* Campos configurados via "Editar campos desta etapa"
              (rh_pipeline_stage_fields) — única fonte do formulário por etapa. */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SectionLabel>Campos desta etapa</SectionLabel>
              {saveStatus && (
                <span
                  style={{
                    fontSize: 10, marginLeft: "auto",
                    color: saveStatus === "saved" ? "var(--success)" : saveStatus === "error" ? "var(--danger)" : "var(--text-dim)",
                    fontWeight: saveStatus === "error" ? 700 : 400,
                  }}
                >
                  {saveStatus === "saving" ? "Salvando…" : saveStatus === "error" ? "✗ Falha ao salvar — tente de novo" : "✓ Salvo"}
                </span>
              )}
            </div>
            {visibleCustomDefs.length === 0
              ? <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>Nenhum campo para esta fase.</div>
              : visibleCustomDefs.map(f => (
                <FieldRow key={f.id} label={f.label} required={f.effectiveRequired} hint={f.helpText}>
                  {canWrite ? (
                    <RHStageFieldInput
                      field={f}
                      value={getCustomValue(f.fieldKey)}
                      onChange={val => handleCustomChange(f.fieldKey, val)}
                      users={users}
                      touched={Boolean(moveError)}
                    />
                  ) : (
                    <ReadValue value={formatCustomFieldValue(getCustomValue(f.fieldKey))} />
                  )}
                </FieldRow>
              ))
            }
          </div>
        </div>
      );
    }
    if (sideTab === "form") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionLabel>Formulário Inicial</SectionLabel>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Nº da Solicitação</div>
            <EditableProtocolNumber
              value={item.requestNumber}
              canWrite={canWrite}
              onSave={(next) => onUpdate(item.id, { requestNumber: next })}
            />
          </div>
          {[
            { label: "Título",       val: item.title },
            { label: "Solicitante",  val: item.requesterName },
            { label: "Departamento", val: item.department },
          ].map(({ label, val }) => val ? (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
              <ReadValue value={val} />
            </div>
          ) : null)}
          {item.description && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Descrição</div>
              <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{item.description}</div>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Prazo</div>
            {item.deadline
              ? <span style={{ fontSize: 13, fontWeight: 600, color: new Date(item.deadline) < new Date() ? "var(--danger)" : "var(--text)" }}>{formatDateBR(item.deadline)}</span>
              : <ReadValue value={null} />}
          </div>
        </div>
      );
    }
    if (sideTab === "atividades")  return <AtividadesTab activities={item.activities} />;
    if (sideTab === "historico")   return (
      <RHStageHistoryPanel domain="marketing_deliverables" recordId={item.id} stages={effectiveStages} currentUser={currentUser} users={users} />
    );
    if (sideTab === "ia")          return (
      <DeliverableAIPanel
        item={item}
        currentUser={currentUser}
        stage={stageInfo}
        stageFields={aiStageFields}
        recentComments={aiRecentComments}
      />
    );
    if (sideTab === "anexos")      return <AnexosTab deliverableId={item.id} canWrite={canWrite} userId={userId || currentUser?.id} />;
    if (sideTab === "checklists")  return <ChecklistsTab deliverableId={item.id} canWrite={canWrite} userId={userId || currentUser?.id} />;
    return null;
  }

  const header = (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {stageInfo && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: stageInfo.color + "22", color: stageInfo.color, border: `1px solid ${stageInfo.color}44` }}>
            {stageInfo.name}
          </span>
        )}
        {item.priority && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: priorityColor + "18", color: priorityColor, border: `1px solid ${priorityColor}40` }}>
            {priorityLabel}
          </span>
        )}
        {companyLabels && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}>
            {companyLabels}
          </span>
        )}
      </div>
      <EditableTitle
        value={item.title}
        canWrite={canWrite}
        onSave={(v) => onUpdate(item.id, { title: v })}
      />
    </div>
  );

  const left = (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Prazo</div>
          <div className="text-xs font-bold mt-0.5" style={{ color: item.deadline && new Date(item.deadline) < new Date() ? "var(--danger)" : "var(--text)" }}>
            {item.deadline ? formatDateBR(item.deadline) : "—"}
          </div>
        </div>
        <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Etapa</div>
          <div className="text-xs font-bold mt-0.5 truncate" style={{ color: stageInfo?.color || "var(--text)" }}>
            {stageInfo?.name || "—"}
          </div>
        </div>
        {item.department && (
          <div className="col-span-2 rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Departamento</div>
            <div className="text-xs font-bold mt-0.5 truncate" style={{ color: "var(--text)" }}>{item.department}</div>
          </div>
        )}
      </div>
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
      <div>
        <div className="text-xs font-semibold mb-3" style={{ color: "var(--text)", letterSpacing: "0.02em" }}>
          Mover entrega para fase
        </div>
        {moveError && (
          <div className="flex items-start gap-2 p-2.5 mb-2 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            {moveError}
          </div>
        )}
        {item.emailError && (
          <div className="flex items-start gap-2 p-2.5 mb-2 rounded-lg text-xs" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            Falha ao avisar o solicitante por e-mail: {item.emailError}
          </div>
        )}
        {canWrite && item.emailError && onResendCompleteEmail && (
          <button
            onClick={handleResendEmail}
            disabled={sendingEmail}
            className="flex items-center gap-1.5 px-3 py-1.5 mb-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
          >
            <RefreshCw size={13} /> {sendingEmail ? "Enviando…" : "Tentar enviar e-mail de novo"}
          </button>
        )}
        {canWrite && (
          <StageNavigator
            targets={effectiveStages.filter(s => s.id !== item.stage)}
            onMove={handleMoveStage}
            getKey={(s) => s.id}
          />
        )}
      </div>

      <CommentsPanel
        comments={comments}
        currentUser={currentUser}
        mentionableUsers={mentionableUsers}
        onUpdateComment={onUpdateComment}
        onAddComment={onAddComment}
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
      onDelete={canWrite && onDelete ? () => onDelete(item.id) : undefined}
      deleteLabel="Excluir entrega"
    />
  );
}
