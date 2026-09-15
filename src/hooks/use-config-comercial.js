import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";
import { fatosDaFrente } from "../constants/fatos-canonicos";

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

  // Classe 1 da proposta: o que está configurado, com o padrão versionado em
  // constants/fatos-canonicos.js por baixo. Nunca devolve vazio — proposta
  // sem razão social não é proposta.
  const fatosDe = useCallback(
    (frente) => fatosDaFrente(frente, config?.[frente]?.fatos_canonicos),
    [config],
  );
  const metaFatosDe = useCallback(
    (frente) => ({
      atualizadoEm:  config?.[frente]?.fatos_atualizados_em ?? null,
      atualizadoPor: config?.[frente]?.fatos_atualizados_por ?? null,
      configurados:  config?.[frente]?.fatos_canonicos ?? null,
    }),
    [config],
  );

  /**
   * Grava os fatos canônicos de uma frente. Registra QUANDO e QUEM junto, e
   * não é burocracia: o risco conhecido de deixar isto editável é a tela
   * divergir da base de marca, e sem data e autor a divergência não aparece.
   */
  const salvarFatos = useCallback(async (frente, fatos, userId) => {
    if (!isSupabaseConfigured) return { ok: false, motivo: "Supabase não configurado." };
    const agora = new Date().toISOString();
    const { data, error: err } = await supabase
      .from(TABELA)
      .upsert({
        company_id: frente,
        fatos_canonicos: fatos,
        fatos_atualizados_em: agora,
        fatos_atualizados_por: userId ?? null,
        updated_at: agora,
        updated_by: userId ?? null,
      }, { onConflict: "company_id" })
      .select();
    if (err) return { ok: false, motivo: err.message };
    if (!data || data.length === 0) {
      return { ok: false, motivo: "Sem permissão para alterar os fatos da marca. Só admin e gerente podem." };
    }
    await fetchAll();
    return { ok: true };
  }, [fetchAll]);

  return {
    config,
    loading,
    error,
    limiar: companyId ? limiarDe(companyId) : null,
    limiarDe,
    salvarLimiar,
    fatos: companyId ? fatosDe(companyId) : null,
    fatosDe,
    metaFatosDe,
    salvarFatos,
    refetch: fetchAll,
  };
}

export default useConfigComercial;
