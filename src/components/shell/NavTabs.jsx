import React from "react";
import { NEUTRAL } from "../../constants/companies";

export function NavTabs({ items, section, onChange, accent }) {
  return (
    <div className="px-4 md:px-6 flex items-center gap-1 overflow-x-auto">
      {items.map(item => {
        const Icon = item.icon;
        const active = section === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 border-b-2"
            style={{
              color: active ? accent : NEUTRAL.slate,
              borderBottomColor: active ? accent : "transparent",
              letterSpacing: "0.08em",
            }}
          >
            <Icon size={13} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default NavTabs;
