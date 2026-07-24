# Vocabulário Comum, Composição Livre

Padronização visual das 3 telas "Visão Geral" (Comercial, Marketing, RH).
Grau adotado: mesmos átomos visuais em todo lugar (mesmo `StatCard`, mesmo
estilo de card de seção, mesmo header tipográfico, mesmos tokens de
espaçamento) — cada tela mantém sua própria ordem/estrutura de layout. A
consistência vem do material, não da planta baixa.

Arquivos auditados (achados abaixo são lidos, não inferidos):
`src/components/views/DashboardView.jsx`,
`src/components/views/MarketingDashboardView.jsx`,
`src/components/views/RHOverviewView.jsx`,
`src/components/ui/StatCard.jsx`, `src/components/ui/Badge.jsx`,
`src/components/ui/EmptyState.jsx`, `src/components/shared/Tabs.jsx`,
`src/index.css`.

---

## 1. O que vira IGUAL vs. o que continua LIVRE

| | IGUAL (átomo compartilhado) | LIVRE (composição por frente) |
|---|---|---|
| Header | tipografia do H1/subtítulo (tamanho, peso, cor, tracking) | texto (saudação vs. título estático), presença de seletor de empresa/aba, badges de status ao lado |
| Faixa de métricas | componente `ui/StatCard.jsx`, sempre `compact`, `gap-3` (12px) | quantidade de tiles, quais métricas, quantas colunas/breakpoints, se algum tile leva `accent` |
| Corpo principal | estilo do "card de seção" (borda/raio/sombra/padding) e do título dentro dele; estilo do "eyebrow" que agrupa vários cards | ordem das seções, split 3fr/2fr do Marketing, 3 colunas do RH, 4 buckets do Comercial — nenhuma planta baixa é forçada |
| Badge/status | `ui/Badge.jsx` (9 variantes + `customColor`) sempre que hoje é um `<span>` pintado à mão | qual variante/cor semântica cabe a cada domínio (etapa de campanha, status de vaga, etc.) |
| Empty state | 2 tiers fixos (ver seção 4.6) | texto/ação de cada um |
| Números grandes | sempre `Inter, sans-serif` (nunca fonte display à parte) | — |

---

## 2. Decisão explícita — cor de marca no título do Marketing

**Hoje**: `MarketingDashboardView.jsx:641-645` — `<h1 style={{ color: co ?
co.primary : "var(--text)" }}>`. O título muda de cor conforme a empresa
selecionada na aba (`CompanyTabs`).

**Opções**:
- **A — manter**: título colorido reforça "você está olhando pra Resibag/
  Sanwey/etc." de forma imediata.
- **B — neutralizar**: título sempre `var(--text)`, igual às outras 2 telas;
  a identidade de marca continua expressa pelo `CompanyTabs` (pill ativo já
  usa `co.primary`) e, opcionalmente, por **um único** stat tile com
  `accent` (ver 4.2).

**Decisão: B.** Justificativa: é exatamente a divergência mais gritante
citada no pedido, e o grau "vocabulário comum" lista explicitamente "mesmo
header tipográfico neutro" como átomo compartilhado — manter cor de marca
no H1 contradiz o próprio grau escolhido. A identidade não desaparece: o
`CompanyTabs` (que já é bem-sucedido nisso, cada pill ativo em `co.primary`)
segue como o lugar correto pra sinalizar "qual empresa", e é suficiente —
título + faixa de métricas inteira mudando de cor era redundância, não
clareza adicional. Efeito colateral: o wrapper com fundo gradiente
(`heroBg`, `MarketingDashboardView.jsx:624-626,632-637`, tint de
`co.light`) também sai — mesmo motivo, é o mesmo sinal de marca repetido
uma terceira vez. O header do Marketing passa a ser um `<div>` simples,
sem borda/fundo próprios, igual em estrutura ao do Comercial e do RH.

---

## 3. Átomos — especificação exata

### 3.1 Header

