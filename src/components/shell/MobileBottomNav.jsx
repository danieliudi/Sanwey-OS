import React, { useState } from "react";

/* ── Role-aware bottom tab sets ──────────────────────────────── */
const ROLE_TABS = {
  admin: [
    { id: "dashboard",       label: "Início",       icon: "home" },
    { id: "crm",             label: "CRM",          icon: "handshake" },
    { id: "marketing",       label: "Campanhas",    icon: "campaign" },
    { id: "rh-funcionarios", label: "RH",           icon: "group" },
  ],
  gerente: [
    { id: "dashboard",          label: "Início",    icon: "home" },
    { id: "crm",                label: "CRM",       icon: "handshake" },
    { id: "signals",            label: "Sinais",    icon: "monitoring" },
    { id: "explorer",           label: "Explorador",icon: "explore" },
  ],
  gerente_marketing: [
    { id: "dashboard",          label: "Início",    icon: "home" },
    { id: "marketing",          label: "Campanhas", icon: "campaign" },
    { id: "marketing-entregas", label: "Entregas",  icon: "inventory_2" },
    { id: "marketing-despesas", label: "Despesas",  icon: "payments" },
  ],
  marketing: [
    { id: "dashboard",          label: "Início",    icon: "home" },
    { id: "marketing",          label: "Campanhas", icon: "campaign" },
    { id: "marketing-entregas", label: "Entregas",  icon: "inventory_2" },
    { id: "marketing-despesas", label: "Despesas",  icon: "payments" },
  ],
  vendedor: [
    { id: "dashboard",          label: "Início",    icon: "home" },
    { id: "crm",                label: "CRM",       icon: "handshake" },
    { id: "signals",            label: "Sinais",    icon: "monitoring" },
    { id: "explorer",           label: "Explorador",icon: "explore" },
  ],
  consultor: [
    { id: "dashboard",          label: "Início",    icon: "home" },
    { id: "crm",                label: "CRM",       icon: "handshake" },
    { id: "signals",            label: "Sinais",    icon: "monitoring" },
    { id: "explorer",           label: "Explorador",icon: "explore" },
  ],
  agencia: [
    { id: "marketing",          label: "Campanhas", icon: "campaign" },
    { id: "marketing-entregas", label: "Entregas",  icon: "inventory_2" },
  ],
  rh: [
    { id: "rh-overview",     label: "Visão Geral",  icon: "dashboard" },
    { id: "rh-funcionarios", label: "Funcionários",  icon: "group" },
    { id: "rh-recrutamento", label: "Recrutamento",  icon: "work" },
    { id: "rh-ferias",       label: "Férias",        icon: "beach_access" },
  ],
  gerente_rh: [
    { id: "rh-overview",     label: "Visão Geral",  icon: "dashboard" },
    { id: "rh-funcionarios", label: "Funcionários",  icon: "group" },
    { id: "rh-recrutamento", label: "Recrutamento",  icon: "work" },
    { id: "rh-ferias",       label: "Férias",        icon: "beach_access" },
  ],
};

const ROLE_LABELS = {
  admin: "Administrador", gerente: "Gerente", gerente_marketing: "Ger. Marketing",
  marketing: "Marketing", vendedor: "Vendedor", consultor: "Consultor", agencia: "Agência",
  rh: "RH", gerente_rh: "Gerente de RH",
};

function getRoleTabs(role) {
  return ROLE_TABS[role] || ROLE_TABS.vendedor;
}

/* ── Fullscreen slide-up menu overlay ────────────────────────── */
function MobileMenuOverlay({ navGroups, section, onSectionChange, currentUser, onLogout, onClose }) {
  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 998 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 999,
          background: "#FFFFFF",
          borderRadius: "16px 16px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
          <div style={{ width: 36, height: 4, background: "#E5E7EB", borderRadius: 2 }} />
        </div>

        {/* Nav groups */}
        {(navGroups || []).map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", padding: "12px 20px 4px" }}>
                {group.label}
              </div>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onSectionChange(item.id); onClose(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    width: "100%", padding: "13px 20px",
                    background: active ? "#fef1f0" : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${active ? "#b5000b" : "transparent"}`,
                    cursor: "pointer",
                    fontSize: 15, fontWeight: active ? 700 : 500,
                    color: active ? "#b5000b" : "#201a1a",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <Icon size={20} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}

        <div style={{ borderTop: "1px solid #F3F4F6", margin: "4px 0" }} />

        {/* User info + settings + logout */}
        <div style={{ padding: "12px 20px 0" }}>
          {currentUser && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "#b5000b",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#FFF", fontWeight: 700, fontSize: 16,
              }}>
                {(currentUser.name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#201a1a", lineHeight: 1.3 }}>{currentUser.name}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>{ROLE_LABELS[currentUser.role] || currentUser.role}</div>
              </div>
            </div>
          )}
          <button
            onClick={() => { onSectionChange("settings"); onClose(); }}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#6B7280", textAlign: "left", fontFamily: "inherit" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
            Configurações
          </button>
          <button
            onClick={() => { onLogout?.(); onClose(); }}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#DC2626", textAlign: "left", fontFamily: "inherit" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
            Sair da conta
          </button>
        </div>

        {/* Safe area — clears the nav bar */}
        <div style={{ height: 80 }} />
      </div>
    </>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export function MobileBottomNav({ section, onSectionChange, role, navGroups, currentUser, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = getRoleTabs(role);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-white border-t border-border-subtle z-30 flex justify-around items-stretch"
        style={{ height: 64 }}
      >
        {tabs.map(({ id, label, icon }) => {
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
                style={{ fontSize: 24, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {icon}
              </span>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, lineHeight: 1 }}>
                {label}
              </span>
            </button>
          );
        })}

        {/* Menu button */}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
          style={{
            background: "transparent", border: "none",
            color: "#5c5f60", cursor: "pointer",
            padding: "4px 0", fontFamily: "inherit",
          }}
          aria-label="Menu"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>menu</span>
          <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1 }}>Menu</span>
        </button>
      </nav>

      {menuOpen && (
        <MobileMenuOverlay
          navGroups={navGroups}
          section={section}
          onSectionChange={onSectionChange}
          currentUser={currentUser}
          onLogout={onLogout}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}

export default MobileBottomNav;
