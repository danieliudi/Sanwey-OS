import { useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Checa a legibilidade de uma foto/PDF de documento via a edge function
// check-document-legibility (chave de IA paga pela empresa, não depende de
// BYOK). `configured: false` quando o secret ainda não foi cadastrado no
// servidor — nesse caso a checagem simplesmente não roda (upload segue
// normal, sem bloqueio).
export function useDocumentLegibility() {
  const check = useCallback(async (imageBase64, mediaType) => {
    if (!isSupabaseConfigured) return { configured: false, legivel: true };
    const { data, error } = await supabase.functions.invoke("check-document-legibility", {
      body: { imageBase64, mediaType },
    });
    if (error) return { configured: false, legivel: true };
    return data || { configured: false, legivel: true };
  }, []);

  return { check };
}

export default useDocumentLegibility;
