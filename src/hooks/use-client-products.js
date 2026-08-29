import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Produtos liberados para um cliente, com o preço negociado dele.
//
// Este é o preço que o cliente PAGA, e é o único que entra em pedido. Não
// confundir com products.preco_tabela, que é a base de cálculo mantida pelo
// suporte. Liberar sem preço não existe — `price` é NOT NULL no banco: sem
// negociação, não há liberação (ver 20260918_pedidos_catalogo_portal_b2b.sql).
//
// Pausar (`active = false`) preserva o preço negociado: o produto some do
// portal do cliente, mas retomar é um clique e não uma nova negociação.

export function useClientProducts(clientId) {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !clientId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("client_products")
      .select("client_id, product_id, price, active, updated_at")
      .eq("client_id", clientId);
    if (!error) setRows(data || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const release = useCallback(async (productId, price) => {
    const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;
    const { error } = await supabase.from("client_products").upsert(
      { client_id: clientId, product_id: productId, price, active: true, updated_by: userId },
      { onConflict: "client_id,product_id" },
    );
    // O erro aqui costuma ser a trava de margem da gerência (trigger
    // enforce_margin_rule) — a mensagem dele já é escrita pra quem vende ler,
    // então propaga como veio em vez de traduzir e perder o número.
    if (error) throw new Error(error.message);
    await fetchAll();
  }, [clientId, fetchAll]);

  // Mesmo desenho do setActive de use-client-contacts.js: sem throw em
  // linha-zero porque ClientProductsTab.jsx:282 chama sem await e sem catch.
  // O `fetchAll()` abaixo recarrega a verdade do banco, então uma recusa da
  // RLS faz o botão voltar sozinho em vez de exibir troca não gravada. O
  // `.select()` fica pra o UPDATE devolver linha em vez de mascarar a recusa.
  const setActive = useCallback(async (productId, active) => {
    const { error } = await supabase
      .from("client_products").update({ active })
      .eq("client_id", clientId).eq("product_id", productId)
      .select();
    if (error) throw new Error(error.message);
    await fetchAll();
  }, [clientId, fetchAll]);

  return { rows, loading, release, setActive, refetch: fetchAll };
}

// Conta a margem no BANCO, não aqui. A mesma função que a trava usa
// (margin_check) — se a fórmula mudar, muda num lugar só. Tela e banco
// calculando cada um por si é como o vendedor vê "ok" e leva erro ao salvar.
export async function checkMargin(companyId, productId, price) {
  if (!isSupabaseConfigured || !productId || price === "" || price == null) return null;
  const { data, error } = await supabase.rpc("margin_check", {
    p_company_id: companyId,
    p_product_id: productId,
    p_price: Number(price),
  });
  if (error) return null;
  return Array.isArray(data) ? data[0] : data;
}

export default useClientProducts;
