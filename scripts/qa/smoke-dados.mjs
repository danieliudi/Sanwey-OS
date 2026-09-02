// Varredura COM DADOS: as 52 rotas em desktop e celular, com a plataforma no
// caminho autenticado e todas as tabelas respondendo (Marketing, RH, Compras,
// Comex, Pós-venda, Funil).
//
// A diferença pra smoke-rotas.mjs: lá o Supabase não está configurado e todo
// board abre vazio — prova que a tela MONTA. Aqui cada board abre populado,
// então também exercita card, agrupamento por etapa, badge, avatar, prazo,
// ordenação e o cálculo de métrica em cima de dado real. Foi essa diferença
// que expôs o painel de Compras morto.
//
// Uso:  npm run qa:dados
import { chromium } from "playwright";
import { montarDados, QA_USER_ID } from "./fixtures/index.mjs";
import { instalarSupabaseFalso, sessaoFalsa, CHAVE_SESSAO } from "./supabase-falso.mjs";

const BASE = process.env.SMOKE_BASE || "http://localhost:5199";
const { ROUTES } = await import("../../src/constants/routes.js");

// Ruído esperado sem backend de verdade. Nunca filtra erro de código.
const IGNORAR = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /ServiceWorker|workbox/i,
  /Download the React DevTools/i,
  /realtime|websocket|WebSocket/i,   // Realtime não tem como ser interceptado
  /favicon/i,
];

const viewports = [
  { nome: "desktop", width: 1440, height: 900, mobile: false },
  { nome: "mobile ", width: 390, height: 844, mobile: true },
];

const dados = await montarDados();
const total = Object.entries(dados).reduce((s, [, v]) => s + v.length, 0);
console.log(`conjunto de dados: ${total} linhas em ${Object.keys(dados).length} tabelas`);
for (const [t, v] of Object.entries(dados)) if (v.length) console.log(`   ${String(v.length).padStart(4)}  ${t}`);
console.log("");

const achados = [];
const semFixture = new Set();

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }
    : {},
);

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile, hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 3 : 1,
  });

  const { naoConhecidas } = await instalarSupabaseFalso(ctx, dados, QA_USER_ID);

  // Sessão já gravada: evita depender do fluxo de login e deixa a varredura
  // determinística. As chaves de "já vi" desligam tour, spotlight e novidades,
  // que senão cobrem a tela com sobreposição e escondem o que interessa.
  await ctx.addInitScript(([chaveSessao, sessao, userId]) => {
    localStorage.setItem(chaveSessao, JSON.stringify(sessao));
    localStorage.setItem("gs_v4_onboarding", JSON.stringify({ [userId]: true }));
    localStorage.setItem("gs_v4_platform_tour_seen", JSON.stringify({ [userId]: true }));
    localStorage.setItem("gs_v4_changelog_seen", JSON.stringify({ [userId]: "99.0.0" }));
    localStorage.setItem("gs_v4_screen_tips_seen", JSON.stringify({ [userId]: ["*"] }));
    localStorage.setItem("gs_v4_feature_spotlights_seen", JSON.stringify({ [userId]: ["*"] }));
    localStorage.setItem("gs_v4_agents_coachmark_seen", JSON.stringify({ [userId]: true }));
  }, [CHAVE_SESSAO, sessaoFalsa(QA_USER_ID), QA_USER_ID]);

  const page = await ctx.newPage();

  for (const [secao, rota] of Object.entries(ROUTES)) {
    const erros = [];
    const onErr = (e) => erros.push("pageerror: " + (e?.message || e));
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
      await page.waitForTimeout(1800);
      const info = await page.evaluate(() => {
        const root = document.getElementById("root");
        const txt = (root?.innerText || "").trim();
        return {
          vazio: txt.length < 20,
          login: /Acessar sua conta|Entre com seu e-mail/.test(txt),
          amostra: txt.slice(0, 90).replace(/\s+/g, " "),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      if (info.vazio) erros.push("tela em branco (root com menos de 20 caracteres)");
      // Guarda contra o falso negativo que já aconteceu: varredura "limpa"
      // que na verdade era a tela de login em todas as rotas.
      if (info.login) erros.push("caiu na tela de LOGIN — a sessão falsa não foi aceita, a varredura inteira estaria mentindo");
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

  for (const t of naoConhecidas) semFixture.add(t);
  await ctx.close();
}
await browser.close();

if (semFixture.size) {
  // Não é erro: a tela pede a tabela e recebe lista vazia, que é um estado
  // legítimo. Mas é o mapa do que a varredura AINDA não cobre de verdade —
  // sem isso, "0 achados" seria lido como cobertura total.
  console.log("\n=== tabelas consultadas sem fixture (abriram vazias) ===");
  console.log([...semFixture].sort().join(", "));
}

console.log("\n================ ACHADOS (com dados) ================");
if (!achados.length) console.log("nenhum — todas as rotas montaram limpas nos 2 viewports, com dados");
for (const a of achados) {
  console.log(`\n[${a.vp}] ${a.secao}  ${a.rota}`);
  for (const e of a.erros) console.log("   • " + e);
  if (a.amostra) console.log("   ~ " + a.amostra);
}
console.log(`\ntotal: ${achados.length} rota(s) com achado`);
