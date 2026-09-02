// Monta o conjunto de dados da varredura com dados, tabela por tabela.
//
// A regra aqui: sempre que a plataforma já tiver um gerador próprio, use ELE
// (src/data/generate-leads.js e generate-demo-data.js) em vez de inventar
// linha à mão — assim o dado da varredura tem exatamente o formato que o
// código de produção espera, e se um gerador sair do ar em relação ao schema
// isso aparece aqui em vez de aparecer no botão "Carregar dados demo".
//
// Os dois arquivos usam import sem extensão (resolvido pelo Vite, não pelo
// Node), por isso passam pelo esbuild antes.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { etapasFixture } from "./etapas.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(aqui, "../../..");

export const QA_USER_ID = "11111111-1111-4111-8111-111111111111";

async function carregar(caminhoRelativo) {
  const r = await build({
    entryPoints: [resolve(RAIZ, caminhoRelativo)],
    bundle: true, write: false, format: "esm", platform: "node",
    resolveExtensions: [".js", ".jsx", ".mjs"],
  });
  const b64 = Buffer.from(r.outputFiles[0].text).toString("base64");
  return import("data:text/javascript;base64," + b64);
}

const PERFIS = [
  {
    id: QA_USER_ID, name: "QA Cobertura", email: "qa.cobertura@local.invalid",
    role: "admin",
    roles: ["admin", "diretoria", "gerente", "gerente_rh", "rh", "gerente_marketing", "marketing", "vendedor", "comex", "suporte"],
    companies: ["industria", "resibag"], initials: "QA", avatar_bg: "#1D4ED8",
    avatar_url: null, sectors: [], chat_enabled: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222222", name: "Vendedor Teste",
    email: "vendedor@local.invalid", role: "vendedor", roles: ["vendedor"],
    companies: ["industria"], initials: "VT", avatar_bg: "#B45309",
    avatar_url: null, sectors: [], chat_enabled: true,
  },
];

