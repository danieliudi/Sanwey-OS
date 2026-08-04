// Decisão 1A do mockup mobile (aprovada 02/08/2026): texto que antes usava a
// cor CRUA da etapa sobre fundo tingido claro (`${color}14`/`${color}18`)
// reprovava WCAG (pior caso 1,42:1). O fundo tingido não muda — só o texto
// passa a ser a cor da etapa misturada com var(--text). Se o Daniel trocar a
// opção depois, a mudança é só neste arquivo.
export function stageTextColor(color) {
  return `color-mix(in srgb, ${color} 55%, var(--text))`;
}

// Variante com mais contraste pra agregados/valores ao lado do título.
export function stageTextColorStrong(color) {
  return `color-mix(in srgb, ${color} 45%, var(--text))`;
}
