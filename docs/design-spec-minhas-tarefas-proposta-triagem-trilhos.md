# Triagem em Trilhos — proposta de redesign para "Minhas Tarefas"

Arquivo-alvo: `src/components/views/MinhasTarefasView.jsx`. Esta é uma
proposta de **direção visual** (uma de três em avaliação) — não implementar
sem o Daniel escolher esta direção. Segue o processo da regra 3 do
`CLAUDE.md`: esta é a etapa de Design; Frontend só entra depois de decisão
tomada.

**Não muda `useMyTasks` nem o shape de `task`** (`{id, module, moduleLabel,
icon, bucket, title, subtitle, badge, badgeTone, urgencyRank, section, lead?}`)
— só a apresentação.

---

## Ângulo

As 3 categorias de hoje (Responsabilidades / Aguardando aprovação / Alertas)
viram **3 colunas fixas lado a lado**, sempre visíveis, sem scroll de
página — a mesma linguagem visual madura do Kanban da plataforma
(`KanbanColumnHeader`, `useAvailableHeight`, o visual de card do
`RHKanbanCard`), só que aqui as colunas não são etapas reais de um pipeline
(não existe "mover de etapa" — não há drag, não há `MoveStageMenu`). É
Kanban emprestado como **vocabulário de triagem**, não como motor de
pipeline: o card nunca muda de coluna sozinho, cada coluna é uma lista fixa
que só reordena por urgência conforme os dados mudam.

Mudança estrutural chave: o "ModuleBucket" (agrupar por módulo dentro da
seção) desaparece. Dentro de cada coluna os cards de **todos os módulos** ficam
numa lista única, ordenada só por urgência (`toneTier` + `urgencyRank`, a
mesma função `byUrgency` já existente, linhas 54-60) — cada card comunica seu
módulo de origem sozinho (chip com ícone + label), não mais um cabeçalho de
grupo. Isso é uma melhoria real, não só uma consequência: hoje o item mais
urgente da coluna pode estar enterrado dentro do bucket do módulo dele; achatado,
o item mais crítico de qualquer módulo sobe pro topo da coluna.

---

## Como cada um dos 4 problemas concretos é resolvido

1. **Grid com vazio enorme quando só 1 módulo tem itens**
   (`MinhasTarefasView.jsx:186-199`) — resolvido por construção: não existe
   mais grid de módulos. Cada coluna é uma lista vertical de largura total da
   coluna (`display:flex; flex-direction:column`); com 1 item ou com 40, a
   largura da coluna é sempre 100% ocupada. Não há "célula vazia" possível
   porque não há mais células.

2. **Cabeçalho ad hoc por seção** (`:150-176`, div estilizada na mão, ícone
   26px + título + hint + badge flutuante) — substituído por uma instância de
   `src/components/shared/KanbanColumnHeader.jsx` por coluna, componente já
   maduro e usado nos boards de Pipeline/Entregas/Pós-venda. A faixa colorida
   do topo cobre a identidade da coluna, `(count)` já vem embutido ao lado do
   nome (não é mais um badge solto flutuando), e o hint vira o `children` do
   componente (linha secundária, ver detalhamento abaixo). Zero div nova.

3. **`ModuleBucket` reimplementando card sem usar componentes compartilhados**
   (`:204-275`) — removido inteiramente. O card de tarefa individual passa a
   usar `ui/Badge.jsx` (chip de urgência) e o vocabulário visual exato do
   `RHKanbanCard.jsx` (sombra/hover/raio — ver seção 3 abaixo). Estado vazio de
   coluna usa `ui/EmptyState.jsx` em vez da div própria (`:178-184`).

4. **Sem faixa de resumo no topo** (`:103-109`, só texto "N pendências…") —
   adiciona uma fileira de 3 `ui/StatCard.jsx` (um por coluna) entre o
   cabeçalho e as colunas, com o valor grande (32px/800) que hoje não existe
   em lugar nenhum da tela.

---

## Especificação visual

### 1. Cabeçalho da página (`h1` + subtítulo)

