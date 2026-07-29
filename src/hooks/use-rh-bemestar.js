import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: sData }, { data: fData }] = await Promise.all([
        supabase.from("rh_bemestar_sessoes").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_bemestar_fila").select("*").order("horario", { ascending: true }),
      ]);
      if (!activeRef.current) return;
      setSessoes(sData || []);
      setFila(fData || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured || !enabled) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`rh-bemestar-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_bemestar_sessoes" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_bemestar_fila" }, debouncedFetchAll)
      .subscribe();
    return () => { activeRef.current = false; debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
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
    const { error } = await supabase.from("rh_bemestar_sessoes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setSessoes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const setSessaoStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from("rh_bemestar_sessoes").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    setSessoes(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const deletarSessao = useCallback(async (id) => {
    const { error } = await supabase.from("rh_bemestar_sessoes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setSessoes(prev => prev.filter(s => s.id !== id));
  }, []);

  const setFilaStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from("rh_bemestar_fila").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    setFila(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  }, []);

  // Marca que o lembrete de proximidade (App.jsx) já foi enviado — evita
  // reenviar a cada re-render/poll do efeito.
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
