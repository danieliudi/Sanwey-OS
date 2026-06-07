import React from "react";
import { NEUTRAL } from "../../constants/companies";

export function Input({ value, onChange, placeholder, icon: Icon, type = "text", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      {Icon && (
        <Icon
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          color={NEUTRAL.slate}
          strokeWidth={2}
        />
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full py-2 text-sm rounded-lg border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0"
        style={{
          paddingLeft: Icon ? 38 : 12,
          paddingRight: 12,
          borderColor: "#E5E7EB",
          background: "#FFFFFF",
          color: NEUTRAL.graphite,
          "--tw-ring-color": "rgba(199,33,43,.15)",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "#b5000b"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(181,0,11,0.08)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

export default Input;
