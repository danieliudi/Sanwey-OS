import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Escada de urgência da fila da IA (mockup aprovado 03/09/2026).
//
// Por que existe: medido na produção em 03/09/2026, sobre 45 sugestões já
// resolvidas, a espera média até alguém aprovar era de **155 horas — 6,5
// dias**, com pior caso de 319h (13,3 dias). A causa não era disciplina: NADA
// notificava. `use-notifications.js` cobria dois assuntos (follow-up de lead e
// tarefa vencendo) e não mencionava `agent_actions` em lugar nenhum. A fila só
// existia se alguém lembrasse de abrir a tela Agentes.
//
// A escada é deliberadamente silenciosa no começo: quem responde no mesmo dia
// nunca é incomodado. Um aviso sempre igual vira ruído e é ignorado em duas
// semanas — é o oposto do que se quer.
export const DIAS_ATENCAO = 1; // aviso no sino
export const DIAS_AMBAR   = 3; // fica âmbar e passa a dizer a idade

// Só quem pode aprovar é cobrado. A RLS de agent_actions já restringe a
// leitura a admin/gerente/diretoria — este gate evita a consulta inútil para
// os outros 10 vendedores, em vez de depender de a policy devolver vazio.
export function useAgentQueueAlert({ enabled = false } = {}) {
  const [fila, setFila] = useState({ total: 0, diasMaisVelho: 0, carregando: true });

  const buscar = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) {
      setFila({ total: 0, diasMaisVelho: 0, carregando: false });
      return;
    }
    // `created_at` só, e ordenado: a tela Agentes já carrega a fila inteira
    // quando alguém a abre. Aqui interessam duas coisas — quantos e o mais
    // velho — então não faz sentido trazer payload de dezenas de linhas em
    // toda montagem do App.
    const { data, error } = await supabase
      .from("agent_actions")
      .select("created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      // Falha aqui nunca pode derrubar a navegação: sem contador é degradação
      // aceitável, tela quebrada não é.
      setFila({ total: 0, diasMaisVelho: 0, carregando: false });
      return;
    }
    const linhas = data || [];
    const maisVelho = linhas[0]?.created_at;
    const dias = maisVelho
      ? Math.floor((Date.now() - new Date(maisVelho).getTime()) / 86400000)
      : 0;
    setFila({ total: linhas.length, diasMaisVelho: dias, carregando: false });
  }, [enabled]);

  useEffect(() => { buscar(); }, [buscar]);

  // Sem Realtime de propósito: a fila nasce de rotina externa (n8n/cron das
  // 9h), não de ação de quem está com a tela aberta. Um canal permanente para
  // cada aprovador custaria conexão o dia inteiro para ganhar minutos numa
  // decisão que hoje leva dias. Uma releitura a cada 10 min basta.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(buscar, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [enabled, buscar]);

  const nivel = fila.diasMaisVelho >= DIAS_AMBAR ? "ambar"
    : fila.diasMaisVelho >= DIAS_ATENCAO ? "atencao"
    : "normal";

  return { ...fila, nivel, recarregar: buscar };
}

export default useAgentQueueAlert;
