import React from "react";

/**
 * "Canvas" that the Kanban board's columns sit on top of — gives the board
 * region real depth/framing (background + padding + rounded corners), the
 * way Pipefy's white cards pop against its gray backdrop. Before this
 * existed, columns (var(--surface-alt)) sat directly on the page background
 * (var(--bg)) — only a 4-unit shade difference — so they read as floating
 * loose on the page instead of sitting inside a distinct container.
 *
 * Pilot on 2 boards only (Pipeline/CRMView, Entregas/EntregasView) — see
 * CLAUDE.md before applying this to any other board.
 *
 * Owns:
 *  - the canvas background (var(--surface-alt))
 *  - padding around the column row + rounded corners (same p-5/rounded-2xl
 *    convention as other panel-like containers in this codebase, e.g.
 *    AnalyticsPanel in CRMView.jsx/EntregasView.jsx)
 *  - the right-edge overflow-fade-gradient that hints there are more columns
 *    to scroll to — previously copy-pasted per-board as an absolutely
 *    positioned div. It fades to var(--surface-alt) (this canvas's own
 *    background), not var(--bg)/a hardcoded hex, since that's what's actually
 *    behind the columns now.
 *
 * Does NOT own: the horizontal-scroll behavior or column sizing — the caller
 * still owns `scrollRef` (passed to `useAvailableHeight`) and `height`
 * (`boardHeight`, the same hook's return value), and passes the existing flex
 * row of columns as `children`. This keeps the call site a near-drop-in
 * replacement for the div it used to render inline.
 */
export function KanbanBoardCanvas({ scrollRef, height, children }) {
  return (
    <div
      className="relative rounded-2xl p-5"
      style={{ background: "var(--surface-alt)" }}
    >
      {/* Fade gradient indicating more columns exist to the right — offset
          by the canvas's own p-5 (20px) on top/right so it lines up with the
          scroll content's edges, not the canvas's outer edge; offset by an
          extra 16px (pb-4) at the bottom so it doesn't cover the horizontal
          scrollbar living inside the scroll container. */}
      <div
        className="absolute right-5 top-5 bottom-9 w-16 pointer-events-none z-10"
        style={{ background: "linear-gradient(to left, var(--surface-alt) 0%, transparent 100%)" }}
      />
      <div ref={scrollRef} className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin", height }}>
        {children}
      </div>
    </div>
  );
}

export default KanbanBoardCanvas;
