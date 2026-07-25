import { useEffect } from "react";
import { usePersistentState } from "./use-persistent-state";
import { useUserSettings } from "./use-user-settings";
import { STORAGE_KEYS } from "../constants/storage-keys";

const EMPTY_DASHBOARD_PREFS = { widgets: {}, zone4Title: "" };

// Migração única do mecanismo antigo (Configurações → "Widgets do Dashboard",
// settings.visibleDashboardWidgets) pros 4 StatCards do Comercial que já
// existiam — evita que quem já tinha escondido um deles veja ele reaparecer
// no dia da troca (docs/design-spec-visao-geral-grau3-zonas.md §5). Marketing
// e RH nunca tiveram esse mecanismo, não migram nada.
const LEGACY_COMERCIAL_IDS = ["leads_count", "pipeline_open", "won_value", "avg_fit"];

// Novo mecanismo de preferência de widgets por tela "Visão Geral", dedicado
// (não reaproveita `useUserSettings`, ver §0 da spec) — mapa por usuário,
// mesmo padrão de `use-screen-tips.js`/`use-changelog-notice.js`, só
// localStorage, sem coluna nova no banco.
export function useDashboardWidgetPrefs(userId, dashboard) {
  const [prefsMap, setPrefsMap] = usePersistentState(STORAGE_KEYS.dashboardWidgetPrefs, {});
  const { settings: legacySettings } = useUserSettings();

  const dashboardPrefs = (userId && prefsMap[userId]?.[dashboard]) || null;

  useEffect(() => {
    if (!userId || dashboard !== "comercial" || dashboardPrefs) return;
    const legacy = legacySettings.visibleDashboardWidgets;
    if (!Array.isArray(legacy)) return;
    const hasCustomization = LEGACY_COMERCIAL_IDS.some(id => !legacy.includes(id));
    if (!hasCustomization) return;
    const widgets = {};
    LEGACY_COMERCIAL_IDS.forEach(id => { widgets[id] = legacy.includes(id); });
    setPrefsMap(m => ({
      ...m,
      [userId]: { ...(m[userId] || {}), comercial: { widgets, zone4Title: "" } },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dashboard, dashboardPrefs, legacySettings.visibleDashboardWidgets, setPrefsMap]);

  const widgets = dashboardPrefs?.widgets || {};
  const zone4Title = dashboardPrefs?.zone4Title || "";

  // Widget sem entrada no mapa = visível por padrão — só `false` explícito esconde.
  const widgetVisible = (id) => widgets[id] !== false;

  const save = (patch) => {
    if (!userId) return;
    setPrefsMap(m => ({
      ...m,
      [userId]: {
        ...(m[userId] || {}),
        [dashboard]: { ...(m[userId]?.[dashboard] || EMPTY_DASHBOARD_PREFS), ...patch },
      },
    }));
  };

  const setZone4Title = (title) => save({ zone4Title: title });

  return { widgetVisible, toggles: widgets, zone4Title, setZone4Title, save };
}

export default useDashboardWidgetPrefs;
