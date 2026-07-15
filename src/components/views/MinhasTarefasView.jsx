import React, { useMemo } from "react";
import {
  CheckSquare, Inbox, AlertTriangle, ArrowRight, Loader2,
} from "lucide-react";
import { useMyTasks } from "../../hooks/use-my-tasks";

// "Minhas Tarefas" — landing page after login (FASE 6). Aggregates every
// card across every module where the current user is a responsible person,
// every pending item their role(s) let them approve right now, and a live
// recomputation of the stale/overdue/compliance conditions that today only
// fire as one-off push notifications. Visual language copied from
// DashboardView's TaskBucket (rounded-xl border card, tone-colored icon
// chip, count badge, clickable rows with primary/secondary text + badge).

const SECTIONS = [
  {
    id: "responsibility",
    title: "Responsabilidades",
    hint: "Cards em que você é responsável, em todos os módulos",
    icon: CheckSquare,
    tone: "#1D4ED8",
    empty: "Nada sob sua responsabilidade no momento.",
  },
  {
    id: "approval",
    title: "Aguardando minha aprovação",
    hint: "Itens pendentes que seu(s) cargo(s) permitem decidir agora",
    icon: Inbox,
    tone: "var(--warning)",
    empty: "Nada esperando sua aprovação.",
  },
  {
    id: "alert",
    title: "Alertas e pendências",
    hint: "Condições de atenção recalculadas em tempo real",
    icon: AlertTriangle,
    tone: "var(--danger)",
    empty: "Nada urgente por aqui.",
  },
];

const MAX_ITEMS_PER_MODULE = 5;

// Tier primeiro (o que precisa de ação nunca perde lugar pra uma boa
// notícia), urgencyRank depois (quanto mais vencido/mais perto do prazo,
// mais em cima) — assim um "Aniversário hoje" (tone success) nunca empurra
// um "ASO vencido há 40d" pra fora dos 5 primeiros do mesmo módulo.
function toneTier(badgeTone) {
  if (badgeTone === "var(--danger)") return 0;
  if (badgeTone === "var(--success)") return 2;
  return 1;
}

function byUrgency(a, b) {
  const tierDiff = toneTier(a.badgeTone) - toneTier(b.badgeTone);
  if (tierDiff !== 0) return tierDiff;
  const ua = Number.isFinite(a.urgencyRank) ? a.urgencyRank : Infinity;
  const ub = Number.isFinite(b.urgencyRank) ? b.urgencyRank : Infinity;
  return ua - ub;
}

function groupByModule(tasks) {
  const map = new Map();
  for (const t of tasks) {
    if (!map.has(t.module)) {
      map.set(t.module, { module: t.module, moduleLabel: t.moduleLabel, icon: t.icon, items: [] });
    }
    map.get(t.module).items.push(t);
  }
  const groups = Array.from(map.values());
  for (const g of groups) g.items.sort(byUrgency);
  return groups;
}

export function MinhasTarefasView({ currentUser, users = [], onNavigate, onLeadClick }) {
  const { tasks, loading, counts } = useMyTasks({ currentUser });

  const bySection = useMemo(() => {
    const out = {};
    for (const s of SECTIONS) out[s.id] = groupByModule(tasks.filter(t => t.bucket === s.id));
    return out;
  }, [tasks]);

  const totalTasks = counts.responsibility + counts.approval + counts.alert;

  const handleTaskClick = (task) => {
    if (task.module === "leads" && task.lead) {
      if (onLeadClick) { onLeadClick(task.lead); return; }
      onNavigate?.("crm");
      return;
    }
    onNavigate?.(task.section);
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {greetingFor(currentUser)}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {loading
              ? "Carregando suas tarefas…"
              : totalTasks > 0
                ? `${totalTasks} pendência${totalTasks !== 1 ? "s" : ""} espalhada${totalTasks !== 1 ? "s" : ""} pela plataforma`
                : "Tudo em dia por aqui"}
          </p>
        </div>
      </div>

      {loading ? (
        <div
          className="p-8 rounded-xl border flex items-center justify-center gap-2 text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          <Loader2 size={16} className="animate-spin" />
          Carregando suas tarefas…
        </div>
      ) : totalTasks === 0 ? (
        <div
          className="p-8 rounded-xl border text-center"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <CheckSquare size={28} style={{ color: "var(--success)", margin: "0 auto 8px" }} />
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Tudo em dia! Nenhuma tarefa pendente.
          </div>
        </div>
      ) : (
        SECTIONS.map(section => (
          <TaskSection
            key={section.id}
            section={section}
            groups={bySection[section.id]}
            count={counts[section.id]}
            onTaskClick={handleTaskClick}
            onSeeAll={onNavigate}
          />
        ))
      )}
    </div>
  );
}

function TaskSection({ section, groups, count, onTaskClick, onSeeAll }) {
  const Icon = section.icon;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="rounded-md flex items-center justify-center"
            style={{ width: 26, height: 26, background: section.tone + "14", color: section.tone }}
          >
            <Icon size={14} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>
              {section.title}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
              {section.hint}
            </p>
          </div>
        </div>
        {count > 0 && (
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{ background: section.tone + "14", color: section.tone }}
          >
            {count}
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <div
          className="p-5 rounded-xl border text-center text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          {section.empty}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map(group => (
            <ModuleBucket
              key={group.module}
              tone={section.tone}
              icon={group.icon}
              title={group.moduleLabel}
              items={group.items}
              onTaskClick={onTaskClick}
              onSeeAll={onSeeAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleBucket({ icon: Icon, tone, title, items, onTaskClick, onSeeAll }) {
  const shown = items.slice(0, MAX_ITEMS_PER_MODULE);
  const overflow = items.length - shown.length;

  return (
    <div
      className="rounded-xl border"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="px-3.5 py-2.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--surface-alt)" }}
      >
        <div
          className="rounded-md flex items-center justify-center"
          style={{ width: 24, height: 24, background: tone + "14", color: tone }}
        >
          <Icon size={13} strokeWidth={2.4} />
        </div>
        <div className="text-xs font-semibold" style={{ color: "var(--text)", letterSpacing: "0.01em" }}>
          {title}
        </div>
        <div className="ml-auto text-xs font-semibold" style={{ color: tone }}>
          {items.length}
        </div>
      </div>
      <div className="p-1.5">
        {shown.map(task => (
          <button
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="w-full text-left flex items-start gap-2 px-2.5 py-2 rounded-lg transition-colors duration-150"
            style={{ background: "transparent" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <span
              className="mt-1.5 shrink-0 rounded-full"
              style={{ width: 6, height: 6, background: task.badgeTone || tone }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text)" }}>
                {task.title}
              </div>
              <div className="text-xs truncate" style={{ color: "var(--text-dim)" }}>
                {task.subtitle}
              </div>
            </div>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
              style={{ background: (task.badgeTone || tone) + "14", color: task.badgeTone || tone }}
            >
              {task.badge}
            </span>
          </button>
        ))}
        {overflow > 0 && (
          <button
            onClick={() => onSeeAll?.(shown[0]?.section)}
            className="w-full flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150"
            style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <ArrowRight size={11} />
            +{overflow} mais em {title.toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}

function greetingFor(user) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const first = (user?.name || "").split(" ")[0];
  return first ? `${period}, ${first}` : "Minhas Tarefas";
}

export default MinhasTarefasView;
