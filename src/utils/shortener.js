/**
 * Encurtador próprio — scaffolding (PRD rastreio Fase 3).
 *
 * Link publicado não aceita implementação parcial (§3 / §11). Sem domínio
 * estável em `VITE_SHORTENER_BASE`, este módulo devolve null e o QR/UTM
 * continua na URL completa da landing. Não inventar domínio.
 *
 * Quando Daniel definir o domínio: setar a env no build (Netlify) e só então
 * passar a emitir short links. A rota de redirect ainda precisa existir no
 * host do domínio — fora deste PR até a decisão.
 */

function readBase() {
  const raw = (import.meta.env?.VITE_SHORTENER_BASE || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Origem https do encurtador, ou null se não configurado. */
export function getShortenerBase() {
  return readBase();
}

export function isShortenerConfigured() {
  return readBase() !== null;
}

/**
 * Monta `{base}/{content_id}` em minúsculas.
 * Retorna null se o encurtador não está configurado ou o id é inválido.
 */
export function buildShortUrl(contentId) {
  const base = readBase();
  if (!base) return null;
  const id = String(contentId || "").trim().toLowerCase();
  if (!/^(rb|sw)-[0-9a-f]{4}$/.test(id)) return null;
  return `${base}/${id}`;
}

export default {
  getShortenerBase,
  isShortenerConfigured,
  buildShortUrl,
};
