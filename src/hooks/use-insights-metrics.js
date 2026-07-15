import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useRHPipelineStages } from "./use-rh-pipeline-stages";
import { useLeadHistory } from "./use-lead-history";
import { useMarketingQuotes } from "./use-marketing-quotes";
import { DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";
import { COMPANY_IDS } from "../constants/companies";

// Painel de Insights — Fase 1 (velocidade + custo), usando só o que já
// existe no banco: rh_stage_history (contratação/onboarding),
// lead_stage_history (fechamento Comercial), marketing_supplier_quotes
// (aprovação de cotação) e os valores já cadastrados de
// fornecedores/benefícios/compras/leads ganhos. Sem tabela nova, sem API
// externa, sem dado hipotético.

const DAY_MS = 86400000;

// ── rh_stage_history não tem um hook de agregação (use-rh-stage-history.js
// só busca UM registro por vez) — lê direto aqui, mesmo padrão de query de
// useLeadHistory (busca a tabela toda, ordenada por changed_at asc).
function useRHStageHistoryAll(domain) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("rh_stage_history")
          .select("record_id, from_stage, to_stage, changed_at")
          .eq("domain", domain)
          .order("changed_at", { ascending: true });
        if (!active) return;
        if (error) throw error;
        setEntries((data || []).map(r => ({
          recordId: r.record_id,
          fromStage: r.from_stage,
          toStage: r.to_stage,
          changedAt: r.changed_at,
        })));
      } catch {
        if (active) setEntries([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [domain]);

  return { entries, loading };
}

// Custos já existentes — sem hook dedicado, lê direto via supabase (ver
// migrations 20260716_rh_fornecedores_beneficios.sql e
// 20260714_marketing_purchase_requests.sql).
function useCustosRaw() {
  const [state, setState] = useState({ contratos: [], beneficios: [], compras: [], loading: isSupabaseConfigured });

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setState(s => ({ ...s, loading: false }));
      return;
    }
    (async () => {
      try {
        const [contratosRes, beneficiosRes, comprasRes] = await Promise.all([
          supabase.from("rh_fornecedor_contratos").select("valor, vigencia_fim"),
          supabase.from("rh_colaborador_beneficios").select("valor"),
          supabase.from("marketing_purchase_requests").select("total_value"),
        ]);
        if (!active) return;
        setState({
          contratos: contratosRes.data || [],
          beneficios: beneficiosRes.data || [],
          compras: comprasRes.data || [],
          loading: false,
        });
      } catch {
        if (active) setState(s => ({ ...s, loading: false }));
      }
    })();
    return () => { active = false; };
  }, []);

  return state;
}

function groupByRecordId(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.recordId)) map.set(r.recordId, []);
    map.get(r.recordId).push(r);
  }
  return map;
}

// Tempo até etapa terminal, por registro: começa na entrada mais antiga
// (changed_at asc já garantido por quem monta `entries`) e termina na
// PRIMEIRA entrada cujo to_stage esteja em `terminalKeys`. Sem etapa
// terminal ainda = registro em andamento, excluído da média.
function computeDurations(byRecord, terminalKeys) {
  const durations = [];
  for (const entries of byRecord.values()) {
    if (!entries.length) continue;
    const sorted = [...entries].sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
    const startMs = new Date(sorted[0].changedAt).getTime();
    if (!Number.isFinite(startMs)) continue;
    const endEntry = sorted.find(e => terminalKeys.has(e.toStage));
    if (!endEntry) continue; // em andamento — não conta pra "tempo até concluir"
    const endMs = new Date(endEntry.changedAt).getTime();
    if (!Number.isFinite(endMs) || endMs < startMs) continue;
    durations.push({ days: (endMs - startMs) / DAY_MS, endMs });
  }
  return durations;
}

// Bucket "atual" (últimos 90 dias) vs "anterior" (91-180 dias atrás),
// comparando as médias. changePercent positivo = ficou mais rápido
// (duração menor). Nunca divide por zero nem mostra % com amostra < 2 no
// período anterior.
function bucketMetric(durations) {
  const now = Date.now();
  const current = durations.filter(d => d.endMs > now - 90 * DAY_MS && d.endMs <= now);
  const previous = durations.filter(d => d.endMs > now - 180 * DAY_MS && d.endMs <= now - 90 * DAY_MS);
  const avg = arr => arr.reduce((sum, d) => sum + d.days, 0) / arr.length;

  const avgCurrent = current.length > 0 ? avg(current) : null;
  const avgPrevious = previous.length >= 2 ? avg(previous) : null;

  let changePercent = null;
  if (avgCurrent != null && avgPrevious != null && avgPrevious > 0) {
    changePercent = Math.round(((avgPrevious - avgCurrent) / avgPrevious) * 1000) / 10;
  }

  return {
    avgDays: avgCurrent != null ? Math.round(avgCurrent * 10) / 10 : null,
    sampleSize: current.length,
    changePercent,
  };
}

const EMPTY_VELOCITY_METRIC = { avgDays: null, sampleSize: 0, changePercent: null };

