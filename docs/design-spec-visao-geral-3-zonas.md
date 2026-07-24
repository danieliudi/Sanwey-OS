# 3 Zonas Verticais — template opinativo pras 3 "Visão Geral"

Grau de padronização explorado nesta spec (uma de possivelmente várias
propostas em avaliação com o Daniel): a mais ambiciosa das opções razoáveis —
não só "os mesmos componentes soltos", mas uma **narrativa vertical fixa**
que toda tela de Visão Geral segue, na mesma ordem, sempre:

> **Header** (saudação/contexto) → **Zona 1, Resumo** (StatCards) →
> **Zona 2, O que fazer** (listas acionáveis) → **Zona 3, Tendência**
> (gráfico/série temporal ou distribuição)

Auditoria feita em cima do código real das 3 telas (arquivo\:linha citado
abaixo, não inferido) + dos componentes de `ui/`/`shared/` já existentes.
Hooks de dado (`useLeads`, `useMarketingCampaigns`, `useRHColaboradores` etc.)
**não mudam** — esta spec é só casca visual e reorganização de conteúdo já
carregado.

---

## 0. O que vira igual vs. o que continua livre

| | IGUAL nas 3 telas | LIVRE por frente |
|---|---|---|
| Header | Tipografia do H1, cor (sempre neutra), estrutura saudação+subtítulo, posição de ações à direita, espaçamento vertical até a Zona 1 | Texto da saudação/subtítulo, quais botões de ação existem (Atualizar/Exportar/nenhum), se há um filtro de escopo local (tabs de empresa) |
| Zona 1 — Resumo | Componente (`StatCard`), tamanho/peso de fonte (`compact`), grid responsivo, gap 12px, ausência de título acima da faixa | Quantidade de tiles (4 a 6), quais métricas, ícone, se tem `trend`/`valueColor`/`accent` sólido |
| Zona 2 — O que fazer | Componente (bucket de tarefa, ver §5), formato do cabeçalho de zona (sentence-case, 15px/600 + subtítulo + CTA opcional), grid responsivo, estado vazio ("Nada urgente por aqui" como padrão de tom, texto customizável) | Quantidade de buckets (2 a 4), quais dados entram em cada um, tone/cor por bucket |
| Zona 3 — Tendência | Cabeçalho de painel (eyebrow uppercase 11px/700 + borda inferior, ver §5), ordem depois da Zona 2, nunca antes | Quantidade e tipo de widgets (1 gráfico simples até 5 painéis, como hoje em Marketing), biblioteca de chart (recharts já é dependência do projeto), se é série temporal, distribuição por etapa, ranking, etc. |
| Espaçamento entre blocos | `space-y-7` (28px) entre Header/Zona1/Zona2/Zona3, sempre | Gaps *internos* de cada zona (ex.: Marketing pode manter grid 10px entre seus painéis de Zona 3) |
| Cor de marca (`co.primary`/`--accent`) | Nunca no H1 da página | Pode aparecer em: tab ativa de filtro, badge/pill de escopo, tile de destaque (`accent` sólido do StatCard) na métrica mais importante da tela, séries de gráfico |

---

## 1. Decisão: cor de marca no título do Marketing

**Hoje**: `MarketingDashboardView.jsx:641` — `<h1 style={{ color: co ?
co.primary : "var(--text)" }}>`. `co` vem de um filtro **local** da própria
tela (`CompanyTabs`, `:91-117`, estado `selectedCompany`), não do
`activeCompany` global da sessão (esse já pinta `--accent` via
`TopBar.jsx:18`/`SettingsView.jsx:180`). Ou seja: o título muda de cor
conforme o usuário clica numa aba de filtro dentro da própria tela — não é
identidade fixa da empresa logada, é estado transitório de UI.

**Decisão: título sempre neutro (`var(--text)`), igual às outras 2 telas.**
Cor de marca sai do H1, mas continua existindo em 3 lugares que já fazem
sentido pro CLAUDE.md (aba ativa, gráfico, tile de destaque):

- `CompanyTabs` mantém `background: co.primary` na aba ativa (`:104`) —
  estado de controle selecionado, não identidade de página.
