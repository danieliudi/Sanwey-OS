import React from "react";
import { LogOut } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";

const ROLE_LABEL = { admin: "Admin", gerente: "Gerente", vendedor: "Vendedor" };

/**
 * Single-line application header combining company selector + nav tabs + user info.
 * Replaces the old TopBar + NavTabs two-row layout.
 *
 * Layout:
 *   [Logo] [Company pills] | [Nav tabs — flex-1 scrollable] | [User initials + name] [Sair]
 */
export function AppHeader({
  currentUser,
  activeCompany,
  accessibleCompanies,
  onCompanyChange,
  onLogout,
  navItems,
  section,
  onSectionChange,
  accent,
}) {
  const roleLabel = ROLE_LABEL[currentUser?.role] || "Vendedor";

  return (
    <div
      className="px-3 md:px-5 flex items-stretch gap-2 min-w-0"
      style={{ height: 52 }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center shrink-0">
        <Logo size="small" company={activeCompany} />
      </div>

      {/* ── Company pills ────────────────────────────────────────────────── */}
      {accessibleCompanies.length > 1 && (
        <div className="flex items-center shrink-0">
          <div
            className="flex items-center gap-0.5 rounded-xl p-0.5 border"
            style={{ background: "#F5F5F3", borderColor: "#E5E5E5" }}
          >
            {accessibleCompanies.map(id => {
              const c = COMPANIES[id];
              const active = activeCompany === id;
              return (
                <button
                  key={id}
                  onClick={() => onCompanyChange(id)}
                  className="px-2 py-0.5 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer select-none"
                  style={{
                    background: active ? "#FFFFFF" : "transparent",
                    color: active ? NEUTRAL.graphite : NEUTRAL.slate,
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                    border: active ? "1px solid #E5E5E5" : "1px solid transparent",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = active ? "#FFFFFF" : "transparent"; }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c?.primary }} />
                  <span>{c?.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Separator ────────────────────────────────────────────────────── */}
      <div className="flex items-center shrink-0">
        <div className="h-5 w-px" style={{ background: "#E5E5E5" }} />
      </div>

      {/* ── Nav tabs — scrollable, fills remaining space ─────────────────── */}
      <div
        className="flex-1 flex items-stretch overflow-x-auto min-w-0"
        style={{ scrollbarWidth: "none" }}
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className="relative px-2.5 text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-colors duration-150 select-none"
              style={{ color: active ? accent : NEUTRAL.slate }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = NEUTRAL.graphite; }}
              onMouseLeave={e => { e.currentTarget.style.color = active ? accent : NEUTRAL.slate; }}
            >
              <Icon size={13} strokeWidth={active ? 2.5 : 2} />
              {item.label}
              {/* Active underline sits at the very bottom of the header */}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: accent }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Separator ────────────────────────────────────────────────────── */}
      <div className="flex items-center shrink-0">
        <div className="h-5 w-px" style={{ background: "#E5E5E5" }} />
      </div>

      {/* ── User + logout ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
          style={{ background: currentUser?.avatarBg || NEUTRAL.slate }}
        >
          {currentUser?.initials || "?"}
        </div>
        <div className="hidden xl:block">
          <div className="text-xs font-semibold leading-tight" style={{ color: NEUTRAL.graphite }}>
            {currentUser?.name}
          </div>
          <div className="text-[10px]" style={{ color: NEUTRAL.slate }}>
            {roleLabel}
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>
          Sair
        </Button>
      </div>
    </div>
  );
}

export default AppHeader;
