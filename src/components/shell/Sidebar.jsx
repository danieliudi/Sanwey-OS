import React, { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

const W_COLLAPSED = 52;
const W_EXPANDED  = 248;

const P = {
  bg:          "#2C2C2B",
  border:      "rgba(249,245,241,0.08)",
  text:        "rgba(249,245,241,0.65)",
  textBright:  "#F9F5F1",
  textFaint:   "rgba(249,245,241,0.35)",
  hoverBg:     "rgba(249,245,241,0.06)",
  activeBg:    "rgba(249,245,241,0.06)",
  activeStrip: "#C7212B",
  avatarRing:  "rgba(249,245,241,0.12)",
};

const ROLE_LABEL = { admin: "Administrador", gerente: "Gerente", vendedor: "Vendedor" };

export function Sidebar({ navGroups, section, onSectionChange, currentUser, onLogout, mobileOpen, onMobileClose }) {
  const [hovered, setHovered] = useState(false);
  const isMobile = useIsMobile();

  const expanded = isMobile ? (mobileOpen ?? false) : hovered;

  const sidebarStyle = isMobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: W_EXPANDED,
        background: P.bg,
        color: P.text,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 50,
        transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s cubic-bezier(.4,0,.2,1)",
      }
    : {
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: expanded ? W_EXPANDED : W_COLLAPSED,
        background: P.bg,
        color: P.text,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 40,
        transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
      };

  const handleNavClick = (itemId) => {
    onSectionChange(itemId);
    if (isMobile) onMobileClose?.();
  };

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 49,
          }}
        />
      )}
      <aside
        style={sidebarStyle}
        onMouseEnter={!isMobile ? () => setHovered(true) : undefined}
        onMouseLeave={!isMobile ? () => setHovered(false) : undefined}
      >
      {/* ── Brand ── */}
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 10,
          borderBottom: `1px solid ${P.border}`,
          flexShrink: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <img
          src="/sanwey-simbolo.png"
          alt="Sanwey"
          style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }}
        />
        <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.18s ease", lineHeight: 1.25 }}>
          <div style={{ color: P.textBright, fontWeight: 700, fontSize: 13 }}>Grupo Sanwey</div>
          <div style={{ color: P.textFaint, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Commercial OS
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 0", scrollbarWidth: "none" }}>
        {navGroups.map((group, gi) => (
          <div key={gi} style={{ marginTop: gi === 0 ? 0 : 8 }}>
            {group.label && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 14px",
                  color: P.textFaint,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  overflow: "hidden",
                  maxHeight: expanded ? 28 : 0,
                  marginBottom: expanded ? 4 : 0,
                  opacity: expanded ? 1 : 0,
                  transition: "opacity 0.15s ease, max-height 0.2s ease, margin-bottom 0.2s ease",
                }}
              >
                {group.icon && <group.icon size={11} strokeWidth={2.5} />}
                <span>{group.label}</span>
              </div>
            )}
            {group.items.map((item) => {
              const active = section === item.id;
              return (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={active}
                  expanded={expanded}
                  onClick={() => handleNavClick(item.id)}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div
        style={{
          borderTop: `1px solid ${P.border}`,
          padding: "10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: currentUser?.avatarBg || P.activeStrip,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "#FFFFFF",
            fontSize: 11,
            letterSpacing: "0.02em",
            flexShrink: 0,
            boxShadow: `0 0 0 2px ${P.avatarRing}`,
          }}
        >
          {currentUser?.initials || "?"}
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
        >
          <div style={{ color: P.textBright, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentUser?.name || "Convidado"}
          </div>
          <div style={{ color: P.textFaint, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis" }}>
            {ROLE_LABEL[currentUser?.role] || "—"}
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Sair"
          style={{
            background: "transparent",
            border: "none",
            color: P.text,
            cursor: "pointer",
            padding: 6,
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.15s ease",
            pointerEvents: expanded ? "auto" : "none",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = P.hoverBg; e.currentTarget.style.color = "#FCA5A5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.text; }}
        >
          <LogOut size={14} strokeWidth={2} />
        </button>
      </div>
      </aside>
    </>
  );
}

function NavItem({ icon: Icon, label, active, expanded, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        position: "relative",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active ? P.textBright : P.text,
        background: active ? P.activeBg : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
        whiteSpace: "nowrap",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = P.hoverBg;
          e.currentTarget.style.color = P.textBright;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = P.text;
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
            background: P.activeStrip,
          }}
        />
      )}
      {Icon && <Icon size={15} strokeWidth={active ? 2.4 : 2} style={{ flexShrink: 0 }} />}
      <span style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.15s ease" }}>
        {label}
      </span>
    </button>
  );
}

export default Sidebar;