- Nome da empresa na subtítulo do header vira um `Badge` (`ui/Badge.jsx`,
  `customColor={co.primary}`) em vez de `<strong style={{color: co.primary}}>`
  cru (`:648`) — mesmo padrão de "tag colorida" já usado em 9+ arquivos, não
  um terceiro jeito de colorir texto.
- Séries de gráfico (linhas do `MonthlyTrendChart`, barras do `BurnRateChart`,
  ícones dos `StatCard` de Zona 1) continuam usando `primaryColor`/`accentColor`
  normalmente — isso é conteúdo (dado plotado), não identidade de página, e
  já é prática estabelecida (Comercial também usa `accent` no tile "Valor
  ganho", `DashboardView.jsx:172`).

**Opções consideradas** (decisão é subjetiva, registrando as 3):

1. **Escolhida** — H1 sempre `var(--text)`; cor de marca só em controle de
   filtro + badge + dado plotado, nunca no título.
   - *Por quê*: (a) resolve exatamente a divergência mais gritante que o
     Daniel apontou; (b) o `co.primary` no H1 hoje reflete um filtro local
     transitório, não a empresa da sessão — usar o peso visual máximo da
     página (H1) pra um estado de filtro é desproporcional; (c) `--accent`
     já é o mecanismo да plataforma pra "esta sessão é da empresa X"
     (`TopBar.jsx:18`) — ter um *segundo* sistema de cor de marca, local e
     dessincronizado do primeiro, é exatamente o tipo de duplicação que o
     CLAUDE.md pede pra não criar.
2. Rejeitada — manter `co.primary` no H1 só quando uma empresa específica
   está selecionada. Prós: ajuda reconhecimento rápido ao trocar de aba.
   Contra: é o item que o Daniel already flagged como a divergência mais
   gritante; mantê-lo mina o objetivo desta rodada inteira.
3. Rejeitada — remover cor de marca de tudo, inclusive das abas.
   Contra: a aba ativa colorida é um uso contido e correto (estado
   selecionado de um controle, o mesmo padrão de qualquer chip/tab ativo) —
   tirar isso não ganha nada em consistência, só perde um sinal útil de
   escaneamento rápido.

---

## 2. Estrutura do template — tokens exatos

### Header (casca fixa, não conta como uma das 3 zonas)

| Propriedade | Valor |
|---|---|
| H1 | `fontSize: 26px`, `fontWeight: 700`, `letterSpacing: -0.02em`, `color: var(--text)` — cópia exata de `DashboardView.jsx:126` |
| Subtítulo | `fontSize: 13px`, `color: var(--text-dim)`, margem superior `0.5` (2px) |
| Layout | `flex items-center justify-between flex-wrap gap-3` (cópia de `DashboardView.jsx:124`) |
| Ações à direita | `ui/Button.jsx` `variant="secondary"` `size="sm"`, ícone à esquerda — mesmo padrão de `DashboardView.jsx:137-154` (Atualizar/Exportar); módulo decide se tem 0, 1 ou 2 botões |
| Filtro de escopo local (opcional, ex. `CompanyTabs` do Marketing) | Vai **abaixo** do bloco saudação+ações, ainda dentro do Header, antes da Zona 1 — nunca dentro da Zona 1 |
| Espaço até a Zona 1 | 28px (`space-y-7` no container pai) |

### Zona 1 — Resumo

- Componente: `ui/StatCard.jsx`, sempre `compact` (valor 26px/800, não 32px)
  — hoje só Comercial usa `compact`; RH (tiles cruas, `RHOverviewView.jsx:323-360`)
  e Marketing (`KpiCard`, `:121-156`) passam a usar o componente real.
- Grid: 2 colunas no mobile, crescendo até no máximo 6 no desktop (classe
  exata depende de quantos tiles o módulo tem — 4, 5 ou 6), `gap-3` (12px).
- Sem título acima da faixa (nenhuma das 3 telas tem hoje — mantém).
- **2 acréscimos pequenos e retrocompatíveis no `StatCard.jsx`** (props
  novas, não reescrita — cobre casos que hoje só existem fora do StatCard):
  1. `invertTrend?: boolean` — quando `true`, inverte a semântica de cor do
     `trend` (pra métricas onde "subir" é ruim, ex. despesa). O ícone
     ↑/↓ continua refletindo o sinal literal do número; só a cor
     (verde/vermelho) inverte. Cobre `MoMBadge`'s `invert` (`MarketingDashboardView.jsx:75-76`)
     sem recriar um segundo componente de badge de tendência.
  2. `valueColor?: string` — sobrescreve a cor do número grande sem ativar o
     preenchimento sólido (`accent` continua reservado pro tile de destaque
     único da tela, ex. "Valor ganho"). Cobre o padrão de cor condicional que
     já existe hoje solto em `RHOverviewView.jsx:375` (`turnoverRate >= 20 ?
     "var(--danger)" : "var(--text)"`) e em `MarketingDashboardView.jsx:418`
     (`slaColor`)/`:697` (score). Se os dois props não forem adotados, a
     alternativa é perder essa cor condicional ao migrar pra `StatCard` — sinalizado
     aqui pra não virar "regressão silenciosa" no Frontend.

### Zona 2 — O que fazer

- Cabeçalho de zona: cópia exata do padrão já usado em
  `DashboardView.jsx:182-203` — `h2` 15px/600 sentence-case + parágrafo 12px
  `var(--text-dim)` descrevendo o critério + CTA opcional à direita (chip
  `color: accent`, `background: accent+"0D"`, hover `accent+"18"`,
  `ArrowRight` 12px).
- **Decisão de tom**: cabeçalho de Zona 2 é sentence-case (não uppercase) —
  ver justificativa cruzada com Zona 3 no §5.
- Bucket individual: componente único a extrair (ver §5) — hoje é
  `TaskBucket` local em `DashboardView.jsx:279-344`. Anatomia mantida:
  chip de ícone 24×24 colorido por `tone`, contador no header do bucket,
  linhas clicáveis com ponto colorido + primário/secundário + badge à
  direita.
- Grid: responsivo, 1 coluna mobile → 2 → até o número de buckets do módulo
  (2, 3 ou 4), `gap-3` (12px) — mesma proporção de `DashboardView.jsx:213`,
  generalizada pra não travar em `lg:grid-cols-4` fixo.
- Estado vazio (zero itens em todos os buckets): card único centralizado,
  `background: var(--surface)`, `border: 1px solid var(--border)`, texto
  `var(--text-dim)` — cópia de `DashboardView.jsx:205-211`. Texto default
  "Nada urgente por aqui" pode ser customizado por módulo, mas o **tratamento
  visual não muda**.

### Zona 3 — Tendência

- Cabeçalho de painel: eyebrow uppercase, `fontSize: 11px`, `fontWeight: 700`,
  `letterSpacing: 0.08em`, `color: var(--text-dim)`, `border-bottom: 1px
  solid var(--border)`, `padding-bottom: 10px`, `margin-bottom: 14px` —
  unifica `RHOverviewView.jsx`'s `SectionHeader` (`:94-139`, já tem essa
  forma quase pronta, só falta o Marketing/Comercial adotarem) com
  `MarketingDashboardView.jsx`'s `Panel`/`SectionLabel` (`:160-182`,
  `:509-516`, mesma ideia, sem borda). Ação opcional "Ver todas"/"Ver tudo"
  à direita, mesmo componente do cabeçalho de zona 2 (reaproveita o link,
  não inventa um segundo estilo de CTA).
