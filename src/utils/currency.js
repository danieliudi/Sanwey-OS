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

// Compact pt-BR currency. Tiers:
//   < 1k          → "R$ 850"
//   1k – 999k     → "R$ 12k" (or "R$ 12,5k" when decimals > 0)
//   ≥ 1M          → "R$ 1,23M"
// Uses pt-BR separators (ponto para milhar, vírgula para decimal).
const ptBRNumber = (decimals) => new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
});
export function formatK(value, decimals = 0) {
  if (!Number.isFinite(value)) return "R$ 0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const d = decimals === 0 ? 2 : decimals;
    return `R$ ${ptBRNumber(d).format(value / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `R$ ${ptBRNumber(decimals).format(value / 1_000)}k`;
  }
  return brlFull.format(value);
}

export function formatM(value, decimals = 2) {
  if (!Number.isFinite(value)) return "R$ 0";
  return `R$ ${(value / 1_000_000).toFixed(decimals)}M`;
}

// ── Máscara de INPUT de moeda (pt-BR) ────────────────────────────────────────
// Ao contrário das funções acima (formatação de saída), estas alimentam um
// campo editável: separador de milhar "." e decimal "," conforme o usuário
// digita, devolvendo um número LIMPO pro estado (nunca o texto formatado — uma
// string "1.000.000" quebraria somas/comparações downstream).

// Recebe o texto cru que está no input e devolve { display, value }, onde
// `display` é o texto já com separador de milhar e `value` é number|null
// (null = campo vazio).
export function maskCurrencyBR(raw) {
  if (raw == null) return { display: "", value: null };
  let s = String(raw).replace(/[^\d,]/g, "");           // só dígitos e vírgula
  const firstComma = s.indexOf(",");
  let intPart, decPart, hasComma;
  if (firstComma === -1) {
    intPart = s; decPart = ""; hasComma = false;
  } else {
    hasComma = true;
    intPart = s.slice(0, firstComma).replace(/,/g, "");
    decPart = s.slice(firstComma + 1).replace(/,/g, "").slice(0, 2); // máx. 2 casas
  }
  intPart = intPart.replace(/^0+(?=\d)/, "");            // tira zeros à esquerda
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  let display = groupedInt;
  if (hasComma) display = (groupedInt || "0") + "," + decPart;

  let value;
  if (intPart === "" && !hasComma) value = null;
  else if (intPart === "") value = parseFloat("0." + (decPart || "0"));
  else value = parseFloat(intPart + "." + (decPart || "0"));
  if (Number.isNaN(value)) value = null;

  return { display, value };
}

// Formata um valor vindo do estado/banco (number, ou string numérica "crua"
// com ponto decimal como as gravadas por <input type=number>) pro texto de
// exibição pt-BR do input. Não força casas decimais.
export function formatCurrencyBRForInput(value) {
  if (value === "" || value == null) return "";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
