import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Bem-estar (redesenhado — reunião com o RH, 20/07): sessões com janela de
// horários (horario_inicio/horario_fim/slot_minutos) + reservas por horário
// marcado (agenda de restaurante), no lugar da antiga fila FIFO "chamar o
// próximo". RH lê a fila inteira (com nomes/contato); a reserva em si é
// sempre pela RPC pública anônima (submit_bemestar_agendamento).
export function useRHBemEstar({ userId, enabled = true } = {}) {
  const [sessoes, setSessoes] = useState([]);
  const [fila, setFila] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: sData }, { data: fData }] = await Promise.all([
        supabase.from("rh_bemestar_sessoes").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_bemestar_fila").select("*").order("horario", { ascending: true }),
      ]);
      if (!isActive()) return;
      setSessoes(sData || []);
      setFila(fData || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured || !enabled) return;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(`rh-bemestar-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_bemestar_sessoes" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_bemestar_fila" }, debouncedFetchAll)
      .subscribe();
    return () => { active = false; debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const criarSessao = useCallback(async (data) => {
    const row = {
      titulo: data.titulo,
      descricao: data.descricao || null,
      data: data.data || null,
      horario_inicio: data.horarioInicio || null,
      horario_fim: data.horarioFim || null,
      slot_minutos: data.slotMinutos || 30,
      created_by: userId,
    };
    const { data: nova, error } = await supabase.from("rh_bemestar_sessoes").insert(row).select().single();
    if (error) throw new Error(error.message);
    setSessoes(prev => [nova, ...prev]);
    return nova;
  }, [userId]);

  // Edita a janela de horário de uma sessão já criada — cobre tanto sessões
  // novas (ajustar depois de errar) quanto as antigas do modelo de fila FIFO
  // (horario_inicio/fim nulos pra sempre, migradas via backfill mas sem UI
  // pra corrigir manualmente até este ponto).
  const atualizarSessao = useCallback(async (id, data) => {
    const patch = {
      titulo: data.titulo,
      descricao: data.descricao || null,
      horario_inicio: data.horarioInicio || null,
      horario_fim: data.horarioFim || null,
      slot_minutos: data.slotMinutos || 30,
    };
    // `salvo` em vez de `data`: o parâmetro desta função já se chama `data`.
    const { data: salvo, error } = await supabase.from("rh_bemestar_sessoes").update(patch).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!salvo || salvo.length === 0) throw new Error("Não foi possível salvar a sessão — verifique suas permissões.");
    setSessoes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const setSessaoStatus = useCallback(async (id, status) => {
    const { data, error } = await supabase.from("rh_bemestar_sessoes").update({ status }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível alterar o status da sessão — verifique suas permissões.");
    setSessoes(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const deletarSessao = useCallback(async (id) => {
    const { error } = await supabase.from("rh_bemestar_sessoes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setSessoes(prev => prev.filter(s => s.id !== id));
  }, []);

  const setFilaStatus = useCallback(async (id, status) => {
    const { data, error } = await supabase.from("rh_bemestar_fila").update({ status }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível alterar o status do agendamento — verifique suas permissões.");
    setFila(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  }, []);

  // Marca que o lembrete de proximidade (App.jsx) já foi enviado — evita
  // reenviar a cada re-render/poll do efeito.
  //
  // Fica DE PROPÓSITO sem `.select()` + checagem de vazio (o padrão de
  // use-clients.js pra escrita do usuário): isto é fire-and-forget de
  // telemetria, e o único chamador (App.jsx:770) já engole com
  // `.catch(() => {})` porque roda dentro de um efeito de lembrete. Uma
  // checagem a mais aqui não chegaria em ninguém; no pior caso o lembrete é
  // reenviado, que é bem menos grave que um erro na tela do RH.
  const marcarLembreteEnviado = useCallback(async (id) => {
    const { error } = await supabase.from("rh_bemestar_fila").update({ lembrete_enviado: true }).eq("id", id);
    if (error) throw new Error(error.message);
    setFila(prev => prev.map(f => f.id === id ? { ...f, lembrete_enviado: true } : f));
  }, []);

  return useMemo(() => ({
    sessoes, fila, loading,
    criarSessao, atualizarSessao, setSessaoStatus, deletarSessao, setFilaStatus, marcarLembreteEnviado,
    refetch: fetchAll,
  }), [sessoes, fila, loading, criarSessao, atualizarSessao, setSessaoStatus, deletarSessao, setFilaStatus, marcarLembreteEnviado, fetchAll]);
}
