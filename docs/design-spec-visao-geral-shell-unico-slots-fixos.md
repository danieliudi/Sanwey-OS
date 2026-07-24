# Shell Único, Slots Fixos

Proposta de padronização visual das 3 telas "Visão Geral" (Comercial, Marketing,
RH). Grau de rigidez: **estrutura idêntica, conteúdo livre** — um componente
`DashboardShell` compartilhado com 4 slots, na mesma ordem, nas 3 telas. Cada
frente decide **o quê** entra em cada slot; nenhuma decide a ordem, o grid ou
a tipografia do slot em si.

Arquivos lidos para esta spec (não é achismo): `src/components/views/
DashboardView.jsx`, `MarketingDashboardView.jsx`, `RHOverviewView.jsx`,
`src/components/ui/StatCard.jsx`, `src/components/shared/Card.jsx`, `Tabs.jsx`,
`FilterBar.jsx`, `src/components/ui/Badge.jsx`, `Button.jsx`, `EmptyState.jsx`,
`src/constants/companies.js`, `src/index.css`, `src/App.jsx` (wrapper das
views), `src/components/views/MinhasTarefasView.jsx`.

---

## 1. Ideia central

`DashboardShell` (novo, `src/components/shared/`) renderiza, sempre nesta
ordem vertical, para as 3 telas:

```
DashboardShell
 ├─ header    (slot fixo, obrigatório)
 │   ├─ linha 1: título (esquerda) + zona de ações (direita)
 │   └─ linha 2 (opcional): controles de escopo — ex. abas de empresa
 ├─ stats     (slot fixo, obrigatório)
 │   └─ grid grid-cols-2 md:grid-cols-4 gap-3 → só `ui/StatCard.jsx`
 ├─ main      (slot fixo, obrigatório)
 │   └─ "o que precisa de atenção agora" — composição livre por dentro
 └─ secondary (slot fixo, OPCIONAL)
     └─ conteúdo analítico/exploratório — se ausente, `main` ocupa 100% da largura
```

O que é **igual** nas 3 telas: ordem dos 4 slots, grid da faixa de stats,
tipografia do header, o par de tokens usado em cada slot, e — quando
`secondary` existe — o grid que divide `main`/`secondary`.

O que continua **livre** por frente: quais métricas entram em `stats`
(quantidade até o limite de 4, ver §4), o que é "atenção" vs. "análise" pra
decidir o que vai em `main` vs `secondary`, quantos widgets cabem dentro de
cada slot, e todo o conteúdo específico de domínio (gráficos, listas,
barras de etapa etc.).

---

## 2. Especificação do slot `header`

| Propriedade | Valor | Origem |
|---|---|---|
| Título (h1) | `fontSize: 26`, `fontWeight: 700`, `letterSpacing: "-0.02em"`, `color: var(--text)` | `DashboardView.jsx:126` — já reaproveitado 1× em `MinhasTarefasView.jsx:100`, é o idioma mais imitado hoje |
| Subtítulo | `fontSize: 14` (`text-sm`), `color: var(--text-dim)`, `margin-top: 2px` | `DashboardView.jsx:129` |
| Zona de ações (linha 1, direita) | botões `ui/Button.jsx` variant `secondary`/`ghost`, ou badges de status (ex. pílula "N ao vivo") — alinhados à direita, `flex items-center gap-2` | `DashboardView.jsx:136-155` |
| Linha 2 (opcional) | controles de escopo da página inteira — abas de empresa, filtro de período. Sem card/gradiente ao redor; mesma tipografia de controle usada em qualquer lugar (não inventar um novo) | novo — ver Marketing abaixo |
| Container do header | **sem** `max-width`, `padding` ou `background` próprios — o header vive dentro do wrapper que `App.jsx:1469` já aplica (`px-4 py-4 sm:px-6 sm:py-6`) | achado: Marketing (`maxWidth:1080`, linha 629) e RH (`maxWidth:1200, padding:"24px 32px"`, linhas 272-279) hoje re-envelopam a página inteira por cima do wrapper do `App.jsx`, dobrando o padding e gerando 3 larguras de conteúdo diferentes na prática. Comercial é o único que confia só no wrapper do `App.jsx` — vira a regra pras 3 |

**Não** faz parte do slot `header`: nenhum `background`/gradiente tingido de
cor de empresa, nenhum `border` decorativo ao redor do bloco inteiro (isso é
o "hero" do Marketing, tratado na §5.2).

