export const MARKETING_STAGES = [
  { id: "briefing",  name: "Briefing",   color: "#1D4ED8", sla: 3 },
  { id: "aprovacao", name: "Aprovação",  color: "#EA7309", sla: 5 },
  { id: "producao",  name: "Produção",   color: "#D97706", sla: 14 },
  { id: "revisao",   name: "Revisão",    color: "#7C3AED", sla: 5 },
  { id: "ao_vivo",   name: "Ao Vivo",    color: "#16A34A", sla: null },
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

// Quem preenche esse campo é de qualquer departamento pedindo material ao
// Marketing, não o time de Marketing em si — termos técnicos (Copywriting,
// Landing Page etc.) não eram reconhecidos por quem preenche. Trocados por
// itens concretos e de uso comum entre departamentos (pedido do Daniel,
// auditoria de UX do formulário).
export const DELIVERABLE_REQUEST_TYPES = [
  "Vídeo", "Social Media", "Email Marketing", "Apresentação",
  "Divulgação Interna", "Brinde/Merchandising",
  "Cartas", "Comunicado Interno", "Caderno", "Panfleto", "Calendário",
  "Outro",
];

// Categorias criadas AUTOMATICAMENTE pelo banco, nunca digitadas à mão. Hoje
// só "Compra de Marketing": o trigger marketing_purchase_requests_sync_expense
// grava exatamente essa string quando uma compra entra na etapa "pago".
// Precisa estar em EXPENSE_CATEGORIES (filtro/gráfico/teto por categoria
// enxergarem o dinheiro de compra paga), mas fica FORA do <select> do
// formulário — ver MANUAL_EXPENSE_CATEGORIES abaixo.
export const SYSTEM_EXPENSE_CATEGORIES = ["Compra de Marketing"];

export const EXPENSE_CATEGORIES = [
  "Mídia Paga", "Produção", "Agência", "Ferramentas", "Eventos",
  ...SYSTEM_EXPENSE_CATEGORIES,
  "Outros",
];

// O que o usuário pode escolher ao criar/editar uma despesa à mão. Criar uma
// "Compra de Marketing" manualmente duplicaria, à mão, a despesa que o trigger
// já cria sozinho a partir do board de Compras — mesmo dinheiro contado duas
// vezes contra o teto, que é justamente a classe de bug que a exclusão de
// stage='pago' do comprometido existe pra evitar.
export const MANUAL_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.filter(
  c => !SYSTEM_EXPENSE_CATEGORIES.includes(c)
);

export const MARKETING_CHANNELS = [
  "Email", "Social", "Conteúdo", "Digital", "Outdoor", "Evento",
];

export const MARKETING_KPIS = [
  "Alcance", "Conversões", "Leads", "Awareness", "Engajamento", "ROI",
];

// Antes disso, o tooltip de Performance era um texto fixo genérico
// ("combine com o KPI") sem nenhuma ligação real com o KPI escolhido — o
// campo virava puramente decorativo. Agora o critério sugerido muda de
// verdade conforme o KPI da campanha.
export const PERFORMANCE_HINT_BY_KPI = {
  "Alcance":     "0–100. Baseie-se no alcance obtido vs. a meta da campanha.",
  "Conversões":  "0–100. Baseie-se na taxa de conversão obtida vs. a meta.",
  "Leads":       "0–100. Baseie-se no volume de leads gerados vs. a meta.",
  "Awareness":   "0–100. Baseie-se em impressões/reconhecimento vs. a meta.",
  "Engajamento": "0–100. Baseie-se em curtidas, comentários e compartilhamentos vs. a meta.",
  "ROI":         "0–100. Baseie-se no retorno sobre o investimento vs. a meta.",
};
export const DEFAULT_PERFORMANCE_HINT = "0–100. Escolha um KPI acima para ver o critério sugerido pra essa nota.";

// Cada canal tinha hex fixo (sem versão dark) — virava um retângulo quase
// branco dentro de um card escuro (achado real, reportado pelo Daniel).
// Agora aponta pros tokens em index.css (com override em [data-theme="dark"]),
// mesma técnica já usada por --success/--warning/--danger/--amber.
export const CHANNEL_COLORS = {
  "Email":     { bg: "var(--channel-email-bg)",    text: "var(--channel-email-text)",    border: "var(--channel-email-border)" },
  "Social":    { bg: "var(--channel-social-bg)",   text: "var(--channel-social-text)",   border: "var(--channel-social-border)" },
  "Conteúdo":  { bg: "var(--channel-conteudo-bg)", text: "var(--channel-conteudo-text)", border: "var(--channel-conteudo-border)" },
  "Digital":   { bg: "var(--channel-digital-bg)",  text: "var(--channel-digital-text)",  border: "var(--channel-digital-border)" },
  "Outdoor":   { bg: "var(--channel-outdoor-bg)",  text: "var(--channel-outdoor-text)",  border: "var(--channel-outdoor-border)" },
  "Evento":    { bg: "var(--channel-evento-bg)",   text: "var(--channel-evento-text)",   border: "var(--channel-evento-border)" },
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
];
