import React from "react";
import { NEUTRAL } from "../../constants/companies";

export function Input({ value, onChange, placeholder, icon: Icon, type = "text", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      {Icon && (
        <Icon
          size={16}
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
        className="w-full py-2.5 text-sm rounded-sm border transition-all focus:outline-none focus:ring-2"
        style={{
          paddingLeft: Icon ? 40 : 14,
          paddingRight: 14,
          borderColor: "#E5E5E5",
          background: "#FFFFFF",
          color: NEUTRAL.graphite,
        }}
      />
    </div>
  );
}

export default Input;
