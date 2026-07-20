import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "record_views";

// Rastreia quando o usuário atual viu por último cada registro de um
// módulo (leads, campaigns, rh_ferias, etc.) — usado pro badge de
// "comentário não lido" nos cards do kanban. Um fetch por módulo no mount
// do board (não por card), e markViewed(recordId) grava/atualiza a
// timestamp ao abrir o drawer daquele registro.
export function useRecordViews(module, userId) {
  const [viewedAt, setViewedAt] = useState({}); // { [recordId]: isoString }
  const [loading, setLoading] = useState(true);
  const localRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      if (!isSupabaseConfigured || !userId || !module) { setViewedAt({}); setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from(TABLE)
        .select("record_id, last_viewed_at")
        .eq("user_id", userId)
        .eq("module", module);
      if (!cancelled) {
        if (!error && data) {
          const map = {};
          data.forEach(r => { map[r.record_id] = r.last_viewed_at; });
          localRef.current = map;
          setViewedAt(map);
        }
        setLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [module, userId]);

  const markViewed = useCallback(async (recordId) => {
    if (!isSupabaseConfigured || !userId || !module || !recordId) return;
    const now = new Date().toISOString();
    localRef.current = { ...localRef.current, [recordId]: now };
    setViewedAt(prev => ({ ...prev, [recordId]: now }));
    await supabase
      .from(TABLE)
      .upsert(
        { user_id: userId, module, record_id: recordId, last_viewed_at: now },
        { onConflict: "user_id,module,record_id" }
      );
  }, [module, userId]);

  return { viewedAt, markViewed, loading };
}
