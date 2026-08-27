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

// Chave sintética da etiqueta como ORIGEM de condição de campo (27/08/2026,
// mockup "Etiquetas que puxam campos", aprovado pelo Daniel). Não é coluna
// nem campo de verdade: o drawer injeta as etiquetas da tarefa no mapa de
// valores sob esta chave (ver StageFieldsTab em PersonalTaskDetailDrawer),
// e aí o motor de condicionais que já existe (utils/field-conditions.js)
// resolve `__etiquetas contains "Compra"` sem saber que é etiqueta. Prefixo
// `__` pra nunca colidir com um fieldKey real — slugifyKey não gera chave
// começando com underline.
export const TASK_TAGS_CONDITION_KEY = "__etiquetas";

// Mapa de valores que o motor de condicionais enxerga: os campos preenchidos
// da tarefa MAIS as etiquetas sob a chave sintética acima. Único lugar que
// monta isso — o drawer (pra decidir o que mostrar/exigir) e a trava de
// transição de etapa (pra decidir o que cobrar) PRECISAM enxergar
// exatamente a mesma coisa. Com dois cálculos separados, um campo
// `requiredIf: etiqueta contém "Compra"` apareceria no formulário mas
// passaria batido pela trava — foi justamente o risco levantado na revisão
// de QA da rodada anterior.
//
// Lista separada por ", " porque o operador `contains` faz substring
// simples; o espaço evita que uma etiqueta case colada dentro da vizinha.
export function buildTaskConditionValues(task) {
  return {
    ...(task?.customFields || {}),
    [TASK_TAGS_CONDITION_KEY]: (task?.tags || []).join(", "),
  };
}

// Catálogo sugerido de fábrica. Duas dimensões de propósito (decidido com o
// Daniel 27/08/2026):
//
//   FRENTE — onde a tarefa acontece. É o que ele já usava na prática
//   (Sanwey/Resibag/Kenjinkai viraram etiqueta por conta própria). Serve pra
//   filtrar e organizar; NÃO puxa campo, porque uma tarefa de Sanwey e uma
//   de Resibag precisam exatamente do mesmo formulário.
//
//   TIPO — o que a tarefa é. Esta é a dimensão que puxa campo condicional:
//   uma "Compra" pede fornecedor/valor, uma "Reunião" pede com quem/pauta, e
//   nenhuma etapa sozinha saberia disso (por isso o formulário por etapa
//   vivia vazio). Ver TASK_TYPE_TAGS abaixo.
//
// Só semeado na 1ª vez que o usuário abre o catálogo vazio, nunca reimposto
// depois — quem já tem catálogo próprio (o caso do Daniel) não é afetado por
// mudanças aqui, e adota os tipos pelo botão "+ Tipos sugeridos" do seletor
// de etiquetas, que só acrescenta o que falta.
export const TASK_FRENTE_TAGS = ["Sanwey", "Resibag", "Kenjinkai", "Monte Mor", "Pessoal"];

export const TASK_TYPE_TAGS = [
  "Reunião", "Decisão", "Compra", "Cobrança", "Entrega", "Documento", "Viagem",
];

export const DEFAULT_TAG_CATALOG = [...TASK_FRENTE_TAGS, ...TASK_TYPE_TAGS];

export const WEEKDAY_SHORT_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
export const WEEKDAY_FULL_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const RECURRENCE_OPTIONS = [
  { id: "none",    label: "Não repete" },
  { id: "daily",   label: "Todo dia" },
  { id: "weekly",  label: "Toda semana" },
  { id: "monthly", label: "Todo mês" },
  { id: "custom",  label: "A cada X dias" },
];