- Corpo do painel: **livre por módulo** — pode ser 1 gráfico simples ou até
  N painéis lado a lado (Marketing já tem 5 hoje: atividade mensal, canal,
  distribuição por etapa, burn rate, categoria, top 5 — todos ficam,
  reordenados sob esse cabeçalho único em vez de soltos com `SectionLabel`
  cada um). Dentro da Zona 3, grid interno de 2 colunas continua permitido
  (`grid-cols-[3fr_2fr]` do Marketing, `:702`/`:734`, não muda) — a regra de
  "zona vertical" governa a ORDEM das 3 zonas na página, não proíbe grid
  horizontal dentro de uma zona.

---

## 3. Aplicação concreta — as 3 telas de verdade

### 3.1 Comercial (`DashboardView.jsx`)

Já é a referência mais próxima do template — maior parte só formaliza o que
já existe.

| Bloco | O que muda |
|---|---|
| Header | Nada — já bate 1:1 com a spec (`:122-156`) |
| Zona 1 | Nada estrutural — já é `StatCard` `compact`, grid `grid-cols-2 md:grid-cols-4 gap-3` (`:159-179`). Único ajuste possível: se o "Fit score médio" ganhar um `trend` de verdade (hoje só tem `sublabel`), usar prop nova ou manter como está — não bloqueante. |
| Zona 2 | Nada — `TaskBucket`s (`:181-273`) já são a referência que vira componente compartilhado (§5) |
| Zona 3 | **Não existe hoje — maior gap da tela.** Ver decisão abaixo. |

