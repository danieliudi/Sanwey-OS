import React from "react";
import { Menu, Search } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { NotificationCenter } from "./NotificationCenter";

/**
 * Slim top bar above the main content. Holds global search, the company
 * scope switcher and quick-access action icons. The page title is rendered
 * inside each view, not here — this bar stays visually consistent across
 * sections.
 */
export function TopBar({
  activeCompany,
  accessibleCompanies,
  onCompanyChange,
  title,
  onMenuToggle,
  onSearchOpen,
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onClearAll,
  desktopPermission,
  onRequestDesktopPermission,
  onSelectLead,
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-20 border-b overflow-x-hidden"
      style={{
        height: 56,
        background: "#FFFFFF",
        borderColor: "#E5E7EB",
      }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center shrink-0 rounded cursor-pointer"
        style={{
          width: 36,
          height: 36,
          background: "transparent",
          border: "none",
          color: NEUTRAL.graphite,
        }}
        aria-label="Abrir menu"
      >
        <Menu size={20} strokeWidth={2} />
      </button>

      {title && (
        <div
          className="hidden lg:block font-bold shrink-0"
          style={{
            fontSize: 15,
            color: NEUTRAL.graphite,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
      )}

      {/* Search trigger — hidden on mobile, shows Cmd+K hint on desktop */}
      <div className="flex-1 hidden sm:flex items-center">
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 rounded-lg border transition-colors duration-150 cursor-pointer"
          style={{
            padding: "7px 12px",
            borderColor: "#E5E7EB",
            background: "#F8F9FA",
            color: NEUTRAL.slate,
            fontSize: 13,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#C7212B";
            e.currentTarget.style.background = "#FFFFFF";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(199,33,43,0.10)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#E5E7EB";
            e.currentTarget.style.background = "#F8F9FA";
            e.currentTarget.style.boxShadow = "none";
          }}
          aria-label="Abrir busca global"
        >
          <Search size={13} style={{ color: NEUTRAL.slate, flexShrink: 0 }} />
          <span style={{ color: NEUTRAL.slate }}>Buscar lead, empresa, setor...</span>
          <kbd
            className="ml-2 hidden lg:flex items-center gap-0.5 rounded font-mono font-semibold select-none"
            style={{
              fontSize: 11,
              padding: "1px 5px",
              background: "#EFEFEF",
              color: NEUTRAL.slate,
              border: "1px solid #E5E0DA",
            }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        {accessibleCompanies.length > 1 && (
          <>
            {/* Mobile: compact native selector — avoids all pills overflowing the viewport */}
            <div className="flex lg:hidden shrink-0">
              <select
                value={activeCompany}
                onChange={(e) => onCompanyChange(e.target.value)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: NEUTRAL.graphite,
                  background: "#F8F9FA",
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                  padding: "4px 24px 4px 8px",
                  appearance: "none",
                  WebkitAppearance: "none",
                  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8680' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 6px center",
                  backgroundSize: "11px",
                  cursor: "pointer",
                  maxWidth: 110,
                }}
              >
                {accessibleCompanies.map((id) => (
                  <option key={id} value={id}>{COMPANIES[id]?.short}</option>
                ))}
              </select>
            </div>
            {/* Desktop: full pill row */}
            <div className="hidden lg:flex items-center gap-0.5 rounded-lg p-0.5 border" style={{ background: "#F8F9FA", borderColor: "#E5E7EB" }}>
              {accessibleCompanies.map((id) => {
                const c = COMPANIES[id];
                const active = activeCompany === id;
                return (
                  <button
                    key={id}
                    onClick={() => onCompanyChange(id)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 flex items-center gap-1.5 cursor-pointer shrink-0"
                    style={{
                      background: active ? "#FFFFFF" : "transparent",
                      color: active ? NEUTRAL.graphite : NEUTRAL.slate,
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = active ? "#FFFFFF" : "transparent";
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: c?.primary }}
                    />
                    {c?.short}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <NotificationCenter
          notifications={notifications || []}
          unreadCount={unreadCount || 0}
          onMarkAllRead={onMarkAllRead}
          onMarkRead={onMarkRead}
          onClearAll={onClearAll}
          desktopPermission={desktopPermission}
          onRequestDesktopPermission={onRequestDesktopPermission}
          onSelectLead={onSelectLead}
        />
      </div>
    </div>
  );
}

export default TopBar;
