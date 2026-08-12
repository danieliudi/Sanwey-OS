import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Catálogo de produtos (Comercial → Catálogo). O preço de tabela vive aqui e
// pertence ao SUPORTE comercial; o preço que o cliente paga é outro campo, em
// outra tabela (client_products.price), e pertence ao VENDEDOR dono da conta.
// Ver migration 20260921_papel_suporte_comercial.sql.
//
// Quem pode gravar é decidido pelo RLS (admin, gerente ou suporte, dentro das
// empresas da pessoa) — o hook não tenta adivinhar isso, só propaga o erro
// quando o banco recusa.

const SELECT = [
  // comercial (suporte)
  "id, company_id, sku, name, unit, moq, preco_tabela, certifications, homologado, active",
  // vitrine (marketing)
  "description, tagline, features, specs, applications, category, icon, proposed",
  "created_at, updated_at",
].join(", ");

export function useProducts({ companyId = null, enabled = true } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setProducts([]); setLoading(false); return; }
    setLoading(true);
    let query = supabase.from("products").select(SELECT).order("sku");
    if (companyId) query = query.eq("company_id", companyId);
    const { data, error: err } = await query;
    if (err) setError(err.message); else { setError(null); setProducts(data || []); }
    setLoading(false);
  }, [companyId, enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime com debounce — mesmo padrão de todo hook que assina
  // postgres_changes nesta plataforma (regra 1 do CLAUDE.md).
  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const refetch = debounce(fetchAll, 400);
    const channel = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createProduct = useCallback(async (payload) => {
    const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;
    const { data, error: err } = await supabase
      .from("products")
      .insert({ ...payload, created_by: userId })
      .select(SELECT)
      .single();
    if (err) throw new Error(err.message);
    setProducts(prev => [...prev, data].sort((a, b) => a.sku.localeCompare(b.sku)));
    return data;
  }, []);

  const updateProduct = useCallback(async (id, patch) => {
    const { data, error: err } = await supabase
      .from("products").update(patch).eq("id", id).select(SELECT).single();
    if (err) throw new Error(err.message);
    setProducts(prev => prev.map(p => (p.id === id ? data : p)));
    return data;
  }, []);

  // Produto não se apaga: some do catálogo desativando. Pode já ter entrado em
  // pedido antigo (order_items referencia products com ON DELETE RESTRICT), e
  // apagar reescreveria o histórico de quem comprou.
  const deactivateProduct = useCallback((id) => updateProduct(id, { active: false }), [updateProduct]);

  const stats = useMemo(() => ({
    total: products.length,
    ativos: products.filter(p => p.active).length,
    semTabela: products.filter(p => p.active && p.preco_tabela == null).length,
  }), [products]);

  return { products, loading, error, stats, createProduct, updateProduct, deactivateProduct, refetch: fetchAll };
}

export default useProducts;
