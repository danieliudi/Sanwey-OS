# Spec — Gate de avanço de etapa condicionado a VALOR de campo (Funil de Vendas)

Status: investigação/spec, **nada implementado**. Schema aditivo (1 coluna
jsonb) — precisa confirmação explícita do Daniel antes de aplicar (CLAUDE.md
regra 5).

## 1. Estrutura atual — obrigatoriedade de campo

`src/utils/field-conditions.js:1-101`. Config vive em `pipeline_stage_fields`
(linha de campo por etapa/empresa), lida em `src/hooks/use-stage-fields.js:8-27`
(`rowToField`): colunas `required` (bool), `visible_if`/`required_if` (jsonb,
shape `{fieldKey, operator, value}`), `validation_rule`.
`getMissingRequiredFields` (`field-conditions.js:67-70`) resolve campos
visíveis (`resolveVisibleFields`, linha 45-49) e filtra os `effectiveRequired`
(`isFieldRequired`, linha 36-40) vazios. Isso responde só "campo preenchido?"
— nunca compara contra um valor esperado. Enforcement real acontece em
`src/components/views/CRMView.jsx:536-554` (`attemptStageChange`), chamado
tanto pelo `handleDrop` (drag-and-drop, linha 576+) quanto pelo `onMove`
repassado a `MoveStageMenu`/`StageNavigator`.

## 2. Transições permitidas — schema e editor

Tabela `pipeline_stage_transitions`
(`supabase/migrations/20260707_unify_comercial_marketing_pipeline_stages.sql:41-51`):
`id, domain, company_id, from_stage_key, to_stage_key, allowed boolean,
created_at, updated_at`, unique `(domain, company_id, from_stage_key,
to_stage_key)`. Lida/gravada por `src/hooks/use-pipeline-transitions.js` —
`isTransitionAllowed(companyId, from, to)` (linha 65-72) e
`writeFullMatrix`/`toggleTransition`/`setRowAllowed` (linha 77-141), sempre
matriz completa por par from→to. Editor:
`src/components/pipeline/PipelineStagesModal.jsx` (linhas ~202-270, "Regras
de transição"). RLS: policy `pipeline_stage_transitions_write` restrita a
`role in ('admin','gerente')` (migration linhas 60-64) — já é o padrão certo
pra config de gestor.

## 3. `matchOperator`/`condition_groups` é reaproveitável — e já está duplicado 3x

`evalFieldCondition` (`field-conditions.js:9-25`) e `matchOperator`
(`src/hooks/use-automations.js:300-313`) são **literalmente o mesmo switch**
(`eq/neq/contains/gt/lt/gte/lte/is_empty/is_not_empty`, mesmo fallback), só
com assinatura diferente. Uma terceira cópia existe em TypeScript no edge
function: `supabase/functions/agent-runner/index.ts:226-239` (`matchOperator`)
+ `passesConditionGroups` (linha 241-244, OR entre grupos, AND dentro do
grupo). Isso já viola a regra 4 do CLAUDE.md (extrair na 3ª ocorrência) — a
3ª cópia já existe hoje, antes mesmo desta feature nova.

**Recomendação**: não reinventar. Extrair um único
`matchOperator(actual, operator, expected)` puro pra
`src/utils/condition-operators.js` (ou mover pra dentro de
`field-conditions.js`, já que reexporta o mesmo switch). `evalFieldCondition`
passa a chamar esse operador extraído. `use-automations.js` importa o
mesmo. O formato
`{conditionGroups:[{logic:"AND", conditions:[{field,operator,value}]}]}` de
`use-automations.js:23-28` é a mesma forma pedida pra gate — reaproveitar o
shape, não inventar um novo.

## 4. Schema proposto pro gate

Nova coluna jsonb em `pipeline_stage_transitions`: `condition_groups jsonb
null default null`, mesmo shape de `automations.condition_groups`. `null`/
`[]` = comportamento atual (sem gate). `field` referencia `field_key` de
`pipeline_stage_fields` pra aquele `from_stage_key`. Não precisa de tabela
nova — cabe como config na linha de transição já existente (regra 5 do
CLAUDE.md: config antes de schema novo). Migration:
`alter table pipeline_stage_transitions add column condition_groups jsonb;`
— aditivo, não quebra linhas existentes.

## 5. UI proposta

**Configuração**: dentro de `PipelineStagesModal.jsx`, na mesma pílula de
transição — ação extra "Adicionar condição" abre um mini-editor. Isso é
mudança visual/estrutural: precisa de mockup (CLAUDE.md regra 3) — ver
artifact "Novas Features do Funil", item 2.

**Bloqueio pro vendedor**: `attemptStageChange` (`CRMView.jsx:536`) ganha um
3º check entre a matriz de transição (linha 542) e o obrigatório (linha 550)
— se `condition_groups` da transição existe e o registro não passa,
`setStageError` com mensagem citando o campo/valor esperado, mesmo padrão de
string já usado nas linhas 543/552. Superfície: já é `AppToast
variant="danger"` (linha 602-604) — nenhum componente novo. `MoveStageMenu`/
`StageNavigator` não mudam — são "burros", o gate fica centralizado em
`attemptStageChange`, igual às duas checagens que já existem lá.

## 6. Schema / RLS / Storage

- **Schema muda**: sim — 1 coluna jsonb aditiva em
  `pipeline_stage_transitions`. Confirmação explícita do Daniel obrigatória
  antes de aplicar (regra 5).
- **RLS**: não muda — policies de leitura/escrita já cobrem a tabela
  inteira, incluindo coluna nova. Vale rodar `get_advisors` mesmo assim
  depois da migration (checklist 3.1), por ser mudança de schema.
- **Storage**: não toca.
