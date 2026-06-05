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
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (recomendado)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
    keyPlaceholder: 'AIza...',
    keyHint: 'Obtenha em aistudio.google.com/app/apikey',
  },
];

export const AI_PROVIDER_MAP = Object.fromEntries(AI_PROVIDERS.map(p => [p.id, p]));
