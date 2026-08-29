import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Conexão da Secretária de IA (Mia, secretaria-plataforma) com o "Meu To-Do"
// — decidido com o Daniel 27/08/2026, ver 20261021_personal_tasks_api_keys.sql
// e supabase/functions/personal-tasks-agent/index.ts. Cada linha desta
// tabela é uma chave gerada por UM perfil (o que estava logado no momento do
// "Gerar nova chave") — não existe mais um secret único de plataforma
// travado num usuário só.
//
// A chave em claro só existe no cliente, e só entre generateKey() retornar
// e o modal fechar: computamos o hash aqui mesmo (Web Crypto, disponível em
// todo navegador com HTTPS) e gravamos só o hash. Perdeu a chave depois de
// fechar o modal, não tem como recuperar — gera outra e revoga a antiga.
function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `stc_${hex}`;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function usePersonalTasksApiKeys(userId) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKeys = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("personal_tasks_api_keys")
      .select("id,label,created_at,last_used_at,revoked_at")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false });
    if (err) setError(err); else { setKeys(data || []); setError(null); }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  // Retorna a chave em claro (só desta vez) — quem chama é responsável por
  // mostrar e nunca guardar em estado que sobrevive ao fechamento do modal.
  const generateKey = useCallback(async (label) => {
    const rawKey = randomKey();
    const keyHash = await sha256Hex(rawKey);
    const { error: err } = await supabase
      .from("personal_tasks_api_keys")
      .insert({ profile_id: userId, label: label.trim() || "Sem nome", key_hash: keyHash });
    if (err) throw err;
    await fetchKeys();
    return rawKey;
  }, [userId, fetchKeys]);

  const revokeKey = useCallback(async (id) => {
    const { data, error: err } = await supabase
      .from("personal_tasks_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("profile_id", userId)
      .select();
    if (err) throw err;
    // Zero linha = RLS barrou. Não havia estado otimista aqui (o fetchKeys
    // abaixo recarrega a verdade), então a chave nunca chegou a APARECER como
    // revogada — o problema era o silêncio: clicar em "Revogar" não dava erro
    // nenhum e a chave seguia na lista, ativa, sem explicação.
    if (!data || data.length === 0) throw new Error("Não foi possível revogar a chave — ela continua ativa. Verifique suas permissões.");
    await fetchKeys();
  }, [userId, fetchKeys]);

  return { keys, loading, error, generateKey, revokeKey, refetch: fetchKeys };
}
