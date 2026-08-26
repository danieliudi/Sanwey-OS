import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// _shared/ai-provider.ts é uma cópia idêntica da de agent-runner/_shared —
// ver comentário equivalente lá.
import { callAIProvider, resolveProviderConfig } from "./_shared/ai-provider.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Achado da auditoria de plataforma: esta function não verificava
    // autenticação nenhuma — virava um proxy aberto pras APIs de
    // OpenAI/Anthropic/Gemini pra qualquer chamador que descobrisse a URL
    // (pública, extraível do próprio bundle JS), usável com custo/quota do
    // Supabase mesmo sem nenhuma conta no Sanwey CRM.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json();

    // Checagem de status pro card "IA da empresa" em Configurações — não
    // precisa de sessão com chave nenhuma, só confirma (sem nunca revelar)
    // se os secrets AI_ORG_* estão configurados no projeto.
    if (body.action === "status") {
      const configured = Boolean(Deno.env.get("AI_ORG_API_KEY") && Deno.env.get("AI_ORG_PROVIDER") && Deno.env.get("AI_ORG_MODEL"));
      return new Response(
        JSON.stringify({ configured, provider: configured ? Deno.env.get("AI_ORG_PROVIDER") : null }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { provider, model, apiKey, messages } = body;
    // MD-06 da auditoria de segurança (19/08/2026): maxTokens vinha 100% do
    // body, sem teto — um chamador podia pedir uma resposta arbitrariamente
    // grande e inflar o custo por chamada. Teto de 2000 no servidor, acima
    // do default de 1200 (não aperta uso normal, só corta abuso).
    const maxTokens = Math.min(Number(body.maxTokens) || 1200, 2000);

    // resolveProviderConfig aplica o mesmo fallback pra chave da empresa
    // (org-wide, secret AI_ORG_*) quando o usuário não tem chave pessoal —
    // chave pessoal (vinda do body) sempre tem prioridade quando presente.
    const usingPersonalKey = Boolean(apiKey && provider && model);
    const resolved = usingPersonalKey
      ? { provider, model, apiKey }
      : resolveProviderConfig(null);
    if (!resolved) {
      return new Response(
        JSON.stringify({ error: "IA não configurada. Configure sua chave pessoal em Configurações → Integrações de IA, ou peça a um admin pra configurar a chave da empresa." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // MD-06: cota diária só se aplica ao fallback da chave da EMPRESA — a
    // chave pessoal do usuário não é limitada aqui, o custo é dele. 50
    // chamadas/dia (decidido com o Daniel 20/08/2026) — generoso pro uso
    // real, corta claramente um script/loop abusando da conta paga.
    const AI_ORG_DAILY_LIMIT = 50;
    if (!usingPersonalKey) {
      const { data: quotaCount, error: quotaErr } = await supabaseAuth.rpc("ai_org_quota_increment", {
        p_user_id: userData.user.id,
        p_daily_limit: AI_ORG_DAILY_LIMIT,
      });
      if (!quotaErr && typeof quotaCount === "number" && quotaCount > AI_ORG_DAILY_LIMIT) {
        return new Response(
          JSON.stringify({ error: `Limite diário de uso da IA da empresa atingido (${AI_ORG_DAILY_LIMIT} chamadas/dia). Configure sua própria chave em Configurações → Integrações de IA pra continuar sem limite.` }),
          { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    }

    const t0 = Date.now();
    try {
      const { content, usage } = await callAIProvider({ provider: resolved.provider, model: resolved.model, apiKey: resolved.apiKey, messages, maxTokens });
      // GAP 2 (18/08/2026): trilha de auditoria mínima, mesmo padrão do
      // logToolCall de sanwey-crm-mcp — só metadados (ids, enums curtos,
      // números), nunca o conteúdo de messages/content.
      console.log(JSON.stringify({
        event: "ai_assistant_call", user_id: userData.user.id, crm_module: body.module || "ai_assistant",
        provider: resolved.provider, execution_status: "ok", latency_ms: Date.now() - t0,
        prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens,
        at: new Date().toISOString(),
      }));
      return new Response(JSON.stringify({ content }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (err: any) {
      console.log(JSON.stringify({
        event: "ai_assistant_call", user_id: userData.user.id, crm_module: body.module || "ai_assistant",
        provider: resolved.provider, execution_status: "error", latency_ms: Date.now() - t0,
        at: new Date().toISOString(),
      }));
      throw err;
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
