# Rollout do padrão de densidade para os 11 boards restantes

Decidido com o Daniel em 01/09/2026 ("ok para tudo isso. Inclusive passar para
os outros boards"). Referência canônica: `src/components/views/EntregasView.jsx`
e `MarketingTarefasView.jsx`, os dois únicos que já receberam o padrão na
rodada de 4.87.0. **Ler os dois antes de escrever qualquer linha** — esta spec
descreve a intenção; o código de lá é o gabarito.

## Boards no escopo

CRMView (Funil de Vendas), PosVendaView, MarketingView (Campanhas),
ComprasMarketingView, ComexView, PersonalTasksView (Meu To-do), BugsView,
RHOnboardingView, RHFeriasView, RHFeedbackView, RHTreinamentosView,
RHRecrutamentoView.

## Os 4 itens do padrão

### 1. `PageTitle` no lugar do bloco de título escrito à mão

`import { PageTitle } from "../shared/PageTitle"` e trocar o
`ícone + <h1 de 26px> + <p> de subtítulo` por
`<PageTitle icon={X} title="..." description="..." />`.

**A distinção que importa** (está documentada no cabeçalho do próprio
`PageTitle.jsx`, releia lá): existem DOIS tipos de subtítulo hoje, e eles vão
em props diferentes.

- `description` — texto ESTÁTICO, escrito no código, que não muda com o dado
  ("Kanban de entregas de campanha"). Vai ao lado do título.
- `summary` — RESUMO AO VIVO, calculado, que muda a cada filtro
  ("12 oportunidades · R$ 340k em aberto"). Continua na linha de baixo.

CRMView e PosVendaView têm resumo ao vivo — eles usam `summary`, e ganham
`description` só se houver um texto estático além dele. Não transformar um
resumo em descrição: ele é longo e muda, e vai truncar.

### 2. `secondaryInline` no `KanbanColumnHeader`

O SLA (ou o que a coluna mostrar como informação secundária) sobe para a linha
do nome, em vez de ocupar uma segunda linha. É uma prop booleana; ver o uso em
`EntregasView.jsx` (procure por `secondaryInline`).

Board cuja coluna não tem informação secundária nenhuma: nada a fazer aqui.

### 3. Busca de card, sempre visível

- Estado local `const [search, setSearch] = useState("")`.
- `import { semAcento } from "../../utils/text-search"` — **extraído para
  `src/utils/text-search.js` nesta rodada** (regra 4: era local em 2 views, o
  rollout é a 3ª ocorrência). Não redefinir local em view nenhuma.
- Aplicar o filtro de busca no MESMO array já filtrado que a view usa (o
  `filtered`/`scoped` de cada uma), nunca no array cru — regra 11.
- Renderizar via `<FilterBar search={{ value, onChange, placeholder }} />`,
  **fora do bloco condicional de `viewMode`**, dentro do header compartilhado.
  Isso faz a busca valer em Kanban, Tabela, Calendário e Análise de graça.
- `placeholder` no vocabulário do board: "Buscar negócio…", "Buscar caso…",
  "Buscar campanha…", "Buscar solicitação…", "Buscar tarefa…", "Buscar
  colaborador…", "Buscar vaga…".
- **Quais campos buscar**: os que aparecem no card. Título/nome sempre; mais o
  número de protocolo/solicitação quando existir, quem pediu/responsável, e o
  vínculo mais óbvio (campanha, cliente, colaborador). Não buscar em campo que
  o usuário não vê no card — ele não entende por que casou.

### 4. `<select>` cru → `FilterBar filters={[...]}`

Cada `<select>` de filtro com estilo inline vira uma entrada no array
`filters` do `FilterBar` compartilhado (`id`, `label`, `value`, `onChange`,
`options`). Filtro condicionado a cargo entra com spread condicional, como em
`EntregasView` (`...(isManager ? [{...}] : [])`).

## O que NÃO fazer

- Não mexer em regra de negócio, RLS, hook ou schema. É rollout de padrão
  visual/estrutural, mais o filtro de busca.
- Não criar variante nova de nada. Se algo não encaixa, **pare e reporte** em
  vez de inventar um terceiro jeito (CLAUDE.md, regra 2).
- Não mexer no `PURCHASE_STAGES` hardcoded de Compras — exceção deliberada
  registrada no CLAUDE.md.
- Não tocar em `LeadDetailDrawer` nem em drawer nenhum. O escopo é a view do
  board.
- Não bump de versão nem changelog: o orquestrador faz uma entrada só no fim,
  pra rodada inteira.

## Fechamento

`npm run build` (NUNCA `npx vite build` — o gate de consistência está no
`prebuild` do npm e o vite direto passa por cima dele em silêncio).
