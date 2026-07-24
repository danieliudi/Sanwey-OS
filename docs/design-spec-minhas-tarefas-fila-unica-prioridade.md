# Fila Única de Prioridade — redesign de "Minhas Tarefas"

Proposta de redesign de `src/components/views/MinhasTarefasView.jsx`. Ângulo:
abandonar as 3 seções fixas (Responsabilidades / Aprovações / Alertas) como
estrutura visual primária e virar **uma lista vertical única**, ordenada por
urgência real cruzando as 3 categorias — no espírito de um feed de
prioridade (Pipefy home / "Padrão A"), não de um dashboard em grade.

Esta spec **não muda `useMyTasks` nem o shape de `task`** — só a
apresentação. Todo campo usado abaixo (`bucket`, `module`, `moduleLabel`,
`icon`, `title`, `subtitle`, `badge`, `badgeTone`, `urgencyRank`, `section`,
`lead`) já existe hoje em `src/hooks/use-my-tasks.js`.

---

## Problema observado (recapitulando com achado extra)

1. **Grid vazio** — `MinhasTarefasView.jsx:186` (`grid md:grid-cols-2
   lg:grid-cols-3`) deixa espaço em branco enorme quando só 1 módulo tem
   itens numa seção (caso comum). **Resolvido estruturalmente**: esta
   proposta não usa mais nenhum grid de colunas para o conteúdo — é uma
   lista vertical (1 coluna sempre), então uma "célula vazia de grid" deixa
   de ser possível por construção, não por CSS defensivo.
2. **Cabeçalho ad hoc por seção** — `TaskSection` (`:147-202`) reimplementa
   ícone 26px + título + hint + badge de contagem, div estilizada na mão, 3×
   (uma por seção). **Resolvido**: não existe mais cabeçalho por seção. Só
   sobra 1 cabeçalho de página (saudação) + 1 faixa de `StatCard` + 1 barra
   de filtro (`Tabs`) — nenhum dos três se repete por tipo de tarefa.
3. **`ModuleBucket` reimplementa card com header+lista** (`:204-275`) sem
   usar `Badge`, `EmptyState` ou `Card` compartilhados. **Resolvido**: cada
   linha da lista passa a ser literalmente um `Card` (`src/components/shared/
   Card.jsx`) em `density="list"` — reuso direto, zero shell novo.
4. **Sem faixa de resumo** — só o texto solto `"N pendências espalhadas pela
   plataforma"` (`:106-108`), nenhum número em destaque. **Resolvido**: faixa
   de 4 `StatCard` no topo (ver seção de especificação).

### Achado extra — bug de CSS já existente, não introduzido por esta spec mas que a nova versão não deve repetir

`section.tone` e `task.badgeTone` hoje já vêm como **strings `var(--token)`**
(ex.: `"var(--warning)"`, `"var(--danger)"`) para as seções "approval" e
"alert" (`:29,37`) — só a seção "responsibility" usa hex puro (`"#1D4ED8"`,
`:21`). O código atual concatena alpha hex direto nessa string em 4 lugares:
`:155` (ícone da seção), `:171` (badge de contagem da seção), `:219` (ícone
do `ModuleBucket`), `:254` (badge de cada tarefa) — ex.
`background: section.tone + "14"`. Quando `tone`/`badgeTone` é `"var(--warning)"`,
o resultado é a string `"var(--warning)14"`, que **não é uma cor CSS válida**
— o navegador descarta o valor e o fundo fica transparente. Isso significa
que, hoje, o chip de contagem e o ícone das seções "Aprovação" e "Alertas"
provavelmente já renderizam **sem o fundo tingido pretendido** (só a cor do
texto/ícone aparece), enquanto a seção "Responsabilidades" (hex puro) é a
única que funciona como desenhado. Não é bloqueante pra esta tarefa, mas
**esta spec não reproduz o padrão** — todo tingimento novo abaixo usa
`color-mix(in srgb, var(--token) X%, transparent)`, que já é o padrão
estabelecido em `docs/design-spec-qw5-badge-vencimento-urgencia.md` e em
`RHOverviewView.jsx:574` para exatamente este caso (token CSS var + alpha).

