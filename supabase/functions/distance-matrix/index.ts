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
//
// SEGURANÇA (revisão 10/08/2026):
//  - A Distance Matrix API clássica (maps.googleapis.com/.../distancematrix)
//    só aceita a chave como query param `key=` — não existe equivalente ao
//    header `X-Goog-Api-Key` que o places-autocomplete usa (esse header é da
//    Places/Routes API "New"). Por isso a chave continua na URL aqui.
//  - Como a chave vai na URL, NENHUM erro bruto (nem `String(e)`, nem o corpo
//    de resposta do Google) pode voltar pro navegador: o `TypeError` de rede
//    do Deno inclui a URL completa, chave junto. Toda resposta de erro pro
//    cliente é uma mensagem genérica; o detalhe só vai pro log do servidor,
//    e ainda assim redigido (`key=REDACTED`).
//  - Teto de paradas: a API cobra por elemento, então o número de paradas
//    precisa de limite pra não virar vetor de custo.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Teto de paradas por cálculo (custo: a Distance Matrix cobra por elemento).
const MAX_STOPS = 10;

// Mensagem única devolvida ao cliente em qualquer falha inesperada — nunca
// `String(e)` nem o corpo de erro do Google, que podem carregar a URL com a
// chave da API.
const GENERIC_ERROR = "Falha ao consultar o serviço de distância.";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Redige a chave antes de qualquer log no servidor: tira tanto o padrão
// `key=...` da query string quanto o valor literal da chave, caso ele
// apareça em outro formato.
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
    const { placeIds } = await req.json();
    const raw: string[] = Array.isArray(placeIds) ? placeIds.filter((id) => typeof id === "string" && id.trim()) : [];

    // Dedupe de paradas consecutivas iguais: um trecho A→A custa um elemento
    // e sempre vale 0 km. `originalIndex` preserva a posição da parada na
    // lista que o front mandou, pra que os índices de `legs` continuem
    // apontando pro stop certo na tela.
    const stops: { id: string; originalIndex: number }[] = [];
    raw.forEach((id, originalIndex) => {
      if (stops.length === 0 || stops[stops.length - 1].id !== id) stops.push({ id, originalIndex });
    });

    if (stops.length < 2) {
      return jsonResponse({ legs: [], totalKm: 0, error: "Informe ao menos 2 paradas com endereço selecionado." }, 200);
    }

    if (stops.length > MAX_STOPS) {
      return jsonResponse({ legs: [], totalKm: null, error: `Máximo de ${MAX_STOPS} paradas por cálculo.` }, 200);
    }

    apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      // Sem chave configurada — falha "limpa": o front cai de volta pro
      // campo de km editável manualmente (mesmo espírito do
      // places-autocomplete: "sem resultado ou API fora do ar → campo se
      // comporta como hoje").
      return jsonResponse({ legs: [], totalKm: null, error: "GOOGLE_PLACES_API_KEY não configurada" }, 200);
    }

    // Uma chamada por trecho (par consecutivo), 1 origin × 1 destination =
    // 1 elemento cobrado por trecho. A matriz cruzada anterior cobrava
    // (N-1)² elementos pra usar só a diagonal (N-1) — com 10 paradas, 81
    // elementos pra usar 9.
    const pairs = stops.slice(0, -1).map((origin, i) => ({ origin, destination: stops[i + 1] }));

    const results = await Promise.all(pairs.map(async ({ origin, destination }) => {
      const params = new URLSearchParams({
        origins: `place_id:${origin.id}`,
        destinations: `place_id:${destination.id}`,
        units: "metric",
        mode: "driving",
        language: "pt-BR",
        region: "BR",
        key: apiKey!,
      });

      const googleRes = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`);

      if (!googleRes.ok) {
        const errText = await googleRes.text();
        // Log redigido no servidor; o cliente só recebe o trecho sem
        // distância (tratado como `anyFailed` abaixo).
        console.error(`[distance-matrix] Google HTTP ${googleRes.status}: ${redact(errText, apiKey)}`);
        return null;
      }

      const data = await googleRes.json();
      if (data.status !== "OK") {
        console.error(`[distance-matrix] Google status ${data.status}: ${redact(data.error_message ?? "", apiKey)}`);
        return null;
      }

      const element = data.rows?.[0]?.elements?.[0];
      if (!element || element.status !== "OK" || element.distance?.value == null) return null;
      return element;
    }));

    const legs: { fromIndex: number; toIndex: number; distanceKm: number | null; distanceText: string | null; durationText: string | null }[] = [];
    let totalKm = 0;
    let anyFailed = false;

    pairs.forEach(({ origin, destination }, i) => {
      const element = results[i];
      if (element) {
        const km = element.distance.value / 1000;
        totalKm += km;
        legs.push({
          fromIndex: origin.originalIndex,
          toIndex: destination.originalIndex,
          distanceKm: Math.round(km * 10) / 10,
          distanceText: element.distance.text || null,
          durationText: element.duration?.text || null,
        });
      } else {
        anyFailed = true;
        legs.push({ fromIndex: origin.originalIndex, toIndex: destination.originalIndex, distanceKm: null, distanceText: null, durationText: null });
      }
    });

    return jsonResponse({
      legs,
      totalKm: anyFailed ? null : Math.round(totalKm * 10) / 10,
      error: anyFailed ? "Não foi possível calcular a distância entre uma ou mais paradas." : null,
    });
  } catch (e) {
    // NUNCA `String(e)` pro cliente: o TypeError de rede do Deno traz a URL
    // completa, chave incluída.
    console.error(`[distance-matrix] erro inesperado: ${redact(e, apiKey)}`);
    return jsonResponse({ legs: [], totalKm: null, error: GENERIC_ERROR }, 200);
  }
});
