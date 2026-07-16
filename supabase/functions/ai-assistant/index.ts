import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { provider, model, apiKey, messages, maxTokens = 1200 } = await req.json();
    let content = "";

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || "OpenAI error");
      content = d.choices[0]?.message?.content || "";

    } else if (provider === "anthropic") {
      const sys = messages.find((m: any) => m.role === "system");
      const msgs = messages.filter((m: any) => m.role !== "system");
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: msgs, ...(sys ? { system: sys.content } : {}), max_tokens: maxTokens }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || "Anthropic error");
      content = d.content[0]?.text || "";

    } else if (provider === "gemini") {
      const sys = messages.find((m: any) => m.role === "system");
      const msgs = messages.filter((m: any) => m.role !== "system");
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: msgs.map((m: any) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            ...(sys ? { systemInstruction: { parts: [{ text: sys.content }] } } : {}),
          }),
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || "Gemini error");
      content = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    return new Response(JSON.stringify({ content }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
