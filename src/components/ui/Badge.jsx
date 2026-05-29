import React from "react";
import { NEUTRAL } from "../../constants/companies";

const VARIANTS = {
  default:  { bg: "#E5E7EB20", color: NEUTRAL.graphite, border: "#E5E7EB" },
  urgent:   { bg: "#FEF3C7",   color: "#E8920A",        border: "#FDE68A" },
  critical: { bg: "#FBE9EB",   color: "#C7212B",        border: "#F5C6CB" },
  gold:     { bg: "#FFFBE6",   color: "#9A7A00",        border: "#FFE680" },
  neutral:  { bg: "#E5E7EB20", color: NEUTRAL.slate,    border: "#E5E7EB" },
  success:  { bg: "#EDFAF2",   color: "#16A34A",        border: "#9ADDB8" },
  dark:     { bg: NEUTRAL.graphite, color: "#FFFFFF",    border: NEUTRAL.graphite },
  admin:    { bg: "#EDE9FE",   color: "#5B21B6",        border: "#C4B5FD" },
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
