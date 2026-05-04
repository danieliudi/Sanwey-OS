import React from "react";

// ── Config de classificação ABCD ──────────────────────────────────────────
export const CLASSIFICATION_CONFIG = {
  A: { label: "A", description: "Pedidos colocados", color: "#1A6E35", bg: "#E8F2EC", border: "#B7DFBF" },
  B: { label: "B", description: "Projeto concluído / Orçamento", color: "#1E4D8C", bg: "#EBF0F9", border: "#B3C5E8" },
  C: { label: "C", description: "Visita / Contato", color: "#C2410C", bg: "#FEF3EC", border: "#F9C09A" },
  D: { label: "D", description: "Desenvolvimento novo", color: "#6B21A8", bg: "#F5F0FB", border: "#D4B8F0" },
  X: { label: "X", description: "Inativo", color: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB" },
};

export const CLASSIFICATION_OPTIONS = [
  { value: "",  label: "Sem classificação" },
  { value: "A", label: "A — Pedidos colocados" },
  { value: "B", label: "B — Projeto / Orçamento" },
  { value: "C", label: "C — Visita / Contato" },
  { value: "D", label: "D — Desenvolvimento novo" },
  { value: "X", label: "X — Inativo" },
];

/**
 * Badge compacto de classificação ABCD.
 * size: "sm" (kanban card) | "md" (default, drawer/tabela)
 */
export function ClassificationBadge({ classification, orderCount, size = "md" }) {
  if (!classification) return null;

  const cfg = CLASSIFICATION_CONFIG[classification];
  if (!cfg) return null;

  const label = classification === "A" && orderCount > 0
    ? `A-${orderCount}`
    : classification;

  const isSm = size === "sm";

  return (
    <span
      className="inline-flex items-center font-bold rounded-sm border"
      style={{
        background: cfg.bg,
        color: cfg.color,
        borderColor: cfg.border,
        fontSize: isSm ? "9px" : "11px",
        padding: isSm ? "1px 5px" : "2px 7px",
        letterSpacing: "0.08em",
        lineHeight: "1.4",
      }}
      title={cfg.description}
    >
      {label}
    </span>
  );
}

export default ClassificationBadge;
