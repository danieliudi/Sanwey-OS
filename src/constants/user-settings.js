import { COMPANY_IDS } from "./companies";
import { DEFAULT_PIPELINE_STAGES } from "./pipelines";

export const DASHBOARD_WIDGETS = [
  { id: "leads_count", label: "Total de leads" },
  { id: "pipeline_open", label: "Pipeline aberto" },
  { id: "won_value", label: "Valor ganho" },
  { id: "avg_fit", label: "Fit score médio" },
];

export const NOTIFICATION_PREFS = [
  { id: "new_lead", label: "Novos leads" },
  { id: "stage_change", label: "Mudança de etapa" },
  { id: "stale_lead", label: "Leads parados há 14+ dias" },
  { id: "cross_sell", label: "Sugestões de cross-sell" },
];

export const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Confortável" },
  { value: "compact", label: "Compacto" },
];

// Default: Sanwey Comercial disabled until ready. User can toggle in Settings.
export const DEFAULT_USER_SETTINGS = {
  enabledCompanies: COMPANY_IDS.filter(id => id !== "comercial"),
  visibleDashboardWidgets: DASHBOARD_WIDGETS.map(w => w.id),
  visibleKanbanStages: DEFAULT_PIPELINE_STAGES.map(s => s.id),
  notifications: NOTIFICATION_PREFS.reduce((acc, n) => {
    acc[n.id] = true;
    return acc;
  }, {}),
  density: "comfortable",
};