- **H1**: `26px` / peso `800` / `letter-spacing: -0.02em` / `color:
  var(--text)` / `line-height: 1.15`.
  - Comercial já está correto exceto o peso (hoje `700` → sobe pra `800`,
    `DashboardView.jsx:126`).
  - Marketing: `24px/800` → sobe pra `26px`, cor deixa de ser `co.primary`
    (seção 2), `MarketingDashboardView.jsx:641-643`.
  - RH: `22px/800/-0.01em` → sobe pra `26px/-0.02em`, `RHOverviewView.jsx:291-298`.
- **Subtítulo** (parágrafo logo abaixo do H1): `13px` / peso `500` / `color:
  var(--text-dim)` / `margin-top: 4px`. Conteúdo livre (saudação com contagem
  de leads, "Dashboard de Marketing · Empresa · N campanhas", data por
  extenso). Comercial hoje usa `14px` (`text-sm`) — desce pra `13px`.
- **Controles ao lado do H1** (botão Atualizar/Exportar do Comercial, aba de
  empresa + badge "ao vivo" do Marketing): ficam como estão — são conteúdo/
  interação, não tipografia de header.
- **`CompanyTabs` do Marketing**: não migra pro `shared/Tabs.jsx`. São
  semanticamente diferentes — `Tabs.jsx` é um segmented control neutro (item
  ativo sempre `var(--surface)`/`var(--text)`, ver `Tabs.jsx:53-54`);
  `CompanyTabs` é um seletor de entidade onde cada pill carrega a cor da
  própria empresa (`co.primary`) — isso é o comportamento certo, mantém como
  está.

### 3.2 Faixa de métricas — `ui/StatCard.jsx` em todo lugar

Regra única: **todo tile de KPI no topo (e nos clusters do corpo que hoje
reimplementam a mesma forma) usa `StatCard`, sempre com `compact` (valor
`26px`, não `32px`)** — não existe motivo pra 3 tamanhos de número diferentes
coexistindo (Comercial já compacta a `26px`; Marketing usa `30px` custom;
RH usa `32px` em `'Barlow Condensed'`). Espaçamento entre tiles: `gap: 12px`
(Tailwind `gap-3`) — canônico, substitui o `gap:10` do Marketing e o `gap:16`
do RH.

**`accent` é reservado — no máximo 1 tile por tela, condicional**, nunca "um
tile colorido por métrica" (era o padrão do Marketing e do RH, ambos
divergentes de como o próprio `StatCard` já é usado no Comercial hoje —
`accent` só aparece em `won_value`, `DashboardView.jsx:172`). Isso substitui
tanto o número colorido por métrica do RH (`sc.accent`,
`RHOverviewView.jsx:349`) quanto o ícone/barra superior colorida por métrica
do Marketing (`KpiCard`, `color` prop, `MarketingDashboardView.jsx:121-156`).

**Comercial** (`DashboardView.jsx:159-179`) — já conforme, sem mudança de
composição. Único ajuste: nenhum (já usa `compact`, já reserva `accent` pra
1 tile).

**Marketing** — substituir `KpiCard` por `StatCard` nos 5 tiles
(`MarketingDashboardView.jsx:672-699`):

| Tile hoje | vira StatCard |
|---|---|
| Campanhas ativas | `icon=Megaphone`, `value=kpi.active`, `label`, `trend=mom.campaigns.d` — sem `accent`, sem sparkline (a sparkline some — ver nota de decisão 5.1) |
| Ao vivo agora | `icon=Zap`, `value=kpi.live`, `label`, `sublabel="em exibição"/"nenhuma ao vivo"` — `accent="var(--success)"` **somente quando `kpi.live > 0`**, senão sem `accent` — este é o tile reservado da tela |
| Orçamento comprometido | `icon=DollarSign`, `value=formatBRL/formatK`, `label`, `trend = mom.expenses.d` mapeado já invertido pelo chamador (`trend={-mom.expenses.d}`, já que gasto subindo é "ruim" e `StatCard` sempre trata positivo como verde) — sem `accent` |
| Entregas concluídas | `icon=Package`, `value=kpi.entregue`, `label`, `trend=mom.deliverables.d` — sem `accent`, sem sparkline |
| Performance médio | `icon=Award`, `value=kpi.avgScore ?? "—"`, `label`, `sublabel` (ótimo/bom/atenção/sem dados, como já é) — sem `accent`; o qualitativo do sublabel já carrega o sinal, não precisa também colorir o número |

