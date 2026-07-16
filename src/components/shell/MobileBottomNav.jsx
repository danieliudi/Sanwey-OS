import React, { useState } from "react";
import {
  CheckSquare, Handshake, Megaphone, Users, Bell, Globe2, Package, DollarSign,
  LayoutDashboard, BriefcaseBusiness, CalendarCheck, Menu as MenuIcon, Settings as SettingsIcon, LogOut,
} from "lucide-react";

// Ícones alinhados com os mesmos ids usados no navGroups do desktop
// (App.jsx) — antes esta barra usava Material Symbols enquanto o resto da
// plataforma usa lucide-react, uma biblioteca visualmente inconsistente
// pra cada mesma seção. Achado da 2ª auditoria.
/* ── Role-aware bottom tab sets ──────────────────────────────── */
const ROLE_TABS = {
  admin: [
    { id: "dashboard",       label: "Minhas Tarefas",       icon: CheckSquare },
    { id: "crm",             label: "CRM",          icon: Handshake },
    { id: "marketing",       label: "Campanhas",    icon: Megaphone },
    { id: "rh-funcionarios", label: "RH",           icon: Users },
  ],
  gerente: [
    { id: "dashboard",          label: "Minhas Tarefas",    icon: CheckSquare },
    { id: "crm",                label: "CRM",       icon: Handshake },
    { id: "signals",            label: "Sinais",    icon: Bell },
    { id: "explorer",           label: "Explorador",icon: Globe2 },
  ],
  gerente_marketing: [
    { id: "dashboard",          label: "Minhas Tarefas",    icon: CheckSquare },
    { id: "marketing",          label: "Campanhas", icon: Megaphone },
    { id: "marketing-entregas", label: "Entregas",  icon: Package },
    { id: "marketing-despesas", label: "Despesas",  icon: DollarSign },
  ],
  marketing: [
    { id: "dashboard",          label: "Minhas Tarefas",    icon: CheckSquare },
    { id: "marketing",          label: "Campanhas", icon: Megaphone },
    { id: "marketing-entregas", label: "Entregas",  icon: Package },
    { id: "marketing-despesas", label: "Despesas",  icon: DollarSign },
  ],
  vendedor: [
    { id: "dashboard",          label: "Minhas Tarefas",    icon: CheckSquare },
    { id: "crm",                label: "CRM",       icon: Handshake },
    { id: "signals",            label: "Sinais",    icon: Bell },
    { id: "explorer",           label: "Explorador",icon: Globe2 },
  ],
  consultor: [
    { id: "dashboard",          label: "Minhas Tarefas",    icon: CheckSquare },
    { id: "crm",                label: "CRM",       icon: Handshake },
    { id: "signals",            label: "Sinais",    icon: Bell },
    { id: "explorer",           label: "Explorador",icon: Globe2 },
  ],
  agencia: [
    { id: "marketing",          label: "Campanhas", icon: Megaphone },
    { id: "marketing-entregas", label: "Entregas",  icon: Package },
  ],
  rh: [
    { id: "rh-overview",     label: "Visão Geral",  icon: LayoutDashboard },
    { id: "rh-funcionarios", label: "Funcionários",  icon: Users },
    { id: "rh-recrutamento", label: "Recrutamento",  icon: BriefcaseBusiness },
    { id: "rh-ferias",       label: "Férias",        icon: CalendarCheck },
  ],
  gerente_rh: [
    { id: "rh-overview",     label: "Visão Geral",  icon: LayoutDashboard },
    { id: "rh-funcionarios", label: "Funcionários",  icon: Users },
    { id: "rh-recrutamento", label: "Recrutamento",  icon: BriefcaseBusiness },
    { id: "rh-ferias",       label: "Férias",        icon: CalendarCheck },
  ],
};

const ROLE_LABELS = {
  admin: "Administrador", gerente: "Gerente", gerente_marketing: "Ger. Marketing",
  marketing: "Marketing", vendedor: "Vendedor", consultor: "Consultor", agencia: "Agência",
  rh: "RH", gerente_rh: "Gerente de RH",
};

// `roles` é o array multi-cargo (FASE 1) — antes só considerava
// `currentUser.role` (o cargo principal, singular), então um usuário com
// RH como cargo ADICIONAL (não principal) nunca via as abas rápidas de RH
// aqui embaixo, só através do menu completo (hambúrguer). Agora junta as
// abas de todo cargo que o usuário acumula, sem repetir id.
function getRoleTabs(roles) {
  const list = Array.isArray(roles) && roles.length ? roles : ["vendedor"];
  const seen = new Set();
  const tabs = [];
  for (const role of list) {
    for (const tab of (ROLE_TABS[role] || [])) {
      if (seen.has(tab.id)) continue;
      seen.add(tab.id);
      tabs.push(tab);
    }
  }
  return tabs.length ? tabs : ROLE_TABS.vendedor;
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
          boxShadow: "var(--shadow-pop)",
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
                    background: active ? "var(--surface-alt)" : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`,
                    cursor: "pointer",
                    fontSize: 15, fontWeight: active ? 700 : 500,
                    color: active ? "var(--accent)" : "#201a1a",
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

        <div style={{ borderTop: "1px solid var(--surface-alt)", margin: "4px 0" }} />

        {/* User info + settings + logout */}
        <div style={{ padding: "12px 20px 0" }}>
          {currentUser && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "var(--accent)",
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
            <SettingsIcon size={20} />
            Configurações
          </button>
          <button
            onClick={() => { onLogout?.(); onClose(); }}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#DC2626", textAlign: "left", fontFamily: "inherit" }}
          >
            <LogOut size={20} />
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
export function MobileBottomNav({ section, onSectionChange, roles, navGroups, currentUser, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = getRoleTabs(roles);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-white border-t border-border-subtle z-30 flex justify-around items-stretch"
        style={{ height: 64 }}
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => onSectionChange(id)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors duration-200"
              style={{
                background: active ? "var(--surface-alt)" : "transparent",
                border: "none",
                color: active ? "var(--accent)" : "#5c5f60",
                cursor: "pointer",
                padding: "4px 0",
                fontFamily: "inherit",
              }}
              aria-label={label}
            >
              <Icon size={24} strokeWidth={active ? 2.3 : 2} />
              {/* whiteSpace/overflow/ellipsis: "Minhas Tarefas" é mais longo que
                  "Início" (unificado com o desktop, achado da 2ª auditoria) —
                  evita quebra feia de linha em telas estreitas. */}
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", padding: "0 2px" }}>
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
          <MenuIcon size={24} />
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