**Zona 3 do Comercial — o que entra.** `ExecutiveDashboard.jsx:151-173` já
calcula exatamente uma distribuição de leads por etapa (`stageMap` a partir
de `pipelines[companyId]` + contagem de `filteredLeads` por `l.stage`) — o
mesmo padrão visual que `StagePipelineBar` já usa no Marketing
(`MarketingDashboardView.jsx:194-228`) e que `RHOverviewView.jsx:623-698`
usa pra departamento. **Decisão (subjetiva, 2 opções):**

- **Opção A — escolhida pra v1**: só a distribuição por etapa do Funil de
  Vendas (barra empilhada + legenda com contagem, idêntica ao
  `StagePipelineBar`), calculada a partir de `scopedLeads` + `pipelines` (já
  disponíveis no componente, zero dado novo). Menor esforço, fecha o gap
  mais gritante (zero Zona 3 hoje) sem introduzir novo agrupamento por mês.
- **Opção B — upgrade futuro**: A + um gráfico de "valor ganho por mês"
  (6 meses, mesmo idioma do `MonthlyTrendChart`/`BurnRateChart` do
  Marketing, usando `recharts` que já é dependência do projeto). Fica pra
  uma 2ª rodada — exige um novo agrupamento por mês de `wonValue`, que hoje
  não existe calculado em lugar nenhum (verificado, não é código escondido);
  não é lógica de negócio complexa, mas é escopo a mais que não estava no
  pedido original.

Escolhi A porque resolve o problema declarado (Comercial sem Zona 3) com o
menor risco e reaproveitando 100% de padrão já provado 2× na plataforma; B
fica registrado como próximo passo natural, não assumido como parte desta
spec.

### 3.2 Marketing (`MarketingDashboardView.jsx`)

Tela com mais conteúdo pra reorganizar — nenhum dado novo, só reclassificar
o que já existe em qual zona ele pertence.

| Bloco | Fonte hoje | Vai pra |
|---|---|---|
| H1 + subtítulo | `:641-651` | Header — cor neutra (§1), nome da empresa vira `Badge` |
| Badge "ao vivo" no canto do header | `:654-663` | **Remove daqui** — vira redundante com o tile "Ao vivo agora" que já existe na Zona 1 (`:679-683`); hoje a mesma informação aparece 2× na tela |
| `CompanyTabs` | `:665-669` | Fica no Header, abaixo da saudação — já está certo, só a hierarquia visual muda (título deixa de reagir à cor) |
| KPI strip (5 tiles) | `:672-699` | Zona 1 — convertidos pra `StatCard compact`. Sparkline de cada `KpiCard` é **removida daqui** (StatCard não tem esse slot) — a mesma série já existe como `MonthlyTrendChart` na Zona 3, não há perda de informação, só de local |
| MoM (`MoMBadge`) | `:73-87` | Vira `trend` do `StatCard`; "Orçamento comprometido" usa `invertTrend` (§2) |
| `AgencyMetrics` → "SLA cumprido" e "Lead time médio" | `:440-443` | Viram 2 tiles a mais na Zona 1 (são KPI puro, não lista nem tendência) |
| `AgencyMetrics` → "Presas em revisão" | `:444-447`, cálculo `m.stuck` em `:413-414` | **Vira bucket de Zona 2** (ver abaixo) — hoje é só um card com contagem + clique pra navegar; vira lista itemizada, mesmo padrão do `TaskBucket` |
| Atividade mensal, Canal, Pipeline por etapa, Burn rate, Categoria, Top 5 | `:701-749` | Zona 3 — mesmos painéis, mesmo grid interno, só ganham o cabeçalho unificado do §2 no lugar de `Panel`/`SectionLabel` |

