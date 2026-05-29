import React from "react";
import { ChevronDown } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";

export function Select({ value, onChange, options, placeholder, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none py-2 pl-3 pr-9 text-sm rounded-lg border transition-colors duration-150 focus:outline-none focus:ring-2 cursor-pointer"
        style={{
          borderColor: "#E5E7EB",
          background: "#FFFFFF",
          color: value ? NEUTRAL.graphite : NEUTRAL.slate,
          "--tw-ring-color": "rgba(199,33,43,.15)",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "#C7212B"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
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
        color={NEUTRAL.slate}
      />
    </div>
  );
}

export default Select;
