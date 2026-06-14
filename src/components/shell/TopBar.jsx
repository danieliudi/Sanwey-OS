import React, { useEffect, useState } from "react";
import { Search, Moon, Sun } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("ds-theme");
    return saved === "dark";
  });

  const toggle = () => {
    setDark(prev => {
      const next = !prev;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      localStorage.setItem("ds-theme", next ? "dark" : "light");
      return next;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem("ds-theme");
    if (saved === "dark") document.documentElement.dataset.theme = "dark";
  }, []);

  return { dark, toggle };
}

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
  const { dark, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between"
      style={{
        height: 64,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        paddingLeft: isDesktop ? 32 : 16,
        paddingRight: isDesktop ? 32 : 16,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Mobile: brand name */}
      {!isDesktop && (
        <span style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", letterSpacing: "-0.02em" }}>
          sanweyERP
        </span>
      )}

      {/* Desktop: search bar */}
      {isDesktop && (
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 border rounded-sm transition-all duration-150"
          style={{
            padding: "8px 14px",
            background: "var(--surface-alt)",
            borderColor: "var(--border)",
            color: "var(--text-faint)",
            fontSize: 14,
            width: 360,
            cursor: "pointer",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.background = "var(--surface)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--surface-alt)";
          }}
          aria-label="Abrir busca global"
        >
          <Search size={15} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
          <span style={{ color: "var(--text-faint)", flex: 1, textAlign: "left" }}>
            Buscar lead, campanha, funcionário...
          </span>
          <kbd
            className="font-mono font-semibold select-none rounded-sm"
            style={{
              fontSize: 11,
              padding: "1px 6px",
              background: "var(--surface-alt)",
              color: "var(--text-faint)",
              border: "1px solid var(--border-strong)",
            }}
          >
            ⌘K
          </kbd>
        </button>
      )}

      {/* Right: theme toggle + notifications */}
      <div className="flex items-center gap-1">
        {!isDesktop && (
          <button
            onClick={onSearchOpen}
            style={{ width: 40, height: 40, background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Buscar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>search</span>
          </button>
        )}

        {!isDesktop && onHelpClick && (
          <button
            onClick={onHelpClick}
            title="Ajuda e tutoriais"
            style={{ width: 40, height: 40, background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Ajuda"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>help</span>
          </button>
        )}

        <button
          onClick={toggleTheme}
          title={dark ? "Modo claro" : "Modo escuro"}
          style={{ width: 36, height: 36, background: "transparent", border: "none", color: "var(--text-faint)", cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s, color 0.12s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}
          aria-label="Alternar tema"
        >
          {dark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </button>

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
    </header>
  );
}

export default TopBar;
