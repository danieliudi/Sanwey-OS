import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Programas (o módulo que a tela chama de "Programas" desde 11/09/2026 e que
// o banco continua chamando de bemestar — ver a nota de contrato na migration
// 20260911220000: a rota pública `/bem-estar/:id` já está impressa em QR e o
// id de seção `rh-bem-estar` já está gravado nas permissões de cada usuário).
//
// Um programa (`rh_bemestar_sessoes`) tem N datas (`rh_bemestar_datas`), e é
// a DATA que carrega a janela de horários, a duração do slot e quantas vagas
// cabem por horário. As reservas (`rh_bemestar_fila`) apontam pra data.
// RH lê a fila inteira (com nomes/contato); a reserva em si é sempre pela RPC
// pública anônima (submit_bemestar_agendamento).
export function useRHBemEstar({ userId, enabled = true } = {}) {
  const [sessoes, setSessoes] = useState([]);
  const [datas, setDatas] = useState([]);
  const [fila, setFila] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: sData }, { data: dData }, { data: fData }] = await Promise.all([
        supabase.from("rh_bemestar_sessoes").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_bemestar_datas").select("*").order("data", { ascending: true }),
        supabase.from("rh_bemestar_fila").select("*").order("horario", { ascending: true }),
      ]);
      if (!isActive()) return;
      setSessoes(sData || []);
      setDatas(dData || []);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_bemestar_datas" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_bemestar_fila" }, debouncedFetchAll)
      .subscribe();
    return () => { active = false; debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  // As colunas `data`/`horario_inicio`/`horario_fim`/`slot_minutos` de
  // `rh_bemestar_sessoes` ficaram no schema mas NÃO são mais escritas nem
  // lidas — quem manda agora é `rh_bemestar_datas`. Ficam onde estão porque
  // ainda guardam o histórico dos programas de data única criados antes de
  // 11/09/2026, e apagá-las perderia esse registro sem devolver nada.
  const criarPrograma = useCallback(async ({ titulo, descricao, datas: novasDatas = [] }) => {
    const { data: nova, error } = await supabase
      .from("rh_bemestar_sessoes")
      .insert({ titulo, descricao: descricao || null, created_by: userId })
      .select().single();
    if (error) throw new Error(error.message);

    if (novasDatas.length) {
      const { error: dErr } = await supabase.from("rh_bemestar_datas").insert(
        novasDatas.map((d) => ({
          sessao_id: nova.id,
          data: d.data,
          horario_inicio: d.horarioInicio,
          horario_fim: d.horarioFim,
          slot_minutos: Number(d.slotMinutos) || 30,
          vagas_por_horario: Number(d.vagasPorHorario) || 1,
        })),
      );
      // O programa sem data nenhuma não serve pra nada — desfaz em vez de
      // deixar um programa órfão na tela pra alguém descobrir depois que o
      // link não oferece horário.
      if (dErr) {
        // O desfazer também precisa provar que apagou: DELETE barrado pela RLS
        // volta como sucesso silencioso, e o programa órfão ficaria na tela
        // sem ninguém saber por quê.
        const { data: apagado } = await supabase
          .from("rh_bemestar_sessoes").delete().eq("id", nova.id).select("id");
        if (!apagado || apagado.length === 0) {
          await fetchAll();
          throw new Error(`${dErr.message} — o programa foi criado sem datas; edite ou exclua pela lista.`);
        }
        throw new Error(dErr.message);
      }
    }
    await fetchAll();
    return nova;
  }, [userId, fetchAll]);

  const atualizarPrograma = useCallback(async (id, { titulo, descricao }) => {
    const patch = { titulo, descricao: descricao || null };
    const { data: salvo, error } = await supabase.from("rh_bemestar_sessoes").update(patch).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!salvo || salvo.length === 0) throw new Error("Não foi possível salvar o programa — verifique suas permissões.");
    setSessoes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const adicionarDatas = useCallback(async (sessaoId, novasDatas) => {
    if (!novasDatas?.length) return;
    const { error } = await supabase.from("rh_bemestar_datas").insert(
      novasDatas.map((d) => ({
        sessao_id: sessaoId,
        data: d.data,
        horario_inicio: d.horarioInicio,
        horario_fim: d.horarioFim,
        slot_minutos: Number(d.slotMinutos) || 30,
        vagas_por_horario: Number(d.vagasPorHorario) || 1,
      })),
    );
    if (error) throw new Error(error.message);
    await fetchAll();
  }, [fetchAll]);

  const atualizarData = useCallback(async (id, d) => {
    const patch = {
      data: d.data,
      horario_inicio: d.horarioInicio,
      horario_fim: d.horarioFim,
      slot_minutos: Number(d.slotMinutos) || 30,
      vagas_por_horario: Number(d.vagasPorHorario) || 1,
      ...(d.status ? { status: d.status } : {}),
    };
    const { data: salvo, error } = await supabase.from("rh_bemestar_datas").update(patch).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!salvo || salvo.length === 0) throw new Error("Não foi possível salvar a data — verifique suas permissões.");
    setDatas(prev => prev.map(x => x.id === id ? salvo[0] : x));
  }, []);

  const deletarData = useCallback(async (id) => {
    const { data, error } = await supabase.from("rh_bemestar_datas").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível excluir a data — verifique suas permissões.");
    setDatas(prev => prev.filter(x => x.id !== id));
    setFila(prev => prev.filter(f => f.data_id !== id));
  }, []);

  const setSessaoStatus = useCallback(async (id, status) => {
    const { data, error } = await supabase.from("rh_bemestar_sessoes").update({ status }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Não lança em linha-zero: o chamador é onClick bare (sem await/catch),
    // então um throw viraria rejeição sem dono. O refetch devolve a tela pro
    // estado real do banco.
    if (!data || data.length === 0) { await fetchAll(); return; }
    setSessoes(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, [fetchAll]);

  const deletarSessao = useCallback(async (id) => {
    const { data, error } = await supabase.from("rh_bemestar_sessoes").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    // Não lança em linha-zero: o chamador é onClick bare. O refetch devolve a
    // tela pro estado real, e o programa reaparece — que é a resposta honesta
    // pra "a RLS barrou", em vez de sumir da tela e voltar no próximo F5.
    if (!data || data.length === 0) { await fetchAll(); return; }
    setSessoes(prev => prev.filter(s => s.id !== id));
    setDatas(prev => prev.filter(d => d.sessao_id !== id));
  }, [fetchAll]);

  // Promover alguém da espera pode esbarrar no teto de vagas do horário —
  // o banco tem um gatilho que barra isso (migration 20260911220000). Por
  // isso devolve {ok, motivo} em vez de lançar: o chamador é um clique de
  // lista, e a mensagem do gatilho é escrita pra ser mostrada.
  const promoverDaEspera = useCallback(async (id) => {
    const { data, error } = await supabase
      .from("rh_bemestar_fila").update({ status: "na_fila" }).eq("id", id).select();
    if (error) return { ok: false, motivo: error.message };
    if (!data || data.length === 0) return { ok: false, motivo: "Sem permissão para promover esta pessoa." };
    setFila(prev => prev.map(f => f.id === id ? data[0] : f));
    return { ok: true, reserva: data[0] };
  }, []);

  const setFilaStatus = useCallback(async (id, status) => {
    const { data, error } = await supabase.from("rh_bemestar_fila").update({ status }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Não lança em linha-zero: RHBemEstarView.jsx:147,148 é onClick bare
    // (sem await/catch), então um throw viraria rejeição sem dono. O
    // refetch devolve a tela pro estado real do banco.
    if (!data || data.length === 0) { await fetchAll(); return; }
    setFila(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  }, [fetchAll]);

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
    sessoes, datas, fila, loading,
    criarPrograma, atualizarPrograma, adicionarDatas, atualizarData, deletarData,
    setSessaoStatus, deletarSessao, setFilaStatus, promoverDaEspera, marcarLembreteEnviado,
    refetch: fetchAll,
  }), [sessoes, datas, fila, loading, criarPrograma, atualizarPrograma, adicionarDatas, atualizarData, deletarData, setSessaoStatus, deletarSessao, setFilaStatus, promoverDaEspera, marcarLembreteEnviado, fetchAll]);
}
