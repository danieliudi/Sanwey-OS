// Varredura de montagem: abre TODA rota da plataforma num navegador real, em
// desktop e mobile, e reporta qualquer exceção não tratada / erro de console.
//
// Roda contra o dev server subido por scripts/qa/vite.smoke.config.js (ver
// o porquê da config separada lá): sem VITE_SUPABASE_*, `isSupabaseConfigured`
// é false e o App cai no caminho de usuário mock que já existe. Todo hook
// checa essa flag e devolve estado vazio. Ou seja: nenhum acesso ao banco de
// produção, nenhuma credencial, e ainda assim cada tela monta de verdade —
// que é onde ReferenceError/TDZ aparecem (4 telas mortas em 3 semanas, e
// NENHUMA pega pelo `npm run build`, porque o esbuild não faz análise de
// escopo).
//
// Uso:  npm run qa:smoke     (sobe o servidor, roda, derruba o servidor)
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE || "http://localhost:5199";
const { ROUTES } = await import("../../src/constants/routes.js");

const USER = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Auditoria QA",
  email: "qa@local.invalid",
  role: "admin",
  roles: ["admin", "diretoria", "gerente", "gerente_rh", "rh", "gerente_marketing", "marketing", "vendedor", "suporte"],
  companies: ["industria", "resibag", "cadeia"],
  initials: "QA",
  avatarBg: "#1D4ED8",
  avatarUrl: null,
  sectors: [],
};

const SEED = {
  gs_v4_current_user: JSON.stringify(USER),
  gs_v4_onboarding: JSON.stringify({ [USER.id]: true }),
  gs_v4_platform_tour_seen: JSON.stringify({ [USER.id]: true }),
  gs_v4_changelog_seen: JSON.stringify({ [USER.id]: "99.0.0" }),
  gs_v4_screen_tips_seen: JSON.stringify({ [USER.id]: ["*"] }),
  gs_v4_feature_spotlights_seen: JSON.stringify({ [USER.id]: ["*"] }),
  gs_v4_agents_coachmark_seen: JSON.stringify({ [USER.id]: true }),
};

// Ruído esperado num ambiente sem backend: falha de rede, service worker,
// aviso de dev do React sobre chave duplicada em lista já conhecida, etc.
// Só filtra o que comprovadamente vem da AUSÊNCIA de Supabase — nunca erro
// de código.
const IGNORAR = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /ServiceWorker|workbox/i,
  /Download the React DevTools/i,
  /supabase|VITE_SUPABASE/i,
  /favicon/i,
];

const viewports = [
  { nome: "desktop", width: 1440, height: 900, mobile: false },
  { nome: "mobile ", width: 390, height: 844, mobile: true },
];

const achados = [];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }
    : {},
);
for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 3 : 1,
  });
  await ctx.addInitScript((seed) => {
    for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, v);
  }, SEED);
  const page = await ctx.newPage();

  for (const [secao, rota] of Object.entries(ROUTES)) {
    const erros = [];
    const onErr = (e) => erros.push("pageerror: " + (e && e.message ? e.message : String(e)));
    const onMsg = (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      if (IGNORAR.some((r) => r.test(t))) return;
      erros.push("console: " + t.slice(0, 300));
    };
    page.on("pageerror", onErr);
    page.on("console", onMsg);
    try {
      await page.goto(BASE + rota, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1400);
      const info = await page.evaluate(() => {
        const root = document.getElementById("root");
        const txt = (root && root.innerText ? root.innerText : "").trim();
        return {
          vazio: txt.length < 20,
          amostra: txt.slice(0, 90).replace(/\s+/g, " "),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      if (info.vazio) erros.push("tela em branco (root com menos de 20 caracteres)");
      if (info.overflow > 2) erros.push(`rolagem horizontal: +${info.overflow}px além da viewport`);
      if (erros.length) achados.push({ vp: vp.nome, secao, rota, erros, amostra: info.amostra });
      console.log(`${vp.nome} ${erros.length ? "FALHA  " : "ok     "} ${rota}`);
    } catch (e) {
      achados.push({ vp: vp.nome, secao, rota, erros: ["navegação falhou: " + e.message.slice(0, 200)] });
      console.log(`${vp.nome} TIMEOUT ${rota}`);
    }
    page.off("pageerror", onErr);
    page.off("console", onMsg);
  }
  await ctx.close();
}
await browser.close();

console.log("\n================ ACHADOS ================");
if (!achados.length) console.log("nenhum — todas as rotas montaram limpas nos 2 viewports");
for (const a of achados) {
  console.log(`\n[${a.vp}] ${a.secao}  ${a.rota}`);
  for (const e of a.erros) console.log("   • " + e);
  if (a.amostra) console.log("   ~ " + a.amostra);
}
console.log(`\ntotal: ${achados.length} rota(s) com achado`);
