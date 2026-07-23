# Padrões de página — Tabela, Kanban, Cards

Decidido com o Daniel em 23/07/2026. Este é o entregável do papel de **Design**
do processo descrito em `CLAUDE.md` regra 3 — a etapa seguinte (**Frontend**)
segue esta spec ao pé da letra; não decide token, cor ou densidade por conta
própria. Auditoria feita em cima do código real (não é aspiracional) — todo
`arquivo:linha` abaixo foi lido, não inferido do nome do arquivo.

Comparação visual usada pra fechar direção com o Daniel: mockups construídos
em cima dos tokens reais de `src/index.css` e dos componentes reais de
`src/components/ui/` — não sobrevive como artefato deste repo, as decisões
que saíram dela é que viram spec aqui.

---

## 0. Diagnóstico — duplicação já confirmada

Regra 4 do `CLAUDE.md`: na 3ª vez que a mesma lógica visual/estrutural for
escrita em módulos diferentes, extrai pra `shared/`. Os itens abaixo já
passaram desse limite:

| Padrão duplicado | Onde (arquivo\:linha) | Ocorrências |
|---|---|---|
| Barra de abas própria (`role="tablist"` reescrito na mão) | `RHFornecedoresView.jsx:528-543`, `RHCargosView.jsx:644-652` (Cargos/Movimentações), `TutoriaisView.jsx:11-16,322-323` | 4 |
| Busca + filtro dropdown, reescrito por tela | `RHFuncionariosView.jsx:1498-1569`, `RHCargosView.jsx:663-683`, `UserManagementView.jsx:463-477`, `SignalsView.jsx:9-15` (chips, não dropdown, mesmo problema de fundo) | 4+ |
| Card "solto" — div estilizada na mão, sem componente | `RHRelatoriosView.jsx:90`, `RHFornecedoresView.jsx:567-582`, `FornecedoresView.jsx` (Marketing), `RHCargosView.jsx:687`, `UserManagementView.jsx:490`, `SignalsView.jsx:136`, `TutoriaisView.jsx:373` | 7 |
| Overlay de modal na mão em vez de `src/components/ui/Modal.jsx` | todas as páginas acima | componente existe, 0 usos confirmados |
| `StatusBadge` local em vez de `src/components/ui/Badge.jsx` (9 variantes prontas) | `RHFuncionariosView.jsx:654` | 1 (mesma classe do bug "R$ R$" — reimplementar o que já existe) |
| "Fornecedores" implementado 2× — mesmo conceito, zero código em comum | `RHFornecedoresView.jsx` (RH, 606 linhas) vs `FornecedoresView.jsx` (Marketing) | tela inteira duplicada — **não confirmado** se são o mesmo dado (unificar) ou domínios genuinamente diferentes tipo CRM/RH (ver regra 2); Frontend confirma antes de decidir o que fazer com esse par |

Inventário do que já existe em `src/components/ui/` e pode ser reaproveitado
sem escrever nada novo: `Badge.jsx` (9 variantes: default/urgent/critical/
gold/neutral/success/dark/admin/secondary), `StatCard.jsx` (tile de KPI —
ícone, valor grande, label, trend opcional, `accent` pra destaque sólido),
`EmptyState.jsx`, `Button.jsx` (5 variantes: primary/dark/secondary/ghost/
danger), `Input.jsx`, `Select.jsx`, `Modal.jsx`, `CommandPalette.jsx` (Cmd-K,
já global). Em `src/components/shared/`: `AvatarStack.jsx`, `AppToast.jsx`,
`SplitPanelDrawer.jsx`, além de tudo já listado na regra 1 do `CLAUDE.md`.

**Componentes que precisam ser criados** (regra 4 já disparada — extrair
agora, não na 5ª cópia): `Tabs` (segmented control genérico), `FilterBar`
(busca + N filtros configuráveis), `Card`/`EntityCard` (casca visual do
Padrão C, ver seção 3).

---

## 1. Padrão A — Tabela com filtro

### Problema observado

Referência: `src/components/views/RHFuncionariosView.jsx` (1767 linhas, view
principal em `:1261`). Já tem boa espinha dorsal:

- Busca por texto (nome/e-mail, client-side): input `:1498-1521`, lógica de
  filtro `:1343-1358`.
