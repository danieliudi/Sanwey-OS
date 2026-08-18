import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Proxy pro Google Geocoding API (reverse geocode) — mesma chave
// GOOGLE_PLACES_API_KEY já usada por places-autocomplete/distance-matrix,
// nenhum provedor novo. Transforma a coordenada do check-in de visita
// (AtaVozPanel.jsx) num endereço legível. Falha "limpa": sem chave, sem
// resultado, ou Google fora do ar devolvem status 200 com `address: null` —
// o front cai de volta pra mostrar só a coordenada + link de mapa, nunca
// trava o salvamento da ata (mesmo espírito do places-autocomplete e do
// distance-matrix).
//
// SEGURANÇA: a Geocoding API clássica só aceita a chave via query param
// `key=` (mesma limitação do distance-matrix, não é a Places API "New").
// Por isso nenhum erro bruto (nem `String(e)`, nem o corpo de resposta do
// Google) pode voltar pro cliente — o TypeError de rede do Deno inclui a
// URL completa, chave junto. Toda resposta de erro pro cliente é uma
// mensagem genérica; o detalhe vai só pro log do servidor, redigido.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_ERROR = "Falha ao consultar o endereço.";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Mesma função de redação do distance-matrix — tira o padrão `key=...` da
// query string e o valor literal da chave, caso apareça em outro formato.
function redact(value: unknown, apiKey?: string): string {
  let text = typeof value === "string" ? value : String(value);
  text = text.replace(/([?&]key=)[^&\s)"']+/gi, "$1REDACTED");
  if (apiKey) text = text.split(apiKey).join("REDACTED");
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let apiKey: string | undefined;

  try {
    const { lat, lng } = await req.json();
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return jsonResponse({ address: null, error: "Coordenada inválida." }, 200);
    }

    apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      // Sem chave configurada — falha "limpa": o front mostra só a
      // coordenada + link de mapa (mesmo espírito de places-autocomplete /
      // distance-matrix).
      return jsonResponse({ address: null, error: "GOOGLE_PLACES_API_KEY não configurada" }, 200);
    }

    const params = new URLSearchParams({
      latlng: `${latNum},${lngNum}`,
      language: "pt-BR",
      region: "BR",
      key: apiKey,
    });

    const googleRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error(`[reverse-geocode] Google HTTP ${googleRes.status}: ${redact(errText, apiKey)}`);
      return jsonResponse({ address: null, error: "Não foi possível consultar o endereço." }, 200);
    }

    const data = await googleRes.json();
    if (data.status === "ZERO_RESULTS") {
      return jsonResponse({ address: null, error: null }, 200);
    }
    if (data.status !== "OK") {
      console.error(`[reverse-geocode] Google status ${data.status}: ${redact(data.error_message ?? "", apiKey)}`);
      return jsonResponse({ address: null, error: "Não foi possível consultar o endereço." }, 200);
    }

    const formatted = data.results?.[0]?.formatted_address || null;
    return jsonResponse({ address: formatted, error: null });
  } catch (e) {
    // NUNCA `String(e)` pro cliente: o TypeError de rede do Deno traz a URL
    // completa, chave incluída.
    console.error(`[reverse-geocode] erro inesperado: ${redact(e, apiKey)}`);
    return jsonResponse({ address: null, error: GENERIC_ERROR }, 200);
  }
});
