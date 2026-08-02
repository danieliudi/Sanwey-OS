import React from "react";
import { stageTextColor } from "../../utils/stage-colors";

/**
 * Shell of a Kanban board column header — reused across every board
 * (Pipeline, Campanhas, Entregas, Compras, and the RH boards): a colored
 * band on top, the uppercase stage name + card count, and two slots the
 * board itself decides what (if anything) to fill:
 *
 *   - `children` — optional secondary aggregate line under the name/count
 *     row (e.g. money total, SLA figure, or both). Purely a per-board
 *     business decision — Pipeline shows money, Entregas shows SLA,
 *     Campanhas shows both, Compras/Onboarding/Recrutamento show neither.
 *   - `actions`  — the edit-stage / add-card affordance(s) that board
 *     already renders in its header (button, pair of buttons, or a
 *     wrapping div around them). Rendered as-is, no change to their
 *     styling/behavior.
 *
 * This component owns only the repeated container/structure (band height,
 * header padding/border, name truncation, count formatting) — it does not
 * unify what each board actually shows in those slots.
 */
export function KanbanColumnHeader({
  color,
  name,
  count,
  bandHeight = 8,
  letterSpacing = "0.08em",
  truncateName = true,
  actions = null,
  children = null,
  // Props novas (Redesign v2, ver plano do Kanban) — todas opcionais, default
  // = comportamento de sempre, pra não mudar nada nos 7 boards que ainda não
  // passaram por essa revisão (Marketing, Compras de Marketing, RH ×5). Só
  // Funil de Vendas/Entregas/Pós-venda passam os valores "modo Pipefy".
  nameColor = "var(--text)",
  nameFontSize = 11,
  nameFontWeight = 600,
  uppercase = true,
  countFontSize = null,
}) {
  return (
    <>
      {/* Top color band — mais grosso pra dar mais peso visual à identidade
          de cor da etapa. */}
      <div style={{ height: bandHeight, background: color, flexShrink: 0 }} />
      <div
        className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-1.5"
            // stageTextColor aplicado aqui (e não nos 13 chamadores) pra
            // centralizar a decisão 1A; com o default var(--text) o mix
            // resolve pro próprio var(--text), sem mudança visual.
            style={{ color: stageTextColor(nameColor), fontSize: nameFontSize, fontWeight: nameFontWeight, letterSpacing, textTransform: uppercase ? "uppercase" : "none" }}
          >
            {truncateName ? (
              <span
                title={name}
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}
              >
                {name}
              </span>
            ) : (
              name
            )}
            <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0, ...(countFontSize ? { fontSize: countFontSize } : {}) }}>({count})</span>
          </div>
          {children}
        </div>
        {actions}
      </div>
    </>
  );
}
