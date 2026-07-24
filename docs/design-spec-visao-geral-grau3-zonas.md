# Grau 3 — Template Editorial de 3 Zonas + Personalização por Widget

Migração do Grau 2 "Vocabulário Comum" (já implementado, commitado, aprovado em
QA — `docs/design-spec-visao-geral-vocabulario-comum.md` +
`docs/design-spec-visao-geral-mobile-adendo.md`) para o Grau 3 "3 Zonas
Verticais" (proposta original em `docs/design-spec-visao-geral-3-zonas.md`),
com uma camada nova: toggle de visibilidade por widget dentro de cada zona
(sem drag, sem reordenar, sem redimensionar — decisão já fechada com o
Daniel) e uma Zona 4 livre com título editável.

**Isto é reorganização de conteúdo já migrado, não redesign.** Todo átomo
visual do Grau 2 (`StatCard`, `Eyebrow`/`PanelTitle` de `PanelHeading.jsx`,
`PanelEmptyState`, "Painel", Badge) continua valendo sem alteração de
tokens — esta spec só define a ORDEM (3 zonas fixas) e adiciona o mecanismo
de mostrar/ocultar.

Arquivos lidos por inteiro antes de escrever esta spec (estado real
pós-Grau-2, não a proposta original):
`src/components/views/DashboardView.jsx`,
`src/components/views/MarketingDashboardView.jsx`,
`src/components/views/RHOverviewView.jsx`,
`src/components/views/ExecutiveDashboard.jsx`,
`src/components/shared/PanelHeading.jsx`,
`src/components/shared/PanelEmptyState.jsx`,
`src/components/ui/Modal.jsx`, `src/components/ui/StatCard.jsx`,
`src/constants/user-settings.js`, `src/constants/storage-keys.js`,
`src/hooks/use-persistent-state.js`, `src/hooks/use-screen-tips.js`,
`src/hooks/use-changelog-notice.js`,
`src/components/views/SettingsView.jsx` (trecho de widgets),
`src/components/shell/Sidebar.jsx` (padrão `loadOrder`/`saveOrder`).

---

## 0. Achado crítico — já existe um mecanismo de toggle de widget (parcial)

Antes de especificar algo novo: **`DashboardView.jsx` (Comercial) já tem
toggle de widget hoje**, e não é mencionado em nenhum dos 4 documentos-base
porque foi implementado por outro motivo, num momento diferente. Achado real,
não achismo:

- `DashboardView.jsx:21-23`: recebe prop `visibleWidgets` e define
  `widgetVisible = (id) => !visibleWidgets || visibleWidgets.includes(id)`.
  Os 4 `StatCard` da faixa de topo (`leads_count`, `pipeline_open`,
  `won_value`, `avg_fit`, `:166-192`) já são individualmente ocultáveis.
- A fonte de `visibleWidgets` é `settings.visibleDashboardWidgets`
  (`App.jsx:1536`), que vem de `useUserSettings()` (`use-user-settings.js`),
  que por sua vez é `usePersistentState(STORAGE_KEYS.userSettings, ...)` —
  **uma única chave de localStorage, sem escopo por usuário** (diferente do
  padrão `screenTipsSeen`/`changelogSeen`, que são `{ [userId]: {...} }`).
  Editável hoje só pela página Configurações → Preferências
  (`SettingsView.jsx:878-894`, `DASHBOARD_WIDGETS` em `user-settings.js:4-9`).
- O mesmo mecanismo (`EXECUTIVE_WIDGETS`, `user-settings.js:17-25`) já
  alimenta `ExecutiveDashboard.jsx` — mas essa é a tela **"Painel
  Executivo"**, uma 4ª tela cross-departamento, diferente das 3 "Visão
  Geral" por frente que são o escopo desta migração. Não mexer nela aqui.
- Marketing e RH **não têm nenhum mecanismo de toggle hoje** — é 100% novo
  pra essas duas telas.

**Decisão (subjetiva, registrando as 2 opções):**

- **A — estender `useUserSettings`/`DASHBOARD_WIDGETS`** pros widgets novos
  das 3 zonas nas 3 telas. Prós: reaproveita 100%, zero storage novo.
  Contras: (1) herda o bug de escopo (não é por usuário, é por navegador —
  problemático numa máquina compartilhada); (2) `useUserSettings` é um saco
  global (empresas habilitadas, densidade, notificações, Kanban) — colocar
  o estado de 3 zonas × 3 telas ali aumenta o raio de risco de qualquer
  mudança nesse hook; (3) o pedido explícito do Daniel é um controle
  **inline** ("Personalizar" dentro da própria tela), o que já é uma UX
  diferente da página de Configurações separada que `useUserSettings`
  serve hoje.
