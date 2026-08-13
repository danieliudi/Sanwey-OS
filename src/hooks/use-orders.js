import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Central de Pedidos. O pedido nasce de dois jeitos: o cliente monta no portal
// (origem "portal") ou o time cria aqui, pelo que chegou por WhatsApp/e-mail —
// e é esse segundo caminho que faz a tela valer antes de o portal existir.
//
// O TOTAL não é enviado por aqui: quem soma é o trigger recalc_order_total no
// banco, a cada item inserido, alterado ou removido. Mandar o total da tela
// seria confiar num número que o navegador calculou.

export const SITUACOES = [
  // "Rascunho" é o carrinho aberto do cliente no portal — só existe do lado
  // dele. Fica FORA do quadro interno (decidido com o Daniel 12/08/2026):
  // carrinho abandonado é sinal de venda, não trabalho de conferência, e vira
  // aviso pro vendedor dono quando o portal entrar no ar.
  { id: "rascunho",   name: "Rascunho",    color: "#94A3B8", interno: false },
  // Onde o pedido do portal cai ao ser enviado: ninguém pegou ainda. Separado
  // de "Conferência", que é alguém já conferindo — a diferença entre fila e
  // trabalho em curso é o que faz o quadro ser útil de manhã.
  { id: "enviado",    name: "Enviado",     color: "#94A3B8" },
  { id: "conferencia",name: "Conferência", color: "#37536E" },
  { id: "confirmado", name: "Confirmado",  color: "#1A6E35" },
  { id: "producao",   name: "Em produção", color: "#B45309" },
  { id: "faturado",   name: "Faturado",    color: "#5B21B6" },
  { id: "cancelado",  name: "Cancelado",   color: "#6B7280" },
];

export const COLUNAS_INTERNAS = SITUACOES.filter(s => s.interno !== false);

export const ORIGENS = [
  { id: "portal",   label: "Portal" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email",    label: "E-mail" },
  { id: "telefone", label: "Telefone" },
  { id: "outro",    label: "Outro" },
];

const SELECT = `
  id, numero, company_id, client_id, contact_id, address_id, origem, situacao,
  ordem_compra_cliente, observacao, kronosys_numero, total,
  created_by, confirmed_by, confirmed_at, created_at, updated_at
`;

export function useOrders({ enabled = true } = {}) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setOrders([]); setLoading(false); return; }
    const { data, error: err } = await supabase
      .from("orders").select(SELECT).order("numero", { ascending: false });
    if (err) setError(err.message); else { setError(null); setOrders(data || []); }
    setLoading(false);
  }, [enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const refetch = debounce(fetchAll, 400);
    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createOrder = useCallback(async (payload, itens = []) => {
    const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;
    const { data, error: err } = await supabase
      .from("orders").insert({ ...payload, created_by: userId }).select(SELECT).single();
    if (err) throw new Error(err.message);
    if (itens.length > 0) {
      const { error: itErr } = await supabase.from("order_items").insert(
        itens.map(i => ({ order_id: data.id, product_id: i.productId, quantidade: i.quantidade, preco_unitario: i.preco })),
      );
      if (itErr) throw new Error(itErr.message);
    }
    await fetchAll();
    return data;
  }, [fetchAll]);

  const updateOrder = useCallback(async (id, patch) => {
    const { data, error: err } = await supabase
      .from("orders").update(patch).eq("id", id).select(SELECT).single();
    // A mensagem da trava do Kronosys já é escrita pra quem opera ler —
    // propaga como veio em vez de traduzir e perder o motivo.
    if (err) throw new Error(err.message);
    setOrders(prev => prev.map(o => (o.id === id ? data : o)));
    return data;
  }, []);

  const moveOrder = useCallback((id, situacao) => updateOrder(id, { situacao }), [updateOrder]);

  const stats = useMemo(() => {
    const emConferencia = orders.filter(o => o.situacao === "conferencia").length;
    const limite = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const parados = orders.filter(o =>
      ["conferencia", "confirmado", "producao"].includes(o.situacao) &&
      new Date(o.updated_at).getTime() < limite).length;
    return { emConferencia, parados, total: orders.length };
  }, [orders]);

  return { orders, loading, error, stats, createOrder, updateOrder, moveOrder, refetch: fetchAll };
}

// Itens de um pedido. Separado do hook do quadro porque só o drawer aberto
// precisa deles — carregar item de todos os pedidos pra montar o Kanban seria
// desperdício, e o card só mostra o total, que já vem na própria linha.
export function useOrderItems(orderId) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !orderId) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("order_items")
      .select("id, product_id, quantidade, preco_unitario")
      .eq("order_id", orderId);
    setItems(data || []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  return { items, loading, refetch: fetchAll };
}

export function useOrderHistory(orderId) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!isSupabaseConfigured || !orderId) { setHistory([]); return; }
    supabase.from("order_stage_history")
      .select("id, de, para, moved_by, moved_at")
      .eq("order_id", orderId).order("moved_at", { ascending: false })
      .then(({ data }) => setHistory(data || []));
  }, [orderId]);
  return history;
}

export default useOrders;
