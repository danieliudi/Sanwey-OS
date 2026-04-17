import React from "react";
import { NEUTRAL } from "../../constants/companies";

export function StatCard({ icon: Icon, value, label, sublabel, accent, compact = false, trend }) {
  return (
    <div
      className={`${compact ? "p-4" : "p-5"} rounded-sm border transition-all hover:shadow-md`}
      style={{
        background: accent ? accent : "#FFFFFF",
        borderColor: accent ? accent : "#EFEFEF",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="rounded-sm flex items-center justify-center"
          style={{
            width: compact ? 32 : 36, height: compact ? 32 : 36,
            background: accent ? "rgba(255,255,255,0.12)" : "#F5F5F3",
          }}
        >
          <Icon size={compact ? 16 : 18} color={accent ? "#FFFFFF" : NEUTRAL.graphite} strokeWidth={2} />
        </div>
        {trend !== undefined && (
          <span
            className="text-xs font-semibold"
            style={{
              color: accent
                ? (trend > 0 ? "#A3E6B4" : "#FFB8B8")
                : (trend > 0 ? NEUTRAL.success : trend < 0 ? NEUTRAL.red : NEUTRAL.slate),
            }}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "·"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div
        className="font-bold leading-none mb-1.5"
        style={{
          fontSize: compact ? 22 : 28,
          color: accent ? "#FFFFFF" : NEUTRAL.graphite,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        className="font-semibold"
        style={{
          color: accent ? "rgba(255,255,255,0.95)" : NEUTRAL.graphite,
          fontSize: compact ? 12 : 13,
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div
          className="mt-0.5"
          style={{ color: accent ? "rgba(255,255,255,0.7)" : NEUTRAL.slate, fontSize: 11 }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}

export default StatCard;
