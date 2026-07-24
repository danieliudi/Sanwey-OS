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

    const { provider, model, apiKey, messages, maxTokens = 1200 } = body;

    // resolveProviderConfig aplica o mesmo fallback pra chave da empresa
    // (org-wide, secret AI_ORG_*) quando o usuário não tem chave pessoal —
    // chave pessoal (vinda do body) sempre tem prioridade quando presente.
    const resolved = (apiKey && provider && model)
      ? { provider, model, apiKey }
      : resolveProviderConfig(null);
    if (!resolved) {
      return new Response(
        JSON.stringify({ error: "IA não configurada. Configure sua chave pessoal em Configurações → Integrações de IA, ou peça a um admin pra configurar a chave da empresa." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const content = await callAIProvider({ provider: resolved.provider, model: resolved.model, apiKey: resolved.apiKey, messages, maxTokens });
    return new Response(JSON.stringify({ content }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
