# Grade Sem Buracos — redesign de "Minhas Tarefas"

Ângulo: faixa de resumo (`StatCard`) + uma única grade (`Card`/`CardGrid`) substituindo os 3 grids
separados de hoje. Nenhuma seção "sozinha na tela" — o mecanismo que resolve isso é geometria de
grid, não Tabs.

## Problema observado

Arquivo: `src/components/views/MinhasTarefasView.jsx`.

1. **Vazio de grid** (`:186`, `grid md:grid-cols-2 lg:grid-cols-3`) — Tailwind cria 3 colunas
   explícitas fixas independente de quantos módulos existem. Com 1 módulo só, o item ocupa a
   coluna 1 e as colunas 2/3 continuam reservadas (vazias), porque a função de dimensionamento se
   aplica a todas as faixas do grid, preenchidas ou não. O resultado não é "sem graça", é
   literalmente 2 colunas fantasmas — parece que faltou renderizar algo.
2. **Cabeçalho ad hoc por seção** (`TaskSection`, `:147-176`) — ícone 26px + título + hint + badge
   de contagem hand-rolled (`<span style={pill}>`), 3× repetido, exatamente o padrão que
   `docs/design-spec-padroes-de-pagina.md` (seção 0) já cataloga como duplicação confirmada.
3. **`ModuleBucket`** (`:204-275`) reimplementa card com header+lista na mão — não usa
   `ui/Badge.jsx` (usa `<span>` com opacidade hex manual), não usa `ui/EmptyState.jsx` (o vazio de
   seção em `:178-184` é uma div própria), não usa nenhum `Card` compartilhado. O vazio global
   (`:121-130`, "Tudo em dia") **também** é uma div ad hoc, não `ui/EmptyState.jsx` — achado extra,
   mesma causa raiz do item 3 do backlog.
4. **Sem faixa de resumo** — `:103-109` só tem texto ("N pendências espalhadas"), nenhum número em
   destaque visual.

## Visão geral da proposta

```
[Saudação]
[Faixa de 4 StatCard: Total · Responsabilidades · Aprovação · Alertas]
[UMA CardGrid contínua:
   cabeçalho de grupo "Responsabilidades" (linha cheia, grid-column: 1 / -1)
   → cards de módulo (ou 1 card de vazio-de-seção)
   cabeçalho de grupo "Aguardando aprovação"
   → cards de módulo (ou 1 card de vazio-de-seção)
   cabeçalho de grupo "Alertas e pendências"
   → cards de módulo (ou 1 card de vazio-de-seção)
]
```

Sem `Tabs`. Justificativa na seção de decisões subjetivas.

## Especificação visual

### 1. Faixa de resumo (resolve o problema 4)

`className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"` — reaproveita literalmente a
classe já usada em `InsightsView.jsx:146,163,180`, não inventa breakpoint novo. 4 `StatCard`
(`src/components/ui/StatCard.jsx`), sem props novas no componente:

| Tile | icon | value | label | sublabel | accent |
|---|---|---|---|---|---|
| Total | `LayoutGrid` (novo import, lucide já é dependência) | `totalTasks` | "Pendências totais" | — | `"var(--text)"` sempre — mesmo idioma de `ExecutiveDashboard.jsx:266` (tile de destaque neutro escuro numa visão agregada entre múltiplas empresas, não a cor de marca de uma única empresa) |
| Responsabilidades | `CheckSquare` | `counts.responsibility` | "Responsabilidades" | — | nenhum (tile plano) |
| Aguardando aprovação | `Inbox` | `counts.approval` | "Aguardando minha aprovação" | — | nenhum (tile plano) |
| Alertas e pendências | `AlertTriangle` | `counts.alert` | "Alertas e pendências" | `${nCríticos} crítico(s)` quando houver, senão omitido | `"var(--warning)"` **só quando** existe ao menos 1 tarefa do bucket `alert` com `badgeTone !== "var(--success)"` (i.e. não é só aniversário/bodas) — senão tile plano |

A condição de accent do tile de Alertas reaproveita literalmente o idioma já usado em
`RHFornecedoresView.jsx:595` (`accent={vencendo.total > 0 ? "var(--warning)" : undefined}`) e
`SignalsView.jsx:130` — nenhum uso de `StatCard` na base hoje usa `accent="var(--danger)"` (grep
confirmado). Ver decisão subjetiva #2.

Nenhum tile é clicável — grep confirma zero usos de `StatCard` como controle interativo em toda a
base; manter esse contrato aqui também.

