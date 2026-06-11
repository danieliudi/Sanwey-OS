import { SKU_CATALOG } from "../constants/skus";

// Deterministic PRNG (mulberry32) so that lead generation is stable between runs
// while still looking "random". Fixes the v3 bug where random seeds generated
// different leads for the cross-referral pass vs the pipeline.
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const LEAD_SEED = 42;

const INDUSTRIA_DATA = [
  { company: "Braskem S.A.", sector: "Químico/Petroquímico", city: "Camaçari/BA",
    trigger: "Licenciamento", triggerLabel: "Renovação licença fabril",
    evidence: "Parceria técnica para certificação de nova linha de resinas",
    decisionMaker: { name: "Bruno Salles", role: "Gerente EHS" }, owner: "u_juliana" },
  { company: "Petrobras E&P Bacia de Santos", sector: "Off-shore", city: "Santos/SP",
    trigger: "ANP", triggerLabel: "Certificação ANP off-shore",
    evidence: "Contrato de fornecimento de big bags certificados ANP para plataformas",
    decisionMaker: { name: "Letícia Vargas", role: "Compras Estratégicas" }, owner: "u_juliana" },
  { company: "Shell Brasil", sector: "Off-shore", city: "Rio de Janeiro/RJ",
    trigger: "Licitação", triggerLabel: "Contrato de fornecimento",
    evidence: "Pregão aberto para fornecimento técnico sob encomenda",
    decisionMaker: { name: "Eduardo Vidal", role: "Diretor Operações" }, owner: "u_juliana" },
  { company: "Equinor Brasil", sector: "Off-shore", city: "Rio de Janeiro/RJ",
    trigger: "ANP", triggerLabel: "Homologação novo projeto",
    evidence: "Projeto Bacalhau — demanda de embalagem certificada off-shore",
    decisionMaker: { name: "Helena Braga", role: "Supply Chain" }, owner: "u_beatriz" },
  { company: "Total Energies", sector: "Off-shore", city: "Rio de Janeiro/RJ",
    trigger: "Licitação", triggerLabel: "Contrato multi-anual",
    evidence: "Proposta técnica para fornecimento de 3 anos",
    decisionMaker: { name: "Raphael Antunes", role: "Gerente Compras" }, owner: null },
  { company: "Galvasud (ArcelorMittal)", sector: "Siderurgia", city: "Resende/RJ",
    trigger: "Inmetro", triggerLabel: "Re-certificação Inmetro",
    evidence: "Validação técnica de novo lote certificado",
    decisionMaker: { name: "Marcelo Coelho", role: "Qualidade Industrial" }, owner: "u_marcos" },
  { company: "White Martins Praxair", sector: "Gases Industriais", city: "São Paulo/SP",
    trigger: "Licenciamento", triggerLabel: "Embalagens especiais",
    evidence: "Demanda de big bags condutivos Type C para pós metálicos",
    decisionMaker: { name: "Vanessa Lima", role: "Engenharia de Processos" }, owner: "u_juliana" },
  { company: "Yara Brasil Fertilizantes", sector: "Agroquímica", city: "Rio Grande/RS",
    trigger: "ANP", triggerLabel: "Compliance portuário",
    evidence: "Renovação de contrato de fornecimento portuário",
    decisionMaker: { name: "Alexandre Duarte", role: "Suprimentos Estratégicos" }, owner: "u_beatriz" },
  { company: "3M Brasil", sector: "Químico/Industrial", city: "Sumaré/SP",
    trigger: "Licenciamento", triggerLabel: "Novas linhas técnicas",
    evidence: "Certificação de fornecedor para linha de abrasivos",
    decisionMaker: { name: "Karina Fontes", role: "Strategic Sourcing" }, owner: null },
  { company: "Gerdau Aços Especiais", sector: "Siderurgia", city: "Pindamonhangaba/SP",
    trigger: "Inmetro", triggerLabel: "Fornecedor homologado",
    evidence: "Processo de homologação como fornecedor estratégico",
    decisionMaker: { name: "Diego Ramos", role: "Qualidade de Fornecedores" }, owner: "u_marcos" },
  { company: "Suzano S.A.", sector: "Papel e Celulose", city: "Imperatriz/MA",
    trigger: "ISO", triggerLabel: "Atualização ISO 9001",
    evidence: "Auditoria de fornecedores alinhada à nova ISO",
    decisionMaker: { name: "Beatriz Nogueira", role: "Compras Sustentáveis" }, owner: "u_juliana" },
  { company: "Rhodia Solvay", sector: "Químico/Petroquímico", city: "Paulínia/SP",
    trigger: "Licenciamento", triggerLabel: "Sob encomenda técnica",
    evidence: "Desenvolvimento de big bag específico para especialidades",
    decisionMaker: { name: "Felipe Cardoso", role: "Gerente de Compras" }, owner: "u_beatriz" },
];