- 4 filtros dropdown nativos (Frente, Departamento, Status, Contrato):
  `:1523-1569` — cada um hand-built, não usa um componente de filtro
  compartilhado (não confirmado se usa `ui/Select.jsx` por baixo ou
  `<select>` puro — conferir antes de migrar).
- Ordenação por coluna: estado `sortCol`/`sortDir` ad hoc (`:1281-1284`) +
  `<th>` clicável com `SortIcon` local (`:598-614`).
- Responsivo por **dual-render**, não CSS puro: tabela desktop
  `hidden md:block` (`:1582`) + lista de cards mobile `md:hidden` (`:1670`),
  cada uma mapeando `filtered` de forma independente.
- Clique na linha abre `EmployeeDetailModal` (ou `NovoColaboradorModal` pra
  colaborador sem login) — `:1611-1663`.
- Empty state via `ui/EmptyState.jsx` (`:1573-1578`) — correto, já reaproveita.

O que falta é o que sustenta a tabela em escala:

- **Sem loading state**: `useRHColaboradores` nem desestrutura uma flag de
  `loading` (`:1268`) — não tem nem o "Carregando…" em texto puro que outras
  telas auditadas têm.
- **Sem paginação**: lista inteira sempre renderizada.
- **Sem seleção em massa**: não existe checkbox de linha nem barra de ação
  em lote (o "Importar Documentos" da tela é upload em lote, não ação sobre
  linhas selecionadas — conceito diferente).
- **`StatusBadge` local** (`:654`) em vez de `ui/Badge.jsx`.

### Vocabulário de tokens/componentes já em uso

| Item | Token/componente | Uso já estabelecido |
|---|---|---|
| Badge de status | `ui/Badge.jsx` variantes `success`/`urgent`/`critical`/`neutral` | pronto, não usado ainda nesta tela |
| Empty state | `ui/EmptyState.jsx` | já usado corretamente (`:1573`) |
| Botão primário | `ui/Button.jsx` variant `primary` | `background:var(--accent)`, `color:var(--surface)` |
| Avatar | círculo com iniciais + cor de fundo, mesmo padrão do `AvatarStack.jsx` (`background:u.avatarBg`, `color:#FFF`) | reaproveitar o mesmo esquema de cor pra avatar único de linha |

### Especificação — o que muda

| Elemento | Mantém | Novo |
|---|---|---|
| Busca + 4 filtros | ✓ como está | — |
| Ordenação por coluna | ✓ como está | — |
| Clique na linha → detalhe | ✓ como está | — |
| Dual-render mobile | ✓ como está (não vale a pena unificar agora — CSS puro exigiria reescrever a tabela inteira como grid, custo não justificado só por este gap-fill) | — |
| Status | trocar `StatusBadge` local por `ui/Badge.jsx` | — |
| Carregamento | — | skeleton de linha (blocos cinza com shimmer, mesma altura da linha real) enquanto `loading` |
| Volume grande | — | paginação — **tamanho de página não confirmado**; usar default de 50/página, deixar constante fácil de ajustar. Frontend confirma volume real (`SELECT count(*)`) antes de fixar |
| Ações em lote | — | checkbox por linha + barra contextual fixa acima da tabela quando `selected.length > 0` (ex.: exportar seleção, alterar status em massa) — abre no `ui/Modal.jsx` compartilhado, não overlay novo |
| Exportar | — | botão "Exportar CSV" no canto superior direito, ao lado do "+ Novo" — mesma posição já usada em `RHRelatoriosView.jsx:77-84` |

### Comportamento por estado

1. **Carregando** — skeleton de linha, sem filtros desabilitados (usuário já
   pode digitar/filtrar, resultado aplica assim que os dados chegam).
2. **Vazio (sem filtro)** — `EmptyState` já existente, sem mudança.
3. **Vazio (com filtro aplicado)** — **gap não coberto hoje**: confirmar se
   `RHFuncionariosView` distingue "sem colaborador cadastrado" de "nenhum
   resultado pra este filtro" — merece mensagem diferente (`EmptyState` com
   texto "Nenhum resultado pra estes filtros" + ação "Limpar filtros"), mas
   isso é achado desta spec, não confirmado se já existe.