Grid: mantém `repeat(auto-fill, minmax(170px,1fr))` (5 tiles não cabem limpo
em 4 colunas fixas — isso é composição, fica livre), só troca `gap:10` por
`gap:12`.

`MoMBadge` (`MarketingDashboardView.jsx:73-87`) some como componente — vira
o `trend` nativo do `StatCard`. Nota lateral: o próprio `trend` do
`StatCard` hoje usa hex hardcoded (`#F0FDF4`/`#FEF2F2`/`#15803D`/`#B91C1C`,
`StatCard.jsx:27-32`) em vez de `var(--success-bg)`/`var(--danger-bg)`/
`var(--success)`/`var(--danger)` — não quebra nada visualmente hoje (os
valores batem em light mode) mas não vai adaptar no dark mode. Fora do
escopo deste item (é um bug do componente compartilhado, não desta tela),
só fica registrado pra quem for mexer no `StatCard` depois.

**"Efetividade da agência"** (`AgencyMetrics`,
`MarketingDashboardView.jsx:402-450`) — os 3 cards centralizados (`card()`
helper) também migram pra `StatCard` (mesmo raciocínio: é a mesma forma
visual — ícone/valor grande/label — reaparecendo pela 2ª vez nesta mesma
tela só que com HTML próprio):

- SLA cumprido: `value={m.sla}%`, sem `accent`.
- Lead time médio: `value={m.avgLead}d`, sem `accent`.
- Presas em revisão: `value={m.stuck}`, `accent="var(--warning)"` **somente
  quando `m.stuck > 0`** (mesma regra de reserva). Clique existente
  (`navigate` pro board de Entregas filtrado) precisa de wrapper próprio —
  `StatCard` não tem `onClick`; envolver o `StatCard` num container com
  `onClick`/`cursor:pointer`/cursor pointer só quando `m.stuck > 0`, é
  detalhe de implementação, não novo átomo visual.

**RH** (`statCards`, `RHOverviewView.jsx:237-262,314-361`):

| Tile hoje | vira StatCard |
|---|---|
| Total de Funcionários | `icon=Users`, `value`, `label` — sem `accent` |
| Ativos | `icon=UserCheck`, `value`, `label` — sem `accent` (perde o número verde; ver decisão 5.2) |
| De Férias | `icon=Calendar`, `value`, `label` — sem `accent` |
| Afastados | `icon=UserMinus`, `value`, `label` — `accent="var(--warning)"` **somente quando `totalAfastados > 0`** — tile reservado da tela |

Grid: adotar exatamente `className="grid grid-cols-2 md:grid-cols-4 gap-3"`
(igual ao Comercial, `DashboardView.jsx:159`) — remove o `<style>` de media
query manual (`RHOverviewView.jsx:281-288`) e o grid inline
(`RHOverviewView.jsx:314-322`); é o mesmo shape do Comercial (4 tiles), não
há razão pra manter CSS bespoke.

Painel de Turnover (`RHOverviewView.jsx:363-400`) — os 3 números internos
(Desligamentos/Taxa/Voluntários) também viram `StatCard` `compact`, mesma
regra de reserva de `accent`: `turnoverRate` leva
`accent="var(--danger)"` **somente quando `turnoverRate >= 20`** (é
exatamente a lógica que já existe hoje colorindo só o texto,
`RHOverviewView.jsx:375` — só remapeada pro mecanismo do `StatCard`).

### 3.3 Corpo principal — 2 estilos de card, usados onde já existem hoje

**"Painel"** (caixa com borda, é o card de seção):
`background: var(--surface)`, `border: 1px solid var(--border)`,
`border-radius: var(--radius-lg)` (12px), `padding: 18px 20px` (`16px` em
mobile), `box-shadow: var(--shadow-card)`.

