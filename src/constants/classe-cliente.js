// Classe do Cliente — Frequência × Volume médio dos Pedidos
//
// Transcrição fiel do documento interno que o Daniel enviou em 15/09/2026
// (foto da página "A Classe do Cliente é definida segundo a Frequência e
// Volume médio dos Pedidos", seção 2.3, imediatamente antes de "2.4 Valor do
// prêmio de 2020 e 2021"). As duas tabelas, as letras e as faixas são as do
// documento, sem ajuste. Se o documento mudar, muda aqui — este arquivo é a
// fonte.
//
// ── PRA QUE SERVE, E PRA QUE NÃO SERVE ───────────────────────────────────
// A Classe define direito a PRÊMIO. Não é o score do Checklist de Visita, e
// os dois não se misturam de propósito:
//   · `score_comercial` (0-100) mede a QUALIFICAÇÃO feita numa visita.
//   · Classe do Cliente mede o HISTÓRICO de compra de quem já compra.
// Juntar os dois num número só deixaria os dois sem significado — a mesma
// confusão que já custou caro nesta plataforma quando `fit_score` e
// `score_comercial` foram tratados como a mesma coisa (ver a migration
// 20260914130000_checklist_de_visita.sql).
//
// ── DUAS UNIDADES DIFERENTES, PRESTAR ATENÇÃO ────────────────────────────
// COD.1 conta PEDIDOS POR ANO. COD.2 conta PEÇAS POR PEDIDO. Não são a mesma
// escala e não se somam: o volume anual de um cliente é o produto dos dois.
// O Checklist de Visita pergunta "volume mensal (bags)", que é outra coisa
// ainda — por isso a Classe tem campos próprios e não reaproveita aqueles.

export const COD1 = [
  { cod: "A", min: 10, max: 12,       rotulo: "10, 11, 12" },
  { cod: "B", min:  7, max:  9,       rotulo: "7, 8, 9" },
  { cod: "C", min:  4, max:  6,       rotulo: "4, 5, 6" },
  { cod: "D", min:  1, max:  3,       rotulo: "1, 2, 3" },
];
export const COD1_UNIDADE = "pedidos/ano";

export const COD2 = [
  { cod: "A", min: 751, max: Infinity, rotulo: "acima 751" },
  { cod: "B", min: 601, max: 750,      rotulo: "601 a 750" },
  { cod: "C", min: 451, max: 600,      rotulo: "451 a 600" },
  { cod: "D", min: 301, max: 450,      rotulo: "301 a 450" },
  { cod: "E", min: 151, max: 300,      rotulo: "151 a 300" },
  { cod: "F", min:  50, max: 150,      rotulo: "50 a 150" },
];
export const COD2_UNIDADE = "peças/pedido";

// Piso de classificação: abaixo dele o cliente não é classificado e não tem
// direito ao prêmio.
//
// ── UMA CONTRADIÇÃO NO DOCUMENTO, REGISTRADA E NÃO ESCONDIDA ─────────────
// O texto da página diz "volume médio abaixo de 50 peças AO ANO não são
// classificados". A tabela COD.2 logo abaixo, no mesmo documento, tem a
// faixa F começando em "50 a 150 PEÇAS/PEDIDO". São unidades diferentes para
// o mesmo número 50, e as duas não podem estar certas.
//
// Lido aqui como PEÇAS/PEDIDO, por duas razões verificáveis no próprio
// documento: (1) o piso é exatamente o começo da faixa F, o que faz a regra
// e a tabela se encaixarem sem sobra nem buraco; (2) lido "ao ano", um
// cliente da faixa F com 1 pedido/ano (COD.1 D) teria 50 a 150 peças/ano e
// seria classificado E não classificado ao mesmo tempo.
//
// NÃO é uma decisão de produto tomada por conta própria — é a leitura que
// torna o documento consistente consigo mesmo, escrita aqui pra que quem
// discordar saiba exatamente onde mexer. Confirmar com o comercial.
export const PISO_CLASSIFICACAO_PECAS_PEDIDO = 50;

export default { COD1, COD2, PISO_CLASSIFICACAO_PECAS_PEDIDO };
