import { useCallback } from "react";
import { usePersistentState } from "./use-persistent-state";

// Config de quais agentes estão ativos por empresa. Persistido em
// localStorage por enquanto — afeta o que a tela /agentes mostra.
//
// Shape: { [companyId]: { [agentId]: boolean } }
// Quando uma entry está ausente, default = true (todos ativos).
//
// Os agentes continuam rodando no backend (Edge Functions) — desabilitar
// aqui só esconde as sugestões da UI. Pra parar de gerar no backend é
// outra rodada (precisa wiring no agent-gateway).

const STORAGE_KEY = "sanwey:agentConfig:v1";

export const AGENT_IDS = ["sdr_q", "scout", "cadencia", "sentinela", "cross"];

export function useAgentConfig() {
  const [config, setConfig] = usePersistentState(STORAGE_KEY, {});

  const isAgentEnabled = useCallback((companyId, agentId) => {
    const c = config[companyId];
    if (!c) return true;
    const v = c[agentId];
    return v !== false;
  }, [config]);

  const toggleAgent = useCallback((companyId, agentId) => {
    setConfig(prev => {
      const c = prev[companyId] || {};
      const current = c[agentId] !== false;
      return { ...prev, [companyId]: { ...c, [agentId]: !current } };
    });
  }, [setConfig]);

  const setAgentEnabled = useCallback((companyId, agentId, enabled) => {
    setConfig(prev => {
      const c = prev[companyId] || {};
      return { ...prev, [companyId]: { ...c, [agentId]: !!enabled } };
    });
  }, [setConfig]);

  return { config, isAgentEnabled, toggleAgent, setAgentEnabled };
}

export default useAgentConfig;