- Já é quase exatamente o `Panel` do Marketing (`MarketingDashboardView.jsx:160-182`)
  — só ajusta o padding pra `18px 20px` (hoje `18px 20px`, já bate).
- É quase exatamente o `card` local do RH (`RHOverviewView.jsx:264-269`) —
  só sobe o `border-radius` de `10` pra `12` (`var(--radius-lg)`).
- É o que falta no Comercial pro bloco de "Tarefas e prazos" — hoje ele não
  usa um card-container próprio (o container é cada `TaskBucket`
  individualmente, `DashboardView.jsx:279-344`), o que já está correto: cada
  `TaskBucket` JÁ é este mesmo "Painel" (borda `var(--border)`, mesmo raio
  seria bom subir de implícito `rounded-xl` pra confirmar `var(--radius-lg)`
  explicitamente, `DashboardView.jsx:282`).

**Título de painel** (rótulo dentro da caixa, descreve o conteúdo daquele
painel específico): `13px` / peso `700` / caixa normal (não uppercase) /
`color: var(--text)` / `margin-bottom: 10-12px`; subtítulo opcional `11px`
`var(--text-dim)` `margin-top: 2-3px`. Borda inferior (`1px solid
var(--border)`, `padding-bottom: 10px` antes do título) é opcional — só
quando o painel tem uma ação "ver todas" ao lado (separa visualmente
título+ação do corpo).

- Marketing `Panel` (`MarketingDashboardView.jsx:168-176`): hoje `12px`
  uppercase `0.06em` — remove uppercase/tracking, sobe pra `13px` sentence
  case.
- RH `SectionHeader` (`RHOverviewView.jsx:94-139`): hoje `11px` uppercase
  `0.08em` — mesma troca; mantém a borda inferior + link de ação exatamente
  como está (esse é o recipe canônico pra painel-com-ação, ver abaixo).
- RH Turnover header (`RHOverviewView.jsx:365-368`, ícone+span `14px/700`
  sem uppercase): desce só o tamanho pra `13px`, já não era uppercase.
- Comercial `TaskBucket` header (`DashboardView.jsx:295-297`, `12px`
  semibold): sobe pra `13px`. Mantém o quadrado de ícone `24×24` colorido
  por tom (`tone + "14"`/`tone`) e o contador à direita — isso é conteúdo/
  decoração específica do bucket, não parte do átomo de título, fica livre.

**"Eyebrow" de cluster** (rótulo que agrupa várias caixas, sem borda/fundo
próprio, sentado direto no fundo da página): `11px` / peso `700` /
`uppercase` / `letter-spacing: 0.08em` / `color: var(--text-dim)` /
`margin-bottom: 10-12px`. Ação opcional à direita, mesma linha: `12px/600`
`color: var(--accent)`, ícone `ArrowRight` `12px`, fundo
`color-mix`/hex-alpha do accent — usa o recipe que já existe no Comercial
(`DashboardView.jsx:193-201`: `background: accent + "0D"` idle →
`accent + "18"` hover) como *o* recipe canônico pra qualquer link "ver
mais" ao lado de um eyebrow.

- Marketing `SectionLabel` (`MarketingDashboardView.jsx:509-516`) já bate
  quase exatamente — sem mudança de estilo, só formaliza como o mesmo átomo.
- Comercial "Tarefas e prazos" (`DashboardView.jsx:185-190`) desce de
  `15px/600` sentence-case pra este eyebrow `11px` uppercase — o link
  "Abrir pipeline" ao lado já usa o recipe canônico acima, não muda.
