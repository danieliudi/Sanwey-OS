import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus, X, ListTodo, ChevronDown, Star, Filter, Pencil, Settings2, AlertCircle,
} from "lucide-react";
import { DeliverableKanbanCard } from "../campaign/DeliverableKanbanCard";
import { MarketingTaskDetailDrawer } from "../campaign/MarketingTaskDetailDrawer";
import { useMarketingTasks } from "../../hooks/use-marketing-tasks";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { RHStageEditorModal } from "../rh-pipeline/RHStageEditorModal";
import { RHStageFieldEditorModal } from "../rh-pipeline/RHStageFieldEditorModal";
import { DELIVERABLE_PRIORITIES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { localDateInputToISOString } from "../../utils/date";
import { useUsersById } from "../../hooks/use-users-by-id";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AppToast } from "../shared/AppToast";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadNotesComment } from "../../lib/comment-badge";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";

function isOverdueTask(t) {
  return Boolean(t.deadline) && new Date(t.deadline) < new Date();
}

function isDueSoon(t) {
  if (!t.deadline) return false;
  const diffMs = new Date(t.deadline).getTime() - Date.now();
  return diffMs >= 0 && diffMs <= 7 * 86400000;
}

/* ── Create modal ────────────────────────────────────────────── */
function TaskCreateModal({ stageId, stages, currentUser, users, campaigns, onAdd, onClose }) {
  const stage = (stages || []).find(s => s.id === stageId);
  const stageFields = useRHStageFields("marketing_tasks");

  const assignableUsers = useMemo(
    () => getMentionableUsers(users, { domain: "marketing" }),
    [users]
  );

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [priority,    setPriority]    = useState("media");
  const [deadline,    setDeadline]    = useState("");
  const [companyIds,  setCompanyIds]  = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [campaignId,  setCampaignId]  = useState("");
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [customValues, setCustomValues] = useState({});

  const visibleFields = resolveVisibleFields(stageFields.getFields(stageId), customValues);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const toggleCompany = (id) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
    const missing = getMissingRequiredFields(visibleFields, customValues);
    if (missing.length > 0) {
      setError(`Preencha antes: ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(visibleFields, customValues);
    if (invalid.length > 0) {
      setError(`Corrija antes: ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setSaving(true); setError(null);
    try {
      await onAdd({
        title:          title.trim(),
        description:    description.trim() || null,
        priority,
        deadline:       localDateInputToISOString(deadline),
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        companyIds,
        campaignId:     campaignId || null,
        assigneeIds,
        notes:          [],
        activities:     [{ type: "created", description: "Tarefa criada", at: new Date().toISOString() }],
        createdBy:      currentUser?.id || null,
        customFields:   customValues,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar tarefa.");
    } finally {
      setSaving(false);
    }
  };

  const focusBlue = e => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = e => { e.target.style.borderColor = "#D1D5DB"; };
  const labelSt   = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  const inputSt   = { borderColor: "#D1D5DB", color: "var(--text)", background: "var(--surface)" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova Tarefa</div>
            {stage && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{stage.name}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Título</label>
            <input autoFocus type="text" placeholder="Ex: Preparar posts da semana"
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Descrição</label>
            <textarea placeholder="Detalhes da tarefa"
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ ...inputSt, resize: "vertical" }} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Prazo</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div>
              <label style={labelSt}>* Prioridade</label>
              <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                {DELIVERABLE_PRIORITIES.map(p => (
                  <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                    style={{ flex: 1, padding: "5px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${priority === p.id ? p.color : "var(--border)"}`, background: priority === p.id ? p.color + "18" : "var(--surface)", color: priority === p.id ? p.color : "var(--text-dim)", cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Responsáveis</label>
            <AssigneeMultiSelect
              value={assigneeIds}
              onChange={setAssigneeIds}
              options={assignableUsers}
              placeholder="Selecionar responsáveis…"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Empresa</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COMPANY_IDS.map(id => {
                const co = COMPANIES[id]; const sel = companyIds.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleCompany(id)}
                    style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${sel ? co.primary : "var(--border)"}`, background: sel ? co.primary + "22" : "var(--surface)", color: sel ? co.primary : "var(--text-dim)", cursor: "pointer" }}>
                    {co.short}
                  </button>
                );
              })}
            </div>
          </div>

          {campaigns.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>Campanha relacionada</label>
              <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={{ ...inputSt, color: campaignId ? "var(--text)" : "var(--text-dim)" }}>
                <option value="">Nenhuma (opcional)</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {visibleFields.length > 0 && (
            <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                Campos desta etapa {stage?.name ? `· ${stage.name}` : ""}
              </div>
              <div className="flex flex-col gap-3">
                {visibleFields.map(f => (
                  <div key={f.id}>
                    <label style={labelSt}>
                      {f.effectiveRequired && <span style={{ color: "var(--danger)" }}>* </span>}
                      {f.label}
                    </label>
                    <RHStageFieldInput
                      field={f}
                      value={customValues[f.fieldKey]}
                      onChange={val => setCustomValues(prev => ({ ...prev, [f.fieldKey]: val }))}
                      users={users}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}

          <button type="submit" disabled={saving || !title.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "#FFF", opacity: (saving || !title.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !title.trim()) ? "default" : "pointer" }}>
            {saving ? "Criando…" : "Criar novo card"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── View toggle-less header button ──────────────────────────── */
function ToolbarButton({ onClick, icon: Icon, label, title }) {
  return (
    <button
      onClick={onClick}
      title={title || label}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "var(--text-dim)", cursor: "pointer" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

/* ── Main view ───────────────────────────────────────────────── */
export function MarketingTarefasView({ user, users = [], notifyMentions }) {
  const location = useLocation();
  const {
    tasks, loading, canWrite,
    createTask, updateTask, deleteTask,
    changeStage, toggleStar,
  } = useMarketingTasks({ userId: user?.id, role: user?.role, roles: user?.roles });

  const { campaigns } = useMarketingCampaigns({ userId: user?.id, role: user?.role, roles: user?.roles });
  const campaignsById = useMemo(() => new Map(campaigns.map(c => [c.id, c])), [campaigns]);
  const stageFields = useRHStageFields("marketing_tasks");

  // trailingRef mede o texto de dica que vem depois do board, pra sobrar
  // espaço suficiente pra ele também caber (ver use-available-height.js).
  const trailingRef = useRef(null);
  const [boardRef, boardHeight] = useAvailableHeight(16, [], trailingRef);

  // Etapas vêm de rh_pipeline_stages (domain="marketing_tasks"), editáveis
  // via RHStageEditorModal — mesmo padrão de EntregasView/RHOnboardingView.
  const { stages: dbStages, loading: loadingStages } = useRHPipelineStages("marketing_tasks");
  const kanbanStages = useMemo(
    () => dbStages.map(s => ({ id: s.stageKey, name: s.name, color: s.color, sla: s.slaDays, terminal: s.terminal })),
    [dbStages]
  );
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);

  const usersById = useUsersById(users);

  const [draggedItem,   setDraggedItem]   = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [stageError,    setStageError]    = useState(null);
  const [quickAddStage, setQuickAddStage] = useState(null);
  const [selected,      setSelected]      = useState(null);
  const [expandedMobileStages, setExpandedMobileStages] = useState(() => {
    const s = new Set(["a_fazer"]);
    if (location.state?.filterStage) s.add(location.state.filterStage);
    return s;
  });
  const toggleMobileStage = (id) => setExpandedMobileStages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* Filters */
  const [ownerFilter,    setOwnerFilter]    = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [companyFilter,  setCompanyFilter]  = useState([]);
  const [starredOnly,    setStarredOnly]    = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("");

  // roles[] cobre cargo adicional — user.role sozinho fica só de fallback.
  const userRoleList = user?.roles?.length ? user.roles : (user?.role ? [user.role] : []);
  const isManager = userRoleList.includes("admin") || userRoleList.includes("gerente_marketing");

  const toggleCompanyFilter = (id) =>
    setCompanyFilter(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const activeFilterCount = (ownerFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + companyFilter.length + (starredOnly ? 1 : 0) + (campaignFilter ? 1 : 0) + (deadlineFilter ? 1 : 0);

  /* Filtered tasks */
  const filtered = useMemo(() => {
    let list = tasks;
    if (ownerFilter)              list = list.filter(t => (t.assigneeIds || []).includes(ownerFilter));
    if (priorityFilter)           list = list.filter(t => t.priority === priorityFilter);
    if (companyFilter.length > 0) list = list.filter(t => companyFilter.some(c => t.companyIds?.includes(c)));
    if (starredOnly)              list = list.filter(t => t.starred);
    if (campaignFilter)           list = list.filter(t => t.campaignId === campaignFilter);
    if (deadlineFilter === "overdue")     list = list.filter(isOverdueTask);
    if (deadlineFilter === "due_soon")    list = list.filter(isDueSoon);
    if (deadlineFilter === "no_deadline") list = list.filter(t => !t.deadline);
    return list;
  }, [tasks, ownerFilter, priorityFilter, companyFilter, starredOnly, campaignFilter, deadlineFilter]);

  const handleDragStart = useCallback((item) => setDraggedItem(item), []);
  const handleDragOver  = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleDragEnd   = useCallback(() => { setDraggedItem(null); setDragOverStage(null); }, []);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (via rh_pipeline_stage_fields) vazio — vale tanto pro drag-and-drop
  // quanto pro "Mover para" do menu do card. Mesmo padrão de
  // EntregasView.attemptStageChange, sem a checagem de campos estáticos
  // (STAGE_FIELDS) porque Tarefas não tem formulário fixo por etapa.
  const attemptStageChange = useCallback(async (itemId, toStage) => {
    const item = tasks.find(t => t.id === itemId);
    if (!item) return false;
    const fields = stageFields.getFields(item.stage);
    const missing = getMissingRequiredFields(fields, item.customFields || {});
    if (missing.length > 0) {
      setStageError(`Não dá pra mover "${item.title}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return false;
    }
    setStageError(null);
    await changeStage(itemId, toStage);
    return true;
  }, [tasks, stageFields, changeStage]);

  const getItemCompleteness = useCallback((item) => {
    const fields = stageFields.getFields(item.stage);
    return getFieldCompleteness(fields, item.customFields || {});
  }, [stageFields]);

  const { viewedAt: itemViewedAt, markViewed: markItemViewed } = useRecordViews("marketing_tasks", user?.id);
  const getItemUnread = useCallback((item) => hasUnreadNotesComment(item, itemViewedAt, user?.id), [itemViewedAt, user?.id]);
  useEffect(() => { if (selected?.id) markItemViewed(selected.id); }, [selected?.id]);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedItem || !canWrite) return;
    if (draggedItem.stage !== toStage) await attemptStageChange(draggedItem.id, toStage);
    setDraggedItem(null); setDragOverStage(null);
  }, [draggedItem, canWrite, attemptStageChange]);

  const handleQuickAdd = useCallback(async (item) => { await createTask(item); }, [createTask]);

  const handleUpdate = useCallback(async (id, patch) => {
    await updateTask(id, patch);
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  }, [updateTask]);

  const handleDelete = useCallback(async (id) => { await deleteTask(id); }, [deleteTask]);

  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return tasks.find(t => t.id === selected.id) || selected;
  }, [tasks, selected]);

  // Ver src/utils/reopen-after-move.js — o drawer já se fecha sozinho ao
  // mover de etapa; isso só agenda a reabertura já na etapa nova.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const reopenTaskAfterMove = useCallback((id) => {
    reopenAfterMove(setSelected, () => tasksRef.current.find(t => t.id === id) || null);
  }, []);

  return (
    <>
    {stageError && (
      <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setStageError(null)}>
        {stageError}
      </AppToast>
    )}
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Tarefas
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Kanban de tarefas do dia a dia de Marketing</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canWrite && (
            <ToolbarButton onClick={() => setStageEditorOpen(true)} icon={Pencil} label="Editar etapas" title="Editar etapas do Kanban" />
          )}
          {canWrite && (
            <button
              onClick={() => setQuickAddStage(kanbanStages[0]?.id)}
              className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "#FFFFFF", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
              aria-label="Criar nova tarefa"
            >
              <Plus size={14} />
              Nova tarefa
            </button>
          )}
        </div>
      </div>

      {canWrite && (
        <KanbanFab label="Nova tarefa" onClick={() => setQuickAddStage(kanbanStages[0]?.id)} />
      )}

      {/* Filter toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: `1px solid ${showFilters || activeFilterCount > 0 ? "var(--accent)" : "var(--border)"}`, background: showFilters || activeFilterCount > 0 ? "var(--surface-alt)" : "var(--surface)", color: showFilters || activeFilterCount > 0 ? "var(--accent)" : "var(--text-dim)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
          <Filter size={12} />
          Filtros
          {activeFilterCount > 0 && (
            <span style={{ background: "var(--accent)", color: "#FFF", borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "1px 5px", marginLeft: 2 }}>{activeFilterCount}</span>
          )}
        </button>

        {showFilters && (
          <>
            {/* Owner filter (managers only) */}
            {isManager && (
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, color: ownerFilter ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", outline: "none", cursor: "pointer" }}>
                <option value="">Todos responsáveis</option>
                {Array.from(usersById.values()).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}

            {/* Priority filter */}
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, color: priorityFilter ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", outline: "none", cursor: "pointer" }}>
              <option value="">Todas prioridades</option>
              {DELIVERABLE_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            {/* Campaign filter */}
            <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, color: campaignFilter ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", outline: "none", cursor: "pointer" }}>
              <option value="">Todas as campanhas</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Deadline filter */}
            <select value={deadlineFilter} onChange={e => setDeadlineFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, color: deadlineFilter ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", outline: "none", cursor: "pointer" }}>
              <option value="">Todos os prazos</option>
              <option value="overdue">Vencidas</option>
              <option value="due_soon">Próximos 7 dias</option>
              <option value="no_deadline">Sem prazo</option>
            </select>

            {/* Company filter */}
            {COMPANY_IDS.map(id => {
              const co  = COMPANIES[id];
              const sel = companyFilter.includes(id);
              return (
                <button key={id} onClick={() => toggleCompanyFilter(id)}
                  style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${sel ? co.primary : "var(--border)"}`, background: sel ? co.primary + "22" : "var(--surface)", color: sel ? co.primary : "var(--text-dim)", cursor: "pointer" }}>
                  {co.short}
                </button>
              );
            })}

            {/* Starred */}
            <button onClick={() => setStarredOnly(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: `1px solid ${starredOnly ? "#F59E0B" : "var(--border)"}`, background: starredOnly ? "#FFFBEB" : "var(--surface)", color: starredOnly ? "var(--warning)" : "var(--text-dim)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <Star size={11} fill={starredOnly ? "#F59E0B" : "none"} />
              Favoritos
            </button>

            {activeFilterCount > 0 && (
              <button onClick={() => { setOwnerFilter(""); setPriorityFilter(""); setCompanyFilter([]); setStarredOnly(false); setCampaignFilter(""); setDeadlineFilter(""); }}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                <X size={11} /> Limpar
              </button>
            )}
          </>
        )}
      </div>

      {(loading || loadingStages) && <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando tarefas…</div>}

      {!loading && !loadingStages && (<>
        {/* Mobile kanban: vertical collapsible stages */}
        <div className="lg:hidden space-y-1.5 pb-24">
          {kanbanStages.map(stage => {
            const stageItems = filtered.filter(t => t.stage === stage.id);
            const expanded = expandedMobileStages.has(stage.id);
            return (
              <div key={stage.id} className="rounded-xl overflow-hidden border" style={{ borderColor: stage.color + "28" }}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer"
                  style={{ background: stage.color + "12", border: "none" }}
                  onClick={() => toggleMobileStage(stage.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                    <span className="font-bold text-sm" style={{ color: stage.color }}>{stage.name}</span>
                    {stage.sla && <span className="text-xs" style={{ color: stage.color + "88" }}>SLA {stage.sla}d</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: stage.color }}>{stageItems.length}</span>
                    {canWrite && (
                      <span
                        role="button"
                        title="Editar campos desta etapa"
                        onClick={e => { e.stopPropagation(); setFieldEditorStage(stage); }}
                        style={{ color: stage.color, display: "flex", cursor: "pointer" }}
                      >
                        <Settings2 size={13} />
                      </span>
                    )}
                    <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${stage.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: stage.color, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                      <ChevronDown size={13} />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="p-2.5 space-y-2" style={{ background: "var(--surface-alt)" }}>
                    {stageItems.length === 0 ? (
                      <div className="text-center py-4 text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma tarefa nesta etapa</div>
                    ) : (
                      stageItems.map(item => (
                        <DeliverableKanbanCard
                          key={item.id}
                          item={item}
                          users={users}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          canWrite={canWrite}
                          onClick={setSelected}
                          stages={kanbanStages}
                          onMoveToStage={canWrite ? attemptStageChange : null}
                          onDeleteCard={canWrite ? handleDelete : null}
                          onToggleStar={canWrite ? toggleStar : null}
                          completeness={getItemCompleteness(item)}
                          unread={getItemUnread(item)}
                          campaignsById={campaignsById}
                        />
                      ))
                    )}
                    {canWrite && !stage.terminal && (
                      <button
                        onClick={() => setQuickAddStage(stage.id)}
                        className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                        style={{ background: stage.color + "18", color: stage.color, border: `1px dashed ${stage.color}44` }}
                      >
                        <Plus size={12} />
                        Nova tarefa
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop kanban: horizontal scroll */}
        <div className="hidden lg:block relative">
          <div className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none z-10"
            style={{ background: "linear-gradient(to left, var(--bg) 0%, transparent 100%)" }} />
          <div ref={boardRef} className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin", height: boardHeight }}>
            <div className="flex gap-3 h-full" style={{ minWidth: `${kanbanStages.length * 284}px` }}>
              {kanbanStages.map(stage => {
                const stageItems = filtered.filter(t => t.stage === stage.id);
                const isOver     = dragOverStage === stage.id;

                return (
                  <div key={stage.id}
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(stage.id)}
                    className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
                    style={{ width: 272, minWidth: 272, background: "var(--surface-alt)", borderColor: isOver ? stage.color + "70" : "var(--border)", boxShadow: isOver ? `0 0 0 2px ${stage.color}30` : "var(--shadow-card)", height: "100%", flexShrink: 0 }}>
                    <div style={{ height: 8, background: stage.color, flexShrink: 0 }} />
                    <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2"
                      style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold flex items-center gap-1.5"
                          style={{ color: "var(--text)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          <span title={stage.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}>{stage.name}</span>
                          <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0 }}>({stageItems.length})</span>
                        </div>
                        {stage.sla && <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>SLA {stage.sla}d</div>}
                      </div>
                      {canWrite && (
                        <button onClick={() => setFieldEditorStage(stage)}
                          className="flex items-center justify-center rounded-md transition-colors"
                          style={{ width: 28, height: 28, color: "var(--text-dim)", background: "transparent", border: "1px solid transparent", flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                          title="Editar campos desta etapa">
                          <Settings2 size={13} />
                        </button>
                      )}
                      {canWrite && !stage.terminal && (
                        <button onClick={() => setQuickAddStage(stage.id)}
                          className="flex items-center justify-center rounded-md transition-colors"
                          style={{ width: 28, height: 28, color: "var(--text-dim)", background: "transparent", border: "1px solid transparent", flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                          title="Adicionar tarefa">
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    <div className="px-2 pt-2 pb-1 flex-1 overflow-y-auto" style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {stageItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs gap-1"
                          style={{ borderColor: isOver ? stage.color + "40" : "var(--border)", color: "var(--text-dim)" }}>
                          {isOver ? (
                            <>
                              <Plus size={16} style={{ opacity: 0.5 }} />
                              <span>Soltar aqui</span>
                            </>
                          ) : (
                            <>
                              <span style={{ opacity: 0.5 }}>Nenhuma tarefa nesta etapa</span>
                              {!stage.terminal && canWrite && (
                                <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        stageItems.map(item => (
                          <DeliverableKanbanCard
                            key={item.id}
                            item={item}
                            users={users}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            canWrite={canWrite}
                            onClick={setSelected}
                            stages={kanbanStages}
                            onMoveToStage={canWrite ? attemptStageChange : null}
                            onDeleteCard={canWrite ? handleDelete : null}
                            onToggleStar={canWrite ? toggleStar : null}
                            completeness={getItemCompleteness(item)}
                            unread={getItemUnread(item)}
                            campaignsById={campaignsById}
                            showMoveOptions={false}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>)}

      {!loading && !loadingStages && (
        <div ref={trailingRef}>
          <p className="text-xs text-center mt-3" style={{ color: "var(--text-dim)" }}>
            Arraste para mover · "+" para criar · Clique para ver detalhes
          </p>
        </div>
      )}
    </div>

    {quickAddStage && (
      <TaskCreateModal
        stageId={quickAddStage}
        stages={kanbanStages}
        currentUser={user}
        users={users}
        campaigns={campaigns}
        onAdd={handleQuickAdd}
        onClose={() => setQuickAddStage(null)}
      />
    )}

    {syncSelected && (
      <MarketingTaskDetailDrawer
        item={syncSelected}
        stages={kanbanStages}
        campaigns={campaigns}
        onClose={() => setSelected(null)}
        onStageMoved={reopenTaskAfterMove}
        onUpdate={handleUpdate}
        onMoveToStage={attemptStageChange}
        onDelete={handleDelete}
        users={Array.from(usersById.values())}
        canWrite={canWrite}
        currentUser={user}
        notifyMentions={notifyMentions}
      />
    )}

    {/* Editor de etapas do Kanban (rh_pipeline_stages, domain="marketing_tasks") */}
    {canWrite && (
      <RHStageEditorModal
        open={stageEditorOpen}
        onClose={() => setStageEditorOpen(false)}
        domain="marketing_tasks"
        domainLabel="Tarefas"
        records={tasks}
        stageField="stage"
      />
    )}

    {/* Editor de campos customizados por etapa (rh_pipeline_stage_fields) */}
    {canWrite && (
      <RHStageFieldEditorModal
        open={!!fieldEditorStage}
        onClose={() => setFieldEditorStage(null)}
        domain="marketing_tasks"
        stageKey={fieldEditorStage?.id}
        stageName={fieldEditorStage?.name}
      />
    )}

    </>
  );
}
