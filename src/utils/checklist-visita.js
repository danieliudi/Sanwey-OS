import { PESOS, FAIXAS, SECOES, CAMPO, LIMIAR_ALTO_VOLUME_BAGS, DESTINO } from "../constants/checklist-visita";

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
const temValor = (v) => {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
};
const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Como cada item do score se PROVA a partir do que foi coletado.
// true = marcado · false = coletado e não pontua · null = não avaliável hoje
// (sai do numerador E do denominador — ver LIMIAR_ALTO_VOLUME_BAGS).
const PROVA = {
  alto_volume: (d) => {
    if (LIMIAR_ALTO_VOLUME_BAGS == null) return null;  // ver a constante
    const v = numero(d.volume_mensal_bags);
    if (v == null) return false;
    return v >= LIMIAR_ALTO_VOLUME_BAGS;
  },
  necessidade:      (d) => temTexto(d.necessidade_principal),
  target:           (d) => temValor(d.target_cliente_bag) || temValor(d.preco_atual_bag),
  decisor:          (d) => temTexto(d.decisor),
  concorrente:      (d) => temTexto(d.concorrente_principal) || temTexto(d.fornecedor_atual),
  abertura:         (d) => d.postura_troca === "Aberto à troca",
  produto_adequado: (d) => temTexto(d.produto),
  prazo:            (d) => temValor(d.prazo_decisao),
  proxima_acao:     (d) => temValor(d.data_proximo_contato) && temValor(d.proxima_acao),
};

// Se a PERGUNTA já foi feita — que não é a mesma coisa que pontuar, e a
// diferença importa nas duas pontas:
//   · "Postura: cliente satisfeito" não pontua, mas foi perguntado — continuar
//     pedindo pro vendedor perguntar de novo é ruído na frente do cliente.
//   · "Alto volume" não pontua enquanto o limiar for nulo, mas a pergunta
//     ("quantos bags por mês?") é a de maior peso da folha e a razão de as
//     colunas de volume existirem. Sem esta separação ela sumia da tela —
//     era o achado mais grave do QA de 14/09/2026.
const DADO = {
  alto_volume:      (d) => numero(d.volume_mensal_bags) != null,
  necessidade:      (d) => temTexto(d.necessidade_principal),
  target:           (d) => temValor(d.target_cliente_bag) || temValor(d.preco_atual_bag),
  decisor:          (d) => temTexto(d.decisor),
  concorrente:      (d) => temTexto(d.concorrente_principal) || temTexto(d.fornecedor_atual),
  abertura:         (d) => temValor(d.postura_troca),
  produto_adequado: (d) => temTexto(d.produto),
  prazo:            (d) => temValor(d.prazo_decisao),
  proxima_acao:     (d) => temValor(d.data_proximo_contato) && temValor(d.proxima_acao),
};

export const TODOS_OS_CAMPOS = SECOES.flatMap((s) => s.campos);
export const CAMPO_POR_CHAVE = Object.fromEntries(TODOS_OS_CAMPOS.map((c) => [c.chave, c]));

function camel(s) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }

// Placeholder do hook de leads: `decision_maker` nasce {name:"—"} quando
// vazio, e "—" num input é pior que vazio.
const vazio = (v) => v == null || v === "" || v === "—";

/** O valor atual de um campo, buscado na origem que aquele campo declara. */
function valorDoCampo(lead, c) {
  if (c.destino === DESTINO.CLIENTE) {
    // Dado que a plataforma já tem — só leitura. `de` pode ser uma lista
    // (Cidade/UF é `city` + `state`).
    const partes = (Array.isArray(c.de) ? c.de : [c.de])
      .map((k) => lead?.[k])
      .filter((v) => !vazio(v));
    return partes.join("/");
  }

  if (c.destino === DESTINO.COLUNA) {
    const bruto = lead?.[camel(c.coluna)] ?? lead?.[c.coluna];
    // `subcampo` existe pra jsonb: decision_maker é {name, role}, e gravar o
    // objeto inteiro num input de texto punha "[object Object]" na tela.
    let v = c.subcampo ? (bruto && typeof bruto === "object" ? bruto[c.subcampo] : null) : bruto;
    if (vazio(v)) return "";
    // `next_follow_up` é timestamptz; <input type="date"> só aceita AAAA-MM-DD
    // e descarta o valor inteiro em silêncio se vier com hora.
    if (c.tipo === CAMPO.DATA && typeof v === "string") v = v.slice(0, 10);
    return v;
  }

  const cf = lead?.customFields || lead?.custom_fields || {};
  return cf[c.chave] ?? "";
}

