// Templates prontos de automação. Carregados no AutomationBuilder via
// initialRule pra usuário só revisar e salvar — não precisa entender
// trigger/condição/action do zero.
//
// IDs de etapa precisam existir em DEFAULT_PIPELINE_STAGES.

export const AUTOMATION_TEMPLATES = [
  {
    id: "stale-negociacao",
    icon: "🚨",
    title: "Lead parado em Negociação",
    summary: "Notifica quando um card fica mais de 7 dias em Negociação sem avançar.",
    rule: {
      name: "Alerta · 7d parado em Negociação",
      companyId: "all",
      trigger: { type: "time_in_stage", stageId: "negociacao", days: 7 },
      action:  { type: "notify", message: "Lead parado há 7 dias em Negociação — revisar abordagem." },
    },
  },
  {
    id: "priority-on-negotiation",
    icon: "📈",
    title: "Subiu para Negociação",
    summary: "Marca como alta prioridade ao entrar em Negociação.",
    rule: {
      name: "Prioridade alta ao entrar em Negociação",
      companyId: "all",
      trigger: { type: "stage_change", fromStage: "", toStage: "negociacao" },
      action:  { type: "set_field", field: "priority", value: "alta" },
    },
  },
  {
    id: "vip-high-value",
    icon: "💰",
    title: "Lead de alto valor (≥ R$ 50k)",
    summary: "Adiciona badge VIP automático em leads com valor acima de R$ 50.000.",
    rule: {
      name: "Badge VIP · valor ≥ R$ 50k",
      companyId: "all",
      trigger: { type: "field_value", field: "value", operator: "gt", value: "50000" },
      action:  { type: "add_badge", badge: { label: "VIP", color: "#F59E0B" } },
    },
  },
  {
    id: "downgrade-stuck-visitas",
    icon: "↩️",
    title: "Devolve à Qualificação se travar em Visitas",
    summary: "Após 14 dias parado em Visitas/Apresentação, volta pra Qualificação.",
    rule: {
      name: "Auto-downgrade · 14d em Visitas → Qualificação",
      companyId: "all",
      trigger: { type: "time_in_stage", stageId: "visitas", days: 14 },
      action:  { type: "move_stage", targetStage: "qualificacao" },
    },
  },
  {
    id: "notify-lost",
    icon: "❌",
    title: "Notifica quando lead é perdido",
    summary: "Alerta o gerente sempre que um card é movido pra Perdido.",
    rule: {
      name: "Alerta · lead perdido",
      companyId: "all",
      trigger: { type: "stage_change", fromStage: "", toStage: "perdido" },
      action:  { type: "notify", message: "Lead movido para Perdido — registrar motivo." },
    },
  },
  {
    id: "hot-score-promote",
    icon: "🔥",
    title: "FitScore alto vai pra Qualificação",
    summary: "Lead com FitScore acima de 80 sobe automaticamente pra Qualificação.",
    rule: {
      name: "Promover automático · FitScore > 80",
      companyId: "all",
      trigger: { type: "field_value", field: "fitScore", operator: "gt", value: "80" },
      action:  { type: "move_stage", targetStage: "qualificacao" },
    },
  },
  {
    id: "stale-prospeccao",
    icon: "⏰",
    title: "Limpar Prospecção parada",
    summary: "10 dias em Prospecção sem mover gera notificação pra revisar/descartar.",
    rule: {
      name: "Alerta · 10d em Prospecção",
      companyId: "all",
      trigger: { type: "time_in_stage", stageId: "prospeccao", days: 10 },
      action:  { type: "notify", message: "Lead há 10 dias em Prospecção — qualificar ou descartar." },
    },
  },
  {
    id: "badge-new-lead",
    icon: "🆕",
    title: "Marca leads novos",
    summary: "Adiciona badge 'Novo' em todo card recém-criado.",
    rule: {
      name: "Badge · lead novo",
      companyId: "all",
      trigger: { type: "lead_created" },
      action:  { type: "add_badge", badge: { label: "Novo", color: "#10B981" } },
    },
  },
  {
    id: "onboarding-on-won",
    icon: "🤝",
    title: "Onboarding de cliente ao ganhar negócio",
    summary: "Ao marcar um negócio como Ganho, cria automaticamente uma entrega de onboarding em Marketing.",
    rule: {
      name: "Onboarding automático · negócio ganho",
      companyId: "all",
      trigger: { type: "stage_change", fromStage: "", toStage: "ganho" },
      action:  { type: "create_deliverable", deliverableTitle: "Onboarding: {empresa}", deliverablePriority: "alta" },
    },
  },
  {
    id: "enrich-new-lead",
    icon: "🏢",
    title: "Enriquecer lead novo com CNPJ",
    summary: "Ao criar um lead, busca automaticamente setor, cidade, estado e situação pelo CNPJ.",
    rule: {
      name: "Enriquecimento automático · CNPJ",
      companyId: "all",
      trigger: { type: "lead_created" },
      action:  { type: "enrich_cnpj" },
    },
  },
];

export default AUTOMATION_TEMPLATES;
