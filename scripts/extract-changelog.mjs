#!/usr/bin/env node
// Extrai frases "Changelog: <frase>" dos commits desde a última entrada de
// src/data/changelog.js até HEAD. Rodado manualmente por quem está fechando
// um release — ver specautoupdatechangelogtoast.md (parte 2) e a seção
// "Processo operacional do checkpoint leve" da spec.
//
//   node scripts/extract-changelog.mjs 4.1.0            # dry-run — só imprime
//   node scripts/extract-changelog.mjs 4.1.0 --apply     # grava + bump de versão
//
// Dry-run é o default de propósito: as frases impressas são o que vai pro
// checkpoint leve com o Daniel antes de qualquer coisa ser escrita.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const changelogPath = path.join(repoRoot, "src/data/changelog.js");
const pkgPath = path.join(repoRoot, "package.json");

const [, , version, flag] = process.argv;
const apply = flag === "--apply";

if (!version) {
  console.error("Uso: node scripts/extract-changelog.mjs <versao> [--apply]");
  process.exit(1);
}

function readChangelogModule() {
  const src = readFileSync(changelogPath, "utf8");
  const match = src.match(/export const CHANGELOG = (\[[\s\S]*\]);/);
  if (!match) throw new Error(`Não consegui parsear ${changelogPath} — formato inesperado.`);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${match[1]};`)();
}

const changelog = readChangelogModule();
const lastEntry = changelog[0];
const range = lastEntry?.commit ? `${lastEntry.commit}..HEAD` : "HEAD";

let log;
try {
  log = execSync(`git log ${range} --format=%B----COMMIT-END----`, { cwd: repoRoot, encoding: "utf8" });
} catch (err) {
  console.error(`git log falhou pro range "${range}": ${err.message}`);
  process.exit(1);
}

const items = [];
for (const line of log.split("\n")) {
  const m = line.match(/^Changelog:\s*(.+)$/);
  if (m && m[1].trim()) items.push(m[1].trim());
}

if (items.length === 0) {
  console.log(`Nenhuma linha "Changelog:" encontrada entre ${range}. Nada a fazer.`);
  process.exit(0);
}

console.log(`Frases coletadas pra versão ${version} (${items.length}):\n`);
items.forEach((it, i) => console.log(`  ${i + 1}. ${it}`));

if (!apply) {
  console.log("\nDry-run — nada foi escrito. Rode com --apply depois de aprovar as frases (ou editá-las) com o Daniel.");
  process.exit(0);
}

const headSha = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);

const newEntry = { version, date: today, commit: headSha, items };
const nextChangelog = [newEntry, ...changelog];

const serialized = JSON.stringify(nextChangelog, null, 2)
  .replace(/^\[/, "[\n").replace(/\]$/, "\n]");
writeFileSync(
  changelogPath,
  `// Escrito pelo script scripts/extract-changelog.mjs (modo --apply), nunca à\n` +
  `// mão — ver spec specautoupdatechangelogtoast.md. Mais novo primeiro.\n` +
  `export const CHANGELOG = ${serialized};\n`,
);

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`\nGravado: src/data/changelog.js (commit ${headSha}) + package.json bumpado pra ${version}.`);
console.log(`Falta commitar: git add src/data/changelog.js package.json && git commit -m "chore: changelog ${version}"`);
