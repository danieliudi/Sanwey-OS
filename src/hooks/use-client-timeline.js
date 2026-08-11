import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// FASE 3 — linha do tempo unificada do cliente, atravessando TODOS os negócios
// dele. Mesma forma de use-client-connections.js (vizinho mais próximo): uma
// RPC própria, fetch/loading/error/refetch, sem estado global.
//
// Sem Realtime de propósito: isto é histórico, não fila de trabalho — nada aqui
// muda enquanto o drawer está aberto sem que a própria sessão tenha causado a
// mudança (e nesse caso o chamador já tem `refetch`). Assinar postgres_changes
// custaria 8 canais (leads, lead_stage_history, crm_viagem_registros,
// lead_samples, lead_attachments, posvenda_cases, client_billing_history) pra
// um painel de leitura. Se um dia isso virar tela sempre aberta, reavaliar.
//
// Cada item devolvido pela RPC:
//   { kind, category, ts, title, detail, actor_id, actor_name,
//     lead_id, lead_name, meta }
//   kind      'comentario' | 'nota' | 'etapa' | 'follow_up' | 'visita'
//             | 'amostra' | 'anexo' | 'posvenda' | 'faturamento'
//   category  'interacao' (interação com o cliente) | 'interno' (pano de fundo)
//   ts        ISO string, já ordenado do mais recente pro mais antigo
//   actor_name pode ser null (nota legada de leads.notes não tem autor —
//             nunca inventar um; a UI mostra "autor não registrado")
//   meta      jsonb por tipo: valores numéricos crus (meta.cost,
//             meta.total_value, meta.value) — formatar com formatBRL/formatK
//             na UI, nunca concatenar "R$ "; datas cruas (meta.sent_at,
//             meta.data_realizada) — usar parseDateInput/formatDateBR.
export function useClientTimeline(clientId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !clientId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("get_client_timeline", { p_client_id: clientId });
      if (err) throw err;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Taxonomia aprovada: interação e evento interno nunca dividem a mesma
  // hierarquia visual — o split já vem pronto pra quem monta a tela.
  const interacoes = useMemo(() => items.filter(i => i.category === "interacao"), [items]);
  const internos = useMemo(() => items.filter(i => i.category === "interno"), [items]);

  return { items, interacoes, internos, loading, error, refetch: fetchAll };
}