/**
 * Achata o lead num objeto plano de respostas, juntando as três origens
 * (coluna do lead, custom_fields e dado do cliente) — o resto do arquivo não
 * precisa saber de onde cada uma veio.
 *
 * `rascunho` vem POR ÚLTIMO e vence tudo, inclusive valor vazio. Sem isso o
 * valor da coluna reescrevia o que o vendedor estava digitando a cada tecla,
 * e os dois campos de volume ficavam gravável-uma-vez-só (QA 14/09/2026).
 */
export function respostasDoLead(lead, rascunho = {}) {
  const cf = lead?.customFields || lead?.custom_fields || {};
  const d = { ...cf };
  TODOS_OS_CAMPOS.forEach((c) => { d[c.chave] = valorDoCampo(lead, c); });
  return { ...d, ...rascunho };
}

/**
 * O score, a faixa, e o que falta — tudo de uma vez.
 *
 * `possivel` existe por causa da regra 14: quando um item não é avaliável (o
 * limiar de alto volume não está configurado), ele sai do numerador E do
 * denominador. A tela mostra "45 de 80", nunca "45 de 100" com um item que
 * nunca poderia somar.
 */
export function avaliarChecklist(lead, rascunho = {}) {
  const d = respostasDoLead(lead, rascunho);

  let total = 0, possivel = 0;
  const marcados = [], faltantes = [], naoAvaliaveis = [];

  for (const item of PESOS) {
    const prova = PROVA[item.id];
    const r = prova ? prova(d) : false;
    const coletado = DADO[item.id] ? DADO[item.id](d) : false;

    if (r === null) naoAvaliaveis.push(item);
    else {
      possivel += item.peso;
      if (r) { total += item.peso; marcados.push(item); }
    }

    // A lista "Falta perguntar" é sobre a PERGUNTA, não sobre o ponto.
    if (!coletado) faltantes.push({ ...item, pontua: r !== null });
  }

  // A faixa é lida contra o POSSÍVEL, não contra 100 fixo — senão um item
  // fora da conta rebaixaria todo mundo de faixa sem ninguém ter feito nada
  // pior. Com tudo avaliável, possivel = 100 e a conta é a da folha impressa.
  //
  // `possivel === 0` devolve pct/faixa NULOS, não zero: nenhum item avaliável
  // não é "baixa prioridade", é ausência de medida (regra 14).
  const pct = possivel > 0 ? Math.round((total / possivel) * 100) : null;
  const faixa = pct == null ? null : (FAIXAS.find((f) => pct >= f.min && pct <= f.max) || FAIXAS[FAIXAS.length - 1]);

  return {
    total, possivel, pct, faixa,
    marcados,
    // Ordenado por peso: a pergunta que mais move o score aparece primeiro.
    // É esta lista que vira o bloco "Falta perguntar" na tela do vendedor.
    faltantes: [...faltantes].sort((a, b) => b.peso - a.peso),
    naoAvaliaveis,
    pontosEmAberto: faltantes.filter((i) => i.pontua).reduce((s, i) => s + i.peso, 0),
  };
}

/**
 * Quanto de cada seção já foi respondido — alimenta o índice das 9 seções.
 * A seção 8 (score) não tem campo: reporta a completude do próprio score.
 */
export function completudeDasSecoes(lead, rascunho, avaliacao) {
  const d = respostasDoLead(lead, rascunho);
  return SECOES.map((s) => {
    if (s.calculada) {
      return { id: s.id, numero: s.numero, nome: s.nome, calculada: true,
               preenchidos: avaliacao.marcados.length, total: PESOS.length - avaliacao.naoAvaliaveis.length };
    }
    const preenchidos = s.campos.filter((c) => temValor(d[c.chave])).length;
    return { id: s.id, numero: s.numero, nome: s.nome, preenchidos, total: s.campos.length };
  });
}

/**
 * Separa o rascunho pelo DESTINO declarado de cada campo. Sem isto o drawer
 * precisava desestruturar campo a campo — e o que ele esquecia (`decisor`,
 * `origem_lead`) caía em custom_fields e nunca chegava na coluna (QA
 * 14/09/2026). Agora quem manda é o `destino` da constante: campo novo na
 * folha impressa não exige mexer no drawer.
 *
 * Devolve `{ colunas, custom }`, onde `colunas` já vem com a chave camelCase
 * que `patchToRow` (use-leads.js) espera, e o subcampo jsonb resolvido.
 */
