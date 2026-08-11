// Avaliador de campos condicionais por etapa — mostrar/ocultar/exigir um
// campo com base no valor de outro campo da mesma etapa, no mesmo espírito
// do field_conditions do Pipefy. Compartilhado pelo Kanban do Funil de Vendas (CRM)
// (pipeline_stage_fields) e pelos kanbans de RH (rh_pipeline_stage_fields).
//
// Condição: { fieldKey, operator, value } | null. null = sem condição (o
// campo é sempre visível; "exigir" cai de volta pro `required` estático).

export function evalFieldCondition(condition, valuesByKey) {
  if (!condition?.fieldKey) return true;
  const actual = String(valuesByKey?.[condition.fieldKey] ?? "");
  const expected = String(condition.value ?? "");
  switch (condition.operator) {
    case "eq":            return actual === expected;
    case "neq":            return actual !== expected;
    case "contains":       return actual.toLowerCase().includes(expected.toLowerCase());
    case "gt":             return parseFloat(actual) > parseFloat(expected);
    case "lt":             return parseFloat(actual) < parseFloat(expected);
    case "gte":            return parseFloat(actual) >= parseFloat(expected);
    case "lte":            return parseFloat(actual) <= parseFloat(expected);
    case "is_empty":       return actual.trim() === "";
    case "is_not_empty":   return actual.trim() !== "";
    default:               return actual === expected;
  }
}

// field: { fieldKey, required, visibleIf, requiredIf, ... } (shape de
// use-stage-fields.js / use-rh-stage-fields.js). valuesByKey: mapa
// fieldKey -> valor atual (ex.: lead.customFields ou vaga.customFields).

export function isFieldVisible(field, valuesByKey) {
  if (!field?.visibleIf) return true;
  return evalFieldCondition(field.visibleIf, valuesByKey);
}

export function isFieldRequired(field, valuesByKey) {
  if (field?.required) return true;
  if (!field?.requiredIf) return false;
  return evalFieldCondition(field.requiredIf, valuesByKey);
}

// Filtra + calcula obrigatoriedade efetiva pra uma lista de defs de campo,
// dado o mapa de valores atuais — o que os drawers realmente precisam pra
// renderizar (campos visíveis, cada um já com `effectiveRequired`).
export function resolveVisibleFields(fields, valuesByKey) {
  return (fields || [])
    .filter(f => isFieldVisible(f, valuesByKey))
    .map(f => ({ ...f, effectiveRequired: isFieldRequired(f, valuesByKey) }));
}

function isValueEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// Enforcement real de transição de fase (antes disso, `required` era só o
// asterisco visual — confirmado ao vivo que mover um card não bloqueava com
// campo obrigatório vazio, inclusive corrompendo métricas do Painel
// Executivo). Valida os campos da ETAPA ATUAL (a que o card está saindo),
// mesma semântica do blueprint Pipefy — "recusa a operação se algum campo
// obrigatório ativo para a fase atual estiver vazio".
//
// Retorna a lista de campos (fields) que estão obrigatórios (estático ou
// via requiredIf) e vazios — array vazio = pode mover.
export function getMissingRequiredFields(fields, valuesByKey) {
  return resolveVisibleFields(fields, valuesByKey)
    .filter(f => f.effectiveRequired && isValueEmpty(valuesByKey?.[f.fieldKey]));
}

// Campo obrigatório trava AVANÇAR, não VOLTAR — decidido com o Daniel
// 11/08/2026 depois do relato da Tatiane em Entregas: pra devolver uma arte
// pra agência ela precisava antes preencher "Aprovador responsável" e
// "Decisão de aprovação", sem ter aprovado nem reprovado nada. Voltar não
// conclui a etapa, então não faz sentido cobrar o formulário dela.
//
// `stageOrder` é a lista ORDENADA de etapas do quadro — aceita as três formas
// que convivem na plataforma: string crua, { id } (constantes hardcoded como
// PURCHASE_STAGES) e { stageKey }/{ stage_key } (rh_pipeline_stages). Etapa
// desconhecida em qualquer das pontas devolve false, ou seja, mantém a trava:
// na dúvida o comportamento é o antigo, nunca o mais frouxo.
export function isStageRegression(stageOrder, fromStage, toStage) {
  if (!Array.isArray(stageOrder) || !fromStage || !toStage) return false;
  const ids = stageOrder.map(s => (typeof s === "string" ? s : (s?.id ?? s?.stageKey ?? s?.stage_key)));
  const from = ids.indexOf(fromStage);
  const to   = ids.indexOf(toStage);
  if (from === -1 || to === -1) return false;
  return to < from;
}

// Completude da etapa atual pro badge do card (seção 10.3 da auditoria):
// "5/8" laranja se faltam campos obrigatórios, verde quando completo. total=0
// (etapa sem nenhum campo obrigatório) não deve renderizar badge nenhum —
// quem chama decide isso olhando `total`.
export function getFieldCompleteness(fields, valuesByKey) {
  const required = resolveVisibleFields(fields, valuesByKey).filter(f => f.effectiveRequired);
  const total = required.length;
  const filled = required.filter(f => !isValueEmpty(valuesByKey?.[f.fieldKey])).length;
  return { total, filled, complete: filled === total };
}
