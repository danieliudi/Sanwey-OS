import { useCallback, useMemo } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { FEATURE_SPOTLIGHTS } from "../data/feature-spotlights";

// Tour guiado contextual — mesmo modelo de useScreenTips/useAgentsCoachmark
// (mapa por usuário em localStorage, sem coluna no banco), mas VERSIONADO
// por spotlight em vez de evento único: seenMap[userId][spotlightId] guarda
// a VERSÃO vista, não só `true`. Mudou a feature de um jeito que invalida o
// spotlight antigo? Sobe `version` em feature-spotlights.js — quem já viu a
// versão anterior vê de novo automaticamente, sem precisar de um id novo.
//
// Só devolve o 1º spotlight pendente da rota atual (não os N de uma vez) —
// "mostra um por vez" era a decisão do mockup; o componente que consome
// isto chama `dismiss()` e o próximo pendente aparece na renderização
// seguinte.
//
// A checagem de "o elemento [data-tour] existe no DOM" não entra aqui de
// propósito, mesma decisão de use-agents-coachmark.js — hook não toca DOM,
// isso fica com o componente (FeatureSpotlight.jsx).
export function useFeatureSpotlight(currentUser, route, { skip = false } = {}) {
  const [seenMap, setSeenMap] = usePersistentState(STORAGE_KEYS.featureSpotlightsSeen, {});
  const userId = currentUser?.id;
  const seenForUser = (userId && seenMap[userId]) || {};

  const spotlight = useMemo(() => {
    if (skip || !userId || !route) return null;
    return FEATURE_SPOTLIGHTS.find(s => s.route === route && seenForUser[s.id] !== s.version) || null;
  }, [skip, userId, route, seenForUser]);

  const dismiss = useCallback(() => {
    if (!userId || !spotlight) return;
    setSeenMap(m => ({ ...m, [userId]: { ...(m[userId] || {}), [spotlight.id]: spotlight.version } }));
  }, [userId, spotlight, setSeenMap]);

  return { spotlight, dismiss };
}

export default useFeatureSpotlight;
