import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BRASILAPI_BASE = "https://brasilapi.com.br/api/cnpj/v1";
const CACHE_TTL_DAYS = 7;
const CND_CACHE_TTL_HOURS = 24;

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

function normalizeCnpj(raw: string) {
  return (raw || "").replace(/\D/g, "");
}

function sizeFromPorte(porte: string) {
  if (!porte) return "";
  const p = porte.toUpperCase();
  if (p.includes("DEMAIS") || p.includes("GRANDE")) return "Enterprise";
  if (p.includes("MÉDIO") || p.includes("MEDIO") || p.includes("EPP")) return "Mid-Market";
  return "PME";
}

function normalizeBrasilApi(raw: Record<string, unknown>) {
  const cnpj = String(raw.cnpj ?? "");
  const razao = String(raw.razao_social ?? "");
  const fantasia = String(raw.nome_fantasia ?? "");
  const cnae = String(raw.cnae_fiscal ?? "");
  const cnaeDesc = String(raw.cnae_fiscal_descricao ?? "");
  const municipio = String(raw.municipio ?? "");
  const uf = String(raw.uf ?? "");
  const porte = String(raw.porte ?? "");

  return {
    cnpj: cnpj
      ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`
      : "",
    // Decidido com o Daniel 27/08/2026: razão social na frente. Antes o
    // fantasia vinha primeiro e, sem fantasia cadastrado na Receita, "nome"
    // virava lixo cadastral tipo "ESTABELECIMENTO UNIFICADO" em vez da razão
    // social real da empresa. Não migra nenhum lead/cliente já criado.
    company: razao || fantasia,
    razaoSocial: razao,
    sector: cnaeDesc || "—",
    cnae,
    cnaeDesc,
    size: sizeFromPorte(porte),
    porte,
    city: municipio && uf ? `${municipio}/${uf}` : municipio || uf || "—",
    state: uf || "—",
    address: [raw.descricao_tipo_de_logradouro, raw.logradouro, raw.numero, raw.bairro]
      .filter(Boolean)
      .join(", "),
    cep: String(raw.cep ?? ""),
    capitalSocial: Number(raw.capital_social ?? 0),
    naturezaJuridica: String(raw.natureza_juridica ?? ""),
    situacao: String(raw.descricao_situacao_cadastral ?? raw.situacao_cadastral ?? ""),
    situacaoEspecial: String(raw.situacao_especial ?? ""),
    email: String(raw.email ?? ""),
    telefone: String(raw.ddd_telefone_1 ?? ""),
    dataInicioAtividade: String(raw.data_inicio_atividade ?? ""),
    secundarias: Array.isArray(raw.cnaes_secundarios)
      ? (raw.cnaes_secundarios as Array<Record<string, unknown>>).map(c => ({
          code: String(c.codigo ?? ""),
          description: String(c.descricao ?? ""),
        }))
      : [],
  };
}

type CndStatus = "negativa" | "positiva_efeito_negativo" | "positiva" | "nao_verificado";

interface CndResult {
  status: CndStatus;
  label: string;
  message: string;
  checkedAt: string;
}

function cndStatusFromCode(code: number): { status: CndStatus; label: string } {
  // SERPRO status codes: 4 = Negativa, 5 = Positiva c/ Efeito de Negativa, 6+ = Positiva (débitos)
  if (code === 4) return { status: "negativa", label: "CND Negativa" };
  if (code === 5) return { status: "positiva_efeito_negativo", label: "Certidão Positiva c/ Efeito Negativo" };
  return { status: "positiva", label: "Débitos na União" };
}

async function checkCndSerpro(cnpj: string): Promise<CndResult | null> {
  const consumerKey = Deno.env.get("SERPRO_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("SERPRO_CONSUMER_SECRET");
  if (!consumerKey || !consumerSecret) return null;

  try {
    // 1. Obter token OAuth2
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch("https://gateway.apiserpro.serpro.gov.br/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!tokenRes.ok) return null;
    const { access_token } = await tokenRes.json() as { access_token: string };

    // 2. Consultar CND
    const cndRes = await fetch(
      "https://gateway.apiserpro.serpro.gov.br/consulta-cnd-trial/v1/certidao",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ TipoContribuinte: "PJ", ContribuinteConsulta: cnpj }),
      },
    );
    if (!cndRes.ok) return null;

    const data = await cndRes.json() as { Status: number; Mensagem?: string };
    const { status, label } = cndStatusFromCode(Number(data.Status));
    return {
      status,
      label,
      message: String(data.Mensagem ?? ""),
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "Autenticação necessária" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: "Edge function misconfigured" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRole);

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return jsonResponse({ error: "Sessão inválida" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const cnpj = normalizeCnpj(String(body?.cnpj || ""));
  if (cnpj.length !== 14) {
    return jsonResponse({ error: "CNPJ inválido", hint: "Informe 14 dígitos." }, 400);
  }

  const cacheKey = `cnpj:${cnpj}`;
  if (!body.refresh) {
    const { data: cached } = await admin
      .from("external_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (cached && new Date(cached.expires_at as string) > new Date()) {
      return jsonResponse({ cached: true, ...(cached.payload as object) });
    }
  }

  // Dados da Receita Federal via BrasilAPI
  const upstream = await fetch(`${BRASILAPI_BASE}/${cnpj}`, {
    headers: { "Accept": "application/json" },
  });

  if (upstream.status === 404) {
    return jsonResponse({ error: "CNPJ não encontrado na Receita Federal" }, 404);
  }
  if (upstream.status === 429) {
    return jsonResponse({ error: "Rate limit atingido na BrasilAPI. Tente novamente em instantes." }, 429);
  }
  if (!upstream.ok) {
    // BX-07 da auditoria de segurança (19/08/2026): repassar o corpo cru do
    // upstream ao cliente fugia do padrão adotado em distance-matrix/
    // reverse-geocode/places-autocomplete — mensagem genérica ao cliente,
    // detalhe só no log do servidor (BrasilAPI é pública/sem chave, então o
    // risco real era baixo, mas mantém o padrão consistente).
    const text = await upstream.text();
    console.error(`[cnpj-lookup] BrasilAPI HTTP ${upstream.status}: ${text.slice(0, 300)}`);
    return jsonResponse({ error: "Não foi possível consultar o CNPJ na Receita Federal no momento." }, 502);
  }

  const raw = await upstream.json() as Record<string, unknown>;
  const normalized = normalizeBrasilApi(raw);

  // CND Federal via SERPRO Trial (gratuito — requer SERPRO_CONSUMER_KEY e SERPRO_CONSUMER_SECRET)
  const cnd = await checkCndSerpro(cnpj);

  const response = {
    cached: false,
    ...normalized,
    cnd: cnd ?? { status: "nao_verificado" as CndStatus, label: "Fiscal não verificado", message: "", checkedAt: null },
    fetchedAt: new Date().toISOString(),
  };

  // Cache com TTL baseado no que tiver mais valor (CND = 24h, dados cadastrais = 7 dias)
  const cacheTtlHours = cnd ? CND_CACHE_TTL_HOURS : CACHE_TTL_DAYS * 24;
  const expiresAt = new Date(Date.now() + cacheTtlHours * 3_600_000).toISOString();
  await admin.from("external_cache").upsert({
    cache_key: cacheKey,
    source: "cnpj",
    payload: response,
    expires_at: expiresAt,
  });

  return jsonResponse(response);
});
