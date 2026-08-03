import React from "react";
import { HelpTooltip } from "./HelpTooltip";

// variant="ruler" — tratamento "eyebrow + número grande" do mockup Focus
// Flutter UI Kit (aprovado 03/08), reservado ao topo do Painel
// (DashboardView.jsx) — o card com ícone continua o padrão em todo o
// resto da plataforma (regra 4 do CLAUDE.md: StatCard não é reescrito
// globalmente por causa de uma tela só).
export function StatCard({ icon: Icon, value, label, sublabel, accent, compact = false, trend, tooltip, valueColor, variant = "card" }) {
  if (variant === "ruler") {
    return (
      <div className="cursor-default">
        <span
          className="block rounded-full"
          style={{ height: 3, width: 34, marginBottom: 10, background: accent || "var(--accent)" }}
        />
        <div
          className="flex items-center gap-1.5 font-bold uppercase"
          style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "var(--text-faint)" }}
        >
          {label}
          <HelpTooltip text={tooltip} />
          {trend !== undefined && (
            <span
              className="font-semibold px-1.5 py-0.5 rounded-full normal-case"
              style={{
                fontSize: 10.5, letterSpacing: "normal",
                background: trend > 0 ? "var(--success-bg)" : trend < 0 ? "var(--danger-bg)" : "var(--surface-alt)",
                color: trend > 0 ? "var(--success)" : trend < 0 ? "var(--danger)" : "var(--text-faint)",
              }}
            >
              {trend > 0 ? "↑" : trend < 0 ? "↓" : "·"} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div
          className="mnum leading-none"
          style={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: 800,
            fontSize: compact ? 26 : 34,
            marginTop: 6,
            letterSpacing: "-0.01em",
            color: valueColor || "var(--text)",
          }}
        >
          {value}
        </div>
        {sublabel && (
          <div className="mt-0.5" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            {sublabel}
          </div>
        )}
      </div>
    );
  }
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
        <HelpTooltip text={tooltip} />
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
