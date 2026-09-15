import { CAMPOS_FATOS } from "../constants/fatos-canonicos";

// Proposta de RFP — as três classes de informação.
//
// A disciplina é do gerador em HTML que o Daniel montou, e é a melhor ideia
// dele: nem todo dado de uma proposta tem a mesma natureza, e tratar todos
// como "campo a preencher" é o que faz uma proposta afirmar o que a empresa
// não pode sustentar.
//
//   Classe 1 · fato canônico da marca. Não se digita aqui. Muda na base.
//   Classe 2 · variável desta RFP. Vem do negócio quando existe lá.
//   Classe 3 · bloqueado: sai com valor E com quem confirmou, ou não sai.
//
// A Classe 3 é a mesma mecânica do "Só sai com confirmação" do Checklist de
// Visita (constants/checklist-visita.js). As duas telas falam a mesma língua
// de propósito: é o mesmo problema — afirmação que ninguém checou indo pra
// fora com o nome da empresa em cima.

// ── Classe 2 · o que muda a cada RFP ──────────────────────────────────────
// `de` é o campo do lead que preenche sozinho. É o ganho inteiro de estar
// dentro do funil: sete destes eram redigitados a cada proposta.
export const CAMPOS_RFP = [
  { chave: "cliente",   rotulo: "Cliente / razão social do comprador", de: "company" },
  { chave: "cnpj",      rotulo: "CNPJ do comprador",                   de: "cnpj" },
  { chave: "rfp",       rotulo: "Nº da RFP / cotação" },
  { chave: "data",      rotulo: "Data da proposta", tipo: "data" },
  { chave: "contato",   rotulo: "Comprador / contato",                 de: "decisionMaker.name" },
  { chave: "validade",  rotulo: "Validade da proposta" },
  { chave: "vendedor",  rotulo: "Vendedor responsável" },
  { chave: "produto",   rotulo: "Linha / modelo ofertado",             de: "skuName" },
  { chave: "aplicacao", rotulo: "Aplicação / resíduo" },
  { chave: "qtd",       rotulo: "Quantidade (un)",  tipo: "numero",    de: "quantity" },
  { chave: "preco",     rotulo: "Preço unitário", tipo: "dinheiro",  de: "unitPrice" },
  { chave: "prazo",     rotulo: "Prazo de entrega" },
  { chave: "incoterm",  rotulo: "Incoterm / frete", tipo: "escolha",
    opcoes: ["CIF — conforme raio contratado", "FOB — planta Taboão da Serra/SP", "A definir com o comprador"] },
  { chave: "dimensao",  rotulo: "Dimensão" },
];

// ── Classe 3 · só sai com confirmação ─────────────────────────────────────
// Cada um com o MOTIVO de estar travado. O motivo é a parte que importa:
// sem ele, "pendente" vira burocracia e alguém preenche no chute pra liberar
// a geração.
export const CAMPOS_BLOQUEADOS = [
  { chave: "ncm",   rotulo: "Classificação fiscal (NCM)", quem: "Fiscal",     porque: "Não consta na base canônica." },
  { chave: "swl",   rotulo: "Capacidade de carga (SWL)",  quem: "Engenharia", porque: "Divergência entre fontes internas — confirmar por modelo." },
  { chave: "stack", rotulo: "Configuração de empilhamento", quem: "Engenharia", porque: "Sem laudo referenciado na base. Exige relatório de ensaio." },
  { chave: "gar",   rotulo: "Garantia",                   quem: "Comercial",  porque: "Sem política de garantia formalizada na base." },
  { chave: "moq",   rotulo: "Lote mínimo (MOQ)",          quem: "Comercial",  porque: "Varia por linha e por negociação." },
  { chave: "pgto",  rotulo: "Condição de pagamento",      quem: "Financeiro", porque: "Depende de análise de crédito do cliente." },
  { chave: "end",   rotulo: "Endereço operacional completo", quem: "Administrativo", porque: "A base canônica traz só município e UF." },
  { chave: "inm",   rotulo: "Registro INMETRO a citar",   quem: "Qualidade",  porque: "Códigos herdados sem validação de engenharia — não usar como prova auditável até confirmar." },
];

const porCaminho = (obj, caminho) =>
  (caminho || "").split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

const vazio = (v) => v == null || v === "" || v === "—";

// ── Itens da proposta ─────────────────────────────────────────────────────
// A linha de item mora em `proposal_line_items` (tabela, com gatilho que
// calcula o total NO BANCO), não num campo de texto — mesmo motivo de
// marketing_expense_items: histórico auditável por versão e total que
// ninguém soma na mão pra gravar.
//
// Com pelo menos uma linha preenchida, `qtd` e `preco` da Classe 2 saem de
// cena. Não é preferência de layout: o mesmo número em dois lugares, com
// duas origens diferentes, é exatamente o defeito que a regra 14 do
// CLAUDE.md descreve. Sem linha nenhuma nada muda, e as versões geradas
// antes desta mudança continuam abrindo idênticas.
export const CAMPOS_SUBSTITUIDOS_POR_ITENS = ["qtd", "preco"];

