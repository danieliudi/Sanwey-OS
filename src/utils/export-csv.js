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

export default exportLeadsToCSV;
