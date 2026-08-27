import React, { useEffect, useMemo, useState } from "react";
import {
  CheckSquare, Inbox, AlertTriangle, Flame, ChevronDown,
} from "lucide-react";
import { useMyTasks } from "../../hooks/use-my-tasks";
import { Card, CardGrid, CardSkeleton } from "../shared/Card";
import { Tabs } from "../shared/Tabs";
import { StatCard } from "../ui/StatCard";
import { StatCardGrid } from "../shared/StatCardGrid";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";

// "Minhas Tarefas" — landing page after login (FASE 6). Aggregates every
// card across every module where the current user is a responsible person,
// every pending item their role(s) let them approve right now, and a live
// recomputation of the stale/overdue/compliance conditions that today only
// fire as one-off push notifications. Redesign "Fila Única de Prioridade"
// (docs/design-spec-minhas-tarefas-fila-unica-prioridade.md): 1 lista
// vertical ordenada por severidade real, cruzando os 3 buckets, em vez de 3
// seções fixas.

const MAX_VISIBLE_ROWS = 10;

const BUCKET_META = {
  responsibility: { label: "Responsabilidade", dotColor: "#1D4ED8" },
  approval: { label: "Aprovação", dotColor: "#5B21B6" },
  alert: { label: "Alerta", dotColor: "var(--text-faint)" },
};

const FILTER_ICON = { responsibility: CheckSquare, approval: Inbox, alert: AlertTriangle };

const FILTER_EMPTY_TEXT = {
  all: "Nenhuma responsabilidade, aprovação ou alerta pendente no momento.",
  responsibility: "Nenhuma responsabilidade atribuída a você no momento.",
  approval: "Nada esperando sua aprovação agora.",
  alert: "Nenhum alerta ativo — tudo dentro do prazo.",
};

const FILTER_EMPTY_TITLE = {
  all: "Tudo em dia!",
  responsibility: "Nada por aqui",
  approval: "Nada por aqui",
  alert: "Nada por aqui",
};

// 3 grupos visíveis (rótulo vira UI, não só critério de desempate como
// `toneTier` fazia antes) — var(--text-dim) e var(--warning) deliberadamente
// separados (spec, nota de decisão #3): "rotina" != "sinalizado como atenção".
const TIER_META = [
  { label: "Crítico", color: "var(--danger)" },
  { label: "Atenção", color: "var(--warning)" },
  { label: "Em dia", color: "var(--text-faint)" },
];

function tierOf(badgeTone) {
  if (badgeTone === "var(--danger)") return 0;
  if (badgeTone === "var(--warning)") return 1;
  return 2;
}

function byPriority(a, b) {
  const tierDiff = tierOf(a.badgeTone) - tierOf(b.badgeTone);
  if (tierDiff !== 0) return tierDiff;
  const ua = Number.isFinite(a.urgencyRank) ? a.urgencyRank : Infinity;
  const ub = Number.isFinite(b.urgencyRank) ? b.urgencyRank : Infinity;
  return ua - ub;
}

// `tone` é sempre um valor já emitido por use-my-tasks.js ("var(--danger)",
// "var(--warning)", "var(--success)", "var(--text-dim)") — nunca hex
// literal. color-mix() resolve o bug de concatenar alpha hex direto numa
// string "var(--token)" (gerava "var(--warning)14", cor CSS inválida).
function UrgencyPill({ tone, label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 8px",
      borderRadius: "var(--radius-sm)",
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
      background: `color-mix(in srgb, ${tone} 14%, transparent)`,
      color: tone,
      border: `1px solid color-mix(in srgb, ${tone} 30%, transparent)`,
    }}>
      {label}
    </span>
  );
}

