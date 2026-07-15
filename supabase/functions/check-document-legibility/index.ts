import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Checagem de legibilidade de foto/PDF de documento antes do upload — usa uma
// chave de IA PAGA PELA EMPRESA (ANTHROPIC_API_KEY, secret de servidor), ao
// contrário do resto da plataforma que é BYOK (cada usuário cola a própria
// chave em Configurações → Integrações de IA). Por isso o prompt fica FIXO
// aqui no servidor — o cliente só manda a imagem, nunca "messages" livres —
// pra não expor a chave da empresa como um proxy genérico de LLM.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPT = `Você está checando a qualidade de uma foto ou PDF de documento (RG, CNH, comprovante etc.) antes do upload num sistema de RH.
Responda SOMENTE um JSON, sem markdown, no formato exato:
{"legivel": true ou false, "motivo": string ou null, "sugestao": string ou null}
legivel=false se a imagem estiver borrada, cortada, com reflexo/glare forte, escura demais, ou o texto do documento não puder ser lido com confiança razoável.
motivo e sugestao só quando legivel=false — curtos, em português, explicando o problema específico e como corrigir (ex: motivo: "Foto desfocada", sugestao: "Seguure o celular parado e tente de novo com mais luz").`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64 || !mediaType) {
      return new Response(JSON.stringify({ error: "'imageBase64' e 'mediaType' são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ~10MB de arquivo original vira ~13.5MB em base64 — mesmo teto usado nos
    // outros uploads de documento da plataforma (NovoColaboradorModal etc.).
    if (imageBase64.length > 14_000_000) {
      return new Response(JSON.stringify({ error: "Arquivo grande demais" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      // Sem secret configurado ainda — não bloqueia o upload, só desliga a
      // checagem automática (mesmo espírito do fallback de RESEND_API_KEY
      // em rh-send-email).
      return new Response(JSON.stringify({ configured: false, legivel: true, motivo: null, sugestao: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blockType = mediaType === "application/pdf" ? "document" : "image";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            { type: blockType, source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "Anthropic error");
    const text = d.content?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta da IA não veio em JSON");
    const parsed = JSON.parse(match[0]);

    return new Response(JSON.stringify({
      configured: true,
      legivel: parsed.legivel !== false,
      motivo: parsed.motivo || null,
      sugestao: parsed.sugestao || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    // Falha da checagem (rede, rate limit, resposta inesperada da IA) não
    // deve travar quem só quer cadastrar o funcionário — segue como se
    // tivesse passado, mas reporta o erro pro client decidir se avisa.
    return new Response(JSON.stringify({ configured: true, legivel: true, motivo: null, sugestao: null, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
