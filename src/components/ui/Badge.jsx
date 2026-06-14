import React from "react";

const VARIANTS = {
  default:   { bg: "var(--surface-alt)", color: "var(--text-dim)",   border: "var(--border)" },
  urgent:    { bg: "#FEF3C7",            color: "#B45309",           border: "#FDE68A" },
  critical:  { bg: "#FEF2F2",            color: "#B91C1C",           border: "#FECACA" },
  gold:      { bg: "#FFFBE6",            color: "#9A7A00",           border: "#FFE680" },
  neutral:   { bg: "var(--surface-alt)", color: "var(--text-faint)", border: "var(--border)" },
  success:   { bg: "#F0FDF4",            color: "#15803D",           border: "#BBF7D0" },
  dark:      { bg: "var(--text)",        color: "var(--surface)",    border: "var(--text)" },
  admin:     { bg: "#EDE9FE",            color: "#5B21B6",           border: "#C4B5FD" },
  secondary: { bg: "#EFF6FF",            color: "#1D4ED8",           border: "#BFDBFE" },
};

export function Badge({ children, variant = "default", size = "sm", customColor }) {
  const v = customColor
    ? { bg: customColor + "18", color: customColor, border: customColor + "40" }
    : VARIANTS[variant] || VARIANTS.default;
  const cls = size === "sm"
    ? "px-2 py-0.5 text-[11px]"
    : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 ${cls} font-semibold rounded-sm border whitespace-nowrap`}
      style={{ background: v.bg, color: v.color, borderColor: v.border }}
    >
      {children}
    </span>
  );
}

export default Badge;
