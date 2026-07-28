import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Versão atual dos termos de uso — some incrementa quando o texto muda de
// forma relevante (novo texto do jurídico, nova política). Todo profile
// precisa aceitar essa versão pra usar a plataforma; ver TermsGateScreen.
export const CURRENT_TERMS_VERSION = 1;

export function useTermsAcceptance(currentUser) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const check = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("terms_acceptances")
      .select("id")
      .eq("profile_id", currentUser.id)
      .eq("version", CURRENT_TERMS_VERSION)
      .maybeSingle();
    // Falha de rede (comum em conexão de celular instável) não pode virar
    // "não aceitou" — isso reabre o gate pra quem já aceitou antes, e o
    // próximo passo (accept()) esbarraria na constraint única (ver abaixo).
    // Só atualiza o estado quando a leitura realmente respondeu.
    if (!error) setAccepted(Boolean(data));
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => { check(); }, [check]);

  const accept = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser?.id) return;
    const { error } = await supabase.from("terms_acceptances").insert({
      profile_id: currentUser.id,
      version: CURRENT_TERMS_VERSION,
    });
    // 23505 = unique_violation (profile_id, version) — já existe aceite
    // registrado (ex.: o check() acima leu "não aceitou" só por uma falha de
    // rede transitória, e o gate reapareceu pra quem já tinha aceitado).
    // Tratar como sucesso em vez de erro sem saída, que era o bug real
    // reportado (mobile preso em "Tente de novo" indefinidamente).
    if (!error || error.code === "23505") {
      setAccepted(true);
      return null;
    }
    return error;
  }, [currentUser?.id]);

  return { accepted, loading, accept };
}

export default useTermsAcceptance;
