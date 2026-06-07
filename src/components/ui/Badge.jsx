import React from "react";
import { NEUTRAL } from "../../constants/companies";

const VARIANTS = {
  default:  { bg: "#f2e5e5",   color: "#201a1a",        border: "#e9bcb6" },
  urgent:   { bg: "#FEF3C7",   color: "#E8920A",        border: "#FDE68A" },
  critical: { bg: "#ffdad5",   color: "#b5000b",        border: "#ffb4aa" },
  gold:     { bg: "#FFFBE6",   color: "#9A7A00",        border: "#FFE680" },
  neutral:  { bg: "#f2e5e5",   color: "#5c5f60",        border: "#e9bcb6" },
  success:  { bg: "#EDFAF2",   color: "#16A34A",        border: "#9ADDB8" },
  dark:     { bg: "#201a1a",   color: "#FFFFFF",        border: "#201a1a" },
  admin:    { bg: "#EDE9FE",   color: "#5B21B6",        border: "#C4B5FD" },
  secondary:{ bg: "#d5e3ff",   color: "#0059a8",        border: "#a7c8ff" },
};

export function Badge({ children, variant = "default", size = "sm", customColor }) {
  const v = customColor
    ? { bg: customColor + "15", color: customColor, border: customColor + "40" }
    : VARIANTS[variant] || VARIANTS.default;
  const cls = size === "sm"
    ? "px-2 py-0.5 text-[11px]"
    : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 ${cls} font-semibold rounded border whitespace-nowrap`}
      style={{ background: v.bg, color: v.color, borderColor: v.border }}
    >
      {children}
    </span>
  );
}

export default Badge;
