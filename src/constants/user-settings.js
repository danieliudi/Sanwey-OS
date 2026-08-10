import { COMPANY_IDS } from "./companies";

// Painel Executivo é cross-departamento (Comercial + Marketing + RH), não uma
// tela do Comercial — cada executivo com acesso escolhe o que aparece no
// próprio painel.
// `dept` decide quem consegue ver/alternar cada widget em Configurações e no
// próprio Painel Executivo — cada gerente de departamento só mexe (e só vê)
// nos do seu setor; admin acumula todos os depts e por isso vê tudo.
export const EXECUTIVE_WIDGETS = [
  // ids mantidos (outras_marketing/outras_rh) mesmo com o label atualizado —
  // são os mesmos toggles de sempre, só que hoje controlam uma aba própria
  // em vez de um cartão-resumo (regra 8 do CLAUDE.md, 29/07/2026).
  { id: "outras_marketing",  label: "Aba Marketing",      dept: "marketing" },
  { id: "outras_rh",         label: "Aba RH",             dept: "rh" },
  { id: "comercial_kpis",    label: "KPIs de Comercial",  dept: "comercial" },
  { id: "tab_charts",        label: "Aba Gráficos",       dept: "comercial" },
  { id: "tab_analytics",     label: "Aba Análise",        dept: "comercial" },
  { id: "tab_ia",            label: "Aba IA",             dept: "comercial" },
  { id: "tab_historico",     label: "Aba Histórico",      dept: "comercial" },
  { id: "tab_comex",         label: "Aba Comex",          dept: "comex" },
  { id: "tab_posvenda",      label: "Aba Pós-venda",      dept: "comercial" },
  // ESG & Carbono segue o mesmo público de quem já vê a tela (isManager ||
  // isDiretoria) — dept "comercial" pra herdar o mesmo filtro de
  // Configurações que os outros widgets dessa mesma população já usam.
  { id: "tab_esg",           label: "Aba ESG & Carbono",  dept: "comercial" },
];

// Abas da tela de Notificações (auditoria de 05/08/2026): eram 9 blocos
// empilhados num scroll só. `area` reparte os mesmos grupos — nenhum id de
// item mudou, então preferência já salva continua valendo.
export const NOTIFICATION_AREAS = [
  { id: "comercial", label: "Comercial" },
  { id: "marketing", label: "Marketing" },
  { id: "rh",        label: "RH" },
  { id: "sistema",   label: "Sistema" },
];

