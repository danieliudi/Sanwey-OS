import React from "react";
import { LogOut } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";

const ROLE_LABEL = { admin: "Admin", gerente: "Gerente", vendedor: "Vendedor" };

export function TopBar({
  currentUser, activeCompany, accessibleCompanies,
  onCompanyChange, onLogout,
}) {
  const roleLabel = ROLE_LABEL[currentUser.role] || "Vendedor";
  return (
    <div className="px-4 md:px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <Logo size="small" company={activeCompany} />

        {accessibleCompanies.length > 1 && (
          <div
            className="flex items-center gap-1 rounded-xl p-1 border"
            style={{ background: "#F5F5F3", borderColor: "#E5E5E5" }}
          >
            {accessibleCompanies.map(id => {
              const c = COMPANIES[id];
              const active = activeCompany === id;
              return (
                <button
                  key={id}
                  onClick={() => onCompanyChange(id)}
                  className="px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer select-none"
                  style={{
                    background: active ? "#FFFFFF" : "transparent",
                    color: active ? NEUTRAL.graphite : NEUTRAL.slate,
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                    border: active ? "1px solid #E5E5E5" : "1px solid transparent",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: c.primary }}
                  />
                  {c.short}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
            style={{ background: currentUser.avatarBg }}
          >
            {currentUser.initials}
          </div>
          <div className="hidden lg:block">
            <div className="text-sm font-semibold leading-tight" style={{ color: NEUTRAL.graphite }}>
              {currentUser.name}
            </div>
            <div className="text-xs" style={{ color: NEUTRAL.slate }}>
              {roleLabel}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>Sair</Button>
      </div>
    </div>
  );
}

export default TopBar;