Mantém a saudação (`greetingFor`, linha 277-282) sem mudança. O parágrafo
abaixo do `h1` (`:103-109`, "N pendências espalhadas…") só aparece durante o
carregamento ("Carregando suas tarefas…" — texto igual ao de hoje). Assim que
`loading` vira `false`, o parágrafo **some** — a fileira de `StatCard`
(carregada ou o `EmptyState` de "tudo em dia") passa a carregar essa
informação, então repetir o número em texto embaixo do `h1` é redundante.

### 2. Fileira de resumo — 3 `StatCard`

Grid `grid-cols-1 sm:grid-cols-3 gap-3` (12px), acima das colunas. Cada tile:

| Coluna | `icon` | `value` | `label` |
|---|---|---|---|
| Responsabilidades | `CheckSquare` | `counts.responsibility` | "Responsabilidades" |
| Aguardando aprovação | `Inbox` | `counts.approval` | "Aguardando aprovação" |
| Alertas | `AlertTriangle` | `counts.alert` | "Alertas e pendências" |

Sem `accent`, sem `trend`, sem `sublabel` — tile neutro (ícone cinza em
`var(--surface-alt)`, valor `var(--text)`), decisão registrada na seção de
notas abaixo. `compact` não passado (usa o tamanho de valor padrão, 32px).

### 3. As 3 colunas (desktop, `≥ lg` / 1024px — mesmo breakpoint que
   `KanbanFab`/o board desktop de `CRMView.jsx` já usam)

Grid: `grid-template-columns: repeat(3, minmax(280px, 1fr))`, `gap: 16px`.
280px é o mesmo piso de largura já usado nas colunas estreitas do board real
(`CRMView.jsx:922-923`, `width:272`/`minWidth:272` — aqui um pouco mais largo
porque são só 3 colunas, não uma fileira de 6+). 16px de gap (um pouco mais
generoso que o `gap-2`/8px do board de etapas, porque aqui as colunas são
largas e poucas, não uma fileira apertada de mini-colunas).

**Altura**: `useAvailableHeight(24, [loading, totalTasks])` — mesmo hook de
todo Kanban da plataforma, medindo do topo da fileira de colunas até o
rodapé da viewport. Sem `trailingRef` (não há nada depois das colunas nesta
tela). Cada coluna usa essa altura (`height: columnsHeight`) e tem scroll
vertical **independente** (`overflow-y: auto` só no corpo de cards, não na
coluna inteira — o cabeçalho fica fixo no topo da coluna).

**Casca de cada coluna** — reaproveita literalmente o visual do board real
(`CRMView.jsx:915-930`):
- `background: var(--surface-alt)`
- `border: 1px solid var(--border)`
- `border-radius`: classe Tailwind `rounded-lg` → **`var(--radius-md)`
  (8px)** neste projeto (`tailwind.config.js:73`, não confundir com
  `var(--radius-lg)`/12px usado pelo `Card.jsx` de catálogo — são raios
  diferentes por design, o board de Kanban sempre usou o menor).
- `overflow: hidden`, `display: flex; flex-direction: column`.

**Cabeçalho da coluna** — `KanbanColumnHeader` com props padrão do
componente (as mesmas usadas pelos 7 boards que ainda não passaram pelo
"Redesign v2" — Marketing/Compras/RH — e não as props `nameColor`/
`nameFontSize` maiores usadas só por Pipeline/Entregas/Pós-venda, porque
aqui não são etapas reais de um pipeline configurável, ver nota de decisão
2 abaixo):
- `color`: tom da seção — **mantém os valores já hardcoded no arquivo hoje**
  (`:21,29,37`): `"#1D4ED8"` (Responsabilidades — mesmo azul do `Badge`
  variant `secondary`, não é hex novo), `"var(--warning)"` (Aprovação),
  `"var(--danger)"` (Alertas).
- `name`: `section.title` (mantém as 3 strings existentes).
- `count`: `counts[section.id]`.
- `bandHeight`, `nameColor`, `nameFontSize`, `uppercase`: **não passar** —
  usar os defaults do componente (banda de 8px, nome `var(--text)` 11px/600
  maiúsculo + `(count)` ao lado, mesmo estilo).
