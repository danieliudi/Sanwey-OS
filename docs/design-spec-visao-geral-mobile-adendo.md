# Adendo — Comportamento mobile (<1024px) e "borda a borda"

Adendo a `docs/design-spec-visao-geral-vocabulario-comum.md` (Grau 2, aprovado).
Não substitui nada daquele documento — os átomos (StatCard, Painel, eyebrow,
Badge, tokens) continuam os mesmos; este adendo só especifica como cada peça
se comporta abaixo de 1024px e onde "borda a borda" se aplica. Leia o
documento base primeiro; aqui não repito o que já está fechado lá (cores,
tipografia do header, mapeamento KpiCard→StatCard, etc.) exceto quando o
comportamento mobile muda algo específico daquilo.

**Prioridade explícita**: das 3 telas, `DashboardView.jsx` (Comercial) é a que
recebe o tratamento mais rigoroso — é a que o vendedor abre no celular entre
uma visita e outra. Marketing e RH seguem os mesmos mecanismos definidos aqui,
mas com menos densidade de decisão fina (menos usuário mobile prioritário
hoje).

Arquivos/linhas confirmados por leitura direta (não inferido):
`src/App.jsx:1469` (wrapper de padding), `src/components/shell/Sidebar.jsx:44-52`
(`useIsMobile`, breakpoint 1024), `src/components/shell/KanbanFab.jsx:19-25`
(precedente de `flush`/mecanismo `lg:` pra dividir comportamento
mobile/desktop), `src/components/views/DashboardView.jsx:121-273`,
`src/components/views/MarketingDashboardView.jsx:628-729`,
`src/components/views/RHOverviewView.jsx:271-410`, `src/components/ui/StatCard.jsx`,
`src/components/ui/Badge.jsx`, `src/components/ui/Button.jsx`,
`tailwind.config.js:82-86` (`spacing.touch: 48px`, token já existe, **0 usos
confirmados no código hoje** — grep em `*.jsx` não retornou nenhum `touch`
usado como classe de espaçamento).

---

## 0. Premissas fixas (não decididas aqui, só herdadas)

- Breakpoint mobile = **1024px**, mesmo valor de `useIsMobile` (`Sidebar.jsx:44-52`).
  Não inventar um segundo breakpoint pra esta tarefa.
- O wrapper de toda view (`App.jsx:1469`) já aplica
  `px-4 py-4 sm:px-6 sm:py-6 lg:py-6 pb-24 lg:pb-6`. Isso significa, em
  pixels: **16px** de respiro lateral entre 0–639px, **24px** entre
  640–1023px, e o padding lateral desaparece do cálculo de bleed a partir de
  1024px porque a partir dali nada sangra (ver seção 1).
- `pb-24` (96px) no mobile já reserva espaço pra `MobileBottomNav.jsx` — não
  mexer nisso.
- "Borda a borda" é uma **exceção pontual**, cancelando o padding do wrapper
  com margem negativa — não um novo padrão de layout. Como confirmado no
  prompt da tarefa, não existe precedente de "margem negativa cancelando
  px-4/sm:px-6" no código hoje; isso é a 1ª ocorrência (CLAUDE.md regra 4: não
  precisa virar componente compartilhado agora, só o mecanismo documentado
  abaixo pra ser aplicado de forma idêntica nas 3 telas).
- Mecanismo recomendado pra implementar o bleed: **CSS puro via classes
  Tailwind responsivas** (`-mx-4 sm:-mx-6 lg:mx-0` no container que sangra,
  com o conteúdo escrolável reaplicando o mesmo valor como padding interno —
  ver seção 1), não uma leitura de `window.innerWidth` em JS. Justificativa:
  os 3 dashboards não usam `useIsMobile` hoje (achado confirmado do prompt) e
  os breakpoints de grid que já existem nessas telas (`md:grid-cols-4`) também
  são só CSS — manter a mesma abordagem evita flash de layout errado antes do
  JS calcular a largura, e não introduz uma dependência nova só pra isto.
  `useIsMobile` (JS) seria justificado apenas se algo aqui precisasse
  desmontar/remontar uma estrutura de DOM totalmente diferente entre mobile e
  desktop (não é o caso — é reordenar e trocar `overflow` via classe).