export async function montarDados() {
  const demo = await carregar("src/data/generate-demo-data.js");
  const leadsMod = await carregar("src/data/generate-leads.js");

  // Toda referência a pessoa aponta pro usuário de QA: os geradores criam ids
  // que não existem neste conjunto, e um responsável desconhecido faz a tela
  // renderizar "—" em vez do avatar — esconderia justamente o caminho de
  // código que a varredura quer exercitar.
  const PESSOA = new Set(["created_by", "owner", "assignee", "approved_by", "profile_id",
    "requested_by", "responsible_id", "user_id", "requester_id"]);
  const paraQA = (linhas) => linhas.map((r) => {
    const o = { ...r };
    for (const k of Object.keys(o)) if (PESSOA.has(k) && o[k] != null) o[k] = QA_USER_ID;
    if (Array.isArray(o.responsible_ids)) o.responsible_ids = [QA_USER_ID];
    if (Array.isArray(o.assignee_ids)) o.assignee_ids = [QA_USER_ID];
    if (Array.isArray(o.owner_ids)) o.owner_ids = [QA_USER_ID];
    return o;
  });

  const campanhas   = paraQA(demo.generateDemoCampaigns());
  const entregas    = paraQA(demo.generateDemoDeliverables());
  const despesas    = paraQA(demo.generateDemoExpenses());
  const solicit     = paraQA(demo.generateDemoRequests());
  const colabs      = paraQA(demo.generateDemoColaboradores());
  const vagas       = paraQA(demo.generateDemoVagas());
  const candidatos  = paraQA(demo.generateDemoCandidatos());
  const leads       = leadsMod.generateLeadsForAllCompanies();
  const etapas      = etapasFixture();

  const etapaDe = (dominio, i) => etapas.filter((e) => e.domain === dominio)[i % etapas.filter((e) => e.domain === dominio).length];

  // Sem `rh_aplicacoes`, candidato não aparece em Recrutamento: o board é a
  // JUNÇÃO candidato×vaga, não a lista de candidatos. Uma aplicação por
  // candidato, distribuída pelas vagas e pelas etapas.
  const aplicacoes = candidatos.map((c, i) => ({
    id: `00000000-0000-4000-a000-${String(i + 1).padStart(12, "0")}`,
    candidate_id: c.id,
    vaga_id: vagas[i % vagas.length].id,
    etapa_pipeline: etapaDe("candidatos", i).stage_key,
    stage_changed_at: c.stage_changed_at ?? "2026-08-01T12:00:00Z",
    fit_score: c.fit_score ?? 70,
    justificativa: c.justificativa ?? null,
    pontos_fortes: c.pontos_fortes ?? [],
    gaps: c.gaps ?? [],
    motivo_reprovacao: c.motivo_reprovacao ?? null,
    notes: [], rating: c.rating ?? null, activities: [], custom_fields: {},
    manager_decision: null, manager_decision_at: null, manager_decision_notes: null,
    manager_link_id: null, hired_at: null,
    created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-01T12:00:00Z",
  }));

  // Tabelas sem gerador próprio: o mínimo pra a tela sair do estado vazio e
  // exercitar card, drawer e agrupamento por etapa.
  const tarefas = etapas.filter((e) => e.domain === "marketing_tasks").map((e, i) => ({
    id: `00000000-0000-4000-b000-${String(i + 1).padStart(12, "0")}`,
    company_ids: [i % 2 ? "resibag" : "industria"],
    campaign_id: campanhas[i % campanhas.length].id,
    campaign_stage_key: null,
    title: `Tarefa de marketing ${i + 1}`,
    description: "Item de varredura de QA.",
    priority: ["baixa", "media", "alta"][i % 3],
    deadline: "2026-09-20T12:00:00Z",
    stage: e.stage_key, stage_changed_at: "2026-08-20T12:00:00Z",
    assignee_ids: [QA_USER_ID], notes: [], activities: [], starred: i === 0,
    custom_fields: {}, created_by: QA_USER_ID,
    created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-20T12:00:00Z",
  }));

  // Compras não usa `rh_pipeline_stages` — tem PURCHASE_STAGES fixo no código
  // (exceção deliberada, ver regra 2 do CLAUDE.md). Por isso as etapas aqui
  // são escritas à mão em vez de vir do fixture de etapas.
  const ETAPAS_COMPRAS = ["solicitado", "aprovado", "cotacao", "pedido_enviado", "recebido", "pago"];
  const compras = ETAPAS_COMPRAS.map((stage, i) => ({
    id: `00000000-0000-4000-c000-${String(i + 1).padStart(12, "0")}`,
    request_number: `COMP-${String(i + 1).padStart(4, "0")}`,
    item_name: `Item de compra ${i + 1}`,
    description: "Solicitação de varredura de QA.",
    supplier_id: null, quantity: 10 + i, unit_price: 100 + i * 25,
    total_value: (10 + i) * (100 + i * 25),
    stage, stage_changed_at: "2026-08-25T12:00:00Z",
    requester_name: "QA Cobertura", requester_email: "qa.cobertura@local.invalid",
    requester_phone: null, requested_by: QA_USER_ID, responsible_id: QA_USER_ID,
    approved_by: i > 0 ? QA_USER_ID : null,
    approved_at: i > 0 ? "2026-08-26T12:00:00Z" : null,
    rejected_reason: null, due_date: "2026-09-30", invoice_date: null, invoice_url: null,
    company_ids: [i % 2 ? "resibag" : "industria"], notes: [], expense_id: null,
    created_by: QA_USER_ID, created_at: "2026-08-25T12:00:00Z", updated_at: "2026-08-26T12:00:00Z",
    responsible_ids: [QA_USER_ID], quote_options: [], payment_terms: null,
    supplier_order_code: null, delivery_deadline: null, partial_delivered_qty: null,
    partial_remaining_qty: null, partial_new_deadline: null, partial_notes: null,
    invoice_number: null, payment_control_number: null, delivered_at: null,
    received_by: null, activities: [],
  }));

  const ferias = etapas.filter((e) => e.domain === "ferias").map((e, i) => ({
    id: `00000000-0000-4000-d000-${String(i + 1).padStart(12, "0")}`,
    user_id: QA_USER_ID, type: i === 0 ? "ferias" : "licenca",
    start_date: "2026-10-01", end_date: "2026-10-15",
    status: e.stage_key, notes: "Solicitação de varredura de QA.",
    approved_by: e.stage_key === "aprovado" ? QA_USER_ID : null,
    approved_at: e.stage_key === "aprovado" ? "2026-08-30T12:00:00Z" : null,
    created_at: "2026-08-28T12:00:00Z", updated_at: "2026-08-30T12:00:00Z",
    custom_fields: {}, activities: [], status_changed_at: "2026-08-30T12:00:00Z",
  }));

  const treinamentos = [0, 1, 2].map((i) => ({
    id: `00000000-0000-4000-e000-${String(i + 1).padStart(12, "0")}`,
    titulo: `Treinamento ${i + 1}`, descricao: "Conteúdo de varredura de QA.",
    tipo: ["video", "presencial", "leitura"][i], link_conteudo: null,
    frente: "all", created_by: QA_USER_ID,
    created_at: "2026-07-01T12:00:00Z", updated_at: "2026-07-01T12:00:00Z",
    validade_dias: 365, cargo_alvo: null, departamento_alvo: null,
  }));

  const posvenda = etapas.filter((e) => e.domain === "posvenda").map((e, i) => ({
    id: `00000000-0000-4000-f000-${String(i + 1).padStart(12, "0")}`,
    company_id: i % 2 ? "resibag" : "industria",
    lead_id: null, client_name: `Cliente Pós-venda ${i + 1}`,
    value: 50000 + i * 10000, owner_ids: [QA_USER_ID],
    stage: e.stage_key, stage_changed_at: "2026-08-15T12:00:00Z",
    notes: [], created_by: QA_USER_ID,
    created_at: "2026-07-15T12:00:00Z", updated_at: "2026-08-15T12:00:00Z",
    custom_fields: {}, negotiation_started_at: null, client_id: null,
  }));

  return {
    profiles: PERFIS,
    // Sem isto a plataforma para na tela "Termos de uso" e nenhuma rota
    // renderiza — o usuário existe, mas não aceitou os termos ainda.
    terms_acceptances: [{
      id: "00000000-0000-4000-8000-000000000001",
      profile_id: QA_USER_ID, version: 1, accepted_at: "2026-01-02T00:00:00Z",
    }],
    rh_pipeline_stages: etapas,
    rh_pipeline_stage_fields: [],
    pipeline_stage_fields: [],
    pipeline_stage_transitions: [],
    leads,
    clients: [],
    marketing_campaigns: campanhas,
    marketing_deliverables: entregas,
    marketing_expenses: despesas,
    marketing_requests: solicit,
    marketing_tasks: tarefas,
    marketing_purchase_requests: compras,
    rh_colaboradores: colabs,
    rh_vagas: vagas,
    rh_candidatos: candidatos,
    rh_aplicacoes: aplicacoes,
    rh_ferias: ferias,
    rh_treinamentos: treinamentos,
    posvenda_cases: posvenda,
  };
}
