import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Dados pro painel "Conexões" do perfil de Colaborador — uma RPC só
// (get_colaborador_connections, SECURITY DEFINER) em vez de 6 queries
// client-side sob a RLS própria de cada tabela.
export function useColaboradorConnections(colaboradorId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !colaboradorId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.rpc("get_colaborador_connections", { p_colaborador_id: colaboradorId });
      if (err) throw err;
      setData(result || {});
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [colaboradorId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { data: data || {}, loading, error, refetch: fetchAll };
}
