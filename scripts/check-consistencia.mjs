#!/usr/bin/env node
// Conferência de consistência — o "gate de saída" da plataforma.
//
// Por que isto existe (28/08/2026, decidido com o Daniel): até aqui o único
// gate automatizado era o `vite build`, e ele pega uma classe de falha só —
// import quebrado e erro de sintaxe. Nenhum dos bugs que de fato chegaram no
// usuário nesta plataforma seria pego por ele (testado: "R$ " + formatBRL(),
// variável indefinida e hook dentro de `if` passam batido no build).
//
// O problema real não era falta de revisão — o processo do CLAUDE.md acha
// bug de verdade. O problema é que ele NÃO PROPAGA: a causa raiz é
// diagnosticada num arquivo e as outras 28 ocorrências ficam de pé. Foi
// exatamente o que aconteceu com a guarda de resposta obsoleta (corrigida em
// use-personal-task-stages.js em 26/08, rediagnosticada como ERRADA em
// use-chat.js em 28/08, com 29 arquivos ainda no padrão antigo).
//
// Por isso toda regra abaixo nasce de um bug que ESTA plataforma já teve —
// nenhuma é conselho genérico de qualidade de software. Rodar leva menos de
// 1s sobre os ~390 arquivos e não tem nenhuma dependência.
//
// Uso:
//   node scripts/check-consistencia.mjs              # confere (roda no prebuild)
//   node scripts/check-consistencia.mjs --lista      # lista todas as violações
//   node scripts/check-consistencia.mjs --baseline   # regrava a linha de base
//
// LINHA DE BASE: a plataforma tem 115 mil linhas escritas antes deste gate,
// então a conferência não exige zero violação — exige que o número por
// arquivo NÃO CRESÇA. Consertou? Rode --baseline e o teto desce, sem poder
// voltar a subir. É catraca, não muro.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(RAIZ, "scripts", "consistencia-baseline.json");

function arquivosFonte(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { arquivosFonte(caminho, acc); continue; }
    if (/\.(jsx?|mjs)$/.test(nome)) acc.push(caminho);
  }
  return acc;
}

const violacoes = [];
function achado(regra, arquivo, linha, detalhe) {
  violacoes.push({ regra, arquivo: relative(RAIZ, arquivo), linha, detalhe });
}
const linhaDe = (texto, idx) => texto.slice(0, idx).split("\n").length;

// ── utilitários de varredura ──────────────────────────────────────────────

// Recorta o "statement" em volta de um índice: anda pra trás até o começo do
// comando anterior e pra frente até o `;` no nível zero de parênteses. Serve
// pra ler uma cadeia `supabase.from(...).update(...).eq(...).select()` que
// pode estar quebrada em várias linhas.
function statementEmVolta(texto, idx) {
  let ini = idx;
  while (ini > 0 && !";{}".includes(texto[ini - 1])) ini--;
  let fim = idx, prof = 0;
  while (fim < texto.length) {
    const c = texto[fim];
    if (c === "(") prof++;
    else if (c === ")") prof--;
    else if (c === ";" && prof <= 0) break;
    if (fim - idx > 2000) break;
    fim++;
  }
  return texto.slice(ini, fim);
}

