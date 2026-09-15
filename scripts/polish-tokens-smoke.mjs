// Smoke: tokens de polish feeling (Fases 1–2) existem em src/index.css.
// Spec: docs/design-spec-polish-feeling.md
// Plano: docs/superpowers/plans/2026-09-04-polish-feeling-fases-1-2.md
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "src/index.css"), "utf8");

const required = [
  "--shadow-card-hover",
  "--shadow-drag",
  "--motion-fast",
  "--motion-base",
  "--motion-enter",
  "--ease-out",
];

const missing = required.filter((t) => !css.includes(`${t}:`));
if (missing.length) {
  console.error("polish-tokens: faltando em index.css:", missing.join(", "));
  process.exit(1);
}

const darkIdx = css.indexOf('[data-theme="dark"]');
if (darkIdx < 0) {
  console.error('polish-tokens: bloco [data-theme="dark"] não encontrado');
  process.exit(1);
}
const rootBlock = css.slice(css.indexOf(":root"), darkIdx);
const shadowCardDecl = rootBlock.match(/--shadow-card:\s*([^;]+);/);
if (!shadowCardDecl || /^\s*none\s*$/.test(shadowCardDecl[1])) {
  console.error("polish-tokens: --shadow-card ainda é none no :root (esperado sombra A curta)");
  process.exit(1);
}

if (!css.includes("prefers-reduced-motion")) {
  console.error("polish-tokens: falta @media (prefers-reduced-motion: reduce)");
  process.exit(1);
}

const overviewBars = [".polish-bar-track", ".polish-bar-fill", "polish-bar-grow", ".polish-matrix-row"];
const missingBars = overviewBars.filter((t) => !css.includes(t));
if (missingBars.length) {
  console.error("polish-tokens: faltando classes OverviewTab:", missingBars.join(", "));
  process.exit(1);
}

const kanban = [".polish-kanban-card", ".polish-kanban-card.is-dragging", "--shadow-drag"];
const missingKanban = kanban.filter((t) => !css.includes(t));
if (missingKanban.length) {
  console.error("polish-tokens: faltando classes Kanban (fase 3):", missingKanban.join(", "));
  process.exit(1);
}

console.log("polish-tokens: ok");
