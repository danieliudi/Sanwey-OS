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
    const { data, error } = await supabase.from("crm_viagem_prestacoes").update(patch).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar a prestação de contas — verifique suas permissões.");
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

    // `.select()` aqui não é só pra pegar erro: um UPDATE barrado pela RLS
    // volta error:null/data:[], então sem contar as linhas a prestação podia
    // nascer com MENOS despesas do que a pessoa selecionou (ou nenhuma) e
    // ainda assim aparecer como criada com sucesso.
    const { data: vinculadas, error: linkErr } = await supabase
      .from("crm_viagem_despesas")
      .update({ prestacao_id: nova.id })
      .in("id", despesaIds)
      .select();
    if (linkErr || (vinculadas?.length ?? 0) !== despesaIds.length) {
      // Não deixa uma prestação vazia/parcial órfã no banco por causa de uma
      // falha no meio do caminho.
      //
      // `try/catch` em vez de `.catch()` encadeado: o PostgrestBuilder do
      // supabase-js implementa SÓ `then` — não tem `catch` nem `finally`.
      // Encadear `.catch()` lançava TypeError, e como o builder é preguiçoso
      // (só dispara no `then`), o DELETE nem chegava a sair: a prestação
      // órfã ficava no banco e a pessoa via "…catch is not a function" no
      // lugar da mensagem. Passou despercebido enquanto esta linha só era
      // alcançada com erro de rede; virou caminho principal quando a
      // checagem de linha afetada entrou logo acima.
      try {
        await supabase.from("crm_viagem_prestacoes").delete().eq("id", nova.id);
      } catch { /* limpeza best-effort — o throw abaixo é o que importa */ }
      throw new Error(linkErr?.message
        || "Não foi possível vincular todas as despesas selecionadas — verifique suas permissões e tente de novo.");
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
  // Sem `.select()` + checagem de vazio de propósito: o filtro é
  // (prestacao_id, status_reembolso='pendente'), não uma linha por id. Zero
  // linha afetada aqui é um resultado LEGÍTIMO — significa que já não havia
  // nada pendente (outro gestor decidiu antes, ou a tela estava velha) —, não
  // um UPDATE barrado pela RLS. Lançar erro nesse caso acusaria não-bug. Quem
  // garante o desfecho é o trigger crm_viagem_prestacoes_recompute_status,
  // que recalcula o status da prestação a partir das despesas reais.
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
    // Mesmo caso do decidirLote: filtro por (prestacao_id, status='aprovado'),
    // não por id — zero linha é legítimo (nada aprovado sobrando), não RLS
    // barrando. A garantia de permissão vem do updatePrestacao logo abaixo,
    // que é UPDATE por id e JÁ checa linha afetada: se a RLS barrar, ele
    // lança e a prestação não fica marcada como paga na tela.
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
