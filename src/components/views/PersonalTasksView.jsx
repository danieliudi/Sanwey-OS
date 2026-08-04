import React, { useCallback, useMemo, useRef, useState } from "react";
import { List, LayoutGrid, Plus, Check, ListChecks } from "lucide-react";
import { usePersonalTasks } from "../../hooks/use-personal-tasks";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { Badge } from "../ui/Badge";
import { formatDateBR, daysSince } from "../../utils/date";
import { PersonalTaskCreateModal } from "../personal/PersonalTaskCreateModal";

const VIEW_STORAGE_KEY = "personal-tasks-view";

// Persistência do modo Lista/Kanban por usuário via localStorage — mesmo
// mecanismo de src/hooks/use-table-density.js (useState com init lido do
// storage + setter que também grava). Não virou um hook compartilhado em
// hooks/ porque esta é só a 2ª ocorrência desse padrão exato — regra 4 do
// CLAUDE.md só manda extrair na 3ª.
function useViewMode() {
  const [mode, setModeState] = useState(() => {
    try {
      return window.localStorage.getItem(VIEW_STORAGE_KEY) === "kanban" ? "kanban" : "list";
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

const STATUS_COLUMNS = [
  { id: "a_fazer", name: "A Fazer", color: "#64748B" },
  { id: "fazendo", name: "Fazendo", color: "#D97706" },
  { id: "feito",   name: "Feito",   color: "#16A34A" },
];

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
// dos próximos 7 dias — decisão documentada aqui (não fazia parte da spec
// original, que só cobria os 3 baldes): tarefa com prazo MAIS distante que
// 7 dias também cai em "Esta semana" (não em um 4º balde não especificado),
// só que mais pra baixo na lista — a ordenação por due_date ascendente (já
// aplicada pela query do hook) garante que ela apareça depois das
// realmente-desta-semana, sem inventar rótulo/seção nova fora do mockup
// aprovado.
function bucketFor(task) {
  if (!task.dueDate) return "sem_data";
  return daysSince(task.dueDate) >= 0 ? "hoje" : "semana";
}

// "Atrasada" só conta visualmente enquanto a tarefa não foi concluída — uma
// tarefa feita ontem não precisa continuar sinalizada em vermelho pra
// sempre, o alerta é sobre o que ainda precisa de ação.
function isOverdueUndone(task) {
  if (!task.dueDate || task.status === "feito") return false;
  return daysSince(task.dueDate) > 0;
}

function DueDateLabel({ task }) {
  if (!task.dueDate) return null;
  const overdue = isOverdueUndone(task);
  return (
    <span style={{ fontSize: 11, fontWeight: overdue ? 700 : 500, color: overdue ? "var(--danger)" : "var(--text-dim)", flexShrink: 0, whiteSpace: "nowrap" }}>
      {formatDateBR(task.dueDate)}
    </span>
  );
}

function PriorityPill({ priority }) {
  const p = PRIORITY_BADGE[priority] || PRIORITY_BADGE.media;
  return <Badge variant={p.variant} size="sm">{p.label}</Badge>;
}

function taskMoveTargets(task) {
  return STATUS_COLUMNS.filter(c => c.id !== task.status).map(c => ({ key: c.id, name: c.name, color: c.color }));
}

/* ── List mode ───────────────────────────────────────────────── */

// Checkbox quadrado com check — mesmo padrão visual do item de checklist de
// Entregas (ChecklistsTab em DeliverableDetailDrawer.jsx): borda/fundo
// var(--success) quando marcado, título com line-through.
function TaskRow({ task, onToggle, onMove, onDelete }) {
  const done = task.status === "feito";
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <button
        onClick={() => onToggle(task.id)}
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
      <span
        className="flex-1 min-w-0 truncate text-sm"
        style={{ color: done ? "var(--text-dim)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}
      >
        {task.title}
      </span>
      <PriorityPill priority={task.priority} />
      <DueDateLabel task={task} />
      <div onClick={e => e.stopPropagation()}>
        <MoveStageMenu
          targets={taskMoveTargets(task)}
          onMove={key => onMove(task.id, key)}
          onDelete={() => onDelete(task.id)}
          deleteLabel="Excluir tarefa"
          confirmMessage="Excluir esta tarefa? Não pode ser desfeito."
        />
      </div>
    </div>
  );
}

function TaskSection({ title, tasks, onToggle, onMove, onDelete }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.06em" }}>
        {title} <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: "normal" }}>({tasks.length})</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map(t => (
          <TaskRow key={t.id} task={t} onToggle={onToggle} onMove={onMove} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

/* ── Kanban mode ─────────────────────────────────────────────── */

function TaskKanbanCard({ task, onMove, onDelete }) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[13px] leading-snug line-clamp-2 flex-1 min-w-0" style={{ color: "var(--text)" }}>
          {task.title}
        </div>
        <div onClick={e => e.stopPropagation()} className="shrink-0">
          <MoveStageMenu
            targets={taskMoveTargets(task)}
            onMove={key => onMove(task.id, key)}
            onDelete={() => onDelete(task.id)}
            deleteLabel="Excluir tarefa"
            confirmMessage="Excluir esta tarefa? Não pode ser desfeito."
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <PriorityPill priority={task.priority} />
        <DueDateLabel task={task} />
      </div>
    </div>
  );
}

function TaskKanbanBoard({ tasks, onMove, onDelete, onCreate }) {
  const trailingRef = useRef(null);
  const [boardRef, boardHeight] = useAvailableHeight(16, [], trailingRef);

  const byStatus = useMemo(() => {
    const bucket = { a_fazer: [], fazendo: [], feito: [] };
    for (const t of tasks) { if (bucket[t.status]) bucket[t.status].push(t); }
    return bucket;
  }, [tasks]);

  return (
    <>
      {/* Desktop: board horizontal com scroll de altura controlada — mesmos
          primitivos compartilhados de todo Kanban da plataforma
          (useAvailableHeight/KanbanBoardScrollArea/KanbanColumnHeader). */}
      <div className="hidden lg:block">
        <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
          <div className="flex gap-2 h-full" style={{ minWidth: `${STATUS_COLUMNS.length * 280}px` }}>
            {STATUS_COLUMNS.map((col, idx) => {
              const items = byStatus[col.id] || [];
              return (
                <div
                  key={col.id}
                  className="flex flex-col rounded-lg"
                  style={{
                    width: 280, minWidth: 280, overflow: "hidden", height: "100%", flexShrink: 0,
                    borderRight: idx < STATUS_COLUMNS.length - 1 ? "1px solid var(--border)" : "none",
                    background: "var(--surface-alt)",
                  }}
                >
                  <KanbanColumnHeader
                    color={col.color} name={col.name} count={items.length}
                    bandHeight={4} letterSpacing="normal" nameColor={col.color}
                    nameFontSize={14} nameFontWeight={700} uppercase={false} countFontSize={12}
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
                      <TaskKanbanCard key={t.id} task={t} onMove={onMove} onDelete={onDelete} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </KanbanBoardScrollArea>
      </div>

      {/* Mobile: sem acordeão dedicado (RHMobileKanbanAccordion é só-RH, ver
          CLAUDE.md regra 2) — as 3 colunas empilham como seções verticais,
          mesmo dado, sem scroll horizontal. */}
      <div className="lg:hidden flex flex-col gap-4">
        {STATUS_COLUMNS.map(col => {
          const items = byStatus[col.id] || [];
          return (
            <div key={col.id}>
              <div className="text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-2" style={{ color: "var(--text-dim)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                {col.name} ({items.length})
              </div>
              <div className="flex flex-col gap-2">
                {items.map(t => (
                  <TaskKanbanCard key={t.id} task={t} onMove={onMove} onDelete={onDelete} />
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
  const { tasks, loading, createTask, updateTask, deleteTask, toggleDone } =
    usePersonalTasks({ userId: currentUser?.id, enabled: true });

  const [viewMode, setViewMode] = useViewMode();
  const [showCreate, setShowCreate] = useState(false);

  const buckets = useMemo(() => {
    const hoje = [], semana = [], semData = [];
    for (const t of tasks) {
      const b = bucketFor(t);
      if (b === "hoje") hoje.push(t);
      else if (b === "semana") semana.push(t);
      else semData.push(t);
    }
    return { hoje, semana, semData };
  }, [tasks]);

  // Mover pra "feito" seta completed_at; mover pra qualquer outro status
  // limpa — mesmo par de efeitos que toggleDone já faz pro checkbox, só que
  // aqui cobre os 3 destinos (o checkbox só alterna feito ⇄ a_fazer).
  const handleMove = useCallback((id, status) => {
    updateTask(id, { status, completedAt: status === "feito" ? new Date().toISOString() : null });
  }, [updateTask]);

  const handleCreate = useCallback(async (data) => { await createTask(data); }, [createTask]);

  const hasAnyTask = tasks.length > 0;

  return (
    <>
      <KanbanBoardHeader className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks size={22} style={{ color: "var(--text)" }} />
              <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
                Tarefas Pessoais
              </h1>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
              Sua lista particular — ninguém mais vê isto.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
              <ViewToggleButton active={viewMode === "list"}   onClick={() => setViewMode("list")}   icon={List}       label="Lista"  iconOnlyMobile />
              <ViewToggleButton active={viewMode === "kanban"} onClick={() => setViewMode("kanban")} icon={LayoutGrid} label="Kanban" iconOnlyMobile />
            </div>
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
      ) : viewMode === "list" ? (
        <div>
          <TaskSection title="Hoje"        tasks={buckets.hoje}   onToggle={toggleDone} onMove={handleMove} onDelete={deleteTask} />
          <TaskSection title="Esta semana" tasks={buckets.semana} onToggle={toggleDone} onMove={handleMove} onDelete={deleteTask} />
          <TaskSection title="Sem data"    tasks={buckets.semData} onToggle={toggleDone} onMove={handleMove} onDelete={deleteTask} />
        </div>
      ) : (
        <TaskKanbanBoard tasks={tasks} onMove={handleMove} onDelete={deleteTask} onCreate={() => setShowCreate(true)} />
      )}

      {showCreate && (
        <PersonalTaskCreateModal onAdd={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}

export default PersonalTasksView;
