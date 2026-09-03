// Confere se docs/mapa-funcional.md envelheceu.
//
// Por que existe: o README já tem uma árvore de `src/` que descreve 7 views
// quando existem 58 — documentação de estrutura apodrece em silêncio. Este
// script recalcula do código os números que o mapa declara na seção 0 e falha
// apontando a divergência.
//
// O que ele NÃO faz: não lê o texto das descrições. Uma tela cuja função
// mudou continua descrita errada e o script passa. Ele pega o que é contável
// — rota nova, view nova, tabela nova, edge function nova.
//
// De propósito FORA do `prebuild`: doc defasado não deve travar deploy.
// Rode em auditoria e quando nascer módulo novo.
//
// Uso:  node scripts/mapa-funcional-check.mjs
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const DOC = path.join(RAIZ, "docs/mapa-funcional.md");
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");

// ── o que o código diz ────────────────────────────────────────────────────
const { ROUTES } = await import(path.join(RAIZ, "src/constants/routes.js"));
const app = ler("src/App.jsx");

// Redirect puro = a rota inteira é um <Navigate>, sem view nenhuma. Não conta
// o <Navigate> de guarda de cargo (`isAgencia ? <Navigate/> : <XView/>`),
// que é fallback, não redirect de rota.
// Redirect puro = o element da rota é SÓ um <Navigate>, sem view nenhuma.
// Não conta o <Navigate> de guarda de cargo (`isAgencia ? <Navigate/> :
// <CRMView/>`), que é fallback pra quem não pode ver, não redirect de rota.
//
// Precisa contar chaves de verdade: tanto delimitar o element por regex
// quanto cortar no primeiro "/>" dão errado — o primeiro porque o element
// contém `{ROUTES.x}` aninhado, o segundo porque o <Navigate/> de guarda
// fecha antes da view aparecer. Os dois atalhos foram tentados e erraram a
// conta (6 e 20, contra 7).
function elementDaRota(bloco) {
  const i = bloco.indexOf("element={");
  if (i < 0) return "";
  let nivel = 0;
  for (let j = i + "element=".length; j < bloco.length; j++) {
    if (bloco[j] === "{") nivel++;
    else if (bloco[j] === "}") { nivel--; if (nivel === 0) return bloco.slice(i, j + 1); }
  }
  return "";
}

const redirects = [];
for (const bloco of app.split(/<Route\b/).slice(1)) {
  const m = bloco.match(/^\s*path=\{ROUTES(?:\.([a-zA-Z-]+)|\["([a-zA-Z-]+)"\])\}/);
  if (!m) continue;
  const el = elementDaRota(bloco);
  if (/<Navigate/.test(el) && !/<[A-Z][A-Za-z]*(View|Dashboard|Manager|Screen)/.test(el)) {
    redirects.push(m[1] || m[2]);
  }
}

const publicas = [...ler("src/main.jsx").matchAll(/<Route\s+path="([^"]+)"/g)]
  .map(m => m[1]).filter(p => !p.includes("*"));

const views = fs.readdirSync(path.join(RAIZ, "src/components/views")).filter(f => f.endsWith(".jsx"));
const hooksDir = path.join(RAIZ, "src/hooks");
const hooks = fs.readdirSync(hooksDir).filter(f => /\.jsx?$/.test(f));