**Zona 2 do Marketing — o que entra (dados já carregados, sem novo hook):**

1. **Entregas atrasadas** (`danger`) — `fDeliverables.filter(d => d.deadline
   && d.stage !== "entregue" && new Date(d.deadline) < hoje)`. Mesmo padrão
   de comparação de data que "Fechamento atrasado" do Comercial já usa
   (`DashboardView.jsx:86-87`), aplicado ao campo `deadline` que já existe em
   `deliverables`.
2. **Presas em revisão** (`warning`/`--amber`) — reaproveita exatamente o
   filtro que já existe em `AgencyMetrics` (`:413-414`, `stage === "revisao"`
   `&&` mais de 3 dias), só que virando lista de itens em vez de contador
   único.

**Gap sinalizado, não assumido**: um 3º bucket óbvio seria "campanhas
paradas" (equivalente ao `isStale`/`daysIdle` que o Comercial já tem pra
leads, `src/utils/pipeline-metrics.js`), mas **não existe hoje** um cálculo
de estagnação por campanha — nem threshold de dias, nem SLA por etapa de
Marketing definido no mesmo formato do CRM. Isso é decisão de produto (qual
threshold, se usa o `slaDays` que já existe em `rh_pipeline_stages` pro
domínio marketing) — sinalizado aqui, não decidido nem assumido por este
spec.

### 3.3 RH (`RHOverviewView.jsx`)

Tela que hoje não reaproveita nenhum componente compartilhado — a que mais
muda de casca, embora o conteúdo em si já esteja quase todo mapeável.

| Bloco | Fonte hoje | Vai pra |
|---|---|---|
| H1 "Visão Geral — RH" + data por extenso | `:290-312` | Header — já é neutro, já bate com a spec, só ajusta tamanho de 22px→26px pra igualar as outras 2 |
| 4 `statCards` (Total, Ativos, De férias, Afastados) | `:237-262`, `:314-361` | Zona 1 — viram `StatCard compact` de verdade (hoje são divs cruas com `card` local, `:264-269`) |
| Turnover — "Desligamentos" e "Taxa aproximada" | `:370-377` | **2 tiles a mais na Zona 1** (KPI puro). "Taxa aproximada" usa `valueColor="var(--danger)"` quando `turnoverRate >= 20` — mesma condição de hoje (`:375`), só reencapsulada em `StatCard` |
| Turnover — "Voluntários" + `exitPorTipo` (chips por tipo de saída) | `:378-393` | Zona 3 — é distribuição (composição do total de desligados por tipo), não uma tarefa nem um resumo de topo |
| Turnover — "sem entrevista de saída" | `:394-398` | **Vira bucket de Zona 2** (ver abaixo) — hoje é só uma linha de aviso estático; vira lista clicável com os desligados específicos sem entrevista registrada |
| Vagas em Aberto | `:411-498` (1º terço do 3-col) | Zona 2 — lista já itemizada, clicável (falta só o link por item — hoje some ir pra "Ver todas", não abre a vaga individual; comportamento a confirmar com Frontend) |
| Admissões Recentes | `:500-552` (2º terço) | **Não tem lugar óbvio nas 3 zonas — ver §4** |
| Férias Pendentes | `:554-620` (3º terço) | Zona 2 — já é lista itemizada com tom `amber`, encaixa quase sem alteração |
| Distribuição por Departamento | `:623-698` | Zona 3 — já é literalmente uma distribuição, encaixe direto |

