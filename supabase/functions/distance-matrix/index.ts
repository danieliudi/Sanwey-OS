import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Proxy pro Google Distance Matrix API — mesmo padrão do places-autocomplete
// (auth via verify_jwt do próprio Supabase, CORS liberado pro app, chave
// GOOGLE_PLACES_API_KEY nunca exposta ao navegador). Usado pela Calculadora
// de custo de viagem (Comercial > Viagens) pra somar a distância de uma
// sequência de paradas (placeId do Google Places) em vez do km ser digitado
// na mão. Falha "limpa": qualquer erro (sem chave, Google fora do ar, sem
// rota entre dois pontos) devolve status 200 com `error` preenchido — o
// front cai de volta pro campo de km editável manualmente, nunca trava o
// fluxo (mesmo espírito do places-autocomplete).
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
    const { placeIds } = await req.json();
    const ids: string[] = Array.isArray(placeIds) ? placeIds.filter((id) => typeof id === "string" && id.trim()) : [];

    if (ids.length < 2) {
      return jsonResponse({ legs: [], totalKm: 0, error: "Informe ao menos 2 paradas com endereço selecionado." }, 200);
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      // Sem chave configurada — falha "limpa": o front cai de volta pro
      // campo de km editável manualmente (mesmo espírito do
      // places-autocomplete: "sem resultado ou API fora do ar → campo se
      // comporta como hoje").
      return jsonResponse({ legs: [], totalKm: null, error: "GOOGLE_PLACES_API_KEY não configurada" }, 200);
    }

    // Um trecho por par de paradas consecutivas: origins[i] → destinations[i].
    // A Distance Matrix API devolve uma matriz origins × destinations; como
    // pedimos o mesmo número de origins e destinations na mesma ordem, o
    // trecho i é sempre rows[i].elements[i] (a diagonal).
    const origins = ids.slice(0, -1);
    const destinations = ids.slice(1);

    const params = new URLSearchParams({
      origins: origins.map((id) => `place_id:${id}`).join("|"),
      destinations: destinations.map((id) => `place_id:${id}`).join("|"),
      units: "metric",
      mode: "driving",
      language: "pt-BR",
      region: "BR",
      key: apiKey,
    });

    const googleRes = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`);

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return jsonResponse({ legs: [], totalKm: null, error: `Google Distance Matrix: ${googleRes.status} ${errText}` }, 200);
    }

    const data = await googleRes.json();
    if (data.status !== "OK") {
      return jsonResponse({ legs: [], totalKm: null, error: `Google Distance Matrix: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}` }, 200);
    }

    const legs: { fromIndex: number; toIndex: number; distanceKm: number | null; distanceText: string | null; durationText: string | null }[] = [];
    let totalKm = 0;
    let anyFailed = false;

    origins.forEach((_origin, i) => {
      const element = data.rows?.[i]?.elements?.[i];
      if (element && element.status === "OK" && element.distance?.value != null) {
        const km = element.distance.value / 1000;
        totalKm += km;
        legs.push({
          fromIndex: i,
          toIndex: i + 1,
          distanceKm: Math.round(km * 10) / 10,
          distanceText: element.distance.text || null,
          durationText: element.duration?.text || null,
        });
      } else {
        anyFailed = true;
        legs.push({ fromIndex: i, toIndex: i + 1, distanceKm: null, distanceText: null, durationText: null });
      }
    });

    return jsonResponse({
      legs,
      totalKm: anyFailed ? null : Math.round(totalKm * 10) / 10,
      error: anyFailed ? "Não foi possível calcular a distância entre uma ou mais paradas." : null,
    });
  } catch (e) {
    return jsonResponse({ legs: [], totalKm: null, error: String(e) }, 200);
  }
});
