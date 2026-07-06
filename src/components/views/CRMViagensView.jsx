import React, { useState } from "react";
import { Plane, Users, BarChart3 } from "lucide-react";
import { CRMViagensPlanejamentoView } from "./CRMViagensPlanejamentoView";
import { CRMViagensGestorView } from "./CRMViagensGestorView";
import { CRMViagensRelatoriosView } from "./CRMViagensRelatoriosView";
import { COMERCIAL_ROLES } from "../../utils/viagens";

const MANAGER_ROLES = new Set(["gerente", "admin"]);

// Orquestrador por papel: vendedor/consultor só planejam as próprias
// viagens; gerente também planeja as próprias E gerencia o time (por isso
// aparece nas duas abas); admin só gerencia (não tem viagens próprias).
export function CRMViagensView({ currentUser, leads, users }) {
  const podePlanejarPropria = COMERCIAL_ROLES.has(currentUser?.role);
  const isGestor = MANAGER_ROLES.has(currentUser?.role);

  const tabs = [];
  if (podePlanejarPropria) tabs.push({ id: "minhas", label: "Minhas viagens", icon: Plane });
  if (isGestor) {
    tabs.push({ id: "gestao", label: "Gestão", icon: Users });
    tabs.push({ id: "relatorios", label: "Relatórios", icon: BarChart3 });
  }

  const [tab, setTab] = useState(tabs[0]?.id || null);
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;

  if (tabs.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", color: "var(--text-dim)", fontSize: 13 }}>
        Você não tem acesso a Viagens & Reembolsos.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 && (
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 10, padding: 3, alignSelf: "flex-start" }}>
          {tabs.map((t) => {
            const active = t.id === activeTab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: active ? "var(--surface)" : "transparent",
                  color: active ? "var(--text)" : "var(--text-dim)",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "minhas" && <CRMViagensPlanejamentoView currentUser={currentUser} leads={leads} />}
      {activeTab === "gestao" && <CRMViagensGestorView currentUser={currentUser} users={users} />}
      {activeTab === "relatorios" && <CRMViagensRelatoriosView currentUser={currentUser} users={users} />}
    </div>
  );
}

export default CRMViagensView;
