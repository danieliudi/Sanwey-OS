import React from "react";

const TABS = [
  { id: "dashboard", label: "Início",     icon: "home" },
  { id: "crm",       label: "Negócios",   icon: "handshake" },
  { id: "explorer",  label: "Explorador", icon: "explore" },
  { id: "signals",   label: "Sinais",     icon: "monitoring" },
];

export function MobileBottomNav({ section, onSectionChange, onMenuOpen }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-white border-t border-border-subtle z-30 flex justify-around items-stretch"
      style={{ height: 64 }}
    >
      {TABS.map(({ id, label, icon }) => {
        const active = section === id;
        return (
          <button
            key={id}
            onClick={() => onSectionChange(id)}
            className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors duration-200"
            style={{
              background: active ? "#fef1f0" : "transparent",
              border: "none",
              color: active ? "#b5000b" : "#5c5f60",
              cursor: "pointer",
              padding: "4px 0",
              fontFamily: "inherit",
            }}
            aria-label={label}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 24,
                fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {icon}
            </span>
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, lineHeight: 1 }}>
              {label}
            </span>
          </button>
        );
      })}

      {/* More / Menu */}
      <button
        onClick={onMenuOpen}
        className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors duration-200"
        style={{
          background: "transparent",
          border: "none",
          color: "#5c5f60",
          cursor: "pointer",
          padding: "4px 0",
          fontFamily: "inherit",
        }}
        aria-label="Menu"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>grid_view</span>
        <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1 }}>Mais</span>
      </button>
    </nav>
  );
}

export default MobileBottomNav;