---

## 3. Especificação do slot `stats`

Grid: `grid grid-cols-2 md:grid-cols-4 gap-3` — classe Tailwind copiada
verbatim de `DashboardView.jsx:159`. Conteúdo: **somente** `ui/StatCard.jsx`
(ícone 36×36 em `var(--surface-alt)`, valor 32px/800 — ou 26px/800 com
`compact`, label 14px dim, `sublabel`/`trend`/`accent` opcionais).

Regra de conteúdo: até **4 tiles** por frente (o grid não tem 5ª coluna —
ver §5.3 sobre o KPI que o Marketing precisa cortar). Métricas condicionais
ou compostas demais pra caber num tile (ex. Turnover, MoM detalhado) **não**
entram aqui — viram conteúdo comum dentro de `main`/`secondary` (ver RH,
§6).

---

## 4. Especificação dos slots `main` / `secondary`

- **`main`** é obrigatório: é o "o que precisa da minha atenção agora" —
  mesmo papel que "Tarefas e prazos" já cumpre no Comercial hoje
  (`DashboardView.jsx:181-273`). Cabeçalho interno padrão (reaproveitar
  literalmente, não recriar):
  - h2: `fontSize: 15`, `fontWeight: 600`, `color: var(--text)`
  - subtítulo: `fontSize: 12`, `color: var(--text-dim)`
  - link opcional à direita: `fontSize: 12`, `fontWeight: 600`, `color:
    var(--accent)`, fundo `var(--accent)` a 5%/10% de opacidade
    (`accent + "0D"` / `accent + "18"` no hover), `padding: "6px 10px"`,
    `border-radius: 8px`, ícone `ArrowRight` 12px — de
    `DashboardView.jsx:193-201`.
  - Grade de "buckets" de atenção: mesmo componente visual do `TaskBucket`
    (`DashboardView.jsx:279-344` — cartão `rounded-xl border`, cabeçalho com
    ícone 24×24 colorido por `tone` + título + contador, corpo com linhas
    clicáveis: ponto 6px + texto primário 13px/600 + texto secundário
    12px/dim + badge 10px/600). Número de colunas = número de buckets que a
    frente definir (**não** é sempre 4** — ver decisão subjetiva em §7.1).
- **`secondary`** é opcional. Quando existe, o grid do par
  `main`+`secondary` é `grid-cols-1 md:grid-cols-[3fr_2fr] gap-3` — valor já
  usado 2× em `MarketingDashboardView.jsx:702` e `:734`, promovido de
  "layout específico do Marketing" pra "razão canônica de divisão principal/
  lateral da plataforma" (reuso, não invenção). Quando uma frente não tem
  conteúdo de `secondary`, **não** renderiza um espaço vazio — `main` ocupa
  100% da largura (grid cai pra 1 coluna implicitamente).
- Conteúdo interno de cada slot é livre — se a frente quiser um sub-grid
  2-col dentro de `secondary` (como o Marketing já faz hoje pra
  trend/channel e burn/donut), isso é composição livre *dentro* do slot, não
  uma variação da estrutura do shell.

**Ação decorrente pro Frontend (regra 4 do CLAUDE.md, não decisão de
design):** o padrão visual do `TaskBucket` já existe 2× hoje —
`DashboardView.jsx:279-344` (`TaskBucket`) e `MinhasTarefasView.jsx:204`
(`ModuleBucket`, cópia comentada, não import). Esta proposta cria a 3ª
(RH) e a 4ª (Marketing) ocorrência do mesmo idioma — já passou do limite de
extração. Extrair pra `src/components/shared/TaskBucket.jsx` faz parte da
implementação desta spec, não é opcional.

---

## 5. Decisão explícita: cor do título no Marketing

Hoje `MarketingDashboardView.jsx:641` usa `color: co ? co.primary : "var(--text)"`
— o único dos 3 headers que usa cor de marca no texto do título.

