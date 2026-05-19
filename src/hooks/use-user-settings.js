import { useCallback, useMemo } from "react";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { DEFAULT_USER_SETTINGS } from "../constants/user-settings";
import { DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";
import { usePersistentState } from "./use-persistent-state";

// Shallow-merges any stored value with the defaults so new setting keys added
// in future versions don't break existing users. Also migrates
// `visibleKanbanStages` forward so newly-added pipeline stages don't end up
// hidden from users whose preference was saved before the stage existed.
function merge(stored) {
  const out = { ...DEFAULT_USER_SETTINGS, ...(stored || {}) };
  const currentIds = DEFAULT_PIPELINE_STAGES.map(s => s.id);
  const visible = Array.isArray(out.visibleKanbanStages) ? out.visibleKanbanStages : [];
  const set = new Set(visible);
  const missing = currentIds.filter(id => !set.has(id));
  if (missing.length > 0) {
    out.visibleKanbanStages = [...visible, ...missing];
  }
  return out;
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