---

## 1. O que sangra até a borda real da tela — e o que não sangra

**Decisão: só a faixa de `StatCard` (a faixa de KPI do topo, nas 3 telas) e,
dentro dela, os 3 números de "Efetividade da agência" e os 3 números de
Turnover permanecem de fora — ver justificativa dedicada abaixo). Os painéis
de gráfico do Marketing (Atividade mensal, Campanhas por canal, Análise
financeira) e as listas do RH (Vagas/Admissões/Férias) NÃO sangram.**

### 1.1 Por que a faixa de StatCard sim

É exatamente o palpite do Daniel, registrado como decisão (não fato): conteúdo
curto, discreto, item-a-item, feito pra ser arrastado com o polegar num check
rápido. Um carrossel de itens curtos se beneficia do "peek" — ver a borda do
próximo tile cortada pela borda da tela é o próprio sinal visual de "hã, dá pra
arrastar mais" — e a área de arrasto ir até a borda física do aparelho (não
parar 16-24px antes) aumenta a zona de captura do gesto do polegar.

### 1.2 Por que os painéis de gráfico do Marketing NÃO sangram

Decisão, não única resposta possível — registrando as duas opções:

- **A (escolhida) — não sangrar.** Painéis de gráfico (`AreaChart`, barras de
  canal, donut de análise financeira) precisam de padding interno pra rótulo
  de eixo, legenda e tooltip não colidirem com a borda do cartão nem com a
  borda da tela. Além disso, esses painéis são o "Painel" (átomo compartilhado
  do Grau 2 — borda, raio, sombra) — tirar a borda lateral no mobile
  contradiz a própria consistência que o Grau 2 define (o painel deixaria de
  parecer um painel só no mobile). E, diferente da faixa de stats, não é
  conteúdo "item a item" que se beneficia de arrastar com o polegar — é
  informação pra ler parada, não pra passar o dedo.
- **B (não escolhida) — sangrar também.** Daria uma sensação mais "imersiva"
  pro gráfico (mais largura útil pro `AreaChart`). Não escolhida porque o
  ganho de largura (~32-48px) não compensa perder a moldura visual do Painel
  nem o padding que protege rótulos de eixo — e appliesria de forma
  inconsistente só ao Marketing (RH e Comercial não têm gráfico full-bleed
  equivalente hoje), quebrando o "vocabulário comum" que o Grau 2 estabelece.

### 1.3 Por que as 3 listas do RH (Vagas/Admissões/Férias) NÃO sangram

Mesma lógica de "ler parado vs. arrastar rápido": cada coluna é uma lista de
até 5 itens com 2 linhas de texto cada — conteúdo denso, feito pra ler de cima
pra baixo, não pra arrastar horizontalmente. Ver seção 3 pra como essas 3
colunas colapsam (empilhar, não virar carrossel).

### 1.4 Especificação exata do bleed (StatCard strip)

Aplica-se **apenas <1024px**. A partir de 1024px a faixa volta a ser o grid
fixo já especificado no documento base (seção 3.2 de lá): `grid-cols-2
md:grid-cols-4` (Comercial/RH), `auto-fill minmax(170px,1fr)` (Marketing, 5
tiles) — sem `overflow`, sem margem negativa, sem scroll horizontal.

- **Container externo** (troca de `<div className="grid ...">` por scroller
  abaixo de 1024px): `margin: 0 -16px` (< 640px) / `margin: 0 -24px`
  (640–1023px) / `margin: 0` (≥1024px) — em Tailwind:
  `-mx-4 sm:-mx-6 lg:mx-0`.
- **Scroll container** (o que de fato rola): `overflow-x: auto`,
  `scroll-snap-type: x mandatory`, `-webkit-overflow-scrolling: touch`,
  `scrollbar-width: none` (esconder a scrollbar nativa — **não é mecanismo
  novo**, já é o padrão usado 4+ vezes na base pra tab bars horizontais:
  `SettingsView.jsx:624`, `AutomationsView.jsx:272`,
  `AgentActionsView.jsx:518`, `CRMViagensView.jsx:43` — reaproveitar a mesma
  técnica, não inventar outra).
