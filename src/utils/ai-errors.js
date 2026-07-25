// Traduz o erro cru de um provedor de IA (Gemini/OpenAI, texto técnico com
// URLs e nomes de métrica em inglês) pra uma frase acionável em português.
// Usado tanto pelo preview do AgentBuilderWizard quanto pelo "Testar conexão"
// de Configurações — mesma classificação, achado real de QA em ambos os
// pontos (docs/... auditoria AgentBuilderWizard, P1-1/P1-2).
export function friendlyAiErrorMessage(rawMessage) {
  const msg = String(rawMessage || "").toLowerCase();

  if (msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("429") || msg.includes("rate limit")) {
    return "O limite de uso da chave de IA foi atingido (quota esgotada no provedor). Verifique o plano/cota no Google AI Studio (ou equivalente) ou troque de chave em Configurações → Integrações de IA.";
  }
  if (msg.includes("api key not valid") || msg.includes("invalid api key") || msg.includes("incorrect api key") || msg.includes("unauthorized") || msg.includes("permission_denied") || msg.includes("401") || msg.includes("403")) {
    return "A chave de IA configurada não é válida. Confira a chave em Configurações → Integrações de IA.";
  }
  if (msg.includes("non-2xx") || msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout")) {
    return "Não foi possível conectar ao provedor de IA agora. Tente novamente em instantes.";
  }
  return "Não foi possível conectar com a IA. Tente novamente ou revise a chave em Configurações → Integrações de IA.";
}

export default friendlyAiErrorMessage;
