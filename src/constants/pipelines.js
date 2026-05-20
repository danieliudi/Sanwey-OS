import { NEUTRAL } from "./companies";

// Pipeline padrão Sanwey — 7 etapas conforme planilha comercial oficial.
// Cores espelham o quadro de etapas: F (laranja terra) → E (vermelho) →
// D (amarelo) → C (verde) → B (azul claro) → A (azul marinho) → Perdido.
// slaDays = dias máximos esperados na etapa antes de virar "parado".
//          Etapas terminais (ganho/perdido) não têm SLA.
export const DEFAULT_PIPELINE_STAGES = Object.freeze([
  Object.freeze({ id: "prospeccao",   name: "Prospecção",            code: "F", color: "#B45309", probability: 10,  slaDays: 7  }),
  Object.freeze({ id: "qualificacao", name: "Qualificação",          code: "E", color: "#DC2626", probability: 25,  slaDays: 7  }),
  Object.freeze({ id: "visitas",      name: "Visitas/Apresentação",  code: "D", color: "#EAB308", probability: 40,  slaDays: 14 }),
  Object.freeze({ id: "amostras",     name: "Amostras/Maturação",    code: "C", color: "#16A34A", probability: 60,  slaDays: 21 }),
  Object.freeze({ id: "negociacao",   name: "Negociação",            code: "B", color: "#3B82F6", probability: 80,  slaDays: 14 }),
  Object.freeze({ id: "ganho",        name: "Negócio Fechado",       code: "A", color: "#1E3A8A", probability: 100, terminal: true, won: true  }),
  Object.freeze({ id: "perdido",      name: "Perdido",               code: "X", color: NEUTRAL.red, probability: 0, terminal: true, lost: true }),
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
