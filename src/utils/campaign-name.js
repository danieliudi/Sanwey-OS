// Taxonomia de nome de campanha — PRD rastreio §5.3 / §10.
//
// Formato: {frente}-{aaaamm}-{tema}
// Ex.: resibag-202609-rapp · sanwey-202610-exportacao
//
// Só canais Conteúdo e Digital (mídia paga com o mesmo formato). Evento e
// demais canais ficam livres — feira já tem histórico de nomes livres.
//
// Minúsculas, ASCII, hífen. Sem acento, espaço, underscore, barra, ponto.

/** Canais cujo nome precisa seguir a taxonomia da §5.3. */
export const TAXONOMY_CHANNELS = new Set(["Conteúdo", "Digital"]);

export const CAMPAIGN_NAME_FORMAT = "{frente}-{aaaamm}-{tema}";

export const CAMPAIGN_NAME_HINT =
  "Formato: frente-aaaamm-tema (minúsculas, sem acento). Ex.: resibag-202609-rapp";

// frente = letras/números; aaaamm = 6 dígitos; tema = um ou mais segmentos
// [a-z0-9] separados por hífen (ex.: exportacao, multi-tema).
const NAME_RE = /^[a-z0-9]+-\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function requiresCampaignTaxonomy(channel) {
  return TAXONOMY_CHANNELS.has(channel);
}

/** true se o nome bate o formato da §5.3 (já trimado / lower). */
export function isValidContentCampaignName(name) {
  const n = String(name || "").trim();
  if (!n) return false;
  if (n !== n.toLowerCase()) return false;
  if (/[^a-z0-9-]/.test(n)) return false;
  return NAME_RE.test(n);
}

/**
 * Mensagem de erro curta, ou null se ok / se o canal não exige taxonomia.
 * Canal vazio/outro → não valida (criação ainda sem canal escolhido).
 */
export function campaignNameError(name, channel) {
  if (!requiresCampaignTaxonomy(channel)) return null;
  const n = String(name || "").trim();
  if (!n) return "Nome da campanha é obrigatório.";
  if (n !== n.toLowerCase()) {
    return `Use só minúsculas. ${CAMPAIGN_NAME_HINT}`;
  }
  if (/[àáâãäåèéêëìíîïòóôõöùúûüçñ]/i.test(n) || /[^a-z0-9-]/.test(n)) {
    return `Só ASCII e hífen — sem acento, espaço ou underscore. ${CAMPAIGN_NAME_HINT}`;
  }
  if (!NAME_RE.test(n)) {
    return `Nome fora do formato ${CAMPAIGN_NAME_FORMAT}. ${CAMPAIGN_NAME_HINT}`;
  }
  return null;
}

/**
 * Chave de pareamento pra comparar edições do mesmo tema na mesma frente,
 * ignorando o mês (aaaamm). `resibag-202609-rapp` e `resibag-202610-rapp`
 * → `resibag-rapp`. Nome fora do formato → null (não compara).
 */
export function contentCampaignPairKey(name) {
  const n = String(name || "").trim().toLowerCase();
  const m = n.match(/^([a-z0-9]+)-(\d{6})-(.+)$/);
  if (!m) return null;
  return `${m[1]}-${m[3]}`;
}

export default {
  TAXONOMY_CHANNELS,
  CAMPAIGN_NAME_FORMAT,
  CAMPAIGN_NAME_HINT,
  requiresCampaignTaxonomy,
  isValidContentCampaignName,
  campaignNameError,
  contentCampaignPairKey,
};
