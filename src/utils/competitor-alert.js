// Alerta de menção a concorrente (18/08/2026) — Fase 1 do gap real
// levantado no doc Zoho: o dado já existe (AtaVozPanel.jsx grava
// `activity.meta.concorrente` em toda ata de visita, type "ata_voz"), só
// não era destacado — ficava enterrado na timeline do LeadDetailDrawer.
// Esta função só lê o que já está gravado; zero schema novo, zero RLS nova.
//
// Fase 2 (fora de escopo aqui, registrado na spec): scan de texto livre em
// notas manuais contra uma lista de concorrentes conhecidos, pra cobrir o
// caso do vendedor digitar direto sem passar pela Ata de voz.

const WINDOW_DAYS = 60;

export function recentCompetitorMention(activities, windowDays = WINDOW_DAYS) {
  const cutoff = Date.now() - windowDays * 86400000;
  let latest = null;
  for (const a of activities || []) {
    const name = a?.meta?.concorrente;
    if (!name) continue;
    const at = a.timestamp || a.createdAt;
    if (!at) continue;
    const ts = new Date(at).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;
    if (!latest || ts > latest.ts) latest = { name, ts, at };
  }
  return latest;
}

export default recentCompetitorMention;
