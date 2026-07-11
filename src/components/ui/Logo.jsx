import React from "react";
import { Shield } from "lucide-react";
import { COMPANIES } from "../../constants/companies";

export function Logo({ size = "normal", company = "all" }) {
  const dim = size === "large" ? 40 : size === "small" ? 28 : 34;
  const c = COMPANIES[company] || COMPANIES.all;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-xl flex items-center justify-center shrink-0"
        style={{
          width: dim, height: dim,
          background: `linear-gradient(135deg, ${c.primary} 0%, ${c.dark} 100%)`,
        }}
      >
        <Shield size={dim * 0.52} color="#FFFFFF" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <span
          className="font-bold tracking-tight truncate"
          style={{ color: "var(--text)", fontSize: size === "large" ? 20 : 16 }}
        >
          Grupo Sanwey
        </span>
        <span
          className="uppercase truncate"
          style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.14em" }}
        >
          Comercial Intelligence
        </span>
      </div>
    </div>
  );
}

export default Logo;
