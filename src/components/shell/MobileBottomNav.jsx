import React from "react";
import { Home, LayoutKanban, Compass, Activity, Grid3x3 } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Início",     Icon: Home },
  { id: "crm",       label: "Negócios",   Icon: LayoutKanban },
  { id: "explorer",  label: "Explorador", Icon: Compass },
  { id: "signals",   label: "Sinais",     Icon: Activity },
];

const ACTIVE_COLOR   = "#C7212B";
const INACTIVE_COLOR = "#8A8680";

export function MobileBottomNav({ section, onSectionChange, onMenuOpen }) {
  return (
    <div
      className="lg:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        zIndex: 30,
        background: "#FFFFFF",
        borderTop: "1px solid #E5E7EB",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = section === id;
        const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
        return (
          <button
            key={id}
            onClick={() => onSectionChange(id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color,
            }}
            aria-label={label}
          >
            <Icon size={20} strokeWidth={2} color={color} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                marginTop: 2,
                color,
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}

      {/* Menu tab — always calls onMenuOpen, never active */}
      <button
        onClick={onMenuOpen}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          color: INACTIVE_COLOR,
        }}
        aria-label="Menu"
      >
        <Grid3x3 size={20} strokeWidth={2} color={INACTIVE_COLOR} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            marginTop: 2,
            color: INACTIVE_COLOR,
            lineHeight: 1,
          }}
        >
          Menu
        </span>
      </button>
    </div>
  );
}

export default MobileBottomNav;
