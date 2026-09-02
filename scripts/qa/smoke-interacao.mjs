// Rodada de INTERAÇÃO: a varredura de rotas só monta tela vazia. Aqui a
// plataforma abre com dados (o próprio gerador da plataforma,
// src/data/generate-leads.js, gravado no fallback de localStorage que
// use-leads.js já usa quando não há Supabase) e a sessão clica de verdade:
// abre card, navega abas do drawer, fecha com Esc, e no mobile toca no
// acordeão e no menu de ordenação dentro dele.
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE || "http://localhost:5199";
const USER = { id:"00000000-0000-4000-8000-000000000001", name:"Auditoria QA", email:"qa@local.invalid",
  role:"admin", roles:["admin","diretoria","gerente","gerente_rh","rh","gerente_marketing","marketing","vendedor","suporte"],
  companies:["industria","resibag"], initials:"QA", avatarBg:"#1D4ED8", avatarUrl:null, sectors:[] };
const SEED = {
  gs_v4_current_user: JSON.stringify(USER),
  gs_v4_onboarding: JSON.stringify({[USER.id]:true}),
  gs_v4_platform_tour_seen: JSON.stringify({[USER.id]:true}),
  gs_v4_changelog_seen: JSON.stringify({[USER.id]:"99.0.0"}),
  gs_v4_screen_tips_seen: JSON.stringify({[USER.id]:["*"]}),
  gs_v4_feature_spotlights_seen: JSON.stringify({[USER.id]:["*"]}),
  gs_v4_agents_coachmark_seen: JSON.stringify({[USER.id]:true}),
};
const IGNORAR = [/Failed to load resource/i, /net::ERR_/i, /ServiceWorker|workbox/i,
  /Download the React DevTools/i, /supabase|VITE_SUPABASE/i, /favicon/i];

const achados = [];
function coletar(page, ctxLabel) {
  const erros = [];
  page.on("pageerror", e => erros.push("pageerror: " + (e?.message || e)));
  page.on("console", m => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (IGNORAR.some(r => r.test(t))) return;
    erros.push("console: " + t.slice(0, 300));
  });
  return { erros, flush(passo) { if (erros.length) { achados.push({ ctx: ctxLabel, passo, erros: [...erros] }); erros.length = 0; } } };
}

const b = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }
    : {},
);

async function novoContexto(vp) {
  const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, isMobile: vp.mobile, hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 3 : 1 });
  await ctx.addInitScript((s)=>{for(const[k,v]of Object.entries(s))localStorage.setItem(k,v);}, SEED);
  const page = await ctx.newPage();
  // Semeia os leads usando o gerador da própria plataforma, resolvido pelo Vite.
  await page.goto(BASE + "/", {waitUntil:"domcontentloaded"});
  const n = await page.evaluate(async () => {
    const m = await import("/src/data/generate-leads.js");
    const leads = m.generateLeadsForAllCompanies();
    localStorage.setItem("gs_v4_leads", JSON.stringify(leads));
    return leads.length;
  });
  return { ctx, page, n };
}

