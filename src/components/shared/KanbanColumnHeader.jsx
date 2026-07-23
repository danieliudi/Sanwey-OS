import React from "react";

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
            className="font-semibold flex items-center gap-1.5"
            style={{ color: "var(--text)", fontSize: 11, letterSpacing, textTransform: "uppercase" }}
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
            <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0 }}>({count})</span>
          </div>
          {children}
        </div>
        {actions}
      </div>
    </>
  );
}
