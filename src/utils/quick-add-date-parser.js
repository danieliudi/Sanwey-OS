import { toLocalISODate } from "./date";

// Parsing determinístico de data/hora em PT-BR pro quick-add da Lista
// Pessoal ("Ligar fornecedor amanhã 15h") — regex sobre termos fixos, não é
// IA. Existe pra economizar o passo de abrir o seletor de data pra prazos
// comuns; qualquer coisa fora desses padrões continua exigindo o campo
// manual do formulário.
//
// \b nativo do JS só reconhece [A-Za-z0-9_] como "palavra" — falha nas
// bordas de "amanhã"/"sábado"/"às" (o "ã"/"á" vira fronteira falsa contra o
// espaço vizinho, quebrando o match). B/E abaixo refazem a fronteira de
// palavra com \p{L}/\p{N} (exige flag "u"), cobrindo acentuação.
const B = "(?<![\\p{L}\\p{N}_])";
const E = "(?![\\p{L}\\p{N}_])";

const WEEKDAYS = {
  "domingo": 0,
  "segunda-feira": 1, "segunda": 1,
  "terça-feira": 2, "terca-feira": 2, "terça": 2, "terca": 2,
  "quarta-feira": 3, "quarta": 3,
  "quinta-feira": 4, "quinta": 4,
  "sexta-feira": 5, "sexta": 5,
  "sábado": 6, "sabado": 6,
};

function pad(n) { return String(n).padStart(2, "0"); }

const toISODate = toLocalISODate;

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const CONNECTOR_RE = `(dia|em|no|na|para|pra|às|as)`;

function stripAt(text, match) {
  const before = text.slice(0, match.index)
    .replace(new RegExp(`${B}${CONNECTOR_RE}${E}\\s*$`, "iu"), "");
  const after = text.slice(match.index + match[0].length)
    .replace(new RegExp(`^\\s*${B}${CONNECTOR_RE}${E}`, "iu"), "");
  return (before + after).replace(/\s{2,}/g, " ").trim();
}

// Extrai a primeira ocorrência de horário ("15h", "15h30", "15:00", "às 9h")
// e devolve { dueTime: "HH:MM", rest: texto sem o trecho de hora }.
function extractTime(text) {
  const re = new RegExp(`${B}(?:às\\s+)?(\\d{1,2})[h:](\\d{2})?${E}`, "iu");
  const m = text.match(re);
  if (!m) return { dueTime: null, rest: text };
  const hour = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (hour > 23 || min > 59) return { dueTime: null, rest: text };
  return { dueTime: `${pad(hour)}:${pad(min)}`, rest: stripAt(text, m) };
}

// Extrai a primeira expressão de data reconhecida e devolve
// { dueDate: "YYYY-MM-DD", rest: texto sem o trecho de data }.
function extractDate(text, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let m = text.match(new RegExp(`${B}depois de amanh[ãa]${E}`, "iu"));
  if (m) return { dueDate: toISODate(addDays(today, 2)), rest: stripAt(text, m) };

  m = text.match(new RegExp(`${B}hoje${E}`, "iu"));
  if (m) return { dueDate: toISODate(today), rest: stripAt(text, m) };

  m = text.match(new RegExp(`${B}amanh[ãa]${E}`, "iu"));
  if (m) return { dueDate: toISODate(addDays(today, 1)), rest: stripAt(text, m) };

  m = text.match(new RegExp(`${B}daqui a (\\d{1,3}) dias?${E}`, "iu"));
  if (m) return { dueDate: toISODate(addDays(today, Number(m[1]))), rest: stripAt(text, m) };

  m = text.match(new RegExp(`${B}dia (\\d{1,2})${E}`, "iu"));
  if (m) {
    const day = Number(m[1]);
    if (day >= 1 && day <= 31) {
      let candidate = new Date(today.getFullYear(), today.getMonth(), day);
      if (candidate < today) candidate = new Date(today.getFullYear(), today.getMonth() + 1, day);
      return { dueDate: toISODate(candidate), rest: stripAt(text, m) };
    }
  }

  const weekdayNames = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join("|");
  m = text.match(new RegExp(`${B}(?:pr[óo]xim[ao]\\s+)?(${weekdayNames})${E}`, "iu"));
  if (m) {
    const targetDow = WEEKDAYS[m[1].toLowerCase()];
    const offset = (targetDow - today.getDay() + 7) % 7;
    return { dueDate: toISODate(addDays(today, offset)), rest: stripAt(text, m) };
  }

  return { dueDate: null, rest: text };
}

// parseQuickAddText("Ligar fornecedor amanhã 15h") →
//   { title: "Ligar fornecedor", dueDate: "2026-08-08", dueTime: "15:00" }
// Sem nenhum termo reconhecido, devolve o texto original em `title` e nulls.
export function parseQuickAddText(text, now = new Date()) {
  const original = (text || "").trim();
  if (!original) return { title: "", dueDate: null, dueTime: null };

  const { dueTime, rest: afterTime } = extractTime(original);
  const { dueDate, rest: afterDate } = extractDate(afterTime, now);

  const title = afterDate.replace(/\s{2,}/g, " ").trim() || original;
  return { title, dueDate, dueTime };
}

export default parseQuickAddText;
