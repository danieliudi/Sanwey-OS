import React from "react";
import { NEUTRAL } from "../../constants/companies";

const SIZES = {
  sm: { padding: "px-3 py-1.5", font: "text-xs", iconSize: 14 },
  md: { padding: "px-4 py-2.5", font: "text-sm", iconSize: 16 },
  lg: { padding: "px-6 py-3.5", font: "text-sm", iconSize: 16 },
};

export function Button({
  children, onClick, variant = "primary", size = "md", icon: Icon,
  disabled = false, className = "", accent, type = "button",
}) {
  const variants = {
    primary: { bg: accent || NEUTRAL.graphite, color: "#FFFFFF", border: accent || NEUTRAL.graphite },
    dark: { bg: NEUTRAL.graphite, color: "#FFFFFF", border: NEUTRAL.graphite },
    secondary: { bg: "#FFFFFF", color: NEUTRAL.graphite, border: "#E5E5E5" },
    ghost: { bg: "transparent", color: NEUTRAL.slate, border: "transparent" },
    danger: { bg: "#FFFFFF", color: NEUTRAL.red, border: NEUTRAL.red + "40" },
  };
  const v = variants[variant];
  const s = SIZES[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 font-semibold uppercase tracking-wider transition-all rounded-sm border disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm ${s.padding} ${s.font} ${className}`}
      style={{ background: v.bg, color: v.color, borderColor: v.border, letterSpacing: "0.08em" }}
    >
      {Icon && <Icon size={s.iconSize} strokeWidth={2} />}
      {children}
    </button>
  );
}

export default Button;
