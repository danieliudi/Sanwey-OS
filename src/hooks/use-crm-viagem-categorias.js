import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

export function useCRMViagemCategorias({ userId } = {}) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading]       = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("crm_viagem_categorias").select("*").eq("ativo", true).order("nome", { ascending: true });
      if (!isActive()) return;
      setCategorias(data || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const channelName = `crm-viagem-categorias-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_viagem_categorias" }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createCategoria = useCallback(async (nome) => {
    const { data: nova, error } = await supabase.from("crm_viagem_categorias").insert({ nome, created_by: userId }).select().single();
    if (error) throw new Error(error.message);
    setCategorias(prev => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
    return nova;
  }, [userId]);

  const desativarCategoria = useCallback(async (id) => {
    const { data, error } = await supabase.from("crm_viagem_categorias").update({ ativo: false }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou. Sem isso a categoria sumia da lista na tela
    // (o filter abaixo) e voltava no próximo refetch, sem explicação.
    if (!data || data.length === 0) throw new Error("Não foi possível desativar a categoria — verifique suas permissões.");
    setCategorias(prev => prev.filter(c => c.id !== id));
  }, []);

  // Referência de gasto por contexto (14/09/2026). `null` limpa a referência,
  // e categoria sem referência não gera alerta nenhum — é assim que Pedágio
  // convive com Almoço na mesma lista sem inventar um teto que não existe.
  //
  // Mesma checagem de zero linha do desativarCategoria acima: a RLS negando
  // UPDATE devolve `error: null, data: []`, e sem isto o valor sumiria da
  // tela e voltaria no próximo refetch sem explicação nenhuma.
  const atualizarReferencias = useCallback(async (id, { capital, interior }) => {
    const limpar = (v) => {
      if (v === "" || v == null) return null;
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const patch = { referencia_capital: limpar(capital), referencia_interior: limpar(interior) };
    const { data, error } = await supabase
      .from("crm_viagem_categorias").update(patch).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("Não foi possível salvar a referência — verifique suas permissões.");
    }
    setCategorias(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  return { categorias, loading, createCategoria, desativarCategoria, atualizarReferencias, refetch: fetchAll };
}
