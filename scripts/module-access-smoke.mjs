// Inventário de Configurações → Módulos vs menu. Sem banco.
// `node --import ./scripts/register-esm.mjs scripts/module-access-smoke.mjs`

import assert from "node:assert/strict";
import {
  MODULE_GROUPS, ALL_MODULE_IDS, UNGATED_NAV_IDS, defaultModulesForRoles,
} from "../src/utils/module-access.js";

const ids = new Set(ALL_MODULE_IDS);
const labels = MODULE_GROUPS.map(g => g.label);

assert.deepEqual(labels, [
  "Meu Espaço", "Comercial", "Marketing", "Recursos Humanos", "Inteligência", "Configuração",
], "grupos da tela Módulos = seções do menu");

for (const id of UNGATED_NAV_IDS) {
  assert.equal(ids.has(id), false, `${id} permanece fora da chave global`);
}

const gatedDoMenu = [
  "chat", "personal-tasks", "meu-rh", "tutorials",
  "commercial-overview", "signals", "crm", "posvenda", "pedidos", "clients",
  "abm", "catalogo", "document-library", "crossref", "explorer", "crm-viagens", "comex",
  "marketing-home", "marketing", "marketing-solicitacoes", "marketing-entregas",
  "marketing-tarefas", "marketing-fornecedores", "marketing-compras",
  "marketing-despesas", "marketing-feiras", "marketing-conteudo",
  "rh-overview", "rh-recrutamento", "rh-onboarding", "rh-treinamentos", "rh-feedback",
  "rh-ferias", "rh-funcionarios", "rh-cargos", "rh-comunicacao", "rh-bem-estar",
  "rh-fornecedores", "rh-relatorios",
  "executive", "market-intel", "agents", "esg-carbono", "automations",
];
for (const id of gatedDoMenu) {
  assert.equal(ids.has(id), true, `toggle ausente: ${id}`);
}
assert.equal(ALL_MODULE_IDS.length, gatedDoMenu.length, "registro sem id extra/faltando");

const comercial = MODULE_GROUPS.find(g => g.label === "Comercial").modules.map(m => m.id);
assert.ok(comercial.indexOf("document-library") === comercial.indexOf("catalogo") + 1,
  "Biblioteca fica logo após Catálogo, como no menu");

const vendedor = defaultModulesForRoles(["vendedor"]);
assert.equal(vendedor.has("document-library"), true, "vendedor vê Biblioteca por padrão");
assert.equal(vendedor.has("marketing-conteudo"), false, "vendedor não ganha Conteúdo só porque o toggle existe");

const suporte = defaultModulesForRoles(["suporte"]);
assert.equal(suporte.has("document-library"), false, "suporte puro não vê Biblioteca");
assert.equal(suporte.has("pedidos"), true);

const marketing = defaultModulesForRoles(["marketing"]);
assert.equal(marketing.has("marketing-conteudo"), true);
assert.equal(marketing.has("document-library"), false);

const admin = defaultModulesForRoles(["admin"]);
for (const id of gatedDoMenu) {
  assert.equal(admin.has(id), true, `admin padrão inclui ${id}`);
}

console.log(`ok  ${ALL_MODULE_IDS.length} páginas gated em ${MODULE_GROUPS.length} grupos`);
