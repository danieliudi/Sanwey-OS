import React, { useState, useMemo } from "react";
import {
  Menu as MenuIcon, Settings as SettingsIcon, LogOut,
} from "lucide-react";

// Guarda só os IDS por cargo — label/ícone vêm por lookup do navGroups
// (mesma fonte do Sidebar/menu hambúrguer), nunca redeclarados aqui. Antes
// esta tabela hardcodava label/ícone próprios (ex: "crm" virava "CRM" +
// ícone de aperto de mãos aqui, mas "Pipeline" + ícone de camadas no resto
// do app) — o mesmo destino tinha nome e ícone diferentes conforme o
// controle usado. Achado da auditoria de fricção de 18/07.
/* ── Role-aware bottom tab id sets ──────────────────────────────── */
const ROLE_TAB_IDS = {
  admin:              ["dashboard", "crm", "marketing", "rh-funcionarios"],
  gerente:            ["dashboard", "crm", "signals", "explorer"],
  gerente_marketing:  ["dashboard", "marketing", "marketing-entregas", "marketing-despesas"],
  marketing:          ["dashboard", "marketing", "marketing-entregas", "marketing-despesas"],
  vendedor:           ["dashboard", "crm", "signals", "explorer"],
  consultor:          ["dashboard", "crm", "signals", "explorer"],
  agencia:            ["marketing", "marketing-entregas"],
  rh:                 ["rh-overview", "rh-funcionarios", "rh-recrutamento", "rh-ferias"],
  gerente_rh:         ["rh-overview", "rh-funcionarios", "rh-recrutamento", "rh-ferias"],
};

const ROLE_LABELS = {
  admin: "Administrador", gerente: "Gerente", gerente_marketing: "Ger. Marketing",
  marketing: "Marketing", vendedor: "Vendedor", consultor: "Consultor", agencia: "Agência",
  rh: "RH", gerente_rh: "Gerente de RH",
};

function flattenNavGroups(navGroups) {
  const map = new Map();
  for (const group of (navGroups || [])) {
    for (const item of (group.items || [])) map.set(item.id, item);
  }
  return map;
}

// `roles` é o array multi-cargo (FASE 1) — antes só considerava
// `currentUser.role` (o cargo principal, singular), então um usuário com
// RH como cargo ADICIONAL (não principal) nunca via as abas rápidas de RH
// aqui embaixo, só através do menu completo (hambúrguer). Agora junta as
// abas de todo cargo que o usuário acumula, sem repetir id.
function getRoleTabs(roles, navGroups) {
  const byId = flattenNavGroups(navGroups);
  const list = Array.isArray(roles) && roles.length ? roles : ["vendedor"];
  const seen = new Set();
  const tabs = [];
  for (const role of list) {
    for (const id of (ROLE_TAB_IDS[role] || [])) {
      if (seen.has(id)) continue;
      const item = byId.get(id);
      if (!item) continue;
      seen.add(id);
      tabs.push(item);
    }
  }
  if (tabs.length) return tabs;
  return (ROLE_TAB_IDS.vendedor || []).map(id => byId.get(id)).filter(Boolean);
}

/* ── Fullscreen slide-up menu overlay ────────────────────────── */
function MobileMenuOverlay({ navGroups, section, onSectionChange, currentUser, onLogout, onClose }) {
  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 998 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 999,
          background: "var(--surface)",
          borderRadius: "16px 16px 0 0",
          boxShadow: "var(--shadow-pop)",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
          <div style={{ width: 36, height: 4, background: "var(--border-strong)", borderRadius: 2 }} />
        </div>

        {/* Nav groups */}
        {(navGroups || []).map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "12px 20px 4px" }}>
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
                    color: active ? "var(--accent)" : "var(--text)",
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
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", lineHeight: 1.3 }}>{currentUser.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{ROLE_LABELS[currentUser.role] || currentUser.role}</div>
              </div>
            </div>
          )}
          <button
            onClick={() => { onSectionChange("settings"); onClose(); }}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-dim)", textAlign: "left", fontFamily: "inherit" }}
          >
            <SettingsIcon size={20} />
            Configurações
          </button>
          <button
            onClick={() => { onLogout?.(); onClose(); }}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--danger)", textAlign: "left", fontFamily: "inherit" }}
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
  const tabs = useMemo(() => getRoleTabs(roles, navGroups), [roles, navGroups]);

  return (
    <>
      {/* Breakpoint precisa bater com o wrapper "lg:hidden" em App.jsx e
          com o useIsMobile (width<1024) do Sidebar/TopBar — achado da
          auditoria mobile: era "md:hidden" (768px), mais restritivo que o
          wrapper, então entre 768-1023px nem esta nav nem a Sidebar (que já
          está em modo drawer nessa faixa) apareciam — nenhuma navegação. */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex justify-around items-stretch"
        style={{ height: 64, background: "var(--surface)", borderTop: "1px solid var(--border)" }}
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
                color: active ? "var(--accent)" : "var(--text-dim)",
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
            color: "var(--text-dim)", cursor: "pointer",
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
