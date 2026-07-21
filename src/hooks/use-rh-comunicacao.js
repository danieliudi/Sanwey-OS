import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Comunicação interna (Onda 4, item 11): comunicados (broadcast via
// notifications) + pesquisas anônimas (definição em rh_pesquisas; respostas
// só lidas via RPC de agregação, nunca com identidade).
export function useRHComunicacao({ userId } = {}) {
  const [pesquisas, setPesquisas] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("rh_pesquisas").select("*").order("created_at", { ascending: false });
      if (!activeRef.current) return;
      setPesquisas(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`rh-pesquisas-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_pesquisas" }, debouncedFetchAll)
      .subscribe();
    return () => { activeRef.current = false; debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Comunicado: retorna quantos destinatários receberam. `importante` ignora
  // o opt-out de notificações (mention_notifications_enabled) — só alcança
  // quem tem login na plataforma.
  const enviarComunicado = useCallback(async ({ title, body, scopeType = "todos", scopeValue = null, importante = false }) => {
    const { data, error } = await supabase.rpc("broadcast_announcement", {
      p_title: title, p_body: body || null, p_scope_type: scopeType, p_scope_value: scopeValue, p_link: null, p_importante: importante,
    });
    if (error) throw new Error(error.message);
    return data ?? 0;
  }, []);

  const criarPesquisa = useCallback(async (data) => {
    const row = {
      titulo: data.titulo,
      descricao: data.descricao || null,
      perguntas: data.perguntas || [],
      abre_em: data.abreEm || null,
      fecha_em: data.fechaEm || null,
      modo: data.modo || "anonima",
      scope_type: data.scopeType || "todos",
      scope_value: data.scopeType && data.scopeType !== "todos" ? data.scopeValue : null,
      created_by: userId,
    };
    const { data: nova, error } = await supabase.from("rh_pesquisas").insert(row).select().single();
    if (error) throw new Error(error.message);
    setPesquisas(prev => [nova, ...prev]);
    return nova;
  }, [userId]);

  // Notifica os colaboradores do escopo — só faz sentido pra pesquisas
  // "identificada" (a RPC recusa pra "anonima").
  const enviarPesquisaNotificacao = useCallback(async (pesquisaId) => {
    const { data, error } = await supabase.rpc("enviar_pesquisa_notificacao", { p_pesquisa_id: pesquisaId });
    if (error) throw new Error(error.message);
    return data ?? 0;
  }, []);

  const setPesquisaStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from("rh_pesquisas").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    setPesquisas(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  }, []);

  const deletarPesquisa = useCallback(async (id) => {
    const { error } = await supabase.from("rh_pesquisas").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setPesquisas(prev => prev.filter(p => p.id !== id));
  }, []);

  // Só o agregado (total + array de respostas sem identidade).
  const carregarRespostas = useCallback(async (pesquisaId) => {
    const { data, error } = await supabase.rpc("pesquisa_respostas_aggregado", { p_pesquisa_id: pesquisaId });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return { total: Number(row?.total || 0), respostas: Array.isArray(row?.respostas) ? row.respostas : [] };
  }, []);

  return useMemo(() => ({
    pesquisas, loading,
    enviarComunicado, criarPesquisa, setPesquisaStatus, deletarPesquisa, carregarRespostas, enviarPesquisaNotificacao,
    refetch: fetchAll,
  }), [pesquisas, loading, enviarComunicado, criarPesquisa, setPesquisaStatus, deletarPesquisa, carregarRespostas, enviarPesquisaNotificacao, fetchAll]);
}
