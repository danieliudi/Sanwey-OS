import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Eyebrow } from "./PanelHeading";
import { daysSince } from "../../utils/date";

// Consolida as 3 cópias quase idênticas de `AnalyticsPanel` que existiam em
// CRMView/MarketingView/EntregasView (docs/design-spec-analise-generica-kanbans.md
// §1.2). "Distribuição por etapa" reproduz o mesmo visual que já existia
// (barra + legenda, por etapa individual — não é o `StageDistributionBar`,
// que é a versão empilhada de resumo executivo das 3 Visões Gerais). As
// linhas "Genérico"/"Específico" são novas (mockup aprovado com o Daniel,
// layout em 2 linhas, nunca misturadas).
function MiniStat({ label, value, color }) {
  return (
    <div
      className="rounded-xl border"
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

export function KanbanAnalyticsPanel({ stages, records, getStageKey, getStageEnteredAt, specificStats = [] }) {
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
              <MiniStat key={i} label={s.label} value={s.value} color={s.color} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default KanbanAnalyticsPanel;
