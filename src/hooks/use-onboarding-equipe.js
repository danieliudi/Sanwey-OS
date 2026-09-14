import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Onboarding da equipe do gestor — TRAVA 03 (14/09/2026, reportada pelo
// Daniel: "não tem aonde gestor acompanhar que etapa está, e tem que ficar
// perguntando").
//
// Lê por RPC, nunca direto de rh_colaboradores: a RLS daquela tabela devolve
// zero linha pra quem não é do RH, e afrouxá-la entregaria a linha inteira
// (salário, CPF, endereço). A função devolve lista de colunas fixa e só
// leitura — ver a migration 20260914110000 pro racional e pra definição de
// "minha equipe" (gestor_id, a hierarquia de RH; NUNCA profiles.supervisor_id,
// que é o supervisor comercial).
//
// DUAS CHAMADAS, não uma, e isso foi um bloqueador do QA: "não sou gestor de
// ninguém" e "sou gestor mas ninguém está entrando agora" são estados
// diferentes e a contagem sozinha não os distingue. Com gestor_id vazio no
// banco, a contagem é zero pra todo mundo — decidir pela contagem escondia a
// seção de todo gestor e tornava a mensagem de vazio inalcançável.
//
// Não assina Realtime de propósito: é tela de acompanhamento que o gestor
// abre de vez em quando, não um board que ele opera.
export function useOnboardingEquipe({ enabled = true } = {}) {
  const [equipe, setEquipe] = useState([]);
  const [souGestor, setSouGestor] = useState(false);
  const [loading, setLoading] = useState(Boolean(enabled) && isSupabaseConfigured);

  const ativo = isSupabaseConfigured && enabled;

  const carregar = useCallback(async (isActive = () => true) => {
    if (!ativo) {
      setEquipe([]);
      setSouGestor(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [flag, lista] = await Promise.all([
      supabase.rpc("tenho_equipe_de_rh"),
      supabase.rpc("get_onboarding_da_minha_equipe"),
    ]);
    if (!isActive()) return;

    // Falha some a seção inteira, em silêncio pra quem está na tela.
    // Deliberado, e também veio do QA: o caso mais provável de erro aqui é a
    // função ainda não existir no banco (deploy do front antes da migration),
    // e nesse caso TODO colaborador comum — não só gestor — via uma caixa
    // vermelha com texto cru de PostgREST numa tela que antes funcionava.
    // Isso não é problema que quem está lendo possa resolver. O console
    // guarda o motivo pra quem for investigar.
    if (flag.error || lista.error) {
      console.error("[use-onboarding-equipe] não foi possível carregar:", flag.error || lista.error);
      setEquipe([]);
      setSouGestor(false);
      setLoading(false);
      return;
    }

    setSouGestor(Boolean(flag.data));
    setEquipe(
      (lista.data || []).map(r => ({
        id: r.id,
        fullName: r.full_name,
        jobTitle: r.job_title,
        department: r.department,
        onboardingStage: r.onboarding_stage,
        onboardingStageChangedAt: r.onboarding_stage_changed_at,
        admissionDate: r.admission_date,
        vagaId: r.vaga_id,
      }))
    );
    setLoading(false);
  }, [ativo]);

  // `let isActive` DENTRO do efeito, não um ref da instância — ver o porquê
  // em use-chat.js (numa troca rápida, o ref da instância é religado pelo
  // efeito novo no mesmo commit em que o cleanup do antigo o desliga).
  useEffect(() => {
    let isActive = true;
    carregar(() => isActive);
    return () => { isActive = false; };
  }, [carregar]);

  // Wrapper sem argumento: `carregar` recebe `isActive` como 1º parâmetro, e
  // ligar ela direto num onClick passaria o evento sintético no lugar dele,
  // estourando TypeError na primeira chamada (achado do QA).
  const refetch = useCallback(() => carregar(), [carregar]);

  return { equipe, souGestor, loading, refetch };
}

export default useOnboardingEquipe;