**Opções:**
- **(A) Manter `co.primary`** — reforça identidade visual por empresa
  logo no topo da página, argumento legítimo de produto ("sei em qual
  empresa estou" de relance).
- **(B) Neutralizar para `var(--text)`**, igual às outras 2 telas.

**Escolhido: (B), neutro.** Razão: a cor de marca já é expressa em runtime
via `--accent` (`COMPANIES[companyId].primary` setado em
`TopBar.jsx:18`/`SettingsView.jsx:180` — confirmado por grep) e aparece em
botões primários, tiles com `accent`, abas ativas e navegação em toda a
plataforma. Colorir o H1 de novo com o mesmo valor (só que lendo direto de
`COMPANIES`, não de `var(--accent)`) é sinal duplicado por dois caminhos de
código diferentes — e é exatamente a divergência mais gritante hoje entre
as 3 telas. Neutralizar resolve a divergência sem perder a informação (que
já está em outro lugar da mesma tela: `CompanyTabs` já mostra a empresa
ativa com fundo sólido `co.primary`, isso é suficiente como sinal).

---

## 6. Aplicação concreta nas 3 telas

### 6.1 Comercial (`DashboardView.jsx`) — referência, quase zero mudança

| Slot | Hoje | Proposto |
|---|---|---|
| `header` | greeting h1 26/700, subtítulo, botões Atualizar/Exportar | sem mudança — é o template |
| `stats` | 4 `StatCard` em `grid-cols-2 md:grid-cols-4` | sem mudança |
| `main` | "Tarefas e prazos" + `TaskBucket` 4-up (`grid md:grid-cols-2 lg:grid-cols-4`) | sem mudança de visual; `TaskBucket` passa a importar de `shared/` em vez de definido localmente |
| `secondary` | não existe | permanece ausente — nada a inventar aqui hoje |

Custo de migração: praticamente nulo. É a única das 3 telas que já segue o
idioma que virou a referência.

### 6.2 Marketing (`MarketingDashboardView.jsx`) — maior reformulação

| Slot | Hoje | Proposto | Perda/custo |
|---|---|---|---|
| `header` | bloco com `background` gradiente por empresa (`heroBg`, linha 624-626), borda tingida, padding 20/24, título `co.primary` 24/800, badge "N ao vivo", `CompanyTabs` dentro do mesmo cartão (linhas 628-670) | header sem cartão/gradiente; título 26/700 `var(--text)` (§5); badge "ao vivo" continua na zona de ações; `CompanyTabs` vira a linha 2 do header, sem envelope colorido | perde o cartão "hero" tingido por empresa inteiro — era a peça mais decorativa da tela |
| `stats` | 5 `KpiCard` locais (linhas 121-156) com sparkline SVG, barra colorida no topo, badge MoM custom (`#DCFCE7`/`#FEE2E2`) | 4 `StatCard`: Campanhas ativas, Orçamento comprometido, Entregas concluídas, Performance médio — "Ao vivo agora" **removido como tile** (fica só no badge do header, evita mostrar a mesma informação 2×, ver §5 mesma lógica de duplicação) | perde sparkline (StatCard não tem esse slot) e a barra de cor no topo do card; `trend` do `StatCard` cobre a mesma ideia do badge MoM mas com cores fixas do próprio componente (não `--success`/`--danger`), reaproveitado como está, não "corrigido" aqui |
| `main` | não existe como conceito — a tela não separa "atenção" de "análise" | **novo agrupamento**: Pipeline · distribuição por etapa (`StagePipelineBar`, hoje linhas 712-720) + Efetividade da agência (`AgencyMetrics`, hoje linhas 722-728) — "Presas em revisão" (stuck > 3 dias) muda de KPI-card isolado pra um bucket clicável no idioma do `TaskBucket` (mesmo padrão de "Fechamento atrasado" do Comercial) | reordenação: hoje esse conteúdo vem *depois* de trend/channel; passa a vir *antes*, porque agora é `main` (prioridade) |
| `secondary` | Atividade mensal + Canal (linhas 701-710), Burn rate + Categoria (linhas 730-743), Top 5 (linhas 745-749) — hoje espalhados em 3 blocos ao longo da página inteira | tudo isso junto dentro da coluna `secondary` (2fr, empilhado internamente do jeito que o Marketing já faz — sub-grids internos continuam livres) | maior perda de espaço horizontal: gráficos que hoje usam a largura cheia da página (`ResponsiveContainer width="100%"`) passam a caber em ~40% da largura — Frontend precisa validar legibilidade dos eixos/labels do Recharts nessa largura menor |

### 6.3 RH (`RHOverviewView.jsx`) — segunda maior reformulação

| Slot | Hoje | Proposto | Perda/custo |
|---|---|---|---|
| `header` | "Visão Geral — RH" 22/800/-0.01em + data por extenso; envelope próprio `minHeight:100vh` + `maxWidth:1200, padding:"24px 32px"` (linhas 272-312) | título mantém o texto "Visão Geral — RH" (conteúdo livre), restilizado pra 26/700/-0.02em; envelope próprio removido, herda o wrapper do `App.jsx` | perde o `minHeight:100vh` + fundo `var(--surface)` full-bleed próprio (redundante com o layout já existente) |
| `stats` | 4 `div` "card" própria (`card` object, linhas 264-269), radius 10, ícone absoluto no canto superior direito, valor 32/800 em **`'Barlow Condensed'`** (linhas 345-360); grid custom `repeat(4,1fr)` + media query manual pra 2 colunas (`rh-stats-grid`, linhas 281-286, 314-322) | 4 `StatCard` reais, no `grid grid-cols-2 md:grid-cols-4 gap-3` padrão — `<style>` de media query manual é removida | perde a fonte de exibição `Barlow Condensed` nos números (decisão tipográfica deliberada do RH) e o ícone no canto superior direito vira ícone à esquerda em box 36×36 (posição do `StatCard`) |
| `main` | linha de 3 colunas "Vagas em Aberto" / "Admissões Recentes" / "Férias Pendentes" (linhas 402-621), cada uma com `SectionHeader` local e layout **diferente** por card (vaga = badge de etapa à direita; admissão = avatar+data; férias = card colorido `--amber-bg` por item) | as 3 viram buckets no idioma `TaskBucket` (grid `md:grid-cols-3 gap-3` — 3 colunas, não 4, porque são 3 conteúdos reais, ver §7.1), cabeçalho interno = h2 15/600 + link "Ver todas" já existente | perde o tratamento de alerta do item de "Férias Pendentes" (hoje cada solicitação é um cartão cheio de `--amber-bg`); no idioma de bucket vira linha com ponto/badge — sinal de urgência mais discreto do que é hoje |
| `secondary` | Turnover (linhas 363-400, hoje **antes** do bloco de 3 colunas) + Distribuição por Departamento (linhas 623-698, hoje **depois**) | os dois juntos na coluna `secondary`, abaixo/ao lado de `main` — Turnover muda de posição (era logo após `stats`, vira parte do `secondary`) | reordenação editorial: Turnover deixa de ser a 1ª coisa vista após os números; a lista de Departamento (hoje grid interno 2-col, `rh-two-col`) provavelmente precisa cair pra 1 coluna interna dentro da largura mais estreita do `secondary` — ajuste de detalhe, não travado nesta spec |

---

## 7. Notas de decisão subjetiva

### 7.1 Número de colunas do grid de buckets em `main`

Duas opções:
- **(A) Sempre 4 colunas**, mesmo se a frente só tiver 3 conteúdos reais
  (deixaria uma "4ª coluna" vazia ou obrigaria inventar um bucket
  artificial pro RH só pra preencher).
- **(B) Colunas = número de buckets reais daquela frente** (Comercial 4,
  RH 3), mantendo fixos o *idioma visual* do bucket e o *grid pattern*
  (`grid md:grid-cols-N gap-3`), variando apenas N.

**Escolhido: (B).** Forçar uma 4ª coluna vazia ou um bucket sem conteúdo
real pra "fechar a grade" seria pior do que a pequena inconsistência de
2 tamanhos de grade — isso é reconhecidamente a única fresta nesta spec
onde "slots fixos" não significa "número fixo", só "mesmo padrão visual e
mesma posição". Registrado aqui pra não ser reaberto como se fosse
descuido.

### 7.2 Posição de `secondary` — lateral (lado a lado) vs. empilhado

Duas opções:
- **(A) Empilhado**: `secondary` sempre abaixo de `main`, ambos 100% de
  largura.
- **(B) Lateral**: `main`+`secondary` lado a lado em `md:grid-cols-[3fr_2fr]`
  (empilha só abaixo de `md`).

**Escolhido: (B)** — é o padrão que o próprio enunciado already chama de
"área secundária/**lateral**", e reaproveita literalmente a razão 3fr/2fr
que já existe 2× no código do Marketing (reuso > invenção). Custo assumido:
Comercial e RH não têm hoje conteúdo de `secondary`, então essa razão só
"paga" quando o RH move Turnover+Departamento pra lá — até lá, ela não
aparece (slot ausente = `main` cheio, sem coluna fantasma vazia).

### 7.3 O que separa "main" de "secondary"

Não existe uma regra objetiva única — a divisão usada aqui foi "o que
exige uma decisão/ação do usuário agora" (`main`) vs. "o que é análise/
contexto pra entender o negócio" (`secondary`). Essa é uma leitura
subjetiva meu: dá pra argumentar que o pipeline por etapa do Marketing é
"análise", não "atenção". Ficou em `main` porque tem o mesmo padrão do
Comercial (item clicável que leva a uma ação — "presas em revisão" navega
pra uma view filtrada, igual um lead atrasado navega pro card). Se o
Daniel achar que a leitura errou pra alguma frente específica, é reabrir
só o mapeamento de conteúdo daquela frente pro slot certo — não a
estrutura do shell.

---

## 8. Mapa de tokens/componentes reaproveitados (resumo)

| Parte do shell | Componente/token | Onde já existe |
|---|---|---|
| Título do header | `fontSize:26/fontWeight:700/letterSpacing:-0.02em/var(--text)` | `DashboardView.jsx:126`, `MinhasTarefasView.jsx:100` |
| Faixa de métricas | `ui/StatCard.jsx` + `grid grid-cols-2 md:grid-cols-4 gap-3` | `DashboardView.jsx:159-179` |
| Bucket de atenção | `TaskBucket` (a extrair pra `shared/`, ver §4) | `DashboardView.jsx:279-344`, cópia em `MinhasTarefasView.jsx:204` |
| Cabeçalho de seção interna | h2 15/600 + subtítulo 12/dim + link `var(--accent)` tint | `DashboardView.jsx:184-201` |
| Razão main/secondary | `grid-cols-1 md:grid-cols-[3fr_2fr] gap-3` | `MarketingDashboardView.jsx:702`, `:734` |
| Neutros | `var(--text)`, `var(--text-dim)`, `var(--surface)`, `var(--surface-alt)`, `var(--border)` | `src/index.css` |
| Nunca usar pra estado/sinal | `var(--accent)` (muda por empresa em runtime) só pra ação/marca, nunca erro/urgência | CLAUDE.md regra 1, já reforçado aqui na decisão do título (§5) |

---

## 9. Trade-offs honestos

**Ganha:**
- Orientação espacial imediata trocando de módulo — título sempre no mesmo
  lugar/tamanho, métricas sempre na 2ª linha, "o que precisa de atenção"
  sempre logo abaixo. Reduz a sensação de "3 produtos diferentes colados".
- Aposenta 3 implementações paralelas que reinventavam a mesma coisa
  (`KpiCard` do Marketing, `div` de stat do RH, `TaskBucket` copiado em
  `MinhasTarefasView`) em favor do que já existe (`StatCard`, `TaskBucket`
  extraído) — reaproveitamento real, não cosmético.
- Resolve de fato a duplicação de sinal de marca (cor no H1 do Marketing
  vs. `--accent` já usado em todo lugar) e o bug estrutural de padding
  duplicado (Marketing/RH re-envelopando o wrapper do `App.jsx`) que
  ninguém tinha sinalizado antes desta auditoria.
- Uma 4ª "Visão Geral" futura (Compras? Entregas?) vira preencher 4 slots,
  não inventar layout do zero.

**Perde:**
- Compressão real de conteúdo no Marketing: 5 painéis exploratórios ricos
  (trend, canal, burn rate, categoria, top 5) espremidos numa coluna
  lateral de ~40% da largura — custo de legibilidade em gráficos Recharts
  que hoje usam a largura cheia da página.
- Duas identidades visuais deliberadas somem: o título colorido por
  empresa no Marketing e a fonte `Barlow Condensed` nos números do RH —
  ambas eram decisão de alguém no passado, não acidente, e é honesto
  registrar que isso é sacrificado em nome da uniformidade.
- Cria uma distinção "main vs. secondary" (atenção vs. análise) que não é
  100% objetiva (§7.3) — toda vez que uma frente ganhar um widget novo,
  alguém vai ter que julgar em qual dos dois ele entra, e esse julgamento
  pode ser contestado.
- É o grau mais caro de reverter: se amanhã uma das 3 frentes precisar de
  uma forma genuinamente diferente (abas em vez de slots empilhados, por
  exemplo), não tem meio-termo dentro do shell — ou se força o conteúdo
  num slot que não serve, ou se reabre esta spec inteira.
- A pequena flexibilidade do número de colunas em `main` (§7.1) já é uma
  fresta admitida no "fixo" — vale registrar que "slots fixos" aqui
  significa posição e idioma visual fixos, não literalmente todo número
  fixo.
