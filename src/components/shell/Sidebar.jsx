import React from "react";
import { ChevronRight, LogOut } from "lucide-react";

const PALETTE = {
  bg: "#0B1E3F",
  bgHover: "#162D55",
  bgActive: "#1F3A6B",
  border: "rgba(255,255,255,0.06)",
  textDim: "#A1ADC6",
  textMuted: "#7889A6",
  textBright: "#FFFFFF",
  accent: "#4F8EF7",
};

const ROLE_LABEL = { admin: "Administrador", gerente: "Gerente", vendedor: "Vendedor" };

/**
 * Persistent left navigation. Groups related screens under labelled sections,
 * keeps the active item visually anchored with a thin accent strip, and tucks
 * the user identity + logout into a fixed footer so they're always reachable.
 */
export function Sidebar({ navGroups, section, onSectionChange, currentUser, onLogout }) {
  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 232,
        background: PALETTE.bg,
        color: PALETTE.textDim,
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
      }}
    >
      {/* ── Brand ── */}
      <div
        className="flex items-center gap-2.5 px-4 shrink-0"
        style={{ height: 56, borderBottom: `1px solid ${PALETTE.border}` }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "linear-gradient(135deg, #2D9B52 0%, #1A6E35 60%, #0F4A23 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFF",
            fontWeight: 800,
            fontSize: 14,
            boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          }}
        >
          S
        </div>
        <div className="leading-tight min-w-0">
          <div className="truncate" style={{ color: PALETTE.textBright, fontWeight: 700, fontSize: 13 }}>
            Grupo Sanwey
          </div>
          <div
            style={{
              color: PALETTE.textMuted,
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Commercial OS
          </div>
        </div>
      </div>

      {/* ── Nav groups ── */}
      <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: "thin" }}>
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi === 0 ? "" : "mt-3"}>
            {group.label && (
              <div
                className="flex items-center gap-1.5 px-4 mb-1.5"
                style={{
                  color: PALETTE.textMuted,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                {group.icon && <group.icon size={11} strokeWidth={2.5} />}
                <span>{group.label}</span>
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className="w-full flex items-center gap-2.5 text-left transition-colors duration-150 relative"
                  style={{
                    padding: "8px 16px 8px 20px",
                    fontSize: 13,
                    color: active ? PALETTE.textBright : PALETTE.textDim,
                    background: active ? PALETTE.bgActive : "transparent",
                    fontWeight: active ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = PALETTE.bgHover;
                      e.currentTarget.style.color = PALETTE.textBright;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = PALETTE.textDim;
                    }
                  }}
                >
                  {active && (
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 6,
                        bottom: 6,
                        width: 3,
                        borderRadius: "0 3px 3px 0",
                        background: PALETTE.accent,
                      }}
                    />
                  )}
                  {Icon && <Icon size={15} strokeWidth={active ? 2.4 : 2} />}
                  <span className="truncate flex-1">{item.label}</span>
                  {active && <ChevronRight size={12} strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div
        className="px-3 py-3 flex items-center gap-2.5 shrink-0"
        style={{ borderTop: `1px solid ${PALETTE.border}` }}
      >
        <div
          className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
          style={{
            width: 32,
            height: 32,
            background: currentUser?.avatarBg || PALETTE.accent,
            fontSize: 11,
            letterSpacing: "0.02em",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.08)",
          }}
        >
          {currentUser?.initials || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="truncate"
            style={{ color: PALETTE.textBright, fontSize: 12, fontWeight: 600 }}
          >
            {currentUser?.name || "Convidado"}
          </div>
          <div className="truncate" style={{ color: PALETTE.textMuted, fontSize: 10 }}>
            {ROLE_LABEL[currentUser?.role] || "—"}
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Sair"
          className="p-2 rounded-md transition-colors shrink-0"
          style={{ color: PALETTE.textDim, background: "transparent" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = PALETTE.bgHover;
            e.currentTarget.style.color = "#FCA5A5";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = PALETTE.textDim;
          }}
        >
          <LogOut size={14} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
