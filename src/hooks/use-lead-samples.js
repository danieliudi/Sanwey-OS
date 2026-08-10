import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";
import { toLocalISODate } from "../utils/date";

// Amostras físicas de produto enviadas ao cliente durante a negociação
// (Funil de Vendas — LeadDetailDrawer, bloco "🧪 Amostras enviadas"). Custo
// registrado por amostra pra depois cruzar com conversão do negócio (lead
// ganhou ou não). Mesmo padrão de fetch/realtime com debounce já usado em
// use-rh-signature-requests.js/use-crm-viagem-categorias.js (regra do
// CLAUDE.md — debounce de refetch em postgres_changes).
const TABLE = "lead_samples";

export function useLeadSamples(leadId) {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!leadId || !isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("lead_id", leadId)
        .order("sent_at", { ascending: false });
      if (err) throw err;
      setSamples(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!leadId || !isSupabaseConfigured) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`lead-samples-${leadId}-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `lead_id=eq.${leadId}` }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [leadId, fetchAll]);

  // `created_by` NÃO é enviado pelo cliente de propósito: a coluna tem
  // `DEFAULT auth.uid()` e a policy de INSERT exige `created_by = auth.uid()`
  // (ou admin), então mandar o valor daqui só abriria espaço pra registrar
  // amostra em nome de outra pessoa. `cost` também nunca vai negativo — o
  // banco tem `CHECK (cost >= 0)`; o clamp aqui é só pra dar um valor sensato
  // em vez de erro de constraint.
  const createSample = useCallback(async ({ notes, sentAt, cost }) => {
    if (!isSupabaseConfigured || !leadId) return null;
    const parsedCost = Number(cost);
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert({
        lead_id: leadId,
        notes: notes || null,
        // toLocalISODate, não `toISOString().slice(0,10)`: este último dá a
        // data UTC — depois das 21h (BRT) gravaria a data de amanhã. Mesmo
        // helper que o chamador já usa pro valor default do campo.
        sent_at: sentAt || toLocalISODate(new Date()),
        cost: Number.isFinite(parsedCost) ? Math.max(0, parsedCost) : 0,
      })
      .select()
      .single();
    if (err) { setError(err.message); return null; }
    setSamples(prev => [data, ...prev].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1)));
    return data;
  }, [leadId]);

  const deleteSample = useCallback(async (id) => {
    if (!isSupabaseConfigured) { setSamples(prev => prev.filter(s => s.id !== id)); return; }
    const prev = samples;
    setSamples(p => p.filter(s => s.id !== id));
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) { setError(err.message); setSamples(prev); }
  }, [samples]);

  const totalCost = samples.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);

  return { samples, loading, error, createSample, deleteSample, totalCost, refetch: fetchAll };
}

// Todas as amostras visíveis pro usuário atual (RLS já escopa por
// empresa/papel/responsável — mesmo predicado de `leads`), sem filtro de
// `lead_id`. Usado pelo agregado de CAC (src/utils/cac.js) — precisa somar
// custo de amostras do período inteiro, não de um lead só. Mesmo padrão de
// fetch/realtime com debounce de `useCRMDespesas` (regra do CLAUDE.md).
export function useAllLeadSamples({ enabled = true } = {}) {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from(TABLE).select("*").order("sent_at", { ascending: false });
      setSamples(data || []);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    fetchAll();
    if (!isSupabaseConfigured) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`lead-samples-all-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [fetchAll, enabled]);

  return { samples, loading, refetch: fetchAll };
}
