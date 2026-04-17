// Cached Intl.NumberFormat instances — avoid re-creating on every render.
const brlFull = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});
const brlOneDecimal = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 1,
});

export function formatBRL(value) {
  if (!Number.isFinite(value)) return "R$ 0";
  return brlFull.format(value);
}

// "R$ 123k" / "R$ 1.2M" — compact display used across KPI cards.
export function formatBRLCompact(value, { decimals = 0 } = {}) {
  if (!Number.isFinite(value)) return "R$ 0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(decimals === 0 ? 2 : decimals)}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(decimals)}k`;
  return brlFull.format(value);
}

export function formatK(value, decimals = 0) {
  if (!Number.isFinite(value)) return "R$ 0";
  return `R$ ${(value / 1000).toFixed(decimals)}k`;
}

export function formatM(value, decimals = 2) {
  if (!Number.isFinite(value)) return "R$ 0";
  return `R$ ${(value / 1_000_000).toFixed(decimals)}M`;
}
