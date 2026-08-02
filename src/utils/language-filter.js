import { CHAT_BANNED_WORDS } from "../data/chat-banned-words";

const COMBINING_MARKS_RE = /[̀-ͯ]/g;

// normaliza: minúsculo + remove acento, pra "PÊSSEGO"/"pessego" caírem no
// mesmo token que a entrada da lista.
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "");
}

// Retorna a palavra encontrada (string, como está em CHAT_BANNED_WORDS) ou
// null. Match por token inteiro (split em não-letra), não por substring —
// evita falso positivo tipo uma palavra da lista aparecer embutida dentro de
// outra palavra inocente (ex.: "classe" não deve casar com um radical curto).
export function findBannedWord(text) {
  const normalized = normalize(text);
  if (!normalized) return null;

  const tokens = new Set(normalized.split(/[^a-z]+/).filter(Boolean));

  for (const raw of CHAT_BANNED_WORDS) {
    const word = normalize(raw);
    if (!word) continue;
    if (word.includes(" ") || word.includes("-")) {
      // Frase de várias palavras: casa por fronteira de palavra inteira em
      // toda a extensão da frase, não por substring solta.
      const pattern = new RegExp(`(^|[^a-z])${word.replace(/[ -]+/g, "[^a-z]+")}($|[^a-z])`);
      if (pattern.test(normalized)) return raw;
    } else if (tokens.has(word)) {
      return raw;
    }
  }
  return null;
}
