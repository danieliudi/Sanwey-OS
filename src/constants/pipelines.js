import { NEUTRAL } from "./companies";

export const DEFAULT_PIPELINE_STAGES = Object.freeze([
  Object.freeze({ id: "prospeccao", name: "Prospecção", code: "F", color: NEUTRAL.slate, probability: 10 }),
  Object.freeze({ id: "qualificacao", name: "Qualificação", code: "E", color: "#1E4D8C", probability: 25 }),
  Object.freeze({ id: "proposta", name: "Proposta", code: "D", color: NEUTRAL.gold, probability: 50 }),
  Object.freeze({ id: "negociacao", name: "Negociação", code: "C", color: NEUTRAL.amber, probability: 75 }),
  Object.freeze({ id: "ganho", name: "Ganho", code: "A", color: NEUTRAL.success, probability: 100, terminal: true, won: true }),
  Object.freeze({ id: "perdido", name: "Perdido", code: "X", color: NEUTRAL.red, probability: 0, terminal: true, lost: true }),
]);

// Set of stage IDs considered "won" — used by history analytics.
export const WON_STAGES = new Set(
  DEFAULT_PIPELINE_STAGES.filter(s => s.won).map(s => s.id)
);

// Returns a fresh, independent clone per company so edits don't cross-mutate.
export function defaultPipelines() {
  const clone = () => DEFAULT_PIPELINE_STAGES.map(s => ({ ...s }));
  return {
    industria: clone(),
    resibag: clone(),
    montemor: clone(),
  };
}