---

## Especificação visual

### 1. Cabeçalho de página (só isto, sem mudança)

Mantém exatamente `greetingFor(currentUser)` como está hoje
(`MinhasTarefasView.jsx:277-282`, sem mudança de lógica). **Remove** a linha
de subtítulo solta (`"N pendências espalhadas pela plataforma"`,
`:103-109`) — a informação equivalente passa a viver, de forma visual, na
faixa de `StatCard` logo abaixo. Isso evita repetir o mesmo número em texto
solto **e** em tile grande na mesma tela.

### 2. Faixa de resumo — 4 `ui/StatCard.jsx`

Reaproveita `src/components/ui/StatCard.jsx` sem nenhuma modificação no
componente. Grid: `grid grid-cols-2 md:grid-cols-4 gap-3` — mesma proporção
já usada em `ExecutiveDashboard.jsx:265` (lá é `grid-cols-2 md:grid-cols-3
lg:grid-cols-6` pra 6 tiles; aqui são 4, então recorta em 2 breakpoints em
vez de 3). Como o número de tiles é sempre fixo (4, nunca depende de quantos
módulos têm itens), este grid não sofre do bug de "grid vazio" do problema 1
— só o grid de conteúdo variável (removido) sofria disso.

| # | Ícone | Valor | Label | Sublabel | `accent` |
|---|---|---|---|---|---|
| 1 | `Flame` (lucide-react, import novo) | contagem de tasks (cruzando os 3 buckets, **sem filtro de aba ativo** — sempre o total real) com `badgeTone === "var(--danger)"` | "Urgentes agora" | "Cruzando responsabilidades, aprovações e alertas" | `"var(--danger)"` |
| 2 | `CheckSquare` | `counts.responsibility` | "Responsabilidades" | — | — |
| 3 | `Inbox` | `counts.approval` | "Aguardando aprovação" | — | — |
| 4 | `AlertTriangle` | `counts.alert` | "Alertas ativos" | "Recalculado em tempo real" | — |

Tiles 2-4 sem `accent` (tile padrão, fundo `var(--surface)`, valor
`var(--text)` — como já é o default do componente). Tile 1 usa `accent`
sólido para ser o "número que resume a filosofia da tela" — ver nota de
decisão subjetiva sobre esse uso não seguir o único precedente hoje
(`ExecutiveDashboard.jsx:266`, que usa `accent="var(--text)"` pro maior
número, não uma cor semântica).

`StatCard` já tem `cursor-default` embutido (`StatCard.jsx:6`) — os 4 tiles
**não são clicáveis**; o filtro por categoria vive só na barra de `Tabs`
abaixo, pra não ter duas UIs fazendo a mesma coisa (tile clicável + aba
clicável seria redundante).

### 3. Barra de filtro — `Tabs` compartilhado, substitui as 3 seções fixas

Reaproveita `src/components/shared/Tabs.jsx` sem modificação:

```
<Tabs
  tabs={[
    { id: "all",            label: "Tudo",              count: totalTasks },
    { id: "responsibility", label: "Responsabilidades", count: counts.responsibility },
    { id: "approval",       label: "Aprovações",        count: counts.approval },
    { id: "alert",          label: "Alertas",           count: counts.alert },
  ]}
  active={filter}
  onChange={setFilter}
  iconOnlyMobile
/>
```

`iconOnlyMobile` — usar `icon` por tab (`CheckSquare`/`Inbox`/`AlertTriangle`,
sem ícone no tab "Tudo") e `iconOnlyMobile={true}`: é literalmente o mesmo
cenário (4 abas + label, não cabe em ~375px) que a prop já documenta ter
sido criada para resolver (`Tabs.jsx:14-18`, caso do `TutoriaisView`) — reuso
direto, zero ajuste no componente.