- `children`: o hint atual (`section.hint`, as 3 strings de `:19,27,35`) num
  `<div>` `font-size:11px; color:var(--text-dim); margin-top:2px; line-height:1.3`.

### 4. Card de tarefa (substitui `ModuleBucket`'s linhas internas, `:230-259`)

Reaproveita o **vocabulário visual** do `RHKanbanCard.jsx` (não o componente
inteiro — ele embute `MoveStageMenu`/detecção de etapa terminal, que não se
aplicam aqui; ver nota de decisão 1). Números exatos, copiados de
`RHKanbanCard.jsx:35-51`:

- Padding `14px` (`p-3.5`), `border-radius: var(--radius-md)` (8px,
  `rounded-lg`), `border: 1px solid var(--border)`.
- `box-shadow: var(--shadow-card)` em repouso.
- Hover (150ms transition): `border-color: var(--border-strong)`,
  `box-shadow: var(--shadow-pop)`, `transform: translateY(-1px)`.
- Interativo via `role="button"` + `tabIndex=0` + `onKeyDown` (Enter/Espaço
  ativa) — mesmo padrão de acessibilidade do `Card.jsx` compartilhado
  (`src/components/shared/Card.jsx:55-70`), reaproveitado como receita, não
  como import (o shape do `Card.jsx` — ícone 38px, footer com borda,
  "Ver detalhes" — é pesado demais pra uma linha de lista compacta).

**Anatomia interna** (3 linhas, `display:flex; flex-direction:column; gap:6px`):

1. **Linha do módulo + urgência** — `display:flex; align-items:center; gap:8px`:
   - Chip do módulo: 20×20px, `border-radius: 6px`, `background:
     var(--surface-alt)`, ícone `task.icon` 12px `color: var(--text-dim)`.
     **Sempre neutro** (nunca colorido pelo módulo) — ver nota de decisão 3.
   - Label do módulo: `task.moduleLabel`, 11px/600, `color: var(--text-dim)`.
   - `margin-left: auto` → `ui/Badge.jsx` com `size="sm"`, conteúdo
     `task.badge`, variante mapeada de `task.badgeTone` (tabela abaixo —
     **não usar `customColor={task.badgeTone}` diretamente**, ver nota de
     decisão 4, é um bug real de concatenação de string).

   | `task.badgeTone` | `Badge` `variant` |
   |---|---|
   | `"var(--danger)"` | `critical` |
   | `"var(--warning)"` | `urgent` |
   | `"var(--success)"` | `success` |
   | qualquer outro (ex.: `"var(--text-dim)"`, informativo) | `neutral` |

2. **Título** — `task.title`, 13px/700, `color: var(--text)`, `truncate`.
3. **Subtítulo** — `task.subtitle` (só se existir), 12px, `color:
   var(--text-dim)`, `truncate`.

**Item urgente** (`task.badgeTone === "var(--danger)"`) — além do `Badge`
`critical` na linha 1, o card ganha `border-left: 3px solid var(--danger)` e
`padding-left` reduz de 14px pra 11px (14 − 3, pra não deslocar o texto
interno) — um sinal adicional de escaneio rápido rolando a coluna, distinto
do chip pequeno. Isso usa `var(--danger)` diretamente (válido, é um valor de
`border`, não uma concatenação de string) — sem esse tratamento extra o
tom crítico fica pequeno demais pra saltar aos olhos numa lista longa.

### 5. Corpo de cards da coluna

`padding: 10px; display:flex; flex-direction:column; gap:8px; flex:1;
overflow-y:auto; min-height:0` (o `min-height:0` é necessário pro scroll
funcionar dentro de um flex column, mesmo detalhe já usado em
`CRMView.jsx:972`).

### 6. Mobile (`< lg`)

Sem grid de 3 colunas — usa `src/components/shared/Tabs.jsx` (segmented
control já extraído) pra alternar qual coluna é exibida por vez, cada uma
ocupando a largura toda, sem clamp de altura (scroll natural da página, como
o resto da plataforma em mobile):

