import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Fase 1 do módulo ESG & Carbono (docs/PRD, mockup aprovado 07/08/2026):
// fatores de emissão versionados por vigência, registros de emissão
// imutáveis (travam a versão exata do fator usado) e relatórios como
// snapshot congelado. Nunca reimplementar o cálculo em outro lugar — este
// arquivo é a única porta de entrada pras 3 tabelas esg_*.

const FACTORS_TABLE = "esg_emission_factors";
const RECORDS_TABLE = "esg_emission_records";
const REPORTS_TABLE = "esg_reports";

function rowToFactor(r) {
  return {
    id: r.id,
    category: r.category,
    scope: r.scope,
    unit: r.unit,
    factorValue: r.factor_value != null ? Number(r.factor_value) : null,
    gwp: r.gwp != null ? Number(r.gwp) : 1,
    source: r.source,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}

function rowToRecord(r) {
  return {
    id: r.id,
    companyId: r.company_id,
    scope: r.scope,
    sourceType: r.source_type,
    sourceId: r.source_id,
    activityData: r.activity_data != null ? Number(r.activity_data) : null,
    activityUnit: r.activity_unit,
    emissionFactorId: r.emission_factor_id,
    co2eCalculated: r.co2e_calculated != null ? Number(r.co2e_calculated) : null,
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}

function rowToReport(r) {
  return {
    id: r.id,
    companyId: r.company_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    totalsByScope: r.totals_by_scope || {},
    recordIds: Array.isArray(r.record_ids) ? r.record_ids : [],
    generatedAt: r.generated_at,
    generatedBy: r.generated_by,
  };
}

// ── Fatores de emissão ───────────────────────────────────────────────────

export function useEsgEmissionFactors() {
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(FACTORS_TABLE)
        .select("*")
        .order("category", { ascending: true })
        .order("valid_from", { ascending: false });
      if (err) throw err;
      setFactors((data || []).map(rowToFactor));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channelName = `esg_emission_factors_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: FACTORS_TABLE }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Cria a próxima vigência de um fator e fecha (valid_to) a linha anterior
  // da mesma categoria/escopo, se houver uma vigente — nunca sobrescreve o
  // valor antigo (garantia de auditoria, ver spec do módulo).
  const createFactor = useCallback(async (factor) => {
    if (!isSupabaseConfigured) return null;
    const current = factors.find(f => f.category === factor.category && f.scope === factor.scope && !f.validTo);
    if (current && factor.validFrom < current.validFrom) {
      throw new Error(`A vigência a partir de ${factor.validFrom} é anterior à vigência atual (${current.validFrom}) -- um fator não pode retroagir antes da vigência aberta.`);
    }
    if (current) {
      const { data: fechado, error: closeErr } = await supabase
        .from(FACTORS_TABLE)
        .update({ valid_to: factor.validFrom })
        .eq("id", current.id)
        .select();
      if (closeErr) throw closeErr;
      // Zero linha = RLS barrou. Aqui isso importa mais que o normal: se a
      // vigência anterior NÃO for encerrada e o fator novo for inserido logo
      // abaixo, ficam dois fatores abertos ao mesmo tempo pro mesmo escopo —
      // e o cálculo de emissão passa a depender de qual linha vier primeiro.
      if (!fechado || fechado.length === 0) {
        throw new Error("Não foi possível encerrar a vigência do fator anterior — verifique suas permissões. Nenhum fator novo foi criado.");
      }
    }
    const { data, error: err } = await supabase
      .from(FACTORS_TABLE)
      .insert({
        category: factor.category,
        scope: factor.scope,
        unit: factor.unit,
        factor_value: factor.factorValue,
        gwp: factor.gwp ?? 1,
        source: factor.source,
        valid_from: factor.validFrom,
        created_by: factor.createdBy ?? null,
      })
      .select()
      .single();
    if (err) throw err;
    await fetchAll();
    return rowToFactor(data);
  }, [factors, fetchAll]);

  const activeFactorFor = useCallback((category, scope, atDate) => {
    const ref = atDate || new Date().toISOString().slice(0, 10);
    return factors.find(f =>
      f.category === category && f.scope === scope &&
      f.validFrom <= ref && (!f.validTo || f.validTo > ref)
    ) || null;
  }, [factors]);

  return { factors, loading, error, createFactor, activeFactorFor, refetch: fetchAll };
}

// ── Registros de emissão ─────────────────────────────────────────────────

export function useEsgEmissionRecords({ companyId } = {}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(RECORDS_TABLE).select("*").order("created_at", { ascending: false });
      if (companyId && companyId !== "all") query = query.eq("company_id", companyId);
      const { data, error: err } = await query;
      if (err) throw err;
      setRecords((data || []).map(rowToRecord));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channelName = `esg_emission_records_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: RECORDS_TABLE }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Registro é imutável (sem policy de UPDATE/DELETE no banco) — só cria.
  const createRecord = useCallback(async (record) => {
    if (!isSupabaseConfigured) return null;
    const { data, error: err } = await supabase
      .from(RECORDS_TABLE)
      .insert({
        company_id: record.companyId,
        scope: record.scope,
        source_type: record.sourceType,
        source_id: record.sourceId ?? null,
        activity_data: record.activityData,
        activity_unit: record.activityUnit,
        emission_factor_id: record.emissionFactorId,
        co2e_calculated: record.co2eCalculated,
        created_by: record.createdBy ?? null,
      })
      .select()
      .single();
    if (err) throw err;
    const created = rowToRecord(data);
    setRecords(prev => prev.some(r => r.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, []);

  const createRecords = useCallback(async (list) => {
    if (!isSupabaseConfigured || !list?.length) return [];
    const rows = list.map(record => ({
      company_id: record.companyId,
      scope: record.scope,
      source_type: record.sourceType,
      source_id: record.sourceId ?? null,
      activity_data: record.activityData,
      activity_unit: record.activityUnit,
      emission_factor_id: record.emissionFactorId,
      co2e_calculated: record.co2eCalculated,
      created_by: record.createdBy ?? null,
    }));
    const { data, error: err } = await supabase.from(RECORDS_TABLE).insert(rows).select();
    if (err) throw err;
    const created = (data || []).map(rowToRecord);
    setRecords(prev => [...created, ...prev]);
    return created;
  }, []);

  return { records, loading, error, createRecord, createRecords, refetch: fetchAll };
}

// ── Relatórios (snapshot) ────────────────────────────────────────────────

export function useEsgReports({ companyId } = {}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(REPORTS_TABLE).select("*").order("generated_at", { ascending: false });
      if (companyId && companyId !== "all") query = query.eq("company_id", companyId);
      const { data, error: err } = await query;
      if (err) throw err;
      setReports((data || []).map(rowToReport));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const generateReport = useCallback(async ({ companyId: cid, periodStart, periodEnd, totalsByScope, recordIds, generatedBy }) => {
    if (!isSupabaseConfigured) return null;
    const { data, error: err } = await supabase
      .from(REPORTS_TABLE)
      .insert({
        company_id: cid,
        period_start: periodStart,
        period_end: periodEnd,
        totals_by_scope: totalsByScope,
        record_ids: recordIds,
        generated_by: generatedBy ?? null,
      })
      .select()
      .single();
    if (err) throw err;
    const created = rowToReport(data);
    setReports(prev => [created, ...prev]);
    return created;
  }, []);

  return { reports, loading, error, generateReport, refetch: fetchAll };
}