const RESIBAG_DATA = [
  { company: "Petrolab Solventes S.A.", sector: "Distribuição Química", city: "Duque de Caxias/RJ",
    trigger: "Fiscalização", triggerLabel: "Auto IBAMA",
    evidence: "Auto de infração IBAMA 9.872.143/2026 — acondicionamento irregular Classe I",
    decisionMaker: { name: "Fernanda Costa", role: "Diretora de Compliance" }, owner: "u_rafael" },
  { company: "Química Industrial Votorantim", sector: "Química Fina", city: "Campinas/SP",
    trigger: "IBAMA", triggerLabel: "Atualização RAPP 2026",
    evidence: "Empresa no novo CNAE obrigado ao RAPP — volume 14t mensais Classe I",
    decisionMaker: { name: "Ricardo Almeida", role: "Gerente de SSMA" }, owner: "u_carlos" },
  { company: "Novatinta Indústria", sector: "Tintas e Vernizes", city: "São Bernardo do Campo/SP",
    trigger: "RAPP", triggerLabel: "Novo RAPP submetido",
    evidence: "RAPP 2025 com aumento de 42% no volume de resíduo Classe I declarado",
    decisionMaker: { name: "João Beltrão", role: "Gerente de Meio Ambiente" }, owner: "u_rafael" },
  { company: "Clariant Brasil", sector: "Química Fina", city: "Suzano/SP",
    trigger: "ANTT", triggerLabel: "Adequação ANTT 5998",
    evidence: "Auditoria de transporte revela gap em embalagem homologada",
    decisionMaker: { name: "Patrícia Monteiro", role: "Coordenadora EHS" }, owner: "u_rafael" },
  { company: "BASF Brasil", sector: "Química Fina", city: "Guaratinguetá/SP",
    trigger: "IBAMA", triggerLabel: "Renovação licença operação",
    evidence: "Prazo de renovação exige plano de gestão de resíduos perigosos",
    decisionMaker: { name: "Bruno Salles", role: "Gerente Ambiental" }, owner: "u_carlos" },
  { company: "Oxiteno Mauá", sector: "Petroquímica", city: "Mauá/SP",
    trigger: "Inmetro", triggerLabel: "Inmetro 320/2021",
    evidence: "Fornecedor atual sem certificação Inmetro vigente",
    decisionMaker: { name: "Letícia Vargas", role: "Supply Chain" }, owner: "u_rafael" },
  { company: "Unigel Acrílicos", sector: "Petroquímica", city: "Camaçari/BA",
    trigger: "Fiscalização", triggerLabel: "Notificação IBAMA",
    evidence: "Notificação sobre acondicionamento — prazo 60d para adequação",
    decisionMaker: { name: "André Ferraz", role: "Gestor de Meio Ambiente" }, owner: "u_rafael" },
  { company: "Tintas Coral AkzoNobel", sector: "Tintas e Vernizes", city: "Mauá/SP",
    trigger: "RAPP", triggerLabel: "Aumento de escopo",
    evidence: "Linha nova gera resíduos adicionais — replanejamento ambiental",
    decisionMaker: { name: "Claudia Ribeiro", role: "Gerente EHS" }, owner: "u_carlos" },
  { company: "Solvay Especialidades", sector: "Química Fina", city: "Jacareí/SP",
    trigger: "ANTT", triggerLabel: "Revisão logística",
    evidence: "Projeto de centralização de descarte cruza com ANTT 5998",
    decisionMaker: { name: "Henrique Dias", role: "Diretor de Operações" }, owner: "u_rafael" },
  { company: "Eternit S.A.", sector: "Construção Industrial", city: "Manaus/AM",
    trigger: "IBAMA", triggerLabel: "RAPP novo CNAE",
    evidence: "Empresa entrou no CNAE obrigado ao RAPP em 2026",
    decisionMaker: { name: "Mariana Souto", role: "Sustentabilidade" }, owner: null },
  { company: "Dupont do Brasil", sector: "Química Fina", city: "Paulínia/SP",
    trigger: "Inmetro", triggerLabel: "Certificação fornecedor",
    evidence: "Programa de qualificação de fornecedores ambientais",
    decisionMaker: { name: "Paulo Henrique", role: "Procurement Ambiental" }, owner: "u_carlos" },
  { company: "Galvasul Galvanização", sector: "Metalurgia", city: "Canoas/RS",
    trigger: "RAPP", triggerLabel: "Expansão de operação",
    evidence: "Nova linha de galvanização gera resíduo Classe I adicional",
    decisionMaker: { name: "Rogério Pinto", role: "Gerente EHS" }, owner: "u_rafael" },
  { company: "Bayer CropScience", sector: "Agroquímica", city: "Belford Roxo/RJ",
    trigger: "ANTT", triggerLabel: "Logística de perigosos",
    evidence: "Revisão de política de embalagem para transporte de formulados",
    decisionMaker: { name: "Giovana Teles", role: "Gerente Regulatório" }, owner: "u_carlos" },
  { company: "Syngenta", sector: "Agroquímica", city: "Paulínia/SP",
    trigger: "IBAMA", triggerLabel: "Adequação operacional",
    evidence: "Plano de sustentabilidade exige rastreabilidade de resíduos",
    decisionMaker: { name: "Thiago Mendes", role: "Sustentabilidade" }, owner: "u_rafael" },
];