- **Padding interno do scroll container**, pra recolocar o primeiro/último
  card alinhados com o resto do texto da página (o bleed é só na "pista" de
  fundo/gesto, não nos cards em si — ver 1.1): `padding: 0 16px` (<640px) /
  `0 24px` (640–1023px) — em Tailwind: `px-4 sm:px-6 lg:px-0`. Isso, combinado
  com a margem negativa do container externo, produz o efeito de "primeiro
  card começa onde o H1 começa, mas dá pra arrastar até a borda física" —
  exatamente o padrão de bleed carousel (App Store, etc.), não texto colado
  na borda física.
- **Cada `StatCard`** dentro do carrossel: `flex: 0 0 132px` (não `1fr`),
  `scroll-snap-align: start`. `132px` foi calculado pra deixar
  aproximadamente 2,2 cards visíveis + um pedaço do 3º cortado na borda (o
  "peek") numa tela de 375px de largura (iPhone padrão) com `gap-3` (12px,
  token já canônico da seção 3.2 do doc base) entre eles — é o tamanho que
  garante o efeito de peek em qualquer aparelho ≥ 320px de largura sem
  precisar de media query adicional por tamanho de tela.
- Isso vale **igualmente pros 3 números de "Efetividade da agência"
  (Marketing) e pros 3 números de Turnover (RH)** quando esses migrarem pra
  `StatCard` (Grau 2, seções 3.2): mesma técnica de carrossel, mesmos `132px`,
  porque são a mesma forma visual (StatCard compact) só que aninhada dentro de
  um Painel em vez de no topo da página — a diferença é que, como já vivem
  DENTRO de um Painel com padding próprio, o bleed cancela o padding do
  Painel (não o do wrapper do `App.jsx`), então os valores de margem negativa
  mudam pra bater com o padding do Painel (`18px 20px` mobile / `16px` — ver
  doc base seção 3.3): `margin: 0 -16px` dentro do Painel mobile, reaplicando
  `padding: 0 16px` no scroller interno, mesmo princípio.

---

## 2. Ordem de prioridade no mobile do Comercial

**Decisão: Tarefas e prazos vem ANTES da faixa de StatCard no mobile.**
Ordem mobile: Header → **Tarefas e prazos** (buckets) → faixa de StatCard
(carrossel). Desktop mantém a ordem atual do doc base (Stats → Tarefas).

Justificativa: o carrossel de stats já resolve "rápido de escanear" (é
literalmente pra isso que existe, seção 1.1) independente de vir antes ou
depois — o carrossel é curto (uma faixa horizontal, ~90-100px de altura,
`StatCard compact`), não custa espaço vertical extra estar mais abaixo. Já as
"Tarefas e prazos" são o conteúdo genuinamente acionável — "o que eu preciso
fazer agora" (fechamento atrasado, follow-up de hoje, lead parado) — e é
justamente esse tipo de decisão que já orienta a própria tela hoje: o
subtítulo do header já anuncia a contagem de pendências
(`DashboardView.jsx:133`, `· N pendências`) antes mesmo do usuário rolar,
então os números "frios" (quantos leads, quanto vale o funil) são
naturalmente secundários a "o que preciso resolver". Números de status não
mudam a ação imediata do vendedor no próximo minuto; um "Fechamento atrasado"
com badge de dias muda. Alternativa não escolhida: manter Stats primeiro
(palpite original do pedido) — não escolhida porque otimizaria por
"velocidade de leitura de KPI" em vez de "velocidade de próxima ação", e o
público prioritário aqui (vendedor em campo, sessão curta) se beneficia mais
da segunda.

Efeito colateral necessário: com essa troca de ordem, o link "Abrir pipeline"
(canto do bloco de Tarefas) fica mais perto do topo — sem mudança de
comportamento, só de posição.

---

## 3. Colapso de estrutura por seção, <1024px

