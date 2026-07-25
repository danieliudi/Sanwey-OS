import React from "react";
import { PanelEmptyState } from "./PanelEmptyState";

// Bucket de tarefa/alerta — extraído de `DashboardView.jsx` (Comercial) por
// gatilho da regra 4 do CLAUDE.md: com esta migração, Marketing e RH passam
// a usar o mesmo recipe (4ª+ ocorrência real, já passou do limite de 3).
// `items[]`: `{ key, primary, secondary, badge, badgeTone?, onClick }`.
export function TaskBucket({ icon: Icon, tone, title, empty, items }) {
  return (
    <div
      className="border"
      style={{ background: "var(--surface)", borderColor: "var(--border)", borderRadius: "var(--radius-lg)" }}
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
        <div className="text-[13px] font-semibold" style={{ color: "var(--text)", letterSpacing: "0.01em" }}>
          {title}
        </div>
        <div className="ml-auto text-xs font-semibold" style={{ color: tone }}>
          {items.length}
        </div>
      </div>
      <div className="p-1.5">
        {items.length === 0 ? (
          <PanelEmptyState>{empty}</PanelEmptyState>
        ) : (
          items.map(it => (
            <button
              key={it.key}
              onClick={it.onClick}
              className="w-full text-left flex items-start gap-2 px-2.5 py-2 rounded-lg transition-colors duration-150"
              style={{ background: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span
                className="mt-1.5 shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: tone }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {it.primary}
                </div>
                <div className="text-xs truncate" style={{ color: "var(--text-dim)" }}>
                  {it.secondary}
                </div>
              </div>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: (it.badgeTone || tone) + "14", color: it.badgeTone || tone }}
              >
                {it.badge}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default TaskBucket;
