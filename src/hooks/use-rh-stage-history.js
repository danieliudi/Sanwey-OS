import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Histórico de etapa de um registro específico de RH — mesma ideia de
// useSingleLeadHistory, mas multi-domínio (vagas/candidatos/onboarding/
// feedback/ferias/treinamentos), lendo da tabela genérica rh_stage_history
// (trigger imutável, ver migration 20260715_rh_stage_history.sql).
export function useRHStageHistory(domain, recordId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const fetchOne = useCallback(async () => {
    if (!domain || !recordId || !isSupabaseConfigured) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rh_stage_history")
        .select("from_stage, to_stage, changed_at, changed_by")
        .eq("domain", domain)
        .eq("record_id", recordId)
        .order("changed_at", { ascending: false });
      if (!mountedRef.current) return;
      if (error) throw error;
      setEntries((data || []).map(r => ({
        fromStage: r.from_stage,
        toStage: r.to_stage,
        changedAt: r.changed_at,
        changedBy: r.changed_by,
      })));
    } catch {
      if (mountedRef.current) setEntries([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [domain, recordId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchOne();
    return () => { mountedRef.current = false; };
  }, [fetchOne]);

  return { entries, loading, refetch: fetchOne };
}

export default useRHStageHistory;
