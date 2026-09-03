// Smoke da agregação ABM (Fase 4) + fórmula determinística de fit_score.
// Roda sem banco: `node scripts/abm-smoke.mjs`

import assert from "node:assert/strict";
import { accountKey, collapseLeadsToAccounts, accountMetrics, contentOriginLeads } from "../src/utils/abm-accounts.js";
import { computeFitScore } from "../src/utils/pipeline-metrics.js";

const now = new Date().toISOString();

// ── fit_score: mesma fórmula da spec (segmento 40 / valor 30 / recência 30)
const resibagCore = computeFitScore({
  companyId: "resibag",
  sector: "Resíduos",
  value: 200000,
  createdAt: now,
  lastActivity: now,
});
assert.equal(resibagCore, 100, "Resibag + Resíduos + teto de valor + recência = 100");

const noSector = computeFitScore({
  companyId: "industria",
  sector: null,
  value: 0,
  createdAt: now,
  lastActivity: now,
});
assert.equal(noSector, 30, "sem setor e sem valor: só recência (30)");

const offCore = computeFitScore({
  companyId: "industria",
  sector: "Resíduos",
  value: 0,
  createdAt: now,
  lastActivity: now,
});
assert.equal(offCore, 46, "Sanwey + Resíduos (fora do núcleo) = 40*0.4 + 30 recência");

// ── chave de conta
assert.equal(accountKey({ clientId: "c1", cnpj: "11.222.333/0001-81", id: "l1" }), "client:c1");
assert.equal(accountKey({ cnpj: "11222333000181", id: "l1" }), "cnpj:11222333000181");
assert.equal(accountKey({ id: "l1" }), "lead:l1");

// ── dois toques da mesma conta = uma conversão
const campA = "camp-conteudo";
const leads = [
  { id: "l1", clientId: "c1", company: "Acme", cnpj: "11222333000181", stage: "prospeccao", value: 10000, campaignId: campA, companyId: "industria", sector: "Alimentício", createdAt: now, lastActivity: now },
  { id: "l2", clientId: "c1", company: "Acme Ltda", cnpj: "11222333000181", stage: "ganho", value: 50000, campaignId: campA, companyId: "industria", sector: "Alimentício", createdAt: now, lastActivity: now },
  { id: "l3", idOnly: true, company: "Solo", stage: "perdido", value: 1, campaignId: campA, companyId: "industria", createdAt: now, lastActivity: now, id: "l3" },
];

const accounts = collapseLeadsToAccounts(leads);
assert.equal(accounts.length, 2);
const acme = accounts.find(a => a.clientId === "c1");
assert.equal(acme.touchCount, 2);
assert.equal(acme.outcome, "won");
assert.equal(acme.valueWon, 50000);
assert.ok(acme.fitScore > 0);

const metrics = accountMetrics(accounts);
assert.equal(metrics.accountCount, 2);
assert.equal(metrics.wonAccountCount, 1);
assert.equal(metrics.lostAccountCount, 1);
assert.equal(metrics.touchCount, 3);
assert.equal(metrics.accountConversion, 0.5);

const origin = contentOriginLeads(
  [...leads, { id: "demo", isDemo: true, campaignId: campA }],
  [{ id: campA, channel: "Conteúdo" }, { id: "feira", channel: "Evento" }],
);
assert.equal(origin.length, 3);
assert.equal(contentOriginLeads(leads, [{ id: "feira", channel: "Evento" }]).length, 0);

console.log("abm-smoke: ok");
