import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Onboarding da equipe do gestor — TRAVA 03 (14/09/2026, reportada pelo
// Daniel: "não tem aonde gestor acompanhar que etapa está, e tem que ficar
// perguntando").
//
// Lê pela RPC `get_onboarding_da_minha_equipe`, nunca direto de
// rh_colaboradores: a RLS daquela tabela devolve zero linha pra quem não é do
// RH, e afrouxá-la entregaria a linha inteira (salário, CPF, endereço). A
// função devolve lista de colunas fixa e só leitura — ver a migration
// 20260914110000 pro racional completo e pra definição de "minha equipe".
//
// Não assina Realtime de propósito: é uma tela de acompanhamento que o gestor
// abre de vez em quando, não um board que ele opera. Uma assinatura por
// sessão de gestor custaria mais do que o dado vale aqui; `refetch` está
// exposto pra quem quiser um botão de atualizar.
export function useOnboardingEquipe({ enabled = true } = {}) {
  const [equipe, setEquipe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ativo = isSupabaseConfigured && enabled;

  const fetchEquipe = useCallback(async (isActive = () => true) => {
    if (!ativo) {
      setEquipe([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("get_onboarding_da_minha_equipe");
    if (!isActive()) return;
    if (err) {
      setError(err.message);
      setEquipe([]);
    } else {
      setEquipe(
        (data || []).map(r => ({
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
    }
    setLoading(false);
  }, [ativo]);

  // `let isActive` DENTRO do efeito, não um ref da instância — ver o porquê
  // em use-chat.js (numa troca rápida, o ref da instância é religado pelo
  // efeito novo no mesmo commit em que o cleanup do antigo o desliga).
  useEffect(() => {
    let isActive = true;
    fetchEquipe(() => isActive);
    return () => { isActive = false; };
  }, [fetchEquipe]);

  return { equipe, loading, error, refetch: fetchEquipe };
}

export default useOnboardingEquipe;
