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

const SIDEBAR_W = 288;

const T = {
  bg:          "#FFFFFF",
  border:      "#E5E7EB",
  text:        "#5c5f60",
  textActive:  "#b5000b",
  textOnSurface: "#201a1a",
  activeBg:    "#fef1f0",
  hoverBg:     "#f2e5e5",
  activeStrip: "#b5000b",
  groupLabel:  "#936e69",
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

  const sidebarStyle = {
    position: "fixed",
    top: 0, left: 0,
    height: "100vh",
    width: SIDEBAR_W,
    background: T.bg,
    borderRight: `1px solid ${T.border}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: isMobile ? 50 : 40,
    ...(isMobile && {
      transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
      transition: "transform 0.25s cubic-bezier(.4,0,.2,1)",
    }),
  };

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 49 }}
        />
      )}
      <aside style={sidebarStyle}>
        {/* ── Brand ── */}
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 12,
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#b5000b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <img
              src="/sanwey-simbolo.png"
              alt="Sanwey"
              style={{ width: 20, height: 20, objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ color: "#201a1a", fontWeight: 700, fontSize: 14 }}>Grupo Sanwey</div>
            <div style={{ color: T.text, fontSize: 11 }}>Commercial Intelligence</div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ padding: "16px 16px 8px" }}>
          <button
            onClick={() => handleNavClick("crm")}
            style={{
              width: "100%",
              height: 44,
              background: "#e30613",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              transition: "filter 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.92)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
            Novo Negócio
          </button>
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 0 8px", scrollbarWidth: "none" }}>
          {navGroups.map((group, gi) => (
            <div key={gi} style={{ marginTop: gi === 0 ? 0 : 4 }}>
              {group.label && (
                <div
                  style={{
                    padding: "8px 20px 4px",
                    color: T.groupLabel,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    pointerEvents: "none",
                  }}
                >
                  {group.label}
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
            borderTop: `1px solid ${T.border}`,
            padding: "8px 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => handleNavClick("settings")}
            title="Configurações do perfil"
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 8px",
              background: section === "settings" ? T.activeBg : "transparent",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              transition: "background 0.12s",
              textAlign: "left",
            }}
            onMouseEnter={e => { if (section !== "settings") e.currentTarget.style.background = T.hoverBg; }}
            onMouseLeave={e => { if (section !== "settings") e.currentTarget.style.background = "transparent"; }}
          >
            <div
              style={{
                width: 36, height: 36,
                borderRadius: "50%",
                background: currentUser?.avatarUrl ? "transparent" : (currentUser?.avatarBg || "#b5000b"),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "#FFFFFF",
                fontSize: 12,
                flexShrink: 0,
                overflow: "hidden",
                border: `2px solid ${section === "settings" ? "#b5000b" : "#E5E7EB"}`,
              }}
            >
              {currentUser?.avatarUrl
                ? <img src={currentUser.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (currentUser?.initials || "?")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: section === "settings" ? "#b5000b" : "#201a1a", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser?.name || "Convidado"}
              </div>
              <div style={{ color: T.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ROLE_LABEL[currentUser?.role] || "—"}
              </div>
            </div>
          </button>
          <button
            onClick={onLogout}
            title="Sair"
            style={{
              background: "transparent",
              border: "none",
              color: T.text,
              cursor: "pointer",
              padding: 8,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fef1f0"; e.currentTarget.style.color = "#b5000b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.text; }}
          >
            <LogOut size={15} strokeWidth={2} />
          </button>
        </div>
      </aside>
    </>
  );
}

function NavItem({ icon: Icon, label, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
        height: 44,
        position: "relative",
        fontSize: 14,
        fontFamily: "inherit",
        fontWeight: active ? 700 : 500,
        color: active ? T.textActive : hovered ? T.textOnSurface : T.text,
        background: active ? T.activeBg : hovered ? "#f2e5e5" : "transparent",
        border: "none",
        borderRight: active ? "4px solid #b5000b" : "4px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        whiteSpace: "nowrap",
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
        borderRadius: "0 8px 8px 0",
        marginRight: 4,
      }}
    >
      {Icon && <Icon size={16} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </button>
  );
}

export default Sidebar;
