import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const COMEXSTAT_BASE = "https://api-comexstat.mdic.gov.br";
const CACHE_TTL_HOURS = 24;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(input) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" });
  }

  if (!body?.flow || !Array.isArray(body.ncms) || body.ncms.length === 0 || !body.from || !body.to) {
    return jsonResponse({ error: "Missing required fields: flow, ncms[], from, to" });
  }

  const details = Array.isArray(body.details) && body.details.length > 0 ? body.details : ["state"];
  const filters = [{ filter: "ncm", values: body.ncms }];
  if (body.states && body.states.length > 0) {
    filters.push({ filter: "state", values: body.states });
  }

  const payload = {
    flow: body.flow,
    monthDetail: details.includes("month"),
    period: { from: body.from, to: body.to },
    filters,
    details,
    metrics: ["metricFOB", "metricKG"],
  };

  const cacheKey = await sha256("comexstat:" + JSON.stringify(payload));

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = (supabaseUrl && serviceRole) ? createClient(supabaseUrl, serviceRole) : null;

  if (!body.refresh && admin) {
    try {
      const { data: cached } = await admin
        .from("external_cache")
        .select("payload, expires_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cached && new Date(cached.expires_at) > new Date()) {
        return jsonResponse({ cached: true, ...cached.payload });
      }
    } catch (e) {
      console.log("cache read failed", e?.message || e);
    }
  }

  let upstream;
  try {
    upstream = await fetch(`${COMEXSTAT_BASE}/general?language=pt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Sanwey-CRM-EdgeFunction/1.0",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log("fetch threw", e?.message || e);
    return jsonResponse({ error: "ComexStat unreachable", detail: String(e?.message || e), payload });
  }

  const rawText = await upstream.text();

  if (!upstream.ok) {
    console.log("upstream non-ok", upstream.status, rawText.slice(0, 300));
    return jsonResponse({
      error: "ComexStat upstream error",
      status: upstream.status,
      detail: rawText.slice(0, 500),
      sentPayload: payload,
    });
  }

  let upstreamJson;
  try {
    upstreamJson = JSON.parse(rawText);
  } catch (e) {
    return jsonResponse({ error: "ComexStat returned non-JSON", detail: rawText.slice(0, 500) });
  }

  const list = upstreamJson?.data?.list ?? [];

  const normalized = list.map((row) => ({
    state: row.state ?? row.noUf ?? null,
    ncm: row.ncm ?? row.coNcm ?? null,
    year: row.year ?? null,
    month: row.month ?? null,
    fob: Number(row.metricFOB ?? row.vlFob ?? 0),
    kg: Number(row.metricKG ?? row.kgLiquido ?? 0),
  }));

  const totals = normalized.reduce(
    (acc, r) => ({ fob: acc.fob + r.fob, kg: acc.kg + r.kg }),
    { fob: 0, kg: 0 },
  );

  const response = {
    cached: false,
    flow: body.flow,
    ncms: body.ncms,
    period: { from: body.from, to: body.to },
    details,
    rows: normalized,
    totals,
    count: normalized.length,
    fetchedAt: new Date().toISOString(),
  };

  if (admin) {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 3600_000).toISOString();
      await admin.from("external_cache").upsert({
        cache_key: cacheKey,
        source: "comexstat",
        payload: response,
        expires_at: expiresAt,
      });
    } catch (e) {
      console.log("cache write failed", e?.message || e);
    }
  }

  return jsonResponse(response);
});
