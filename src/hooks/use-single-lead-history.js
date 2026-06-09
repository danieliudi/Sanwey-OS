import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Fetches stage history for a single lead. Lighter than useLeadHistory
// (which pulls every lead's full history).
export function useSingleLeadHistory(leadId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const fetchOne = useCallback(async () => {
    if (!leadId || !isSupabaseConfigured) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_stage_history")
        .select("from_stage, to_stage, changed_at, changed_by, note")
        .eq("lead_id", leadId)
        .order("changed_at", { ascending: false });
      if (!mountedRef.current) return;
      if (error) throw error;
      setEntries((data || []).map(r => ({
        fromStage: r.from_stage,
        toStage: r.to_stage,
        changedAt: r.changed_at,
        changedBy: r.changed_by,
        note: r.note,
      })));
    } catch {
      if (mountedRef.current) setEntries([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchOne();
    return () => { mountedRef.current = false; };
  }, [fetchOne]);

  return { entries, loading, refetch: fetchOne };
}

export default useSingleLeadHistory;
