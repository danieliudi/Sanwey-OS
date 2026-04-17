import { useCallback, useMemo } from "react";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { DEFAULT_USER_SETTINGS } from "../constants/user-settings";
import { usePersistentState } from "./use-persistent-state";

// Shallow-merges any stored value with the defaults so new setting keys added
// in future versions don't break existing users.
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
