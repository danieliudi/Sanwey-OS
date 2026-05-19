import React from "react";
import { NEUTRAL } from "../../constants/companies";

const VARIANTS = {
  default: { bg: "#F1F3F5", color: NEUTRAL.graphite, border: "#E2E6EA" },
  urgent: { bg: "#FFF4E6", color: "#C2660A", border: "#FFD4A3" },
  critical: { bg: "#FFF0F0", color: "#B91C1C", border: "#FFC5C5" },
  gold: { bg: "#FFFBE6", color: "#9A7A00", border: "#FFE680" },
  neutral: { bg: "#F1F3F5", color: NEUTRAL.slate, border: "#E2E6EA" },
  success: { bg: "#EDFAF2", color: "#1A7A3C", border: "#9ADDB8" },
  dark: { bg: NEUTRAL.graphite, color: "#FFFFFF", border: NEUTRAL.graphite },
  admin: { bg: "#EDE9FE", color: "#5B21B6", border: "#C4B5FD" },
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
      className={`inline-flex items-center gap-1 ${cls} font-semibold rounded-full border whitespace-nowrap`}
      style={{ background: v.bg, color: v.color, borderColor: v.border }}
    >
      {children}
    </span>
  );
}

export default Badge;
