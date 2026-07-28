// Ordenação de cards dentro de uma coluna do Kanban (item 6, 28/07/2026) —
// antes não existia nenhum controle: toda coluna vinha na ordem que o hook
// já carregava (`created_at desc`), sem opção de trocar. Client-side, sem
// schema novo — nenhum registro tem campo position/order/sortIndex.
//
// `getters` é fornecido por quem chama, já que o nome do campo varia por
// domínio (lead.closeDate vs deliverable.deadline vs purchase.dueDate,
// lead.value vs deliverable sem valor, lead.company vs campaign.name...).
// Getter ausente = critério cai de volta pro "recent" pra aquele domínio.
export const SORT_OPTIONS = [
  { value: "recent", label: "Mais recente" },
  { value: "deadline", label: "Prazo mais próximo" },
  { value: "value", label: "Valor (maior primeiro)" },
  { value: "alpha", label: "Alfabética" },
];

export function sortKanbanItems(items, criteria, getters = {}) {
  if (!items?.length) return items || [];
  const { deadline, value, name, createdAt } = getters;

  if (criteria === "deadline" && deadline) {
    return [...items].sort((a, b) => {
      const da = deadline(a), db = deadline(b);
      if (!da && !db) return 0;
      if (!da) return 1;   // sem prazo vai pro fim
      if (!db) return -1;
      return new Date(da) - new Date(db);
    });
  }
  if (criteria === "value" && value) {
    return [...items].sort((a, b) => (value(b) || 0) - (value(a) || 0));
  }
  if (criteria === "alpha" && name) {
    return [...items].sort((a, b) => (name(a) || "").localeCompare(name(b) || ""));
  }
  // "recent" (default) — mesma ordem de chegada de hoje (created_at desc já
  // vem do hook); se o chamador tiver um getter explícito, honra, senão só
  // preserva a ordem recebida.
  if (createdAt) {
    return [...items].sort((a, b) => new Date(createdAt(b)) - new Date(createdAt(a)));
  }
  return items;
}
