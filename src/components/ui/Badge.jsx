import React from "react";

const VARIANTS = {
  default:   { bg: "var(--surface-alt)", color: "var(--text-dim)",   border: "var(--border)" },
  urgent:    { bg: "var(--warning-bg)",  color: "var(--warning)",     border: "color-mix(in srgb, var(--warning) 35%, transparent)" },
  critical:  { bg: "var(--danger-bg)",   color: "var(--danger)",      border: "color-mix(in srgb, var(--danger) 35%, transparent)" },
  gold:      { bg: "color-mix(in srgb, #EAB308 14%, var(--surface))", color: "color-mix(in srgb, #EAB308 60%, var(--text))", border: "color-mix(in srgb, #EAB308 35%, transparent)" },
  neutral:   { bg: "var(--surface-alt)", color: "var(--text-faint)", border: "var(--border)" },
  success:   { bg: "var(--success-bg)",  color: "var(--success)",    border: "color-mix(in srgb, var(--success) 35%, transparent)" },
  dark:      { bg: "var(--text)",        color: "var(--surface)",    border: "var(--text)" },
  admin:     { bg: "color-mix(in srgb, #7C3AED 12%, var(--surface))", color: "color-mix(in srgb, #7C3AED 60%, var(--text))", border: "color-mix(in srgb, #7C3AED 35%, transparent)" },
  secondary: { bg: "color-mix(in srgb, #2563EB 12%, var(--surface))", color: "color-mix(in srgb, #2563EB 60%, var(--text))", border: "color-mix(in srgb, #2563EB 35%, transparent)" },
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
      className={`inline-flex items-center gap-1 ${cls} font-semibold rounded-full border whitespace-nowrap`}
      style={{ background: v.bg, color: v.color, borderColor: v.border }}
    >
      {children}
    </span>
  );
}

export default Badge;