/** Linha em branco — o vendedor adicionou e ainda não digitou nada. */
export function itemVazio(it) {
  return vazio(it?.modelLabel) && vazio(it?.quantity) && vazio(it?.unitPrice);
}

/** Linha que sustenta um número: modelo, quantidade e preço, os três. */
export function itemCompleto(it) {
  return !vazio(it?.modelLabel)
    && Number(it?.quantity) > 0
    && Number(it?.unitPrice) > 0;
}

/**
 * Soma das linhas PARA EXIBIR NA TELA e no documento — nunca pra gravar.
 * O `proposals.total_value` que fica no banco é do gatilho
 * `proposal_line_items_sync_total`; esta função existe porque quem está
 * digitando preço precisa ver a soma antes de gerar a versão. Os dois
 * aparecem com rótulos diferentes, de propósito.
 */
export function somaItens(itens = []) {
  return itens.reduce(
    (t, it) => t + (Number(it?.quantity) || 0) * (Number(it?.unitPrice) || 0),
    0,
  );
}

/** O que o negócio já responde da Classe 2 — o resto o vendedor digita. */
export function rfpDoLead(lead) {
  const out = {};
  for (const c of CAMPOS_RFP) {
    if (!c.de) continue;
    const v = porCaminho(lead, c.de);
    if (!vazio(v) && !(c.tipo === "numero" && Number(v) === 0) && !(c.tipo === "dinheiro" && Number(v) === 0)) {
      out[c.chave] = v;
    }
  }
  return out;
}

/**
 * Estado da proposta: o que falta, o que está travado, e se pode sair.
 *
 * `rascunho` é sempre a última palavra — inclusive vazio, pra que dê pra
 * limpar um campo que veio do negócio sem ele voltar sozinho.
 */
export function avaliarProposta({ lead, rascunho = {}, bloqueados = {}, requisitos = [], fatos = {}, itens = [] }) {
  const doLead = rfpDoLead(lead);
  const rfp = { ...doLead, ...rascunho };

  // Linha só conta como existente depois de o vendedor digitar algo nela —
  // clicar em "Item" e não preencher não pode apagar `qtd`/`preco` da tela.
  const itensUsados = itens.filter((it) => !itemVazio(it));
  const temItens = itensUsados.length > 0;
  const itensIncompletos = itensUsados.filter((it) => !itemCompleto(it)).length;

  const faltamRfp = CAMPOS_RFP
    .filter((c) => !(temItens && CAMPOS_SUBSTITUIDOS_POR_ITENS.includes(c.chave)))
    .filter((c) => vazio(rfp[c.chave]))
    .map((c) => c.rotulo);

  // Confirmado = tem valor E tem quem confirmou. Só o valor não basta: o
  // ponto da Classe 3 é haver alguém que responda por ele.
  const confirmados = CAMPOS_BLOQUEADOS.filter((c) => {
    const b = bloqueados[c.chave];
    return b && !vazio(b.valor) && !vazio(b.quem);
  });
  const pendentes = CAMPOS_BLOQUEADOS.filter((c) => !confirmados.includes(c));

  const fatosFaltando = CAMPOS_FATOS
    .filter((c) => ["razao_social", "cnpj", "email"].includes(c.chave) && vazio(fatos[c.chave]))
    .map((c) => c.rotulo);

  const requisitosAbertos = requisitos.filter((r) => vazio(r.resposta)).length;

  const rascunhoMarcado = faltamRfp.length > 0 || pendentes.length > 0 || requisitosAbertos > 0 || itensIncompletos > 0;

  return {
    rfp,
    doLead,
    faltamRfp,
    confirmados,
    pendentes,
    requisitosAbertos,
    fatosFaltando,
    itensUsados,
    temItens,
    itensIncompletos,
    // Rótulo "Soma das linhas" na tela — ver somaItens() acima pro porquê de
    // ela conviver com o total do gatilho em vez de substituí-lo.
    somaLinhas: somaItens(itensUsados),
    // "Sai como rascunho" é diferente de "não sai". A peça sempre imprime —
    // o que muda é a marca d'água e o aviso. Travar a impressão faria o
    // vendedor voltar pro Word, que é o resultado que ninguém quer.
    rascunhoMarcado,
    pronta: !rascunhoMarcado && fatosFaltando.length === 0,
  };
}

export default avaliarProposta;