export const NOTIFICATION_GROUPS = [
  {
    id: "meus_leads",
    label: "Meus leads",
    area: "comercial",
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
    area: "comercial",
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
    area: "comercial",
    roles: ["vendedor", "consultor", "gerente", "admin"],
    items: [
      { id: "cross_sell",        label: "Sugestões de cross-sell", defaultOn: true },
      { id: "automation_notify", label: "Alertas de automação nos meus leads", defaultOn: true },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    area: "comercial",
    roles: ["gerente", "admin"],
    items: [
      { id: "weekly_digest",     label: "Resumo semanal do pipeline", defaultOn: true },
    ],
  },
  {
    id: "minhas_entregas",
    label: "Minhas entregas",
    area: "marketing",
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
    area: "marketing",
    roles: ["marketing", "gerente_marketing", "admin"],
    items: [
      { id: "new_marketing_request",    label: "Nova solicitação recebida", defaultOn: true },
      { id: "marketing_request_status", label: "Solicitação aprovada ou reprovada", defaultOn: true },
    ],
  },
  {
    id: "equipe_marketing",
    label: "Equipe de Marketing",
    area: "marketing",
    roles: ["gerente_marketing", "admin"],
    items: [
      { id: "new_deliverable_team", label: "Nova entrega criada na equipe", defaultOn: false },
      { id: "despesa_pendente",     label: "Despesa aguardando aprovação", defaultOn: true },
    ],
  },
  {
    id: "meus_processos_rh",
    label: "Meus processos",
    area: "rh",
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
    area: "rh",
    roles: ["gerente_rh", "admin"],
    items: [
      { id: "aso_vencendo",           label: "ASO vencendo", defaultOn: true },
      { id: "contrato_vencendo",      label: "Contrato de experiência vencendo", defaultOn: true },
      { id: "aniversario_colaborador",label: "Aniversário de colaborador", defaultOn: false },
    ],
  },
  {
    // "Novo usuário na plataforma" saiu de "Gestão" (área Comercial) — não tem
    // nada de comercial, é evento de plataforma. Convive na aba Sistema com o
    // toggle de @menção, que fica fora deste array (vive em profiles, não em
    // settings.notifications — ver SettingsView).
    id: "plataforma",
    label: "Plataforma",
    area: "sistema",
    roles: ["gerente", "admin"],
    items: [
      { id: "new_user_joined",   label: "Novo usuário na plataforma", defaultOn: false },
    ],
  },
  {
    id: "lista_pessoal",
    label: "Meu To-do",
    area: "sistema",
    // Lista Pessoal é universal (todo usuário autenticado tem a própria,
    // ver rota "personal-tasks" em App.jsx) — união de todos os papéis da
    // plataforma (mesma lista de ROLE_OPTIONS_ADMIN em UserManagementView.jsx),
    // não só um departamento.
    roles: ["consultor", "vendedor", "gerente", "marketing", "gerente_marketing", "agencia", "rh", "gerente_rh", "diretoria", "comex", "admin"],
    items: [
      { id: "task_due_reminder", label: "Tarefa pessoal vencendo hoje", defaultOn: true },
    ],
  },
];

// Keep NOTIFICATION_PREFS as a flat list for backward compat
export const NOTIFICATION_PREFS = NOTIFICATION_GROUPS.flatMap(g => g.items);

// Mapa: `type` da notificação gerada (useNotifications/pushNotification) →
// id do toggle em Configurações > Notificações que a controla. Tipo sem
// entrada aqui não tem toggle correspondente e permanece sempre ligado.
export const NOTIFICATION_TYPE_TO_PREF = {
  followup:               "followup_reminder",
  lead_assigned:          "new_lead_assigned",
  lead_won:               "lead_won",
  lead_lost:              "lead_lost",
  automation:             "automation_notify",
  marketing_request:      "new_marketing_request",
  ferias_solicitada:      "solicitacao_ferias",
  aniversario:            "aniversario_colaborador",
  compliance_aso:         "aso_vencendo",
  compliance_experiencia: "contrato_vencendo",
  stale_lead:             "stale_lead",
  cross_sell:             "cross_sell",
  weekly_digest:          "weekly_digest",
  new_candidato:          "new_candidato",
  task_due:               "task_due_reminder",
};

// Toggles que realmente silenciam alguma coisa. O gate em use-notifications.js
// só consulta a preferência quando o TIPO emitido aparece no mapa acima —
// então um toggle que nenhum tipo aponta fica bonito na tela e não faz nada.
// Auditoria de 05/08/2026 achou 12 nessa situação; em vez de escondê-los (o
// silêncio foi justamente o que deixou passar), a tela os mostra desabilitados
// com o motivo. Derivado do mapa, nunca escrito à mão: assim que alguém ligar
// o tipo correspondente, o toggle volta a ficar ativo sozinho.
export const WIRED_NOTIFICATION_PREFS = new Set(Object.values(NOTIFICATION_TYPE_TO_PREF));

export const DEFAULT_USER_SETTINGS = {
  enabledCompanies: [...COMPANY_IDS],
  visibleExecutiveWidgets: EXECUTIVE_WIDGETS.map(w => w.id),
  notifications: NOTIFICATION_PREFS.reduce((acc, n) => {
    acc[n.id] = n.defaultOn;
    return acc;
  }, {}),
  // Lista Pessoal nasce ligada (decisão do Daniel, 04/08) — quem não
  // quiser desliga em Configurações → Preferências → Recursos. Persistência
  // pelo mesmo useUserSettings/localStorage do resto, sem tabela própria.
  personalTasksEnabled: true,
};
