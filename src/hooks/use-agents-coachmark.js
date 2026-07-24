import { useCallback } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";

// Coachmark "Agentes" na sidebar, mostrado 1 única vez pra quem é
// isRHManager (ver docs/design-spec-agents-sidebar-coachmark.md). Mesmo
// modelo de useScreenTips/useChangelogNotice: sem coluna no banco,
// mapa { [userId]: true } em localStorage — evento único, não precisa de
// versão como o changelog.
//
// A checagem de "o elemento [data-nav-id=agents] existe no DOM" não entra
// aqui de propósito — hook não deve tocar DOM, isso fica por conta do
// componente (que trata a ausência como "ainda não pronto", sem marcar
// como visto). Este hook também não decide isRHManager sozinho — recebe
// como parâmetro pra não duplicar a lógica de multi-cargo já centralizada
// em App.jsx.
export function useAgentsCoachmark(currentUser, { isRHManager, skip = false } = {}) {
  const [seenMap, setSeenMap] = usePersistentState(STORAGE_KEYS.agentsCoachmarkSeen, {});
  const userId = currentUser?.id;

  const visible = Boolean(!skip && isRHManager && userId && !seenMap[userId]);

  const dismiss = useCallback(() => {
    if (!userId) return;
    setSeenMap(m => ({ ...m, [userId]: true }));
  }, [userId, setSeenMap]);

  return { visible, dismiss };
}

export default useAgentsCoachmark;
