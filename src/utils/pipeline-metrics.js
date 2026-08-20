// Helpers de métrica que dependem da config de pipeline (probability,
// slaDays). Antes essas constantes eram globais (STALE_THRESHOLD_DAYS=14).
// Agora cada etapa tem o seu SLA configurável no editor de etapas do Funil de Vendas.

import { DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";
import { CANONICAL_SECTORS } from "../constants/taxonomy";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_SLA_DAYS = 14;

// FASE 5: ids de todos os responsáveis de um lead — usa owner_ids quando
// disponível, com fallback pro owner escalar em leads legados que por
// algum motivo não tenham sido preenchidos pelo backfill da migração.
// Movido de CRMView.jsx pra cá pra ser compartilhado — o Dashboard
// filtrava só por `owner` (escalar), então um lead onde o usuário era
// apenas co-responsável nunca aparecia em "Minhas tarefas", mesmo já
// aparecendo no Kanban do Funil de Vendas. Achado da auditoria de fricção de 18/07.
export function getLeadOwnerIds(l) {
  return Array.isArray(l.ownerIds) && l.ownerIds.length ? l.ownerIds : (l.owner ? [l.owner] : []);
}

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
  const ref = lead.lastActivity || lead.stageChangedAt || lead.negotiationStartedAt || lead.createdAt;
  if (!ref) return false;
  const ts = new Date(ref).getTime();
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) / MS_PER_DAY > sla;
}

// Dias parados na etapa atual (apenas pra exibição). Retorna 0 se não dá
// pra calcular.
export function daysIdle(lead) {
  const ref = lead?.lastActivity || lead?.stageChangedAt || lead?.negotiationStartedAt || lead?.createdAt;
  if (!ref) return 0;
  const ts = new Date(ref).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / MS_PER_DAY));
}

// Fit score (18/08/2026, gap real levantado no doc Zoho — "pontuar por fit
// de segmento + urgência regulatória"; revisado 19/08/2026 depois de QA
// multi-lente apontar que a 1ª versão media outra coisa — "saúde do
// negócio" (probabilidade da etapa + completude do cadastro), não "fit do
// cliente" como a spec pedia). Fórmula agora segue os 3 sinais que
// docs/design-spec-fit-score.md realmente listou:
//   40% fit de segmento — setor do lead bate com o núcleo de negócio da
//       empresa vendedora (CANONICAL_SECTORS, `src/constants/taxonomy.js`):
//       pra Resibag o núcleo é "Resíduos"; pra qualquer outra empresa do
//       Grupo (Sanbag) é o resto da lista. Sem setor preenchido, zero.
//   30% valor do negócio, normalizado contra REFERENCE_DEAL_CEILING —
//       faixa de referência pra escalar o score, NÃO um teto real de
//       negócio; ajustável sem schema novo, mas o valor em si (R$200k) é
//       um chute inicial que precisa validação do Daniel com dado
//       histórico real assim que houver volume pra calibrar.
//   30% recência de atividade (`daysIdle`, decai linearmente até 60 dias
//       parado) — mesmo sinal "tempo parado" que a spec pediu.
// "Urgência regulatória" (4º sinal da spec, prazo de certificação) fica de
// fora por ora — a spec já registrava isso como "a confirmar" (nenhum
// pipeline_stage_fields hoje cobre um campo de prazo de adequação de forma
// consistente entre etapas); não é uma correção deste QA, e não teria como
// entrar sem inventar um campo customizado primeiro.
// Não depende mais de companyStages/probabilidade de etapa — elimina de
// raiz o bug encontrado no mesmo QA (vários call-sites em "Todas as
// empresas" passavam o pipeline de UMA empresa fixa pra leads de outras).
// Sem chamada de IA — ao contrário de Prospecção/Recrutamento (scoring de
// registro frio que ninguém olhou ainda), aqui o vendedor já está
// trabalhando o negócio ativamente; o ganho de rodar IA por lead é menor e
// o custo (latência + tokens) é maior.
const RESIBAG_CORE_SECTORS = ["Resíduos"];
const SANBAG_CORE_SECTORS = CANONICAL_SECTORS.filter(s => !RESIBAG_CORE_SECTORS.includes(s));
const REFERENCE_DEAL_CEILING = 200000; // R$ 200k — ver comentário acima

export function computeFitScore(lead) {
  if (!lead) return 0;

  const coreSectors = lead.companyId === "resibag" ? RESIBAG_CORE_SECTORS : SANBAG_CORE_SECTORS;
  const segmentFit = !lead.sector ? 0 : (coreSectors.includes(lead.sector) ? 100 : 40);

  const value = Number(lead.value) || 0;
  const valueFit = value <= 0 ? 0 : Math.min(100, (value / REFERENCE_DEAL_CEILING) * 100);

  const idle = daysIdle(lead);
  const freshness = Math.max(0, 100 - (idle / 60) * 100);

  const score = segmentFit * 0.4 + valueFit * 0.3 + freshness * 0.3;
  return Math.round(Math.max(0, Math.min(100, score)));
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

// Agregados determinísticos do pipeline — usado tanto pelo Chat de IA (pra
// não deixar a LLM "chutar" conta) quanto por qualquer outra tela que
// precise dos mesmos números. Cálculo em JS puro, sem IA envolvida.
export function aggregatePipeline(leads, users) {
  const byStageMap = new Map();
  const byOwnerMap = new Map();
  let wonCount = 0, lostCount = 0, openValue = 0, wonValue = 0;

  for (const l of (leads || [])) {
    const stage = l.stage || "—";
    if (!byStageMap.has(stage)) byStageMap.set(stage, { stage, count: 0, value: 0 });
    const stageRow = byStageMap.get(stage);
    stageRow.count++;
    stageRow.value += l.value || 0;

    if (l.stage === "ganho") { wonCount++; wonValue += l.value || 0; }
    else if (l.stage === "perdido") { lostCount++; }
    else { openValue += l.value || 0; }

    if (l.owner) {
      const owner = users?.find(u => u.id === l.owner);
      const name = owner?.name || owner?.email || "Sem responsável";
      if (!byOwnerMap.has(l.owner)) byOwnerMap.set(l.owner, { name, count: 0, valueWon: 0, valueOpen: 0 });
      const ownerRow = byOwnerMap.get(l.owner);
      ownerRow.count++;
      if (l.stage === "ganho") ownerRow.valueWon += l.value || 0;
      else if (l.stage !== "perdido") ownerRow.valueOpen += l.value || 0;
    }
  }

  const totalDecided = wonCount + lostCount;
  const conversionRate = totalDecided > 0 ? Math.round((wonCount / totalDecided) * 1000) / 10 : 0;

  return {
    totalLeads: (leads || []).length,
    wonCount,
    lostCount,
    openValue,
    wonValue,
    conversionRate, // % — ganho / (ganho + perdido)
    byStage: Array.from(byStageMap.values()),
    byOwner: Array.from(byOwnerMap.values()).sort((a, b) => b.valueWon - a.valueWon),
  };
}
