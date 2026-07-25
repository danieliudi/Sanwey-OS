import React from "react";
import { PanelEmptyState } from "./PanelEmptyState";

// Barra empilhada por etapa + legenda com contagem — recipe já provado 2x
// (StagePipelineBar do Marketing, distribuição por departamento do RH).
// Extraído por gatilho da regra 4 do CLAUDE.md ao entrar a 3ª ocorrência
// (Comercial, docs/design-spec-visao-geral-grau3-zonas.md §2).
// `items[]`: `{ id, name, color, count }`.
export function StageDistributionBar({ items, total, emptyLabel = "Sem dados" }) {
  if (!total) return <PanelEmptyState>{emptyLabel}</PanelEmptyState>;
  const visible = items.filter(i => i.count > 0);
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 14, gap: 1.5 }}>
        {visible.map(i => (
          <div key={i.id} style={{
            width: `${(i.count / total) * 100}%`,
            background: i.color, minWidth: i.count > 0 ? 4 : 0,
            transition: "width 0.4s ease",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
        {visible.map(i => (
          <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: i.color, flexShrink: 0 }} />
            <span style={{ color: "var(--text-dim)" }}>{i.name}</span>
            <span style={{ fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {i.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StageDistributionBar;
