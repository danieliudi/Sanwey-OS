// Normalização de texto para busca livre em board/tabela.
//
// Nasceu local em EntregasView (01/09/2026) e foi copiado pra
// MarketingTarefasView na mesma rodada, com a nota "vira util compartilhada na
// 3ª ocorrência, não antes — CLAUDE.md, regra 4". O rollout do padrão de busca
// pros outros 11 boards é essa 3ª ocorrência (e a 4ª, e a 13ª), então é aqui
// que ele passa a morar.
//
// Por que normalizar: "orcamento" tem que achar "Orçamento". `normalize("NFD")`
// separa a letra do acento e o replace remove a marca diacrítica, então quem
// digita sem acento acha quem cadastrou com — e vice-versa. Sem isso, metade
// das buscas de um board em português falha silenciosamente e parece bug.
export function semAcento(v) {
  return (v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Açúcar pro caso mais comum: "este registro casa com o termo digitado?".
// Recebe o termo JÁ normalizado (normalizar uma vez por busca, não uma vez por
// registro por campo) e os campos crus do registro.
//
//   const termo = semAcento(search).trim();
//   if (termo) lista = lista.filter(r => casaComTermo(termo, r.title, r.code));
//
// Termo vazio devolve `true` de propósito: quem chama decide se pula o filtro,
// e assim uma busca em branco nunca some com a lista inteira.
export function casaComTermo(termoNormalizado, ...campos) {
  if (!termoNormalizado) return true;
  return campos.some(c => semAcento(c).includes(termoNormalizado));
}

export default semAcento;