// ---------- DESKTOP ----------
{
  const { ctx, page, n } = await novoContexto({ w:1440, h:900, mobile:false });
  console.log("leads semeados:", n);
  const c = coletar(page, "desktop");
  await page.goto(BASE + "/pipeline", {waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2000);
  c.flush("abrir /pipeline com dados");

  const cards = page.locator('[data-testid="lead-card"], [draggable="true"]');
  const totalCards = await cards.count();
  console.log("cards visíveis no funil:", totalCards);
  if (totalCards === 0) {
    achados.push({ ctx:"desktop", passo:"funil com dados", erros:["nenhum card renderizado apesar de "+n+" leads semeados"] });
  } else {
    await cards.first().click();
    await page.waitForTimeout(2200);
    c.flush("abrir drawer do lead");
    const abas = page.locator('[role="tab"], button:has-text("Atividades"), button:has-text("Histórico")');
    const nAbas = await abas.count();
    console.log("controles de aba encontrados no drawer:", nAbas);
    for (let i = 0; i < Math.min(nAbas, 8); i++) {
      const t = (await abas.nth(i).innerText().catch(()=>"?")).trim().slice(0,20);
      await abas.nth(i).click({ timeout: 4000 }).catch(()=>{});
      await page.waitForTimeout(900);
      c.flush("aba do drawer: " + t);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    c.flush("fechar drawer com Esc");
  }
  for (const r of ["/clientes", "/pos-venda", "/executivo", "/historico-funil"]) {
    await page.goto(BASE + r, {waitUntil:"domcontentloaded"});
    await page.waitForTimeout(1800);
    c.flush("abrir " + r + " com dados");
  }
  await ctx.close();
}

// ---------- MOBILE ----------
{
  const { ctx, page } = await novoContexto({ w:390, h:844, mobile:true });
  const c = coletar(page, "mobile");
  await page.goto(BASE + "/pipeline", {waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2200);
  c.flush("abrir /pipeline no celular");

  const headers = page.locator('[role="button"][aria-expanded]');
  const nH = await headers.count();
  console.log("cabeçalhos de etapa (role=button) no acordeão:", nH);
  if (nH === 0) {
    achados.push({ ctx:"mobile", passo:"acordeão", erros:["nenhum cabeçalho com role=button/aria-expanded — o acordeão mobile não montou"] });
  } else {
    const h = headers.nth(1);
    const antes = await h.getAttribute("aria-expanded");
    await h.click();
    await page.waitForTimeout(800);
    const depois = await h.getAttribute("aria-expanded");
    console.log(`toque no cabeçalho: aria-expanded ${antes} -> ${depois}`);
    if (antes === depois) achados.push({ ctx:"mobile", passo:"tocar no cabeçalho da etapa", erros:[`aria-expanded não mudou (${antes})`] });
    c.flush("tocar no cabeçalho da etapa");

    // Teclado: o cabeçalho tem que responder a Enter (o <button> dava de graça).
    await h.focus();
    const antesK = await h.getAttribute("aria-expanded");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
    const depoisK = await h.getAttribute("aria-expanded");
    console.log(`Enter no cabeçalho: aria-expanded ${antesK} -> ${depoisK}`);
    if (antesK === depoisK) achados.push({ ctx:"mobile", passo:"Enter no cabeçalho", erros:[`aria-expanded não mudou (${antesK}) — teclado não opera o acordeão`] });
    c.flush("Enter no cabeçalho");

    // Botão de ordenar DENTRO do cabeçalho: abre o menu e NÃO fecha a etapa.
    const sort = h.locator("button").first();
    if (await sort.count()) {
      const antesS = await h.getAttribute("aria-expanded");
      await sort.click();
      await page.waitForTimeout(700);
      const depoisS = await h.getAttribute("aria-expanded");
      const menuAberto = await page.locator("text=Mais recentes, text=Ordenar").count();
      console.log(`toque em ordenar: aria-expanded ${antesS} -> ${depoisS}`);
      if (antesS !== depoisS) achados.push({ ctx:"mobile", passo:"tocar em ordenar dentro do cabeçalho", erros:["o toque no menu de ordenação abriu/fechou a etapa junto (stopPropagation não segurou)"] });
      c.flush("tocar em ordenar dentro do cabeçalho");
    }
  }
  for (const r of ["/clientes", "/rh/funcionarios", "/tarefas-pessoais"]) {
    await page.goto(BASE + r, {waitUntil:"domcontentloaded"});
    await page.waitForTimeout(1700);
    c.flush("abrir " + r + " no celular");
  }
  await ctx.close();
}

await b.close();
console.log("\n================ ACHADOS (interação) ================");
if (!achados.length) console.log("nenhum");
for (const a of achados) {
  console.log(`\n[${a.ctx}] ${a.passo}`);
  for (const e of a.erros) console.log("   • " + e);
}
console.log(`\ntotal: ${achados.length}`);
