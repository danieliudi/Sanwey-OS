import React from "react";
import { Menu, Search } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";

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
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-20 border-b"
      style={{
        height: 56,
        background: "#FFFFFF",
        borderColor: "#E5E0DA",
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

      {/* Search — hidden on small mobile */}
      <div className="flex-1 max-w-2xl relative hidden sm:block">
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: NEUTRAL.slate,
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder="Busca global em breve — use os filtros de cada tela"
          disabled
          aria-disabled="true"
          className="w-full text-sm rounded-lg border outline-none transition-colors duration-150 cursor-not-allowed"
          style={{
            padding: "8px 12px 8px 36px",
            borderColor: "#E5E0DA",
            background: "#F9F5F1",
            color: NEUTRAL.slate,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#C7212B";
            e.target.style.background = "#FFFFFF";
            e.target.style.boxShadow = "0 0 0 3px rgba(199,33,43,0.10)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#E5E0DA";
            e.target.style.background = "#F9F5F1";
            e.target.style.boxShadow = "none";
          }}
        />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {accessibleCompanies.length > 1 && (
          <div
            className="flex items-center gap-0.5 rounded-lg p-0.5 border"
            style={{ background: "#F9F5F1", borderColor: "#E5E0DA" }}
          >
            {accessibleCompanies.map((id) => {
              const c = COMPANIES[id];
              const active = activeCompany === id;
              return (
                <button
                  key={id}
                  onClick={() => onCompanyChange(id)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
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
        )}

      </div>
    </div>
  );
}

export default TopBar;
