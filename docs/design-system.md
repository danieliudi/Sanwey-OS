# UI Kit — Gestão Sanwey (proposta v1, aguardando aprovação)

> Pedido do Daniel (03/08/2026): "montar um UI Kit, para sempre seguirmos... que
> seja levado como regra daqui pra frente." Este documento não inventa um
> sistema novo — consolida o que **já existe e funciona** na plataforma (token
> por token, componente por componente, com `arquivo:linha`), formaliza as
> poucas decisões que ainda não tinham nome (escala tipográfica, escala de
> espaçamento, raio pílula), e regista as poucas dívidas reais encontradas no
> caminho. Depois de aprovado, vira referência obrigatória — mesmo status que
> `docs/design-spec-padroes-de-pagina.md` já tem hoje (citado na regra 6 do
> `CLAUDE.md`).
>
> Mockup visual correspondente: Artifact "UI Kit — Gestão Sanwey" (ver link na
> conversa). Este arquivo é o registro escrito; o Artifact é a galeria visual.
> Nenhuma implementação de componente novo decorre deste documento sozinho —
> ele só formaliza o que está em produção hoje + o que já foi aprovado nesta
> mesma rodada (Seções 1-4 do mockup de dark mode: `--critical-solid`, chip
> com fundo sólido, calendário em blocos sólidos, vermelho de marca restaurado
> no dark mode).

---

## 1. Fundamentos

### 1.1 Cor

Todo valor abaixo já existe em `src/index.css` (`:root` = light, `[data-theme="dark"]` = dark), salvo onde marcado **[NOVO]**.

**Neutros**

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#FBFBFA` | `#1A1A18` |
| `--surface` | `#FFFFFF` | `#242422` |
| `--surface-alt` | `#F7F6F3` | `#2C2C29` |
| `--border` | `#E9E8E5` | `#3A3A36` |
| `--border-strong` | `#DEDCD7` | `#4A4A46` |
| `--text` | `#37352F` | `#EBEBDF` |
| `--text-dim` | `#57534E` | `#B5B3A8` |
| `--text-faint` | `#706C65` | `#8C8882` |

**Marca / ação** — `--accent` é o único token *white-label*: `TopBar.jsx`
aplica `COMPANIES[companyId].primary` em runtime por cima dele em light mode
(`applyCustomAccent()`, `src/components/shell/TopBar.jsx:11-23`). Hoje essa
função remove `--accent`/`--accent-hover` no dark mode de propósito — **decisão
revertida nesta rodada** (aprovado 03/08/2026): o vermelho Sanwey volta a
aparecer também no dark mode, calibrado à parte (não é o `#C7212B` puro —
vibra demais em fundo escuro; ver Artifact pra faixa proposta). Cores de marca
por frente comercial (`src/constants/companies.js`): Sanwey `#C7212B`,
Resibag `#1A6E35`, Grupo `#2D3436`.

**Semântico**

| Token | Light | Dark |
|---|---|---|
| `--success` / `--on-success` | `#15803D` / `#FFFFFF` | `#4ADE80` / `#14251C` |
| `--warning` / `--on-warning` **[NOVO]** | `#B45309` / `#FFFFFF` | `#FBBF24` / `#402B00` |
| `--danger` / `--on-danger` | `#B91C1C` / `#FFFFFF` | `#F87171` / `#2B1214` |
| `--critical-solid` / `--on-critical-solid` **[NOVO, aprovado]** | vermelho de marca (`#C7212B`), não `--danger` | branco |

Os pares `--on-*` existem especificamente pra **texto sobre fundo sólido**
(comentário original em `index.css:31-32`). Regra que a auditoria desta
rodada tornou explícita: **todo componente que usa uma cor semântica como
fundo sólido (não como tinta/borda) precisa usar o `--on-*` correspondente
pro texto — nunca `--on-accent` por reflexo, nunca branco fixo.** Foi
exatamente o bug do `StatCard.jsx` (`accent` vira fundo sólido, texto sempre
`--on-accent` mesmo quando a cor de fundo era `--danger`) e do
`ViewToggleButton.jsx` (branco fixo em vez de `--on-accent`) — os dois já
corrigidos.