- **B — escolhida.** Mecanismo novo e dedicado (`useDashboardWidgetPrefs`,
  chave própria `dashboardWidgetPrefs`), seguindo o padrão
  `{ [userId]: {...} }` de `use-screen-tips.js`/`use-changelog-notice.js`
  (que É por usuário, corrigindo de fábrica o problema de escopo que a
  opção A herdaria). Como parte desta migração, **os 4 widgets que já
  existem no Comercial migram pra este novo mecanismo** (mesmos IDs:
  `leads_count`, `pipeline_open`, `won_value`, `avg_fit` — sem renomear,
  sem mudar semântica, só de "onde mora o dado"). A seção "Widgets do
  Dashboard" de `SettingsView.jsx:878-894` e o campo
  `visibleDashboardWidgets`/`DASHBOARD_WIDGETS` saem de uso (ver §8) —
  não ficam 2 controles diferentes pros mesmos 4 StatCards.
  `visibleExecutiveWidgets`/`EXECUTIVE_WIDGETS` (Painel Executivo)
  **não mudam** — fora de escopo, tela diferente.

**Correção de premissa** (o pedido original sugeria "a faixa de Resumo
provavelmente é sempre visível, não widget opcional"): o Comercial já prova
em produção, aprovado, que os StatCards de Zona 1 SÃO individualmente
ocultáveis — não é uma hipótese, é comportamento existente. Esta spec
generaliza esse comportamento já validado pras 3 telas em vez de introduzir
uma regra nova e mais restritiva sem necessidade (ver §4).

---

## 1. Reestruturação Grau 2 → Grau 3, por tela

Ordem fixa nas 3 telas: **Header → Zona 1 "Resumo" → Zona 2 "O que fazer" →
Zona 3 "Tendência" → Zona 4 (livre)**. `space-y-7` (28px) entre blocos,
igual à proposta original (`design-spec-visao-geral-3-zonas.md` §2).

### 1.1 Comercial (`DashboardView.jsx`)

| Zona | Fonte real hoje (pós-Grau-2) | Muda |
|---|---|---|
| Header | `:126-158` (saudação, subtítulo, botões Atualizar/Exportar) | Nada estrutural — só ganha o botão "Personalizar" (§4) |
| Zona 1 — Resumo | `:160-193`, 4 `StatCard` em carrossel mobile / grid desktop, já com `widgetVisible` | Nada de layout — só passa a ler do novo hook em vez de `visibleWidgets` prop (§8) |
| Zona 2 — O que fazer | `:196-274`, eyebrow "Tarefas e prazos" + 4 `TaskBucket` | Nada de layout — cada bucket vira 1 widget toggleável (§4) |
| Zona 3 — Tendência | **Não existe hoje** | Novo painel "Distribuição por etapa do funil" (§2) |
| Zona 4 — livre | Não existe | Novo, sempre por último (§6) |

Note que a ordem mobile invertida (Tarefas antes de Stats, adendo mobile §2)
**continua igual** — ver §7.

### 1.2 Marketing (`MarketingDashboardView.jsx`)

| Zona | Fonte real hoje | Vai pra / muda |
|---|---|---|
| Header | `:516-545` (H1, subtítulo, badge "ao vivo", `CompanyTabs`) | Ganha botão "Personalizar" |
| Zona 1 — Resumo | KPI strip `:548-577` (5 tiles) + `AgencyMetrics` `:340-360` (`SLA cumprido`, `Lead time médio` — **não** "Presas em revisão", que vira Zona 2) | 7 tiles ao todo, cada um toggleável. "Presas em revisão" sai daqui |
| Zona 2 — O que fazer | **Novo bloco.** Fonte de dado: `AgencyMetrics`'s `m.stuck` (`:326-328`, já calculado) + novo filtro de `fDeliverables` por `deadline` vencido | 2 buckets: "Entregas atrasadas", "Presas em revisão" (mesmo componente de bucket do Comercial, ver §5) |
| Zona 3 — Tendência | `:580-628` — Atividade mensal + Canal (`Panel`, `:580-587`), Pipeline por etapa (`:590-597`), Burn rate + Categoria (`:611-618`), Top 5 (`:623-628`) | Mesmos painéis, mesma ordem, mesmo grid interno 3fr/2fr — cada painel vira 1 widget toggleável |
| Zona 4 — livre | Não existe | Novo |

**Correção de nomenclatura do doc original**: a proposta 3-zonas (§3.2)
listava "Eyebrow Efetividade da agência" e "Eyebrow Análise financeira"
como agrupadores que sobreviveriam. Pós-reorganização, "Efetividade da
agência" desaparece como eyebrow própria (seus 2 tiles KPI-puros sobem pra
Zona 1, seu bucket de urgência desce pra Zona 2) — não sobra conteúdo pra
essa eyebrow existir sozinha. "Análise financeira" (Burn rate + Categoria)
continua como agrupador dentro da Zona 3, mas cada painel dentro dela é
independentemente toggleável (§4) — se o usuário desligar os dois, a
eyebrow "Análise financeira" some junto (não fica um rótulo vazio).

### 1.3 RH (`RHOverviewView.jsx`)

Tela que mais muda de casca — hoje não reaproveita zona nenhuma, é 1 bloco
de stats + 1 card de turnover + grid de 3 colunas + 1 card de departamento,
tudo com o mesmo estilo `card` local (`:182-187`).

