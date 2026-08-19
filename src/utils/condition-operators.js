// Operador de comparação condição (18/08/2026) — extraído de 3 cópias quase
// idênticas do MESMO switch (eq/neq/contains/gt/lt/gte/lte/is_empty/
// is_not_empty): `evalFieldCondition` em field-conditions.js, `matchOperator`
// em use-automations.js, e `matchOperator` em
// supabase/functions/agent-runner/index.ts. A 3ª cópia já existia antes
// desta extração — regra 4 do CLAUDE.md manda extrair na 3ª ocorrência real,
// não antes (esta é a extração devida). O lado do edge function continua
// duplicado de propósito — deploy via MCP empacota cada function isolada,
// sem import cross-function (mesmo motivo documentado em
// supabase/functions/*/index.ts sobre `_shared/ai-provider.ts`), TS não JS.
//
// `evaluateConditionGroups` é o segundo padrão duplicado (AND dentro do
// grupo, OR entre grupos, grupo vazio = sempre passa) — usado por automações
// (use-automations.js) e agora também pelo gate de etapa por valor
// (pipeline_stage_transitions.condition_groups, mesmo shape).

export function matchOperator(actual, operator, expected) {
  switch (operator) {
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

// groups: [{ logic: "AND", conditions: [{ field, operator, value }, ...] }, ...]
// valuesByKey: mapa field -> valor atual do registro (lead.customFields, etc.)
// Grupo vazio (groups=[]/null) = sem condição, sempre passa.
export function evaluateConditionGroups(groups, valuesByKey) {
  if (!Array.isArray(groups) || groups.length === 0) return true;
  return groups.some(group =>
    (group.conditions || []).every(c =>
      matchOperator(String(valuesByKey?.[c.field] ?? ""), c.operator, String(c.value ?? ""))
    )
  );
}
