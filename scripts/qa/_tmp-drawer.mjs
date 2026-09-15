import { chromium } from "playwright";
const BASE = process.env.SMOKE_BASE || "http://localhost:5199";
const OUT = "/tmp/claude-0/-home-user-sanwey-crm/0b49daa5-b62b-5e37-a958-fe487a220b78/scratchpad";
const USER = { id:"00000000-0000-4000-8000-000000000001", name:"Auditoria QA", email:"qa@local.invalid",
  role:"admin", roles:["admin","diretoria","gerente","vendedor"], companies:["industria","resibag"],
  initials:"QA", avatarBg:"#1D4ED8", avatarUrl:null, sectors:[] };
const SEED = { gs_v4_current_user: JSON.stringify(USER), gs_v4_onboarding: JSON.stringify({[USER.id]:true}),
  gs_v4_platform_tour_seen: JSON.stringify({[USER.id]:true}), gs_v4_changelog_seen: JSON.stringify({[USER.id]:"99.0.0"}),
  gs_v4_screen_tips_seen: JSON.stringify({[USER.id]:["*"]}), gs_v4_feature_spotlights_seen: JSON.stringify({[USER.id]:["*"]}),
  gs_v4_agents_coachmark_seen: JSON.stringify({[USER.id]:true}) };

const MEDIR = () => {
  const tabs = document.querySelector('[data-tour="lead-tab-visita"]');
  if (!tabs) return { erro: "SideTabs não encontrado" };
  const fixo = tabs.parentElement.parentElement;      // SideTabs wrapper -> div leftFixo
  const aside = tabs.closest("aside");
  const botao = [...aside.querySelectorAll("button")].find(x => /detalhes/.test(x.textContent));
  const meta = [...aside.children].find(c => c.className.includes("p-5") && !c.className.includes("order-first"));
  const cs = getComputedStyle(fixo);
  const bs = [...document.querySelectorAll('[data-tour^="lead-tab-"]')];
  const ativa = bs.find(x => getComputedStyle(x).backgroundColor !== "rgba(0, 0, 0, 0)");
  return {
    abaAtiva: ativa ? ativa.getAttribute("data-tour") : null,
    asideDisplay: getComputedStyle(aside).display,
    asideFlexDir: getComputedStyle(aside).flexDirection,
    leftFixo_classes: fixo.className,
    leftFixo_paddingTop: cs.paddingTop,
    leftFixo_order: cs.order,
    gap_topoDoAside_ateAsAbas: Math.round(fixo.getBoundingClientRect().top - aside.getBoundingClientRect().top),
    metaBlock_display: meta ? getComputedStyle(meta).display : null,
    metaBlock_paddingBottom: meta ? getComputedStyle(meta).paddingBottom : null,
    divisorEntreMetaEAbas: !!aside.querySelector('div[style*="border-top"]'),
    botaoDetalhes_texto: botao ? botao.textContent.trim() : null,
    botaoDetalhes_y: botao ? Math.round(botao.getBoundingClientRect().top) : null,
    abas_y: Math.round(fixo.getBoundingClientRect().top),
    botaoDepoisDasAbas: botao ? botao.getBoundingClientRect().top > fixo.getBoundingClientRect().top : null,
  };
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args:["--no-sandbox"] });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
await ctx.addInitScript((s)=>{for(const[k,v]of Object.entries(s))localStorage.setItem(k,v);}, SEED);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("PAGEERROR:", e.message));
await page.goto(BASE + "/", {waitUntil:"domcontentloaded"});
await page.evaluate(async () => { const m = await import("/src/data/generate-leads.js");
  localStorage.setItem("gs_v4_leads", JSON.stringify(m.generateLeadsForAllCompanies())); });
await page.goto(BASE + "/pipeline", {waitUntil:"domcontentloaded"});
await page.waitForTimeout(2500);
const cards = page.locator('div[draggable="true"]');
console.log("cards:", await cards.count());
await cards.first().click();
await page.waitForTimeout(2500);

console.log("\n=== DESKTOP 1440x900 ===");
console.log(JSON.stringify(await page.evaluate(MEDIR), null, 1));
await page.screenshot({ path: `${OUT}/desktop-drawer.png` });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
console.log("\n=== MOBILE 390x844 (mesmo drawer, so CSS) ===");
console.log(JSON.stringify(await page.evaluate(MEDIR), null, 1));
await page.screenshot({ path: `${OUT}/mobile-drawer.png` });

// mede tambem com a aba Form (conteudo longo) pra ver onde cai "+ detalhes"
await page.locator('[data-tour="lead-tab-form"]').click();
await page.waitForTimeout(900);
console.log("\n=== MOBILE, aba Form ===");
console.log(JSON.stringify(await page.evaluate(MEDIR), null, 1));
await page.screenshot({ path: `${OUT}/mobile-drawer-form.png`, fullPage: true });
await b.close();
