// Lista Pessoal — nível 1 do redesenho (ago/2026): prioridade deixa de vir
// emprestada de DELIVERABLE_PRIORITIES (marketing-pipelines.js), ganha a
// própria constante. STATUS_COLUMNS vive aqui (não só em PersonalTasksView)
// porque agora tanto o board quanto o drawer de detalhe (StageNavigator)
// precisam dos mesmos alvos de "mover para".

export const STATUS_COLUMNS = [
  { id: "a_fazer", name: "A Fazer", color: "#64748B" },
  { id: "fazendo", name: "Fazendo", color: "#D97706" },
  { id: "feito",   name: "Feito",   color: "#16A34A" },
];

export const PERSONAL_TASK_PRIORITIES = [
  { id: "baixa", label: "Baixa", color: "#16A34A" },
  { id: "media", label: "Média", color: "#D97706" },
  { id: "alta",  label: "Alta",  color: "#DC2626" },
];

export const RECURRENCE_OPTIONS = [
  { id: "none",    label: "Não repete" },
  { id: "daily",   label: "Todo dia" },
  { id: "weekly",  label: "Toda semana" },
  { id: "monthly", label: "Todo mês" },
];
