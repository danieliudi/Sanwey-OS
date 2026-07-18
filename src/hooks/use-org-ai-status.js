import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Cache em nível de módulo — várias instâncias de useAI() podem montar ao
// mesmo tempo na mesma tela (cada card de lead/campanha tem a sua), então
// evita disparar a mesma checagem de status repetidas vezes.
let cachedStatus = null;
let inflightPromise = null;

function fetchOrgAIStatus() {
  if (cachedStatus) return Promise.resolve(cachedStatus);
  if (inflightPromise) return inflightPromise;
  inflightPromise = supabase.functions
    .invoke("ai-assistant", { body: { action: "status" } })
    .then(({ data, error }) => {
      cachedStatus = error || data?.error ? { configured: false } : { configured: Boolean(data?.configured) };
      return cachedStatus;
    })
    .catch(() => {
      cachedStatus = { configured: false };
      return cachedStatus;
    });
  return inflightPromise;
}

// Status (só configurado/não — nunca a chave em si) da IA em nível de
// empresa, configurada via secrets AI_ORG_* no projeto Supabase (mesmo
// padrão do D4SIGN_API_TOKEN). Usado como fallback quando o usuário não
// tem chave pessoal salva em Configurações → Integrações de IA.
export function useOrgAIStatus() {
  const [configured, setConfigured] = useState(cachedStatus?.configured ?? false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    fetchOrgAIStatus().then(status => { if (!cancelled) setConfigured(status.configured); });
    return () => { cancelled = true; };
  }, []);

  return configured;
}
