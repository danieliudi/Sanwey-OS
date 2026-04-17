import React from "react";
import { ChevronDown } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";

export function Select({ value, onChange, options, placeholder, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none py-2.5 pl-3 pr-10 text-sm rounded-sm border transition-all focus:outline-none cursor-pointer"
        style={{
          borderColor: "#E5E5E5",
          background: "#FFFFFF",
          color: value ? NEUTRAL.graphite : NEUTRAL.slate,
        }}
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
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        color={NEUTRAL.slate}
      />
    </div>
  );
}

export default Select;
