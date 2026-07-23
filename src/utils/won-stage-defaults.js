// Auto-preenchimento ao mover um lead para a etapa de negócio fechado
// ("ganho") no Kanban de Venda (Comercial).
//
// custom_fields é um jsonb PLANO indexado por field_key (não escopado por
// etapa). Isso tem dois efeitos que este helper trata:
//   1. Preenche "valor_final" (campo de ganho) a partir do que já foi digitado
//      antes — "valor_proposta"/"valor" (negociação) ou o valor de topo do
//      lead — só quando ainda está vazio.
//   2. Define "data_fechamento" como a data REAL do fechamento (hoje),
//      sobrescrevendo a "Previsão de fechamento" da negociação, que compartilha
//      o mesmo field_key e vazava para "Data de Fechamento".

const isEmpty = (v) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

export function ganhoCustomFieldDefaults(lead, nowISO) {
  const cf = (lead && (lead.customFields || lead.custom_fields)) || {};
  const patch = {};

  // valor_final ← valor_proposta → valor (custom) → lead.value  (só se vazio)
  if (isEmpty(cf.valor_final)) {
    const src = !isEmpty(cf.valor_proposta) ? cf.valor_proposta
      : !isEmpty(cf.valor) ? cf.valor
      : (lead && !isEmpty(lead.value) ? lead.value : null);
    if (!isEmpty(src)) patch.valor_final = src;
  }

  // data_fechamento ← hoje (yyyy-mm-dd, formato do input date). Sempre, pra
  // refletir a data real do fechamento e não a previsão herdada.
  patch.data_fechamento = (nowISO || new Date().toISOString()).slice(0, 10);

  return patch;
}

// Mescla os defaults no custom_fields atual e devolve o objeto novo — ou null
// se nada de fato mudaria (evita escrita desnecessária). Não muta a entrada.
export function mergeGanhoDefaults(currentCustomFields, lead, nowISO) {
  const defaults = ganhoCustomFieldDefaults(lead, nowISO);
  const base = currentCustomFields || {};
  const changed = Object.keys(defaults).some((k) => base[k] !== defaults[k]);
  if (!changed) return null;
  return { ...base, ...defaults };
}