| Zona | Fonte real hoje | Vai pra / muda |
|---|---|---|
| Header | `:193-216` | Ganha botão "Personalizar" |
| Zona 1 — Resumo | `statCards` `:175-180`/`:218-230` (Total, Ativos, Férias, Afastados) + Turnover `:243-253` ("Desligamentos", "Taxa aproximada" — **não** "Voluntários", que vai pra Zona 3) | 6 tiles, cada um toggleável |
| Zona 2 — O que fazer | **Novo bloco**, agrupando conteúdo hoje solto: Vagas em Aberto (`:276-350`), Férias Pendentes (`:406-473`), e o aviso estático "sem entrevista" (`:264-268`, hoje texto solto) reclassificado em lista de itens | 3 buckets: "Férias pendentes" (`amber`), "Vagas em aberto" (neutro), "Desligamentos sem entrevista" (`danger`) — mesmo componente de bucket do Comercial |
| Zona 3 — Tendência | "Voluntários" + `exitPorTipo` (`:255-263`) + Distribuição por Departamento (`:476-547`) + **Admissões Recentes** (`:352-404`, ver §3) | 3 painéis: "Distribuição por departamento", "Desligamentos por tipo" (Voluntários % + chips), "Admissões recentes" |
| Zona 4 — livre | Não existe | Novo |

**Nota**: "Vagas em Aberto" e "Férias Pendentes" hoje são 2 das 3 colunas de
um `grid-cols-3` (`:272-274`); a 3ª coluna ("Admissões Recentes") sai desse
grid e vai pra Zona 3 (§3). O grid de 3 colunas vira grid de 2 buckets +
1 bucket novo (desligamentos sem entrevista) na Zona 2 — layout responsivo
recalculado pelo Frontend (1 → 2 → 3 colunas conforme largura, mesma lógica
de `grid md:grid-cols-2 lg:grid-cols-3` já usada em outros pontos da base).

---

## 2. Comercial sem Zona 3 — confirmado, Opção A ainda se aplica

A proposta original (`design-spec-visao-geral-3-zonas.md` §3.1) já resolveu
isso com **Opção A**: distribuição de leads por etapa, reaproveitando
`ExecutiveDashboard.jsx:143-173` (`funnelStages`, agregação por etapa a
partir de `pipelines[companyId]`, já trata `isGroupView`/múltiplas empresas
corretamente) como referência de cálculo, e o visual já provado 2× na
plataforma (`StagePipelineBar` do Marketing,
`MarketingDashboardView.jsx:108-142`; distribuição por departamento do RH,
`RHOverviewView.jsx:476-547`) como referência visual.

**Confirmado, ainda válido**: `DashboardView.jsx` já tem `scopedLeads`
(`:38-54`, já trata `isGroupView`/`isConsultor`/`isManager`) e `pipelines`
como prop (`:21`) — zero dado novo precisa ser buscado. Widget novo:
`stage_distribution` ("Distribuição por etapa do funil"), barra empilhada +
legenda, idêntico ao recipe do `StagePipelineBar`.

**Sinalizado pro Frontend (regra 4 do CLAUDE.md)**: com esta migração, a
mesma forma visual "barra empilhada por etapa + legenda com contagem"
aparece pela **3ª vez** (Marketing, RH-departamento, agora Comercial) —
candidato a extração pra `shared/`. Não é trabalho desta spec decidir o
nome do arquivo, só sinalizar o gatilho.

Opção B (gráfico de valor ganho por mês) da proposta original **não entra
nesta rodada** — seguimos com o que já foi decidido lá: menor esforço,
fecha o gap com risco mínimo, fica como próximo passo natural.

---

## 3. "Admissões Recentes" do RH — decisão tomada nesta spec

A proposta original (`design-spec-visao-geral-3-zonas.md` §4) deixou em
aberto porque é decisão de produto, não de design puro. Como o Daniel não
se pronunciou especificamente sobre isso nesta conversa, **decido seguir
com a Opção 1 nesta spec** (registrado como reversível, não definitivo):

**Escolhida: manter na Visão Geral, como painel de Zona 3** ("Atividade
recente" / "Admissões recentes", mesmo conteúdo de hoje,
`RHOverviewView.jsx:352-404`, sem mudança de dado).

**Por quê, dado que a Opção 2 (tirar da Visão Geral) também era válida**:

1. Esta migração inteira é enquadrada como reorganização de conteúdo já
   existente, não corte de conteúdo — remover uma seção ativa é uma decisão
   de produto maior (onde ela reaparece: link em Departamento? seção nova
   em Funcionários?) que não deveria ser decidida de forma implícita dentro
   de uma spec de reorganização visual. Manter é a opção que não pré-julga
   essa decisão de produto.
2. É reversível nos dois sentidos, mas com custo assimétrico: tirar agora e
   descobrir depois que fazia falta exige recriar a seção (e ninguém lembra
   o formato exato); manter agora e decidir depois tirar é trivial (1 linha
   de toggle a menos). Menor risco pela via reversível mais barata.
