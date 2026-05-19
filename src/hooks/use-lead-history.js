import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

/**
 * Returns the stage a lead was in AT a given timestamp, derived from its
 * history log (array of { toStage, changedAt } sorted oldest → newest).
 */
function stageAt(history, timestampMs) {
  if (!history || history.length === 0) return null;
  let result = null;
  for (const entry of history) {
    const t = new Date(entry.changedAt).getTime();
    if (t <= timestampMs) result = entry.toStage;
    else break;
  }
  return result;
}

/**
 * Returns an array of stage IDs (one per snapshot timestamp) for a single
 * lead's history. Used by FunnelHistoryView to build the matrix columns.
 */
export function snapshotStagesAt(history, timestamps) {
  return timestamps.map(ts => stageAt(history, ts));
}

/**
 * Fetches lead stage-change history from Supabase `lead_stage_history` table.
 *
 * Expected table schema:
 *   lead_stage_history(id bigint, lead_id text, company_id text, from_stage text,
 *                      to_stage text, changed_at timestamptz, changed_by uuid, note text)
 *
 * In mock mode (Supabase not configured) returns an empty Map so the view
 * renders gracefully — all snapshot cells show "—".
 */
export function useLeadHistory({ enabled = true } = {}) {
  const [byLead, setByLead] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchHistory = useCallback(async () => {
    if (!enabled) return;

    // Mock / no-backend mode — return empty gracefully.
    if (!isSupabaseConfigured) {
      setByLead(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: sbError } = await supabase
        .from("lead_stage_history")
        .select("lead_id, from_stage, to_stage, changed_at")
        .order("changed_at", { ascending: true });

      if (!mountedRef.current) return;
      if (sbError) throw sbError;

      // Group rows by lead_id into Map<leadId, HistoryEntry[]> oldest → newest.
      const map = new Map();
      for (const row of data || []) {
        const key = row.lead_id;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({
          fromStage: row.from_stage,
          toStage: row.to_stage,
          changedAt: row.changed_at,
        });
      }
      setByLead(map);
    } catch (err) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    fetchHistory();
    return () => { mountedRef.current = false; };
  }, [fetchHistory]);

  return { byLead, loading, error, refetch: fetchHistory };
}

export default useLeadHistory;
