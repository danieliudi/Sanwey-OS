// Chamada de provider de IA (OpenAI/Anthropic/Gemini) — extraído de
// ai-assistant/index.ts pra ser compartilhado com agent-runner/index.ts
// (PRD docs/prd-agent-builder.md, seção 4: "não duplicada — a lógica de
// resolver BYOLLM vira função utilitária chamada pelas duas"). Cada function
// resolve sua própria auth/chave antes de chamar isto — este módulo só fala
// com o provider, não sabe de JWT nem de onde a chave veio.

export type AIMessage = { role: string; content: string };

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
    if (!r.ok) throw new Error(d.error?.message || "OpenAI error");
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
    if (!r.ok) throw new Error(d.error?.message || "Anthropic error");
    return d.content[0]?.text || "";
  }

  if (provider === "gemini") {
    const sys = messages.find((m) => m.role === "system");
    const msgs = messages.filter((m) => m.role !== "system");
    const r = await fetch(
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
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "Gemini error");
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