3. O encaixe em "Tendência-no-sentido-de-atividade-recente" é esticado
   (a proposta original já admite isso), mas não mais esticado que "Top 5 ·
   performance" do Marketing, que a própria proposta original já aceitou
   como o encaixe "menos errado" das 3 zonas sem virar bloqueio.

**Registrado como pendente de confirmação do Daniel**: se ele preferir a
Opção 2 (tirar da Visão Geral, virar link dentro de Departamento ou de
Funcionários), é uma troca de 1 zona → uma linha de navegação, não uma
reescrita — não bloqueia o resto desta migração.

---

## 4. Toggle de widget por zona — mecanismo exato

### 4.1 O que é toggleável vs. o que não é

**Toggleável — cada elemento abaixo é 1 widget independente**, com
`id`/`label` fixos por tela (registro completo em §5):

- **Zona 1**: cada `StatCard` individualmente (Comercial: 4; Marketing: 7;
  RH: 6) — generalização do comportamento já existente e aprovado no
  Comercial (ver §0, correção de premissa).
- **Zona 2**: cada bucket de tarefa/alerta (Comercial: 4; Marketing: 2;
  RH: 3).
- **Zona 3**: cada painel/gráfico (Comercial: 1; Marketing: 6; RH: 3).

**NÃO toggleável — sempre visível, nunca entra na checklist**:

- **Header inteiro** (saudação, subtítulo, `CompanyTabs`, botões
  Atualizar/Exportar/Personalizar) — é casca da página, não widget de
  dado.
- **O cabeçalho de cada zona** (eyebrow "Tarefas e prazos" no Comercial,
  "Pendências" novo em Marketing/RH — ver §1.2/§1.3; título de cada painel
  dentro da Zona 3) — o rótulo em si não é um widget, só o conteúdo abaixo
  dele é. Isso garante que, mesmo com 0 widgets visíveis numa zona, o
  usuário ainda vê "esta seção existe" e sabe que pode reabilitar algo via
  Personalizar (ver estado vazio abaixo).
- **A própria Zona 4** enquanto estrutura (título editável + placeholder,
  ver §6) — não é um widget que se liga/desliga, é a seção em si.

**Widgets condicionados por papel** (não aparecem na checklist de quem não
tem acesso, mesma lógica que `EXECUTIVE_WIDGETS`'s `dept` já usa hoje,
`user-settings.js:17-25`, `SettingsView.jsx:902-906`): no Marketing, os
widgets `kpi_agency_sla`, `kpi_agency_leadtime`, `bucket_agency_stuck`,
`panel_burn_rate`, `panel_category_donut` só existem pra quem NÃO é
`isAgencia` (mesmo gate que já existe hoje, `MarketingDashboardView.jsx:600,608`)
— pra um usuário `agencia`, esses 5 IDs nem aparecem no modal de
Personalizar, exatamente como hoje o `EXECUTIVE_WIDGETS` já filtra por
`dept` antes de listar os `ToggleRow`.

### 4.2 Comportamento quando uma zona fica com 0 widgets visíveis

O cabeçalho da zona permanece (não toggleável, ver acima) e, no lugar do
conteúdo, aparece o mesmo tier de empty state já formalizado no Grau 2
(`PanelEmptyState`, texto centralizado 12px `var(--text-dim)`): **"Nenhum
item selecionado para esta seção."** — sem botão dentro do empty state (o
botão "Personalizar" já está sempre visível no header da página, não
precisa duplicar a ação). Isso vale pras 3 zonas nas 3 telas, tratamento
único — evita reinventar um 4º "vazio" diferente dos 3 já catalogados no
Grau 2 (`design-spec-visao-geral-vocabulario-comum.md` §3.6).

Este é um estado **diferente** do "zona vazia por falta de dado" que o Grau
2 já cobre (ex.: 0 pendências reais no Comercial → "Nada urgente por aqui.
Seus negócios estão em dia.") — são 2 causas distintas (dado real vazio vs.
widget escondido por preferência), mas o **tratamento visual é o mesmo**
(mesmo componente, texto diferente) — não é um 5º tier de empty state, é o
mesmo tier 2 reaproveitado com conteúdo diferente.

### 4.3 UI do controle — botão + modal

**Decisão: 1 botão "Personalizar" no header da página, cobrindo as 3 zonas
de uma vez — não 1 botão por zona.**

- **Opções consideradas**:
  1. **Escolhida** — 1 botão no header, 1 modal com as 3 zonas
     organizadas em seções.
  2. Rejeitada — 1 botão pequeno por zona (3 botões na página). Prós:
     contextual, o usuário abre exatamente a seção que quer editar. Contra:
     3 pontos de entrada fazendo a mesma coisa (abrir um checklist) é mais
     chrome visual competindo com os próprios eyebrows de zona por atenção,
     e no mobile 3 ícones pequenos espalhados pela página são mais difíceis
     de notar/alcançar que 1 ação fixa no topo — o padrão de "1 lugar
     central pra preferências" já é como `SettingsView.jsx` resolve
     exatamente esse mesmo tipo de decisão hoje (widgets do Dashboard e do
     Painel Executivo, ambos numa seção única de Configurações, não
     espalhados pela tela onde aparecem).
