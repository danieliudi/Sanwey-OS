// Sobe o dev server de QA (sem VITE_SUPABASE_*), espera responder, roda a
// varredura pedida e derruba o servidor — inclusive se a varredura falhar.
//
//   node scripts/qa/run.mjs rotas       → npm run qa:smoke
//   node scripts/qa/run.mjs interacao   → npm run qa:interacao
//
// Precisa do Playwright, que NÃO é dependência do projeto de propósito: ele
// baixa navegador na instalação e isso pesaria em todo `npm ci` do deploy,
// pra uma ferramenta que só a sessão de QA usa. Instale sob demanda:
//
//   npm i --no-save playwright && npx playwright install chromium
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = process.argv[2] === "interacao" ? "smoke-interacao.mjs" : "smoke-rotas.mjs";
const PORTA = process.env.QA_PORT || "5199";
const BASE = `http://localhost:${PORTA}`;

try {
  await import("playwright");
} catch {
  console.error(
    "\nPlaywright não está instalado. Esta varredura é opcional e roda sob demanda:\n" +
    "\n  npm i --no-save playwright && npx playwright install chromium\n",
  );
  process.exit(1);
}

// `node_modules/.bin/vite` direto, e NÃO `npx vite`: o npx é um wrapper que
// abre o Vite como neto do processo, e o SIGTERM mandado pro npx não chegava
// no Vite — o servidor sobrevivia à varredura, segurava a porta 5199 e
// mantinha o stdout aberto (nenhuma saída aparecia até alguém matar o
// processo à mão). `detached` + kill no GRUPO fecha a árvore inteira.
const servidor = spawn(
  resolve(aqui, "../../node_modules/.bin/vite"),
  ["--config", resolve(aqui, "vite.smoke.config.js"), "--port", PORTA, "--strictPort"],
  { stdio: ["ignore", "ignore", "inherit"], detached: true },
);
let derrubado = false;
const derruba = () => {
  if (derrubado) return;
  derrubado = true;
  try { process.kill(-servidor.pid, "SIGTERM"); } catch { /* já morreu */ }
};
process.on("exit", derruba);
process.on("SIGINT", () => { derruba(); process.exit(130); });

// Espera o servidor responder — até 60s, sem `sleep` fixo.
const limite = Date.now() + 60_000;
let noAr = false;
while (Date.now() < limite) {
  try {
    const r = await fetch(BASE + "/");
    if (r.ok) { noAr = true; break; }
  } catch { /* ainda subindo */ }
  await new Promise(r => setTimeout(r, 500));
}
if (!noAr) {
  console.error(`Dev server de QA não respondeu em ${BASE} — abortando.`);
  derruba();
  process.exit(1);
}

const varredura = spawn("node", [resolve(aqui, alvo)], {
  stdio: "inherit",
  env: { ...process.env, SMOKE_BASE: BASE },
});
varredura.on("exit", (code) => { derruba(); process.exit(code ?? 1); });
