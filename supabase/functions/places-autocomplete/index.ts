import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
      const errText = await googleRes.text();
      return jsonResponse({ suggestions: [], error: `Google Places: ${googleRes.status} ${errText}` }, 200);
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
    return jsonResponse({ suggestions: [], error: String(e) }, 200);
  }
});
