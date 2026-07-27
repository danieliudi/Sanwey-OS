// Cached Intl.NumberFormat instances — avoid re-creating on every render.
const brlFull = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});
const brlOneDecimal = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 1,
});

// PostgREST serializa colunas `numeric` como STRING (ex: "380") pra preservar
// precisão — então coagimos antes de formatar. Sem isso, formatBRL("380")
// caía no !isFinite e exibia "R$ 0" (achado da 2ª auditoria: valor de cotação
// de fornecedor sempre "R$ 0"). Number(número) é no-op, então é seguro.
export function formatBRL(value) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "R$ 0";
  return brlFull.format(n);
}

// "R$ 123k" / "R$ 1.2M" — compact display used across KPI cards.
export function formatBRLCompact(rawValue, { decimals = 0 } = {}) {
  const value = typeof rawValue === "string" ? Number(rawValue) : rawValue;
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
export function formatK(rawValue, decimals = 0) {
  const value = typeof rawValue === "string" ? Number(rawValue) : rawValue;
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

export function formatM(rawValue, decimals = 2) {
  const value = typeof rawValue === "string" ? Number(rawValue) : rawValue;
  if (!Number.isFinite(value)) return "R$ 0";
  return `R$ ${(value / 1_000_000).toFixed(decimals)}M`;
}

// ── Máscara de INPUT de moeda (pt-BR) ────────────────────────────────────────
// Ao contrário das funções acima (formatação de saída), estas alimentam um
// campo editável, devolvendo um número LIMPO pro estado (nunca o texto
// formatado — uma string "1.000.000" quebraria somas/comparações downstream).

// Digitação ao vivo (CurrencyInput): o campo se preenche sozinho, sem o
// usuário precisar apertar "." ou "," — cada dígito digitado entra pela
// direita, empurrando os 2 últimos como centavos (mesmo padrão de caixa
// eletrônico/maquininha). "123456" digitado vira 1234.56 → "1.234,56".
// Backspace remove o último dígito e desloca de volta, naturalmente.
export function maskCurrencyBR(raw) {
  if (raw == null) return { display: "", value: null };
  const digits = String(raw).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "") return { display: "", value: null };
  const cents = parseInt(digits, 10);
  const value = cents / 100;
  const display = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { display, value };
}

// Parser pra texto JÁ COMPLETO vindo de fora (célula de CSV/planilha) — aqui
// "." é separador de milhar e "," é decimal na posição em que o usuário (ou
// o Excel) escreveu, SEM deslocar dígitos como a máscara de digitação ao
// vivo acima faz (uma célula "5000" tem que continuar valendo 5000, não
// 50,00). Mantido separado de propósito — mesmo nome antigo da máscara de
// digitação foi reaproveitado pra essa function até esta correção; agora
// que os dois usos divergem, precisam de duas funções.
export function parseCurrencyBR(raw) {
  if (raw == null) return { display: "", value: null };
  let s = String(raw).replace(/[^\d,]/g, "");
  const firstComma = s.indexOf(",");
  let intPart, decPart, hasComma;
  if (firstComma === -1) {
    intPart = s; decPart = ""; hasComma = false;
  } else {
    hasComma = true;
    intPart = s.slice(0, firstComma).replace(/,/g, "");
    decPart = s.slice(firstComma + 1).replace(/,/g, "").slice(0, 2);
  }
  intPart = intPart.replace(/^0+(?=\d)/, "");
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

// Formata um valor vindo do estado/banco (number, ou string numérica "crua")
// pro texto de exibição do input — sempre com 2 casas decimais, pra bater
// com o formato oficial (R$ 1.234,56) mesmo em valores redondos.
export function formatCurrencyBRForInput(value) {
  if (value === "" || value == null) return "";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Moeda estrangeira (Comex — Landed Cost) ─────────────────────────────────
const usdFull = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Mesmo tratamento de robustez de formatBRL: PostgREST devolve `numeric` como
// string, e o campo é preenchido incrementalmente num formulário (valor pode
// ser null/undefined/NaN a qualquer momento).
export function formatUSD(value) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "US$ 0,00";
  return usdFull.format(n);
}

const currencyFormatterCache = new Map();
function genericCurrencyFormatter(code) {
  if (!currencyFormatterCache.has(code)) {
    currencyFormatterCache.set(code, new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }));
  }
  return currencyFormatterCache.get(code);
}

export function formatCurrency(value, code) {
  const currencyCode = (code || "BRL").toUpperCase();
  if (currencyCode === "USD") return formatUSD(value);
  if (currencyCode === "BRL") return formatBRL(value);
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return `${currencyCode} 0,00`;
  try {
    return genericCurrencyFormatter(currencyCode).format(n);
  } catch {
    return `${currencyCode} ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// Landed Cost = CIF (FOB + frete + seguro, na moeda estrangeira) convertido
// pra BRL via PTAX manual, mais impostos/taxas estimados já em BRL — ver
// docs/design-spec-comex.md. Pura e tolerante a inputs parciais (formulário
// sendo preenchido incrementalmente), nunca retorna NaN/undefined.
export function calculateLandedCost({ fobValue, freightValue, insuranceValue, ptaxRate, estimatedTaxesBrl, estimatedFeesBrl } = {}) {
  const fob       = Number.isFinite(Number(fobValue)) ? Number(fobValue) : 0;
  const freight   = Number.isFinite(Number(freightValue)) ? Number(freightValue) : 0;
  const insurance = Number.isFinite(Number(insuranceValue)) ? Number(insuranceValue) : 0;
  const ptax      = Number.isFinite(Number(ptaxRate)) ? Number(ptaxRate) : 0;
  const taxes     = Number.isFinite(Number(estimatedTaxesBrl)) ? Number(estimatedTaxesBrl) : 0;
  const fees      = Number.isFinite(Number(estimatedFeesBrl)) ? Number(estimatedFeesBrl) : 0;

  const cifValueForeign  = fob + freight + insurance;
  const cifValueBrl      = cifValueForeign * ptax;
  const totalTaxesFeesBrl = taxes + fees;
  const landedCostBrl    = cifValueBrl + totalTaxesFeesBrl;

  return { cifValueForeign, cifValueBrl, totalTaxesFeesBrl, landedCostBrl };
}
