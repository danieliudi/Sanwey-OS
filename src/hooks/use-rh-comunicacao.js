import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Comunicação interna (Onda 4, item 11): comunicados (broadcast via
// notifications) + pesquisas anônimas (definição em rh_pesquisas; respostas
// só lidas via RPC de agregação, nunca com identidade).
export function useRHComunicacao({ userId } = {}) {
  const [pesquisas, setPesquisas] = useState([]);
  const [comunicados, setComunicados] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: pesq }, { data: coms }] = await Promise.all([
        supabase.from("rh_pesquisas").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_comunicados").select("*").order("enviado_em", { ascending: false }).limit(200),
      ]);
      if (!isActive()) return;
      setPesquisas(pesq || []);
      // RLS decide: quem não é gestão de RH/diretoria recebe [] sem erro.
      setComunicados(coms || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(`rh-pesquisas-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_pesquisas" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_comunicados" }, debouncedFetchAll)
      .subscribe();
    return () => { active = false; debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Prévia de alcance ANTES de enviar. Só contagens — a lista de e-mails não
  // sai do banco (comunicado_destinatarios não é chamável pelo client).
  const carregarAlcance = useCallback(async (scopeType = "todos", scopeValue = null) => {
    const { data, error } = await supabase.rpc("comunicado_alcance", {
      p_scope_type: scopeType, p_scope_value: scopeType === "todos" ? null : scopeValue,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      total: Number(row?.total || 0),
      comNotificacao: Number(row?.com_notificacao || 0),
      comEmail: Number(row?.com_email || 0),
      semEmail: Number(row?.sem_email || 0),
    };
  }, []);

  // Comunicado. A RPC grava o registro em `rh_comunicados` e devolve o alcance
  // MEDIDO no envio; o e-mail é um segundo passo, feito pela edge function a
  // partir do id — o client nunca monta a lista de destinatários.
  //
  // `importante` ignora o opt-out de notificações
  // (mention_notifications_enabled), que vale só pro canal plataforma: quem
  // desligou o sino continua recebendo o e-mail, que é o motivo do 2º canal.
  //
  // O e-mail NÃO derruba o envio: a notificação na plataforma já foi gravada e
  // não dá pra desfazer. Falha de e-mail volta como `emailErro` pra tela dizer
  // o que saiu e o que não saiu, em vez de um erro genérico que faria o RH
  // reenviar tudo e duplicar a notificação.
  const enviarComunicado = useCallback(async ({ title, body, scopeType = "todos", scopeValue = null, importante = false, canais = ["plataforma"] }) => {
    const { data, error } = await supabase.rpc("broadcast_announcement", {
      p_title: title, p_body: body || null, p_scope_type: scopeType, p_scope_value: scopeValue,
      p_link: null, p_importante: importante, p_canais: canais,
    });
    if (error) throw new Error(error.message);

    const res = {
      comunicadoId: data?.comunicado_id || null,
      alcancePlataforma: Number(data?.alcance_plataforma || 0),
      alcanceEmail: Number(data?.alcance_email || 0),
      semEmail: Number(data?.sem_email || 0),
      emailEnviado: 0,
      emailErro: null,
    };

    if (canais.includes("email") && res.comunicadoId) {
      try {
        const { data: envio, error: emailErr } = await supabase.functions.invoke("rh-send-email", {
          body: { type: "comunicado", comunicadoId: res.comunicadoId },
        });
        if (emailErr) throw emailErr;
        res.emailEnviado = Number(envio?.sent || 0);
      } catch (e) {
        res.emailErro = e?.message || "Falha ao enviar por e-mail.";
      }
    }

    await fetchAll();
    return res;
  }, [fetchAll]);

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
    const { data, error } = await supabase.from("rh_pesquisas").update({ status }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    // NÃO lança: src/components/views/RHComunicacaoView.jsx:498 chama sem await
    // e sem catch, então um throw viraria rejeição sem dono, sem avisar
    // ninguém. Refaz o fetch — a tela volta pro estado real do banco em
    // vez de exibir uma mudança que não foi gravada (mesmo desenho do
    // reorder em use-pipelines.js).
    if (!data || data.length === 0) { await fetchAll(); return; }
    setPesquisas(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  }, [fetchAll]);

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
    // `liberado` false = pesquisa anônima que ainda não bateu o mínimo de
    // respondentes. O banco devolve a contagem e NENHUMA resposta — o piso
    // vive lá, não aqui, porque a função é chamável direto por quem tem token.
    return {
      total: Number(row?.total || 0),
      respostas: Array.isArray(row?.respostas) ? row.respostas : [],
      minimo: Number(row?.minimo || 0),
      liberado: row?.liberado !== false,
    };
  }, []);

  return useMemo(() => ({
    pesquisas, comunicados, loading,
    enviarComunicado, carregarAlcance, criarPesquisa, setPesquisaStatus, deletarPesquisa, carregarRespostas, enviarPesquisaNotificacao,
    refetch: fetchAll,
  }), [pesquisas, comunicados, loading, enviarComunicado, carregarAlcance, criarPesquisa, setPesquisaStatus, deletarPesquisa, carregarRespostas, enviarPesquisaNotificacao, fetchAll]);
}