- `Tabs` com 3 abas, labels **curtos** (diferente do título completo do
  cabeçalho desktop, que não cabe numa aba): "Minhas" (Responsabilidades),
  "Aprovação", "Alertas". Cada aba usa `icon` (mesmo ícone da seção) e
  `count` (prop já suportada pelo `Tabs.jsx`, `t.count != null`) —
  reaproveitamento direto, zero prop nova.
- Aba ativa default: a primeira seção (na ordem Responsabilidades → Aprovação
  → Alertas) com `count > 0`; se todas zeradas, cai em Responsabilidades.
- Abaixo do `Tabs`: lista de cards da seção ativa, mesmo componente de card
  da seção 4, sem `useAvailableHeight` (mobile não clama altura).

### 7. "Ver mais" — sem corte por módulo, cap suave por coluna

O corte antigo (`MAX_ITEMS_PER_MODULE = 5`, por módulo, dentro de um bucket
apertado) deixa de existir — não faz sentido numa coluna com scroll vertical
próprio. Em vez disso, cada coluna renderiza os primeiros **30** itens
(depois de ordenados por `byUrgency` num único array, cruzando módulos) e, se
sobrar mais, mostra um botão "Carregar mais N" no fim da lista (dentro da
área de scroll, revela o próximo lote de 30 no mesmo lugar — não navega,
não pagina por página separada). Visual do botão: `ChevronDown` 12px +
texto 12px/600 `color: var(--text-dim)`, hover `background: var(--surface-alt)`
+ `color: var(--text)` — mesmo tratamento do antigo botão "+N mais"
(`:260-271`), só trocando o ícone `ArrowRight` por `ChevronDown` (o antigo
navegava pra outro módulo; este só revela mais linhas no mesmo lugar — ver
nota de decisão 5 sobre o que se perde com essa troca).

`groupByModule` (linhas 62-73) fica sem uso nesta direção — a coluna filtra
`tasks` por `bucket` e ordena direto com `byUrgency`, sem passar por
agrupamento de módulo.

---

## Comportamento por estado

1. **Carregando** (`loading === true`): as 3 colunas já aparecem inteiras
   (cabeçalho com a cor/nome/hint reais, `count` como `"–"` no lugar do
   número), corpo com 3 blocos cinza (`background: var(--surface-alt)`,
   `border-radius: var(--radius-md)`, altura ~60px cada, `animate-pulse` do
   Tailwind — mesma técnica do `CardSkeleton` em `Card.jsx:204-246`, adaptada
   pro card mais compacto). Layout não pula de "um spinner central" pra "3
   colunas" quando os dados chegam — reforça a promessa de "sempre 3 colunas
   visíveis, sem rearranjo de página". Fileira de `StatCard` **não** aparece
   ainda (não tem número real pra mostrar) — só some quando `loading` vira
   `false`.
2. **Vazio total** (`loading === false && totalTasks === 0`): esconde a
   fileira de `StatCard` e a grade de 3 colunas inteira — mostra só um
   `ui/EmptyState.jsx` centralizado (`icon={CheckSquare}`, `title="Tudo em
   dia!"`, `description="Nenhuma tarefa pendente em nenhuma categoria."`,
   sem `action`). Evita mostrar 3 `StatCard` com "0" em cima de 3 colunas
   vazias — redundante.
3. **Vazio por coluna** (uma seção tem 0 itens, ex.: "Aguardando aprovação"
   pra um usuário sem cargo de aprovador — o caso mais comum listado no
   problema 1): a coluna continua inteira (cabeçalho com `(0)`), corpo mostra
   `ui/EmptyState.jsx` com a copy já existente da seção (`section.empty`,
   `:22,30,38`), sem `action`.
4. **Hover** (desktop e mobile, mesmo card): `border-color: var(--border-strong)`,
   `box-shadow: var(--shadow-pop)`, `translateY(-1px)`, 150ms — igual ao
   `RHKanbanCard`.
