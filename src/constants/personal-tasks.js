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
//
// CORREÇÃO 12/08/2026: aquele ajuste RENOMEOU a etapa final em vez de
// acrescentar a Arquivar como quarta, então o padrão ficou sem "Concluído" e
// a última coluna passou a fazer dois papéis — terminar a tarefa e tirá-la
// da frente, que são momentos diferentes. Agora são quatro, e Arquivar volta
// a ser a 4ª, como era a intenção original.
//
// As DUAS finais são `terminal`. O flag não significa "última coluna": é o
// que marca a tarefa como concluída pro motor de dependências (ver
// use-personal-task-dependencies.js). Uma tarefa que chega em "Concluído"
// precisa destravar quem depende dela na hora — esperar o arquivamento
// deixaria o dependente bloqueado por uma tarefa que já acabou.
export const STATUS_COLUMNS = [
  { id: "a_fazer",   name: "A Fazer",   color: "#64748B" },
  { id: "fazendo",   name: "Fazendo",   color: "#D97706" },
  { id: "concluido", name: "Concluído", color: "#16A34A", terminal: true },
  // Cinza de propósito: arquivar é guardar, não é a vitória — o verde fica
  // com "Concluído", que é onde a tarefa de fato termina.
  { id: "feito",     name: "Arquivar",  color: "#64748B", terminal: true },
];

// "Essa tarefa está concluída?" — único lugar que responde essa pergunta.
// Achado 26/08/2026: antes desta função, ~7 arquivos checavam
// `status === "feito"` direto, ignorando "concluido" (que o comentário
// acima já documentava como "onde a tarefa de fato termina") — uma tarefa
// em Concluído aparecia como pendente na Lista/Agenda, ainda disparava
// lembrete de prazo e não gerava a próxima ocorrência de recorrência.
export const TERMINAL_TASK_STATUSES = STATUS_COLUMNS.filter(c => c.terminal).map(c => c.id);
export function isTaskDone(status) {
  return TERMINAL_TASK_STATUSES.includes(status);
}

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
