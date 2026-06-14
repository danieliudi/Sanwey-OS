export const MARKETING_STAGES = [
  { id: "briefing",  name: "Briefing",   color: "#1D4ED8", sla: 3 },
  { id: "aprovacao", name: "Aprovação",  color: "#EA7309", sla: 5 },
  { id: "producao",  name: "Produção",   color: "#D97706", sla: 14 },
  { id: "revisao",   name: "Revisão",    color: "#7C3AED", sla: 5 },
  { id: "agendado",  name: "Agendado",   color: "#2563EB", sla: null },
  { id: "ao_vivo",   name: "Ao Vivo",    color: "#16A34A", sla: null },
  { id: "analise",   name: "Análise",    color: "#475569", sla: 7 },
  { id: "encerrado", name: "Encerrado",  color: "#9CA3AF", sla: null, terminal: true },
];

export const DELIVERABLE_STAGES = [
  { id: "solicitacao", name: "Solicitação",  color: "#6366F1", sla: null },
  { id: "em_producao", name: "Em Produção",  color: "#D97706", sla: 7 },
  { id: "revisao",     name: "Revisão",      color: "#7C3AED", sla: 3 },
  { id: "entregue",    name: "Entregue",     color: "#16A34A", sla: null, terminal: true },
];

export const DELIVERABLE_DEPARTMENTS = [
  "Vendas", "Marketing", "Operações", "Financeiro", "RH", "TI", "Diretoria", "Outro",
];

export const DELIVERABLE_PRIORITIES = [
  { id: "baixa", label: "Baixa", color: "#16A34A" },
  { id: "media", label: "Média", color: "#D97706" },
  { id: "alta",  label: "Alta",  color: "#DC2626" },
];

export const DELIVERABLE_REQUEST_TYPES = [
  "Design", "Vídeo", "Copywriting", "Social Media", "Email Marketing",
  "Apresentação", "Landing Page", "Outro",
];

export const EXPENSE_CATEGORIES = [
  "Mídia Paga", "Produção", "Agência", "Ferramentas", "Eventos", "Outros",
];

export const MARKETING_CHANNELS = [
  "Email", "Social", "Conteúdo", "Digital", "Outdoor", "Evento",
];

export const MARKETING_KPIS = [
  "Alcance", "Conversões", "Leads", "Awareness", "Engajamento", "ROI",
];

export const CHANNEL_COLORS = {
  "Email":     { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "Social":    { bg: "#FDF4FF", text: "#7C3AED", border: "#E9D5FF" },
  "Conteúdo":  { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "Digital":   { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Outdoor":   { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  "Evento":    { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3" },
};

export const MARKETING_ROLE_LABELS = {
  marketing:         "Marketing",
  gerente_marketing: "Gerente de Marketing",
  agencia:           "Agência (Visitante)",
};

export const MARKETING_AUTOMATION_TEMPLATES = [
  {
    id: "mkt-stale-producao",
    icon: "⏰",
    title: "Campanha parada em Produção",
    summary: "Notifica quando uma campanha fica 10+ dias em Produção sem avançar.",
    rule: {
      name: "Alerta · 10d parado em Produção",
      companyId: "all",
      module: "marketing",
      trigger: { type: "time_in_stage", stageId: "producao", days: 10 },
      action:  { type: "notify", message: "Campanha parada há 10 dias em Produção — verificar com equipe." },
    },
  },
  {
    id: "mkt-alto-investimento",
    icon: "💰",
    title: "Alto investimento (≥ R$ 50k)",
    summary: "Adiciona badge 'Alto Investimento' em campanhas com budget acima de R$ 50.000.",
    rule: {
      name: "Badge Alto Investimento · budget ≥ R$ 50k",
      companyId: "all",
      module: "marketing",
      trigger: { type: "field_value", field: "budget", operator: "gt", value: "50000" },
      action:  { type: "add_badge", badge: "Alto Investimento", badgeColor: "#F59E0B" },
    },
  },
  {
    id: "mkt-notify-ao-vivo",
    icon: "📣",
    title: "Campanha foi ao ar",
    summary: "Notifica a equipe quando uma campanha é movida para 'Ao Vivo'.",
    rule: {
      name: "Notificar equipe · campanha ao vivo",
      companyId: "all",
      module: "marketing",
      trigger: { type: "stage_change", toStage: "ao_vivo" },
      action:  { type: "notify", message: "Campanha entrou no ar — acompanhar performance." },
    },
  },
  {
    id: "mkt-encerrado-para-analise",
    icon: "📊",
    title: "Mover encerrado para Análise",
    summary: "Após 3 dias em 'Encerrado', move a campanha para 'Análise' automaticamente.",
    rule: {
      name: "Auto · encerrado → análise após 3 dias",
      companyId: "all",
      module: "marketing",
      trigger: { type: "time_in_stage", stageId: "encerrado", days: 3 },
      action:  { type: "move_stage", targetStage: "analise" },
    },
  },
];
