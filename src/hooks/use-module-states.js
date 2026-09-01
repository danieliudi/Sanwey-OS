import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Contador de módulo, não por-hook — mesmo motivo de personalTasksChannelSeq
// em use-personal-tasks.js: garante nome de canal único mesmo quando duas
// instâncias deste hook montam ao mesmo tempo (App.jsx, sempre montado, +
// ModuleStatesPanel.jsx quando a tela "Módulos" abre). Antes disto, as duas
// usavam o mesmo nome fixo "module-states-changes" — o Supabase devolve o
// MESMO canal (dedupe por nome/topic) pra 2ª instância, que já está
// `subscribed` pela 1ª, e chamar `.on()` num canal já inscrito lança
// "cannot add postgres_changes callbacks ... after subscribe()", derrubando
// a tela de Configurações inteira (achado do Daniel 27/08/2026).
let moduleStatesChannelSeq = 0;

// Chave global de liga/desliga por página (Configurações → Módulos).
// Complementa o "Acesso por módulo" POR PESSOA (use-module-overrides.js):
// aquele decide quem vê; este decide se a página está disponível pra
// empresa. Os dois se combinam por E, nunca por OU — ver gateByModuleStates
// em utils/module-access.js e o espelho no banco, dentro de
// current_user_has_module().
//
// Linha ausente = "live". A tabela nasce vazia de propósito: no dia da
// migration nada muda pra ninguém.
export function useModuleStates({ enabled = true } = {}) {
  const [states, setStates]   = useState({});
  // Descrição editável da página (migration 20260901180000), mostrada ao lado
  // do título pelo PageTitle. Mora na MESMA tabela porque é a mesma chave
  // (module_id) e a mesma pergunta — "o que esta página é" — só que a resposta
  // é texto em vez de on/off. Mapa separado no estado pra não fazer todo
  // consumidor de `states` (que só quer off/test/live) passar a lidar com
  // objeto.
  const [descriptions, setDescriptions] = useState({});
  const [loading, setLoading] = useState(true);
  // Id só desta instância do hook — ver moduleStatesChannelSeq acima.
  const instanceIdRef = useRef(null);
  if (instanceIdRef.current === null) instanceIdRef.current = ++moduleStatesChannelSeq;

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setStates({}); setDescriptions({}); setLoading(false); return; }
    const { data, error } = await supabase
      .from("module_states")
      .select("module_id, state, description");
    if (!error) {
      setStates(Object.fromEntries((data || []).map(r => [r.module_id, r.state])));
      setDescriptions(Object.fromEntries(
        (data || []).filter(r => r.description).map(r => [r.module_id, r.description])
      ));
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: quando o admin liga ou desliga uma página, quem já está com a
  // plataforma aberta precisa ver o menu mudar sem recarregar — senão a
  // pessoa continua num lugar que "não existe mais" até o próximo F5.
  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const channel = supabase
      .channel(`module-states-changes_${instanceIdRef.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "module_states" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  // Só admin consegue gravar (RLS). "live" apaga a linha em vez de gravar o
  // valor: linha ausente já significa live, e assim a tabela guarda só o que
  // foge do normal — fica óbvio, olhando ela, o que está fora do ar.
  //
  // EXCEÇÃO desde 01/09/2026 (descrição de página): se a linha tem descrição,
  // voltar pra "live" GRAVA `state = 'live'` em vez de apagar — apagar levaria
  // o texto junto. É seguro porque os dois lados que leem isto tratam ausente
  // e 'live' igual: `gateByModuleStates` faz `states[id] || "live"` e a função
  // `current_user_has_module` no banco faz `coalesce(v_state,'live')`. Ou
  // seja, 'live' explícito nunca mudou comportamento — só não existia antes.
  const setModuleState = useCallback(async (moduleId, state) => {
    const previous = states[moduleId];
    setStates(prev => {                                    // otimista
      const next = { ...prev };
      if (state === "live") delete next[moduleId]; else next[moduleId] = state;
      return next;
    });
    try {
      if (state === "live" && !descriptions[moduleId]) {
        const { error } = await supabase.from("module_states").delete().eq("module_id", moduleId);
        if (error) throw new Error(error.message);
      } else {
        const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;
        const { error } = await supabase
          .from("module_states")
          .upsert({ module_id: moduleId, state, updated_by: userId }, { onConflict: "module_id" });
        if (error) throw new Error(error.message);
      }
    } catch (err) {
      setStates(prev => {                                  // desfaz e propaga
        const next = { ...prev };
        if (previous) next[moduleId] = previous; else delete next[moduleId];
        return next;
      });
      throw err;
    }
  }, [states, descriptions]);

  // Descrição da página. Mesma RLS (module_states_write = só admin) — quem não
  // é admin nem vê o lápis, e se tentasse mesmo assim a gravação volta 0 linha
  // e o erro sobe pro chamador em vez de sumir em silêncio.
  //
  // Texto vazio LIMPA a descrição (grava NULL). Se depois disso a linha não
  // guardar mais nada de anormal (state 'live'), ela é apagada — mesma
  // higiene do setModuleState: a tabela só guarda o que foge do padrão.
  const setModuleDescription = useCallback(async (moduleId, description) => {
    const texto = (description || "").trim();
    const valor = texto || null;
    const previous = descriptions[moduleId];
    setDescriptions(prev => {                              // otimista
      const next = { ...prev };
      if (valor) next[moduleId] = valor; else delete next[moduleId];
      return next;
    });
    try {
      const estadoAtual = states[moduleId] || "live";
      if (!valor && estadoAtual === "live") {
        const { error } = await supabase.from("module_states").delete().eq("module_id", moduleId);
        if (error) throw new Error(error.message);
        return;
      }
      const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;
      const { data, error } = await supabase
        .from("module_states")
        .upsert({ module_id: moduleId, state: estadoAtual, description: valor, updated_by: userId }, { onConflict: "module_id" })
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Não foi possível salvar — só administrador edita a descrição da página.");
      }
    } catch (err) {
      setDescriptions(prev => {                            // desfaz e propaga
        const next = { ...prev };
        if (previous) next[moduleId] = previous; else delete next[moduleId];
        return next;
      });
      throw err;
    }
  }, [states, descriptions]);

  return { states, descriptions, loading, setModuleState, setModuleDescription, refetch: fetchAll };
}

export default useModuleStates;