export function MinhasTarefasView({ currentUser, users = [], onNavigate, onLeadClick, onOpenPending }) {
  const { tasks, loading, counts } = useMyTasks({ currentUser });
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setExpanded(false); }, [filter]);

  const totalTasks = counts.responsibility + counts.approval + counts.alert;
  const urgentNowCount = useMemo(
    () => tasks.filter(t => t.badgeTone === "var(--danger)").length,
    [tasks],
  );
  // Aniversário/bodas de empresa (informational: true) continuam listados
  // na aba Alertas — só não contam pro headline "Alertas ativos", que
  // existe pra sinalizar urgência (achado real: os dois usam tom --success
  // e não têm nenhuma ação de resolução).
  const activeAlertCount = useMemo(
    () => tasks.filter(t => t.bucket === "alert" && !t.informational).length,
    [tasks],
  );

  const filtered = useMemo(() => {
    const subset = filter === "all" ? tasks : tasks.filter(t => t.bucket === filter);
    return [...subset].sort(byPriority);
  }, [tasks, filter]);

  const visible = expanded ? filtered : filtered.slice(0, MAX_VISIBLE_ROWS);
  const remaining = filtered.length - visible.length;

  const groups = useMemo(() => {
    const buckets = [[], [], []];
    for (const t of visible) buckets[tierOf(t.badgeTone)].push(t);
    return buckets
      .map((items, tierIdx) => ({ ...TIER_META[tierIdx], items }))
      .filter(g => g.items.length > 0);
  }, [visible]);

  const handleTaskClick = (task) => {
    if (task.module === "leads" && task.lead) {
      if (onLeadClick) { onLeadClick(task.lead); return; }
      onNavigate?.("crm");
      return;
    }
    if (onOpenPending) { onOpenPending(task); return; }
    onNavigate?.(task.section);
  };

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {greetingFor(currentUser)}
          </h1>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} density="list" />
          ))}
        </div>
      ) : (
        <>
          <StatCardGrid desktopClassName="md:grid-cols-4">
            <StatCard
              icon={Flame}
              value={urgentNowCount}
              label="Urgentes agora"
              sublabel="Cruzando responsabilidades, aprovações e alertas"
              accent="var(--danger)"
            />
            <StatCard
              icon={CheckSquare}
              value={counts.responsibility}
              label="Responsabilidades"
              tooltip="Conta só o que já tem você como responsável atribuído — itens aguardando decisão de aprovação aparecem em 'Aguardando aprovação', mesmo antes de terem um responsável definido."
            />
            <StatCard icon={Inbox} value={counts.approval} label="Aguardando aprovação" />
            <StatCard
              icon={AlertTriangle}
              value={activeAlertCount}
              label="Alertas ativos"
              sublabel="Recalculado em tempo real"
            />
          </StatCardGrid>

          <Tabs
            tabs={[
              { id: "all", label: "Tudo", count: totalTasks },
              { id: "responsibility", label: "Responsabilidades", count: counts.responsibility, icon: CheckSquare },
              { id: "approval", label: "Aprovações", count: counts.approval, icon: Inbox },
              { id: "alert", label: "Alertas", count: counts.alert, icon: AlertTriangle },
            ]}
            active={filter}
            onChange={setFilter}
            iconOnlyMobile
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon={FILTER_ICON[filter] || CheckSquare}
              title={FILTER_EMPTY_TITLE[filter] || "Nada por aqui"}
              description={FILTER_EMPTY_TEXT[filter]}
              action={filter !== "all" ? <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>Ver tudo</Button> : undefined}
            />
          ) : (
            <div>
              {groups.map((group, idx) => (
                <div
                  key={group.label}
                  style={idx > 0 ? { borderTop: "1px solid var(--border)", paddingTop: 12 } : undefined}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: idx === 0 ? "0 0 8px" : "20px 0 8px" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: group.color }} />
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>
                      {group.label} · {group.items.length}
                    </span>
                  </div>
                  <CardGrid density="list">
                    {group.items.map(task => {
                      const meta = BUCKET_META[task.bucket];
                      const isCritical = task.badgeTone === "var(--danger)";
                      return (
                        <div
                          key={task.id}
                          style={{
                            borderLeft: `3px solid ${isCritical ? "var(--danger)" : "transparent"}`,
                            borderTopLeftRadius: "var(--radius-lg)",
                            borderBottomLeftRadius: "var(--radius-lg)",
                          }}
                        >
                          <Card
                            icon={<task.icon size={13} strokeWidth={2.4} />}
                            title={task.title}
                            meta={`${task.moduleLabel} · ${task.subtitle}`}
                            status={{ color: meta.dotColor, label: meta.label }}
                            footer={<UrgencyPill tone={task.badgeTone} label={task.badge} />}
                            onClick={() => handleTaskClick(task)}
                            density="list"
                          />
                        </div>
                      );
                    })}
                  </CardGrid>
                </div>
              ))}

              {remaining > 0 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full flex items-center justify-center gap-1.5 transition-colors duration-150"
                  style={{
                    marginTop: 12,
                    padding: "10px 0",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-dim)",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  Ver mais {remaining} pendência{remaining !== 1 ? "s" : ""}
                  <ChevronDown size={14} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function greetingFor(user) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const first = (user?.name || "").split(" ")[0];
  return first ? `${period}, ${first}` : "Pendências";
}

export default MinhasTarefasView;
