# Análise genérica em todos os Kanbans + remoção dos stat cards do board de Campanhas

Aprovado pelo Daniel via mockup (`https://claude.ai/code/artifact/e891d08b-ce21-4852-b482-1697bebf6f62`) após
2 rodadas de ajuste: (1) layout em 2 linhas (genérico em cima, específico embaixo, nunca misturados); (2)
"Dentro/fora do SLA" entra no núcleo genérico (usa `sla_days`, já configurado por etapa); (3) escopo
estendido pra os 11 boards, não só os 3 que já tinham alguma forma de análise.

## 1. Extrações compartilhadas (pré-requisito de tudo abaixo)

### 1.1 `src/components/shared/ViewToggleButton.jsx` (novo)

Duplicado hoje em 9 arquivos (`CRMView.jsx`, `MarketingView.jsx`, `EntregasView.jsx`,
`ComprasMarketingView.jsx`, `RHFeriasView.jsx`, `RHRecrutamentoView.jsx`, `RHFeedbackView.jsx`,
`RHTreinamentosView.jsx`, `RHOnboardingView.jsx`), byte-quase-idêntico. Extrair função local `ViewToggleButton`
pra cá, mesmo visual (nenhuma mudança de estilo), assinatura `{ active, onClick, children }` (ou o que a
implementação real já usa — copiar exatamente, não redesenhar). Todos os 9 arquivos passam a importar dali e
remover a cópia local.

### 1.2 `src/components/shared/KanbanAnalyticsPanel.jsx` (novo)

Consolida as 3 cópias quase idênticas (`CRMView.jsx:315-411`, `MarketingView.jsx:527-651`,
`EntregasView.jsx:325-381`) e estende pros 8 boards que nunca tiveram análise.

```jsx
// Props:
// stages: [{ key, name, color, slaDays? }] — genérico (rh_pipeline_stages) ou fixo (PURCHASE_STAGES)
// records: array de registros já carregados pelo board (sem query nova)
// getStageKey: (record) => string — em qual etapa o registro está
// getStageEnteredAt: (record) => string|Date|null — quando entrou na etapa atual (stageChangedAt/status_changed_at/etc, nome varia por hook)
// specificStats: [{ label, value, color? }] — linha "específico do board", conteúdo definido pelo chamador
export function KanbanAnalyticsPanel({ stages, records, getStageKey, getStageEnteredAt, specificStats = [] }) {
  // 1. Distribuição por etapa — % de records por stages[i].key, barra + legenda
  //    (mesmo visual que já existe nas 3 implementações atuais, sem mudança).
  // 2. Genérico (linha "GENÉRICO"):
  //    - Total de registros: records.length
  //    - Dias médios na etapa atual: média de (hoje - getStageEnteredAt(r)) em dias, ignorando null
  //    - Dentro do SLA / Estouraram o SLA: por registro, comparar dias-na-etapa contra
  //      stages.find(s => s.key === getStageKey(r))?.slaDays — se a etapa não tiver slaDays
  //      configurado, o registro não entra no denominador (não conta nem a favor nem contra).
  // 3. Específico (linha "ESPECÍFICO"): renderiza specificStats como está, sem lógica própria
  //    — cada board já vem com o valor calculado.
}
```

Reaproveita o mesmo componente de barra por etapa que já existe (não recriar) — se
`src/components/shared/StageDistributionBar.jsx` servir como base visual (empilhada), usar; senão manter o
visual atual dos 3 `AnalyticsPanel`s (por etapa individual, não empilhada) — **não é o mesmo componente que
`StageDistributionBar`** (esse já é usado pelas 3 Visões Gerais, com semântica de "resumo executivo" — este
aqui é por-board, granularidade de Kanban). Confirmar visualmente contra o mockup antes de finalizar.

### 1.3 `PURCHASE_STAGES` ganha `slaDays` (Compras)

Único board sem `rh_pipeline_stages` — adicionar `slaDays` como literal na constante já existente
(`use-marketing-purchase-requests.js`, `PURCHASE_STAGES`), sem migration:

```js
export const PURCHASE_STAGES = [
  { id: "solicitado",         name: "Solicitado",          slaDays: 2 },
  { id: "cotacao",            name: "Cotação",             slaDays: 5 },
  { id: "aprovado",           name: "Aprovado",             slaDays: 3 },
  { id: "pedido_fornecedor",  name: "Pedido ao Fornecedor", slaDays: 10 },
  { id: "entrega_parcial",    name: "Entrega Parcial",      slaDays: 7 },
  { id: "entregue",           name: "Entregue",             slaDays: 3 },
  { id: "pago",               name: "Pago", terminal: true, slaDays: 5 },
];
```

Valores de `slaDays` são estimativas razoáveis pro fluxo de compras — **decisão de produto, não técnica**;
se o Daniel tiver uma preferência real de prazo por etapa, é trivial trocar os números depois, sem outra
mudança de código.

## 2. Campanhas — remover os 3 stat cards do Kanban

`MarketingView.jsx:1180` — trocar:
```jsx
{(viewMode === "kanban" || viewMode === "analytics") && <KpiBar campaigns={filteredCampaigns} />}
```
por:
```jsx
{viewMode === "analytics" && <KpiBar campaigns={filteredCampaigns} />}
```
`KpiBar`/`KpiCard` (`:462-520`) não mudam de conteúdo — só passam a ser específicos da aba Análise (dentro do
novo `KanbanAnalyticsPanel`, seção "ESPECÍFICO": Orçamento Total + Urgente; "Campanhas Ativas" vira redundante
com o "Total de registros" genérico, então **remover esse card específico** — os outros 2 continuam).

