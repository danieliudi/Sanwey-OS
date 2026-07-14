// Validação de FORMATO por campo (camada 2, além de presença/obrigatoriedade
// — ver field-conditions.js pra isso). validation_rule: jsonb | null.
//
// Tipos suportados:
//   { type: "cnpj" }                                — checksum mod 11
//   { type: "regex", pattern: string }              — testado com new RegExp(pattern)
//   { type: "range", min?: number, max?: number }    — numérico
//   { type: "not_future" } | { type: "not_past" }    — data (string YYYY-MM-DD ou ISO)
//
// Client-side apenas, de propósito — mesmo nível de maturidade do resto do
// app hoje (enforcement de obrigatoriedade também é só client-side; um
// trigger Postgres replicando regex/checksum em plpgsql seria um salto de
// complexidade desproporcional a essa camada "nice to have" de qualidade de
// dado, e inconsistente com o padrão já estabelecido).

export const EMAIL_PATTERN = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";
const PHONE_PATTERN = "^\\+?[0-9]{10,13}$";

// Presets sugeridos por field_type, usados pelo editor de campo pra pré-
// preencher uma regra sensata (o usuário pode trocar/remover depois).
export const VALIDATION_PRESETS = {
  email: { type: "regex", pattern: EMAIL_PATTERN, label: "E-mail válido" },
  phone: { type: "regex", pattern: PHONE_PATTERN, label: "Telefone (10-13 dígitos)" },
  currency: { type: "range", min: 0, label: "Valor ≥ 0" },
};

export const VALIDATION_RULE_TYPES = [
  { value: "cnpj",       label: "CNPJ válido" },
  { value: "regex",      label: "Padrão (regex)" },
  { value: "range",      label: "Intervalo numérico" },
  { value: "not_future", label: "Não pode ser data futura" },
  { value: "not_past",   label: "Não pode ser data passada" },
];

// Checksum de CNPJ (mod 11, 2 dígitos verificadores) — mesmo algoritmo
// oficial da Receita Federal.
export function isValidCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false; // todos os dígitos iguais

  const calcCheckDigit = (base) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const base12 = digits.slice(0, 12);
  const d1 = calcCheckDigit(base12);
  const d2 = calcCheckDigit(base12 + String(d1));
  return digits === base12 + String(d1) + String(d2);
}

// Retorna null (válido) ou uma mensagem de erro curta.
export function validateFieldFormat(rule, value) {
  if (!rule?.type) return null;
  const str = String(value ?? "").trim();
  if (str === "") return null; // presença é responsabilidade do required, não daqui

  switch (rule.type) {
    case "cnpj":
      return isValidCnpj(str) ? null : "CNPJ inválido";
    case "regex": {
      try {
        return new RegExp(rule.pattern).test(str) ? null : "Formato inválido";
      } catch {
        return null; // regex mal configurada não deveria travar o usuário
      }
    }
    case "range": {
      const n = parseFloat(str.replace(",", "."));
      if (Number.isNaN(n)) return "Precisa ser um número";
      if (rule.min != null && n < rule.min) return `Mínimo ${rule.min}`;
      if (rule.max != null && n > rule.max) return `Máximo ${rule.max}`;
      return null;
    }
    case "not_future": {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) return null;
      return d.getTime() > Date.now() ? "Não pode ser uma data futura" : null;
    }
    case "not_past": {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) return null;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return d.getTime() < today.getTime() ? "Não pode ser uma data passada" : null;
    }
    default:
      return null;
  }
}

// Mesmo espírito de getMissingRequiredFields (field-conditions.js): varre os
// campos VISÍVEIS e retorna os que têm valor preenchido mas em formato
// inválido — usado tanto pro feedback inline (por campo) quanto pra também
// bloquear a transição de fase junto com os obrigatórios vazios.
export function getInvalidFields(fields, valuesByKey) {
  const out = [];
  for (const f of fields || []) {
    const msg = validateFieldFormat(f.validationRule, valuesByKey?.[f.fieldKey]);
    if (msg) out.push({ ...f, validationError: msg });
  }
  return out;
}
