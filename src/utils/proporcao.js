// Razão em tela: piso, denominador e o que ficou de fora.
//
// ORIGEM DOS NÚMEROS: nada aqui lê banco. Recebe `parte` e `total` já
// calculados por quem chama (hoje: ganhas/decididas em `abm-accounts.js:130`,
// `account-collapse.js:105` e `fair-report.js` — em todos, "decididas" é
// ganhas + perdidas, e negócio ABERTO fica fora do denominador de propósito,
// porque ainda não fracassou).
//
// POR QUE EXISTE (regra 14 do CLAUDE.md). Uma conta ganha e nenhuma perdida
// exibe "100%" num cartão de destaque, e é esse cartão que vai pra diretoria.
// O percentual está aritmeticamente certo e é informativamente falso. As três
// exigências da regra viram uma função só:
//
//   1. denominador visível  → `nota` sempre traz o "X de Y";
//   2. piso                 → abaixo de MIN, devolve a fração no lugar do %;
//   3. o que ficou de fora  → `fora` entra na mesma nota, contado.
//
// EXTRAÍDO EM 11/09/2026, na 2ª ocorrência e não na 3ª (regra 4), porque a
// 3ª chegava no mesmo commit: AbmAccountsView já tinha o piso, FairReportView
// estava recebendo, e Executivo/Analytics vem em seguida. Extrair depois de
// escrever as três seria escrever a terceira sabendo que ia apagá-la.

// Cinco é o menor número em que cada passo já significa alguma coisa
// (1/5 = 20%, 2/5 = 40%). Abaixo disso a fração é mais honesta que a
// porcentagem. É o mesmo piso da pesquisa anônima — não há motivo pra dois
// números diferentes na mesma plataforma. Subir é ajuste de uma linha.
export const MIN_DECIDIDOS_PARA_PERCENTUAL = 5;

export function pct(v) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

/**
 * @param {number} parte   numerador (ex.: ganhas)
 * @param {number} total   denominador (ex.: decididas = ganhas + perdidas)
 * @param {object} [opts]
 * @param {string} [opts.singular="decidida"]
 * @param {string} [opts.plural="decididas"]
 * @param {string} [opts.fora]  texto do que o cálculo descartou, já contado
 * @returns {{ valor: string, nota: string|null }}
 */
export function razaoHonesta(parte, total, opts = {}) {
  const { singular = "decidida", plural = "decididas", fora = "" } = opts;
  if (!total) return { valor: "—", nota: fora || null };

  const rotulo = total === 1 ? singular : plural;
  const base = `${parte} de ${total} ${rotulo}`;
  const nota = fora ? `${base} · ${fora}` : base;

  if (total < MIN_DECIDIDOS_PARA_PERCENTUAL) {
    // Abaixo do piso NÃO mostra percentual nenhum — nem no valor, nem na nota.
    return { valor: `${parte}/${total}`, nota };
  }
  return { valor: pct(parte / total), nota };
}