`--critical-solid` é o único token de fundo sólido que usa a cor de **marca**
em vez de uma cor semântica genérica — reservado a destaque operacional de
alta urgência (ex.: "Urgentes agora"), não a erro de usuário (isso continua
sendo `--danger`).

**Fundos de status** (`--success-bg`/`--danger-bg`/`--warning-bg`) — sólido
pastel em light, tinta translúcida (`rgba(...,0.12-0.14)`) em dark. Usado em
badge/alerta, nunca como fundo de card grande (ver 1.1 acima).

**Cor de canal** (`--channel-email-*`, `--channel-social-*`, etc.,
`index.css:64-73,125-132`) — é o exemplo mais maduro da plataforma de "cor
categórica com par claro/escuro calibrado à parte" — qualquer paleta
categórica nova (não semântica: sucesso/erro/aviso) deve seguir esse molde,
não inventar `color-mix()` ad hoc.

**Regra**: nunca hardcode hex novo pra um estado que já tem token. Os únicos
hex soltos que sobrevivem hoje são 3 cores categóricas sem significado
semântico (`gold #EAB308`, `admin #7C3AED`, `secondary #2563EB` em
`Badge.jsx`) — aceitável (são identidade de categoria, não estado), mas
qualquer variante nova de chip deve primeiro checar se já existe token
semântico equivalente antes de somar um 4º hex solto.

### 1.2 Tipografia

Fonte: **Inter** (400/500/600/700/800), carregada via Google Fonts
(`index.html:19`), `fontFamily.sans` no Tailwind (`tailwind.config.js:79-81`)
com fallback `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`. Único
uso de fonte alternativa: **Barlow Condensed** (700/800) para numeral grande
de fila/estatística em 3 arquivos (`AnalyticsTab.jsx`, `RHBemEstarView.jsx`,
`BemEstarPublicaForm.jsx`) — uso intencional e estreito (número de posição na
fila FIFO), não generalizar pra título comum.

Escala **[formalização nova — levantada por uso real, não inventada]**:

| Papel | Tamanho | Peso | Exemplo real |
|---|---|---|---|
| Eyebrow / etiqueta de grupo | 10-11px, `letter-spacing: 0.05-0.09em`, uppercase | 700-800 | `KanbanColumnHeader`, `sec-num` de specs |
| Caption / meta | 11-12px | 500-600 | `Card.jsx` meta, sublabel de `StatCard` |
| Body pequeno | 12-13px | 400-600 | corpo padrão de formulário, chip |
| Body | 14-15px | 400-600 | texto corrido, label de campo |
| Subtítulo / título de card | 16-18px | 700 | header de seção dentro de drawer |
| Título de seção | 20-24px | 700-800 | header de página, `PipelineCalendarView` mês |
| Display / stat | 26-32px | 800, `letter-spacing: -0.02em` | `StatCard` valor, KPI |

Regra: qualquer tela nova escolhe o papel primeiro (não o pixel) — evita a
deriva que já gerou `Tabs`/`FilterBar` reescritos 4× antes da extração.

### 1.3 Espaçamento

