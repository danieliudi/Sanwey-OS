// Avaliador de campos condicionais por etapa — mostrar/ocultar/exigir um
// campo com base no valor de outro campo da mesma etapa, no mesmo espírito
// do field_conditions do Pipefy. Compartilhado pelo Pipeline de CRM
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