4. **Linha selecionada** — checkbox marcado, fundo `var(--accent-tint)`,
   barra de ações em lote aparece/atualiza contador.
5. **Página trocada (paginação)** — mantém filtros e ordenação ativos; volta
   a linha 1 automaticamente se o usuário mudar busca/filtro (não se mudar
   só de página).

### Páginas candidatas a este padrão

`RHFuncionariosView.jsx` (referência, só recebe o gap-fill). Candidata
adicional: aba "Contratos" de Fornecedores (`ContratosTableView`, dentro de
`RHFornecedoresView.jsx:418-497`) já é uma tabela — avaliar migrar pro
Padrão A quando esse arquivo for tocado.

---

## 2. Padrão B — Kanban

Já é o padrão mais maduro da plataforma (regra 1 e 2 do `CLAUDE.md`) — 9
boards compartilham `useAvailableHeight`, `KanbanFab`, `MoveStageMenu`,
`AvatarStack`. CRM e RH continuam como duas famílias paralelas *de propósito*
(regra 2) — esta spec não mexe nessa separação.

### Backlog em aberto (não bloqueante, não decidido nesta rodada)

- Marketing, Entregas e Compras usam card inline próprio — não herdam nem
  `LeadKanbanCard.jsx` nem `RHKanbanCard.jsx`. Candidatos a migrar pro card
  compartilhado da família mais próxima (decidir CRM ou RH por módulo, regra
  2), mas **sem prioridade definida** — entra na fila geral, não nesta spec.
- Nenhum board tem filtro rápido acima das colunas (por responsável, tag,
  urgência) — filtrar hoje exige abrir card por card. Também sem prioridade
  fechada.

Nada mais muda no Padrão B por esta spec.

---

## 3. Padrão C — Grade de cards (novo)

### Problema observado

Não existe hoje um padrão — existem 7 telas reinventando a mesma grade de
divs arredondadas, cada uma do seu jeito:

- `RHRelatoriosView.jsx` (122 linhas): grid `repeat(auto-fill,minmax(280px,1fr))`
  (`:90`), cada card = categoria com checkboxes (`:96-103`), sem busca, sem
  tabs, loading em texto puro (`:88`).
- `RHFornecedoresView.jsx` (606 linhas, view em `:499`): grade de cards
  clicáveis como botão (`:567-582`), `role="tablist"` próprio (`:528-543`),
  empty state customizado **sem** usar `ui/EmptyState.jsx` (`:560-563`).
- `FornecedoresView.jsx` (Marketing): mesmo conceito, implementação
  divergente — esta já usa `EmptyState` corretamente (`:152`).
- `RHCargosView.jsx` (816 linhas, view em `:532`): grid `:687` + busca e
  filtro de departamento (`:663-683` — diferente de Relatórios/Fornecedores,
  que não têm nenhum), mais um toggle grade/lista (`LayoutGrid`/`List`,
  `:746-761`) só na aba Movimentações — é o único lugar da plataforma onde
  esse idioma já existe.
- `UserManagementView.jsx` (cards `:490` + busca `:463-477` + `StatMini`),
  `SignalsView.jsx` (cards `:136` + chips de urgência `:9-15`),
  `TutoriaisView.jsx` (`VideoCard` grid `:373` + tabs ad hoc `:11-16`).

Duas naturezas diferentes escondidas atrás do mesmo visual — confirmado por
decisão do Daniel em 23/07: **tratar como uma variante só, comportamento
adaptado** (não dois padrões documentados separadamente):

- **Catálogo de registro** — Fornecedores, Cargos, Gestão de Usuários,
  Sinais, Tutoriais. O card inteiro é um link: clica, abre o registro.
- **Seletor de opção** — Relatórios. O card é um grupo de checkbox: clica,
  marca; não navega.

### Vocabulário de tokens/componentes já em uso

