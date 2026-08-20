import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Conteúdo de mercado/setor da aba "Mercado" do hub de Inteligência (menu
// Inteligência → Mercado/Insights/Cruzamento, decidido com o Daniel
// 19-20/08/2026). Escrita só via service_role (workflow n8n "Scout de
// Mercado" → agent-gateway → aprovação humana → publica aqui) — este hook
// só lê. RLS já filtra por role/empresa (ver migration
// market_intelligence_items), então o SELECT aqui não precisa filtrar de
// novo por conta própria.
const TABLE = "market_intelligence_items";

export function useMarketIntelligence({ enabled = true } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("detected_at", { ascending: false });
      if (err) throw err;
      setItems(data || []);
    } catch (e) {
      setError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    fetchAll();
    if (!isSupabaseConfigured) return;
    // Debounce de refetch em postgres_changes (regra do CLAUDE.md) — o
    // workflow n8n pode publicar vários itens em sequência numa única
    // rodada do Scout, sem isso cada INSERT dispararia um refetch redundante.
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`market-intelligence-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [fetchAll, enabled]);

  return { items, loading, error, refetch: fetchAll };
}
