import React, { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { NotificationCenter } from "./NotificationCenter";

/**
 * Slim top bar above the main content. Holds global search and quick-access
 * action icons. The page title is rendered inside each view, not here.
 */
export function TopBar({
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
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <div
      className="flex items-center gap-3 px-4 sticky top-0 z-20 border-b"
      style={{
        height: 56,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "#FFFFFF",
        borderColor: "#E5E7EB",
      }}
    >
      {/* Hamburger — mobile only */}
      {!isDesktop && (
        <button
          onClick={onMenuToggle}
          className="flex items-center justify-center shrink-0 rounded cursor-pointer"
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
      )}

      {title && isDesktop && (
        <div
          className="font-bold shrink-0"
          style={{
            fontSize: 15,
            color: NEUTRAL.graphite,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
      )}

      {/* Search trigger — desktop only */}
      {isDesktop && (
        <div className="flex-1 flex items-center">
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
              className="ml-2 flex items-center gap-0.5 rounded font-mono font-semibold select-none"
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
      )}

      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
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