- **Posição**: mesma linha do H1/subtítulo, ao lado dos botões de ação já
  existentes — Comercial: ao lado de Atualizar/Exportar
  (`DashboardView.jsx:138-157`); Marketing e RH não têm botões de ação
  hoje, então "Personalizar" é o primeiro botão dessa linha nessas 2 telas.
- **Componente**: `ui/Button.jsx` `variant="secondary"` `size="md"`
  `icon={SlidersHorizontal}` (lucide-react, já em uso em 18+ arquivos da
  base pra ações de configuração/filtro — não é ícone novo), texto
  "Personalizar" (some no mobile abaixo de 1024px se o espaço não couber,
  vira ícone-only com `aria-label="Personalizar"`, mesma regra do adendo
  mobile §4 pra botões futuros do Marketing).
- **Modal**: `ui/Modal.jsx` (componente já existente, **0 usos confirmados
  hoje** conforme já sinalizado no CLAUDE.md — esta é a primeira aplicação
  real), `title="Personalizar [Comercial/Marketing/RH]"`, `width={560}`
  (default do componente, adequado pro conteúdo).
  - Corpo do modal: 1 seção por zona que tiver ao menos 1 widget
    toggleável (Zona 1 sempre; Zona 2 e Zona 3 sempre nas 3 telas com esta
    migração), cada seção com um rótulo pequeno acima (`fontSize: 11,
    fontWeight: 700, textTransform: uppercase, letterSpacing: 0.08em,
    color: var(--text-dim)` — mesmo estilo do `Eyebrow`, mas sem o
    componente inteiro, já que aqui não tem ação "ver mais" ao lado; um
    `<div>` simples com o mesmo CSS basta) com o nome da zona ("Resumo",
    "O que fazer", "Tendência").
  - Dentro de cada seção: lista de checkboxes, 1 por widget, reaproveitando
    exatamente o recipe visual de `ToggleRow` já existente em
    `SettingsView.jsx:65-87` (label 14px/500 + checkbox 16×16
    `accentColor: var(--text)`, `py-2.5`, sem sublabel a menos que o widget
    precise de uma linha de contexto) — **não inventar um 2º estilo de
    linha de toggle na base**; é a 2ª ocorrência desse recipe (a 1ª é
    Configurações), ainda não é a 3ª que gatilha extração obrigatória pela
    regra 4, mas já registra a repetição pro Frontend não reescrever do
    zero.
  - Rodapé do modal: campo de texto pra título da Zona 4 (ver §6), depois
    botões "Cancelar" (`variant="secondary"`) / "Salvar" (`variant="primary"`).
  - **Sem confirmação otimista por checkbox individual** — as mudanças só
    persistem ao clicar "Salvar" (estado local do modal até então), igual
    ao padrão de qualquer form de edição na base; "Cancelar"/fechar sem
    salvar descarta.

---

## 5. Persistência

Novo hook `src/hooks/use-dashboard-widget-prefs.js`, seguindo exatamente o
padrão de `use-screen-tips.js`/`use-changelog-notice.js` (mapa por usuário,
`usePersistentState`, sem coluna nova no banco — decisão já fechada,
não reaberta aqui).

Nova chave em `src/constants/storage-keys.js`:
```
dashboardWidgetPrefs: `gs_${V}_dashboard_widget_prefs`,
```

Formato armazenado:
```
{
  [userId]: {
    comercial: { widgets: { leads_count: false, task_stale: true, ... }, zone4Title: "Minhas notas" },
    marketing: { widgets: { ... }, zone4Title: "" },
    rh:        { widgets: { ... }, zone4Title: "" },
  }
}
```

- **Widget sem entrada no mapa = visível por padrão** — `widgetVisible(id) =
  prefs.widgets?.[id] !== false` (ausência ou `true` = visível; só `false`
  explícito esconde). Isso garante que nenhum usuário existente perde
  conteúdo no dia do deploy (mapa vazio → tudo visível, igual a hoje) e que
  widgets novos adicionados no futuro nascem visíveis sem exigir migração.
- `zone4Title` vazio/ausente = usa o placeholder default (ver §6), não
  força o usuário a nomear a seção antes de ver algo.
- Migração dos 4 IDs do Comercial que já existiam em
  `settings.visibleDashboardWidgets` (`useUserSettings`) fica a cargo do
  Frontend — na 1ª leitura, se o novo mapa estiver vazio pra um usuário mas
  o `useUserSettings` antigo tiver customização registrada, copiar aqueles
  4 valores pro novo formato (`widgets: { leads_count: ..., pipeline_open:
  ..., won_value: ..., avg_fit: ... }`) uma única vez — evita que quem já
  tinha escondido um StatCard veja ele reaparecer no dia da troca. Isso é
  detalhe de migração de dado, não decisão de design nova, mas fica
  registrado aqui pra não ser esquecido.

