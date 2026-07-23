// Tratamento visual único pra cards do Kanban parados numa etapa terminal
// (stage.terminal === true — "Feito e arquivado", "Desistência", "Pago" etc.:
// não tem mais interação, então lê como arquivado). Ver CLAUDE.md, regra 3
// (processo de UI/UX) — auditoria cross-board 23/07 encontrou o mesmo
// `opacity: isTerminal ? 0.6 : 1` no card inteiro copiado em Lead/Deliverable/
// Campaign/RHKanbanCard, e nenhum tratamento no card de Compras. Centraliza
// aqui pra não deixar os 5 arquivos divergirem de novo.
//
// Técnica (mesma em todo lugar, nunca o card inteiro):
//   1. fundo do card desloca de --surface pra --surface-alt;
//   2. texto principal (título) desloca de --text pra --text-dim;
//   3. só os elementos coloridos (badges de prioridade/SLA, chip de aging,
//      anel de avatar, estrela, selo de ganho/perdido) recebem esta opacity
//      reduzida — nunca o container do card, senão o fundo/borda também
//      desbotam e perde a leitura de "settled" vs. "sumindo".
export const TERMINAL_ACCENT_OPACITY = 0.6;

export function terminalCardBackground(isTerminal) {
  return isTerminal ? "var(--surface-alt)" : "var(--surface)";
}

export function terminalTextColor(isTerminal) {
  return isTerminal ? "var(--text-dim)" : "var(--text)";
}

export function terminalAccentOpacity(isTerminal) {
  return isTerminal ? TERMINAL_ACCENT_OPACITY : 1;
}
