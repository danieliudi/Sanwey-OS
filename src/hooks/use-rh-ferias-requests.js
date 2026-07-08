import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "rh_ferias";

export function useRHFeriasRequests({ enabled = true } = {}) {
  const [requests, setRequests] = useState([]);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) return;
    const { data, error } = await supabase
      .from(TABLE)
      .select("*, profiles:user_id(id, name)")
      .order("created_at", { ascending: false });
    if (!error) setRequests(data || []);
  }, [enabled]);

  useEffect(() => { if (enabled) fetchAll(); }, [fetchAll, enabled]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const channelName = `rh_ferias_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  return { requests, refetch: fetchAll };
}
