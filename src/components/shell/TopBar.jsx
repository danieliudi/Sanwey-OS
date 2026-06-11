import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

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
  onHelpClick,
}) {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-border-subtle bg-surface-white"
      style={{
        height: 64,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        paddingLeft: isDesktop ? 32 : 16,
        paddingRight: isDesktop ? 32 : 16,
      }}
    >
      {/* Mobile: brand name only — navigation handled by bottom nav */}
      {!isDesktop && (
        <span style={{ fontWeight: 800, fontSize: 18, color: "#b5000b", letterSpacing: "-0.02em" }}>
          Sanwey
        </span>
      )}

      {/* Desktop: search bar */}
      {isDesktop && (
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 border border-border-subtle rounded-lg transition-all duration-150"
          style={{
            padding: "8px 14px",
            background: "#fef1f0",
            color: "#6B7280",
            fontSize: 14,
            width: 360,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#b5000b";
            e.currentTarget.style.background = "#FFFFFF";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(181,0,11,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#E5E7EB";
            e.currentTarget.style.background = "#fef1f0";
            e.currentTarget.style.boxShadow = "none";
          }}
          aria-label="Abrir busca global"
        >
          <Search size={15} style={{ color: "#6B7280", flexShrink: 0 }} />
          <span style={{ color: "#6B7280", flex: 1, textAlign: "left" }}>Buscar lead, empresa, setor...</span>
          <kbd
            className="font-mono font-semibold select-none rounded"
            style={{ fontSize: 11, padding: "1px 6px", background: "#E5E7EB", color: "#6B7280", border: "1px solid #e9bcb6" }}
          >
            ⌘K
          </kbd>
        </button>
      )}

      {/* Right: notifications (+ profile avatar on mobile) */}
      <div className="flex items-center gap-2">
        {!isDesktop && (
          <button
            onClick={onSearchOpen}
            style={{ width: 40, height: 40, background: "transparent", border: "none", color: "#5c5f60", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Buscar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>search</span>
          </button>
        )}
        <div className="flex items-center gap-1">
          {!isDesktop && onHelpClick && (
            <button
              onClick={onHelpClick}
              title="Ajuda e tutoriais"
              style={{ width: 40, height: 40, background: "transparent", border: "none", color: "#5c5f60", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Ajuda"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>help</span>
            </button>
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
    </header>
  );
}

export default TopBar;
