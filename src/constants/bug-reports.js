// Prioridade de report de bug — linguagem pensada pra quem reporta (qualquer
// pessoa da plataforma, não só dev), não os rótulos técnicos baixa/média/alta
// usados em outros domínios (Entregas, Compras). Mesma ideia do mockup
// aprovado 17/08/2026 (Central de Bugs): "Atrapalha o trabalho"/"Incômodo",
// nunca "Alta"/"Baixa" puro.
export const BUG_PRIORITIES = [
  { id: "baixa", label: "Detalhe, sem pressa",              pill: "Leve",  color: "#64748B" },
  { id: "media", label: "Incomoda, mas dá pra contornar",   pill: "Médio",  color: "#B4790A" },
  { id: "alta",  label: "Atrapalha o trabalho",             pill: "Alto", color: "#CC2936" },
];

export function bugPriorityMeta(id) {
  return BUG_PRIORITIES.find(p => p.id === id) || BUG_PRIORITIES[1];
}
