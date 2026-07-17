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
    const { data } = await supabase
      .from("terms_acceptances")
      .select("id")
      .eq("profile_id", currentUser.id)
      .eq("version", CURRENT_TERMS_VERSION)
      .maybeSingle();
    setAccepted(Boolean(data));
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => { check(); }, [check]);

  const accept = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser?.id) return;
    const { error } = await supabase.from("terms_acceptances").insert({
      profile_id: currentUser.id,
      version: CURRENT_TERMS_VERSION,
    });
    if (!error) setAccepted(true);
    return error;
  }, [currentUser?.id]);

  return { accepted, loading, accept };
}

export default useTermsAcceptance;
