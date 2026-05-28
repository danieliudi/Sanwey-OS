import React from "react";
import { NEUTRAL } from "../../constants/companies";

const SIZES = {
  sm: { padding: "px-3 py-1.5", font: "text-xs", iconSize: 14, gap: "gap-1.5" },
  md: { padding: "px-4 py-2", font: "text-sm", iconSize: 15, gap: "gap-2" },
  lg: { padding: "px-5 py-2.5", font: "text-sm", iconSize: 16, gap: "gap-2" },
};

export function Button({
  children, onClick, variant = "primary", size = "md", icon: Icon,
  disabled = false, className = "", accent, type = "button",
}) {
  const variants = {
    primary: { bg: accent || NEUTRAL.red, color: "#FFFFFF", border: accent || NEUTRAL.red },
    dark: { bg: NEUTRAL.graphite, color: "#FFFFFF", border: NEUTRAL.graphite },
    secondary: { bg: "#FFFFFF", color: NEUTRAL.graphite, border: NEUTRAL.sombra },
    ghost: { bg: "transparent", color: NEUTRAL.slate, border: "transparent" },
    danger: { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
  };
  const v = variants[variant] || variants.primary;
  const s = SIZES[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-semibold border
        transition-all duration-150 cursor-pointer select-none
        rounded-lg
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        active:scale-[0.97]
        ${s.padding} ${s.font} ${s.gap} ${className}
      `}
      style={{
        background: v.bg,
        color: v.color,
        borderColor: v.border,
        filter: "brightness(1)",
        focusRingColor: v.border,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(0.92)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.filter = "brightness(0.85)"; }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.filter = "brightness(0.92)"; }}
    >
      {Icon && <Icon size={s.iconSize} strokeWidth={2} />}
      {children}
    </button>
  );
}

export default Button;
