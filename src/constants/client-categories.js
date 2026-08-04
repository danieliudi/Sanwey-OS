// Categorias de cliente usadas no cadastro central e no seletor do Funil de Vendas.
// `color` é usado para o chip/tag tanto na tabela de Configurações quanto no
// mini-card do drawer.

export const CLIENT_CATEGORIES = [
  { value: "posto",      label: "Posto",      color: "#1A6E35" },
  { value: "condominio", label: "Condomínio", color: "#1D4ED8" },
  { value: "industria",  label: "Indústria",  color: "#CC2936" },
  { value: "comercio",   label: "Comércio",   color: "#E8920A" },
  { value: "transporte", label: "Transporte", color: "#7C3AED" },
  { value: "outro",      label: "Outro",      color: "#6B7280" },
];

export const CLIENT_CATEGORY_MAP = Object.fromEntries(
  CLIENT_CATEGORIES.map(c => [c.value, c])
);

export function clientCategoryLabel(value) {
  return CLIENT_CATEGORY_MAP[value]?.label || value || "—";
}

export function clientCategoryColor(value) {
  return CLIENT_CATEGORY_MAP[value]?.color || "#6B7280";
}
