import React from "react";
import { NEUTRAL } from "../../constants/companies";

const VARIANTS = {
  default: { bg: NEUTRAL.lightGray, color: NEUTRAL.graphite, border: NEUTRAL.slate + "30" },
  urgent: { bg: "#FDF4EF", color: NEUTRAL.amber, border: NEUTRAL.amber + "40" },
  critical: { bg: "#FEF2F2", color: "#B91C1C", border: "#B91C1C40" },
  gold: { bg: "#FDF9EF", color: NEUTRAL.gold, border: NEUTRAL.gold + "40" },
  neutral: { bg: NEUTRAL.lightGray, color: NEUTRAL.slate, border: NEUTRAL.slate + "30" },
  success: { bg: "#E8F2EC", color: NEUTRAL.success, border: NEUTRAL.success + "40" },
  dark: { bg: NEUTRAL.graphite, color: "#FFFFFF", border: NEUTRAL.graphite },
  admin: { bg: "#4C1D95", color: "#FFFFFF", border: "#4C1D95" },
};

export function Badge({ children, variant = "default", size = "sm", customColor }) {
  const v = customColor
    ? { bg: customColor + "15", color: customColor, border: customColor + "40" }
    : VARIANTS[variant] || VARIANTS.default;
  const p = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const fs = size === "sm" ? 10 : 11;
  return (
    <span
      className={`inline-flex items-center gap-1 ${p} font-semibold uppercase tracking-wider rounded-sm border whitespace-nowrap`}
      style={{ background: v.bg, color: v.color, borderColor: v.border, letterSpacing: "0.08em", fontSize: fs }}
    >
      {children}
    </span>
  );
}

export default Badge;
