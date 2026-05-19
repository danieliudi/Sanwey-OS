import React from "react";
import { NEUTRAL } from "../../constants/companies";

export function NavTabs({ items, section, onChange, accent }) {
  return (
    <div
      className="px-4 md:px-6 flex items-center gap-0.5 overflow-x-auto"
      style={{ scrollbarWidth: "none" }}
    >
      {items.map(item => {
        const Icon = item.icon;
        const active = section === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="relative px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 rounded-t-lg cursor-pointer select-none"
            style={{
              color: active ? accent : NEUTRAL.slate,
              background: active ? accent + "08" : "transparent",
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.background = "#0000000A";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = active ? accent + "08" : "transparent";
            }}
          >
            <Icon size={14} strokeWidth={active ? 2.5 : 2} />
            {item.label}
            {active && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm"
                style={{ background: accent }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default NavTabs;
