import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Configuração comercial por frente — hoje só o limiar de "alto volume".
//
// Decidido com o Daniel em 15/09/2026 (opção B do mockup "Quatro decisões"):
// o número que faz a pergunta de maior peso do Checklist de Visita pontuar
// (20 dos 100) deixa de ser constante no código e passa a ser editável em
// Configurações → Comercial.
//
// Por que não `usePersistentState`/localStorage, que é o caminho de
// `useLeadFormConfig`: aquilo é por navegador. Este número alimenta um score
// que prioriza carteira e sobe pra diretoria — precisa ser o mesmo para
// todo mundo.
//
// RLS: leitura liberada (o score é calculado no navegador de quem abre o
// card); escrita só admin/gerente, via roles[]. Ver a migration
// 20260915120000_config_comercial.sql.

const TABELA = "crm_config_comercial";

export function useConfigComercial({ companyId } = {}) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  // Falha de leitura NÃO é "não configurado": sem isto, uma recusa de RLS ou
  // uma queda de rede fariam a tela dizer "limiar não configurado" e tirar o
  // item de maior peso do score em silêncio. Ver ErroDeLeitura.jsx.
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.from(TABELA).select("*");
      if (err) throw err;
      const porFrente = {};
      (data || []).forEach((r) => { porFrente[r.company_id] = r; });
      setConfig(porFrente);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    fetchAll();
    if (!isSupabaseConfigured) return undefined;
    const refetch = debounce(() => { if (ativo) fetchAll(); }, 400);
    const canal = supabase
      .channel(`crm-config-comercial-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABELA }, refetch)
      .subscribe();
    return () => { ativo = false; refetch.cancel(); supabase.removeChannel(canal); };
  }, [fetchAll]);

  /**
   * Grava o limiar de uma frente. `valor` nulo volta ao estado "não
   * configurado", que é legítimo: é melhor tirar o item da conta do que
   * deixar um número errado pontuando a carteira inteira.
   */
  const salvarLimiar = useCallback(async (frente, valor, userId) => {
    if (!isSupabaseConfigured) return { ok: false, motivo: "Supabase não configurado." };
    const { data, error: err } = await supabase
      .from(TABELA)
      .upsert({
        company_id: frente,
        limiar_alto_volume_bags: valor,
        updated_at: new Date().toISOString(),
        updated_by: userId ?? null,
      }, { onConflict: "company_id" })
      .select();
    // RLS recusando escrita volta sem erro e com zero linha — sem o .select()
    // acima isto passaria como sucesso silencioso (classe de bug já paga
    // nesta plataforma em use-leads.js).
    if (err) return { ok: false, motivo: err.message };
    if (!data || data.length === 0) {
      return { ok: false, motivo: "Sem permissão para alterar a configuração comercial. Só admin e gerente podem." };
    }
    await fetchAll();
    return { ok: true };
  }, [fetchAll]);

  const limiarDe = useCallback(
    (frente) => config?.[frente]?.limiar_alto_volume_bags ?? null,
    [config],
  );

  return {
    config,
    loading,
    error,
    limiar: companyId ? limiarDe(companyId) : null,
    limiarDe,
    salvarLimiar,
    refetch: fetchAll,
  };
}

export default useConfigComercial;
