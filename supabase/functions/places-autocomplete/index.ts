import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Proxy pro Google Places API (New) — Autocomplete. Mesmo padrão do
// cnpj-lookup: a chave (GOOGLE_PLACES_API_KEY, secret do projeto) nunca é
// exposta ao navegador, só o edge function fala com o Google. Usado hoje só
// pelo campo "Destino" de Nova Visita em Comercial > Viagens (mockup
// aprovado — autocomplete de endereço + botão de abrir no Maps).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// MD-07 da auditoria de segurança (19/08/2026): verify_jwt=true garante
// sessão válida, mas nada limitava o número de CHAMADAS por usuário contra
// uma API cobrada por requisição. 300/dia (decidido com o Daniel
// 20/08/2026) — cobre digitar vários endereços no dia, corta script/loop.
const DAILY_LIMIT = 300;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Respostas de auth/cota seguem a mesma convenção "falha limpa" das
    // demais respostas desta function (200 + error no corpo) — o gateway
    // (verify_jwt=true) já barra requisição sem JWT válido antes de chegar
    // aqui; isto é defesa em profundidade + extrai o user_id pra cota.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return jsonResponse({ suggestions: [], error: "Autenticação necessária" }, 200);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ suggestions: [], error: "Sessão inválida" }, 200);
    }

    const { data: count, error: quotaErr } = await admin.rpc("external_api_daily_increment", {
      p_bucket: "places_autocomplete",
      p_user_id: userData.user.id,
    });
    if (!quotaErr && typeof count === "number" && count > DAILY_LIMIT) {
      return jsonResponse({ suggestions: [], error: `Limite diário de busca de endereço atingido (${DAILY_LIMIT}/dia).` }, 200);
    }

    const { input } = await req.json();
    const query = String(input || "").trim();
    if (query.length < 3) {
      return jsonResponse({ suggestions: [] });
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      // Sem chave configurada — falha "limpa": o front cai de volta pro
      // texto livre sem quebrar o formulário (mesmo espírito do mockup:
      // "sem resultado ou API fora do ar → campo se comporta como hoje").
      return jsonResponse({ suggestions: [], error: "GOOGLE_PLACES_API_KEY não configurada" }, 200);
    }

    const googleRes = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.placeId",
      },
      body: JSON.stringify({
        input: query,
        languageCode: "pt-BR",
        regionCode: "BR",
      }),
    });

    if (!googleRes.ok) {
      // MD-07 da auditoria de segurança (19/08/2026): repassar o corpo cru
      // do Google ao cliente fugia do padrão já usado em distance-matrix/
      // reverse-geocode — mensagem genérica pro cliente, detalhe só no log
      // do servidor (mesmo espírito, mesmo sem chave na URL aqui).
      const errText = await googleRes.text();
      console.error(`[places-autocomplete] Google HTTP ${googleRes.status}: ${errText}`);
      return jsonResponse({ suggestions: [], error: "Não foi possível buscar sugestões de endereço." }, 200);
    }

    const data = await googleRes.json();
    const suggestions = (data.suggestions || [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => ({
        placeId: p.placeId,
        description: p.text?.text || "",
        mainText: p.structuredFormat?.mainText?.text || p.text?.text || "",
        secondaryText: p.structuredFormat?.secondaryText?.text || "",
      }));

    return jsonResponse({ suggestions });
  } catch (e) {
    console.error(`[places-autocomplete] erro inesperado: ${String(e)}`);
    return jsonResponse({ suggestions: [], error: "Falha ao buscar sugestões de endereço." }, 200);
  }
});