## 3. Entregas — acordeão vira aba "Análise" de verdade

`EntregasView.jsx:325-381` (`AnalyticsPanel` com estado `open` colapsável, `:1311-1318` renderizado dentro do
`viewMode === "kanban"`) — remover o acordeão e o estado `open`; adicionar "Análise" como 4º
`ViewToggleButton` (ao lado de Kanban/Tabela/Calendário, `:978-982`), renderizando `KanbanAnalyticsPanel`
quando `viewMode === "analytics"` — mesmo padrão de Campanhas/CRM. Específico: atrasadas por prazo
(`dueDate`) — **confirmar se `marketing_deliverables` tem campo de valor monetário próprio antes de somar um
2º card específico** (não confirmado na investigação prévia).

## 4. Os 8 boards sem análise — ganham a aba

Pra cada um: adicionar "Análise" como novo `ViewToggleButton` (ou primeiro, se o board não tiver toggle
nenhum hoje — Tarefas e Pós-venda não têm, precisam ganhar o toggle Kanban/Análise no lugar do
`KanbanBoardHeader` sozinho) + renderizar `KanbanAnalyticsPanel` com `stages`/`records` que o board já
carrega, e `specificStats` conforme tabela abaixo (todos já confirmados como dado já disponível, sem query
nova):

| Board | Arquivo | `stages`/`records` já existentes | `specificStats` sugeridos |
|---|---|---|---|
| Tarefas | `MarketingTarefasView.jsx` | `rh_pipeline_stages` domain `marketing_tasks` / `tasks` | Distribuição por prioridade (baixa/média/alta); Atrasadas por `deadline` |
| Compras | `ComprasMarketingView.jsx` | `PURCHASE_STAGES` (agora com `slaDays`) / `purchases` | Valor total (`totalValue`, já somado); Tempo médio de aprovação (solicitado/cotação → aprovado) |
| Pós-venda | `PosVendaView.jsx` | `rh_pipeline_stages` domain `posvenda` / `cases` | Valor total (`summary.total`, já agregado); Distribuição por tipo de caso |
| RH Vagas | `RHRecrutamentoView.jsx` (sub-board Vagas) | `rh_pipeline_stages` domain `vagas` / `vagas` | Tempo médio de vaga aberta (`hiring_deadline`); Faixa salarial média das vagas abertas |
| RH Candidatos | `RHRecrutamentoView.jsx` (sub-board Candidatos) | `rh_pipeline_stages` domain `candidatos` / `candidatos` | Taxa de conversão por etapa (funil) |
| RH Onboarding | `RHOnboardingView.jsx` | `rh_pipeline_stages` domain `onboarding` / `colaboradores` | % médio de checklist de integração concluído; tempo médio até "Removido" quando aplicável |
| RH Férias | `RHFeriasView.jsx` | `rh_pipeline_stages` domain `ferias` / `requests` | Distribuição por tipo de afastamento; total de dias afastados no período filtrado |
| RH Treinamentos | `RHTreinamentosView.jsx` (dentro de `TreinamentoBoardModal`) | `rh_pipeline_stages` domain `treinamentos` / `atribuicoesByTreinamento` | Taxa de conclusão (concluído vs vencido); certificados emitidos no período |
| RH Avaliação | `RHFeedbackView.jsx` | `rh_pipeline_stages` domain `feedback` / `feedbacks` | Nota média do período; quantos resultaram em promoção |

Cada linha da tabela é uma sugestão — se ao implementar o dado citado não estiver realmente disponível sem
nova query (ex. "certificados emitidos" pode não estar em `atribuicoesByTreinamento` diretamente), documentar
a divergência e usar o próximo dado mais próximo já carregado, em vez de inventar query nova sem confirmar
com o Daniel primeiro (esta spec não aprova schema novo nem RPC nova).

## 5. Fora de escopo

- "Carga por responsável" (distribuição por pessoa) — considerado, não incluído nesta rodada (nomes de campo
  divergentes por domínio: `assigneeIds` vs `responsibleId`/`responsibleIds`). Registrar como 2ª onda se o
  Daniel quiser depois.
- Funil de Vendas (`CRMView.jsx`) — já tem Análise; migra pro componente compartilhado (item 1.2) mas o
  CONTEÚDO não muda nesta rodada.
- Nenhuma migration/schema novo — `slaDays` de Compras é constante JS; tudo mais é leitura de campo já
  existente.
- Motor de aprovação/transição de Compras não é tocado — só o painel de Análise ganha o dado de SLA.

## 6. Verificação

1. `npx vite build` limpo.
2. Confirmar visualmente (claro + escuro) que Campanhas/Entregas/CRM continuam com o MESMO visual de barra
   por etapa depois da extração — nenhuma mudança perceptível nos 3 que já existiam, só consolidação de
   código.
3. Confirmar que os 3 stat cards de Campanhas somem do Kanban e apareçam só na aba Análise.
4. Confirmar que os 8 boards novos mostram o layout em 2 linhas (genérico em cima, específico embaixo) com
   dado real, não placeholder.
5. Testar "Dentro do SLA"/"Estouraram o SLA" em pelo menos 2 boards (um com `rh_pipeline_stages`, um com
   Compras) — os números precisam bater com a mesma lógica de SLA que já aparece no cabeçalho da coluna do
   Kanban (`KanbanColumnHeader.jsx`).
6. Nenhuma classe de bug conhecida reintroduzida.
