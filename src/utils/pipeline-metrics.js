// Helpers de métrica que dependem da config de pipeline (probability,
// slaDays). Antes essas constantes eram globais (STALE_THRESHOLD_DAYS=14).
// Agora cada etapa tem o seu SLA configurável no Pipeline Builder.

import { DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_SLA_DAYS = 14;

// Fallback: se a empresa não tem pipeline custom, usa o default global.
function findStage(stageId, companyStages) {
  if (Array.isArray(companyStages)) {
    const s = companyStages.find(x => x.id === stageId);
    if (s) return s;
  }
  return DEFAULT_PIPELINE_STAGES.find(x => x.id === stageId);
}

// Lead está "parado" quando os dias sem atividade ultrapassam o SLA da
// etapa atual. Atividade = lastActivity ou, na falta, stageChangedAt.
export function isStale(lead, companyStages) {
  if (!lead || lead.stage === "ganho" || lead.stage === "perdido") return false;
  const stage = findStage(lead.stage, companyStages);
  if (stage?.terminal) return false;
  const sla = Number.isFinite(stage?.slaDays) ? stage.slaDays : DEFAULT_SLA_DAYS;
  const ref = lead.lastActivity || lead.stageChangedAt || lead.createdAt;
  if (!ref) return false;
  const ts = new Date(ref).getTime();
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) / MS_PER_DAY > sla;
}

// Dias parados na etapa atual (apenas pra exibição). Retorna 0 se não dá
// pra calcular.
export function daysIdle(lead) {
  const ref = lead?.lastActivity || lead?.stageChangedAt || lead?.createdAt;
  if (!ref) return 0;
  const ts = new Date(ref).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / MS_PER_DAY));
}

// Forecast ponderado: value × probability / 100 da etapa atual.
// Aceita probability em 0–1 (compat) ou 0–100.
export function weightedValue(lead, companyStages) {
  if (!Number.isFinite(lead?.value)) return 0;
  const stage = findStage(lead.stage, companyStages);
  let p = stage?.probability;
  if (!Number.isFinite(p)) p = Number.isFinite(lead.probability) ? lead.probability : 0;
  if (p > 1) p = p / 100;
  return lead.value * p;
}