- RH não tem hoje uma eyebrow de cluster acima do grid de 3 colunas nem
  acima da distribuição por departamento — fica livre não ter (composição
  é do RH decidir); se algum dia quiser um rótulo agrupando ("Recrutamento
  e Admissão", por ex.), usa este átomo.

### 3.4 Badge — `ui/Badge.jsx` em vez de `<span>` pintado à mão

Onde já existe uma cor+texto num pill que hoje é HTML solto, vira
`ui/Badge`:

- Marketing: badge de etapa em `TopPerformanceList`
  (`MarketingDashboardView.jsx:481-486`, cor vem de `stage.color`, dado de
  BD) → `<Badge customColor={stage.color}>{stage.name}</Badge>` — `Badge`
  já tem exatamente esse contrato (`Badge.jsx:15-18`).
- Marketing: badge "ao vivo" do header (`MarketingDashboardView.jsx:653-663`)
  → `<Badge variant="success">` pro pill (mantém o ponto pulsante como
  decoração à parte, isso é conteúdo específico, não parte do Badge).
- RH: badge de etapa de vaga (`RHOverviewView.jsx:477-491`, cor de
  `stageInfo`) → `<Badge customColor={stage.color}>{stage.name}</Badge>`.
- RH: chips de tipo de desligamento (`RHOverviewView.jsx:386-392`, hoje
  `background: var(--surface-alt)`, `color: var(--text-dim)`, sem borda) →
  `<Badge variant="neutral">` (bate quase exatamente,
  `Badge.jsx:8`: `bg: var(--surface-alt)`, `color: var(--text-faint)`,
  `border: var(--border)`).
- Card de férias pendente do RH (`RHOverviewView.jsx:570-616`) **não
  precisa mudar** — já usa `var(--amber-bg)`/`var(--amber)` corretamente,
  é o exemplo de token já certo na base.

### 3.5 Números — sempre `Inter, sans-serif`

RH usa `fontFamily: "'Barlow Condensed', Inter, sans-serif"` nos números
grandes (`RHOverviewView.jsx:351,371,375,379`) — nenhuma das outras 2 telas
faz isso, e migrar os tiles pro `StatCard` já resolve isso por construção
(`StatCard` força `Inter, sans-serif`, `StatCard.jsx:42`) — só fica
registrado o porquê muda.

### 3.6 Empty state — 2 tiers, não 1

Existem hoje **3 reimplementações do mesmo empty state compacto** (regra 4
do CLAUDE.md — já passou do limite de 3ª ocorrência):

1. Marketing `EmptyState` local (`MarketingDashboardView.jsx:184-190`).
2. RH `EmptyState` local (`RHOverviewView.jsx:141-154`).
3. `TaskBucket` do Comercial, o texto de `{empty}` por bucket
   (`DashboardView.jsx:303-306`).

As 3 já convergem quase pro mesmo visual (texto centralizado, `12-13px`,
`var(--text-dim)`, sem borda própria — vive dentro do painel que já tem
borda). **Não** usar `ui/EmptyState.jsx` pra este caso — aquele componente
é dimensionado pra vazio de página/view inteira (ícone `60px` num círculo,
`py-16`, `EmptyState.jsx:5-11`), estourado demais dentro de um painel
compacto de dashboard. Formalizar em vez disso um segundo tier, menor,
específico pra "vazio dentro de um painel": texto único, `12px`,
`var(--text-dim)`, `padding: 20px 0`, sem ícone. Como já são 3 ocorrências
quase idênticas, isso é candidato a extração pra `shared/` (regra 4) — sinalizado
aqui, decisão de extrair (e onde) fica com o frontend-agent, não é
tipografia nova a inventar.

`ui/EmptyState.jsx` continua reservado pro caso de "a seção inteira não tem
nada" (ex.: se um dia o cluster de Tarefas e Prazos do Comercial virasse
maior que uma linha de texto — hoje já é atendido por um card simples,
`DashboardView.jsx:206-211`, que não precisa mudar porque já usa os tokens
certos, só é um 3º tier diferente dos outros dois, não um erro).

---

## 4. Aplicação seção por seção

### 4.1 Comercial (`DashboardView.jsx`) — menor mudança das 3

