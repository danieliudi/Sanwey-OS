import React from "react";

// Tab strip em pílulas do drawer de detalhe de card — consolidado de 3 cópias
// quase idênticas (CampaignDetailDrawer.SideTabs, DeliverableDetailDrawer.SideTabs,
// RHDetailDrawerShell.RHSideTabs). Nenhum valor visual mudou nesta extração.
export function DetailDrawerTabs({ tabs, activeId, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map(t => {
        const active = t.id === activeId;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color:      active ? "var(--accent)" : "var(--text-dim)",
              border:     `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >
            {Icon && <Icon size={11} />}
            {t.label}
            {t.badge != null && (
              <span
                className="inline-flex items-center justify-center rounded-full font-bold"
                style={{
                  fontSize: 9, minWidth: 14, height: 14, padding: "0 4px",
                  background: active ? "var(--accent)" : "var(--surface-alt)",
                  color: active ? "#FFF" : "var(--text-dim)",
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default DetailDrawerTabs;
