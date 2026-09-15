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
export function avaliarProposta({ lead, rascunho = {}, bloqueados = {}, requisitos = [], fatos = {} }) {
  const doLead = rfpDoLead(lead);
  const rfp = { ...doLead, ...rascunho };

  const faltamRfp = CAMPOS_RFP
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

  const rascunhoMarcado = faltamRfp.length > 0 || pendentes.length > 0 || requisitosAbertos > 0;

  return {
    rfp,
    doLead,
    faltamRfp,
    confirmados,
    pendentes,
    requisitosAbertos,
    fatosFaltando,
    // "Sai como rascunho" é diferente de "não sai". A peça sempre imprime —
    // o que muda é a marca d'água e o aviso. Travar a impressão faria o
    // vendedor voltar pro Word, que é o resultado que ninguém quer.
    rascunhoMarcado,
    pronta: !rascunhoMarcado && fatosFaltando.length === 0,
  };
}

export default avaliarProposta;
