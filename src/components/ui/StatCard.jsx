import React from "react";
import { NEUTRAL } from "../../constants/companies";

export function StatCard({ icon: Icon, value, label, sublabel, accent, compact = false, trend, tooltip }) {
  return (
    <div
      className="p-5 rounded-xl border transition-all duration-150 hover:shadow-md cursor-default"
      style={{
        background: accent ? accent : "#FFFFFF",
        borderColor: accent ? "transparent" : "#E5E7EB",
        boxShadow: accent ? "none" : "0 1px 4px rgba(32,26,26,0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="rounded-lg flex items-center justify-center"
          style={{
            width: 36, height: 36,
            background: accent ? "rgba(255,255,255,0.15)" : "#F0F2F5",
          }}
        >
          <Icon size={18} color={accent ? "#FFFFFF" : NEUTRAL.graphite} strokeWidth={2} />
        </div>
        {trend !== undefined && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: accent
                ? "rgba(255,255,255,0.15)"
                : (trend > 0 ? "#EDFAF2" : trend < 0 ? "#FFF0F0" : "#F1F3F5"),
              color: accent
                ? (trend > 0 ? "#A3E6B4" : "#FFB8B8")
                : (trend > 0 ? "#1A7A3C" : trend < 0 ? "#B91C1C" : NEUTRAL.slate),
            }}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "·"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div
        className="leading-none mb-1.5"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800,
          fontSize: compact ? 26 : 32,
          color: accent ? "#FFFFFF" : "#201a1a",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        className="font-medium text-sm flex items-center gap-1"
        style={{ color: accent ? "rgba(255,255,255,0.9)" : NEUTRAL.graphite }}
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
          style={{ color: accent ? "rgba(255,255,255,0.65)" : NEUTRAL.slate }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}

export default StatCard;