// Devolve os intervalos [ini, fim] do corpo de cada useEffect do arquivo.
function corposDeUseEffect(texto) {
  const faixas = [];
  const re = /useEffect\s*\(/g;
  let m;
  while ((m = re.exec(texto))) {
    const abre = texto.indexOf("{", m.index);
    if (abre === -1) continue;
    let prof = 0, i = abre;
    for (; i < texto.length; i++) {
      if (texto[i] === "{") prof++;
      else if (texto[i] === "}") { prof--; if (prof === 0) break; }
    }
    faixas.push([abre, i]);
  }
  return faixas;
}

// ── REGRA A: .update() sem .select() ──────────────────────────────────────
// Bug real, várias vezes: um UPDATE barrado pela RLS volta `error: null` e
// `data: []` — não é erro, é zero linha afetada. Como a tela já aplicou o
// estado otimista, a pessoa vê "salvo" e o banco não mudou. Sem `.select()`
// na cadeia não dá nem pra saber quantas linhas foram.
// Gabarito no repo: src/hooks/use-clients.js (`.select()` + `data.length === 0`).
function regraUpdateSemSelect(arquivo, texto) {
  const re = /\.update\s*\(/g;
  let m;
  while ((m = re.exec(texto))) {
    const stmt = statementEmVolta(texto, m.index);
    if (!stmt.includes(".from(")) continue;   // não é chamada do supabase
    if (stmt.includes(".select(")) continue;
    achado("update-sem-select", arquivo, linhaDe(texto, m.index),
      "UPDATE do supabase sem .select() — falha de RLS volta como sucesso silencioso");
  }
}

// ── REGRA B: guarda de resposta obsoleta com ref compartilhada ────────────
// O ref é único por instância do hook, não por execução do efeito: numa troca
// rápida (de canal, de usuário, de board) o efeito NOVO religa o ref pra true
// no mesmo commit em que o cleanup do efeito ANTIGO o desliga. Se o fetch
// antigo resolver depois, a guarda passa e ele planta o dado errado na tela.
// Gabarito no repo: src/hooks/use-chat.js (`let active = true` DENTRO do efeito).
function regraGuardaObsoleta(arquivo, texto) {
  for (const [a, b] of corposDeUseEffect(texto)) {
    const corpo = texto.slice(a, b);
    for (const m of corpo.matchAll(/(\w*Ref)\.current\s*=\s*true/g)) {
      // Só é guarda de ciclo de vida se o MESMO ref volta a false no
      // cleanup. Sem isso é um ref de "isso já aconteceu uma vez"
      // (hasLoadedOnceRef, autoExpandedRef...) — padrão legítimo e
      // diferente, que não sofre desta corrida.
      const desliga = new RegExp(`${m[1]}\\.current\\s*=\\s*false`);
      if (!desliga.test(corpo)) continue;
      achado("guarda-obsoleta", arquivo, linhaDe(texto, a + m.index),
        `${m[1]}.current = true/false dentro do useEffect — o ref é único da instância, não da execução do efeito; use \`let active = true\` local (ver use-chat.js)`);
    }
  }
}

// ── REGRA C: "R$" duplicado ───────────────────────────────────────────────
// formatK/formatBRL/formatBRLCompact já embutem "R$ " (src/utils/currency.js).
// Concatenar de novo rendia "R$ R$ 121" na tela. Já corrigido; isto trava a
// regressão, que é barata de reintroduzir e o build não pega.
function regraMoedaDuplicada(arquivo, texto) {
  const re = /R\$\s*(?:\$\{|"\s*\+\s*|'\s*\+\s*)\s*format(?:K|BRL|BRLCompact|M)\b/g;
  let m;
  while ((m = re.exec(texto))) {
    achado("moeda-duplicada", arquivo, linhaDe(texto, m.index),
      'formatK/formatBRL já incluem "R$ " — não concatene na frente');
  }
}

// ── REGRA D: asterisco de obrigatório em var(--accent) ────────────────────
// --accent muda por frente comercial em runtime (COMPANIES[id].primary), então
// o asterisco de campo obrigatório ficava VERDE na Resibag. Estava em 8
// arquivos. Erro/obrigatório é sempre var(--danger) — CLAUDE.md, regra 1.
function regraObrigatorioAccent(arquivo, texto) {
  texto.split("\n").forEach((linha, i) => {
    if (!linha.includes("var(--accent)")) return;
    if (!/[>"'{]\s*\*\s*[<"'}]/.test(linha)) return;
    achado("obrigatorio-accent", arquivo, i + 1,
      "asterisco de campo obrigatório usando var(--accent) — deve ser var(--danger)");
  });
}

// ── REGRA E: referência morta em tutoriais/spotlights ─────────────────────
// O botão "Ir para X" dos tutoriais derivava a rota do RÓTULO humano da
// descrição: batia com uma chave de ROUTES por coincidência, e 148 dos 173
// botões não navegavam pra lugar nenhum — sem erro, sem log, sem nada.
// Mesma família: spotlight apontando pra data-tour que não existe mais, ou
// pra uma versão que não está no CHANGELOG (nesse caso ele nunca dispara).
function regraReferenciaMorta() {
  const ler = (p) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8") : "");

  const rotasSrc = ler("src/constants/routes.js");
  const corpo = rotasSrc.slice(rotasSrc.indexOf("export const ROUTES"));
  const rotas = new Set([...corpo.matchAll(/^\s*(?:"([^"]+)"|([\w$-]+))\s*:\s*"/gm)].map(m => m[1] || m[2]));

  const tours = new Set();
  for (const arq of arquivosFonte(join(RAIZ, "src"))) {
    const t = readFileSync(arq, "utf8");
    for (const m of t.matchAll(/(?:data-tour|dataTour)\s*=\s*[{"']+([\w-]+)/g)) tours.add(m[1]);
  }

  for (const nome of ["src/data/tutorials.js", "src/data/feature-spotlights.js"]) {
    const t = ler(nome);
    if (!t) continue;
    for (const m of t.matchAll(/route:\s*"([^"]+)"/g)) {
      if (!rotas.has(m[1])) {
        achado("referencia-morta", join(RAIZ, nome), linhaDe(t, m.index),
          `route "${m[1]}" não existe em ROUTES (src/constants/routes.js)`);
      }
    }
  }

  const spot = ler("src/data/feature-spotlights.js");
  for (const m of spot.matchAll(/target:\s*'\[data-tour="([^"]+)"\]'/g)) {
    if (!tours.has(m[1])) {
      achado("referencia-morta", join(RAIZ, "src/data/feature-spotlights.js"), linhaDe(spot, m.index),
        `target data-tour="${m[1]}" não existe em nenhum componente — o spotlight nunca aparece`);
    }
  }
  // NÃO se confere `version` contra o CHANGELOG: em feature-spotlights.js
  // esse campo é só um identificador de "já viu esta versão" guardado no
  // localStorage (use-feature-spotlight.js:28 compara seenMap[id] !== version),
  // nunca é cruzado com o CHANGELOG. Uma versão que não existe lá dispara o
  // spotlight normalmente — apontar isso seria acusar um não-bug.
}

// ── REGRA F: versão do package.json = topo do CHANGELOG ───────────────────
// O toast "Novidades" e o aviso de nova versão só disparam quando
// package.json.version muda E bate com CHANGELOG[0].version. Já houve uma
// sessão inteira de trabalho real mergeada sem bump: dezenas de mudanças no
// ar e o toast sem nada pra detectar. É a regra 10 do CLAUDE.md, mecanizada.
function regraVersaoChangelog() {
  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  const changelog = readFileSync(join(RAIZ, "src/data/changelog.js"), "utf8");
  const topo = changelog.match(/version:\s*"([^"]+)"/);
  if (!topo) return;
  if (topo[1] !== pkg.version) {
    achado("versao-changelog", join(RAIZ, "package.json"), 1,
      `package.json está em ${pkg.version} e o topo do CHANGELOG em ${topo[1]} — o toast "Novidades" não dispara`);
  }
}

// ── execução ──────────────────────────────────────────────────────────────

for (const arquivo of arquivosFonte(join(RAIZ, "src"))) {
  const texto = readFileSync(arquivo, "utf8");
  regraUpdateSemSelect(arquivo, texto);
  regraGuardaObsoleta(arquivo, texto);
  regraMoedaDuplicada(arquivo, texto);
  regraObrigatorioAccent(arquivo, texto);
}
regraReferenciaMorta();
regraVersaoChangelog();

const contagem = {};
for (const v of violacoes) {
  const chave = `${v.regra}::${v.arquivo}`;
  contagem[chave] = (contagem[chave] || 0) + 1;
}

if (process.argv.includes("--baseline")) {
  writeFileSync(BASELINE, JSON.stringify(contagem, null, 2) + "\n");
  console.log(`linha de base regravada: ${Object.keys(contagem).length} entradas, ${violacoes.length} violações conhecidas`);
  process.exit(0);
}

if (process.argv.includes("--lista")) {
  for (const v of violacoes.sort((a, b) => a.regra.localeCompare(b.regra) || a.arquivo.localeCompare(b.arquivo) || a.linha - b.linha)) {
    console.log(`${v.arquivo}:${v.linha} [${v.regra}] ${v.detalhe}`);
  }
  console.log(`\n${violacoes.length} violações no total`);
  process.exit(0);
}

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const regressoes = [];
for (const [chave, n] of Object.entries(contagem)) {
  const teto = base[chave] || 0;
  if (n > teto) regressoes.push({ chave, n, teto });
}

if (regressoes.length) {
  console.error("\n✗ check-consistencia: violação NOVA (não estava na linha de base)\n");
  for (const { chave, n, teto } of regressoes) {
    const [regra, arquivo] = chave.split("::");
    console.error(`  ${arquivo} — ${regra}: ${n} ocorrência(s), teto ${teto}`);
    for (const v of violacoes.filter(v => v.regra === regra && v.arquivo === arquivo)) {
      console.error(`      linha ${v.linha}: ${v.detalhe}`);
    }
  }
  console.error("\nConserte, ou (se for intencional) rode: node scripts/check-consistencia.mjs --baseline\n");
  process.exit(1);
}

const conhecidas = Object.values(base).reduce((a, b) => a + b, 0);
const agora = violacoes.length;
console.log(`✓ check-consistencia: nenhuma violação nova (${agora} conhecidas de ${conhecidas} na linha de base)`);
if (agora < conhecidas) console.log(`  ${conhecidas - agora} a menos que a linha de base — rode --baseline pra descer a catraca.`);
