import React from "react";

const SIZES = {
  sm: { padding: "px-3 py-1.5", font: "text-xs", iconSize: 14, gap: "gap-1.5" },
  md: { padding: "px-4 py-2",   font: "text-sm", iconSize: 15, gap: "gap-2" },
  lg: { padding: "px-5 py-2.5", font: "text-sm", iconSize: 16, gap: "gap-2" },
};

export function Button({
  children, onClick, variant = "primary", size = "md", icon: Icon,
  disabled = false, className = "", accent, type = "button", "aria-label": ariaLabel,
}) {
  const a = accent || "var(--accent)";
  const ah = accent ? accent : "var(--accent-hover)";

  const variants = {
    primary:   { bg: a,                       color: "var(--on-accent)", border: a },
    dark:      { bg: "var(--text)",            color: "#FFFFFF",          border: "var(--text)" },
    secondary: { bg: "var(--surface)",         color: "var(--text)",      border: "var(--border-strong)" },
    ghost:     { bg: "transparent",            color: "var(--text-dim)",  border: "transparent" },
    danger:    { bg: "#FEF2F2",                color: "var(--danger)",    border: "#FECACA" },
  };
  const v = variants[variant] || variants.primary;
  const s = SIZES[size];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        inline-flex items-center justify-center font-semibold border
        transition-all duration-150 cursor-pointer select-none
        rounded-sm
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        active:scale-[0.97]
        ${s.padding} ${s.font} ${s.gap} ${className}
      `}
      style={{
        background: v.bg,
        color: v.color,
        borderColor: v.border,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        if (variant === "primary") {
          e.currentTarget.style.background = ah;
          e.currentTarget.style.borderColor = ah;
        } else {
          e.currentTarget.style.filter = "brightness(0.95)";
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = v.bg;
        e.currentTarget.style.borderColor = v.border;
        e.currentTarget.style.filter = "";
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.filter = "brightness(0.88)"; }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.filter = ""; }}
    >
      {Icon && <Icon size={s.iconSize} strokeWidth={2} />}
      {children}
    </button>
  );
}

export default Button;
