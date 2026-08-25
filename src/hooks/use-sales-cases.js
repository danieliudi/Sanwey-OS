import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Casos de prospecção comercial (ganhamos/perdemos/andamento) — munição pro
// playbook de vendas. RLS já filtra por role/frente (ver migration
// sales_cases), então o SELECT aqui não filtra de novo por conta própria.
//
// Escrita: só addCase, chamado direto pela tela de conferência com a sessão
// do próprio vendedor (RLS decide o que ele pode gravar) — nunca pela edge
// function caso-prospeccao-voz, que só devolve o rascunho. Mesmo princípio
// do crm-ata-voz.
const TABLE = "sales_cases";

export function useSalesCases({ enabled = true } = {}) {
  const [cases, setCases] = useState([]);
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
        .order("created_at", { ascending: false });
      if (err) throw err;
      setCases(data || []);
    } catch (e) {
      setError(e);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    fetchAll();
    if (!isSupabaseConfigured) return;
    // Debounce de refetch em postgres_changes (regra do CLAUDE.md).
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`sales-cases-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [fetchAll, enabled]);

  const addCase = useCallback(async (row) => {
    const { data, error: err } = await supabase.from(TABLE).insert(row).select().single();
    if (err) { setError(err); throw err; }
    setCases(prev => (prev.some(c => c.id === data.id) ? prev : [data, ...prev]));
    return data;
  }, []);

  return { cases, loading, error, refetch: fetchAll, addCase };
}

export default useSalesCases;
