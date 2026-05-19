import React from "react";
import { Search, Bell, HelpCircle, Sparkles } from "lucide-react";
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
}) {
  return (
    <div
      className="flex items-center gap-4 px-6 sticky top-0 z-20 border-b"
      style={{
        height: 56,
        background: "#FFFFFF",
        borderColor: "#E5E7EB",
      }}
    >
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

      {/* Search */}
      <div className="flex-1 max-w-2xl relative">
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
          placeholder="Buscar empresas, leads, oportunidades…"
          className="w-full text-sm rounded-lg border outline-none transition-colors duration-150"
          style={{
            padding: "8px 12px 8px 36px",
            borderColor: "#E5E7EB",
            background: "#F8FAFB",
            color: NEUTRAL.graphite,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#3B82F6";
            e.target.style.background = "#FFFFFF";
            e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#E5E7EB";
            e.target.style.background = "#F8FAFB";
            e.target.style.boxShadow = "none";
          }}
        />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {accessibleCompanies.length > 1 && (
          <div
            className="flex items-center gap-0.5 rounded-lg p-0.5 border"
            style={{ background: "#F3F4F6", borderColor: "#E5E7EB" }}
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

        <IconButton title="Insights" icon={Sparkles} />
        <IconButton title="Ajuda" icon={HelpCircle} />
        <IconButton title="Notificações" icon={Bell} dot />
      </div>
    </div>
  );
}

function IconButton({ icon: Icon, title, dot }) {
  return (
    <button
      title={title}
      className="p-2 rounded-lg transition-colors relative"
      style={{ color: NEUTRAL.slate, background: "transparent" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#F3F4F6";
        e.currentTarget.style.color = NEUTRAL.graphite;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = NEUTRAL.slate;
      }}
    >
      <Icon size={16} strokeWidth={2} />
      {dot && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: 4,
            background: "#EF4444",
            border: "1.5px solid #FFFFFF",
          }}
        />
      )}
    </button>
  );
}

export default TopBar;