### 3.1 Comercial — 4 `TaskBucket` (`grid md:grid-cols-2 lg:grid-cols-4`)

**1 coluna empilhada, NÃO carrossel.** Ordem mantida (a mesma já definida no
JSX, que já é por urgência): Fechamento atrasado → Follow-ups agendados →
Fecham nesta semana → Leads parados. Justificativa: diferente da faixa de
stats, esconder um bucket urgente atrás de um gesto de swipe é um modo de
falha pior que não ver um número de KPI — "Fechamento atrasado" precisa estar
sempre visível por padrão, não atrás de "arraste pra ver". Classe:
`grid-cols-1` abaixo de `md`, mantém `md:grid-cols-2 lg:grid-cols-4` como já
está.

### 3.2 Marketing — splits `3fr/2fr` (Atividade mensal + Canal; Análise
financeira + donut)

**1 coluna, ordem mantida igual à leitura desktop (esquerda→direita vira
cima→baixo), não intercalado.** "Atividade mensal" antes de "Campanhas por
canal"; "Análise financeira"/burn rate antes do donut. Justificativa: os dois
painéis de cada par são gráficos independentes sem relação de
"resumo→detalhe" que justifique intercalar — manter a mesma ordem do desktop é
o modelo mental mais simples ("o que eu leio primeiro no desktop é o que eu
leio primeiro no mobile, só empilhado"), e intercalar exigiria decidir uma
ordem de leitura nova sem ganho claro. Classe: `grid-template-columns:
minmax(0,3fr) minmax(0,2fr)` vira `1fr` abaixo de 1024px (ou
`lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] grid-cols-1`).

### 3.3 RH — 3 colunas (Vagas / Admissões / Férias)

**1 coluna empilhada, NÃO carrossel** (rationale completo na seção 1.3).
Ordem mantida: Vagas em Aberto → (Admissões, presumivelmente a 2ª coluna,
mesmo arquivo) → Férias. Classe: `.rh-three-col` já tem a regra de media
query manual em `RHOverviewView.jsx:286` (`grid-template-columns: 1fr
!important` abaixo de 768px) — **ajustar o breakpoint desse `<style>` de
`768px` pra `1024px`**, pra bater com o padrão único de "é mobile" da
plataforma (achado do prompt: RH usa um breakpoint solto, diferente do
`1024px` de `useIsMobile`). Mesmo ajuste vale pra `.rh-stats-grid` e
`.rh-two-col` no mesmo bloco (`RHOverviewView.jsx:282-288`) — todas as 3 regras
desse `<style>` sobem de `768px` pra `1024px`.

### 3.4 RH — Turnover (3 números internos) e Marketing — Efetividade da
agência (3 números internos)

Já coberto na seção 1.4: viram carrossel de `StatCard` de `132px`, mesmo
mecanismo da faixa principal — são números curtos tipo "glance", não listas de
leitura.

---

## 4. Header do Marketing — `CompanyTabs` + badge "ao vivo" + botões de ação

**Achado, não achismo**: `MarketingDashboardView.jsx:628-670` não tem hoje
nenhum botão de ação (Atualizar/Exportar) — isso existe só no Comercial
(`DashboardView.jsx:137-154`). Grep confirmado, nenhuma ocorrência de `Button`
no arquivo do Marketing. Este item do pedido, então, cobre só 2 elementos
reais hoje (`CompanyTabs` + badge), com a especificação de botão registrada
como blindagem futura (caso um botão de ação seja adicionado depois).

Especificação mobile (<1024px):

- **Linha 1**: H1 + subtítulo, como já é (`flex-wrap` já existe,
  `MarketingDashboardView.jsx:638`) — sem mudança.
- **Linha 2, abaixo do H1/subtítulo, full width**: badge "ao vivo" (só
  quando `kpi.live > 0`), alinhado à esquerda, sozinho na linha — não tenta
  dividir espaço com as abas.
- **Linha 3, abaixo da badge**: `CompanyTabs`, com `overflow-x: auto` e
  `scrollbar-width: none` próprios (mesma técnica de tab-scroll já usada 4+
  vezes na base, seção 1.4) — **defensivo, não estritamente necessário hoje**:
  só existem 3 pills (`Todas`/`Resibag`/`Indústria`, confirmado em
  `constants/companies.js:54`, `COMPANY_IDS = ["industria", "resibag"]`),
  então cabem numa linha mesmo em 320px de largura sem precisar rolar — mas
  aplicar o scroll-x mesmo assim evita quebra feia se uma 3ª empresa for
  adicionada no futuro (`COMPANY_IDS` já é array, crescer é trivial). Sem essa
  guarda, adicionar uma empresa nova quebraria o layout mobile sem ninguém
  perceber até acontecer.
- **Se um botão de ação for adicionado no futuro**: ícone-only no mobile
  (sem label de texto), com `aria-label` — nunca o texto completo do botão
  competindo por espaço na mesma linha que as abas. Cada botão ícone-only vira
  `44×44px` (ver seção 6), alinhado à direita da linha do H1, nunca na mesma
  linha que `CompanyTabs`.

Justificativa de separar em 3 linhas em vez de tentar caber tudo numa: com 3
elementos de largura variável (H1 é o mais imprevisível, cresce com o nome do
usuário/saudação), forçar tudo numa linha só produziria quebra inconsistente
dependendo do conteúdo — 3 linhas fixas é previsível em qualquer tamanho de
tela e qualquer nome de usuário.

---

## 5. Alternativa touch pra affordance hover-only

**Achado, não achismo**: grep em `DashboardView.jsx`, `MarketingDashboardView.jsx`
e `RHOverviewView.jsx` por `opacity: 0`, `group-hover`, `MoreVertical`,
`MoreHorizontal` não retornou nenhuma ocorrência de affordance que só aparece
no hover (nenhum kebab de ação em card existe hoje nessas 3 telas
especificamente). O único `hover` real no doc base é o recipe do link "ver
mais" ao lado do eyebrow (`accent+"0D"` idle → `accent+"18"` hover,
`DashboardView.jsx:196-198`) e o hover de fundo nos itens de `TaskBucket`
(`DashboardView.jsx:314-315`) — ambos são **feedback de hover sobre um
elemento já visível e já tocável por padrão** (o link/botão está lá, só muda
de cor ao passar o mouse), não um "revelar no hover" — então não precisam de
alternativa touch: em touch, o elemento simplesmente não mostra o feedback de
cor intermediário e vai direto pro estado de toque (`active`/`onMouseDown` já
cobre o equivalente, ver `Button.jsx:59-60`), sem nada ficando invisível.

