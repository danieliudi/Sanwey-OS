import React, { useEffect, useState } from "react";
import { LogOut, ChevronDown } from "lucide-react";

const STORAGE_KEY = "sidebar_collapsed_groups";

function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveCollapsed(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

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
  bg:            "var(--surface)",
  border:        "var(--border)",
  text:          "var(--text-dim)",
  textActive:    "var(--accent)",
  textOnSurface: "var(--text)",
  activeBg:      "var(--surface-alt)",
  hoverBg:       "var(--surface-alt)",
  activeStrip:   "var(--accent)",
  groupLabel:    "var(--text-faint)",
};

const ROLE_LABEL = {
  admin:             "Administrador",
  gerente:           "Gerente Comercial",
  vendedor:          "Vendedor",
  consultor:         "Consultor",
  marketing:         "Marketing",
  gerente_marketing: "Gerente de Marketing",
  agencia:           "Agência",
  rh:                "RH",
  gerente_rh:        "Gerente de RH",
};

export function Sidebar({ navGroups, section, onSectionChange, currentUser, onLogout, mobileOpen, onMobileClose, onNewLead }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const handleNavClick = (itemId) => {
    onSectionChange(itemId);
    if (isMobile) onMobileClose?.();
  };

  const toggleGroup = (label) => {
    setCollapsed(prev => {
      const next = { ...prev, [label]: !prev[label] };
      saveCollapsed(next);
      return next;
    });
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
              background: "var(--accent)",
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
            <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 14 }}>Gestão Sanwey</div>
            <div style={{ color: "var(--text-faint)", fontSize: 11 }}>Plataforma integrada</div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 0 8px", scrollbarWidth: "none" }}>
          {navGroups.map((group, gi) => {
            const isCollapsed = group.label ? !!collapsed[group.label] : false;
            return (
              <div key={gi} style={{ marginTop: gi === 0 ? 0 : 8 }}>
                {gi > 0 && group.label && (
                  <div style={{ height: 1, background: "var(--border)", margin: "0 16px 8px" }} />
                )}
                {group.label && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "2px 12px 4px 20px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{
                      color: "var(--text-faint)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}>
                      {group.label}
                    </span>
                    <ChevronDown
                      size={13}
                      strokeWidth={2.5}
                      style={{
                        flexShrink: 0,
                        color: "var(--text-faint)",
                        transition: "transform 0.2s",
                        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>
                )}
                {!isCollapsed && group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={section === item.id}
                    onClick={() => handleNavClick(item.id)}
                  />
                ))}
              </div>
            );
          })}
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
            title="Meu perfil"
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 8px",
              background: section === "settings" ? "var(--surface-alt)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "background 0.12s",
              textAlign: "left",
            }}
            onMouseEnter={e => { if (section !== "settings") e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { if (section !== "settings") e.currentTarget.style.background = "transparent"; }}
          >
            <div
              style={{
                width: 36, height: 36,
                borderRadius: "50%",
                background: currentUser?.avatarUrl ? "transparent" : (currentUser?.avatarBg || "var(--surface-alt)"),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "var(--text-dim)",
                fontSize: 12,
                flexShrink: 0,
                overflow: "hidden",
                border: `2px solid ${section === "settings" ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {currentUser?.avatarUrl
                ? <img src={currentUser.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (currentUser?.initials || "?")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: section === "settings" ? "var(--accent)" : "var(--text)", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser?.name || "Convidado"}
              </div>
              <div style={{ color: "var(--text-faint)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
              color: "var(--text-faint)",
              cursor: "pointer",
              padding: 8,
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--danger)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}
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
        color: active ? "var(--accent)" : hovered ? "var(--text)" : "var(--text-dim)",
        background: active ? "var(--surface-alt)" : hovered ? "var(--surface-alt)" : "transparent",
        border: "none",
        borderRight: active ? "3px solid var(--accent)" : "3px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        whiteSpace: "nowrap",
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
        borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
        marginRight: 4,
      }}
    >
      {Icon && <Icon size={16} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </button>
  );
}

export default Sidebar;