**Zona 2 do RH fica com 3 buckets**: Férias pendentes (`amber`/`var(--amber)`,
já como está), Vagas em aberto (neutro ou `accent`, sem urgência calculada
hoje), Desligamentos sem entrevista (`danger` — reclassificado de aviso
estático pra bucket acionável, listando os colaboradores específicos via
`desligados12m.filter(c => !c.desligamentoTipo)`, dado já calculado
em `:216`, só não exposto como lista hoje).

**Zona 3 do RH fica com 2 painéis**: Distribuição por departamento (como
já é) + Distribuição de desligamentos por tipo (`exitPorTipo`, promovido do
bloco de turnover solto pro cabeçalho de painel padrão da Zona 3).

---

## 4. Conteúdo sem lugar óbvio — trade-off real, não escondido

**"Admissões Recentes" do RH (`RHOverviewView.jsx:500-552`)** é o caso mais
claro de conteúdo que não nasceu pra nenhuma das 3 zonas: não é um resumo
numérico (é uma lista de eventos individuais), não é uma tarefa (não tem
nada pra "fazer" sobre uma admissão já concluída) e não é tendência/
distribuição (é uma janela cronológica das 5 últimas, não uma agregação).
É, na prática, um **feed de atividade recente** — um 4º gênero que a
doutrina de 3 zonas não previu.

Duas saídas possíveis, nenhuma perfeita — registrando como decisão em
aberto, não resolvida à força só pra caber no molde:

1. Encaixar em Zona 3 mesmo, como painel leve de "Atividade recente" (mais
   perto de tendência-no-sentido-de-"o-que-aconteceu"-do-que-agregação-
   estatística) — é um estica, mas evita criar uma 4ª zona pra um único
   conteúdo isolado.
2. Tirar da Visão Geral — vira link "Ver admissões" dentro do painel de
   Departamento (Zona 3) ou uma seção da própria tela de Funcionários, não
   um bloco próprio na Visão Geral.

Não escolho entre as duas aqui — é uma decisão de produto sobre o que
realmente precisa estar na primeira tela que o RH vê, não uma decisão de
design puro. Sinalizado pro Daniel decidir.

**Segundo caso, mais leve**: "Top 5 · performance" do Marketing
(`MarketingDashboardView.jsx:452-505`) é um ranking, não estritamente uma
"tendência" — encaixei em Zona 3 por ser a menos errada das 3 opções (é
"distribuição de performance entre campanhas"), mas é o encaixe mais frouxo
das 3 zonas nesta tela. Diferente do caso de RH, aqui a folga é pequena o
bastante pra não valer a pena registrar como bloqueio.

---

## 5. Componentes a extrair (CLAUDE.md regra 4 — 3ª ocorrência)

1. **Bucket de tarefa/alerta** (hoje `TaskBucket`, local em
   `DashboardView.jsx:279-344`, já copiado 1× em `MinhasTarefasView.jsx`
   por comentário explícito, `:11-13`). Com Marketing e RH adotando o
   mesmo formato nesta spec, chega a 4 usos reais — passa do limite de 3ª
   ocorrência. Extrair pra `src/components/shared/` mantendo a assinatura
   já existente: `{ icon, tone, title, empty, items: [{ key, primary,
   secondary, badge, badgeTone?, onClick }] }`. Não é trabalho desta spec
   decidir o nome do arquivo — Frontend escolhe, só não deve reescrever a
   lógica do zero.
2. **Cabeçalho de painel/zona com eyebrow + ação** (hoje 3 versões
   parecidas mas diferentes: `RHOverviewView.jsx`'s `SectionHeader`
   `:94-139`, `MarketingDashboardView.jsx`'s `Panel`/`SectionLabel`
   `:160-182`/`:509-516`). Unificar no formato do §2 (Zona 3) — já citado
   na tabela de estrutura, registrado aqui de novo porque é o mesmo gatilho
   de regra 4.

Ambos os itens acima **não são responsabilidade do design-agent implementar**
— ficam nomeados aqui pra o Frontend não perguntar "onde acho isso" nem
reinventar um 5º jeito de fazer a mesma coisa.

---

## 6. Comportamento por estado

