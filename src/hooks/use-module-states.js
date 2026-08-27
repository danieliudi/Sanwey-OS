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
  const [loading, setLoading] = useState(true);
  // Id só desta instância do hook — ver moduleStatesChannelSeq acima.
  const instanceIdRef = useRef(null);
  if (instanceIdRef.current === null) instanceIdRef.current = ++moduleStatesChannelSeq;

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setStates({}); setLoading(false); return; }
    const { data, error } = await supabase
      .from("module_states")
      .select("module_id, state");
    if (!error) {
      setStates(Object.fromEntries((data || []).map(r => [r.module_id, r.state])));
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
  const setModuleState = useCallback(async (moduleId, state) => {
    const previous = states[moduleId];
    setStates(prev => {                                    // otimista
      const next = { ...prev };
      if (state === "live") delete next[moduleId]; else next[moduleId] = state;
      return next;
    });
    try {
      if (state === "live") {
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
  }, [states]);

  return { states, loading, setModuleState, refetch: fetchAll };
}

export default useModuleStates;
