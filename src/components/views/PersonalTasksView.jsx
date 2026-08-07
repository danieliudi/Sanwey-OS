import React, { useCallback, useMemo, useRef, useState } from "react";
import { List, LayoutGrid, Calendar, Plus, Check, ListChecks, Pencil, Settings2, ArrowUpDown } from "lucide-react";
import { usePersonalTasks } from "../../hooks/use-personal-tasks";
import { usePersonalTaskStages } from "../../hooks/use-personal-task-stages";
import { usePersonalTaskStageFields } from "../../hooks/use-personal-task-stage-fields";
import { usePersonalTaskTags } from "../../hooks/use-personal-task-tags";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems, SORT_OPTIONS } from "../../utils/kanban-sort";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { Badge } from "../ui/Badge";
import { formatDateBR, daysSince } from "../../utils/date";
import { STATUS_COLUMNS } from "../../constants/personal-tasks";
import { PersonalTaskCreateModal } from "../personal/PersonalTaskCreateModal";
import { PersonalTaskDetailDrawer } from "../personal/PersonalTaskDetailDrawer";
import { PersonalTaskAgendaView } from "../personal/PersonalTaskAgendaView";
import { PersonalStageListManager } from "../personal/PersonalStageListManager";
import { PersonalStageFieldsPanel } from "../personal/PersonalStageFieldsPanel";

const VIEW_STORAGE_KEY = "personal-tasks-view";
const PERSONAL_SORT_OPTIONS = ["recent", "deadline", "priority", "alpha"];
const personalSortGetters = { deadline: t => t.dueDate, priority: t => t.priority, name: t => t.title, createdAt: t => t.createdAt };

// Persistência do modo Lista/Kanban/Agenda por usuário via localStorage —
// mesmo mecanismo de src/hooks/use-table-density.js (useState com init lido
// do storage + setter que também grava). Não virou um hook compartilhado em
// hooks/ porque esta é só a 2ª ocorrência desse padrão exato — regra 4 do
// CLAUDE.md só manda extrair na 3ª.
function useViewMode() {
  const [mode, setModeState] = useState(() => {
    try {
      const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
      return v === "kanban" || v === "agenda" ? v : "list";
    } catch {
      return "list";
    }
  });
  const setMode = useCallback((next) => {
    setModeState(next);
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, next); } catch {}
  }, []);
  return [mode, setMode];
}

// Pill de prioridade via Badge compartilhado (src/components/ui/Badge.jsx) —
// nunca hand-roll de pílula nova (regra 1 do CLAUDE.md). Alta usa a mesma
// dupla var(--danger)/var(--danger-bg) do variant "critical"; Média usa
// var(--warning)/var(--warning-bg) do variant "urgent"; Baixa usa o variant
// "success" (var(--success)/var(--success-bg)) — o "neutro/esverdeado" que a
// spec pediu.
const PRIORITY_BADGE = {
  alta:  { variant: "critical", label: "Alta"  },
  media: { variant: "urgent",   label: "Média" },
  baixa: { variant: "success",  label: "Baixa" },
};

// Agrupamento por due_date (spec da view): "Hoje" cobre hoje E atrasadas —
// uma tarefa vencida não some da tela, ela fica em evidência até ser
// concluída ou adiada. "Sem data" é due_date nulo. "Esta semana" é o balde
// dos próximos 7 dias.
function bucketFor(task) {
  if (!task.dueDate) return "sem_data";
  return daysSince(task.dueDate) >= 0 ? "hoje" : "semana";
}

function isOverdueUndone(task) {
  if (!task.dueDate || task.status === "feito") return false;
  return daysSince(task.dueDate) > 0;
}

function DueDateLabel({ task }) {
  if (!task.dueDate) return null;
  const overdue = isOverdueUndone(task);
  return (
    <span style={{ fontSize: 11, fontWeight: overdue ? 700 : 500, color: overdue ? "var(--danger)" : "var(--text-dim)", flexShrink: 0, whiteSpace: "nowrap" }}>
      {formatDateBR(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ""}
    </span>
  );
}

function PriorityPill({ priority }) {
  const p = PRIORITY_BADGE[priority] || PRIORITY_BADGE.media;
  return <Badge variant={p.variant} size="sm">{p.label}</Badge>;
}

function TagChips({ tags }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(t => (
        <span key={t} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "var(--surface-alt)", color: "var(--accent)" }}>
          {t}
        </span>
      ))}
    </div>
  );
}