| Item | Token/componente | Detalhe |
|---|---|---|
| Faixa de resumo | `ui/StatCard.jsx` | ícone 36×36 em `var(--surface-alt)`, valor 32px/800, label 14px/dim, `trend`/`sublabel` opcionais, prop `accent` pra tile de destaque sólido (usar em métrica que pede atenção, ex. "vencendo em 30 dias" — **nunca** `var(--accent)` sozinho pra isso, é `--amber`/`--warning` que carregam esse significado, regra 1 do `CLAUDE.md`) |
| Badge de status no card | `ui/Badge.jsx` | `success` (ativo/ok), `urgent` (vencendo — usa `--amber`/`--warning` por baixo) |
| Toggle grade/lista | idioma já existe 1× em `RHCargosView.jsx:746-761` (`LayoutGrid`/`List`) | oficializar como componente, não reescrever |
| Empty state | `ui/EmptyState.jsx` | já existe — `RHFornecedoresView.jsx:560-563` **não usa**, precisa voltar a usar na migração |

### Decisões fechadas com o Daniel (23/07/2026)

1. **Densidade do card**: toggle grade/lista controlado pelo usuário, por
   página — não fixo no design nem uma densidade global única. Formaliza o
   idioma que já existe 1× em Cargos › Movimentações.
2. **Faixa de resumo**: sim, sempre que a página tiver métrica óbvia de
   contagem/valor/alerta — usa `StatCard`, que já existe (reuso, não
   trabalho novo).
3. **Catálogo vs. seletor**: um componente de card só, dois comportamentos —
   não dois padrões documentados separadamente.

### Especificação — casca visual (vale pros dois comportamentos)

| Propriedade | Valor |
|---|---|
| Borda | `1px solid var(--border)` |
| Raio | `var(--radius-lg)` (12px, mesma escala do `StatCard`) |
| Sombra em repouso | `var(--shadow-card)` |
| Sombra + elevação no hover (só variante catálogo — seletor não eleva, não é clicável como link) | `var(--shadow-pop)`, `translateY(-1px)`, borda `var(--border-strong)` |
| Grid | `repeat(auto-fill,minmax(260px,1fr))`, `gap:14px` — mesma proporção já usada em `RHCargosView.jsx:687` e `RHRelatoriosView.jsx:90` (280px) |

### Especificação — variante catálogo

Anatomia do card: ícone/avatar de categoria (quadrado 38×38, `border-radius:
8px`, cor de fundo por categoria) + nome (14px/700) + meta (12px,
`var(--text-faint)`) + kebab de ações que só aparece no `:hover` (mesmo
comportamento de affordance progressiva do `MoveStageMenu` no Kanban) +
badge(s) de status + rodapé com borda superior (`1px solid var(--border)`)
contendo valor/contagem + "ver detalhes" que aparece no hover.

Toolbar acima da grade: busca (`ui/Input.jsx` com ícone) + filtro dropdown
(`ui/Select.jsx`) quando fizer sentido pro domínio + toggle grade/lista
alinhado à direita. Faixa de `StatCard` acima da toolbar quando houver
métrica (decisão 2 acima).

Densidade compacta (view = lista): linha única ~56px, avatar 26px, nome +
meta inline, status como ponto colorido + label curto em vez de badge cheio,
valor alinhado à direita. Existe pra listas longas (Usuários, Sinais) — o
card rico vira custo visual sem ganho quando são dezenas de itens.

### Especificação — variante seletor (Relatórios)

Mesma casca (borda/raio/sombra/espaçamento) — conteúdo e interação mudam:

- Cabeçalho do card = ícone de categoria + título + "marcar todos" da
  categoria (já existe em `RHRelatoriosView.jsx:96-103`, mantém).
- Corpo = lista de checkbox, um por métrica (mantém).
- Card **não** eleva no hover nem tem kebab — não é link.
- Novo: busca por métrica no cabeçalho da página (22 métricas em 8
  categorias hoje sem nenhuma forma de busca).
- Novo: barra fixa (top, não flutuante) com contador "N métricas
  selecionadas" + botão "Salvar como modelo" (novo — presets reutilizáveis
  de seleção) + "Exportar CSV" (mantém, já existe em `:77-84`).

### Comportamento por estado

1. **Carregando** — skeleton de card (bloco cinza shimmer no lugar do
   conteúdo, mesma proporção do card real).
2. **Vazio** — `ui/EmptyState.jsx` sempre (corrige o gap de
   `RHFornecedoresView.jsx:560-563`).
3. **Vazio com filtro aplicado** — mesma lacuna do Padrão A, item 3: mensagem
   diferenciada + "limpar filtros", não confirmado se já existe em algum
   lugar — tratar como gap novo.
