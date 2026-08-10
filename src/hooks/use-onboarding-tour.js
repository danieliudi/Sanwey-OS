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

  // Fase 1 — só decide se é elegível e liga `active`. Isso já propaga
  // `forceExpanded=true` pra Sidebar (App.jsx), mas o DOM só reflete grupo
  // recolhido virando visível depois de um ciclo de render+commit do React
  // — não dá pra consultar o DOM na mesma passada que liga `active`.
  useEffect(() => {
    if (skip || !userId || alreadySeen) { setActive(false); return undefined; }
    // Pequeno atraso: a sidebar (e os data-tour dela) só existe depois do
    // primeiro render pós-login — sem isso a Fase 2 rodaria cedo demais e
    // acharia a lista vazia.
    const t = setTimeout(() => setActive(true), 400);
    return () => clearTimeout(t);
  }, [skip, userId, alreadySeen]);

  // Fase 2 — só DEPOIS que `active` vira true (Sidebar já teve a chance de
  // re-renderizar com forceExpanded) calcula quais steps têm alvo real no
  // DOM. Dois requestAnimationFrame em sequência, não um só — um único rAF
  // pode disparar ainda dentro do mesmo ciclo de commit em alguns
  // navegadores; dois garante que o paint já aconteceu. Achado em QA
  // adversarial: sem isso, um grupo que o usuário tinha deixado recolhido
  // perdia os steps inteiros, mesmo com forceExpanded ligado — o
  // querySelector rodava contra o DOM de ANTES do grupo expandir.
  useEffect(() => {
    if (!active) { setSteps([]); return undefined; }
    let disposed = false;
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (disposed) return;
        const present = ONBOARDING_TOUR_STEPS.filter(s => document.querySelector(`[data-tour="sidebar-nav-${s.id}"]`));
        if (present.length === 0) { setActive(false); return; }
        setSteps(present);
        setStepIndex(0);
      });
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [active]);

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
