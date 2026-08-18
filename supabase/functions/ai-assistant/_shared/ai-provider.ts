// Chamada de provider de IA (OpenAI/Anthropic/Gemini) — extraído de
// ai-assistant/index.ts pra ser compartilhado com agent-runner/index.ts
// (PRD docs/prd-agent-builder.md, seção 4: "não duplicada — a lógica de
// resolver BYOLLM vira função utilitária chamada pelas duas"). Cada function
// resolve sua própria auth/chave antes de chamar isto — este módulo só fala
// com o provider, não sabe de JWT nem de onde a chave veio.

export type AIMessage = { role: string; content: string };

// A Gemini API só aceita a chave via query param `key=` (mesma limitação já
// documentada/corrigida em reverse-geocode/distance-matrix) — se o fetch
// falhar a nível de rede (DNS, timeout, conexão recusada), o TypeError do
// Deno inclui a URL completa, chave junto, e essa mensagem sobe direto pro
// catch de quem chamou callAIProvider. Redige antes de propagar. OpenAI e
// Anthropic mandam a chave em header, não em URL — não precisam disso.
function redact(value: unknown, apiKey?: string): string {
  let text = typeof value === "string" ? value : String(value);
  text = text.replace(/([?&]key=)[^&\s)"']+/gi, "$1REDACTED");
  if (apiKey) text = text.split(apiKey).join("REDACTED");
  return text;
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

export async function callAIProvider(opts: {
  provider: string;
  model: string;
  apiKey: string;
  messages: AIMessage[];
  maxTokens?: number;
}): Promise<string> {
  const { provider, model, apiKey, messages, maxTokens = 1200 } = opts;

  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(friendlyProviderError(d.error?.message || "OpenAI error", "OpenAI"));
    return d.choices[0]?.message?.content || "";
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
    return d.content[0]?.text || "";
  }

  if (provider === "gemini") {
    const sys = messages.find((m) => m.role === "system");
    const msgs = messages.filter((m) => m.role !== "system");
    let r: Response;
    try {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: msgs.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            ...(sys ? { systemInstruction: { parts: [{ text: sys.content }] } } : {}),
          }),
        }
      );
    } catch (e) {
      throw new Error(redact(e instanceof Error ? e.message : String(e), apiKey));
    }
    const d = await r.json();
    if (!r.ok) throw new Error(friendlyProviderError(d.error?.message || "Gemini error", "Gemini"));
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
