import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";

export const BOTTOM_NAV_MAX_SHORTCUTS = 4;

// Mesmo padrão de use-dashboard-widget-prefs.js — mapa por userId,
// localStorage, sem tabela nova (docs/design-spec-atalhos-barra-inferior.md).
// Sem entrada pro usuário = usa o default de hoje (getRoleTabs em
// MobileBottomNav.jsx) — ninguém é afetado até customizar.
export function useBottomNavPrefs(userId) {
  const [prefsMap, setPrefsMap] = usePersistentState(STORAGE_KEYS.bottomNavPrefs, {});

  const selectedIds = (userId && prefsMap[userId]) || null;

  const setSelectedIds = (ids) => {
    if (!userId) return;
    setPrefsMap(m => ({ ...m, [userId]: (ids || []).slice(0, BOTTOM_NAV_MAX_SHORTCUTS) }));
  };

  return { selectedIds, setSelectedIds };
}

export default useBottomNavPrefs;
