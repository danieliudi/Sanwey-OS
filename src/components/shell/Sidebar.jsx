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

const W = 248;

const P = {
  bg:          "#C7212B",
  border:      "rgba(255,255,255,0.12)",
  text:        "rgba(255,255,255,0.72)",
  textBright:  "#FFFFFF",
  textFaint:   "rgba(255,255,255,0.40)",
  hoverBg:     "rgba(0,0,0,0.12)",
  activeBg:    "rgba(0,0,0,0.18)",
  activeStrip: "#FFFFFF",
  avatarRing:  "rgba(255,255,255,0.20)",
};

const ROLE_LABEL = {
  admin:     "Administrador",
  gerente:   "Gerente",
  vendedor:  "Vendedor",
  consultor: "Consultor",
};

export function Sidebar({ navGroups, section, onSectionChange, currentUser, onLogout, mobileOpen, onMobileClose }) {
  const isMobile = useIsMobile();

  const handleNavClick = (itemId) => {
    onSectionChange(itemId);
    if (isMobile) onMobileClose?.();
  };

  const sidebarStyle = isMobile
    ? {
        position: "fixed",
        top: 0, left: 0,
        height: "100vh",
        width: W,
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
        top: 0, left: 0,
        height: "100vh",
        width: W,
        background: P.bg,
        color: P.text,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 40,
      };

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 49 }}
        />
      )}
      <aside style={sidebarStyle}>
        {/* ── Brand ── */}
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 10,
            borderBottom: `1px solid ${P.border}`,
            flexShrink: 0,
          }}
        >
          <img
            src="/sanwey-simbolo.png"
            alt="Sanwey"
            style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0, filter: "brightness(0) invert(1)" }}
          />
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ color: P.textBright, fontWeight: 700, fontSize: 13 }}>Grupo Sanwey</div>
            <div style={{ color: P.textFaint, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Commercial OS
            </div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 0", scrollbarWidth: "none" }}>
          {navGroups.map((group, gi) => (
            <div key={gi} style={{ marginTop: gi === 0 ? 0 : 6 }}>
              {group.label && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 16px 3px",
                    color: P.textFaint,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    pointerEvents: "none",
                  }}
                >
                  {group.icon && <group.icon size={10} strokeWidth={2.5} />}
                  <span>{group.label}</span>
                </div>
              )}
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={section === item.id}
                  onClick={() => handleNavClick(item.id)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* ── User footer ── */}
        <div
          style={{
            borderTop: `1px solid ${P.border}`,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32, height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.20)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              color: "#FFFFFF",
              fontSize: 11,
              flexShrink: 0,
              boxShadow: `0 0 0 2px ${P.avatarRing}`,
            }}
          >
            {currentUser?.initials || "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: P.textBright, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentUser?.name || "Convidado"}
            </div>
            <div style={{ color: P.textFaint, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.hoverBg; e.currentTarget.style.color = "#FFB0B0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.text; }}
          >
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </aside>
    </>
  );
}

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 16px",
        position: "relative",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active ? P.textBright : P.text,
        background: active ? P.activeBg : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        whiteSpace: "nowrap",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = P.hoverBg; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0, top: 5, bottom: 5,
            width: 3,
            borderRadius: "0 3px 3px 0",
            background: P.activeStrip,
          }}
        />
      )}
      {Icon && <Icon size={15} strokeWidth={active ? 2.4 : 2} style={{ flexShrink: 0 }} />}
      <span>{label}</span>
    </button>
  );
}

export default Sidebar;
