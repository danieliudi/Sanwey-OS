import { PESOS, FAIXAS, SECOES, LIMIAR_ALTO_VOLUME_BAGS, DESTINO } from "../constants/checklist-visita";

// Score comercial da visita — soma, não modelo.
//
// REGRA 14 — de onde vem cada número:
//   Os 9 pesos e as 3 faixas são os da folha impressa "Checklist Comercial de
//   Vendas — Sanwey" (constants/checklist-visita.js), transcritos sem ajuste.
//   Nada aqui é estimado, projetado ou aprendido de histórico.
//
// Cada item é DERIVADO de um campo coletado, nunca de uma caixa marcada à mão.
// O motivo é prático: marcar "decisor identificado" sem ter o nome do decisor
// é como um score de priorização de carteira vira ficção — e é justamente o
// tipo de número que sobe pra diretoria.
//
// `score_comercial` é coluna própria e NÃO reaproveita `leads.fit_score`: são
// duas coisas diferentes (fit_score é potencial de perfil; este é completude e
// qualidade da qualificação em visita). Misturar os dois já mordeu esta
// plataforma noutro lugar — o anel de progresso do Onboarding mostrava o
// tooltip de Fit score do Funil, achado em 14/09/2026.

const temTexto = (v) => typeof v === "string" && v.trim().length > 0;
const temValor = (v) => v != null && v !== "" && !(typeof v === "object" && Object.keys(v).length === 0);
const numero   = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Como cada item do score se prova a partir do que foi coletado.
// Devolve true (marcado), false (falta) ou null (não avaliável hoje — sai da
// conta dos dois lados).
const PROVA = {
  alto_volume: (d) => {
    const v = numero(d.volume_mensal_bags);
    if (LIMIAR_ALTO_VOLUME_BAGS == null) return null;  // ver a constante
    if (v == null) return false;
    return v >= LIMIAR_ALTO_VOLUME_BAGS;
  },
  necessidade:      (d) => temTexto(d.necessidade_principal),
  target:           (d) => temValor(d.target_cliente_bag) || temValor(d.preco_atual_bag),
  decisor:          (d) => temTexto(d.decisor) || temValor(d.decision_maker),
  concorrente:      (d) => temTexto(d.concorrente_principal) || temTexto(d.fornecedor_atual),
  abertura:         (d) => d.postura_troca === "Aberto à troca",
  produto_adequado: (d) => temTexto(d.produto),
  prazo:            (d) => temValor(d.prazo_decisao),
  proxima_acao:     (d) => temValor(d.data_proximo_contato) && temValor(d.proxima_acao),
};

/**
 * Achata o lead num objeto plano de respostas, juntando as três origens
 * (coluna do lead, custom_fields e dado do cliente) — o resto do arquivo não
 * precisa saber de onde cada uma veio.
 */
export function respostasDoLead(lead) {
  const d = { ...(lead?.customFields || lead?.custom_fields || {}) };
  SECOES.forEach((s) => s.campos.forEach((c) => {
    if (c.destino !== DESTINO.COLUNA) return;
    const bruto = lead?.[c.coluna] ?? lead?.[camel(c.coluna)];
    if (bruto != null && bruto !== "") d[c.chave] = bruto;
  }));
  return d;
}

function camel(s) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }

/**
 * O score, a faixa, e o que falta — tudo de uma vez.
 *
 * `possivel` existe por causa da regra 14: quando um item não é avaliável (o
 * limiar de alto volume não está configurado), ele sai do numerador E do
 * denominador. A tela mostra "45 de 80", nunca "45 de 100" com um item que
 * nunca poderia somar.
 */
export function avaliarChecklist(lead) {
  const d = respostasDoLead(lead);

  let total = 0, possivel = 0;
  const marcados = [], faltantes = [], naoAvaliaveis = [];

  for (const item of PESOS) {
    const prova = PROVA[item.id];
    const r = prova ? prova(d) : false;
    if (r === null) { naoAvaliaveis.push(item); continue; }
    possivel += item.peso;
    if (r) { total += item.peso; marcados.push(item); }
    else   { faltantes.push(item); }
  }

  // A faixa é lida contra o POSSÍVEL, não contra 100 fixo — senão um item
  // fora da conta rebaixaria todo mundo de faixa sem ninguém ter feito nada
  // pior. Com tudo avaliável, possivel = 100 e a conta é a da folha impressa.
  const pct = possivel > 0 ? Math.round((total / possivel) * 100) : 0;
  const faixa = FAIXAS.find((f) => pct >= f.min && pct <= f.max) || FAIXAS[FAIXAS.length - 1];

  return {
    total, possivel, pct, faixa,
    marcados,
    // Ordenado por peso: a pergunta que mais move o score aparece primeiro.
    // É esta lista que vira o bloco "Falta perguntar" na tela do vendedor.
    faltantes: [...faltantes].sort((a, b) => b.peso - a.peso),
    naoAvaliaveis,
    pontosEmAberto: faltantes.reduce((s, i) => s + i.peso, 0),
  };
}

/**
 * Quanto de cada seção já foi respondido — alimenta o índice das 9 seções.
 * A seção 8 (score) não tem campo: reporta a completude do próprio score.
 */
export function completudeDasSecoes(lead, avaliacao) {
  const d = respostasDoLead(lead);
  return SECOES.map((s) => {
    if (s.calculada) {
      return { id: s.id, numero: s.numero, nome: s.nome, calculada: true,
               preenchidos: avaliacao.marcados.length, total: PESOS.length - avaliacao.naoAvaliaveis.length };
    }
    const preenchidos = s.campos.filter((c) => temValor(d[c.chave])).length;
    return { id: s.id, numero: s.numero, nome: s.nome, preenchidos, total: s.campos.length };
  });
}

export default avaliarChecklist;