4. **Catálogo, hover** — eleva, mostra kebab e "ver detalhes".
5. **Catálogo, card com alerta** (ex.: contrato vencendo) — badge `urgent`
   (`--amber`/`--warning`), nunca `--accent` (regra 1 do `CLAUDE.md`).
6. **Seletor, item marcado** — checkbox preenchido `var(--accent)`, contador
   da barra superior atualiza.
7. **Seletor, categoria inteira marcada** — "marcar todos" vira estado
   ativo (mesmo comportamento que já existe hoje).

### Páginas candidatas a este padrão

| Página | Variante | Arquivo |
|---|---|---|
| Fornecedores (RH) | catálogo | `RHFornecedoresView.jsx` |
| Fornecedores (Marketing) | catálogo | `FornecedoresView.jsx` — **confirmar primeiro** se unifica com o de RH ou fica como par intencional (ver diagnóstico, seção 0) |
| Cargos (aba Cargos) | catálogo | `RHCargosView.jsx` |
| Gestão de Usuários | catálogo | `UserManagementView.jsx` |
| Sinais | catálogo | `SignalsView.jsx` |
| Tutoriais | catálogo | `TutoriaisView.jsx` |
| Relatórios de RH | seletor | `RHRelatoriosView.jsx` |

Fora do escopo desta spec: `InsightsView.jsx` (grid de `StatCard` — já é o
padrão de resumo que as páginas de catálogo acima estão ganhando, não uma
tela pra migrar); `Comunicação` (parece um 4º padrão — formulário/config —
não avaliado nesta rodada); `RHCargosView.jsx` aba Movimentações (já tem
toggle grade/lista + modo tabela — decidir se vira Padrão A quando em modo
tabela, ou fica como está; não bloqueante).

---

## 4. Ferramentas transversais — priorização

**Agora (baixo risco, alto retorno — reaproveita o que já existe):**
skeleton de carregamento (0 páginas auditadas têm); Badge/EmptyState sempre
pelo componente; adotar `Modal.jsx`; extrair `Tabs` e `FilterBar` (regra 4 já
disparada).

**Depois (decisão de produto ou depende de volume real, não bloqueia o
gap-fill acima):** paginação + ação em massa (depende do volume real de
linhas — confirmar antes de fixar tamanho de página); atalho de teclado
(N = novo, / = busca); salvar filtro como "view"; migrar Marketing/
Entregas/Compras pro card de Kanban compartilhado; filtro rápido acima do
board Kanban.

---

## 5. Achado colateral (fora de escopo desta spec)

`src/components/ui/Button.jsx` variant `primary` fixa `color:"#FFFFFF"`
(`:17`), mas `background` usa `var(--accent)` — no dark mode `--accent` vira
`#EBEBDF` (quase branco, `src/index.css:89`). Texto branco fixo sobre fundo
quase branco é um contraste que pode estar quebrado — não confirmado
visualmente (não rodei o app em dark mode pra verificar), e não corrigido
aqui por estar fora do escopo de padrão de página. Registrado pra alguém
conferir à parte.

---

## 6. Ordem de implementação recomendada

Não faz sentido migrar página nenhuma antes dos 3 componentes novos
existirem — toda migração dependeria de reescrever depois. Ordem sugerida
pro Frontend:

1. Extrair `Tabs`, `FilterBar`, `Card` (`shared/`) + adotar `Modal.jsx` onde
   já há overlay na mão — sem tocar em nenhuma página ainda, só criar os
   componentes a partir do que já existe (regra 4: extrai o padrão real, não
   desenha um novo).
2. Gap-fill do Padrão A em `RHFuncionariosView.jsx` (piloto único da
   Tabela — não há outra tabela candidata imediata).
3. Migrar **uma** página catálogo (sugestão: Fornecedores RH, é a que já
   tem o exemplo de conteúdo usado na decisão com o Daniel) + Relatórios
   (seletor) — valida as duas variantes do Padrão C antes de propagar pras
   outras 5 páginas catálogo.
4. QA (regra 3 do `CLAUDE.md`) nos pilotos antes de propagar.
5. Propagar pro resto da lista da seção 3.

Backlog "Depois" da seção 4 fica pra depois desse ciclo, não faz parte do
gap-fill obrigatório.
