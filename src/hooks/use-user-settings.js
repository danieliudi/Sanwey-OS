import { useCallback, useMemo } from "react";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { DEFAULT_USER_SETTINGS } from "../constants/user-settings";
import { usePersistentState } from "./use-persistent-state";

// Shallow-merges any stored value with the defaults so new setting keys added
// in future versions don't break existing users.
//
// Aqui existia também uma migração de `visibleKanbanStages` ("Etapas visíveis
// no Kanban"). Removida na auditoria de 05/08/2026: ela só sabia das 7 etapas
// da constante DEFAULT_PIPELINE_STAGES, mas as etapas do Funil viraram
// configuráveis dentro do próprio Kanban — então etapa criada pelo usuário
// nunca entrava na lista e era filtrada pra fora do board, sem aviso e sem
// como religar pela interface. Esconder coluna agora é só do editor de etapas
// do Kanban: uma fonte de verdade, não duas.
function merge(stored) {
  return { ...DEFAULT_USER_SETTINGS, ...(stored || {}) };
}

export function useUserSettings() {
  const [raw, setRaw] = usePersistentState(
    STORAGE_KEYS.userSettings,
    DEFAULT_USER_SETTINGS,
  );
  const settings = useMemo(() => merge(raw), [raw]);

  const update = useCallback((patch) => {
    setRaw(prev => ({ ...merge(prev), ...patch }));
  }, [setRaw]);

  const reset = useCallback(() => setRaw(DEFAULT_USER_SETTINGS), [setRaw]);

  return { settings, update, reset };
}
