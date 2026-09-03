/**
 * Origem oculta do formulário público de captura (PRD rastreio §5.4 / Fase 3).
 *
 * UTM na query string → lead.campaign_id (via RPC) + custom_fields.
 * `?src=` legado continua válido como fallback de utm_source.
 *
 * Domínio do encurtador NÃO vive aqui — ver `shortener.js`. Sem domínio
 * estável o QR/link publicado continua na URL completa com UTM.
 */

/** Valores canônicos de utm_source (§5.4). */
export const UTM_SOURCES = Object.freeze([
  "linkedin",
  "instagram",
  "whatsapp",
  "email",
  "qr",
  "site",
]);

/** Valores canônicos de utm_medium (§5.4). */
export const UTM_MEDIUMS = Object.freeze([
  "post",
  "carrossel",
  "reels",
  "stories",
  "bio",
  "newsletter",
  "impresso",
  "assinatura",
]);

const SOURCE_SET = new Set(UTM_SOURCES);
const MEDIUM_SET = new Set(UTM_MEDIUMS);

/** content_id: {frente}-{4 hex} — PRD §5.2. */
const CONTENT_ID_RE = /^(rb|sw)-[0-9a-f]{4}$/;

/** Nome de campanha Conteúdo/Digital — mesmo espírito de campaign-name.js. */
const CAMPAIGN_NAME_RE = /^[a-z0-9]+-\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanParam(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
}

export function isContentId(value) {
  return CONTENT_ID_RE.test(String(value || "").trim().toLowerCase());
}

export function isCampaignName(value) {
  const n = String(value || "").trim().toLowerCase();
  return CAMPAIGN_NAME_RE.test(n);
}

/**
 * Lê UTM (+ src legado) de URLSearchParams ou de um Record.
 * Parâmetro vazio é ignorado (ruído — §5.4).
 */
export function parseAttributionSearchParams(params) {
  const get = (key) => {
    if (!params) return null;
    if (typeof params.get === "function") return cleanParam(params.get(key));
    return cleanParam(params[key]);
  };

  const utmSource = get("utm_source");
  const utmMedium = get("utm_medium");
  const utmCampaign = get("utm_campaign");
  const utmContent = get("utm_content");
  const legacySrc = get("src");

  return {
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    legacySrc,
    /** Fonte efetiva pra p_source / trigger_label. */
    source: utmSource || legacySrc || "site",
    hasUtm: Boolean(utmSource || utmMedium || utmCampaign || utmContent),
  };
}

/** true se o valor está na lista canônica (aviso suave — não bloqueia captura). */
export function isKnownUtmSource(value) {
  return SOURCE_SET.has(cleanParam(value) || "");
}

export function isKnownUtmMedium(value) {
  return MEDIUM_SET.has(cleanParam(value) || "");
}

/**
 * Bloco legível pra notes quando a RPC ainda não aceita params UTM
 * (migration pendente). Formato estável pra inspeção humana.
 */
export function formatAttributionNotesBlock(attr) {
  if (!attr?.hasUtm) return null;
  const lines = ["[atribuicao]"];
  if (attr.utmSource) lines.push(`utm_source=${attr.utmSource}`);
  if (attr.utmMedium) lines.push(`utm_medium=${attr.utmMedium}`);
  if (attr.utmCampaign) lines.push(`utm_campaign=${attr.utmCampaign}`);
  if (attr.utmContent) lines.push(`utm_content=${attr.utmContent}`);
  return lines.join("\n");
}

/**
 * Args extras da RPC `submit_lead_capture` (Fase 3). Só enviar depois da
 * migration aplicada — senão PostgREST rejeita o nome do parâmetro.
 */
export function buildLeadCaptureUtmArgs(attr) {
  if (!attr?.hasUtm) return {};
  return {
    p_utm_source: attr.utmSource,
    p_utm_medium: attr.utmMedium,
    p_utm_campaign: attr.utmCampaign,
    p_utm_content: attr.utmContent,
  };
}

/**
 * PostgREST PGRST202 / schema cache: função sem os params UTM ainda.
 * Usado pro fallback que grava a origem em notes.
 */
export function isMissingUtmRpcError(err) {
  const msg = String(err?.message || err?.details || err || "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("p_utm_") ||
    msg.includes("could not find the function") ||
    msg.includes("pgrst202") ||
    (msg.includes("schema cache") && msg.includes("submit_lead_capture"))
  );
}

export default {
  UTM_SOURCES,
  UTM_MEDIUMS,
  isContentId,
  isCampaignName,
  parseAttributionSearchParams,
  isKnownUtmSource,
  isKnownUtmMedium,
  formatAttributionNotesBlock,
  buildLeadCaptureUtmArgs,
  isMissingUtmRpcError,
};
