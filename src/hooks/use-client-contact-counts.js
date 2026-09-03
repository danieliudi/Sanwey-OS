import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Contagem do comitê por cliente — um SELECT com `.in()`, não um hook por
// linha. Só lê client_contacts; a RLS já existente (interno / suporte /
// portal) continua valendo. Sem schema novo.

export function useClientContactCounts(clientIds) {
  const key = useMemo(() => {
    const ids = [...new Set((clientIds || []).filter(Boolean))].sort();
    return ids.join(",");
  }, [clientIds]);

  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(Boolean(key) && isSupabaseConfigured);

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!isSupabaseConfigured || ids.length === 0) {
      setCounts({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("client_id, active")
        .in("client_id", ids);
      if (cancelled) return;
      if (error) {
        setCounts({});
        setLoading(false);
        return;
      }
      const map = {};
      for (const row of data || []) {
        if (!map[row.client_id]) map[row.client_id] = { total: 0, active: 0 };
        map[row.client_id].total += 1;
        if (row.active) map[row.client_id].active += 1;
      }
      setCounts(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [key]);

  return { counts, loading };
}

export default useClientContactCounts;
