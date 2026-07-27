import React from "react";

export function StatCard({ icon: Icon, value, label, sublabel, accent, compact = false, trend, tooltip, valueColor }) {
  return (
    <div
      className="p-5 rounded-lg border transition-all duration-150 hover:shadow-md cursor-default"
      style={{
        background: accent || "var(--surface)",
        borderColor: accent ? "transparent" : "var(--border)",
        boxShadow: accent ? "none" : "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="rounded-sm flex items-center justify-center"
          style={{
            width: 36, height: 36,
            background: accent ? "rgba(255,255,255,0.15)" : "var(--surface-alt)",
          }}
        >
          <Icon size={18} style={{ color: accent ? "var(--on-accent)" : "var(--text-dim)" }} strokeWidth={2} />
        </div>
        {trend !== undefined && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: accent
                ? "rgba(255,255,255,0.15)"
                : (trend > 0 ? "var(--success-bg)" : trend < 0 ? "var(--danger-bg)" : "var(--surface-alt)"),
              color: accent
                ? (trend > 0 ? "#A3E6B4" : "#FFB8B8")
                : (trend > 0 ? "var(--success)" : trend < 0 ? "var(--danger)" : "var(--text-faint)"),
            }}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "·"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div
        className="leading-none mb-1.5"
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 800,
          fontSize: compact ? 26 : 32,
          color: accent ? "var(--on-accent)" : (valueColor || "var(--text)"),
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        className="font-medium text-sm flex items-center gap-1"
        style={{ color: accent ? "rgba(255,255,255,0.9)" : "var(--text-dim)" }}
      >
        {label}
        {tooltip && (
          <span title={tooltip} style={{ cursor: "help", opacity: 0.5, display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
          </span>
        )}
      </div>
      {sublabel && (
        <div
          className="text-xs mt-0.5"
          style={{ color: accent ? "rgba(255,255,255,0.65)" : "var(--text-faint)" }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}

export default StatCard;
