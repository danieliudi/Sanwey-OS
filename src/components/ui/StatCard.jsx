import React from "react";
import { HelpTooltip } from "./HelpTooltip";

// variant="ruler" — tratamento "eyebrow + número grande" do mockup Focus
// Flutter UI Kit (aprovado 03/08), reservado ao topo do Painel
// (DashboardView.jsx) — o card com ícone continua o padrão em todo o
// resto da plataforma (regra 4 do CLAUDE.md: StatCard não é reescrito
// globalmente por causa de uma tela só).
// dense — modo compacto de mobile, aprovado 10/08/2026 (revalidação a 360px).
// NÃO confundir com `compact`, que só reduz a fonte do número e continua
// valendo no desktop. `dense` é responsivo por CSS: abaixo de md encolhe
// padding/ícone/número e esconde o sublabel (que vira `title` no ícone);
// a partir de md o card volta a ser exatamente o de hoje. É CSS puro de
// propósito — sem listener de resize, sem piscar na primeira renderização.
// O corte é em md (768px), não lg, pra casar com o breakpoint de coluna que
// as telas já usavam — em lg, tablet retrato ficaria com card denso numa
// coluna larguíssima, e o StatCardGrid esconderia cards que antes apareciam.
export function StatCard({ icon: Icon, value, label, sublabel, accent, compact = false, dense = false, trend, tooltip, valueColor, variant = "card" }) {
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
      className={`${dense ? "h-full p-2.5 md:p-5" : "p-5"} rounded-lg border cursor-default${accent ? "" : " polish-stat-card"}`}
      style={{
        background: accent || "var(--surface)",
        borderColor: accent ? "transparent" : "var(--border)",
        boxShadow: accent ? "none" : "var(--shadow-card)",
        transition: "box-shadow var(--motion-base) var(--ease-out), transform var(--motion-fast) var(--ease-out)",
      }}
    >
      <div className={`flex items-center justify-between ${dense ? "mb-2 md:mb-4" : "mb-4"}`}>
        <div
          className={`${dense ? "w-5 h-5 md:w-9 md:h-9" : "w-9 h-9"} rounded-sm flex items-center justify-center shrink-0`}
          title={dense && sublabel ? sublabel : undefined}
          style={{ background: accent ? "rgba(255,255,255,0.15)" : "var(--surface-alt)" }}
        >
          <Icon
            className={dense ? "w-3 h-3 md:w-[18px] md:h-[18px]" : "w-[18px] h-[18px]"}
            style={{ color: accent ? "var(--on-accent)" : "var(--text-dim)" }}
            strokeWidth={2}
          />
        </div>
        {trend !== undefined && (
          <span
            className={`${dense ? "text-[9.5px] px-1.5 md:text-xs md:px-2" : "text-xs px-2"} font-semibold py-0.5 rounded-full`}
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
        className={`leading-none ${dense ? "mb-1 md:mb-1.5" : "mb-1.5"} ${
          dense
            ? (compact ? "text-[18px] md:text-[26px]" : "text-[18px] md:text-[32px]")
            : (compact ? "text-[26px]" : "text-[32px]")
        }`}
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 800,
          // só no denso: fora dele mudaria a renderização dos dígitos nos ~56
          // usos existentes de StatCard, o que é mudança visual sem mockup.
          ...(dense ? { fontVariantNumeric: "tabular-nums" } : {}),
          color: accent ? "var(--on-accent)" : (valueColor || "var(--text)"),
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        className={`font-medium ${dense ? "text-[11px] leading-tight md:text-sm" : "text-sm"} flex items-center gap-1`}
        style={{ color: accent ? "rgba(255,255,255,0.9)" : "var(--text-dim)" }}
      >
        {label}
        <HelpTooltip text={tooltip} />
      </div>
      {sublabel && (
        <div
          className={`${dense ? "hidden md:block" : ""} text-xs mt-0.5`}
          style={{ color: accent ? "rgba(255,255,255,0.65)" : "var(--text-faint)" }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}

export default StatCard;
