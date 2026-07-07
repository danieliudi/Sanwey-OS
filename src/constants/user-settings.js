import { COMPANY_IDS } from "./companies";
import { DEFAULT_PIPELINE_STAGES } from "./pipelines";

export const DASHBOARD_WIDGETS = [
  { id: "leads_count", label: "Total de leads" },
  { id: "pipeline_open", label: "Pipeline aberto" },
  { id: "won_value", label: "Valor ganho" },
  { id: "avg_fit", label: "Fit score médio" },
];

// Painel Executivo é cross-departamento (Comercial + Marketing + RH), não uma
// tela do Comercial — cada executivo com acesso escolhe o que aparece no
// próprio painel.
export const EXECUTIVE_WIDGETS = [
  { id: "outras_marketing",  label: "Cartão Marketing (outras áreas)" },
  { id: "outras_rh",         label: "Cartão RH (outras áreas)" },
  { id: "comercial_kpis",    label: "KPIs de Comercial" },
  { id: "tab_charts",        label: "Aba Gráficos" },
  { id: "tab_analytics",     label: "Aba Análise" },
  { id: "tab_ia",            label: "Aba IA" },
  { id: "tab_historico",     label: "Aba Histórico" },
];

export const NOTIFICATION_GROUPS = [
  {
    id: "meus_leads",
    label: "Meus leads",
    roles: ["consultor", "vendedor", "gerente", "admin"],
    items: [
      { id: "new_lead_assigned", label: "Novo lead atribuído a mim", defaultOn: true },
      { id: "stage_change",      label: "Mudança de etapa nos meus leads", defaultOn: true },
      { id: "stale_lead",        label: "Lead parado há 14+ dias", defaultOn: true },
      { id: "followup_reminder", label: "Lembrete de follow-up", defaultOn: true },
    ],
  },
  {
    id: "equipe",
    label: "Equipe",
    roles: ["gerente", "admin"],
    items: [
      { id: "new_lead_team",     label: "Novo lead criado na equipe", defaultOn: true },
      { id: "lead_won",          label: "Lead ganho por qualquer membro", defaultOn: true },
      { id: "lead_lost",         label: "Lead perdido", defaultOn: true },
      { id: "stale_lead_team",   label: "Lead parado na equipe", defaultOn: false },
      { id: "followup_team",     label: "Follow-ups vencidos na equipe", defaultOn: false },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    roles: ["vendedor", "consultor", "gerente", "admin"],
    items: [
      { id: "cross_sell",        label: "Sugestões de cross-sell", defaultOn: true },
      { id: "automation_notify", label: "Alertas de automação nos meus leads", defaultOn: true },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    roles: ["gerente", "admin"],
    items: [
      { id: "weekly_digest",     label: "Resumo semanal do pipeline", defaultOn: true },
      { id: "new_user_joined",   label: "Novo usuário na plataforma", defaultOn: false },
    ],
  },
];

// Keep NOTIFICATION_PREFS as a flat list for backward compat
export const NOTIFICATION_PREFS = NOTIFICATION_GROUPS.flatMap(g => g.items);

export const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Confortável" },
  { value: "compact", label: "Compacto" },
];

export const DEFAULT_USER_SETTINGS = {
  enabledCompanies: [...COMPANY_IDS],
  visibleDashboardWidgets: DASHBOARD_WIDGETS.map(w => w.id),
  visibleExecutiveWidgets: EXECUTIVE_WIDGETS.map(w => w.id),
  visibleKanbanStages: DEFAULT_PIPELINE_STAGES.map(s => s.id),
  notifications: NOTIFICATION_PREFS.reduce((acc, n) => {
    acc[n.id] = n.defaultOn;
    return acc;
  }, {}),
  density: "comfortable",
};
