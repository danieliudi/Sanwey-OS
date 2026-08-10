import { useCallback, useEffect, useState } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { ONBOARDING_TOUR_STEPS } from "../data/onboarding-tour-steps";

// Tour guiado sequencial da plataforma inteira (não confundir com
// use-feature-spotlight.js — aquele aponta UMA novidade pontual pra quem já
// usa a plataforma; este percorre a sidebar inteira, uma vez, pra qualquer
// usuário — novo ou não). Decidido com o Daniel 10/08/2026: disponível a
// todos, não só quem está entrando agora; "Pular tour" marca como visto pra
// sempre, mesmo espírito do onboarding antigo.
//
// `skip` é o mesmo flag que App.jsx já usa pra sincronizar spotlight/
// coachmark/changelog com o modal de boas-vindas (`showOnboarding`) — passar
// `showOnboarding` aqui faz os dois fluxos se encaixarem sozinhos, sem
// precisar de um `start()` manual: enquanto o modal de boas-vindas está
// aberto (usuário novo), skip=true segura o tour; assim que "Começar" é
// clicado, showOnboarding vira false e o efeito abaixo dispara o tour na
// hora. Usuário que já tinha dispensado o onboarding antigo já entra com
// showOnboarding=false, então o tour dispara sozinho no primeiro load em que
// ele ainda não tiver visto — sem precisar ter sido "usuário novo" pra isso.
export function useOnboardingTour(currentUser, { skip = false } = {}) {
  const [seenMap, setSeenMap] = usePersistentState(STORAGE_KEYS.platformTourSeen, {});
  const userId = currentUser?.id;
  const alreadySeen = Boolean(userId && seenMap[userId]);

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState([]);

  useEffect(() => {
    if (skip || !userId || alreadySeen) { setActive(false); return undefined; }
    // Pequeno atraso: a sidebar (e os data-tour dela) só existe depois do
    // primeiro render pós-login — sem isso o querySelector abaixo rodaria
    // cedo demais e acharia a lista vazia.
    const t = setTimeout(() => {
      const present = ONBOARDING_TOUR_STEPS.filter(s => document.querySelector(`[data-tour="sidebar-nav-${s.id}"]`));
      if (present.length === 0) return;
      setSteps(present);
      setStepIndex(0);
      setActive(true);
    }, 400);
    return () => clearTimeout(t);
  }, [skip, userId, alreadySeen]);

  const finish = useCallback(() => {
    if (userId) setSeenMap(m => ({ ...m, [userId]: true }));
    setActive(false);
  }, [userId, setSeenMap]);

  const next = useCallback(() => {
    setStepIndex(i => {
      if (i + 1 >= steps.length) { finish(); return i; }
      return i + 1;
    });
  }, [steps.length, finish]);

  const prev = useCallback(() => setStepIndex(i => Math.max(0, i - 1)), []);

  return {
    active,
    step: steps[stepIndex] || null,
    stepIndex,
    totalSteps: steps.length,
    next,
    prev,
    skipTour: finish,
  };
}

export default useOnboardingTour;