**Não existe, portanto, nenhum caso real nas 3 telas hoje que precise de
tap-to-reveal.** Regra de blindagem pra qualquer coisa nova que a
implementação vier a adicionar (ex.: um kebab de ação em `StatCard` ou em
item de lista do RH, caso alguém tente adicionar durante a implementação
deste adendo): **sempre visível por padrão no mobile** (nunca opacity:0 até
hover/focus) — não usar tap-to-reveal como alternativa nesses casos, porque
tap-to-reveal exige um gesto extra que hover não exigia (pior, não igual), e
"sempre visível" é estritamente melhor quando o espaço permite (que é o caso
de um ícone de kebab pequeno, 16-20px).

---

## 6. Tamanho de alvo de toque

Baseline: **mínimo 40px de altura de toque**, preferencialmente **44px**
(linha-guia comum iOS/Android), usando o token que **já existe e está zerado
de uso** — `tailwind.config.js:83`, `spacing.touch: 48px` (0 usos confirmados
em `*.jsx` hoje). Esta é a 1ª aplicação real desse token, não invenção de
número novo — reaproveitar em vez de escrever `44px`/`40px` cru toda vez que
possível (`min-h-touch`/`h-touch` = 48px via Tailwind).

Por elemento tocável especificado nesta spec:

| Elemento | Estado hoje | Ajuste mobile (<1024px) |
|---|---|---|
| `CompanyTabs` pill (Marketing) | `padding: 5px 14px`, `fontSize: 12` → ~27px de altura | `padding: 12px 14px` (mantém `fontSize: 12`) → ~40px com line-height + borda; ou aplicar `min-h-touch` (48px) direto no botão, texto permanece do mesmo tamanho visual, só ganha respiro vertical |
| Botão "Atualizar"/"Exportar" (Comercial, `Button size="sm"`) | `px-3 py-1.5 text-xs` → ~30-32px | No mobile, usar `size="md"` (`px-4 py-2 text-sm`) OU manter `sm` e envolver com `min-h-touch` (48px) — decisão de qual, fica com o frontend-agent (é troca de prop existente, não decisão visual nova); o que não pode é ficar em 30px |
| Link "Abrir pipeline" (eyebrow ação, Comercial) | `px-2.5 py-1.5 text-xs` → ~28px | `padding: 12px 10px` → ~40px, mantendo `fontSize: 12` do texto/ícone |
| "Ver todas" (RH `SectionHeader`, `RHOverviewView.jsx:117-136`) | `padding: 0`, só texto+ícone → ~17px | Envolver em área de toque de `min-height: 40px` via padding vertical (`padding: 10px 4px`, texto/ícone continuam visualmente do mesmo tamanho — é hit-slop, não redesenho) |
| `StatCard` (todo tile, nas 3 telas) | `p-5` (20px) já dá área ampla | Sem ajuste — já muito acima de 40px em qualquer eixo |
| Item de `TaskBucket` (botão de linha, Comercial) | `px-2.5 py-2` + 2 linhas de texto → ~50px já | Sem ajuste — já conforme |
| Item clicável de "Presas em revisão" (`StatCard` com wrapper `onClick`, Marketing) | Wrapper herda a área do `StatCard` inteiro | Sem ajuste — já conforme |
| Botão de ação futuro no header do Marketing (se adicionado) | N/A hoje (seção 4) | `44×44px` mínimo, ícone-only no mobile |

