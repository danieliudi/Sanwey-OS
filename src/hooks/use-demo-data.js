// Hook centralizado para carregar / limpar dados de demonstração em todas as
// seções da plataforma. Chama o Supabase diretamente (upsert por id) para que
// re-carregamentos sejam idempotentes — não duplicam linhas.
import { useCallback, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  generateDemoCampaigns,
  generateDemoDeliverables,
  generateDemoExpenses,
  generateDemoRequests,
  generateDemoColaboradores,
} from "../data/generate-demo-data";

async function upsertChunks(table, rows, conflictCol = "id") {
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: conflictCol });
    if (error) throw error;
  }
}

async function deleteDemo(table) {
  const { error } = await supabase.from(table).delete().eq("is_demo", true);
  if (error) throw error;
}

export function useDemoData() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [counts,  setCounts]  = useState(null);

  const loadAllDemo = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase não configurado — dados demo só funcionam com backend.");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const campaigns    = generateDemoCampaigns();
      const deliverables = generateDemoDeliverables();
      const expenses     = generateDemoExpenses();
      const requests     = generateDemoRequests();
      const colaboradores = generateDemoColaboradores();

      await upsertChunks("marketing_campaigns",    campaigns);
      await upsertChunks("marketing_deliverables", deliverables);
      await upsertChunks("marketing_expenses",     expenses);
      await upsertChunks("marketing_requests",     requests);
      await upsertChunks("rh_colaboradores",       colaboradores);

      setCounts({
        campaigns:     campaigns.length,
        deliverables:  deliverables.length,
        expenses:      expenses.length,
        requests:      requests.length,
        colaboradores: colaboradores.length,
      });
      return true;
    } catch (e) {
      setError(e.message || String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAllDemo = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDemo("marketing_campaigns");
      await deleteDemo("marketing_deliverables");
      await deleteDemo("marketing_expenses");
      await deleteDemo("marketing_requests");
      await deleteDemo("rh_colaboradores");
      setCounts(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { loadAllDemo, clearAllDemo, loading, error, counts };
}
