import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Dados pro painel "Conexões" do perfil de Cliente — mesma ideia de
// use-colaborador-connections.js, RPC própria (get_client_connections).
export function useClientConnections(clientId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !clientId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.rpc("get_client_connections", { p_client_id: clientId });
      if (err) throw err;
      setData(result || {});
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { data: data || {}, loading, error, refetch: fetchAll };
}