| Seção | Muda | Fica |
|---|---|---|
| Header | peso do H1 `700→800`; subtítulo `14px→13px` | saudação, contagem de leads, botões Atualizar/Exportar |
| Faixa de métricas | nada (já é `StatCard compact`, `gap-3`, `accent` reservado a 1 tile) | 4 tiles, `grid-cols-2 md:grid-cols-4` |
| "Tarefas e prazos" | título desce de `15px/600` pra eyebrow `11px` uppercase; cada `TaskBucket`: título interno `12px→13px`, confirmar `border-radius: var(--radius-lg)` explícito; texto de `{empty}` formaliza como tier "empty compacto" (seção 3.6) | 4 buckets, ícone colorido por tom, contador, link "Abrir pipeline" (recipe já é o canônico) |

### 4.2 Marketing (`MarketingDashboardView.jsx`)

| Seção | Muda | Fica |
|---|---|---|
| Header | título perde `co.primary` → `var(--text)`; perde o wrapper com fundo gradiente (`heroBg`)/borda; H1 sobe pra `26px/800` | saudação com nome, subtítulo com contagem de campanhas, `CompanyTabs`, badge "ao vivo" (agora `Badge variant="success"`) |
| Faixa de KPI | `KpiCard`→`StatCard` (5 tiles, mapeamento na seção 3.2), `gap:10→12`, sparkline sai (ver 5.1), `accent` reservado só pro tile "Ao vivo agora" | grid `auto-fill minmax(170px,1fr)`, 5 métricas, `trend` (MoM) em 3 delas |
| Atividade mensal + Canal | título do `Panel` `12px uppercase→13px sentence case` | split `3fr/2fr`, `AreaChart`/barras de canal (conteúdo de gráfico, livre) |
| Pipeline por etapa | mesmo ajuste de título de painel | barra de distribuição por etapa, legenda com cor de BD (fica como está — é legenda de gráfico, não badge) |
| Efetividade da agência | `SectionLabel`→eyebrow (já bate); os 3 cards viram `StatCard` (seção 3.2), `accent` reservado só pro tile "Presas em revisão" quando `> 0` | 3 métricas, clique no tile de revisão (wrapper externo) |
| Análise financeira | eyebrow + título de painel (mesmos ajustes) | split `3fr/2fr`, burn rate + donut (gráficos, livres) |
| Top 5 performance | eyebrow + título de painel; badge de etapa → `Badge customColor` | lista com barra de score, cores de score (verde/âmbar/vermelho já são dado, ficam) |

### 4.3 RH (`RHOverviewView.jsx`)

| Seção | Muda | Fica |
|---|---|---|
| Header | `22px/800/-0.01em` → `26px/800/-0.02em`; subtítulo já era `13px`, sem mudança | título estático "Visão Geral — RH", data por extenso |
| Faixa de métricas | 4 cards → `StatCard`, grid vira `grid grid-cols-2 md:grid-cols-4 gap-3` (remove `<style>` de media query manual), `accent` reservado só pro tile "Afastados" quando `> 0` | 4 métricas |
| Turnover | container `card`→"Painel" (raio `10→12`); título `14px→13px`; os 3 números internos viram `StatCard compact`, `accent="var(--danger)"` só quando `turnoverRate>=20`; chips de tipo → `Badge variant="neutral"` | texto de "sem entrevista" em `var(--warning)`, aparece só quando `> 0` |
| Vagas / Admissões / Férias (3 col) | cada `card`→"Painel" (raio); `SectionHeader`→título de painel (`11px uppercase→13px sentence case`, mantém borda inferior + link "Ver todas", recipe já canônico); badge de etapa de vaga→`Badge customColor` | 3 colunas lado a lado, avatar com iniciais, cards de férias em `--amber-bg` (já correto) |
| Distribuição por Departamento | `card`→"Painel"; `SectionHeader`→título de painel | barras de progresso por depto |

**Nota — não confundir com mudança de dado**: `var(--color-industria)` aparece
em vários pontos do RH (`RHOverviewView.jsx:78,124,253,429,687`) como cor de
ação/destaque, diferente de `var(--accent)` (que muda por empresa em
runtime nas outras telas). Não decidido aqui se é intencional (RH não tem
"empresa ativa" no mesmo sentido do CRM/Marketing, então um token de
destaque fixo pode ser correto) ou resíduo de um token antigo — sinalizado,
não alterado; confirmar com o Daniel antes de trocar por `var(--accent)`.

