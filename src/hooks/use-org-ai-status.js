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
      cachedStatus = error || data?.error
        ? { configured: false, provider: null }
        : { configured: Boolean(data?.configured), provider: data?.provider || null };
      return cachedStatus;
    })
    .catch(() => {
      cachedStatus = { configured: false, provider: null };
      return cachedStatus;
    });
  return inflightPromise;
}

// Status (configurado/não + provedor — nunca a chave em si) da IA em nível
// de empresa, configurada via secrets AI_ORG_* no projeto Supabase (mesmo
// padrão do D4SIGN_API_TOKEN). Usado como fallback quando o usuário não
// tem chave pessoal salva em Configurações → Integrações de IA. O provedor
// é necessário no cliente: recursos de visão (leitura de documento/currículo)
// só funcionam com Anthropic, e as telas precisam saber disso pra decidir
// se tentam a extração — sem ele, chave org ficava invisível e o
// preenchimento automático desistia em silêncio.
export function useOrgAIStatus() {
  const [status, setStatus] = useState(cachedStatus ?? { configured: false, provider: null });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    fetchOrgAIStatus().then(s => { if (!cancelled) setStatus(s); });
    return () => { cancelled = true; };
  }, []);

  return status;
}