export function dividirRespostas(respostas, lead) {
  const colunas = {}, custom = {};

  for (const [chave, valor] of Object.entries(respostas || {})) {
    const campo = CAMPO_POR_CHAVE[chave];
    // Campo de CLIENTE é leitura: nunca volta pra gravação por este caminho.
    if (campo?.destino === DESTINO.CLIENTE) continue;

    if (!campo || campo.destino !== DESTINO.COLUNA) { custom[chave] = valor; continue; }

    const nome = camel(campo.coluna);
    if (campo.subcampo) {
      // O hook entrega `decision_maker` como {name:"—", role:"—"} quando
      // vazio. Escrever esse "—" de volta grava o placeholder no banco, então
      // ele é descartado antes (só o que o vendedor realmente informou vai).
      const atual = typeof lead?.[nome] === "object" && lead?.[nome] ? lead[nome] : {};
      const semPlaceholder = Object.fromEntries(Object.entries(atual).filter(([, v]) => !vazio(v)));
      const base = colunas[nome] ?? semPlaceholder;
      colunas[nome] = { ...base, [campo.subcampo]: valor === "" ? null : valor };
    } else if (campo.tipo === CAMPO.NUMERO) {
      // Vazio vira NULL e não 0 — volume 0 bags/mês é uma afirmação, campo em
      // branco é a ausência dela.
      colunas[nome] = valor === "" || valor == null ? null : (numero(valor) ?? null);
    } else {
      colunas[nome] = valor === "" ? null : valor;
    }
  }

  return { colunas, custom };
}

/* ── A ata devolvendo o que ouviu ─────────────────────────────────────────
 *
 * A edge function `crm-ata-voz` já extrai dor, concorrente, objeção e próximo
 * passo da conversa gravada — isso funciona desde antes do checklist existir.
 * Só que esses campos morriam na ata: o checklist ao lado continuava dizendo
 * que ninguém tinha perguntado, logo depois de o cliente ter falado.
 *
 * SUGERE, NUNCA GRAVA. O vendedor é quem decide se a máquina ouviu direito, e
 * campo que ele já respondeu nem aparece na lista. Escrever por cima do que
 * uma pessoa digitou na frente do cliente, com transcrição automática, é a
 * forma mais rápida de ninguém mais confiar na tela.
 */
export const CHAVE_SUGESTOES = "checklist_sugestoes";

// Campo da ata → chave do checklist. Deliberadamente curto: `pessoas` NÃO vira
// `decisor` (quem estava na sala não é necessariamente quem assina, e esse
// item vale 10 pontos), e `resumo` não vira `necessidade_principal` (resumo é
// a reunião inteira, não a necessidade).
export const DA_ATA = {
  dor:           "dor_principal",
  concorrente:   "concorrente_principal",
  proximo_passo: "objetivo_proximo",
  objecao:       "pendencias",
};

/** O que a ata tem a oferecer, já no formato que o checklist entende. */
export function sugestoesDaAta(draft, quando) {
  const out = {};
  for (const [daAta, doChecklist] of Object.entries(DA_ATA)) {
    const valor = draft?.[daAta];
    if (typeof valor === "string" && valor.trim()) out[doChecklist] = valor.trim();
  }
  if (Object.keys(out).length === 0) return null;
  return { ...out, _em: quando };
}

/**
 * As sugestões que ainda fazem sentido mostrar: fora as que o vendedor já
 * respondeu (na coluna, no custom_fields ou no rascunho aberto) e fora as que
 * ele dispensou nesta sessão.
 */
export function sugestoesPendentes(lead, rascunho = {}, dispensadas = []) {
  const cf = lead?.customFields || lead?.custom_fields || {};
  const guardadas = cf[CHAVE_SUGESTOES];
  if (!guardadas || typeof guardadas !== "object") return [];
  const d = respostasDoLead(lead, rascunho);
  return Object.entries(guardadas)
    .filter(([chave]) => chave !== "_em")
    .filter(([chave]) => !dispensadas.includes(chave))
    .filter(([chave]) => !temValor(d[chave]))
    .map(([chave, valor]) => ({ chave, valor, rotulo: CAMPO_POR_CHAVE[chave]?.rotulo || chave }));
}

export default avaliarChecklist;
