// Centros de custo comerciais — Matriz São Paulo (lista gerencial 2021).
// Recorte acordado com o Daniel 09/09/2026: só time comercial; filial SC
// ficou de fora. A mesma lista alimenta Viagens & Despesas e Marketing →
// Despesas. Códigos são texto (não FK) pra bater com a planilha da Tati
// sem exigir sync contínuo com o ERP.
export const COMMERCIAL_COST_CENTERS = [
  { code: "701", label: "Gerência Comercial" },
  { code: "702", label: "Administração de Vendas" },
  { code: "711", label: "Mercado Externo" },
  { code: "721", label: "Mercado Interno — SANBAG" },
  { code: "722", label: "Mercado Interno — RESIBAG" },
];

export function costCenterLabel(code) {
  const hit = COMMERCIAL_COST_CENTERS.find(c => c.code === code);
  return hit ? `${hit.code} · ${hit.label}` : (code || "—");
}

// Cartões corporativos usados pelo time comercial. Nomes genéricos até a
// Tati/Everton mandarem a lista oficial (Visa/Master por unidade).
export const COMMERCIAL_CREDIT_CARDS = [
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
  { id: "outro", label: "Outro" },
];

export function creditCardLabel(id) {
  return COMMERCIAL_CREDIT_CARDS.find(c => c.id === id)?.label || (id || "—");
}
