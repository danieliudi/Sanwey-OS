// Gemini removido de propósito (18/08/2026, decisão com o Daniel): é o único
// dos três provedores cujo plano GRATUITO da API pode usar prompt/resposta
// pra melhorar o produto do Google (treino) — Anthropic e OpenAI não treinam
// com dado de API, pago ou não. Ver também o bloqueio espelhado no backend
// (callAIProvider em ai-assistant/agent-runner, viaGemini em crm-ata-voz).
export const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (mais capaz)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (mais rápido)' },
    ],
    keyPlaceholder: 'sk-...',
    keyHint: 'Obtenha em platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet (recomendado)' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku (mais rápido)' },
    ],
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'Obtenha em console.anthropic.com/settings/keys',
  },
];

export const AI_PROVIDER_MAP = Object.fromEntries(AI_PROVIDERS.map(p => [p.id, p]));
