// Referência de gasto por contexto — único lugar que decide se uma despesa
// está dentro ou fora do esperado, e por quê.
//
// Existe por causa da dor que o Daniel descreveu em 14/09/2026: o Zoho diz
// que estourou e não diz nada além disso, então o gestor abre comprovante por
// comprovante para descobrir qual excesso é abuso e qual é logística de rota.
// O que resolve não é mais campo — é o excedente chegar CLASSIFICADO.
//
// VOCABULÁRIO É DA EMPRESA, NÃO MEU: "Capital" e "Interior" vêm das
// categorias que já existem no Zoho da Sanwey ("Hospedagem (Capital)" e
// "Hospedagem (Interior)", mesmo código contábil 435). Eu tinha proposto
// "cidade / rodovia"; eles já tinham resolvido isso à mão antes.
//
// REGRA 14 — de onde vem cada número:
//   valor       → crm_viagem_despesas.valor
//   contexto    → crm_viagem_despesas.contexto, PERGUNTADO ao vendedor
//   referência  → crm_viagem_categorias.referencia_capital / _interior
// Nada aqui é inferido de destino, coordenada ou horário: inferir erra em
// silêncio, e aqui o erro vira conversa sobre dinheiro.
//
// NÃO CALCULA DESCONTO, de propósito. O Daniel decidiu "bom senso" — o
// sistema separa, mostra e registra; quem decide é gente. Se um dia virar
// desconto, o número já está separado e é só ligar.

export const CONTEXTOS = [
  { id: "capital",  label: "Capital",  descricao: "Centro urbano" },
  { id: "interior", label: "Interior", descricao: "Estrada, rodovia, interior" },
];

export function contextoLabel(id) {
  return CONTEXTOS.find(c => c.id === id)?.label || null;
}

// Acima de quanto o excedente deixa de ser "esperado para a rota" e passa a
// ser "acima de qualquer referência". 1.5 = meio a mais que a referência do
// contexto. É um limiar de CLASSIFICAÇÃO, não de política: não bloqueia nada,
// só decide a cor e o texto que o gestor lê.
export const FATOR_ACIMA_DE_TUDO = 1.5;

/**
 * Compara uma despesa com a referência da categoria dela.
 * Devolve null quando não há nada a dizer — categoria sem referência
 * cadastrada não inventa alerta.
 */
export function avaliarDespesa(despesa, categoria) {
  if (!despesa || !categoria) return null;
  const valor = Number(despesa.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;

  // Sem contexto informado (toda despesa anterior a 14/09/2026, e qualquer
  // uma em que o vendedor não respondeu) cai na referência de Capital, que é
  // a mais apertada — e a tela DIZ que usou essa, pra ninguém achar que o
  // sistema sabia de onde veio o gasto.
  const contexto = despesa.contexto === "interior" ? "interior" : "capital";
  const assumido = !despesa.contexto;

  const bruta = contexto === "interior"
    ? categoria.referenciaInterior ?? categoria.referenciaCapital
    : categoria.referenciaCapital;
  const referencia = Number(bruta);
  if (!Number.isFinite(referencia) || referencia <= 0) return null;

  const excedente = valor - referencia;
  if (excedente <= 0) {
    return {
      status: "dentro",
      contexto, assumido, referencia, excedente: 0, fator: valor / referencia,
      resumo: `Dentro da referência de ${contextoLabel(contexto)}`,
    };
  }

  const fator = valor / referencia;
  const acimaDeTudo = fator >= FATOR_ACIMA_DE_TUDO;
  return {
    status: acimaDeTudo ? "acima_de_tudo" : "excedente_justificavel",
    contexto, assumido, referencia, excedente, fator,
    resumo: acimaDeTudo
      ? `${fator.toFixed(1)}× a referência de ${contextoLabel(contexto)}`
      : `Acima da referência de ${contextoLabel(contexto)}`,
  };
}

/**
 * Soma do mês, separando o que a rota justifica do que não justifica.
 * É este par de números que substitui "abrir comprovante por comprovante":
 * o segundo é o que vira conversa.
 */
export function somarExcedentes(despesas, categoriaPorNome) {
  let justificavel = 0;
  let acimaDeTudo = 0;
  let semReferencia = 0;
  let semCategoria = 0;
  for (const d of despesas || []) {
    const categoria = categoriaPorNome?.get?.(d.categoria);
    // Duas causas DIFERENTES de ficar de fora, contadas separado: a categoria
    // não existe mais no cadastro, ou existe e ninguém definiu referência. O
    // QA pegou isto somado num contador só, com a tela afirmando a segunda
    // causa pros dois casos — número sem denominador honesto não sustenta
    // decisão (regra 14), e um rótulo errado é pior que nenhum.
    if (!categoria) { semCategoria += 1; continue; }
    const avaliacao = avaliarDespesa(d, categoria);
    if (!avaliacao) { semReferencia += 1; continue; }
    if (avaliacao.status === "excedente_justificavel") justificavel += avaliacao.excedente;
    else if (avaliacao.status === "acima_de_tudo") acimaDeTudo += avaliacao.excedente;
  }
  return { justificavel, acimaDeTudo, semReferencia, semCategoria };
}