function fatos(t) {
  const consts = {};
  for (const m of t.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*["'`]([a-z0-9_]+)["'`]/g)) consts[m[1]] = m[2];
  const tab = new Set();
  const semStorage = t.replace(/storage\s*\.from\([^)]*\)/g, "storage.from()");
  for (const m of semStorage.matchAll(/\.from\(\s*(?:["'`]([a-z0-9_]+)["'`]|([A-Z_][A-Z0-9_]*))\s*\)/g)) {
    const v = m[1] || consts[m[2]];
    if (v) tab.add(v);
  }
  return {
    tabelas: tab,
    rpcs: new Set([...t.matchAll(/\.rpc\(\s*["'`]([a-z0-9_]+)["'`]/g)].map(m => m[1])),
    // `functions.invoke("x")` às vezes tem o nome na linha seguinte
    funcs: new Set([...t.matchAll(/functions\s*\.invoke\(\s*\n?\s*["'`]([a-z0-9-]+)["'`]/g)].map(m => m[1])),
  };
}

const tabelas = new Set(), rpcs = new Set(), funcsFront = new Set();
let hooksComDado = 0;
for (const h of hooks) {
  const x = fatos(fs.readFileSync(path.join(hooksDir, h), "utf8"));
  if (x.tabelas.size || x.rpcs.size || x.funcs.size) hooksComDado++;
  x.tabelas.forEach(v => tabelas.add(v));
  x.rpcs.forEach(v => rpcs.add(v));
  x.funcs.forEach(v => funcsFront.add(v));
}
(function anda(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { anda(p); continue; }
    if (!/\.jsx?$/.test(e.name)) continue;
    const x = fatos(fs.readFileSync(p, "utf8"));
    x.tabelas.forEach(v => tabelas.add(v));
    x.rpcs.forEach(v => rpcs.add(v));
    x.funcs.forEach(v => funcsFront.add(v));
  }
})(path.join(RAIZ, "src/components"));

const pastasEdge = fs.readdirSync(path.join(RAIZ, "supabase/functions"), { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith("_")).map(e => e.name);

const { COMPANY_IDS } = await import(path.join(RAIZ, "src/constants/companies.js"));

const real = {
  "Rotas autenticadas": Object.keys(ROUTES).length,
  "…das quais só redirecionam": redirects.length,
  "…telas de verdade": Object.keys(ROUTES).length - redirects.length,
  "Rotas **públicas**": publicas.length,
  "Componentes de view": views.length,
  "Hooks": hooks.length,
  "…que falam com o banco": hooksComDado,
  "Tabelas referenciadas pelo front": tabelas.size,
  "Funções RPC chamadas pelo front": rpcs.size,
  "…com fonte versionada no repo": pastasEdge.length,
  "Frentes comerciais": COMPANY_IDS.length,
};

// ── o que o doc declara ───────────────────────────────────────────────────
const doc = ler("docs/mapa-funcional.md");
const declarado = {};
for (const m of doc.matchAll(/^\|\s*([^|]*?)\s*\|\s*\*\*(\d+)\*\*/gm)) declarado[m[1]] = Number(m[2]);

function achar(chave) {
  const hit = Object.keys(declarado).find(k => k.includes(chave) || chave.includes(k.replace(/\s*\(.*/, "")));
  return hit ? declarado[hit] : null;
}

let falhas = 0;
console.log("valor declarado no mapa  ×  valor real no código\n");
for (const [rotulo, valor] of Object.entries(real)) {
  const d = achar(rotulo);
  const ok = d === valor;
  if (d === null) { console.log(`  ?   ${rotulo}: real ${valor} (não achei linha no doc)`); falhas++; continue; }
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok " : "DIF"} ${rotulo.padEnd(36)} doc ${String(d).padStart(4)}   código ${String(valor).padStart(4)}`);
}

// Rotas e edge functions citadas no doc que não existem mais (e o contrário).
const rotasNoDoc = new Set([...doc.matchAll(/`(\/[a-z0-9/-]*)`/g)].map(m => m[1]));
const rotasReais = new Set(Object.values(ROUTES));
const orfas = [...rotasNoDoc].filter(r => !rotasReais.has(r) && !publicas.some(p => r === p.replace(/\/:.*/, "") || p.startsWith(r)));
const ausentes = [...rotasReais].filter(r => !doc.includes("`" + r + "`"));
if (ausentes.length) { console.log("\nrotas que existem e o doc não cita:", ausentes.join(", ")); falhas++; }
if (orfas.length) console.log("\ncaminhos citados no doc que não são rota (pode ser prosa, confira):", orfas.join(", "));

const edgeAusentes = pastasEdge.filter(f => !doc.includes("`" + f + "`"));
if (edgeAusentes.length) { console.log("\nedge functions que o doc não cita:", edgeAusentes.join(", ")); falhas++; }

console.log(falhas ? `\n${falhas} divergência(s) — atualize docs/mapa-funcional.md` : "\nmapa em dia com o código");
console.log("\nNão conferido aqui (precisa do projeto Supabase): edge functions ATIVAS em produção e buckets de Storage.");
process.exit(falhas ? 1 : 0);