Assinatura do hook: `useDashboardWidgetPrefs(userId, dashboard)` retornando
`{ widgetVisible(id), toggles: Record<id, boolean>, zone4Title,
setZone4Title(title), save(patch) }` — exata forma final é decisão de
implementação do Frontend, não desta spec; o que importa é o contrato de
dado acima (mapa por usuário, boolean por widget, default visível).

---

## 6. Zona 4 — livre, com título editável

**O que é viável AGORA vs. o que fica pro motor completo (honesto, não
inflado):**

Não existe hoje nenhum "motor de widget genérico" capaz de pegar um tipo de
dado arbitrário e desenhar um card pra ele sem código novo por widget —
isso é, na prática, o "custo de um motor completo" que já foi descartado
com o Daniel no início desta conversa (ele concordou explicitamente em não
construir isso agora). Popular uma Zona 4 com conteúdo de verdade
exigiria exatamente esse motor (escolher fonte de dado + tipo de
visualização + onde persistir a config) — não é uma "última milha" pequena,
é o mesmo escopo grande que foi cortado.

**Decisão: nesta rodada, Zona 4 é só título editável + placeholder, sem
conteúdo real.**

- **Onde vive**: sempre a última seção da página, abaixo da Zona 3, mesmo
  em telas onde a Zona 3 tem só 1 painel (Comercial).
- **Título**: `<input type="text">` simples, mesmo estilo do `Eyebrow`
  quando não em edição (11px uppercase `var(--text-dim)`) — em modo edição
  (só dentro do modal de Personalizar, não inline na página, pra não
  precisar de um 2º mecanismo de "clique pra editar" na própria tela) vira
  um campo de texto normal (`border: 1px solid var(--border)`, `padding:
  8px 10px`, `border-radius: 8px`, `fontSize: 13px`). Placeholder do campo:
  "Nome da seção (opcional)".
- **O que mostra quando vazio de conteúdo** (sempre, nesta versão): 1
  `ui/EmptyState.jsx` (o componente de página inteira, não o `PanelEmptyState`
  compacto — aqui é apropriado porque a seção inteira está vazia de
  propósito, não é um painel com borda que só perdeu 1 item) com:
  - Título: o `zone4Title` do usuário se preenchido, senão "Sua seção
    livre".
  - Descrição: "Nesta versão, esta seção ainda não mostra widgets — só o
    título é personalizável. Mais widgets chegam numa próxima rodada."
  - Sem ação/botão (não há nada pra configurar aqui ainda além do nome, que
    já vive no modal de Personalizar).
