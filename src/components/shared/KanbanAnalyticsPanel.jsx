import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Eyebrow } from "./PanelHeading";
import { AvatarStack } from "./AvatarStack";
import { daysSince } from "../../utils/date";

// Consolida as 3 cópias quase idênticas de `AnalyticsPanel` que existiam em
// CRMView/MarketingView/EntregasView (docs/design-spec-analise-generica-kanbans.md
// §1.2). "Distribuição por etapa" reproduz o mesmo visual que já existia
// (barra + legenda, por etapa individual — não é o `StageDistributionBar`,
// que é a versão empilhada de resumo executivo das 3 Visões Gerais). As
// linhas "Genérico"/"Específico" são novas (mockup aprovado com o Daniel,
// layout em 2 linhas, nunca misturadas).
function MiniStat({ label, value, color, title }) {
  return (
    <div
      className="rounded-xl border"
      title={title}
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        padding: "12px 16px",
        boxShadow: "var(--shadow-card)",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "var(--text)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

// "Atraso por responsável" (mockup aprovado com o Daniel): agrupa os
// registros que JÁ estouraram o SLA pelo responsável real de cada um, em vez
// de assumir um dono fixo por etapa. Só renderiza quando quem chama passa
// `getOwnerIds` + `usersById` — board sem conceito de responsável
// (Onboarding/Férias/Treinamentos) simplesmente não mostra a seção.
function OwnerSlaTable({ rows }) {
  const th = { textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", padding: "0 10px 8px", borderBottom: "1px solid var(--border)" };
  const td = { padding: 10, borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text)" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Responsável</th>
            <th style={{ ...th, textAlign: "right" }}>Registros com SLA estourado</th>
            <th style={{ ...th, textAlign: "right" }}>Dias médios de atraso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={td}>
                <div className="flex items-center gap-2">
                  {r.user ? <AvatarStack users={[r.user]} size={22} /> : null}
                  <span style={{ color: r.user ? "var(--text)" : "var(--text-dim)" }}>
                    {r.user?.name || "Sem responsável atribuído"}
                  </span>
                </div>
              </td>
              <td style={{ ...td, textAlign: "right" }}>
                <span
                  className="inline-flex items-center justify-center font-bold"
                  style={{ minWidth: 22, padding: "2px 7px", borderRadius: 999, background: "var(--danger-bg)", color: "var(--danger)", fontSize: 12 }}
                >
                  {r.count}
                </span>
              </td>
              <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.avgOverdue}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KanbanAnalyticsPanel({ stages, records, getStageKey, getStageEnteredAt, specificStats = [], getOwnerIds, usersById }) {
  const stageStats = useMemo(() => {
    const total = records.length;
    return stages.map(stage => {
      const count = records.filter(r => getStageKey(r) === stage.key).length;
      return { stage, count, percent: total > 0 ? (count / total) * 100 : 0 };
    });
  }, [stages, records, getStageKey]);

  // "Dentro"/"Estourou" usa o mesmo limiar (ratio >= 1) do badge de aging dos
  // cards de Kanban (agingStyle, KanbanCardStatusChips.jsx) — etapa sem
  // slaDays configurado não entra no denominador (nem a favor, nem contra).
  const generic = useMemo(() => {
    let daysSum = 0, daysCount = 0, withinSla = 0, overSla = 0;
    for (const r of records) {
      const enteredAt = getStageEnteredAt(r);
      if (!enteredAt) continue;
      const days = daysSince(enteredAt);
      daysSum += days;
      daysCount++;
      const stage = stages.find(s => s.key === getStageKey(r));
      if (stage?.slaDays) {
        if (days / stage.slaDays >= 1) overSla++;
        else withinSla++;
      }
    }
    return {
      total: records.length,
      avgDays: daysCount > 0 ? Math.round(daysSum / daysCount) : null,
      withinSla,
      overSla,
    };
  }, [records, stages, getStageKey, getStageEnteredAt]);

  // Um registro com N responsáveis conta pra cada um — o atraso é
  // compartilhado, não dividido. Sem responsável cai num balde próprio em vez
  // de sumir da conta.
  const ownerRows = useMemo(() => {
    if (!getOwnerIds || !usersById) return [];
    const byOwner = new Map();
    for (const r of records) {
      const enteredAt = getStageEnteredAt(r);
      if (!enteredAt) continue;
      const stage = stages.find((s) => s.key === getStageKey(r));
      if (!stage?.slaDays) continue;
      const days = daysSince(enteredAt);
      if (days < stage.slaDays) continue;

      const overdue = days - stage.slaDays;
      const ids = (getOwnerIds(r) || []).filter(Boolean);
      for (const id of ids.length > 0 ? ids : [null]) {
        const key = id || "__none__";
        const acc = byOwner.get(key) || { id: key, user: id ? usersById.get(id) : null, count: 0, overdueSum: 0 };
        acc.count++;
        acc.overdueSum += overdue;
        byOwner.set(key, acc);
      }
    }
    return [...byOwner.values()]
      .map((o) => ({ ...o, avgOverdue: Math.round(o.overdueSum / o.count) }))
      .sort((a, b) => b.count - a.count || b.avgOverdue - a.avgOverdue);
  }, [records, stages, getStageKey, getStageEnteredAt, getOwnerIds, usersById]);

  if (records.length === 0) {
    return (
      <div
        className="rounded-2xl border p-8 text-sm text-center"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
      >
        Nenhum registro nos filtros atuais — a análise aparece assim que houver dados.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-4" style={{ color: "var(--text)" }}>
        <TrendingUp size={15} strokeWidth={2} />
        <span className="text-sm font-semibold">Análise</span>
      </div>

      <div className="text-xs font-semibold mb-4" style={{ color: "var(--text-dim)" }}>
        Distribuição por etapa
      </div>
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {stageStats.map(({ stage, count, percent }) => (
          <div key={stage.key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block", flexShrink: 0 }} />
                {stage.name}
              </div>
              <div className="text-xs" style={{ color: "var(--text-dim)" }}>{count}</div>
            </div>
            <div style={{ height: 6, background: "var(--surface-alt)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${percent}%`, background: stage.color, borderRadius: 3, transition: "width 0.4s ease" }} />
            </div>
          </div>
        ))}
      </div>

      <Eyebrow>Genérico</Eyebrow>
      <div className="flex items-stretch gap-3 flex-wrap mb-6">
        <MiniStat label="Total de registros" value={String(generic.total)} />
        <MiniStat label="Dias médios na etapa" value={generic.avgDays !== null ? `${generic.avgDays}d` : "—"} />
        <MiniStat label="Dentro do SLA" value={String(generic.withinSla)} />
        <MiniStat label="Estouraram o SLA" value={String(generic.overSla)} color={generic.overSla > 0 ? "var(--danger)" : undefined} />
      </div>

      {specificStats.length > 0 && (
        <>
          <Eyebrow>Específico</Eyebrow>
          <div className="flex items-stretch gap-3 flex-wrap">
            {specificStats.map((s, i) => (
              <MiniStat key={i} label={s.label} value={s.value} color={s.color} title={s.title} />
            ))}
          </div>
        </>
      )}

      {ownerRows.length > 0 && (
        <div className={specificStats.length > 0 ? "mt-6" : ""}>
          <Eyebrow>Atraso por responsável</Eyebrow>
          <OwnerSlaTable rows={ownerRows} />
        </div>
      )}
    </div>
  );
}

export default KanbanAnalyticsPanel;