---

## 7. Trade-offs

**Ganha**:
- Carrossel de stats aproveita o gesto mais natural em mobile (arrastar com o
  polegar) em vez de forçar o usuário a rolar a página inteira só pra ver o
  4º/5º número.
- "O que fazer agora" (Tarefas e prazos) fica na primeira dobra pro público
  prioritário (vendedor em campo), sem depender de rolagem.
- Nenhuma das 3 telas precisa de uma dependência JS nova (`useIsMobile`) só
  pra isso — tudo via classes responsivas, consistente com o resto da base.
- Elementos de toque pequenos (badges/links de ação) ganham área de toque
  confiável sem precisar redesenhar visualmente (hit-slop via padding), o que
  minimiza o risco de regressão visual no desktop.

**Perde**:
- Números do topo (StatCard) deixam de estar todos visíveis ao mesmo tempo no
  mobile — comparar "Leads da empresa" com "Valor ganho" lado a lado exige
  arrastar em vez de olhar direto, uma perda real de visão-geral instantânea
  em troca de economia de espaço vertical.
- 2 listas de "quantidade de linhas de código CSS" a mais por tela (o
  mecanismo de bleed + o de carrossel), ainda que pequeno — é a 1ª ocorrência
  desse padrão, então não há componente `shared/` pra reaproveitar ainda
  (fica maior risco de 3 implementações levemente diferentes se não seguirem
  esta spec ao pé da letra).
- Ajustar `.rh-stats-grid`/`.rh-two-col`/`.rh-three-col` de `768px` pra
  `1024px` (seção 3.3) muda o ponto exato em que o RH já colapsava hoje —
  entre 768px e 1023px (tablets em retrato, por ex.) o layout do RH vai
  colapsar mais cedo do que colapsa hoje; é a troca certa pra unificar com o
  resto da plataforma, mas é uma mudança de comportamento visível nessa faixa
  de largura específica, não só um ajuste cosmético.
- Ordem "Tarefas primeiro" no Comercial (seção 2) é uma extrapolação de
  produto, não uma correção óbvia de bug — se o uso real mostrar que
  vendedores preferem ver os números primeiro, é reversível, mas o Daniel
  deve saber que essa troca de ordem é uma aposta, registrada como tal, não
  uma consequência inevitável do resto da spec.
