// Lista Pessoal — nível 1 do redesenho (ago/2026): prioridade deixa de vir
// emprestada de DELIVERABLE_PRIORITIES (marketing-pipelines.js), ganha a
// própria constante. STATUS_COLUMNS vive aqui (não só em PersonalTasksView)
// porque agora tanto o board quanto o drawer de detalhe (StageNavigator)
// precisam dos mesmos alvos de "mover para".

// Decidido com o Daniel 11/08/2026 (Opção A do mockup "Etapa Arquivar fixa"):
// a etapa final de todo Meu To-Do — chave "feito", travada contra exclusão
// no editor (ver protectedKeys em PersonalStageListManager.jsx) — nasce com
// o nome "Arquivar" pra deixar o uso pretendido claro desde o início. Quem
// já tinha customizado antes disso (ex.: renomeou pra "Concluído") não é
// afetado — isto só define o nome de largada pra quem nunca customizou.
export const STATUS_COLUMNS = [
  { id: "a_fazer", name: "A Fazer",   color: "#64748B" },
  { id: "fazendo", name: "Fazendo",   color: "#D97706" },
  { id: "feito",   name: "Arquivar",  color: "#16A34A", terminal: true },
];

export const PERSONAL_TASK_PRIORITIES = [
  { id: "baixa", label: "Baixa", color: "#16A34A" },
  { id: "media", label: "Média", color: "#D97706" },
  { id: "alta",  label: "Alta",  color: "#DC2626" },
];

// Catálogo sugerido de fábrica (decisão B do mockup "Lista Pessoal —
// ajustes pedidos", 07/08/2026): mistura termos do próprio negócio
// (fábrica/indústria de big bags, resíduos, compliance) com uso pessoal
// genérico — só semeado na 1ª vez que o usuário abre o catálogo vazio,
// nunca reimposto depois (ele pode apagar/renomear à vontade).
export const DEFAULT_TAG_CATALOG = [
  "Urgente", "Financeiro", "Reunião", "Fornecedor", "Compliance",
  "Auditoria", "Logística", "Segurança", "Cliente", "Viagem", "Pessoal",
];

export const WEEKDAY_SHORT_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
export const WEEKDAY_FULL_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const RECURRENCE_OPTIONS = [
  { id: "none",    label: "Não repete" },
  { id: "daily",   label: "Todo dia" },
  { id: "weekly",  label: "Toda semana" },
  { id: "monthly", label: "Todo mês" },
  { id: "custom",  label: "A cada X dias" },
];