Grid observado predominante é múltiplo de 4px, com ajustes finos (6/10/14/18)
em componentes densos (chip, badge, linha de tabela compacta) — não é
inconsistência, é o grid de 4px com meio-passo onde o passo cheio fica
apertado. Escala formalizada:

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48` (passo cheio) — meio-passo
(`6/10/14/18`) permitido só dentro de componentes compactos (chip/badge/linha
de lista densa), nunca no espaçamento entre blocos de página.

### 1.4 Raio

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 6px | botão, input, chip antigo |
| `--radius-md` | 8px | ícone-box, elemento médio |
| `--radius-lg` | 12px | card, modal |
| pílula **[NOVO, aprovado]** | 999px | chip/badge (redesenho aprovado nesta rodada) |

### 1.5 Elevação

| Token | Light | Dark |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(55,53,47,.05)` | `0 1px 2px rgba(0,0,0,.22)` |
| `--shadow-pop` | `0 12px 32px rgba(55,53,47,.14), 0 2px 8px rgba(55,53,47,.06)` | `0 16px 40px rgba(0,0,0,.45)` |
| `--overlay-scrim` | `rgba(0,0,0,.45)` | `rgba(0,0,0,.6)` |

Tom "quase plano" de propósito (comentário original, `index.css:41-42`) —
card não flutua por padrão, só levanta (`--shadow-pop` + `translateY(-1px)`)
em hover/foco quando é interativo (`Card.jsx:50-58`).

### 1.6 Iconografia

`lucide-react` exclusivamente, `strokeWidth={2}`. Tamanhos por contexto: 12-14
inline com texto/label, 15-16 padrão de UI (botão, ícone de ação), 18-20
header/navegação. Nenhum outro conjunto de ícone (emoji como ícone funcional,
SVG customizado fora de casos muito pontuais como o ícone de busca do
`HelpTooltip`) entra na plataforma.

---

## 2. Componentes

Cada linha: onde vive, o que já cobre, e o que esta rodada muda (se muda).

| Componente | Arquivo | Estado |
|---|---|---|
| Button | `src/components/ui/Button.jsx` | Maduro — 5 variantes (`primary/dark/secondary/ghost/danger`) × 3 tamanhos, hover/active/disabled tratados. Sem mudança. |
| Chip / Badge | `src/components/ui/Badge.jsx` | **Redesenho aprovado nesta rodada**: pílula (999px), fundo sólido na cor da variante, texto sempre `--on-*` (branco ou quase-preto, nunca a própria cor). Mesmas 9 variantes, mesmos tokens. |
| Input de busca / Select | `src/components/shared/FilterBar.jsx` | Busca com wrapper focável (anel `--accent-tint`) já madura. `<select>` nativo tem popup não estilizável (ver Débitos, item 1). |
| Tabs | `src/components/shared/Tabs.jsx` | Maduro — trilho `--surface-alt` + item ativo `--surface` com `--shadow-card`. Sem mudança. |
| Card / CardGrid | `src/components/shared/Card.jsx` | Maduro — grade/lista no mesmo componente, catálogo (`interactive`) vs seletor. Sem mudança. |
| StatCard | `src/components/ui/StatCard.jsx` | Regra reforçada: `accent` só recebe token semântico com `--on-*` correspondente (nunca fill genérico sem par). |
| KanbanColumnHeader | `src/components/shared/KanbanColumnHeader.jsx` | **Rollout parcial** — "Redesign v2" (`nameFontSize`/`uppercase`/etc.) só em 3 de 10 boards (Pipeline/Entregas/Pós-venda). Ver Débitos, item 3. |
| Calendário (8 telas) | `DeliverableCalendarView`, `PipelineCalendarView`, etc. | **Redesenho aprovado nesta rodada**: evento vira barra sólida na cor da etapa + texto `--on-*`, em vez de pílula 18% opacidade + texto colorido. Ver Débitos, item 2 (duplicação). |
| Modal | `src/components/ui/Modal.jsx` | Usa `--overlay-scrim` + `createPortal` (fix de stacking aplicado em rodada anterior). |
| Tooltip | `src/components/ui/HelpTooltip.jsx` | Ícone "?" — reservado a explicar conceito/label sem elemento próprio pra segurar hint; `title=""` nativo cobre o resto (regra já documentada no `CLAUDE.md`). |
| Toast | `src/components/shared/AppToast.jsx` | `variant="default"`/`"danger"` via token. Sem mudança. |
| Reaproveitamento obrigatório (Kanban) | `MoveStageMenu`, `AvatarStack`, `EditableTitle`, `KanbanFab`, `use-available-height` | Já documentado na tabela da regra 1 do `CLAUDE.md` — este UI Kit não duplica, só referencia. |

