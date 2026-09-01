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

// `casaComTermo(termo, ...campos)` viveu aqui entre 01/09/2026 e o checkup
// do mesmo dia, sem um único chamador: nasceu junto com `semAcento` na
// extração, mas os ~15 boards que fazem a busca continuaram escrevendo o
// `.filter` na mão. Removido em vez de mantido "pra quando alguém usar" —
// utilitário sem chamador é dívida, não preparo. Se o padrão voltar a se
// repetir, é 4 linhas.

export default semAcento;
