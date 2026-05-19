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
          borderColor: "#D4D4D4",
          background: "#FFFFFF",
          color: NEUTRAL.graphite,
          "--tw-ring-color": NEUTRAL.graphite + "30",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = NEUTRAL.graphite + "70"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "#D4D4D4"; }}
      />
    </div>
  );
}

export default Input;
