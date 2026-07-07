// Gerador de dados fictícios para todas as seções da plataforma (Marketing,
// RH, Solicitações). Usa PRNG determinístico (mulberry32, seed fixo) para que
// os dados sejam estáveis entre carregamentos — mesmo padrão de generate-leads.js.

import {
  MARKETING_STAGES,
  DELIVERABLE_STAGES,
  DELIVERABLE_DEPARTMENTS,
  DELIVERABLE_PRIORITIES,
  DELIVERABLE_REQUEST_TYPES,
  EXPENSE_CATEGORIES,
  MARKETING_CHANNELS,
  MARKETING_KPIS,
} from "../constants/marketing-pipelines";
import { COMPANY_IDS } from "../constants/companies";

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function pickWeighted(rand, items, weights) {
  let r = rand(), acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (r <= acc) return items[i];
  }
  return items[0];
}

function daysAgo(rand, min, max) {
  return new Date(Date.now() - (min + Math.floor(rand() * (max - min))) * 86400000).toISOString();
}

function daysFromNow(rand, min, max) {
  return new Date(Date.now() + (min + Math.floor(rand() * (max - min))) * 86400000).toISOString().slice(0, 10);
}

function uuid(rand) {
  const hex = () => Math.floor(rand() * 16).toString(16);
  return `demo-${[...Array(8)].map(hex).join("")}-${[...Array(4)].map(hex).join("")}-4${[...Array(3)].map(hex).join("")}-${(8 + Math.floor(rand() * 4)).toString(16)}${[...Array(3)].map(hex).join("")}-${[...Array(12)].map(hex).join("")}`;
}

/* ═══════════════════════════════════════════════════════════
   MARKETING CAMPAIGNS
   ═══════════════════════════════════════════════════════════ */

const CAMPAIGN_NAMES = [
  "Campanha Fim de Ano · Resibag",
  "Lançamento Linha Condutiva",
  "Black Friday Industrial 2026",
  "Webinar Compliance Ambiental",
  "Parceria Estratégica · Braskem",
  "Reativação Base Inativa",
  "Campanha ANP Offshore",
  "Email Marketing Qualificação",
  "Evento Feira Química SP",
  "Social B2B · LinkedIn",
  "Case de Sucesso · Petrobras",
  "Programa de Indicação",
  "Campanha Inmetro · Validação",
  "Campanha Awareness Setor Têxtil",
];

const AGENCY_NAMES = [
  "Agência Criativa BKTS",
  "Studio 8 Comunicação",
  "Rede Media Group",
  "Ponto de Contato Digital",
  null, null,
];

