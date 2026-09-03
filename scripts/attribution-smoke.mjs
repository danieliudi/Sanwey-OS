/**
 * Smoke da origem UTM do formulário público (PRD rastreio Fase 3).
 * Roda sem browser: `node scripts/attribution-smoke.mjs`
 */
import assert from "node:assert/strict";
import {
  parseAttributionSearchParams,
  formatAttributionNotesBlock,
  buildLeadCaptureUtmArgs,
  isMissingUtmRpcError,
  isContentId,
  isCampaignName,
} from "../src/utils/attribution.js";
import {
  getShortenerBase,
  isShortenerConfigured,
  buildShortUrl,
} from "../src/utils/shortener.js";

const full = parseAttributionSearchParams(new URLSearchParams(
  "utm_source=linkedin&utm_medium=carrossel&utm_campaign=resibag-202609-rapp&utm_content=rb-7a2f",
));
assert.equal(full.source, "linkedin");
assert.equal(full.utmCampaign, "resibag-202609-rapp");
assert.equal(full.utmContent, "rb-7a2f");
assert.equal(full.hasUtm, true);
assert.ok(isContentId(full.utmContent));
assert.ok(isCampaignName(full.utmCampaign));

const legacy = parseAttributionSearchParams(new URLSearchParams("src=whatsapp"));
assert.equal(legacy.source, "whatsapp");
assert.equal(legacy.hasUtm, false);

const mixed = parseAttributionSearchParams(new URLSearchParams(
  "src=site&utm_source=instagram&utm_medium=bio",
));
assert.equal(mixed.source, "instagram");

const block = formatAttributionNotesBlock(full);
assert.match(block, /\[atribuicao\]/);
assert.match(block, /utm_campaign=resibag-202609-rapp/);

const args = buildLeadCaptureUtmArgs(full);
assert.equal(args.p_utm_source, "linkedin");
assert.equal(args.p_utm_content, "rb-7a2f");
assert.deepEqual(buildLeadCaptureUtmArgs(legacy), {});

assert.equal(isMissingUtmRpcError({ message: "Could not find the function public.submit_lead_capture(p_utm_source) in the schema cache" }), true);
assert.equal(isMissingUtmRpcError({ message: "Nome do cliente é obrigatório" }), false);

// Encurtador: sem env → null (não inventa domínio).
assert.equal(isShortenerConfigured(), false);
assert.equal(getShortenerBase(), null);
assert.equal(buildShortUrl("rb-7k2f"), null);

console.log("ok attribution + shortener scaffolding");
