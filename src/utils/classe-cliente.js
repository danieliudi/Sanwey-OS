import { COD1, COD2, PISO_CLASSIFICACAO_PECAS_PEDIDO } from "../constants/classe-cliente";

// Classe do Cliente — o cálculo.
//
// REGRA 14 — de onde vem cada número: as duas tabelas e o piso são os do
// documento interno transcrito em constants/classe-cliente.js. Nada aqui é
// estimado, projetado nem aprendido de histórico.

const numero = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const faixaDe = (tabela, valor) =>
  valor == null ? null : (tabela.find((f) => valor >= f.min && valor <= f.max) || null);

/**
 * Classifica um cliente a partir da frequência (pedidos/ano) e do volume
 * médio (peças/pedido).
 *
 * Devolve sempre um objeto, nunca lança. `classificado: false` vem com
 * `motivo` dizendo POR QUE — "não classificado" e "faltou dado" são coisas
 * diferentes e a tela precisa distinguir.
 */
export function classificarCliente({ pedidosAno, pecasPorPedido } = {}) {
  const freq = numero(pedidosAno);
  const vol  = numero(pecasPorPedido);

  if (freq == null || vol == null) {
    return {
      classificado: false,
      motivo: "faltam_dados",
      texto: "Informe a frequência e o volume médio para classificar.",
      cod1: null, cod2: null, classe: null, pecasAno: null,
    };
  }

  // O piso do documento é sobre o volume médio, não sobre a frequência.
  if (vol < PISO_CLASSIFICACAO_PECAS_PEDIDO) {
    return {
      classificado: false,
      motivo: "abaixo_do_piso",
      texto: `Volume médio abaixo de ${PISO_CLASSIFICACAO_PECAS_PEDIDO} peças/pedido — não classificado, e portanto sem direito ao prêmio.`,
      cod1: faixaDe(COD1, freq)?.cod ?? null,
      cod2: null, classe: null,
      pecasAno: freq * vol,
    };
  }

  const f1 = faixaDe(COD1, freq);
  const f2 = faixaDe(COD2, vol);

  // Frequência fora de 1-12 pedidos/ano não existe na tabela do documento.
  // Devolver uma letra chutada aqui seria inventar classificação.
  if (!f1 || !f2) {
    return {
      classificado: false,
      motivo: "fora_da_tabela",
      texto: freq > 12
        ? "Frequência acima de 12 pedidos/ano não consta na tabela COD.1 do documento — confirmar com o comercial."
        : "Valor fora das faixas da tabela do documento — confirmar com o comercial.",
      cod1: f1?.cod ?? null, cod2: f2?.cod ?? null, classe: null,
      pecasAno: freq * vol,
    };
  }

  return {
    classificado: true,
    motivo: null,
    texto: null,
    cod1: f1.cod,
    cod2: f2.cod,
    classe: `${f1.cod}${f2.cod}`,
    // Produto das duas escalas — declarado porque é a única leitura em que
    // as duas unidades do documento se combinam (pedidos/ano × peças/pedido).
    pecasAno: freq * vol,
    faixaFrequencia: f1.rotulo,
    faixaVolume: f2.rotulo,
  };
}

export default classificarCliente;
