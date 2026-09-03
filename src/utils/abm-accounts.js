// Agregação ABM — unidade é a CONTA, não o lead (PRD rastreio §8 / Fase 4).
// Não é um segundo motor de métricas: computeFairMetrics continua contando
// leads. Aqui só colapsa a lista já filtrada na chave de conta.
//
// Chave, nesta ordem: client_id → CNPJ (14 dígitos) → o próprio lead.
// Dois contatos da mesma empresa, de duas peças, viram uma conta com dois
// toques — não duas conversões.

import { normalizeCnpjDigits } from "./client-dedup";
import { computeFitScore } from "./pipeline-metrics";

export const CONTENT_ABM_CHANNELS = ["Conteúdo", "Digital"];

export function accountKey(lead) {
  if (!lead) return null;
  const clientId = lead.clientId ?? lead.client_id ?? null;
  if (clientId) return `client:${clientId}`;
  const cnpj = normalizeCnpjDigits(lead.cnpj);
  if (cnpj.length === 14) return `cnpj:${cnpj}`;
  if (lead.id) return `lead:${lead.id}`;
  return null;
}

function asSet(stages, fallback) {
  if (stages instanceof Set) return stages;
  if (Array.isArray(stages)) return new Set(stages);
  return new Set(fallback);
}

function pickName(lead) {
  return (lead.company || lead.razaoSocial || lead.razao_social || "").trim();
}

function activityTime(lead) {
  const ref = lead.lastActivity || lead.stageChangedAt || lead.negotiationStartedAt || lead.createdAt;
  const t = ref ? new Date(ref).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Colapsa leads em contas. `wonStages`/`lostStages` aceitam Set ou array
 * (mesmo vocabulário de fair-report.js).
 */
export function collapseLeadsToAccounts(leads, { wonStages, lostStages } = {}) {
  const wonSet = asSet(wonStages, ["ganho"]);
  const lostSet = asSet(lostStages, ["perdido"]);
  const map = new Map();

  for (const lead of leads || []) {
    const key = accountKey(lead);
    if (!key) continue;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        key,
        clientId: lead.clientId ?? lead.client_id ?? null,
        cnpj: normalizeCnpjDigits(lead.cnpj) || null,
        name: pickName(lead) || "—",
        companyId: lead.companyId ?? lead.company_id ?? null,
        sector: lead.sector || null,
        leads: [],
        campaignIds: new Set(),
      };
      map.set(key, acc);
    }
    acc.leads.push(lead);
    if (!acc.clientId && (lead.clientId || lead.client_id)) {
      acc.clientId = lead.clientId || lead.client_id;
    }
    const name = pickName(lead);
    if (name && (acc.name === "—" || name.length > acc.name.length)) acc.name = name;
    if (!acc.sector && lead.sector) acc.sector = lead.sector;
    const cid = lead.campaignId ?? lead.campaign_id;
    if (cid) acc.campaignIds.add(cid);
  }

  const accounts = [];
  for (const acc of map.values()) {
    const anyWon = acc.leads.some(l => wonSet.has(l.stage));
    const anyOpen = acc.leads.some(l => !wonSet.has(l.stage) && !lostSet.has(l.stage));
    const outcome = anyWon ? "won" : anyOpen ? "open" : "lost";
    const valueWon = acc.leads
      .filter(l => wonSet.has(l.stage))
      .reduce((s, l) => s + (Number(l.value) || 0), 0);
    const valueOpen = acc.leads
      .filter(l => !wonSet.has(l.stage) && !lostSet.has(l.stage))
      .reduce((s, l) => s + (Number(l.value) || 0), 0);
    const fitScore = acc.leads.reduce((m, l) => Math.max(m, computeFitScore(l)), 0);
    const representative = [...acc.leads].sort((a, b) => {
      const rank = (l) => (wonSet.has(l.stage) ? 2 : lostSet.has(l.stage) ? 0 : 1);
      const d = rank(b) - rank(a);
      if (d !== 0) return d;
      return activityTime(b) - activityTime(a);
    })[0];

    accounts.push({
      key: acc.key,
      clientId: acc.clientId,
      cnpj: acc.cnpj,
      name: acc.name,
      companyId: acc.companyId,
      sector: acc.sector,
      touchCount: acc.leads.length,
      campaignIds: [...acc.campaignIds],
      outcome,
      stage: representative?.stage || null,
      valueWon,
      valueOpen,
      fitScore,
      representative,
      leads: acc.leads,
    });
  }

  accounts.sort((a, b) => b.fitScore - a.fitScore || b.touchCount - a.touchCount || a.name.localeCompare(b.name));
  return accounts;
}

export function accountMetrics(accounts) {
  const list = accounts || [];
  const won = list.filter(a => a.outcome === "won").length;
  const lost = list.filter(a => a.outcome === "lost").length;
  const open = list.filter(a => a.outcome === "open").length;
  const decided = won + lost;
  return {
    accountCount: list.length,
    wonAccountCount: won,
    lostAccountCount: lost,
    openAccountCount: open,
    accountConversion: decided > 0 ? won / decided : null,
    touchCount: list.reduce((s, a) => s + a.touchCount, 0),
    avgFit: list.length > 0
      ? Math.round(list.reduce((s, a) => s + a.fitScore, 0) / list.length)
      : 0,
  };
}

/** Leads de campanha Conteúdo/Digital, sem demo. */
export function contentOriginLeads(leads, campaigns) {
  const ids = new Set(
    (campaigns || [])
      .filter(c => CONTENT_ABM_CHANNELS.includes(c.channel))
      .map(c => c.id)
  );
  return (leads || []).filter(l => {
    if (l.isDemo || l.is_demo) return false;
    const cid = l.campaignId ?? l.campaign_id;
    return cid && ids.has(cid);
  });
}
