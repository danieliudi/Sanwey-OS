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
    <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        <Logo size="small" company={activeCompany} />
        {accessibleCompanies.length > 1 && (
          <div
            className="flex items-center gap-1 rounded-sm p-0.5 border"
            style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}
          >
            {accessibleCompanies.map(id => {
              const c = COMPANIES[id];
              const active = activeCompany === id;
              return (
                <button
                  key={id}
                  onClick={() => onCompanyChange(id)}
                  className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5"
                  style={{
                    background: active ? c.primary : "transparent",
                    color: active ? "#FFFFFF" : NEUTRAL.slate,
                    letterSpacing: "0.06em",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: active ? "#FFFFFF" : c.primary }}
                  />
                  {c.short}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
            style={{ background: currentUser.avatarBg }}
          >
            {currentUser.initials}
          </div>
          <div className="hidden lg:block">
            <div className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>
              {currentUser.name}
            </div>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: NEUTRAL.slate, letterSpacing: "0.1em" }}
            >
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
