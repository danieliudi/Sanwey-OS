import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Substitui src/data/generate-signals.js (dado 100% fabricado, nunca
// atualizado). Sinais reais nascem via aprovação de rascunho na fila
// "Agentes de IA" (agent_actions -> market_signals, ver agent-gateway) —
// esta tabela só contém o que já foi aprovado por alguém.
function rowToSignal(r) {
  return {
    id: r.id,
    company: r.company_id,
    source: r.source,
    title: r.title,
    excerpt: r.excerpt,
    url: r.url,
    urgency: r.urgency,
    date: r.detected_at ? new Date(r.detected_at).toLocaleDateString("pt-BR") : "",
    detectedAt: r.detected_at,
  };
}

export function useMarketSignals() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  // Falha de leitura é estado próprio, não lista vazia. RLS recusando SELECT
  // volta `error: null, data: []` — e o `catch` daqui transformava qualquer
  // outra falha em zero sinais, que a tela anunciava como "nada encontrado".
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("market_signals")
        .select("*")
        .order("detected_at", { ascending: false });
      if (err) throw err;
      setSignals((data || []).map(rowToSignal));
    } catch (e) {
      // A lista anterior FICA. Zerar o que já estava na tela por causa de uma
      // falha de rede troca informação boa por nenhuma.
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(`market_signals_rt_${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_signals" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return { signals, loading, error, refetch: fetchAll };
}
