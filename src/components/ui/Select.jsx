import React from "react";
import { ChevronDown } from "lucide-react";

// size="sm" — dropdown compacto pra sentar ao lado de toggles/botões de
// toolbar de kanban (mesmo padding/fonte canônicos: 6px/12px, 12px). Só
// afeta quem passar a prop; todo chamador existente mantém o tamanho padrão.
const SIZE_CLASSES = {
  md: "py-2 pl-3 pr-9 text-sm rounded-lg",
  sm: "py-1.5 pl-3 pr-8 text-xs rounded-xl",
};

export function Select({ value, onChange, options, placeholder, className = "", size = "md" }) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className={`w-full appearance-none ${sizeClass} border transition-colors duration-150 focus:outline-none focus:ring-2 cursor-pointer`}
        style={{
          borderColor: "#E5E7EB",
          background: "#FFFFFF",
          color: value ? "var(--text)" : "var(--text-dim)",
          "--tw-ring-color": "rgba(199,33,43,.15)",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent) 8%, transparent)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option
            key={typeof opt === "string" ? opt : opt.value}
            value={typeof opt === "string" ? opt : opt.value}
          >
            {typeof opt === "string" ? opt : opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        color="var(--text-dim)"
      />
    </div>
  );
}

export default Select;
