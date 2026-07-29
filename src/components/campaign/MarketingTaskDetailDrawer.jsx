import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileText, Activity, Paperclip, ListChecks, History, Sparkles } from "lucide-react";
import { DELIVERABLE_PRIORITIES } from "../../constants/marketing-pipelines";
import { formatDateBR, localDateInputToISOString } from "../../utils/date";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { resolveVisibleFields } from "../../utils/field-conditions";
import { CommentsPanel } from "../shared/CommentsPanel";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { StageNavigator } from "../shared/StageNavigator";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { AvatarStack } from "../shared/AvatarStack";
import { DetailDrawerTabs } from "../shared/DetailDrawerTabs";
import { RecordAIPanel } from "../shared/RecordAIPanel";
import { genericCardSummaryPrompt } from "../../constants/ai-prompts";
import { ActivityLog } from "./CampaignDetailDrawer";
import { RHAttachmentsPanel, RHChecklistsPanel, RHStageHistoryPanel } from "../rh-pipeline/RHDetailDrawerShell";

const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };

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

function FieldRow({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
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

// `deadline` é timestamptz gravado via localDateInputToISOString (meia-noite
// LOCAL) — extrair AAAA-MM-DD com getters locais (não .toISOString(), que
// usa UTC e "voltaria" um dia em fuso negativo/BRT) pra semear o <input
// type=date> corretamente.
function dateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MarketingTaskDetailDrawer({
  item, stages, campaigns = [], onClose, onStageMoved, onUpdate, onMoveToStage, onDelete,
  users = [], canWrite, currentUser, notifyMentions,
}) {
  const [formDraft,  setFormDraft]  = useState({});
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error' | null
  const [moveError,  setMoveError]  = useState(null);
  const [centerTab,  setCenterTab]  = useState("form");

  const stageFieldsHook = useRHStageFields("marketing_tasks");
  const customDefs = stageFieldsHook.getFields(item.stage);
  const [customDraft, setCustomDraft] = useState({});
  const customDebounceRef = useRef(null);
  const customDraftRef    = useRef({});

  const formDraftRef    = useRef({});
  const formDebounceRef = useRef(null);
  const itemRef         = useRef(item);
  useEffect(() => { itemRef.current = item; }, [item]);

  // Mesmo padrão do OnboardingDrawer/DeliverableDetailDrawer: rascunho
  // ACUMULADO num ref (o timer precisa mesclar todos os campos tocados, não
  // só o último) + flush no cleanup pra não perder edição feita a <600ms de
  // trocar de card/fechar o drawer.
  useEffect(() => {
    setFormDraft({});
    formDraftRef.current = {};
    setCustomDraft({});
    customDraftRef.current = {};
    setMoveError(null);
    setSaveStatus(null);
    setCenterTab("form");
    if (formDebounceRef.current) clearTimeout(formDebounceRef.current);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    return () => {
      if (formDebounceRef.current) {
        clearTimeout(formDebounceRef.current);
        formDebounceRef.current = null;
        if (Object.keys(formDraftRef.current).length > 0) {
          onUpdate(item.id, { ...formDraftRef.current });
        }
      }
      if (customDebounceRef.current) {
        clearTimeout(customDebounceRef.current);
        customDebounceRef.current = null;
        if (Object.keys(customDraftRef.current).length > 0) {
          onUpdate(item.id, { customFields: { ...(item.customFields || {}), ...customDraftRef.current } });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const getValue = (key) => (key in formDraft ? formDraft[key] : (item[key] ?? ""));
  const assigneeIds = Array.isArray(formDraft.assigneeIds) ? formDraft.assigneeIds : (item.assigneeIds || []);

  const handleFieldChange = (key, value) => {
    const next = { ...formDraftRef.current, [key]: value };
    formDraftRef.current = next;
    setFormDraft(next);
    setSaveStatus(null);
    if (formDebounceRef.current) clearTimeout(formDebounceRef.current);
    formDebounceRef.current = setTimeout(async () => {
      const it = itemRef.current;
      const patch = { ...formDraftRef.current };
      setSaveStatus("saving");
      try {
        const activity = { type: "field_save", description: "Campos atualizados", at: new Date().toISOString() };
        await onUpdate(it.id, { ...patch, activities: [...(it.activities || []), activity] });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2500);
      } catch {
        // Falha real de gravação (RLS/rede) — sem isso "Salvando…" só some
        // sem virar "✓ Salvo", e o usuário acha que salvou.
        setSaveStatus("error");
      }
      formDraftRef.current = {};
      setFormDraft({});
      formDebounceRef.current = null;
    }, 600);
  };

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

  // Sem carve-out de agência (ao contrário de Entregas/Campanhas) — pedido
  // explícito do usuário pra este board ("pra não misturar com os da
  // Agência"); agência já não vê a linha via RLS, então nunca deveria
  // aparecer como mencionável aqui também.
  const mentionableUsers = useMemo(() => (
    getMentionableUsers(users, { domain: "marketing" })
  ), [users]);

  const resolvedAssignees = useMemo(
    () => assigneeIds.map(id => (users || []).find(u => u.id === id)).filter(Boolean),
    [assigneeIds, users]
  );

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
        body: `Em um comentário na tarefa "${item.title}"`,
        link: { module: "marketing_tasks", id: item.id },
      });
    }
  }, [item, onUpdate, currentUser, notifyMentions]);

  const stageInfo     = (stages || []).find(s => s.id === item.stage);
  const priorityValue = getValue("priority") || item.priority;
  const priorityColor = PRIORITY_COLORS[priorityValue] || null;
  const priorityLabel = PRIORITY_LABELS[priorityValue] || priorityValue;
  const campaign       = item.campaignId ? (campaigns || []).find(c => c.id === item.campaignId) : null;
  const isOverdue      = item.deadline && new Date(item.deadline) < new Date();

  const handleMoveStage = async (stageId) => {
    // Mesma validação de campo obrigatório (dinâmico) do drag-and-drop/
    // "Mover para" do board — chamador (onMoveToStage) já cuida disso.
    if (onMoveToStage) {
      const ok = await onMoveToStage(item.id, stageId);
      if (ok === false) return;
      setMoveError(null);
      onClose();
      onStageMoved?.(item.id);
      return;
    }
    const stageName = (stages || []).find(s => s.id === stageId)?.name || stageId;
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
      setMoveError(`Não foi possível mover "${item.title}": ${err?.message || "erro desconhecido"}.`);
    }
  };

  const header = (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {stageInfo && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: stageInfo.color + "22", color: stageInfo.color, border: `1px solid ${stageInfo.color}44` }}>
            {stageInfo.name}
          </span>
        )}
        {priorityColor && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: priorityColor + "18", color: priorityColor, border: `1px solid ${priorityColor}40` }}>
            {priorityLabel}
          </span>
        )}
      </div>
      <h2 className="font-bold" style={{ fontSize: 18, color: "var(--text)", letterSpacing: "-0.01em", wordBreak: "break-word" }}>
        {getValue("title") || item.title}
      </h2>
    </div>
  );

  const left = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Prazo</div>
          <div className="text-xs font-bold mt-0.5" style={{ color: isOverdue ? "var(--danger)" : "var(--text)" }}>
            {item.deadline ? formatDateBR(item.deadline) : "—"}
          </div>
        </div>
        <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Etapa</div>
          <div className="text-xs font-bold mt-0.5 truncate" style={{ color: stageInfo?.color || "var(--text)" }}>
            {stageInfo?.name || "—"}
          </div>
        </div>
      </div>

      {resolvedAssignees.length > 0 && (
        <div>
          <SectionLabel>Responsáveis</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {resolvedAssignees.map(u => (
              <div key={u.id} className="flex items-center gap-2">
                <AvatarStack users={[u]} size={20} max={1} />
                <span className="text-xs" style={{ color: "var(--text)" }}>{u.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {campaign && (
        <div>
          <SectionLabel>Campanha vinculada</SectionLabel>
          <ReadValue value={campaign.name} />
        </div>
      )}
    </>
  );

  const formTabContent = (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <SectionLabel>Detalhes da tarefa</SectionLabel>
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

      {canWrite ? (
        <>
          <FieldRow label="Título">
            <input type="text" value={getValue("title")} onChange={e => handleFieldChange("title", e.target.value)}
              style={inputBase} onFocus={focusBorder} onBlur={blurBorder} />
          </FieldRow>
          <FieldRow label="Descrição">
            <textarea value={getValue("description")} rows={3} onChange={e => handleFieldChange("description", e.target.value)}
              style={{ ...inputBase, resize: "vertical" }} onFocus={focusBorder} onBlur={blurBorder} />
          </FieldRow>
          <FieldRow label="Prioridade">
            <div style={{ display: "flex", gap: 6 }}>
              {DELIVERABLE_PRIORITIES.map(p => (
                <button key={p.id} type="button" onClick={() => handleFieldChange("priority", p.id)}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${priorityValue === p.id ? p.color : "var(--border)"}`, background: priorityValue === p.id ? p.color + "18" : "var(--surface)", color: priorityValue === p.id ? p.color : "var(--text-dim)", cursor: "pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </FieldRow>
          <FieldRow label="Prazo">
            <input type="date" value={dateInputValue(getValue("deadline"))}
              onChange={e => handleFieldChange("deadline", localDateInputToISOString(e.target.value))}
              style={inputBase} onFocus={focusBorder} onBlur={blurBorder} />
          </FieldRow>
          <FieldRow label="Responsáveis">
            <AssigneeMultiSelect
              value={assigneeIds}
              onChange={val => handleFieldChange("assigneeIds", val)}
              options={mentionableUsers}
              placeholder="Selecionar responsáveis…"
            />
          </FieldRow>
          {campaigns.length > 0 && (
            <FieldRow label="Campanha vinculada">
              <select value={getValue("campaignId") || ""} onChange={e => handleFieldChange("campaignId", e.target.value || null)}
                style={{ ...inputBase, color: getValue("campaignId") ? "var(--text)" : "var(--text-dim)" }}>
                <option value="">Nenhuma</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FieldRow>
          )}
        </>
      ) : (
        <>
          <FieldRow label="Título"><ReadValue value={item.title} /></FieldRow>
          {item.description && (
            <FieldRow label="Descrição">
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{item.description}</div>
            </FieldRow>
          )}
        </>
      )}

      {/* Campos adicionais configurados via "Editar campos desta etapa"
          (rh_pipeline_stage_fields, domain="marketing_tasks"). */}
      {visibleCustomDefs.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <SectionLabel>Campos adicionais da etapa</SectionLabel>
          {visibleCustomDefs.map(f => (
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
          ))}
        </div>
      )}
    </div>
  );

  const center = (
    <>
      <DetailDrawerTabs
        tabs={[
          { id: "form",       label: "Form",       icon: FileText },
          { id: "atividades", label: "Atividades", icon: Activity },
          { id: "historico",  label: "Histórico",  icon: History },
          { id: "ia",         label: "IA",         icon: Sparkles },
          { id: "anexos",     label: "Anexos",     icon: Paperclip },
          { id: "checklist",  label: "Checklist",  icon: ListChecks },
        ]}
        activeId={centerTab}
        onChange={setCenterTab}
      />
      {centerTab === "form" && formTabContent}
      {centerTab === "atividades" && <ActivityLog activities={item.activities || []} />}
      {centerTab === "historico" && (
        <RHStageHistoryPanel domain="marketing_tasks" recordId={item.id} stages={stages} currentUser={currentUser} users={users} />
      )}
      {centerTab === "ia" && (
        <RecordAIPanel
          currentUser={currentUser}
          features={[{
            id: "summary",
            label: "Resumo & Próximo passo",
            buildMessages: () => genericCardSummaryPrompt({
              title: item.title,
              domainLabel: "Tarefas de Marketing",
              stageName: stageInfo?.name || item.stage,
              slaDays: stageInfo?.sla,
              daysInStage: item.stageChangedAt
                ? Math.floor((Date.now() - new Date(item.stageChangedAt)) / 86400000)
                : 0,
              customFields: visibleCustomDefs
                .map(f => ({ label: f.label, value: formatCustomFieldValue(getCustomValue(f.fieldKey)) }))
                .filter(f => f.value !== null),
              recentComments: (item.notes || [])
                .filter(n => !n.deletedAt && n.text)
                .map(n => n.text),
            }),
          }]}
          defaultFeatureId="summary"
        />
      )}
      {centerTab === "anexos" && (
        <RHAttachmentsPanel domain="marketing_tasks" recordId={item.id} currentUser={currentUser} />
      )}
      {centerTab === "checklist" && (
        <RHChecklistsPanel domain="marketing_tasks" recordId={item.id} currentUser={currentUser} />
      )}
    </>
  );

  const right = (
    <>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" }}>
          Mover para
        </div>
        {moveError && (
          <div className="flex items-start gap-2 p-2.5 mb-2 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            {moveError}
          </div>
        )}
        {canWrite && (
          <StageNavigator
            targets={(stages || []).filter(s => s.id !== item.stage)}
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
      deleteLabel="Excluir tarefa"
    />
  );
}
