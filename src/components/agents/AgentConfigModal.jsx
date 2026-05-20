import React from "react";
import { X, Info } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";

// Modal de configuração de agentes — grade empresa × agente com toggles.
// Config local; explica isso no aviso pra usuário não esperar que
// desabilitar pare a Edge Function no backend.

export function AgentConfigModal({
  open,
  onClose,
  agents,                // { [id]: { label, sub, Icon, color, bg } }
  agentOrder,            // ["sdr_q", ...]
  isAgentEnabled,        // (companyId, agentId) → boolean
  toggleAgent,           // (companyId, agentId) → void
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ background: "#FFFFFF", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#E5E7EB" }}>
          <h2 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>
            Configurar agentes
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: NEUTRAL.slate }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Aviso */}
        <div
          className="px-5 py-2.5 text-xs border-b flex items-start gap-2"
          style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}
        >
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            Desativar um agente esconde as sugestões dele desta tela. Os agentes continuam rodando no backend —
            a frequência de execução e os prompts são configurados pelo time técnico.
          </span>
        </div>

        {/* Grade empresa × agente */}
        <div className="overflow-auto flex-1 p-5">
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#FAFAFA" }}>
                  <th className="text-left p-3 text-[10px] font-bold uppercase" style={{ color: NEUTRAL.slate, letterSpacing: "0.06em" }}>
                    Agente
                  </th>
                  {COMPANY_IDS.map(id => {
                    const c = COMPANIES[id];
                    return (
                      <th key={id} className="text-center p-3 text-[10px] font-bold uppercase" style={{ color: c?.primary || NEUTRAL.slate, letterSpacing: "0.06em" }}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: c?.primary }} />
                          {c?.short || id}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                {agentOrder.map(agentId => {
                  const agent = agents[agentId];
                  if (!agent) return null;
                  const Icon = agent.Icon;
                  return (
                    <tr key={agentId}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: agent.bg, color: agent.color }}
                          >
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold leading-tight" style={{ color: agent.color }}>
                              {agent.label}
                            </div>
                            <div className="text-[10px] leading-tight" style={{ color: NEUTRAL.slate }}>
                              {agent.sub}
                            </div>
                          </div>
                        </div>
                      </td>
                      {COMPANY_IDS.map(companyId => {
                        const enabled = isAgentEnabled(companyId, agentId);
                        return (
                          <td key={companyId} className="text-center p-3">
                            <Toggle
                              enabled={enabled}
                              onClick={() => toggleAgent(companyId, agentId)}
                              color={agent.color}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-end" style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
            style={{ background: "#1E4D8C", color: "#FFFFFF" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ enabled, onClick, color }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={enabled}
      className="relative inline-flex items-center cursor-pointer"
      style={{
        width: 34,
        height: 18,
        borderRadius: 9,
        background: enabled ? color : "#D1D5DB",
        transition: "background-color 120ms",
      }}
    >
      <span
        className="absolute rounded-full shadow"
        style={{
          width: 14,
          height: 14,
          left: enabled ? 18 : 2,
          background: "#FFFFFF",
          transition: "left 120ms",
        }}
      />
    </button>
  );
}

export default AgentConfigModal;
