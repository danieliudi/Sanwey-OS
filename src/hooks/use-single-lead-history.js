import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Fetches stage history for a single lead. Lighter than useLeadHistory
// (which pulls every lead's full history).
export function useSingleLeadHistory(leadId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchOne = useCallback(async (isActive = () => true) => {
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
      if (!isActive()) return;
      if (error) throw error;
      setEntries((data || []).map(r => ({
        fromStage: r.from_stage,
        toStage: r.to_stage,
        changedAt: r.changed_at,
        changedBy: r.changed_by,
        note: r.note,
      })));
    } catch {
      if (isActive()) setEntries([]);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    let active = true;
    fetchOne(() => active);
    return () => { active = false; };
  }, [fetchOne]);

  return { entries, loading, refetch: fetchOne };
}

export default useSingleLeadHistory;
