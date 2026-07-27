import React, { useState } from "react";
import { Plane, Users, BarChart3, Calculator } from "lucide-react";
import { CRMViagensPlanejamentoView } from "./CRMViagensPlanejamentoView";
import { CRMViagensGestorView } from "./CRMViagensGestorView";
import { CRMViagensRelatoriosView } from "./CRMViagensRelatoriosView";
import { CRMViagensCalculadoraView } from "./CRMViagensCalculadoraView";
import { PageHeader } from "../shared/PageHeader";
import { COMERCIAL_ROLES } from "../../utils/viagens";

const MANAGER_ROLES = new Set(["gerente", "admin"]);

// Orquestrador por papel: vendedor/consultor só planejam as próprias
// viagens; gerente também planeja as próprias E gerencia o time (por isso
// aparece nas duas abas); admin só gerencia (não tem viagens próprias).
export function CRMViagensView({ currentUser, clients, onCreateClient, users, pushNotification }) {
  // roles[] cobre cargo adicional (ex: vendedor como cargo secundário) —
  // currentUser.role sozinho (cargo principal) fica só de fallback.
  const userRoleList = currentUser?.roles?.length ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  const podePlanejarPropria = userRoleList.some(r => COMERCIAL_ROLES.has(r));
  const isGestor = userRoleList.some(r => MANAGER_ROLES.has(r));

  const tabs = [];
  if (podePlanejarPropria) tabs.push({ id: "minhas", label: "Minhas viagens", icon: Plane });
  if (isGestor) {
    tabs.push({ id: "gestao", label: "Gestão", icon: Users });
    tabs.push({ id: "relatorios", label: "Relatórios", icon: BarChart3 });
  }
  tabs.push({ id: "calculadora", label: "Calculadora", icon: Calculator });

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
      <PageHeader
        icon={Plane}
        title="Viagens & Reembolsos"
        subtitle="Planeje visitas, acompanhe aprovações e lance reembolsos do time comercial"
      />
      {tabs.length > 1 && (
        <div className="max-w-full overflow-x-auto" style={{ display: "flex", gap: 4, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 10, padding: 3, alignSelf: "flex-start" }}>
          {tabs.map((t) => {
            const active = t.id === activeTab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="shrink-0"
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
                  boxShadow: active ? "var(--shadow-card)" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "minhas" && <CRMViagensPlanejamentoView currentUser={currentUser} clients={clients} onCreateClient={onCreateClient} pushNotification={pushNotification} />}
      {activeTab === "gestao" && <CRMViagensGestorView currentUser={currentUser} users={users} />}
      {activeTab === "relatorios" && <CRMViagensRelatoriosView currentUser={currentUser} users={users} />}
      {activeTab === "calculadora" && <CRMViagensCalculadoraView />}
    </div>
  );
}

export default CRMViagensView;