---

## 5. Notas de decisão subjetiva (resumo)

1. **Cor de marca no título do Marketing** — decidido neutralizar (seção 2).
2. **Sparkline nos KPI tiles do Marketing** — `StatCard` não suporta
   sparkline. Como a mesma série (campanhas/entregas por mês) já aparece
   com mais detalhe no painel "Atividade mensal" logo abaixo, a decisão é
   **remover a sparkline do tile** em vez de estender o `StatCard` — é
   redundante, não uma perda de informação. Alternativa não escolhida:
   adicionar prop `sparkline` opcional ao `StatCard` global (afetaria as
   outras 7+ telas que já usam o componente, custo desproporcional pra
   resolver uma duplicação de conteúdo).
3. **Número colorido por métrica (RH: Ativos verde, Afastados âmbar) vira
   neutro, exceto 1 tile reservado** — opções eram (a) manter uma cor por
   tile, o que exigiria estender `StatCard` pra aceitar cor de valor
   independente do modo "cartão sólido" `accent`; ou (b) usar `accent` só
   no tile que precisa de destaque condicional. Escolhido (b): mantém
   `StatCard` sem mudança de contrato e seguindo o mesmo padrão que o
   Comercial já usa (`won_value`) e que o Marketing passa a usar ("Ao vivo",
   "Presas em revisão") — um vocabulário de "destaque = exceção", não
   "toda métrica tem sua cor".
4. **Extração de um "empty state compacto" pra `shared/`** — sinalizado
   (regra 4, 3ª ocorrência já confirmada), decisão de extrair/onde fica
   pro frontend-agent; esta spec só fixa o visual (seção 3.6).
5. **`var(--color-industria)` no RH** — sinalizado, não resolvido aqui;
   precisa confirmação do Daniel antes de qualquer troca por `var(--accent)`.

---

## 6. Trade-offs

**Ganha**:
- Reconhecimento imediato entre as 3 telas ("isso é um StatCard, isso é um
  painel") sem forçar reescrever a estrutura de nenhuma — custo de migração
  baixo (troca de estilo/componente, não de layout).
- Resolve a divergência mais visível hoje (cor de marca no H1) com
  justificativa registrada, não silenciosa.
- Não exige tocar em nenhum hook de dado (`useMarketingCampaigns`,
  `useRHColaboradores`, etc.) — é casca visual, como pedido.
- Cada frente mantém a densidade de informação que faz sentido pra ela
  (Marketing com split `3fr/2fr` e gráficos, RH com 3 colunas de listas,
  Comercial com 4 buckets) — não empobrece nenhuma pra caber num molde único.

**Perde**:
- Menos "uau" por tela — o Marketing perde a assinatura visual mais forte
  (header colorido, fundo gradiente) que hoje o distinguia à primeira vista
  das outras duas; sobra só o `CompanyTabs` como sinal de marca.
- Sinalização por cor fica mais escassa (RH: "Ativos" não é mais visualmente
  verde à primeira vista, só o ícone/label indicam) — quem escaneava pela
  cor do número agora escaneia pelo label; é uma perda real de affordance
  em troca de consistência.
- Sem uma "planta baixa" comum, um usuário que aprende onde fica algo no
  Comercial não automaticamente sabe onde procurar o equivalente no
  Marketing ou no RH — a familiaridade fica no "como as coisas parecem",
  não no "onde as coisas estão". Se o objetivo fosse otimizar velocidade de
  navegação entre módulos (não apenas identidade visual), um grau mais
  rígido (shell/slots fixos) teria vencido esse ponto especificamente.
- Ainda restam 2 famílias de "título de painel" com detalhes finos
  diferentes (com borda inferior + ação vs. sem) — não é uma inconsistência
  arbitrária (a borda só aparece quando há ação), mas exige que quem for
  implementar preste atenção em qual variante usar onde, em vez de copiar
  cegamente.