5. **Item urgente** (`badgeTone === "var(--danger)"`): `Badge` `variant="critical"`
   + `border-left: 3px solid var(--danger)` (seção 4 acima) — o único estado
   com um segundo sinal visual além do chip, deliberado (é a categoria que
   já dispara push notification em outro lugar da plataforma, conforme
   comentário de `use-my-tasks.js:376-382`).

---

## Notas de decisão subjetiva

1. **Reaproveitar o visual do `RHKanbanCard`, não o componente em si.**
   Opções: (A) importar `RHKanbanCard.jsx` literalmente, passando
   `stages`/`stage` fictícios só pra satisfazer a API; (B) recriar um card
   compacto com os mesmos tokens visuais (sombra/raio/hover), sem a máquina
   de `MoveStageMenu`/etapa terminal. **Escolhido: B.** O componente A é
   documentado como "shell" pros 5 boards de RH com drag-and-drop e menu de
   mover — forçar uma API que não se aplica (sem stages reais, sem mover)
   seria pior reuso do que copiar só os números de estilo, que é
   exatamente o padrão que o próprio prompt desta tarefa já sinaliza como
   válido ("reaproveitável visualmente mesmo fora de um board de etapas de
   verdade").

2. **Cabeçalho de coluna usa o estilo "clássico" (maiúsculo, banda 8px), não
   o "Redesign v2" (nome colorido, banda 4px) usado por Pipeline/Entregas/
   Pós-venda.** Opções: (A) estilo clássico (default do componente, usado
   pelos 7 boards ainda não migrados); (B) estilo v2 (usado pelos 3 boards
   já revisados contra print do Pipefy). **Escolhido: A.** O estilo v2 foi
   desenhado especificamente pra imitar a aparência de **etapa de pipeline
   real** (cor = identidade configurável da etapa). Aqui as 3 colunas não são
   etapas — são categorias fixas da plataforma — usar o estilo que sinaliza
   "isto é uma etapa de verdade" seria uma mentira visual.

3. **Chip do módulo dentro do card é sempre neutro (cinza), nunca colorido
   por módulo.** Opções: (A) neutro; (B) uma cor própria por módulo (Leads,
   Campanhas, Compras, RH…). **Escolhido: A.** Não existe hoje nenhum token
   de cor por módulo nos dados (`task` não carrega `moduleColor`) — inventar
   ~10 cores novas de módulo só pra este chip seria hex novo sem
   necessidade e competiria visualmente com a cor de urgência do `Badge` no
   mesmo card (dois sistemas de cor por card confundem qual delas importa).
   O `Badge` de urgência já é o único sinal de cor por card — o módulo se
   comunica só por ícone + texto.

4. **Mapear `badgeTone` pra `variant` do `Badge`, não usar `customColor`
   direto.** Achado técnico, não só estético: `Badge.jsx:16-17` monta o fundo
   como `customColor + "18"` — se `customColor` for a *string*
   `"var(--danger)"` (é exatamente o que `badgeTone` contém, ver
   `use-my-tasks.js`), o resultado é o CSS inválido `"var(--danger)18"` (não
   dá pra concatenar sufixo de alpha numa referência `var()`), e o fundo do
   badge simplesmente não aplica. Mapear pra `variant="critical"/"urgent"/
   "success"/"neutral"` evita esse bug e reaproveita as variantes já prontas.
   **Trade-off aceito**: as variantes do `Badge` usam hex fixo (ex.:
   `critical` = `#FEF2F2`/`#B91C1C`) que não reage a dark mode, enquanto
   `var(--danger)` reagiria automaticamente — mas isso já é verdade hoje em
   **todos** os 9+ usos existentes do `Badge` na plataforma (não é uma
   regressão nova introduzida por esta tela), então não vale consertar
   `Badge.jsx` só por causa desta tela. Se o Daniel notar isso em QA de dark
   mode, é um ajuste pontual em `Badge.jsx` — pequeno e centralizado — para
   uma sessão futura.

5. **"Ver mais" vira "carregar mais linhas na mesma lista", não "ir pro
   módulo X".** O comportamento antigo (`onSeeAll`, `:139,262`) navegava pra
   a tela do módulo com mais itens daquele bucket específico. Isso só fazia
   sentido porque cada bucket do grid antigo já era um módulo só. Com a
   lista achatada por urgência (misturando módulos), uma coluna pode ter
   Leads + RH + Campanhas juntos — não existe mais "um módulo" pra levar o
   usuário. Perdido: o atalho de 1 clique "ver todos os leads parados no
   board de CRM". Mantido: cada card individual já navega pro seu módulo de
   origem ao clicar (`handleTaskClick`, inalterado) — o usuário não perde a
   navegação, só o atalho de ir direto pra uma lista completa de só-um-módulo.

6. **`StatCard` não é clicável em nenhum breakpoint.** Cheguei a considerar
   usar o `StatCard` como atalho de navegação no mobile (clicar no tile
   troca a aba ativa do `Tabs` abaixo) — descartado porque o componente já
   define `cursor-default` no próprio elemento raiz (`StatCard.jsx:6`, classe
   `cursor-default`); um wrapper clicável por fora teria o cursor de "mão"
   sobrescrito pelo cursor explícito do filho na posição do mouse,
   produzindo um elemento clicável que parece não-clicável — pior UX que não
   ter o atalho. `StatCard` fica só como resumo glanceable, igual em
   desktop e mobile.

7. **Cap de "carregar mais" fixado em 30 itens por coluna.** Número
   arbitrário, não veio de nenhum volume real medido — ajustável depois que
   o Daniel usar a tela por um tempo e a equipe observar quantos itens uma
   coluna típica acumula (hoje o corte era 5 *por módulo*, dentro de um
   grid; 30 por coluna já cobre a maioria dos casos reais sem nunca precisar
   clicar).

---

## Trade-offs honestos desta direção

- **Altura fixa da tela em desktop é uma faca de dois gumes.** Ganha
  estabilidade (nunca rola a página, sempre visível) mas perde densidade em
  telas baixas — com `useAvailableHeight` cravando ~400-500px de coluna em
  notebooks de tela pequena, uma coluna com 15 itens vai exigir scroll
  *dentro* da coluna cedo, e o usuário pode nem perceber que há mais
  conteúdo abaixo sem uma pista visual de overflow (esta proposta
  deliberadamente não usa nenhum indicador de "tem mais pra rolar" — ver
  precedente em `KanbanBoardScrollArea.jsx:20-22`, o fade de borda foi
  removido do board real a pedido do usuário; aqui repete a mesma ausência
  por consistência, mas é uma aposta, não uma certeza).
- **Perde o agrupamento por módulo como unidade de leitura.** Quem confia no
  "bloco visual = 1 módulo" de hoje pra escanear rapidamente ("deixa eu ver
  só as Campanhas") perde esse agrupamento — a lista achatada por urgência
  prioriza "o que é mais urgente" sobre "o que é do mesmo tipo". É uma
  escolha filosófica desta direção (ângulo pedido: "triagem"), não uma
  otimização neutra.
- **3 colunas fixas assume que 3 é (e continuará sendo) o número certo de
  categorias.** Se um dia surgir uma 4ª categoria de tarefa, esta estrutura
  não escala bem (4 colunas de 280px mínimo já não cabem confortavelmente
  em 1024-1280px sem scroll horizontal, o que contradiz a premissa "sem
  scroll" da proposta inteira).
- **Sem virtualização de lista.** Colunas com centenas de itens (não é o
  caso hoje, mas nada impede de crescer, ex.: um gestor de RH com muitos
  colaboradores gerando muitos alertas de conformidade) vão renderizar 30
  cards de uma vez e crescer pra mais 30 a cada clique em "carregar mais" —
  aceitável nos volumes atuais, mas não uma solução de escala; virtualização
  de verdade (`react-window` ou equivalente) é deliberadamente fora de
  escopo aqui.
- **Perde o atalho de navegação "ver todos os itens deste módulo".** Já
  registrado na nota de decisão 5 — repetido aqui porque é uma perda real de
  funcionalidade, não só estética.
