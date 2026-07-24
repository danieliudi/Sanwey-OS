import React from "react";

// Tier 2 empty state — vazio DENTRO de um painel que já tem borda própria
// (diferente de `ui/EmptyState.jsx`, dimensionado pra vazio de página/view
// inteira). 3ª ocorrência confirmada antes desta extração: Marketing,
// RHOverviewView, `{empty}` do TaskBucket do Comercial.
export function PanelEmptyState({ children }) {
  return (
    <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 12, padding: "20px 0" }}>
      {children}
    </div>
  );
}

export default PanelEmptyState;