**Perda de conteúdo a registrar**: as 3 seções de hoje têm um texto de
"hint" explicativo (`:19,27,35` — ex. "Itens pendentes que seu(s) cargo(s)
permitem decidir agora"). `Tabs.jsx` não repassa `title`/tooltip por aba hoje
(o `<button>` interno não recebe atributos extras) — não vou modificar o
componente compartilhado pra isso (fora do escopo desta view). Se esse texto
precisar sobreviver em algum lugar, a spec cobre isso via o empty state
específico de cada aba (item 5 abaixo), que já carrega uma frase equivalente
quando a aba está vazia. Fora isso, o hint se perde como tooltip constante —
sinalizando isso explicitamente em vez de assumir que não importa.

### 4. Corpo da lista — agrupamento por severidade, não por tipo

**Critério de agrupamento**: estende `toneTier` (já existe,
`MinhasTarefasView.jsx:48-52`) — mas com uma mudança deliberada no
agrupamento (ver nota de decisão subjetiva): em vez de juntar
`var(--text-dim)` com `var(--warning)` no mesmo tier (como a função faz
hoje), esta proposta separa em 3 grupos visíveis ao usuário:

| Grupo | Critério (`task.badgeTone`) | Rótulo | Cor do indicador |
|---|---|---|---|
| 1 | `"var(--danger)"` | "Crítico" | `var(--danger)` |
| 2 | `"var(--warning)"` | "Atenção" | `var(--warning)` |
| 3 | `"var(--success)"` OU `"var(--text-dim)"` | "Em dia" | `var(--text-faint)` |

Dentro de cada grupo, ordena por `urgencyRank` ascendente (mesma regra de
`byUrgency`, `:54-60`, sem o desempate por tier que já foi promovido a
critério de agrupamento). A ordem final da lista é sempre Grupo 1 → 2 → 3,
**cruzando os 3 buckets** — um alerta de ASO vencido (`alert`, `var(--danger)`)
aparece antes de uma aprovação de compra comum (`approval`, `var(--warning)`),
que aparece antes de um lead de responsabilidade sem urgência (`responsibility`,
`var(--text-dim)`), independente de bucket.

**Filtro de aba** (item 3) aplica **antes** do agrupamento por severidade —
se o usuário está na aba "Aprovações", os 3 grupos existem só dentro do
subconjunto de `bucket === "approval"`.

**Grupo vazio não renderiza header** — mesmo princípio do problema 1: se o
subconjunto atual (após filtro de aba + corte de itens visíveis, item 6) não
tem nenhum item Crítico, o header "Crítico" simplesmente não aparece; nunca
um título de grupo "solto" sobre lista vazia.

Header de grupo (texto simples, não é um card):

```jsx
<div style={{ display: "flex", alignItems: "center", gap: 8, margin: isFirstGroup ? "0 0 8px" : "20px 0 8px" }}>
  <span style={{ width: 6, height: 6, borderRadius: "50%", background: tierColor }} />
  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>
    {tierLabel} · {tierCount}
  </span>
</div>
```

Grupos além do primeiro ganham `border-top: 1px solid var(--border)` +
`padding-top: 12px` extra (além do `margin-top: 20px` acima) pra separar
visualmente do último item do grupo anterior.

### 5. Linha da lista = `Card` compartilhado, `density="list"`

Reaproveita `src/components/shared/Card.jsx` (+ `CardGrid`) — **seria o
primeiro uso real de `density="list"` na plataforma** (grep confirma 0 usos
hoje); a capacidade já existe no componente, só nunca foi consumida.
Cada grupo de severidade renderiza um `<CardGrid density="list">` com os
`Card` daquele grupo dentro (o `gap:8` entre cards já vem do próprio
`CardGrid`, `Card.jsx:12`):

```jsx
<CardGrid density="list">
  {group.items.map(task => (
    <Card
      key={task.id}
      density="list"
      icon={<task.icon size={13} strokeWidth={2.4} />}
      title={task.title}
      meta={`${task.moduleLabel} · ${task.subtitle}`}
      status={{ color: BUCKET_META[task.bucket].dotColor, label: BUCKET_META[task.bucket].label }}
      footer={<UrgencyPill tone={task.badgeTone} label={task.badge} />}
      onClick={() => onTaskClick(task)}
    />
  ))}
</CardGrid>
```

Composição por campo, mapeada aos slots que `Card.jsx` (density list,
`:84-133`) já suporta — nenhum slot novo, nenhuma modificação no componente:

| Slot do `Card` | Conteúdo | Por quê |
|---|---|---|
| `icon` (26×26, `iconBg` default `var(--surface-alt)`) | `task.icon` do módulo | Já é o ícone que `ModuleBucket` usava (`:221`); mantém `iconBg` default do `Card` em vez de recolorir por seção (módulo não tem cor própria hoje — não inventar uma paleta nova sem dado que a sustente) |
| `title` (13px/700) | `task.title` | Igual a hoje |
| `meta` (12px, `var(--text-faint)`) | `` `${task.moduleLabel} · ${task.subtitle}` `` | **Composição nova**: como não existe mais a caixa do `ModuleBucket` com o nome do módulo no cabeçalho, o nome do módulo precisa entrar em algum texto visível na própria linha — prefixado ao `subtitle` já existente, sem inventar campo novo |
| `status` (dot + label, `:108-113` do `Card.jsx`) | Ver `BUCKET_META` abaixo | Sinaliza **tipo** (responsabilidade/aprovação/alerta) sem reinventar um badge — `Card` já tem esse slot pronto |
| `footer` (aceita qualquer node) | `<UrgencyPill>` (ver abaixo) | Sinaliza **urgência real** (`task.badge`/`task.badgeTone`) — sobrepõe a cor default do `footer` (que é `var(--text)` fixo) porque o `span` interno declara sua própria `color`, que tem precedência sobre o `color` herdado do `div` pai do `Card` |
| `onClick` | `onTaskClick(task)` (função já existe, `:86-93`, sem mudança) | `Card` já vira `interactive` automaticamente quando recebe `onClick` — hover eleva sombra/borda sozinho (`Card.jsx:39-51`), sem handler novo pra escrever |

Nenhum `menu` nem `headerAction` — a linha inteira é o alvo de clique (mesmo
padrão de affordance que `Card` já usa: cursor pointer + elevação no hover,
sem seta/chevron explícito — é o comportamento já estabelecido pro
`density="list"`, que hoje não tem um slot de seta, e não vale inventar um
só pra esta tela).

#### `BUCKET_META` (substitui o array `SECTIONS` de hoje)

| `bucket` | `label` (vira o texto do `status`) | `dotColor` |
|---|---|---|
| `responsibility` | "Responsabilidade" | `#1D4ED8` |
| `approval` | "Aprovação" | `#5B21B6` |
| `alert` | "Alerta" | `var(--text-faint)` |

`#1D4ED8` e `#5B21B6` são os **mesmos hex literais** já usados pelas
variantes `secondary` e `admin` de `ui/Badge.jsx` (`Badge.jsx:11-12`) — reuso
do valor de token já estabelecido, não cor nova. Não instancio `<Badge>`
diretamente aqui porque `Card.jsx` já tem seu próprio idioma dot+label
(`status`, densidade list) — usar os dois juntos (`Badge` dentro de `status`)
duplicaria o mesmo conceito visual dentro do mesmo componente.

`alert` usa um dot neutro (`var(--text-faint)`) de propósito: a severidade
real de um alerta já é comunicada pelo grupo (Crítico/Atenção/Em dia) e pelo
`UrgencyPill`; o dot do `status` só precisa dizer "isto é um alerta do
sistema", não repetir a cor de urgência uma terceira vez na mesma linha.

#### `UrgencyPill` (elemento novo, pequeno — não é componente compartilhado, é só o `footer` desta tela)

```jsx
function UrgencyPill({ tone, label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 8px",
      borderRadius: "var(--radius-sm)",
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
      background: `color-mix(in srgb, ${tone} 14%, transparent)`,
      color: tone,
      border: `1px solid color-mix(in srgb, ${tone} 30%, transparent)`,
    }}>
      {label}
    </span>
  );
}
```

`tone` é sempre um valor já emitido por `use-my-tasks.js` (`"var(--danger)"`,
`"var(--warning)"`, `"var(--success)"`, `"var(--text-dim)"`) — nunca hex
literal novo. `color-mix()` resolve o bug descrito na seção "Achado extra"
acima (funciona corretamente com string `var(--token)`, ao contrário da
concatenação de alpha hex que o código atual usa).

### 6. Selo extra de "isto está pegando fogo" — item do grupo Crítico

Além do `UrgencyPill` vermelho, todo item com `badgeTone === "var(--danger)"`
ganha uma barra de acento vermelha na borda esquerda — sinal redundante
pensado pra quem rolou a tela e não vê mais o header "Crítico" no topo.
Implementado como **wrapper fora do `Card`**, sem tocar no componente
compartilhado:

```jsx
<div style={{
  borderLeft: `3px solid ${task.badgeTone === "var(--danger)" ? "var(--danger)" : "transparent"}`,
  borderTopLeftRadius: "var(--radius-lg)",
  borderBottomLeftRadius: "var(--radius-lg)",
}}>
  <Card ... />
</div>
```

### 7. Corte de itens visíveis + "ver mais"

Substitui o corte por módulo de hoje (`MAX_ITEMS_PER_MODULE = 5`,
`ModuleBucket:204-206`, com link "+N mais em {módulo}" que navegava pra
`onSeeAll(section)`). Nesta lista única não há mais "módulo" como unidade de
corte — o corte é sobre a sequência final (já filtrada por aba, já ordenada
por severidade):

- `MAX_VISIBLE_ROWS = 10` (constante nova, mesmo espírito de
  `MAX_ITEMS_PER_MODULE` — número redondo, ajustável depois; ver nota de
  decisão subjetiva).
- Corte é **global**, não por grupo — se o grupo "Crítico" sozinho já tem 12
  itens, "Atenção"/"Em dia" não aparecem até expandir (severidade real vence
  diversidade de módulo, de propósito — é o núcleo desta proposta).
- Linha final, full-width, mesmo texto em todas as abas: `"Ver mais N
  pendências"` + `ChevronDown` (lucide-react, import novo), clique só
  expande em memória (`setExpanded(true)`) — **não navega**, porque não
  existe hoje uma página "todas as minhas tarefas" pra apontar (cada item já
  navega pro seu módulo individualmente ao clicar na linha).
- `expanded` reseta pra `false` sempre que `filter` muda (trocar de aba
  volta a mostrar só os 10 primeiros do novo subconjunto).

`onSeeAll` (prop hoje recebida por `MinhasTarefasView`, usada só pelo link de
overflow por módulo) fica sem consumidor nesta proposta — sinalizando aqui
em vez de decidir sozinho se remove a prop da assinatura do componente (isso
é decisão do Frontend/Daniel, não deste spec).

---

## Comportamento por estado

1. **Carregando** (`loading === true`) — cabeçalho (saudação) aparece
   imediatamente, sem depender de dado. Abaixo dele, **nem a faixa de
   `StatCard` nem a barra de `Tabs` renderizam ainda** (os números ainda não
   existem) — no lugar dos dois, 5 blocos de
   `CardSkeleton` (`src/components/shared/Card.jsx:204-246`, `density="list"`)
   empilhados com `gap: 8`, reaproveitando o skeleton que o componente já
   exporta (shimmer via `animate-pulse`, mesma forma da linha real: bloco
   26×26 + 2 blocos de texto). Isso substitui o spinner centralizado de hoje
   (`:113-120`) por um placeholder que já antecipa a forma do conteúdo final,
   sem pulo de layout quando os dados chegam.
2. **Vazio total** (`totalTasks === 0`, após `loading`) — nem `StatCard` nem
   `Tabs` renderizam (nada pra resumir/filtrar). Um único
   `ui/EmptyState.jsx` centralizado: `icon={CheckSquare}`, `title="Tudo em
   dia!"`, `description="Nenhuma responsabilidade, aprovação ou alerta
   pendente no momento."` — substitui o div hand-rolled de hoje (`:121-130`)
   pelo componente compartilhado (mesmo gap de reuso já corrigido em outras
   telas por `docs/design-spec-padroes-de-pagina.md`).
3. **Vazio por aba** (`totalTasks > 0`, mas a aba ativa tem 0 itens — ex.
   usuário sem nenhuma aprovação pendente) — `StatCard` e `Tabs` continuam
   visíveis (usuário pode trocar de aba); no lugar da lista, `ui/EmptyState.jsx`
   com texto por aba:
   - `responsibility`: "Nenhuma responsabilidade atribuída a você no
     momento."
   - `approval`: "Nada esperando sua aprovação agora."
   - `alert`: "Nenhum alerta ativo — tudo dentro do prazo."
   Com `action={<Button variant="ghost" size="sm" onClick={() => setFilter("all")}>Ver tudo</Button>}`
   (`ui/Button.jsx`, variante já existente).
4. **Hover de linha** — comportamento já embutido em `Card.jsx` (`:39-51`):
   sombra `var(--shadow-card)` → `var(--shadow-pop)`, borda `var(--border)` →
   `var(--border-strong)`, `translateY(-1px)`. Nenhum handler novo.
5. **Item urgente** (`badgeTone === "var(--danger)"`) — três sinais
   simultâneos, redundantes de propósito (ver seção 6): (a) está sempre no
   grupo "Crítico", topo da lista; (b) `UrgencyPill` vermelho
   (`var(--danger)` + `color-mix` 14%/30%); (c) barra de acento de 3px na
   borda esquerda do `Card`.
6. **Troca de aba** (`Tabs.onChange`) — refiltra a lista (mesmo array
   `tasks`, novo `filter`), reresolve os 3 grupos de severidade só dentro do
   subconjunto, e reseta `expanded` para `false`.
7. **"Ver mais"** — expande em memória, sem nova requisição (dado já veio
   inteiro de `useMyTasks`); não navega para nenhuma outra tela.

---

## Notas de decisão subjetiva

1. **`StatCard` "Urgentes agora" com `accent="var(--danger)"`** — o único
   precedente real de uso de `accent` em `StatCard` hoje
   (`ExecutiveDashboard.jsx:266`) usa `accent="var(--text)"` (neutro) pro
   maior número da tela, não uma cor semântica. Esta proposta rompe esse
   precedente de propósito: o "número que cruza os 3 buckets por urgência
   real" é o argumento central desta direção de design, e destacá-lo com a
   cor de perigo reforça essa leitura. **Alternativa mais conservadora,
   seguindo o precedente à risca**: usar `accent="var(--text)"` num tile
   "Total" (contagem geral, sem filtro de urgência) e deixar "Urgentes agora"
   como tile comum (sem `accent`), igual aos outros 3. Se o time preferir
   consistência literal com `ExecutiveDashboard`, é essa a troca a fazer.
2. **3 grupos de severidade em vez de agrupar por data exata** (ex.
   "Hoje"/"Esta semana"/"Depois") — rejeitado porque `urgencyRank` não tem
   semântica uniforme entre tipos de tarefa (é "dias até uma data" pra leads/
   ASO/férias, mas é um valor arbitrário tipo `0` ou `exp.diasRestantes` pra
   itens como "Registrar entrevista de desligamento" ou "Solicitar
   benefícios" — `use-my-tasks.js:422,539`). Agrupar por data exata
   quebraria ou exigiria tratamento especial pra esses casos; agrupar por
   `badgeTone` (que toda tarefa já tem, com significado consistente:
   vermelho=crítico, âmbar=atenção, resto=rotina) é o critério que já existe
   e já é uniforme.
3. **Separar `var(--text-dim)` de `var(--warning)` em grupos diferentes**,
   em vez de manter os dois no mesmo tier como `toneTier` faz hoje
   (`:48-52`, onde ambos caem no tier 1 default) — mudança deliberada porque
   nesta proposta o tier vira **rótulo visível** ("Atenção") pro usuário, não
   só critério de desempate interno de ordenação como é hoje. Misturar "sem
   nenhuma urgência sinalizada" (rotina, `var(--text-dim)`) com "sinalizado
   ativamente como precisando de atenção" (`var(--warning)`) sob o mesmo
   rótulo "Atenção" seria enganoso.
4. **`MAX_VISIBLE_ROWS = 10`** — número arbitrário, não medido; a
   ~56-64px por linha (`Card` density list), 10 linhas ficam perto de uma
   tela sem rolagem em telas comuns de desktop. Alternativas razoáveis: 8
   (mais enxuto) ou 12 (menos cliques em "ver mais" pra quem tem muita
   coisa). Fácil de ajustar depois — é uma única constante.
5. **"Ver mais" expande em memória em vez de navegar pro módulo** — troca
   deliberada em relação ao link de hoje ("+N mais em Compras" →
   `onNavigate("marketing-compras")`). Como o corte deixou de ser por
   módulo, não há mais "o módulo que ficou de fora" pra apontar — só "os
   itens que ficaram de fora da severidade mais alta". Ver trade-off #5
   abaixo — essa é a perda mais concreta desta direção.
6. **Cores do `status` (dot) reaproveitando hex de `Badge.jsx` em vez de
   renderizar `<Badge>` de fato** — decisão de não empilhar dois
   componentes de "chip" (o `status` do `Card` já é dot+label) só pra
   reusar o componente `Badge` por reusar; o valor de cor é reaproveitado
   (não é hex novo), o componente em si não.

---

## Trade-offs honestos desta direção

1. **Perde a visão "quanto cada módulo tem pendente" à primeira vista.**
   Hoje, cada `ModuleBucket` mostrava lado a lado "Compras: 3, Vagas: 2,
   Leads: 5" simultaneamente. Numa lista única ordenada por severidade, essa
   contagem por módulo desaparece — só dá pra saber lendo `moduleLabel`
   linha a linha (ou rolando a lista inteira).
2. **As 3 categorias (Responsabilidade/Aprovação/Alerta) deixam de ser a
   estrutura primária da tela** — viram um filtro opcional (`Tabs`) e um
   selo secundário por linha (`status` dot+label). Quem já memorizou "eu
   olho a seção de aprovações" precisa se readaptar a usar a aba em vez da
   posição na página.
3. **Severidade real domina diversidade de módulo no corte de 10 itens.**
   Um usuário com 10 leads vermelhos (vencidos) vai ver só leads acima da
   dobra, mesmo que tenha 1 aprovação de compra e 1 vaga esperando — hoje,
   cada módulo garantia pelo menos os seus itens mais urgentes visíveis
   simultaneamente (era "top 5 por módulo", não "top 10 geral").
4. **Introduz um vocabulário novo** ("Crítico"/"Atenção"/"Em dia") que não
   existe em nenhuma outra tela da plataforma hoje — pequena dívida de
   conteúdo: é um rótulo a mais pra manter consistente se esse padrão se
   espalhar depois, sem reaproveitar nomes que já existem em outro lugar.
5. **Perde o atalho direto "+N mais em Compras → abrir Compras".** O "ver
   mais" novo só expande a mesma lista; não existe mais um link de um clique
   que já leva direto pra dentro do módulo com mais itens escondidos.
