// Smoke: colapso por conta no relatório de conteúdo (PRD §8) + taxonomia §5.3.
// Roda sem banco: `node --import ./scripts/register-esm.mjs scripts/account-collapse-smoke.mjs`

import assert from "node:assert/strict";
import {
  accountKey,
  collapseLeadsToAccounts,
  accountMetrics,
  metricsForCampaignLeads,
} from "../src/utils/account-collapse.js";
import {
  isValidContentCampaignName,
  campaignNameError,
  contentCampaignPairKey,
} from "../src/utils/campaign-name.js";

assert.equal(accountKey({ clientId: "c1", cnpj: "11.222.333/0001-81", id: "l1" }), "client:c1");
assert.equal(accountKey({ cnpj: "11222333000181", id: "l1" }), "cnpj:11222333000181");
assert.equal(accountKey({ id: "l1" }), "lead:l1");

const campA = "camp-a";
const campB = "camp-b";
const leads = [
  { id: "l1", clientId: "c1", company: "Acme", stage: "prospeccao", campaignId: campA, value: 10 },
  { id: "l2", clientId: "c1", company: "Acme Ltda", stage: "ganho", campaignId: campB, value: 50 },
  { id: "l3", company: "Solo", stage: "perdido", campaignId: campA, value: 1 },
];

const accounts = collapseLeadsToAccounts(leads);
assert.equal(accounts.length, 2, "mesma empresa em duas campanhas = uma conta");
const acme = accounts.find(a => a.clientId === "c1");
assert.equal(acme.touchCount, 2);
assert.equal(acme.outcome, "won");
assert.deepEqual(new Set(acme.campaignIds), new Set([campA, campB]));

const totals = accountMetrics(accounts);
assert.equal(totals.accountCount, 2);
assert.equal(totals.wonAccountCount, 1);
assert.equal(totals.lostAccountCount, 1);
assert.equal(totals.touchCount, 3);
assert.equal(totals.accountConversion, 0.5);

const perA = metricsForCampaignLeads(leads, campA);
assert.equal(perA.accountCount, 2, "campanha A vê Acme (aberto) e Solo (perdido)");
assert.equal(perA.wonAccountCount, 0);
assert.equal(perA.openAccountCount, 1);

const perB = metricsForCampaignLeads(leads, campB);
assert.equal(perB.accountCount, 1);
assert.equal(perB.wonAccountCount, 1);

// Taxonomia §5.3 — smoke que a Fase 2 citava e não tinha arquivo.
assert.equal(isValidContentCampaignName("resibag-202609-rapp"), true);
assert.equal(isValidContentCampaignName("resibag-202609-multi-tema"), true);
assert.equal(isValidContentCampaignName("Resibag-202609-rapp"), false);
assert.equal(isValidContentCampaignName("resibag_202609_rapp"), false);
assert.equal(contentCampaignPairKey("resibag-202609-rapp"), "resibag-rapp");
assert.equal(contentCampaignPairKey("resibag-202610-rapp"), "resibag-rapp");
assert.ok(campaignNameError("feirão", "Conteúdo"));
assert.equal(campaignNameError("qualquer-coisa", "Evento"), null);

console.log("account-collapse-smoke: ok");