---

## 3. Regras

1. Nunca hardcode hex pra um estado que já tem token semântico (`--danger`,
   `--warning`, `--success`, `--accent`, canal de marketing).
2. Fundo sólido de uma cor semântica **sempre** usa o `--on-*` correspondente
   pro texto — nunca `--on-accent` por padrão, nunca branco/preto fixo.
3. Chip/badge é sempre pílula, fundo sólido, texto `--on-*` — não translúcido,
   não com cor no texto.
4. Calendário: evento é barra sólida na cor da etapa, texto `--on-*` — mesma
   regra do chip, mesma razão.
5. Raio: `--radius-sm/md/lg` pra formas retangulares; pílula (999px) só pra
   chip/badge/tab-pill.
6. Elevação por padrão é quase plana (`--shadow-card`); `--shadow-pop` só
   aparece em estado interativo elevado (hover/foco de card clicável, popover,
   modal).
7. Ícone é sempre `lucide-react`, nunca emoji funcional nem SVG solto fora de
   exceção já documentada.
8. Antes de estilizar um componente novo do zero, checar a tabela da Seção 2
   — 90% dos casos já tem componente pronto em `shared/`/`ui/`.
9. Regra 4 do `CLAUDE.md` continua valendo: 3ª ocorrência de um mesmo padrão
   visual/estrutural é o gatilho pra extrair — nem antes, nem depois.

---

## 4. Débitos conhecidos (não bloqueiam a aprovação deste UI Kit)

Registrados aqui pra não serem redescobertos a cada auditoria — não fazem
parte do escopo desta aprovação, ficam como próximo passo natural depois que
o UI Kit em si estiver assentado.

1. **`ui/Select.jsx` / `<select>` nativo sem popup estilizável** — o popup
   aberto é desenhado pelo SO/navegador, não é estilizável por CSS em nenhum
   browser. Corrigir exigiria um componente `Combobox`/`Listbox` próprio
   (já cogitado em rodada anterior, nunca implementado).
2. **8 calendários quase-idênticos, nunca extraídos** — já passou da 3ª
   ocorrência que a regra 4 usa como gatilho. Aplicar o redesenho desta
   rodada em cada um repete o trabalho 8×; extrair um `CalendarGrid`
   compartilhado resolveria de uma vez, mas é uma decisão à parte (perguntada
   e ainda não respondida na rodada de dark mode).
3. **`KanbanColumnHeader` "Redesign v2" só em 3/10 boards** — Marketing,
   Compras de Marketing e os 5 boards de RH ainda usam os defaults antigos
   (`bandHeight=8`, sem `nameFontSize`/`uppercase` customizados).
4. **~15 arquivos ainda com `alert()`/`window.confirm()` nativo** — débito já
   documentado na regra 1 do `CLAUDE.md` (tabela de Toast), não migrar de
   supetão, só ao tocar essas telas por outro motivo.

---

## 5. Como isto vira regra

Depois de aprovado (Artifact + este documento), a diferença prática:

- Este arquivo passa a ser citado no `CLAUDE.md` (seção nova ou extensão da
  seção 6) como leitura obrigatória antes de qualquer decisão de cor,
  tipografia, espaçamento ou componente — mesmo status que
  `docs/design-spec-padroes-de-pagina.md` já tem hoje.
- Qualquer mudança futura de token (cor, raio, espaçamento) atualiza este
  arquivo na mesma mudança — não é um documento "escrito uma vez e
  esquecido".
- Os 4 débitos da Seção 4 viram candidatos naturais de próxima rodada, não
  compromissos desta aprovação.
