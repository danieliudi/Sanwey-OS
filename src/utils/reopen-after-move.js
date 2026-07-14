// Fecha o modal/drawer de um card imediatamente ao mover pra outra etapa
// (sinal visual claro de que a ação aconteceu) e reabre pouco depois já
// com a etapa nova — em vez de só trocar o conteúdo por baixo do mesmo
// modal aberto, o que não dá pra perceber que moveu de fato.
//
// `valueOrFn` pode ser o próprio valor (quando o estado guarda só um id,
// que o componente já re-deriva do registro fresco no próximo render) ou
// uma função (quando o estado guarda o objeto inteiro e precisa buscar a
// versão mais atual só na hora de reabrir, ex. App.jsx/selectedLead).
export function reopenAfterMove(setSelected, valueOrFn, delay = 220) {
  setTimeout(() => {
    setSelected(typeof valueOrFn === "function" ? valueOrFn() : valueOrFn);
  }, delay);
}
