// Paleta curada do Chat interno — fixa, sem seletor de emoji "do sistema"
// (nenhum picker genérico tipo emoji-mart). 32 emojis em 4 categorias,
// decidido com o Daniel em 01/08/2026 — a lista é fechada, não editável
// pelo usuário final. Mudança de conteúdo desta lista é decisão de produto,
// não implementação livre.

export const CHAT_EMOJI_CATEGORIES = [
  {
    id: "reacoes",
    label: "Reações rápidas",
    emojis: ["👍", "👏", "🙏", "❤️", "😂", "😍", "😮", "🎉"],
  },
  {
    id: "trabalho",
    label: "Trabalho/status",
    emojis: ["✅", "❌", "⚠️", "🚀", "📅", "📎", "💰", "📈"],
  },
  {
    id: "pessoas",
    label: "Pessoas/presença",
    emojis: ["☕", "🏭", "🤝", "👋", "🥳", "💪", "🙌", "✋"],
  },
  {
    id: "simbolos",
    label: "Símbolos",
    emojis: ["🔥", "⭐", "💡", "🔔", "💯", "📌", "🕐", "✍️"],
  },
];

// Flat, pra validação/teste (deve ter 32 itens, sem duplicata).
export const CHAT_EMOJIS_FLAT = CHAT_EMOJI_CATEGORIES.flatMap(c => c.emojis);