export function useInsightsMetrics({ leads = [], pipelines = {} } = {}) {
  const { entries: contratacaoRaw, loading: loadingContratacaoHist } = useRHStageHistoryAll("candidatos");
  const { entries: onboardingRaw, loading: loadingOnboardingHist } = useRHStageHistoryAll("onboarding");
  const { stages: contratacaoStages, loading: loadingContratacaoStages } = useRHPipelineStages("candidatos");
  const { stages: onboardingStages, loading: loadingOnboardingStages } = useRHPipelineStages("onboarding");
  const { byLead, loading: loadingLeadHistory } = useLeadHistory();
  const { quotes, loading: loadingQuotes } = useMarketingQuotes({});
  const { contratos, beneficios, compras, loading: loadingCustos } = useCustosRaw();

  const velocity = useMemo(() => {
    const contratacaoTerminalKeys = new Set(
      contratacaoStages.filter(s => s.terminal).map(s => s.stageKey)
    );
    const contratacao = contratacaoTerminalKeys.size > 0
      ? bucketMetric(computeDurations(groupByRecordId(contratacaoRaw), contratacaoTerminalKeys))
      : EMPTY_VELOCITY_METRIC;

    const onboardingTerminalKeys = new Set(
      onboardingStages.filter(s => s.terminal).map(s => s.stageKey)
    );
    const onboarding = onboardingTerminalKeys.size > 0
      ? bucketMetric(computeDurations(groupByRecordId(onboardingRaw), onboardingTerminalKeys))
      : EMPTY_VELOCITY_METRIC;

    // Comercial — mesmo critério de etapa terminal (ganho/perdido) usado no
    // Painel Executivo: pipeline customizado da empresa do lead quando
    // existir, senão DEFAULT_PIPELINE_STAGES. Todas as empresas juntas numa
    // única métrica (lead_stage_history não guarda company_id por linha).
    const defaultTerminalIds = new Set(
      DEFAULT_PIPELINE_STAGES.filter(s => s.terminal).map(s => s.id)
    );
    const companyByLeadId = new Map(leads.map(l => [l.id, l.companyId]));
    const fechamentoDurations = [];
    for (const [leadId, entries] of byLead.entries()) {
      if (!entries.length) continue;
      const companyId = companyByLeadId.get(leadId);
      const companyStages = companyId ? pipelines?.[companyId] : null;
      const terminalIds = companyStages && companyStages.some(s => s.terminal)
        ? new Set(companyStages.filter(s => s.terminal).map(s => s.id))
        : defaultTerminalIds;
      const sorted = [...entries].sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
      const startMs = new Date(sorted[0].changedAt).getTime();
      if (!Number.isFinite(startMs)) continue;
      const endEntry = sorted.find(e => terminalIds.has(e.toStage));
      if (!endEntry) continue;
      const endMs = new Date(endEntry.changedAt).getTime();
      if (!Number.isFinite(endMs) || endMs < startMs) continue;
      fechamentoDurations.push({ days: (endMs - startMs) / DAY_MS, endMs });
    }
    const fechamentoComercial = bucketMetric(fechamentoDurations);

    // Marketing — cotação não usa histórico de etapa genérico, e sim os
    // dois timestamps já gravados direto na linha da cotação
    // (created_at → approved_at). Cotação ainda pendente/rejeitada (sem
    // approved_at) fica de fora, mesmo espírito de "em andamento".
    const quoteDurations = [];
    for (const q of quotes) {
      if (!q.createdAt || !q.approvedAt) continue;
      const startMs = new Date(q.createdAt).getTime();
      const endMs = new Date(q.approvedAt).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) continue;
      quoteDurations.push({ days: (endMs - startMs) / DAY_MS, endMs });
    }
    const aprovacaoCotacaoMarketing = bucketMetric(quoteDurations);

    return { contratacao, onboarding, fechamentoComercial, aprovacaoCotacaoMarketing };
  }, [contratacaoRaw, onboardingRaw, contratacaoStages, onboardingStages, byLead, leads, pipelines, quotes]);

  const custos = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fornecedoresRHTotal = contratos
      .filter(c => !c.vigencia_fim || new Date(c.vigencia_fim) >= today)
      .reduce((sum, c) => sum + Number(c.valor || 0), 0);

    const beneficiosMensalTotal = beneficios.reduce((sum, b) => sum + Number(b.valor || 0), 0);

    const comprasMarketingTotal = compras.reduce((sum, c) => sum + Number(c.total_value || 0), 0);

    // Mesmo critério de "ganho" do Painel Executivo (ExecutiveDashboard.jsx
    // → metricsByCompany): só empresas do Grupo (COMPANY_IDS) e stage
    // literal "ganho".
    let leadsGanhosTotal = 0;
    for (const l of leads) {
      if (!COMPANY_IDS.includes(l.companyId)) continue;
      if (l.stage === "ganho") leadsGanhosTotal += Number(l.value || 0);
    }

    return { fornecedoresRHTotal, beneficiosMensalTotal, comprasMarketingTotal, leadsGanhosTotal };
  }, [contratos, beneficios, compras, leads]);

  const loading = (
    loadingContratacaoHist || loadingOnboardingHist ||
    loadingContratacaoStages || loadingOnboardingStages ||
    loadingLeadHistory || loadingQuotes || loadingCustos
  );

  return { loading, velocity, custos };
}

export default useInsightsMetrics;