function pickStage(rand) {
  const stages = ["prospeccao", "qualificacao", "visitas", "amostras", "negociacao", "ganho", "perdido"];
  const weights = [0.22, 0.20, 0.16, 0.15, 0.14, 0.10, 0.03];
  let r = rand(), acc = 0;
  for (let i = 0; i < stages.length; i++) {
    acc += weights[i];
    if (r <= acc) return stages[i];
  }
  return stages[0];
}

function pad2(n) { return String(n).padStart(2, "0"); }
function pad3(n) { return String(n).padStart(3, "0"); }

export function generateLeadsForAllCompanies() {
  const rand = mulberry32(LEAD_SEED);
  const out = [];
  let nextId = 1;
  const now = Date.now();

  const createLead = (companyId, opts) => {
    const skuList = SKU_CATALOG[companyId];
    const sku = skuList[Math.floor(rand() * skuList.length)];
    const daysAgo = Math.floor(rand() * 45);
    const createdAt = new Date(now - daysAgo * 86400000);
    const fitScore = opts.fitMin + Math.floor(rand() * (opts.fitMax - opts.fitMin));
    const quantity = 50 + Math.floor(rand() * 800);
    const value = sku.unitPrice * quantity;
    const probability = fitScore >= 80 ? 0.7 : fitScore >= 65 ? 0.5 : fitScore >= 50 ? 0.3 : 0.15;
    const closeDate = new Date(now + (15 + Math.floor(rand() * 75)) * 86400000);
    const stage = pickStage(rand);
    const urg = fitScore > 80 ? "imediato" : fitScore > 65 ? "30d" : fitScore > 50 ? "90d" : "indefinido";
    const nowISO = new Date(now).toISOString();
    const cityParts = (opts.city || "").split("/");
    const state = cityParts[1] || "—";

    return {
      id: `lead_${nextId++}`,
      companyId,
      cnpj: `${pad2(Math.floor(rand() * 90) + 10)}.${pad3(Math.floor(rand() * 900) + 100)}.${pad3(Math.floor(rand() * 900) + 100)}/0001-${pad2(Math.floor(rand() * 90) + 10)}`,
      company: opts.company,
      sector: opts.sector,
      size: opts.size || (fitScore > 78 ? "Enterprise" : fitScore > 60 ? "Mid-Market" : "PME"),
      city: opts.city,
      state,
      trigger: opts.trigger,
      triggerLabel: opts.triggerLabel,
      fitScore,
      sku: sku.id,
      skuName: sku.name,
      unitPrice: sku.unitPrice,
      quantity,
      value,
      probability,
      closeDate: closeDate.toISOString(),
      dateDetected: createdAt.toISOString(),
      daysAgo,
      stage,
      status: stage,
      owner: opts.owner || null,
      urgency: urg,
      evidence: opts.evidence,
      decisionMaker: opts.decisionMaker,
      starred: false,
      notes: [],
      createdAt: createdAt.toISOString(),
      lastActivity: nowISO,
      stageChangedAt: nowISO,
    };
  };

  INDUSTRIA_DATA.forEach(d => out.push(createLead("industria", { ...d, fitMin: 60, fitMax: 95 })));
  RESIBAG_DATA.forEach(d => out.push(createLead("resibag", { ...d, fitMin: 65, fitMax: 95 })));

  return out;
}
