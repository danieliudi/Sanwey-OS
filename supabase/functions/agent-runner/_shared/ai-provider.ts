// Chamada de provider de IA (OpenAI/Anthropic) — extraído de
// ai-assistant/index.ts pra ser compartilhado com agent-runner/index.ts
// (PRD docs/prd-agent-builder.md, seção 4: "não duplicada — a lógica de
// resolver BYOLLM vira função utilitária chamada pelas duas"). Cada function
// resolve sua própria auth/chave antes de chamar isto — este módulo só fala
// com o provider, não sabe de JWT nem de onde a chave veio.
//
// Gemini removido de propósito (18/08/2026, decisão com o Daniel): era o
// único dos três cujo plano gratuito da API pode usar prompt/resposta pra
// treinar modelo do Google — Anthropic e OpenAI não treinam com dado de API,
// pago ou não. Rejeitado aqui também (não só escondido do seletor em
// Configurações) pra cobrir o caso de alguém configurar AI_ORG_PROVIDER=gemini
// direto no secret, sem passar pela UI.

export type AIMessage = { role: string; content: string };

// GAP 3 (18/08/2026, análise de segurança de IA com o Daniel): CPF é o único
// dado pessoal que aparece de fato em texto puro num prompt (CNPJ/e-mail/
// telefone já circulam abertos pela plataforma inteira, são dado comercial
// rotineiro — não mascarar). Mascara incondicionalmente, sem flag de opt-in:
// uma spec anterior propunha um campo `allowPII` pra abrir exceção (pensando
// na extração de documento de RH, que lê CPF de propósito), mas a revisão de
// segurança achou que isso seria explorável — qualquer chamador autenticado
// poderia mandar `allowPII:['cpf']` com texto livre e pular a máscara. Não é
// necessário de qualquer forma: a extração de documento manda o arquivo como
// bloco de imagem/PDF (`content` é array, não string), e esta máscara só atua
// em mensagens cujo `content` é string — o caso de extração já fica de fora
// por construção, sem precisar de exceção nenhuma.
function isValidCPF(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let check1 = 11 - (sum % 11);
  if (check1 >= 10) check1 = 0;
  if (check1 !== parseInt(digits[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  let check2 = 11 - (sum % 11);
  if (check2 >= 10) check2 = 0;
  return check2 === parseInt(digits[10], 10);
}

function maskCPF(text: string): string {
  let masked = text.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, (m) => (isValidCPF(m.replace(/\D/g, "")) ? "[CPF removido]" : m));
  masked = masked.replace(/\b\d{11}\b/g, (m) => (isValidCPF(m) ? "[CPF removido]" : m));
  return masked;
}

function maskMessagesPII(messages: AIMessage[]): AIMessage[] {
  return messages.map((m) => (typeof m.content === "string" ? { ...m, content: maskCPF(m.content) } : m));
}

// Achado #11 do roteiro de treinamento de RH (31/07/2026): erro de IA em 6+
// telas era o texto cru do provider repassado direto ao usuário — igual pra
// "sem cota/crédito" (algo real, avisar admin) e qualquer outro erro. Isso
// reformula só o caso de cota/limite esgotado, sem mudar nenhuma lógica de
// chamada — "não configurado" já tinha mensagem própria (ai-assistant/index.ts).
function friendlyProviderError(raw: string, provider: string): string {
  const s = (raw || "").toLowerCase();
  const isQuota = s.includes("insufficient_quota") || s.includes("exceeded your current quota")
    || s.includes("quota") || s.includes("rate limit") || s.includes("429")
    || s.includes("billing") || s.includes("credit balance");
  if (isQuota) {
    return `A chave de IA (${provider}) está sem cota/crédito no provedor — avise um admin pra verificar o plano/billing.`;
  }
  return raw;
}

export type AIUsage = { promptTokens: number | null; completionTokens: number | null };
export type AICallResult = { content: string; usage: AIUsage };

export async function callAIProvider(opts: {
  provider: string;
  model: string;
  apiKey: string;
  messages: AIMessage[];
  maxTokens?: number;
}): Promise<AICallResult> {
  const { provider, model, apiKey, maxTokens = 1200 } = opts;
  const messages = maskMessagesPII(opts.messages);

  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(friendlyProviderError(d.error?.message || "OpenAI error", "OpenAI"));
    return {
      content: d.choices[0]?.message?.content || "",
      usage: { promptTokens: d.usage?.prompt_tokens ?? null, completionTokens: d.usage?.completion_tokens ?? null },
    };
  }

  if (provider === "anthropic") {
    const sys = messages.find((m) => m.role === "system");
    const msgs = messages.filter((m) => m.role !== "system");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: msgs, ...(sys ? { system: sys.content } : {}), max_tokens: maxTokens }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(friendlyProviderError(d.error?.message || "Anthropic error", "Anthropic"));
    return {
      content: d.content[0]?.text || "",
      usage: { promptTokens: d.usage?.input_tokens ?? null, completionTokens: d.usage?.output_tokens ?? null },
    };
  }

  if (provider === "gemini") {
    throw new Error("Gemini não é mais um provedor suportado — o plano gratuito da API do Google pode usar seus dados pra treinar modelo. Use Anthropic ou OpenAI.");
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// Resolve a chave BYOLLM: pessoal (profile.ai_config) tem prioridade,
// fallback pra chave da empresa (AI_ORG_* secrets) — mesmo fallback que
// ai-assistant já aplica hoje pro uso interativo.
export function resolveProviderConfig(personalConfig: { provider?: string; model?: string; apiKey?: string } | null | undefined) {
  if (personalConfig?.apiKey && personalConfig?.provider && personalConfig?.model) {
    return { provider: personalConfig.provider, model: personalConfig.model, apiKey: personalConfig.apiKey, source: "personal" as const };
  }
  const orgKey = Deno.env.get("AI_ORG_API_KEY");
  const orgProvider = Deno.env.get("AI_ORG_PROVIDER");
  const orgModel = Deno.env.get("AI_ORG_MODEL");
  if (orgKey && orgProvider && orgModel) {
    return { provider: orgProvider, model: orgModel, apiKey: orgKey, source: "org" as const };
  }
  return null;
}
