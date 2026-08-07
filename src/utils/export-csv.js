// Export utilities — gera CSV no formato pt-BR (delimitador ;) com BOM
// para Excel abrir com encoding correto. Lida com strings que contêm
// ; / aspas / quebras de linha encapsulando entre aspas duplas.

import { COMPANIES } from "../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";

const STAGE_LABELS = Object.fromEntries(
  DEFAULT_PIPELINE_STAGES.map(s => [s.id, s.name])
);

// Nome da etapa considerando o pipeline customizado da empresa do lead —
// sem isso, uma empresa que renomeou uma etapa no editor de etapas do Funil de Vendas
// via o export mostrava sempre o nome padrão global (achado da auditoria
// de fricção de 18/07 — as duas exportações de CSV divergiam nisso).
function resolveStageLabel(lead, pipelines) {
  const companyStages = pipelines?.[lead.companyId];
  const custom = Array.isArray(companyStages) ? companyStages.find(s => s.id === lead.stage) : null;
  return custom?.name || STAGE_LABELS[lead.stage] || lead.stage || "";
}

export function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(";") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
}

export function csvRow(values) {
  return values.map(csvCell).join(";");
}

export function triggerDownload(filename, content) {
  // BOM UTF-8 garante que Excel abra em pt-BR sem corromper acentos.
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBRNumber(n) {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Colunas `date` do Postgres chegam como "AAAA-MM-DD" puro; `new Date(...)`
// interpretaria isso como meia-noite UTC, o que "volta" um dia em fusos
// negativos (Brasil). Datas com hora (timestamptz) seguem o parsing normal.
export function formatDate(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

// Exporta a lista de leads do escopo atual.
export function exportLeadsToCSV(leads, { usersById, filename, pipelines } = {}) {
  const header = [
    "Empresa",
    "Razão social",
    "CNPJ",
    "Empresa do grupo",
    "Etapa",
    "Classificação cliente",
    "Valor (R$)",
    "Probabilidade (%)",
    "Fit score",
    "Responsável",
    "Cidade",
    "UF",
    "Setor",
    "Tamanho",
    "Telefone",
    "E-mail",
    "Data detectado",
    "Última atividade",
    "Previsão fechamento",
    "Próximo follow-up",
  ];
  const rows = (leads || []).map(l => [
    l.company || "",
    l.razaoSocial || "",
    l.cnpj || "",
    COMPANIES[l.companyId]?.name || l.companyId || "",
    resolveStageLabel(l, pipelines),
    l.clientClassification || "",
    formatBRNumber(l.value),
    l.probability ?? "",
    l.fitScore ?? "",
    usersById?.get?.(l.owner)?.name || l.owner || "",
    l.city || "",
    l.state || "",
    l.sector || "",
    l.size || "",
    l.phone || "",
    l.contactEmail || "",
    formatDate(l.dateDetected),
    formatDate(l.lastActivity),
    formatDate(l.closeDate),
    formatDate(l.nextFollowUp),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-leads-${today}.csv`, csv);
}

export function exportCampaignsToCSV(campaigns, { filename } = {}) {
  const header = ["Nome", "Canal", "Orçamento", "KPI", "Etapa", "Empresas", "Lançamento"];
  const rows = (campaigns || []).map(c => [
    c.name || "",
    c.channel || "",
    formatBRNumber(c.budget),
    c.kpi || "",
    c.stage || "",
    (c.companyIds || []).join(", "),
    formatDate(c.launchDate),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-campanhas-${today}.csv`, csv);
}

export function exportColaboradoresToCSV(colaboradores, { filename } = {}) {
  const header = ["Nome", "Departamento", "Cargo", "Status", "Admissão"];
  const rows = (colaboradores || []).map(c => [
    c.fullName || "",
    c.department || "",
    c.jobTitle || "",
    c.employeeStatus || "",
    formatDate(c.admissionDate),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-colaboradores-${today}.csv`, csv);
}

export function exportPurchasesToCSV(purchases, { suppliersById, usersById, filename } = {}) {
  const header = ["Item", "Nº solicitação", "Fornecedor", "Valor (R$)", "Etapa", "Responsáveis", "Prazo"];
  const rows = (purchases || []).map(p => {
    const responsibleIds = p.responsibleIds?.length ? p.responsibleIds : (p.responsibleId ? [p.responsibleId] : []);
    const responsibleNames = responsibleIds.map(id => usersById?.get?.(id)?.name).filter(Boolean).join(", ");
    return [
      p.itemName || "",
      p.requestNumber || "",
      suppliersById?.get?.(p.supplierId)?.name || "",
      formatBRNumber(p.totalValue),
      p.stage || "",
      responsibleNames,
      formatDate(p.dueDate),
    ];
  });
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-compras-${today}.csv`, csv);
}

export function exportComexOperationsToCSV(operations, { stages, filename } = {}) {
  const stageLabel = new Map((stages || []).map(s => [s.stageKey, s.name]));
  const header = ["Operação", "Etapa", "País", "Valor de venda (USD)", "Criado em"];
  const rows = (operations || []).map(o => [
    o.title || "",
    stageLabel.get(o.stage) || o.stage || "",
    o.buyerCountry || "",
    formatBRNumber(o.saleValue),
    formatDate(o.createdAt),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-comex-${today}.csv`, csv);
}

export function exportPosVendaCasesToCSV(cases, { stages, filename } = {}) {
  const stageLabel = new Map((stages || []).map(s => [s.stageKey, s.name]));
  const header = ["Cliente", "Empresa", "Etapa", "Valor (R$)", "Na etapa desde"];
  const rows = (cases || []).map(c => [
    c.clientName || "",
    COMPANIES[c.companyId]?.name || c.companyId || "",
    stageLabel.get(c.stage) || c.stage || "",
    formatBRNumber(c.value),
    formatDate(c.stageChangedAt),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-posvenda-${today}.csv`, csv);
}

export function exportOnboardingToCSV(colaboradores, { stages, filename } = {}) {
  const stageLabel = new Map((stages || []).map(s => [s.stageKey, s.name]));
  const header = ["Nome", "Cargo", "Departamento", "Etapa", "Na etapa desde"];
  const rows = (colaboradores || []).map(c => [
    c.fullName || "",
    c.jobTitle || "",
    c.department || "",
    stageLabel.get(c.onboardingStage) || c.onboardingStage || "",
    formatDate(c.onboardingStageChangedAt),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-onboarding-${today}.csv`, csv);
}

export function exportFeriasToCSV(requests, { colaboradoresById, stages, filename } = {}) {
  const stageLabel = new Map((stages || []).map(s => [s.stageKey, s.name]));
  const header = ["Colaborador", "Tipo", "Início", "Fim", "Status"];
  const rows = (requests || []).map(r => [
    colaboradoresById?.get?.(r.user_id)?.fullName || "",
    r.type || "",
    formatDate(r.start_date),
    formatDate(r.end_date),
    stageLabel.get(r.status) || r.status || "",
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-ferias-${today}.csv`, csv);
}

export function exportFeedbackToCSV(feedbacks, { colaboradoresById, stages, filename } = {}) {
  const stageLabel = new Map((stages || []).map(s => [s.stageKey, s.name]));
  const header = ["Colaborador", "Etapa", "Desfecho", "Atualizado em"];
  const rows = (feedbacks || []).map(f => [
    colaboradoresById?.get?.(f.user_id)?.fullName || "",
    stageLabel.get(f.status) || f.status || "",
    f.desfecho || "",
    formatDate(f.status_changed_at),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-feedback-${today}.csv`, csv);
}

export function exportTreinamentoAtribuicoesToCSV(atribuicoes, { colaboradoresById, stages, filename } = {}) {
  const stageLabel = new Map((stages || []).map(s => [s.stageKey, s.name]));
  const header = ["Colaborador", "Cargo", "Status", "Certificado", "Atualizado em"];
  const rows = (atribuicoes || []).map(a => {
    const colaborador = colaboradoresById?.get?.(a.colaborador_id);
    return [
      colaborador?.fullName || "",
      colaborador?.jobTitle || "",
      stageLabel.get(a.status) || a.status || "",
      a.certificado_url ? "Sim" : "Não",
      formatDate(a.status_changed_at),
    ];
  });
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-treinamento-${today}.csv`, csv);
}

export function exportVagasToCSV(vagas, { stages, filename } = {}) {
  const stageLabel = new Map((stages || []).map(s => [s.stageKey, s.name]));
  const header = ["Título", "Etapa", "Empresas"];
  const rows = (vagas || []).map(v => [
    v.title || "",
    stageLabel.get(v.stage) || v.stage || "",
    (v.company_ids || []).map(id => COMPANIES[id]?.short || id).join(", "),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-vagas-${today}.csv`, csv);
}

export function exportCandidatosToCSV(candidatos, { vagasById, stages, filename } = {}) {
  const stageLabel = new Map((stages || []).map(s => [s.stageKey, s.name]));
  const header = ["Nome", "E-mail", "Vaga", "Etapa"];
  const rows = (candidatos || []).map(c => [
    c.name || "",
    c.email || "",
    vagasById?.get?.(c.vaga_id)?.title || "",
    stageLabel.get(c.stage) || c.stage || "",
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-candidatos-${today}.csv`, csv);
}

export function exportPersonalTasksToCSV(tasks, { columns, filename } = {}) {
  const stageLabel = new Map((columns || []).map(c => [c.id, c.name]));
  const header = ["Título", "Etapa", "Prioridade", "Prazo", "Etiquetas"];
  const rows = (tasks || []).map(t => [
    t.title || "",
    stageLabel.get(t.status) || t.status || "",
    t.priority || "",
    formatDate(t.dueDate),
    (t.tags || []).join(", "),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-lista-pessoal-${today}.csv`, csv);
}

export default exportLeadsToCSV;
