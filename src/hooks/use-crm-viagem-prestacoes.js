import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Prestação de contas — agrupa despesas pendentes num lote só pra decisão em
// lote do gestor (spec aprovada 10/08/2026). O motor de decisão em si (fila
// pendente → aprovado/rejeitado/pago) continua em use-crm-despesas.js, sem
// duplicação: aqui só existe o que é específico da prestação (criar
// rascunho, enviar, decidir lote, marcar paga). Os triggers no banco
// (crm_viagem_despesas_validate_prestacao / crm_viagem_prestacoes_recompute_status)
// cuidam da integridade e do recômputo de status — este hook não reimplementa
// essa lógica em JS, só chama o Supabase e deixa os triggers agirem.
export function useCRMViagemPrestacoes({ userId, enabled = true } = {}) {
  const [prestacoes, setPrestacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("crm_viagem_prestacoes").select("*").order("created_at", { ascending: false });
      if (!isActive()) return;
      setPrestacoes(data || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled) { setLoading(false); return; }
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const channelName = `crm-viagem-prestacoes-${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_viagem_prestacoes" }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll, enabled]);

  const updatePrestacao = useCallback(async (id, patch) => {
    const { error } = await supabase.from("crm_viagem_prestacoes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setPrestacoes(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  // Cria a prestação (sempre nasce "rascunho", único status que a RLS
  // aceita no insert do próprio vendedor), vincula as despesas selecionadas
  // — só funciona enquanto a prestação está em rascunho, ver trigger — e,
  // se `enviar` for true, sobe direto pra "enviada" num segundo passo.
  // `registroId` fica setado só quando toda a seleção pertence à mesma
  // visita (sub-prestação por viagem, decisão 2 da spec); nulo = prestação
  // geral do mês.
  const criarPrestacao = useCallback(async ({ titulo, mesReferencia, registroId, despesaIds, enviar }) => {
    if (!despesaIds?.length) throw new Error("Selecione ao menos uma despesa.");
    const { data: nova, error } = await supabase
      .from("crm_viagem_prestacoes")
      .insert({
        vendedor_id: userId,
        registro_id: registroId || null,
        titulo,
        mes_referencia: mesReferencia,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: linkErr } = await supabase
      .from("crm_viagem_despesas")
      .update({ prestacao_id: nova.id })
      .in("id", despesaIds);
    if (linkErr) {
      // Não deixa uma prestação vazia (sem despesa nenhuma vinculada) órfã
      // no banco por causa de uma falha no meio do caminho.
      await supabase.from("crm_viagem_prestacoes").delete().eq("id", nova.id).catch(() => {});
      throw new Error(linkErr.message);
    }

    let final = nova;
    if (enviar) {
      const { data: enviada, error: sendErr } = await supabase
        .from("crm_viagem_prestacoes")
        .update({ status: "enviada", enviada_em: new Date().toISOString() })
        .eq("id", nova.id)
        .select()
        .single();
      if (sendErr) throw new Error(sendErr.message);
      final = enviada;
    }

    setPrestacoes(prev => [final, ...prev]);
    return final;
  }, [userId]);

  const enviarRascunho = useCallback(async (id) => {
    await updatePrestacao(id, { status: "enviada", enviada_em: new Date().toISOString() });
  }, [updatePrestacao]);

  const excluirRascunho = useCallback(async (id) => {
    const { error } = await supabase.from("crm_viagem_prestacoes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setPrestacoes(prev => prev.filter(p => p.id !== id));
  }, []);

  // Decide todas as despesas pendentes da prestação de uma vez — o trigger
  // crm_viagem_prestacoes_recompute_status cuida de virar a prestação pra
  // "aprovada"/"rejeitada" (ou "parcial", se alguma já tiver sido decidida
  // diferente antes, item a item).
  const decidirLote = useCallback(async (prestacaoId, novoStatus, observacaoGestor) => {
    const { error } = await supabase
      .from("crm_viagem_despesas")
      .update({
        status_reembolso: novoStatus,
        observacao_gestor: observacaoGestor || null,
        aprovado_por: userId,
        aprovado_em: new Date().toISOString(),
      })
      .eq("prestacao_id", prestacaoId)
      .eq("status_reembolso", "pendente");
    if (error) throw new Error(error.message);
  }, [userId]);

  // "Paga" continua manual (decisão do Daniel, 10/08/2026) — sem
  // integração automática com folha/financeiro. Só permitido quando a
  // prestação já está "aprovada" (RLS/UI garantem isso antes de chamar).
  const marcarPaga = useCallback(async (prestacaoId) => {
    const { error: despErr } = await supabase
      .from("crm_viagem_despesas")
      .update({ status_reembolso: "pago" })
      .eq("prestacao_id", prestacaoId)
      .eq("status_reembolso", "aprovado");
    if (despErr) throw new Error(despErr.message);
    await updatePrestacao(prestacaoId, { status: "paga" });
  }, [updatePrestacao]);

  return {
    prestacoes,
    loading,
    criarPrestacao,
    enviarRascunho,
    excluirRascunho,
    decidirLote,
    marcarPaga,
    updatePrestacao,
    refetch: fetchAll,
  };
}
