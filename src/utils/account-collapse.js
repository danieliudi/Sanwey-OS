// Agregação por CONTA sobre a lista que o relatório já filtrou.
// Não é um segundo motor: computeFairMetrics continua contando leads
// (custo, CAC/lead, idade). Aqui só colapsa pra unidade ABM (PRD §8).
//
// Chave, nesta ordem: client_id → CNPJ (14 dígitos) → o próprio lead.
// Dois contatos da mesma empresa, de duas peças, viram uma conta com dois
// toques — não duas conversões.

import { normalizeCnpjDigits } from "./client-dedup";

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

/**
 * Colapsa leads em contas. `wonStages`/`lostStages` aceitam Set ou array
 * (mesmo vocabulário de fair-report.js). Sem fit_score — isso é da tela ABM.
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
    const cid = lead.campaignId ?? lead.campaign_id;
    if (cid) acc.campaignIds.add(cid);
  }

  const accounts = [];
  for (const acc of map.values()) {
    const anyWon = acc.leads.some(l => wonSet.has(l.stage));
    const anyOpen = acc.leads.some(l => !wonSet.has(l.stage) && !lostSet.has(l.stage));
    const outcome = anyWon ? "won" : anyOpen ? "open" : "lost";
    accounts.push({
      key: acc.key,
      clientId: acc.clientId,
      cnpj: acc.cnpj,
      name: acc.name,
      touchCount: acc.leads.length,
      campaignIds: [...acc.campaignIds],
      outcome,
      leads: acc.leads,
    });
  }
  return accounts;
}

// Origem do número (regra 14 do CLAUDE.md): conta uma linha por empresa
// compradora, classificada em `outcome` por `collapseLeadsToAccounts` a partir
// de `wonStages`/`lostStages`. `accountConversion` é **ganhas ÷ decididas**,
// onde decididas = ganhas + perdidas — as ABERTAS ficam de fora do
// denominador de propósito (ainda não decidiram nada), e por isso quem exibe
// o número tem que mostrar quantas ficaram de fora.
//
// Devolve `null` (não `0`) quando não há nenhuma conta decidida: 0% e
// "não dá pra saber" são coisas diferentes, e quem renderiza precisa
// distinguir as duas.
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
  };
}

export function metricsForCampaignLeads(leads, campaignId, stages) {
  const ofCamp = (leads || []).filter(l => (l.campaignId || l.campaign_id) === campaignId);
  return accountMetrics(collapseLeadsToAccounts(ofCamp, stages));
}

export default {
  accountKey,
  collapseLeadsToAccounts,
  accountMetrics,
  metricsForCampaignLeads,
};