- **Por quê título editável isolado, sem esperar o motor completo**: é a
  única parte do pedido do Daniel pra Zona 4 que não depende de resolver
  "que tipo de widget genérico existe" — é só uma string persistida. Entregar
  isso agora não é meia-solução: é a fatia inteira que não tem dependência
  de um motor futuro, entregue de forma honesta (a seção comunica
  claramente que está incompleta, não finge ser uma seção "vazia porque o
  usuário não tem dados", que seria enganoso).

---

## 7. Mobile — aplica-se igual dentro da estrutura de zonas

O adendo mobile (`design-spec-visao-geral-mobile-adendo.md`) continua
valendo estruturalmente, confirmado item a item dentro do novo agrupamento
em zonas:

- **Breakpoint 1024px**, sem mudança — a estrutura de zonas não introduz
  nem remove nenhum breakpoint.
- **Zona 1 (Resumo)** carrega o carrossel de peek borda-a-borda
  (`-mx-4 sm:-mx-6 lg:mx-0` + scroll-snap, adendo §1.4) — mecanismo
  idêntico ao que já existe hoje nas 3 telas (`DashboardView.jsx:161-165`,
  `MarketingDashboardView.jsx:548-553`, `RHOverviewView.jsx:219-223`), só
  mudando o número de tiles por tela (Marketing ganha 2 a mais vindos da
  `AgencyMetrics` consolidada, RH ganha 2 a mais vindos do Turnover
  consolidado).
- **Zona 2 (O que fazer)** empilha os buckets em 1 coluna abaixo de
  `md`/`lg` conforme já especificado (adendo §3.1/§3.3) — Marketing (2
  buckets) e RH (3 buckets) seguem a mesma regra "1 coluna, nunca
  carrossel" já aplicada ao Comercial e ao RH (Vagas/Férias, hoje 3-col),
  porque é conteúdo urgente/acionável, não item-a-item pra arrastar (mesma
  justificativa do adendo §1.3/§3.1 — esconder um alerta atrás de swipe é
  pior que não ver um KPI).
- **Ordem invertida no Comercial** (Tarefas antes de Stats no mobile,
  adendo §2) **não muda** — a Zona 3 nova (Distribuição por etapa) entra
  DEPOIS da Zona 2 tanto no desktop quanto no mobile (a inversão already
  decidida só troca Zona 1 ↔ Zona 2 de ordem visual no mobile via
  `order-1`/`order-2`; a Zona 3 continua por último em ambos os
  breakpoints, sem `order` custom).
- **Botão "Personalizar" e modal**: alvo de toque mínimo `48px`
  (`min-h-touch`, token já existente em `tailwind.config.js:83`, mesma
  recomendação do adendo §6) — no header, junto dos outros botões de ação,
  ícone-only abaixo de 1024px se necessário (mesma regra do botão futuro do
  Marketing, adendo §4). Dentro do modal: cada `ToggleRow` já tem área de
  toque generosa por natureza (`py-2.5` + label + checkbox, ~40px de altura
  de linha clicável, o `<label>` inteiro é clicável não só o quadradinho) —
  **sem ajuste adicional necessário**, é checklist vertical simples sem
  drag, exatamente o tipo de interação que já funciona bem em tela estreita
  por padrão (o próprio `Modal.jsx` já tem `max-h-[90vh] overflow-y-auto`,
  então uma lista longa de 6-7 widgets rola dentro do modal sem problema em
  tela pequena).

---

## 8. O que muda em cada arquivo real

### Arquivos existentes

- **`src/components/views/DashboardView.jsx`**
  - Remove a prop `visibleWidgets` (deixa de vir de `App.jsx`); passa a
    chamar `useDashboardWidgetPrefs(user.id, "comercial")` internamente.
  - Adiciona painel de Zona 3 ("Distribuição por etapa do funil") depois do
    bloco de Zona 2 (`:274`, logo após o fechamento do `<div
    className="order-1 lg:order-2">`), reaproveitando a lógica de
    agregação por etapa de `ExecutiveDashboard.jsx:143-173`.
  - Adiciona Zona 4 (título editável + placeholder) depois da Zona 3.
  - Adiciona botão "Personalizar" na linha de ações do header (`:138-157`).
  - Cada `StatCard` de Zona 1 e cada `TaskBucket` de Zona 2 passa a checar
    visibilidade pelo novo hook em vez do array `visibleWidgets` recebido
    por prop.
- **`src/components/views/MarketingDashboardView.jsx`**
  - KPI strip (`:548-577`) ganha 2 tiles vindos de `AgencyMetrics`
    (`SLA cumprido`, `Lead time médio`); `AgencyMetrics` (`:316-360`) perde
    o tile "Presas em revisão" (`:348-356`), que vira item de bucket de
    Zona 2.
  - Novo bloco de Zona 2 (eyebrow "Pendências" + 2 `TaskBucket`,
    reaproveitando o componente do Comercial — ver §1.2), inserido depois
    do KPI strip e antes do bloco "Atividade mensal + Canal" (`:579`).
  - Eyebrow "Efetividade da agência" (`:600-605`) é removida (conteúdo
    redistribuído pra Zona 1/2, nada sobra pra ela agrupar).
  - Cada `Panel` de Zona 3 (`:580-628`) passa a checar visibilidade
    individual; "Análise financeira" (`:608-620`) só renderiza a eyebrow se
    ao menos um dos 2 painéis internos estiver visível.
  - Adiciona botão "Personalizar" no header (`:516-538`, primeira ação
    dessa linha na tela).
  - Adiciona Zona 4 no final.
- **`src/components/views/RHOverviewView.jsx`**
  - Maior reorganização estrutural das 3: o grid de 3 colunas
    (`:272-274`) deixa de agrupar Vagas/Admissões/Férias juntas — Vagas e
    Férias viram buckets de Zona 2 (junto com um 3º bucket novo,
    "Desligamentos sem entrevista", promovido do texto estático `:264-268`);
    Admissões Recentes (`:352-404`) e Distribuição por Departamento
    (`:476-547`) viram painéis de Zona 3, junto com um novo painel
    "Desligamentos por tipo" (promovido de `:255-263`, dentro do card de
    Turnover hoje).
  - O card de Turnover (`:232-270`) deixa de ser 1 bloco monolítico:
    "Desligamentos"/"Taxa aproximada" (`:243-249`) viram 2 `StatCard` a
    mais na Zona 1; "Voluntários" + `exitPorTipo` (`:250-263`) viram o
    painel de Zona 3 citado acima; "sem entrevista" (`:264-268`) vira o
    bucket de Zona 2 citado acima — o container `card` original some,
    dividido entre as 3 zonas.
  - Adiciona botão "Personalizar" no header (`:193-216`, primeira ação
    dessa linha na tela).
  - Adiciona Zona 4 no final.
- **`src/components/shared/PanelHeading.jsx`** — sem mudança de código;
  reaproveitado como está (`Eyebrow` pros cabeçalhos de zona/painel,
  `PanelTitle` onde já é usado no RH).
- **`src/components/shared/PanelEmptyState.jsx`** — sem mudança de código;
  reaproveitado pro estado "zona sem widget visível" (§4.2), mesmo
  componente, texto novo.
- **`src/constants/storage-keys.js`** — adiciona a chave
  `dashboardWidgetPrefs` (§5).
- **`src/components/views/SettingsView.jsx`** — remove a seção "Widgets do
  Dashboard" (`:878-894`) e a função `toggleWidget`/leitura de
  `settings.visibleDashboardWidgets` (`:487-494`) — esse controle passa a
  viver só no botão "Personalizar" de cada tela. **Não mexe** na seção
  "Widgets do Painel Executivo" (`:896-917`) nem em `EXECUTIVE_WIDGETS` —
  fora de escopo (§0).
- **`src/constants/user-settings.js`** — remove `DASHBOARD_WIDGETS`
  (`:4-9`) e o campo `visibleDashboardWidgets` de `DEFAULT_USER_SETTINGS`
  (`:149`) depois que a migração de dado (§5) rodar; mantém
  `EXECUTIVE_WIDGETS`/`visibleExecutiveWidgets` intactos.
- **`src/App.jsx`** — remove a prop `visibleWidgets` passada em `:1536`
  (`DashboardView` passa a resolver sozinho via hook); **não mexe** em
  `:1647` (`ExecutiveDashboard`, fora de escopo).

### Arquivos novos

- **`src/hooks/use-dashboard-widget-prefs.js`** — hook novo (§5).
- **`src/constants/visao-geral-widgets.js`** — registro dos widgets por
  tela: `VISAO_GERAL_WIDGETS = { comercial: [...], marketing: [...], rh:
  [...] }`, cada entrada `{ id, zone, label, roleGate? }` (mesmo padrão de
  `dept` já usado em `EXECUTIVE_WIDGETS`, aqui generalizado pra
  `roleGate: "not_agencia"` no caso do Marketing) — usado tanto pelo modal
  de Personalizar de cada tela quanto por qualquer teste automatizado que
  precise validar a lista de IDs. Conteúdo exato por tela: ver §5 (listas
  completas já enumeradas por zona em §1/§4).
- **`src/components/shared/WidgetPrefsModal.jsx`** — modal novo,
  reaproveitando `ui/Modal.jsx` (§4.3). Recebe `dashboard`, `widgets`
  (do registro acima, já filtrado por `roleGate`), `prefs`/`onSave` do
  hook. Extrai o recipe visual de `ToggleRow` (hoje local em
  `SettingsView.jsx:65-87`) — 2ª ocorrência, não ainda gatilho de extração
  compartilhada pela regra 4, mas usa o MESMO visual, não um 2º estilo.
- **Bucket de tarefa compartilhado** — já sinalizado como candidato de
  extração desde a proposta original (`design-spec-visao-geral-3-zonas.md`
  §5, item 1); com Marketing e RH adicionando suas próprias instâncias
  nesta migração, o gatilho de "3ª ocorrência" da regra 4 do CLAUDE.md é
  definitivamente cruzado agora — não é mais "sinalizado", é obrigatório
  extrair antes de implementar a 2ª/3ª tela. Fica pro Frontend nomear o
  arquivo; a assinatura já está descrita na proposta original
  (`{ icon, tone, title, empty, items: [...] }`).

---

## 9. Trade-offs honestos desta versão "leve"

**Resolve:**
- As 3 telas passam a ter estrutura de zona reconhecível E controle de
  densidade individual — quem quer só o essencial consegue esconder
  widgets sem perder acesso a eles (ficam a 1 clique de Personalizar).
- Corrige de fábrica o escopo-por-navegador (não por usuário) que o
  mecanismo antigo de widgets do Comercial tinha, aproveitando a
  oportunidade da migração pra consolidar num único mecanismo correto.
- Zero mudança de schema — tudo em localStorage, mesmo padrão já
  comprovado em 3 outros lugares da base.

**Não resolve, comparado ao motor completo de widgets descartado no início
desta conversa:**
- **Nenhuma reordenação de widget dentro da zona** — a ordem dentro de cada
  zona é fixa pelo código, só visibilidade é configurável. Se um usuário
  quiser ver "Leads parados" antes de "Fechamento atrasado", não dá.
- **Nenhuma adição de widget que não existe hoje** — Personalizar só
  liga/desliga o que o Frontend já implementou; não é um construtor de
  widget genérico (ex.: não dá pra criar um card novo agregando um dado
  arbitrário).
- **Zona 4 não mostra dado real nesta rodada** — é só título, com um
  placeholder honesto explicando que mais vem depois. Quem esperava uma
  seção livre de verdade (ex.: fixar um StatCard específico ali) não tem
  isso ainda.
- **Preferência não sincroniza entre dispositivos** — mesma limitação já
  aceita em `screenTipsSeen`/`changelogSeen`; um usuário que configura no
  desktop não vê a mesma configuração no celular.
- **Sem confirmação/preview ao vivo dentro do modal** — mudanças só se
  refletem na página depois de "Salvar", não em tempo real enquanto marca
  os checkboxes (decisão consistente com o resto da base, mas é uma
  iteração mais lenta que um drag-and-drop com preview instantâneo teria
  dado).
- **Widget "escondido" nunca é realmente removido de cálculo** — mesmo
  invisível, o dado por trás dele (ex.: contagem de leads parados)
  continua sendo computado (`useMemo`s não são condicionais aos toggles);
  é uma escolha deliberada de simplicidade (evita bugs de dado
  recalculado tardiamente ao reativar um widget), mas significa que
  "esconder" é só visual, não uma otimização de performance.