function taskMoveTargets(task, columns) {
  return columns.filter(c => c.id !== task.status).map(c => ({ key: c.id, name: c.name, color: c.color }));
}

/* ── Filtro de etiquetas ─────────────────────────────────────── */

function TagFilterBar({ allTags, activeTags, onToggle }) {
  if (allTags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      <span className="text-[10px] font-bold uppercase tracking-wide mr-0.5" style={{ color: "var(--text-dim)" }}>Etiquetas</span>
      {allTags.map(tag => {
        const active = activeTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
            style={{
              background: active ? "var(--accent)" : "var(--surface)",
              color: active ? "var(--on-accent)" : "var(--text-dim)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              cursor: "pointer",
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

/* ── List mode ───────────────────────────────────────────────── */

// Checkbox quadrado com check — mesmo padrão visual do item de checklist de
// Entregas (ChecklistsTab em DeliverableDetailDrawer.jsx): borda/fundo
// var(--success) quando marcado, título com line-through.
function TaskRow({ task, columns, onToggle, onMove, onDelete, onOpen }) {
  const done = task.status === "feito";
  return (
    <div
      onClick={() => onOpen(task)}
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer transition-colors"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle(task.id); }}
        title={done ? "Reabrir tarefa" : "Marcar como feita"}
        style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          border: `1.5px solid ${done ? "var(--success)" : "var(--border-strong)"}`,
          background: done ? "var(--success)" : "var(--surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        {done && <Check size={11} color="#FFF" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span
          className="truncate text-sm"
          style={{ color: done ? "var(--text-dim)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}
        >
          {task.title}
        </span>
        <TagChips tags={task.tags} />
      </div>
      <PriorityPill priority={task.priority} />
      <DueDateLabel task={task} />
      <div onClick={e => e.stopPropagation()}>
        <MoveStageMenu
          targets={taskMoveTargets(task, columns)}
          onMove={key => onMove(task.id, key)}
          onDelete={() => onDelete(task.id)}
          deleteLabel="Excluir tarefa"
          confirmMessage="Excluir esta tarefa? Não pode ser desfeito."
        />
      </div>
    </div>
  );
}

function TaskSection({ title, tasks, columns, onToggle, onMove, onDelete, onOpen }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.06em" }}>
        {title} <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: "normal" }}>({tasks.length})</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map(t => (
          <TaskRow key={t.id} task={t} columns={columns} onToggle={onToggle} onMove={onMove} onDelete={onDelete} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

/* ── Kanban mode ─────────────────────────────────────────────── */

function TaskKanbanCard({ task, columns, onMove, onDelete, onOpen, onDragStart, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      className="p-3 rounded-lg cursor-pointer transition-shadow"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[13px] leading-snug line-clamp-2 flex-1 min-w-0" style={{ color: "var(--text)" }}>
          {task.title}
        </div>
        <div onClick={e => e.stopPropagation()} className="shrink-0">
          <MoveStageMenu
            targets={taskMoveTargets(task, columns)}
            onMove={key => onMove(task.id, key)}
            onDelete={() => onDelete(task.id)}
            deleteLabel="Excluir tarefa"
            confirmMessage="Excluir esta tarefa? Não pode ser desfeito."
          />
        </div>
      </div>
      {task.tags?.length > 0 && <div className="mb-2"><TagChips tags={task.tags} /></div>}
      <div className="flex items-center justify-between gap-2">
        <PriorityPill priority={task.priority} />
        <DueDateLabel task={task} />
      </div>
    </div>
  );
}

function TaskKanbanBoard({ tasks, columns, onMove, onDelete, onCreate, onOpen, onEditStageFields }) {
  const trailingRef = useRef(null);
  const [boardRef, boardHeight] = useAvailableHeight(16, [], trailingRef);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const { getCriteria, setCriteria } = useKanbanColumnSort("personal-tasks");

  const byStatus = useMemo(() => {
    const bucket = {};
    for (const c of columns) bucket[c.id] = [];
    for (const t of tasks) { if (bucket[t.status]) bucket[t.status].push(t); }
    return bucket;
  }, [tasks, columns]);

  // Mesmo padrão nativo HTML5 de drag-and-drop do Pipeline/Campanhas/Entregas
  // (ver CRMView.jsx handleDrop/handleDragOver) — nenhum board da plataforma
  // usa lib de DnD, só draggable+onDragStart/onDragOver/onDrop/onDragEnd.
  const handleDrop = useCallback((statusId) => {
    if (draggedTask && draggedTask.status !== statusId) onMove(draggedTask.id, statusId);
    setDraggedTask(null);
    setDragOverStatus(null);
  }, [draggedTask, onMove]);
  const handleDragOver  = useCallback((e, statusId) => { e.preventDefault(); setDragOverStatus(statusId); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStatus(null); }, []);
  const handleDragEnd   = useCallback(() => { setDraggedTask(null); setDragOverStatus(null); }, []);

  return (
    <>
      {/* Desktop: board horizontal com scroll de altura controlada — mesmos
          primitivos compartilhados de todo Kanban da plataforma
          (useAvailableHeight/KanbanBoardScrollArea/KanbanColumnHeader). */}
      <div className="hidden lg:block">
        <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
          <div className="flex gap-2 h-full" style={{ minWidth: `${columns.length * 280}px` }}>
            {columns.map((col, idx) => {
              const rawItems = byStatus[col.id] || [];
              const items = sortKanbanItems(rawItems, getCriteria(col.id), personalSortGetters);
              const isOver = dragOverStatus === col.id;
              return (
                <div
                  key={col.id}
                  onDragOver={e => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(col.id)}
                  className="flex flex-col rounded-lg transition-all duration-150"
                  style={{
                    width: 280, minWidth: 280, overflow: "hidden", height: "100%", flexShrink: 0,
                    borderRight: idx < columns.length - 1 ? "1px solid var(--border)" : "none",
                    background: isOver ? col.color + "14" : "var(--surface-alt)",
                    boxShadow: isOver ? `0 0 0 2px ${col.color}40` : "none",
                  }}
                >
                  <KanbanColumnHeader
                    color={col.color} name={col.name} count={items.length}
                    bandHeight={4} letterSpacing="normal"
                    nameFontSize={14} nameFontWeight={700} uppercase={false} countFontSize={12}
                    actions={
                      <div className="flex items-center gap-0.5">
                        <KanbanColumnSortMenu criteria={getCriteria(col.id)} onChange={(c) => setCriteria(col.id, c)} options={PERSONAL_SORT_OPTIONS} />
                        <button
                          onClick={() => onEditStageFields(col.id)}
                          title="Campos desta etapa"
                          style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <Settings2 size={13} />
                        </button>
                      </div>
                    }
                  />
                  <div className="px-2 pt-2 pb-1 flex-1 overflow-y-auto" style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {items.length === 0 ? (
                      <div
                        className="flex items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs"
                        style={{ borderColor: "var(--border)", color: "var(--text-dim)", opacity: 0.6 }}
                      >
                        Nenhuma tarefa
                      </div>
                    ) : items.map(t => (
                      <TaskKanbanCard key={t.id} task={t} columns={columns} onMove={onMove} onDelete={onDelete} onOpen={onOpen}
                        onDragStart={setDraggedTask} onDragEnd={handleDragEnd} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </KanbanBoardScrollArea>
      </div>

      {/* Mobile: sem acordeão dedicado (RHMobileKanbanAccordion é só-RH, ver
          CLAUDE.md regra 2) — as colunas empilham como seções verticais,
          mesmo dado, sem scroll horizontal nem drag (touch usa o menu). */}
      <div className="lg:hidden flex flex-col gap-4">
        {columns.map(col => {
          const items = sortKanbanItems(byStatus[col.id] || [], getCriteria(col.id), personalSortGetters);
          return (
            <div key={col.id}>
              <div className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-2" style={{ color: "var(--text-dim)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                {col.name} ({items.length})
              </div>
              <div className="flex flex-col gap-2">
                {items.map(t => (
                  <TaskKanbanCard key={t.id} task={t} columns={columns} onMove={onMove} onDelete={onDelete} onOpen={onOpen}
                    onDragStart={() => {}} onDragEnd={() => {}} />
                ))}
                {items.length === 0 && (
                  <div className="text-xs" style={{ color: "var(--text-dim)", opacity: 0.6 }}>Nenhuma tarefa</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <KanbanFab label="Nova tarefa" onClick={onCreate} />
    </>
  );
}

/* ── Main view ───────────────────────────────────────────────── */

export function PersonalTasksView({ currentUser }) {
  // Sempre `enabled: true` aqui — o opt-in em Configurações só decide se o
  // item aparece no menu (App.jsx), não se a ROTA funciona. Ver nota em
  // App.jsx: acessar a URL direto com o opt-in desligado não expõe nada,
  // RLS já garante que só o dono vê as próprias linhas.
  const { tasks, loading, createTask, updateTask, deleteTask, toggleDone, setTaskStatus } =
    usePersonalTasks({ userId: currentUser?.id, enabled: true });

  const stagesHook = usePersonalTaskStages(currentUser?.id);
  const stageFieldsHook = usePersonalTaskStageFields(currentUser?.id);
  const tagsHook = usePersonalTaskTags(currentUser?.id);

  // Quem nunca customizou etapas continua vendo as 3 de sempre — as linhas
  // em personal_task_stages só nascem quando o usuário salva o editor pela
  // 1ª vez (ver PersonalStageListManager), não semeadas de antemão.
  const columns = stagesHook.stages.length > 0 ? stagesHook.stages.map(s => ({ id: s.stageKey, name: s.name, color: s.color, terminal: s.terminal })) : STATUS_COLUMNS;

  const [viewMode, setViewMode] = useViewMode();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTags, setActiveTags] = useState([]);
  const [listSort, setListSort] = useState("recent");
  const [stagesEditorOpen, setStagesEditorOpen] = useState(false);
  const [editingFieldsStageKey, setEditingFieldsStageKey] = useState(null);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const t of tasks) for (const tag of (t.tags || [])) set.add(tag);
    return [...set].sort();
  }, [tasks]);

  const toggleTagFilter = useCallback((tag) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const filteredTasks = useMemo(() => {
    if (activeTags.length === 0) return tasks;
    return tasks.filter(t => activeTags.every(tag => (t.tags || []).includes(tag)));
  }, [tasks, activeTags]);

  const sortedFilteredTasks = useMemo(
    () => sortKanbanItems(filteredTasks, listSort, personalSortGetters),
    [filteredTasks, listSort]
  );

  const buckets = useMemo(() => {
    const hoje = [], semana = [], semData = [];
    for (const t of sortedFilteredTasks) {
      const b = bucketFor(t);
      if (b === "hoje") hoje.push(t);
      else if (b === "semana") semana.push(t);
      else semData.push(t);
    }
    return { hoje, semana, semData };
  }, [sortedFilteredTasks]);

  // Único ponto de mudança de status usado por checkbox/menu/drag-and-drop —
  // ver setTaskStatus em use-personal-tasks.js (cobre o par completed_at +
  // disparo de recorrência num só lugar).
  const handleMove = useCallback((id, status) => { setTaskStatus(id, status); }, [setTaskStatus]);

  const handleCreate = useCallback(async (data) => { await createTask(data); }, [createTask]);

  const handleOpen = useCallback((task) => setSelectedTaskId(task.id), []);
  const handleCloseDrawer = useCallback(() => setSelectedTaskId(null), []);
  const handleDeleteFromDrawer = useCallback(async (id) => { await deleteTask(id); setSelectedTaskId(null); }, [deleteTask]);
  const handleSetStatusFromDrawer = useCallback(async (id, status) => { await setTaskStatus(id, status); setSelectedTaskId(null); }, [setTaskStatus]);

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId) || null, [tasks, selectedTaskId]);

  const hasAnyTask = tasks.length > 0;

  return (
    <>
      <KanbanBoardHeader className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks size={22} style={{ color: "var(--text)" }} />
              <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
                Lista Pessoal
              </h1>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
              Sua lista particular — ninguém mais vê isto.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
              <ViewToggleButton active={viewMode === "kanban"} onClick={() => setViewMode("kanban")} icon={LayoutGrid} label="Kanban" iconOnlyMobile />
              <ViewToggleButton active={viewMode === "list"}   onClick={() => setViewMode("list")}   icon={List}       label="Lista"  iconOnlyMobile />
              <ViewToggleButton active={viewMode === "agenda"} onClick={() => setViewMode("agenda")} icon={Calendar}   label="Agenda" iconOnlyMobile dataTour="lista-pessoal-agenda" />
            </div>
            {viewMode === "list" && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-dim)" }}>
                <ArrowUpDown size={12} />
                <select value={listSort} onChange={e => setListSort(e.target.value)} style={{ border: "none", background: "transparent", color: "var(--text)", fontSize: 12, outline: "none" }}>
                  {SORT_OPTIONS.filter(o => PERSONAL_SORT_OPTIONS.includes(o.value)).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={() => setStagesEditorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
            >
              <Pencil size={13} />
              <span className="hidden sm:inline">Editar etapas</span>
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer" }}
            >
              <Plus size={13} />
              Nova tarefa
            </button>
          </div>
        </div>
      </KanbanBoardHeader>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      ) : !hasAnyTask ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ListChecks size={32} style={{ opacity: 0.4, marginBottom: 10, color: "var(--text-dim)" }} />
          <div className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>Nenhuma tarefa ainda</div>
          <div className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>Crie sua primeira tarefa pessoal.</div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer" }}
          >
            <Plus size={14} />
            Nova tarefa
          </button>
        </div>
      ) : (
        <>
          <TagFilterBar allTags={allTags} activeTags={activeTags} onToggle={toggleTagFilter} />
          {viewMode === "list" ? (
            <div>
              <TaskSection title="Hoje"        tasks={buckets.hoje}    columns={columns} onToggle={toggleDone} onMove={handleMove} onDelete={deleteTask} onOpen={handleOpen} />
              <TaskSection title="Esta semana" tasks={buckets.semana}  columns={columns} onToggle={toggleDone} onMove={handleMove} onDelete={deleteTask} onOpen={handleOpen} />
              <TaskSection title="Sem data"    tasks={buckets.semData} columns={columns} onToggle={toggleDone} onMove={handleMove} onDelete={deleteTask} onOpen={handleOpen} />
            </div>
          ) : viewMode === "kanban" ? (
            <TaskKanbanBoard
              tasks={filteredTasks} columns={columns} onMove={handleMove} onDelete={deleteTask}
              onCreate={() => setShowCreate(true)} onOpen={handleOpen}
              onEditStageFields={setEditingFieldsStageKey}
            />
          ) : (
            <PersonalTaskAgendaView tasks={filteredTasks} onOpen={handleOpen} />
          )}
        </>
      )}

      {showCreate && (
        <PersonalTaskCreateModal onAdd={handleCreate} onClose={() => setShowCreate(false)} tagsHook={tagsHook} />
      )}

      {selectedTask && (
        <PersonalTaskDetailDrawer
          task={selectedTask}
          userId={currentUser?.id}
          columns={columns}
          tagsHook={tagsHook}
          stageFieldsHook={stageFieldsHook}
          onClose={handleCloseDrawer}
          onUpdate={updateTask}
          onDelete={handleDeleteFromDrawer}
          onSetStatus={handleSetStatusFromDrawer}
          onEditStageFields={setEditingFieldsStageKey}
        />
      )}

      <PersonalStageListManager
        open={stagesEditorOpen}
        onClose={() => setStagesEditorOpen(false)}
        stages={stagesHook.stages.length > 0
          ? stagesHook.stages
          : STATUS_COLUMNS.map(c => ({ id: c.id, stageKey: c.id, name: c.name, color: c.color, terminal: c.id === "feito", isFallback: true }))}
        stagesHook={stagesHook}
        tasks={tasks}
      />

      <PersonalStageFieldsPanel
        open={Boolean(editingFieldsStageKey)}
        onClose={() => setEditingFieldsStageKey(null)}
        stageKey={editingFieldsStageKey}
        stages={columns.map(c => ({ stageKey: c.id, name: c.name, color: c.color }))}
        stageFieldsHook={stageFieldsHook}
      />
    </>
  );
}

export default PersonalTasksView;