- **Carregando** (qualquer zona): não há padrão de skeleton hoje em nenhuma
  das 3 telas — Marketing usa `loading` só pro texto "· carregando…" no
  subtítulo (`:650`), Comercial não trata loading nenhum, RH mistura
  "Carregando..." em texto puro por bloco (`:417`,`:502`,`:560`,`:625`).
  Fora do escopo desta spec introduzir skeleton novo — se o Daniel quiser,
  é o mesmo `CardSkeleton` já especificado no Padrão C
  (`docs/design-spec-padroes-de-pagina.md`), reaproveitado, não um 3º
  padrão de loading.
- **Zona 1 vazia** (nenhum dado ainda, ex. empresa nova sem leads/
  colaboradores): tiles mostram `0`/`—`, nunca somem — já é o comportamento
  atual nas 3 telas, mantém.
- **Zona 2 vazia** (todos os buckets zerados): card único "Nada urgente por
  aqui" (ou texto equivalente por módulo), nunca a zona inteira desaparece
  — usuário precisa ver "verifiquei e está tudo em dia", não um buraco na
  página.
- **Zona 2, bucket individual vazio**: mensagem `empty` própria do bucket
  (ex. "Nenhuma solicitação pendente"), não esconde o bucket — já é como o
  `TaskBucket` funciona hoje (`DashboardView.jsx:303-306`).
- **Zona 3 vazia** (sem dado suficiente pra plotar): usa o padrão
  `EmptyState` já existente em cada gráfico (`MarketingDashboardView.jsx`'s
  `EmptyState` local, `:184-190` — na extração de §5, esse `EmptyState`
  local também devia virar o `ui/EmptyState.jsx` real, mesmo gatilho de
  duplicação da regra 4, mas não é o foco central desta spec).

---

## 7. Trade-offs honestos

**Ganha:**
- As 3 telas passam a ser reconhecíveis como a mesma família de tela —
  quem já viu uma Visão Geral sabe onde procurar "o que preciso fazer hoje"
  nas outras duas, sem reaprender a hierarquia visual por módulo.
- Força uma pergunta explícita por conteúdo existente ("isso é resumo,
  tarefa ou tendência?") que já revelou 2 gaps reais só de fazer o exercício
  nesta spec: Comercial não tinha nenhuma Zona 3, e duas informações
  (badge "ao vivo" duplicado no Marketing, aviso estático de entrevista de
  saída no RH) estavam mal-classificadas ou redundantes sem que ninguém
  tivesse notado antes.
- Dashboards futuros (uma eventual Visão Geral de Compras, por exemplo)
  ficam triviais de especificar — a casca já está decidida, só falta
  preencher conteúdo.
- Reduz área de bug de layout: uma regra de grid/gap testada 1× cobre as 3
  telas, em vez de 3 implementações independentes de responsividade.

**Perde:**
- Doutrina rígida força realocação de conteúdo que não nasceu pra caber em
  3 categorias — o caso de "Admissões Recentes" (§4) é real: não tem lar
  bom, e forçar um vai deixar ou a Zona 3 do RH com um item deslocado, ou
  exige tirar conteúdo da Visão Geral (decisão de produto, não só de
  design).
- Marketing perde parte da personalidade visual que tinha (hero com fundo
  gradiente tingido por empresa, título colorido, badge pulsante) em troca
  de familiaridade com as outras 2 — é uma perda real de identidade, não
  só "arrumação", mesmo que a justificativa do §1 seja sólida.
- Esforço de implementação não é trivial: toca os 3 arquivos + exige 2
  extrações de componente (§5) + 2 props novas no `StatCard` — não é
  mudança de 1 tarde, mesmo sem tocar em hook nenhum.
- Zona 3 do Marketing continua com 5 painéis — a doutrina de "3 zonas"
  não reduz a densidade real de conteúdo que aquele módulo tem hoje, só
  organiza sob um cabeçalho comum; quem esperava que "padronizar" também
  significasse "Marketing fica mais enxuto" vai se decepcionar — o pedido
  original foi claro que conteúdo/quantidade de widgets continua livre por
  frente, e aqui isso significa Marketing seguir bem mais denso que as
  outras 2 mesmo depois da padronização.