### 2. Grade única (resolve o problema 1 e parte do 3)

Uma só `<div>` com grid, **não** o `CardGrid` default de `src/components/shared/Card.jsx:10-19` —
o default usa `repeat(auto-fill, minmax(260px, 1fr))`, que **não resolve** o vazio: `auto-fill`
mantém as faixas vazias reservadas (sizing function se aplica a toda faixa criada, ocupada ou não);
`1fr` sem teto faria um card sozinho esticar até 100% da largura do container, só movendo o "buraco"
pra dentro do próprio card (linhas de tarefa de ~300px de conteúdo dentro de um card de 900px).

Especificação exata pra esta tela:

```
display: grid
grid-template-columns: repeat(auto-fit, minmax(280px, 360px))
gap: 14px
```

- `auto-fit` colapsa faixa vazia a 0 e redistribui o espaço livre só entre faixas com conteúdo —
  isso é o que elimina as colunas fantasmas.
- Teto de `360px` evita que um card sozinho na linha estique sem limite — ele cresce até 360px e o
  restante da linha fica como margem final normal (o mesmo efeito visual de "sobrou espaço depois
  do último card de uma linha com vários", que ninguém lê como quebrado).

Isto é uma divergência pontual do `CardGrid` compartilhado — sinalizado explicitamente na seção de
trade-offs, decisão de implementação (prop nova opcional vs. grid local) fica com o frontend-agent.

### 3. Cabeçalho de grupo (resolve o problema 1 — "1 módulo sozinho" — e o 2)

Divisor de largura total dentro da MESMA grade (`gridColumn: "1 / -1"`), um por seção, ordem fixa
Responsabilidades → Aguardando aprovação → Alertas (mantém a prioridade que já existe em `SECTIONS`,
`:15-40`):

| Propriedade | Valor |
|---|---|
| Borda inferior | `1px solid var(--border)` |
| Espaçamento | `padding-bottom: 8px`, `margin-bottom: 10px` acima dos cards do grupo |
| Ponto de identidade | círculo 8px, cor = tone da seção (Responsabilidades `#1D4ED8` — mesmo hex hardcoded hoje em `SECTIONS[0].tone`, que **já coincide** com `Badge.jsx` variante `secondary`, `:12`; Aprovação `var(--warning)`; Alertas `var(--danger)`) |
| Título | 13px/700, `var(--text)` |
| Hint | 12px, `var(--text-dim)`, `hidden sm:inline`, separado do título por " · " na mesma linha (não empilhado como hoje) |
| Badge de contagem | `ui/Badge.jsx` `size="sm"` — **só renderiza se `count > 0`** (esconder "0" evita ruído quando o card de vazio-de-seção já abaixo comunica isso) |

Isto substitui o cabeçalho ad hoc de `TaskSection` (`:147-176`) por um único idioma consistente,
usando `Badge.jsx` em vez do `<span>` manual — resolve o problema 2 sem reintroduzir um "4º padrão"
novo (é usado 3× dentro da mesma tela, não espalhado por telas diferentes — não atinge o gatilho de
extração da regra 4 do CLAUDE.md ainda).

### 4. Card de módulo (resolve o problema 3)

Usa `Card` de `src/components/shared/Card.jsx` diretamente, sem modificar o componente:

| Prop | Valor |
|---|---|
| `icon` | ícone do módulo (já vem em `task.icon` via `useMyTasks`) |
| `iconBg` | `${sectionTone}14` — mesmo truque de opacidade hex já usado hoje em `:155,219` (`tone + "14"`), só relocado pra dentro do prop do `Card` |
| `title` | `moduleLabel` |
| `meta` | rótulo curto da seção: `"Responsabilidade"` / `"Aprovação"` / `"Alerta"` — cor já vem fixa do `Card` (`var(--text-faint)`), não sobrescrever |
| `badges` | um `<Badge size="sm">` — ver regra de variante abaixo |
| `children` | lista de tarefas — **reaproveita pixel a pixel** o markup de linha já existente hoje (`:231-259`: bullet 6px, título 13px/600, subtitle 12px dim, badge de tarefa, hover `var(--surface-alt)`) — zero mudança visual aqui, só realocado pra dentro do slot `children` do `Card` |
| `footer` | "+N mais em {title}" quando houver overflow (`:260-271`, comportamento idêntico) — agora ganha de graça a borda superior `1px solid var(--border)` já embutida no `Card` |
| `menu` | nenhum |
| `interactive` / `onClick` | **nenhum** — o card inteiro não navega, só as linhas de tarefa individuais (evita o hover-elevate + "Ver detalhes" do `Card`, que seria enganoso: nada acontece clicando no fundo do card) |
| `density` | `"grid"` sempre — o toggle grade/lista do Padrão C não se aplica aqui (não é catálogo de navegação, é um resumo de trabalho pendente; ver decisão subjetiva) |

Regra de variante do `Badge` de contagem (mesma lógica usada pro Badge do cabeçalho de grupo, pra
consistência vertical):

- Grupo **Responsabilidades**: sempre `variant="secondary"`.
- Grupo **Aprovação**: sempre `variant="urgent"`.
- Grupo **Alertas**: `variant="critical"` se o bucket tem ≥1 tarefa com `badgeTone === "var(--danger)"`; senão `variant="urgent"` se tem ≥1 com `badgeTone === "var(--warning)"`; senão `variant="success"` (bucket só com aniversário/bodas).

### 5. Card de vazio-por-seção (resolve o problema 3, caso `count === 0`)

Quando um grupo não tem nenhum módulo com item, ele ocupa **um único slot** da mesma grade (não uma
faixa cheia, não um componente diferente) — casca do `Card` (borda `var(--border)`, raio
`var(--radius-lg)`, sombra `var(--shadow-card)`, fundo `var(--surface)`) contendo
`ui/EmptyState.jsx` sem modificação:

| Grupo | `icon` (EmptyState) | `title` | `description` (nova, curta) |
|---|---|---|---|
| Responsabilidades | `CheckSquare` | "Nada sob sua responsabilidade no momento." (texto já existente, `SECTIONS[0].empty`) | "Cards em que você for responsável, em qualquer módulo, aparecem aqui automaticamente." |
| Aprovação | `Inbox` | "Nada esperando sua aprovação." (já existente) | "Itens que seu cargo pode decidir aparecem aqui assim que alguém solicitar." |
| Alertas | `AlertTriangle` | "Nada urgente por aqui." (já existente) | "Condições como ASO vencido, contrato terminando ou avaliação atrasada aparecem aqui em tempo real." |

Como está sozinho na sua própria linha (o cabeçalho de grupo força quebra de linha antes dele), o
`auto-fit` não estica esse card além do teto de 360px, e a altura da linha não é distorcida por
cards de outros grupos.

### 6. Ordenação de cards dentro de cada grupo

- **Alertas**: bucket com ≥1 tarefa `badgeTone !== "var(--success)"` vem primeiro (reaproveita a
  mesma distinção que a função `toneTier` já existente no arquivo, `:48-52`, faz por tarefa —
  aplicada agora também no nível do bucket), empate por quantidade de itens decrescente.
- **Responsabilidades / Aprovação**: `badgeTone` é uniforme dentro do bucket (sem gradiente de
  severidade) — ordena só por quantidade de itens decrescente.

A ordenação das tarefas **dentro** de cada bucket (`byUrgency`, `:54-60`) não muda.

## Comportamento por estado

**Carregando** (`loading === true`): faixa de resumo vira 4 blocos `animate-pulse` (mesma silhueta
de um `StatCard` real: caixa 36×36 + barra de valor + barra de label). Grade vira 4–6
`CardSkeleton` (já exportado em `src/components/shared/Card.jsx:204-246`, zero código novo),
dispostos na mesma grid `auto-fit/minmax(280,360)` — sem cabeçalho de grupo durante o carregamento
(evita cabeçalho de uma seção que pode acabar vazia).

**Vazio global** (`totalTasks === 0`, só depois de carregar): substitui a div ad hoc de `:121-130`
por `<EmptyState icon={CheckSquare} title="Tudo em dia!" description="Nenhuma tarefa pendente no momento." />`
centralizado — faixa de resumo **não** aparece nesse estado (4 tiles com "0" seria anticlimático).

**Vazio por seção**: ver seção 5 acima — card único de `EmptyState` dentro da mesma grade, cabeçalho
de grupo continua aparecendo (sem o badge de contagem, já que é 0).

**Hover**: card de módulo nunca eleva (não é link). Linha de tarefa individual: comportamento
idêntico ao atual, fundo `var(--surface-alt)` (`:235-238`, inalterado). Rodapé "+N mais": mesmo
hover de hoje (`:264-266`), agora dentro do slot `footer` do `Card`.

**Item urgente** (`badgeTone === "var(--danger)"`): linha de tarefa não muda (bullet + badge chip já
corretos hoje). Efeitos novos, só nesta proposta: (a) bucket com item assim sobe pro topo do grupo
Alertas; (b) badge de contagem do card vira `variant="critical"`; (c) tile "Alertas e pendências" da
faixa de resumo acende `accent="var(--warning)"` quando há qualquer item não-`success` no bucket
(não exclusivo de `--danger`, ver decisão subjetiva #2).

## Notas de decisão subjetiva

1. **Cabeçalho de grupo dentro da grade vs. Tabs "Tudo"/3 seções**: escolhi cabeçalho de grupo. Uma
   `Tabs` esconderia 2 das 3 seções por vez — contra a razão de existir desta tela (agregação
   cross-módulo num único olhar). Alternativa considerada e descartada: faixa lateral colorida por
   card sem nenhum divisor de texto — mais enxuto, mas perde o rótulo qualitativo ("isso é uma
   responsabilidade sua" vs. "isso é um alerta") que o hint textual carrega.
2. **Cor de escalada do tile "Alertas" — `var(--warning)` em vez de `var(--danger)`**: os únicos 2
   precedentes reais de `accent` condicional em `StatCard` na base (`RHFornecedoresView.jsx:595`,
   `SignalsView.jsx:130`) usam `var(--warning)`, mesmo quando o dado subjacente se chama "crítico".
   Usar `var(--danger)` aqui criaria um idioma novo (tile inteiro vermelho sólido) sem precedente.
   Severidade real não se perde — o badge de tarefa individual continua `var(--danger)` quando
   cabe.
3. **Tile "Total" com `accent="var(--text)"` em vez de `var(--accent)`**: segue o precedente de
   `ExecutiveDashboard.jsx:266`, também uma visão agregada entre empresas — `var(--accent)` muda por
   frente comercial (`COMPANIES[companyId].primary`) e essa tela não tem uma empresa só no escopo.
4. **Teto de 360px no card de módulo**: rejeitei `1fr` sem limite (estica card sozinho até 100% da
   largura) por só mover o "espaço vazio" pra dentro do próprio card em vez de eliminá-lo.
5. **Sem toggle grade/lista** (`GridListToggle`, já existe pronto): decisão fechada em 23/07 com o
   Daniel cobre catálogo/seletor (Padrão C); esta tela não é nem um nem outro — é um resumo de
   trabalho, não uma lista pra navegar/filtrar em massa. Considerei incluir mesmo assim por
   consistência de plataforma, mas descartei por não haver necessidade real (poucos itens por
   bucket, MAX_ITEMS_PER_MODULE=5 já limita).

## Trade-offs honestos

- **Sem atalho pra pular direto a uma seção**: numa conta com muitos alertas (ex.: gerente de RH com
  20+ pendências de conformidade), a grade fica longa e rolar até "Alertas" exige passar por tudo
  antes — uma versão com Tabs resolveria isso à custa de esconder as outras seções. Não resolvido
  aqui; se o volume real crescer, um atalho de âncora nos `StatCard` (sem virar filtro que esconde
  conteúdo) é o próximo passo natural.
- **Diverge do `CardGrid` compartilhado**: `auto-fit` + teto de 360px é diferente do
  `repeat(auto-fill, minmax(260px, 1fr))` hardcoded em `src/components/shared/Card.jsx:15`. Exige
  do frontend-agent decidir entre estender `CardGrid` com uma prop opcional (default preservado pros
  7+ consumidores atuais) ou desviar do componente só nesta tela — decisão de implementação que
  esta spec não fecha sozinha.
- **Cabeçalho de grupo mais enxuto** (ponto 8px em vez do ícone 26px colorido de hoje) perde um
  pouco de identidade visual chamativa por seção — trocado deliberadamente por discrição, mas se
  Daniel achar pouco "escaneável" depois, o ícone grande pode voltar.
- **Card de vazio-por-seção usa `EmptyState` sem adaptação de tamanho** (ícone 60px, `py-16`) —
  fica um pouco mais alto que um card populado hoje (ordem de grandeza parecida, não idêntica); se o
  card populado encolher no futuro esse descompasso de altura fica mais visível.
- **Sem paginação/"mais buckets"**: com ~12 módulos possíveis hoje a grade cabe numa tela razoável;
  não antecipa um cenário de dezenas de módulos novos.
