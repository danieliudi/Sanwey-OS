import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

/**
 * Manages allowed stage transition rules per company. Migrado de
 * localStorage pra Supabase (tabela pipeline_stage_transitions,
 * domain='comercial') — compartilhado entre usuários, não mais por
 * navegador. API externa preservada.
 *
 * `rules` shape (reconstruído a partir das linhas do banco, mesma forma de
 * antes — usado por PipelineBuilderView/SellerPreviewModal só pra um
 * Boolean(rules[companyId]) "esta empresa já foi configurada?"):
 *   { [companyId]: { [fromStageId]: string[] } }
 *
 * Ausência de linhas pra um (company, fromStage) = aberto (todas as
 * transições permitidas). Uma vez configurado, toggleTransition/
 * setRowAllowed gravam a matriz inteira (todas as combinações from→to),
 * então a leitura fica: existe linha? usa allowed. Não existe? aberto.
 */

const DOMAIN = "comercial";

export function usePipelineTransitions() {
  const [rows, setRows] = useState([]); // linhas cruas do banco, [{company_id, from_stage_key, to_stage_key, allowed}]
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("pipeline_stage_transitions")
      .select("*")
      .eq("domain", DOMAIN);
    if (error || !activeRef.current) return;
    setRows(data || []);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    if (!isSupabaseConfigured) return;
    fetchAll();
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`pipeline-transitions-comercial-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_stage_transitions" }, (payload) => {
        if (!activeRef.current) return;
        const domain = payload.new?.domain ?? payload.old?.domain;
        if (domain !== DOMAIN) return;
        debouncedFetchAll();
      })
      .subscribe();
    return () => { activeRef.current = false; debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Reconstrói o shape { [companyId]: { [fromStageId]: string[] } } a partir
  // das linhas — só as linhas allowed=true entram no array de destinos.
  const rules = {};
  for (const r of rows) {
    const company = (rules[r.company_id] ||= {});
    (company[r.from_stage_key] ||= []);
    if (r.allowed) company[r.from_stage_key].push(r.to_stage_key);
    else if (!(r.from_stage_key in company)) company[r.from_stage_key] = []; // garante a chave existir mesmo só com bloqueios
  }

  const isTransitionAllowed = useCallback((companyId, fromStageId, toStageId) => {
    if (!companyId || fromStageId === toStageId) return false;
    const companyRules = rules[companyId];
    if (!companyRules) return true;
    const allowed = companyRules[fromStageId];
    if (!Array.isArray(allowed)) return true;
    return allowed.includes(toStageId);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grava a matriz inteira from->to (todas as combinações, allowed true/false)
  // pra uma empresa — usado antes do primeiro toggle/set num from_stage ainda
  // não configurado, e no reset. Faz upsert linha a linha.
  const writeFullMatrix = useCallback(async (companyId, stages, overrides = {}) => {
    const ids = stages.map(s => s.id);
    const payload = [];
    for (const from of ids) {
      const allowedList = overrides[from] ?? ids.filter(id => id !== from);
      for (const to of ids) {
        if (to === from) continue;
        payload.push({
          domain: DOMAIN, company_id: companyId,
          from_stage_key: from, to_stage_key: to,
          allowed: allowedList.includes(to),
        });
      }
    }
    if (!payload.length) return true;
    const { error } = await supabase.from("pipeline_stage_transitions")
      .upsert(payload, { onConflict: "domain,company_id,from_stage_key,to_stage_key" });
    return !error;
  }, []);

  const toggleTransition = useCallback(async (companyId, stages, fromStageId, toStageId) => {
    const companyRules = rules[companyId];
    const current = companyRules?.[fromStageId] ?? stages.map(s => s.id).filter(id => id !== fromStageId);
    const next = current.includes(toStageId)
      ? current.filter(id => id !== toStageId)
      : [...current, toStageId];

    // Estado otimista local imediato.
    setRows(prev => {
      const withoutThis = prev.filter(r => !(r.company_id === companyId && r.from_stage_key === fromStageId));
      const ids = stages.map(s => s.id);
      const rebuilt = ids.filter(id => id !== fromStageId).map(to => ({
        domain: DOMAIN, company_id: companyId, from_stage_key: fromStageId, to_stage_key: to, allowed: next.includes(to),
      }));
      return [...withoutThis, ...rebuilt];
    });

    if (!isSupabaseConfigured) return;
    if (!companyRules) await writeFullMatrix(companyId, stages);
    const ok = await writeFullMatrix(companyId, stages, { [fromStageId]: next });
    if (!ok) await fetchAll(); // reverte o otimista pro estado real do banco
  }, [rows, writeFullMatrix, fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetCompany = useCallback(async (companyId) => {
    setRows(prev => prev.filter(r => r.company_id !== companyId));
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("pipeline_stage_transitions").delete().eq("domain", DOMAIN).eq("company_id", companyId);
    if (error) await fetchAll();
  }, [fetchAll]);

  const setRowAllowed = useCallback(async (companyId, stages, fromStageId, allowedIds) => {
    setRows(prev => {
      const withoutThis = prev.filter(r => !(r.company_id === companyId && r.from_stage_key === fromStageId));
      const ids = stages.map(s => s.id);
      const rebuilt = ids.filter(id => id !== fromStageId).map(to => ({
        domain: DOMAIN, company_id: companyId, from_stage_key: fromStageId, to_stage_key: to, allowed: allowedIds.includes(to),
      }));
      return [...withoutThis, ...rebuilt];
    });
    if (!isSupabaseConfigured) return;
    const companyRules = rules[companyId];
    if (!companyRules) await writeFullMatrix(companyId, stages);
    const ok = await writeFullMatrix(companyId, stages, { [fromStageId]: allowedIds });
    if (!ok) await fetchAll(); // reverte o otimista pro estado real do banco
  }, [rows, writeFullMatrix, fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAllowedDestinations = useCallback((companyId, fromStageId, allStageIds) => {
    const companyRules = rules[companyId];
    if (!companyRules) return allStageIds;
    const allowed = companyRules[fromStageId];
    if (!Array.isArray(allowed)) return allStageIds;
    return allowed;
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gate de etapa por valor (18/08/2026) — condição opcional pra um destino
  // específico, além do allowed bool. Ausência de linha = sem gate (mesma
  // semântica de "aberto" que o resto do hook já usa).
  const getTransitionCondition = useCallback((companyId, fromStageId, toStageId) => {
    const row = rows.find(r => r.company_id === companyId && r.from_stage_key === fromStageId && r.to_stage_key === toStageId);
    return row?.condition_groups || null;
  }, [rows]);

  // Grava só a condição, sem mexer no allowed de nenhum outro destino da
  // mesma etapa — writeFullMatrix (usado por toggle/setRowAllowed) nunca
  // inclui condition_groups no payload, então não corre risco de apagar uma
  // condição já salva quando outro destino é alternado (upsert do
  // supabase-js só toca as colunas presentes no payload no ON CONFLICT).
  const setTransitionCondition = useCallback(async (companyId, fromStageId, toStageId, conditionGroups) => {
    const existing = rows.find(r => r.company_id === companyId && r.from_stage_key === fromStageId && r.to_stage_key === toStageId);

    setRows(prev => existing
      ? prev.map(r => (r === existing ? { ...r, condition_groups: conditionGroups } : r))
      : [...prev, { domain: DOMAIN, company_id: companyId, from_stage_key: fromStageId, to_stage_key: toStageId, allowed: true, condition_groups: conditionGroups }]);

    if (!isSupabaseConfigured) return;
    if (existing) {
      const { error } = await supabase.from("pipeline_stage_transitions")
        .update({ condition_groups: conditionGroups })
        .eq("domain", DOMAIN).eq("company_id", companyId).eq("from_stage_key", fromStageId).eq("to_stage_key", toStageId);
      if (error) await fetchAll();
    } else {
      // Linha ainda não existia (destino nunca tinha sido tocado) — "sem
      // linha" já significava permitido, então grava allowed:true explícito
      // junto pra manter esse mesmo comportamento agora que a linha passa a
      // existir por causa da condição.
      const { error } = await supabase.from("pipeline_stage_transitions")
        .upsert(
          { domain: DOMAIN, company_id: companyId, from_stage_key: fromStageId, to_stage_key: toStageId, allowed: true, condition_groups: conditionGroups },
          { onConflict: "domain,company_id,from_stage_key,to_stage_key" },
        );
      if (error) await fetchAll();
    }
  }, [rows, fetchAll]);

  return { rules, isTransitionAllowed, toggleTransition, resetCompany, setRowAllowed, getAllowedDestinations, getTransitionCondition, setTransitionCondition };
}

export default usePipelineTransitions;
