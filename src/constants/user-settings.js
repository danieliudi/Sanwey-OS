import { COMPANY_IDS } from "./companies";
import { DEFAULT_PIPELINE_STAGES } from "./pipelines";

export const DASHBOARD_WIDGETS = [
  { id: "leads_count", label: "Total de leads" },
  { id: "pipeline_open", label: "Venda aberta" },
  { id: "won_value", label: "Valor ganho" },
  { id: "avg_fit", label: "Fit score médio" },
];

// Painel Executivo é cross-departamento (Comercial + Marketing + RH), não uma
// tela do Comercial — cada executivo com acesso escolhe o que aparece no
// próprio painel.
// `dept` decide quem consegue ver/alternar cada widget em Configurações e no
// próprio Painel Executivo — cada gerente de departamento só mexe (e só vê)
// nos do seu setor; admin acumula todos os depts e por isso vê tudo.
export const EXECUTIVE_WIDGETS = [
  { id: "outras_marketing",  label: "Cartão Marketing",   dept: "marketing" },
  { id: "outras_rh",         label: "Cartão RH",          dept: "rh" },
  { id: "comercial_kpis",    label: "KPIs de Comercial",  dept: "comercial" },
  { id: "tab_charts",        label: "Aba Gráficos",       dept: "comercial" },
  { id: "tab_analytics",     label: "Aba Análise",        dept: "comercial" },
  { id: "tab_ia",            label: "Aba IA",             dept: "comercial" },
  { id: "tab_historico",     label: "Aba Histórico",      dept: "comercial" },
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
  {
    id: "minhas_entregas",
    label: "Minhas entregas",
    roles: ["marketing", "gerente_marketing", "admin"],
    items: [
      { id: "new_deliverable_assigned", label: "Nova entrega atribuída a mim", defaultOn: true },
      { id: "deliverable_stage_change", label: "Mudança de etapa nas minhas entregas", defaultOn: true },
      { id: "deliverable_due_soon",     label: "Entrega com prazo próximo", defaultOn: true },
    ],
  },
  {
    id: "solicitacoes_marketing",
    label: "Solicitações",
    roles: ["marketing", "gerente_marketing", "admin"],
    items: [
      { id: "new_marketing_request",    label: "Nova solicitação recebida", defaultOn: true },
      { id: "marketing_request_status", label: "Solicitação aprovada ou reprovada", defaultOn: true },
    ],
  },
  {
    id: "equipe_marketing",
    label: "Equipe de Marketing",
    roles: ["gerente_marketing", "admin"],
    items: [
      { id: "new_deliverable_team", label: "Nova entrega criada na equipe", defaultOn: false },
      { id: "despesa_pendente",     label: "Despesa aguardando aprovação", defaultOn: true },
    ],
  },
  {
    id: "meus_processos_rh",
    label: "Meus processos",
    roles: ["rh", "gerente_rh", "admin"],
    items: [
      { id: "new_candidato",          label: "Novo candidato em processo seletivo", defaultOn: true },
      { id: "candidato_stage_change", label: "Mudança de etapa de um candidato", defaultOn: true },
      { id: "solicitacao_ferias",     label: "Nova solicitação de férias", defaultOn: true },
    ],
  },
  {
    id: "compliance_rh",
    label: "Conformidade",
    roles: ["gerente_rh", "admin"],
    items: [
      { id: "aso_vencendo",           label: "ASO vencendo", defaultOn: true },
      { id: "contrato_vencendo",      label: "Contrato de experiência vencendo", defaultOn: true },
      { id: "aniversario_colaborador",label: "Aniversário de colaborador", defaultOn: false },
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