export function generateDemoCampaigns() {
  const rand = mulberry32(1001);
  const now  = Date.now();

  return CAMPAIGN_NAMES.map((name, i) => {
    const stage      = pick(rand, MARKETING_STAGES.map(s => s.id));
    const companyId  = pick(rand, COMPANY_IDS);
    const budget     = 5000 + Math.floor(rand() * 95000);
    const launchDays = Math.floor(rand() * 60) - 20;
    const launchDate = new Date(now + launchDays * 86400000).toISOString().slice(0, 10);
    const endDate    = new Date(now + (launchDays + 30 + Math.floor(rand() * 60)) * 86400000).toISOString().slice(0, 10);

    return {
      id:               `demo-campaign-${i + 1}`,
      company_ids:      [companyId],
      name,
      channel:          pick(rand, MARKETING_CHANNELS),
      budget,
      kpi:              pick(rand, MARKETING_KPIS),
      launch_date:      launchDate,
      end_date:         endDate,
      stage,
      stage_changed_at: daysAgo(rand, 1, 15),
      performance_score: Math.floor(rand() * 100),
      owner:            null,
      agency_name:      pick(rand, AGENCY_NAMES),
      utm_url:          null,
      drive_folder_url: null,
      drive_folder_id:  null,
      approval_checklist: [],
      notes:            [],
      activities:       [],
      starred:          rand() > 0.8,
      custom_fields:    {},
      created_by:       null,
      is_demo:          true,
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   MARKETING DELIVERABLES (ENTREGAS)
   ═══════════════════════════════════════════════════════════ */

const DELIVERABLE_TITLES = [
  "Banner Digital · Campanha LinkedIn",
  "Apresentação Institucional 2026",
  "Post Instagram · Produto Condutivo",
  "E-mail Marketing · Base Qualificada",
  "Vídeo Institucional 60s",
  "Landing Page · Webinar Compliance",
  "Infográfico · Comparativo Big Bag",
  "Proposta Visual · Feira Química SP",
  "Case de Sucesso · Braskem",
  "Kit de Mídia · Imprensa",
  "Stories Animados · Lançamento",
  "Roteiro para Podcast B2B",
  "Design Folder Técnico",
];

export function generateDemoDeliverables() {
  const rand = mulberry32(2002);

  return DELIVERABLE_TITLES.map((title, i) => {
    const stage      = pick(rand, DELIVERABLE_STAGES.map(s => s.id));
    const companyId  = pick(rand, COMPANY_IDS);
    const dept       = pick(rand, DELIVERABLE_DEPARTMENTS);
    const priority   = pick(rand, DELIVERABLE_PRIORITIES.map(p => p.id));
    const reqType    = pick(rand, DELIVERABLE_REQUEST_TYPES);

    return {
      id:               `demo-deliverable-${i + 1}`,
      company_ids:      [companyId],
      campaign_id:      null,
      title,
      requester_name:   pick(rand, ["Ana Clara", "Bruno Ferreira", "Carla Mendes", "Diego Santos", "Eliane Costa"]),
      department:       dept,
      description:      `Material solicitado pelo departamento de ${dept} para apoiar as ações de ${reqType.toLowerCase()} do período.`,
      priority,
      deadline:         daysFromNow(rand, 5, 30),
      stage,
      stage_changed_at: daysAgo(rand, 1, 20),
      assignee:         null,
      stage_data:       {},
      custom_fields:    {},
      starred:          rand() > 0.85,
      activities:       [],
      notes:            [],
      created_by:       null,
      is_demo:          true,
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   MARKETING EXPENSES (DESPESAS)
   ═══════════════════════════════════════════════════════════ */

const EXPENSE_DESCRIPTIONS = [
  "Impulsionamento LinkedIn · Campanha ANP",
  "Produção vídeo institucional",
  "Contrato mensal · Agência Criativa BKTS",
  "Ferramenta de automação de e-mail",
  "Patrocínio Feira Química SP",
  "Google Ads · Campanha Awareness",
  "Fotografia industrial · Produtos",
  "Design gráfico · Kit de Mídia",
  "Plataforma de gestão de redes sociais",
  "Evento interno · Lançamento de produto",
];

const EXPENSE_STATUSES = ["pendente", "pago", "pendente", "aprovado"];

export function generateDemoExpenses() {
  const rand = mulberry32(3003);

  return EXPENSE_DESCRIPTIONS.map((description, i) => {
    const companyId = pick(rand, COMPANY_IDS);
    const amount    = 500 + Math.floor(rand() * 29500);

    return {
      id:          `demo-expense-${i + 1}`,
      company_ids: [companyId],
      campaign_id: null,
      description,
      category:    pick(rand, EXPENSE_CATEGORIES),
      amount,
      status:      pick(rand, EXPENSE_STATUSES),
      due_date:    daysFromNow(rand, -5, 45),
      notes:       null,
      receipt_url: null,
      created_by:  null,
      is_demo:     true,
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   MARKETING REQUESTS (SOLICITAÇÕES)
   ═══════════════════════════════════════════════════════════ */

const REQUESTER_NAMES = [
  "Ana Clara Souza",
  "Bruno Ferreira",
  "Carla Mendes",
  "Diego Santos",
  "Eliane Costa",
  "Fernando Lima",
  "Giovana Teles",
];

const REQUEST_TITLES = [
  "Banner para feira de clientes",
  "Apresentação de resultados Q2",
  "Post anunciando nova parceria",
  "Material para onboarding de fornecedores",
  "E-mail de reativação de clientes inativos",
  "Folder técnico · Linha Condutiva",
  "Vídeo de apresentação da empresa",
  "Kit de mídia para imprensa",
  "Infográfico de compliance ambiental",
  "Template de proposta comercial",
];

const REQUEST_STATUSES_WEIGHTED = ["pendente", "pendente", "pendente", "aprovado", "aprovado", "rejeitado"];

export function generateDemoRequests() {
  const rand = mulberry32(4004);

  return REQUEST_TITLES.map((title, i) => {
    const dept      = pick(rand, DELIVERABLE_DEPARTMENTS.filter(d => d !== "Marketing"));
    const status    = pick(rand, REQUEST_STATUSES_WEIGHTED);
    const reqType   = pick(rand, DELIVERABLE_REQUEST_TYPES);
    const priority  = pick(rand, DELIVERABLE_PRIORITIES.map(p => p.id));
    const companyId = pick(rand, COMPANY_IDS);

    return {
      id:              `demo-request-${i + 1}`,
      title,
      description:     `Solicitação do departamento de ${dept} para criação de material de ${reqType.toLowerCase()}. Favor priorizar conforme prazo indicado.`,
      department:      dept,
      requester_name:  pick(rand, REQUESTER_NAMES),
      requester_email: `${pick(rand, REQUESTER_NAMES).split(" ")[0].toLowerCase()}@sanwey.com.br`,
      request_type:    reqType,
      priority,
      deadline:        daysFromNow(rand, 3, 21),
      company_ids:     [companyId],
      status,
      rejection_reason: status === "rejeitado"
        ? "Material não se encaixa na estratégia do período. Entre em contato para discutir alternativas."
        : null,
      notes:           null,
      approved_at:     status === "aprovado" ? daysAgo(rand, 1, 7) : null,
      approved_by:     null,
      deliverable_id:  null,
      is_demo:         true,
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   RH: COLABORADORES (FUNCIONÁRIOS)
   ═══════════════════════════════════════════════════════════ */

const RH_NOMES = [
  "Ana Lima",     "Bruno Martins", "Carla Souza",  "Diego Alves",
  "Elisa Ferreira","Fábio Nunes",  "Gisele Ramos", "Henrique Costa",
  "Isabela Torres","João Pereira",  "Karina Silva", "Lucas Mendes",
  "Marina Castro", "Neto Barbosa", "Olivia Rocha",
];

const CARGO_POR_DEPT = {
  "Vendas":       ["Analista Comercial", "Executivo de Contas", "SDR", "Coordenador Comercial"],
  "Marketing":    ["Analista de Marketing", "Designer Gráfico", "Social Media", "Copywriter"],
  "Operações":    ["Analista de Processos", "Coordenador de Logística", "Técnico Operacional"],
  "Financeiro":   ["Analista Financeiro", "Controller", "Auxiliar Contábil"],
  "RH":           ["Analista de RH", "Recruiter", "Coordenador de RH"],
  "TI":           ["Analista de TI", "Desenvolvedor Full-Stack", "DevOps Engineer"],
  "Diretoria":    ["Diretor Geral", "CEO", "CFO"],
};

const CONTRACT_TYPES = ["CLT", "CLT", "CLT", "PJ", "Estágio"];
const EMP_STATUSES   = ["ativo", "ativo", "ativo", "ativo", "férias", "afastado"];
const CITIES         = ["São Paulo/SP", "Rio de Janeiro/RJ", "Campinas/SP", "Curitiba/PR", "Camaçari/BA"];

export function generateDemoColaboradores() {
  const rand  = mulberry32(5005);
  const depts = Object.keys(CARGO_POR_DEPT);

  return RH_NOMES.map((fullName, i) => {
    const dept         = pick(rand, depts);
    const jobTitle     = pick(rand, CARGO_POR_DEPT[dept]);
    const contractType = pick(rand, CONTRACT_TYPES);
    const salary       = 2500 + Math.floor(rand() * 12500);
    const admission    = daysAgo(rand, 90, 1460);

    return {
      id:                 `demo-colab-${i + 1}`,
      profile_id:         null,
      full_name:          fullName,
      cpf:                null,
      rg:                 null,
      birth_date:         null,
      phone:              `(11) 9${String(Math.floor(rand() * 90000000 + 10000000))}`,
      email:              `${fullName.split(" ")[0].toLowerCase()}.${fullName.split(" ")[1]?.toLowerCase() || ""}@sanwey.com.br`,
      address_street:     null,
      address_number:     null,
      address_complement: null,
      address_neighborhood: null,
      address_city:       pick(rand, CITIES).split("/")[0],
      address_state:      pick(rand, CITIES).split("/")[1],
      address_zip:        null,
      job_title:          jobTitle,
      department:         dept,
      contract_type:      contractType,
      admission_date:     admission.slice(0, 10),
      employee_status:    pick(rand, EMP_STATUSES),
      salary,
      document_type:      null,
      document_path:      null,
      notes:              null,
      vaga_id:            null,
      onboarding_stage:   null,
      onboarding_stage_changed_at: null,
      custom_fields:      {},
      activities:         [],
      is_demo:            true,
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   RH: VAGAS
   ═══════════════════════════════════════════════════════════ */

const VAGA_TITULOS = [
  "Analista Comercial Sênior",
  "Designer UX/UI",
  "Desenvolvedor Back-End Node.js",
  "Analista de Marketing Digital",
  "Coordenador de Logística",
  "Analista Financeiro Pleno",
  "Recruiter Especializado",
  "SDR · Prospecção Outbound",
];

const VAGA_STAGES = ["triagem", "entrevista_rh", "entrevista_gestor", "proposta", "contratado", "encerrado"];
const VAGA_STAGES_WEIGHTED = ["triagem", "triagem", "entrevista_rh", "entrevista_gestor", "proposta", "contratado"];

export function generateDemoVagas() {
  const rand = mulberry32(6006);

  return VAGA_TITULOS.map((title, i) => {
    const dept  = pick(rand, Object.keys(CARGO_POR_DEPT));
    const stage = pick(rand, VAGA_STAGES_WEIGHTED);

    return {
      id:                `demo-vaga-${i + 1}`,
      title,
      department:        dept,
      description:       `Vaga para ${title} no departamento de ${dept}. Atuará diretamente com a equipe em projetos estratégicos.`,
      requirements:      `Experiência na área de ${dept}, boa comunicação e capacidade de trabalho em equipe.`,
      salary_range:      `R$ ${(4000 + Math.floor(rand() * 8000)).toLocaleString("pt-BR")} – R$ ${(10000 + Math.floor(rand() * 8000)).toLocaleString("pt-BR")}`,
      contract_type:     pick(rand, CONTRACT_TYPES.filter(c => c !== "Estágio")),
      stage,
      stage_changed_at:  daysAgo(rand, 1, 30),
      open_date:         daysAgo(rand, 10, 60),
      close_date:        stage === "contratado" || stage === "encerrado" ? daysAgo(rand, 1, 10) : null,
      applications_count: Math.floor(rand() * 40),
      is_demo:           true,
    };
  });
}

/* ═══════════════════════════════════════════════════════════
   RH: CANDIDATOS (para recrutamento)
   ═══════════════════════════════════════════════════════════ */

const CANDIDATO_NOMES = [
  "Rafael Souza",   "Beatriz Lima",    "Carlos Alberto",  "Daniela Costa",
  "Eduardo Teixeira","Fernanda Melo",  "Gustavo Lopes",   "Helena Ramos",
  "Igor Castro",    "Juliana Pereira", "Kleber Santos",   "Letícia Alves",
  "Marcos Vidal",   "Natalia Braga",   "Osvaldo Dutra",   "Paula Nunes",
];

const CAND_STAGES  = ["triagem","entrevista_rh","entrevista_gestor","proposta","contratado","reprovado"];
const CAND_SOURCES = ["LinkedIn", "Indicação", "Site", "Indeed", "Gupy", "WhatsApp"];

export function generateDemoCandidatos() {
  const rand = mulberry32(7007);

  return CANDIDATO_NOMES.map((name, i) => {
    const stage = pickWeighted(rand, CAND_STAGES, [0.30, 0.25, 0.18, 0.12, 0.10, 0.05]);

    return {
      id:              `demo-candidato-${i + 1}`,
      name,
      email:           `${name.split(" ")[0].toLowerCase()}@email.com`,
      phone:           `(${Math.floor(rand() * 90 + 10)}) 9${String(Math.floor(rand() * 90000000 + 10000000))}`,
      linkedin_url:    null,
      resume_ext:      null,
      source:          pick(rand, CAND_SOURCES),
      stage,
      stage_changed_at: daysAgo(rand, 1, 20),
      fit_score:        60 + Math.floor(rand() * 40),
      justificativa:    stage === "reprovado"
        ? "Perfil não atende os requisitos técnicos mínimos para a vaga."
        : `Candidato com boa aderência ao perfil da vaga de ${pick(rand, VAGA_TITULOS)}.`,
      pontos_fortes:   ["Comunicação", "Proatividade", "Experiência técnica"].slice(0, 1 + Math.floor(rand() * 2)),
      gaps:            stage === "reprovado" ? ["Experiência insuficiente"] : [],
      motivo_reprovacao: null,
      notes:           [],
      rating:          3 + Math.floor(rand() * 3),
      is_demo:         true,
    };
  });
}
