import { useMemo } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { VIDEO_TUTORIALS } from "../data/tutorials";

// Dica contextual (quickStart) mostrada quando o usuário chega numa tela pela
// 1ª vez — reaproveita o mesmo conteúdo de VIDEO_TUTORIALS que hoje só
// aparece na tela separada "Tutoriais". Resolução de papel idêntica à usada
// em TutoriaisView (VIDEO_TUTORIALS[role] || VIDEO_TUTORIALS.vendedor) — não
// existe lógica própria de multi-cargo pra esse conteúdo hoje, só o campo
// escalar `role`.
//
// screenTipsSeenMap[user.id] = { [screenKey]: true, ... } em localStorage,
// mesmo espírito do onboardingDoneMap (App.jsx) e do changelogSeenMap
// (use-changelog-notice.js) — sem coluna no banco, não sincroniza entre
// dispositivos de propósito.
//
// Difere de propósito do useChangelogNotice num ponto: NÃO existe "marcar a
// 1ª tela como vista em silêncio, sem mostrar". Pro changelog isso faz
// sentido (usuário novo não precisa de retrospectiva). Aqui o objetivo é o
// oposto — a dica da 1ª tela que um usuário novo abre é a mais valiosa de
// todas, é exatamente o momento que essa feature existe pra cobrir. O custo
// de não silenciar é pequeno (quem já usa a plataforma vê um toast
// dispensável na 1ª vez que voltar a cada tela após o rollout), e é bem
// menor que o de nunca entregar a dica que mais importa pra quem está
// chegando agora.
export function useScreenTips(currentUser, screenKey, { skip = false } = {}) {
  const [screenTipsSeenMap, setScreenTipsSeenMap] = usePersistentState(STORAGE_KEYS.screenTipsSeen, {});
  const userId = currentUser?.id;
  const role = currentUser?.role || "vendedor";
  const videos = VIDEO_TUTORIALS[role] || VIDEO_TUTORIALS.vendedor;
  const seenForUser = (userId && screenTipsSeenMap[userId]) || {};

  const tip = useMemo(() => {
    if (skip || !userId || !screenKey || seenForUser[screenKey]) return null;
    return videos.find(v => v.description === screenKey)?.quickStart || null;
  }, [skip, userId, screenKey, seenForUser, videos]);

  const dismiss = () => {
    if (!userId || !screenKey) return;
    setScreenTipsSeenMap(m => ({ ...m, [userId]: { ...(m[userId] || {}), [screenKey]: true } }));
  };

  return { tip, dismiss };
}

export default useScreenTips;
