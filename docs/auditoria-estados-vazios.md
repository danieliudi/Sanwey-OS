# Auditoria de estados vazios — texto que afirma algo falso sobre a tela

Leitura de código, 14/09/2026. Sem navegador, sem banco, sem build, sem edição
no repositório. Fecha o item declarado como não verificado em
`docs/varredura-visual-dicas-de-tela.md`.

Todo `arquivo:linha` abaixo foi aberto e lido. Onde não foi, está dito.

---

## (a) Inventário

### Componentes compartilhados de estado vazio

| Componente | Arquivo | Usos |
|---|---|---|
| `EmptyState` (página/view inteira) | `src/components/ui/EmptyState.jsx` | 76 tags `<EmptyState`, em 38 arquivos |
| `PanelEmptyState` (dentro de painel com borda própria) | `src/components/shared/PanelEmptyState.jsx` | 25 |
| `NotFoundView` | `src/components/shared/NotFoundView.jsx` | 1 |

**102 estados vazios via componente compartilhado.**

Quatro arquivos definem um `EmptyState` LOCAL, sombreando o nome do
compartilhado — `src/components/views/CRMViagensGestorView.jsx:74`,
`src/components/views/CRMViagensRelatoriosView.jsx:157`,
`src/components/views/AnalyticsTab.jsx:637`,
`src/components/views/ExecutiveCharts.jsx:318`. Os dois primeiros têm API
INCOMPATÍVEL com o compartilhado (`text` em vez de `title`/`description`): quem
copiar uma dessas chamadas pro resto da plataforma renderiza um bloco mudo.
Não é estado vazio mentiroso, é dívida de reaproveitamento (regra 1/4 do
`CLAUDE.md`) — registrada aqui porque apareceu na varredura.

### Estados vazios escritos inline

Varredura mecânica dos 202 `.jsx` de `src/`: condição de vazio
(`X.length === 0`, `!X.length`, `X.size === 0`) com frase de vazio em português
nas 14 linhas seguintes.

- **209 sítios de estado vazio no total**, em **86 arquivos**, dos quais
  **52 em `src/components/views/`**.
- Desses 209, **188 são inline** (texto solto em `<div>`/`<td>`/`<span>`), 21 são
  chamadas de `EmptyState`/`PanelEmptyState` que a varredura também pegou.

### Quantos testam o array filtrado

Não dá para responder isso mecanicamente sem afirmar mais do que li — o nome da
variável não diz se ela é crua. Então: **verifiquei manualmente 41 dos 209**,
escolhidos pelo peso do dado escondido (Funil de Vendas, RH, Viagens & Despesas,
ESG, Clientes, Catálogo, Pedidos, Usuários, Compras, Marketing, Chat).
Desses 41:

| Classificação | Qtd |
|---|---|
| Testa array cru, texto absoluto — correto | 9 |
| Testa cru **e** filtrado, com dois textos distintos — correto, é o padrão a copiar | 16 |
| Testa filtrado, texto já nomeia o filtro/escopo — correto | 12 |
| **Testa filtrado, texto afirma ausência absoluta — ACHADO** | **4** |

Os 168 não abertos são, em maioria, vazios internos de drawer (anexos,
checklists, comentários, campos da etapa) — mesma família, consequência menor,
e é exatamente onde a cobertura fica incompleta (ver seção (d)).

### Padrão de referência, já existente no código

`src/components/client/ClientsManager.jsx:305-318` faz exatamente o que a
regra pede: testa `filtered`, e dentro do bloco ramifica em `clients.length === 0`
→ `"Nenhum cliente cadastrado ainda."` versus
`"Nenhum cliente corresponde aos filtros aplicados."` + botão "Limpar filtros"
que zera `query` e `onlyOpportunities`. Mesmo padrão em
`FornecedoresView.jsx:231/243`, `RHFornecedoresView.jsx:669/686`,
`UserManagementView.jsx:521/534`, `DocumentLibraryView.jsx:265/277`,
`RHCargosView.jsx:756/758`, `CatalogoView.jsx:411-421`,
`AbmAccountsView.jsx:167/213`, `RHComunicacaoView.jsx:997-1001`,
`RHFuncionariosView.jsx:1871-1875`, `BugsView.jsx:190-195`,
`ChatView.jsx:1661/1699`, `RHTreinamentosView.jsx:1674/1687`,
`ClientSelector.jsx:142`, `NotificationCenter.jsx:372/377`,
`LeadDetailDrawer.jsx:2264-2266`.

Ou seja: a plataforma **já sabe** fazer isso em 16 lugares. Os achados abaixo
não são falta de padrão, são lugares que ficaram de fora dele.

---

## (b) Achados — filtro escondendo registro com texto de ausência absoluta

Ordenados por consequência do dado escondido.

### 1. Cargo some do formulário de colaborador quando o departamento não tem cargo — duplicado em 2 arquivos

`src/components/views/NovoColaboradorModal.jsx:451-455`

```
{cargoOptions.length === 0 && (
  <div ...>
    Nenhum cargo cadastrado ainda — crie um em Cargos &amp; Salários primeiro.
  </div>
)}
```

Variável testada: `cargoOptions`, definida em
`NovoColaboradorModal.jsx:86-91`:

```
const base = form.department
  ? cargoTemplates.filter((c) => !c.department || c.department === form.department)
  : cargoTemplates;
```

É filtrada pelo **departamento já escolhido no próprio formulário**. Com o
catálogo cheio e nenhum cargo atribuído àquele departamento, a tela manda a
pessoa ir criar o primeiro cargo numa tela onde ela vai encontrar o catálogo
inteiro. O comentário imediatamente acima (`linhas 84-85`) documenta o filtro —
o texto é que não acompanhou.

Cópia idêntica, mesmo defeito: `src/components/views/RHFuncionariosView.jsx:1302-1305`,
com `cargoOptions` definido em `RHFuncionariosView.jsx:909-914` (mesmas 5 linhas).

Consequência: é o campo `jobTitle` de um cadastro de PESSOA. O caminho de saída
que a mensagem oferece (criar cargo) produz um cargo novo redundante no
catálogo, que é exatamente o que a padronização de Cargos & Salários existe pra
evitar.

### 2. Benefícios: catálogo inteiro desativado lê como catálogo vazio, e o modal ao lado desmente

`src/components/rh-pipeline/RHBenefitsPicker.jsx:26`

```
{ativos.length === 0 ? "Nenhum benefício cadastrado ainda." : "Selecione os benefícios deste cargo."}
```

Variável testada: `ativos`, definida em `RHBenefitsPicker.jsx:16`:

```
const ativos = catalogo.filter((c) => c.isActive);
```

Filtra por `isActive`. Com todo o catálogo desativado, o texto afirma que nada
foi cadastrado. O agravante está a 100 linhas de distância, no mesmo arquivo:
`RHBenefitsPicker.jsx:118-119` usa **o mesmo texto** testando `catalogo` (cru).
Abrir "Configurar benefícios" mostra a lista populada logo abaixo de uma
mensagem dizendo que ela não existe — as duas frases iguais, uma verdadeira e
uma falsa, no mesmo fluxo.

### 3. ESG & Carbono: o seletor de empresa esconde o inventário inteiro

`src/components/views/ESGCarbonoView.jsx:379-384`

```
{records.length === 0 ? (
  <tr><td colSpan={5} ...>
    Nenhum registro de emissão ainda — lance o consumo de combustível/energia em Lançamentos, ou calcule o Escopo 3 a partir de Compras.
  </td></tr>
) : records.slice(0, 30).map(...)}
```

Variável testada: `records`, vinda de
`useEsgEmissionRecords({ companyId: activeCompany })` (`ESGCarbonoView.jsx:161`).
O filtro é **server-side**, em `src/hooks/use-esg-carbon.js:165`:

```
if (companyId && companyId !== "all") query = query.eq("company_id", companyId);
```

`activeCompany` é o `<select>` "Todas as empresas" do topo da própria tela
(`ESGCarbonoView.jsx:280-288`). Trocar de frente e ver "Nenhum registro de
emissão ainda" não distingue "esta empresa não lançou nada" de "o inventário
está vazio". O default é `"all"` (`linha 158`), então a mentira só aparece depois
que a pessoa mexe no seletor — que é justamente quando ela está comparando
frentes. Num inventário de GEE "pronto pra auditoria" (subtítulo da tela), a
diferença importa.

### 4. Solicitações ao Marketing: a descrição do vazio é absoluta, o array é filtrado por status

`src/components/views/MarketingRequestsView.jsx:589-598`

```
) : filtered.length === 0 ? (
  <EmptyState
    icon={Inbox}
    title={statusFilter === "pendente" ? "Nenhuma solicitação pendente" : "Nenhuma solicitação encontrada"}
    description="As solicitações enviadas pelo formulário aparecerão aqui"
  />
```

Variável testada: `filtered` (`MarketingRequestsView.jsx:463-466`), filtrada por
`statusFilter`, que **começa em `"pendente"`** (`linha 421`). O título salva o
caso `pendente`; a descrição, não — ela afirma que nada chegou pelo formulário,
com 40 solicitações aprovadas na base.

Atenuante real, verificado: as abas logo acima (`linhas 545-573`) mostram a
contagem por status e o total (`requests.length`), então o denominador honesto
está na tela. Por isso este achado fica em 4º e não em 1º.

### Adjacente, mesma família: filtro sem estado vazio nenhum

`src/components/views/AutomationsView.jsx:383-398` — a lista de automações
aplica `moduleTab` (`linha 386`:
`commonAutomations.filter(rule => moduleTab === "all" || (rule.module ?? "crm") === moduleTab)`)
e **não tem estado vazio para o resultado filtrado**. Escolher um módulo sem
automação nenhuma renderiza uma caixa com borda e nada dentro. Não é texto
falso — é ausência de texto, que a pessoa lê como tela quebrada. Registrado
porque nasce do mesmo descuido.

---

## (c) As duas famílias extras

### C.1 — Erro tratado como vazio

Esta é, de longe, a maior superfície encontrada, e é pior que a seção (b): ali a
frase é imprecisa; aqui ela é falsa e ainda manda a pessoa mexer num filtro que
não tem nada a ver com o problema. Como o `CLAUDE.md` registra, negação de RLS
no Postgres volta `data: []` sem `error` — mas **nem isso está sendo aproveitado**:
em 28 leituras o `error` do Supabase nem é desestruturado.

**C.1.1 — Funil de Vendas e tudo que come `leads`.** `src/hooks/use-leads.js:542-560`
expõe `loading` e `error` (`linhas 544-545`). `src/App.jsx:304-318` desestrutura
o hook **sem `loading` e sem `error`**. `CRMView` (`src/components/views/CRMView.jsx:355`)
não recebe nenhum dos dois em suas props. Leitura negada ou quebrada →
`leads = []` → `src/components/views/CRMView.jsx:1444-1449` mostra
`"Nenhum lead encontrado"` no corpo da tabela, `linha 1332` o mesmo no mobile, e
`linha 1094` `"Nenhum negócio nesta etapa"` em toda coluna do Kanban. Um funil
vazio e um funil inacessível são pixel por pixel a mesma tela.

**C.1.2 — RH · Funcionários e Visão Geral RH.** `src/hooks/use-rh-colaboradores.js:123`:

```
const { data } = await supabase.from("rh_colaboradores").select("*").order("full_name", { ascending: true });
```

O `error` do PostgREST **não é lido** — não há `catch`, só `try/finally`
(`linhas 122-127`). Erro volta `data: null`, e `data || []` vira lista vazia.
`src/components/views/RHFuncionariosView.jsx:1871-1875` então renderiza:

```
: { title: "Nenhum funcionário encontrado", description: "Tente ajustar os filtros", showClear: false }
```

— o ramo de `unifiedRows.length === 0`, isto é, exatamente o ramo em que os
filtros são irrelevantes. A tela pede pra ajustar filtro justo quando ajustar
filtro não resolve nada. `src/components/views/RHOverviewView.jsx:104` consome o
mesmo hook e mostra zeros nos cartões de resumo do RH.

**C.1.3 — Sinais de Mercado: o erro é engolido de propósito.**
`src/hooks/use-market-signals.js:36-37`:

```
} catch {
  setSignals([]);
}
```

O hook nem tem estado de `error` (`linhas 22-24`: só `signals` e `loading`). A
tela — `src/components/views/SignalsView.jsx:187-192` — diz:

```
title="Nenhum sinal no filtro atual"
description="Ajuste os filtros para ver mais sinais."
```

Falha de leitura vira instrução de mexer no filtro. É o caso mais enganoso do
repositório: a frase não só é falsa, ela dirige a pessoa pro lugar errado.
`market_signals` é também a tabela que o `trackforge-os` lê do outro lado
(regra 18 do `CLAUDE.md`) — os dois lados ficam mudos do mesmo jeito.

**C.1.4 — Gestão de Viagens & Despesas: 4 hooks, 0 caminhos de erro.**
`use-crm-viagens.js:15`, `use-crm-despesas.js:17`, `use-crm-viagem-prestacoes.js:23`,
`use-crm-viagem-categorias.js:25` — todos `const { data } = await supabase...`
dentro de `try { } finally { }`, sem `catch` e sem estado de erro. As telas
mostram, respectivamente,
`CRMViagensGestorView.jsx:1189` `"Nenhuma visita planejada neste mês."`,
`:1330` `"Nenhuma despesa pendente de decisão neste mês."`,
`CRMViagensRelatoriosView.jsx:498` `"Nenhuma despesa lançada no período."`.
Consequência específica desta tela: o vazio não descreve um sistema, descreve
uma PESSOA. "Nenhuma visita planejada neste mês" numa tela de gestor é uma
avaliação de desempenho de um vendedor nomeado, e pode estar sendo produzida
por uma consulta que falhou. Foi a tela que já morreu ~3 semanas em silêncio
(placar da regra 3.2 do `CLAUDE.md`).

**C.1.5 — Clientes.** `src/hooks/use-clients.js:234` retorna `error`;
`src/App.jsx:338-346` desestrutura `clients`, `loading` e as mutações,
**sem `error`**. `ClientsManager` recebe só `loading`. Falha → o ramo bom da
`linha 307` (`clients.length === 0`) escolhe `"Nenhum cliente cadastrado ainda."`.
O estado vazio está certo; a premissa é que a lista vazia significa lista vazia.

**C.1.6 — Sem tratamento de erro nenhum no arquivo inteiro** (nenhuma
ocorrência da palavra `error`), embora o hook por trás exponha um:

| Tela | Hook que expõe `error` | Texto que aparece na falha |
|---|---|---|
| `src/components/views/PedidosView.jsx:205-208` | `use-orders.js:108` | "Nenhum pedido ainda" |
| `src/components/views/CatalogoView.jsx:416-422` | `use-products.js:82` | "Nenhum produto cadastrado ainda" + "O catálogo é a base de tudo: sem produto cadastrado…" + botão Cadastrar |
| `src/components/views/UserManagementView.jsx:521-533` | `use-profiles.js:208` (App.jsx:288-294 descarta) | "Nenhum usuário cadastrado ainda" |
| `src/components/views/PersonalTasksView.jsx:297` e `:507` | `use-personal-tasks.js:266` (view: `linha 528`) | "Nenhuma tarefa aqui" / "Nenhuma tarefa" |

**C.1.7 — A contagem.** 28 leituras `const { data } = await supabase` /
`const { data: X } = await supabase` descartam o `error` da resposta, mais o
bloco `Promise.all` de `src/hooks/use-rh-bemestar.js:26-30` (3 tabelas de uma
vez, também sem `catch`). Outras 5 engolem em `catch { set…([]) }`:
`use-market-signals.js:36`, `use-insights-metrics.js:47`,
`use-rh-stage-history.js:36`, `use-single-lead-history.js:33`,
`use-places-autocomplete.js:29`.

**Contraexemplos, já corretos, para copiar:**
`src/components/views/MarketIntelligenceView.jsx:84-92` (ramo `if (error)` com
texto próprio, antes do ramo de vazio), `AgentActionsView.jsx:727-739`
(`!loading && !error &&` guardando o estado vazio), `MarketingRequestsView.jsx:577-582`
(faixa de erro em `--danger-bg`).

### C.2 — Estado vazio durante o `loading`

**C.2.1 — Sinais de Mercado.** `src/components/views/SignalsView.jsx:38` — a
assinatura de props é `{ activeCompany, signals, clients, onAddLead, accessibleCompanies }`:
**não existe prop `loading`**, embora `use-market-signals.js:54` exponha uma. Do
primeiro paint até a resposta chegar, a tela afirma "Nenhum sinal no filtro atual".

**C.2.2 — Contas · ABM.** `src/components/views/AbmAccountsView.jsx:59-68` —
props `{ user, leads, campaigns, clients, users, activeCompany, onLeadClick, onOpenClient }`,
sem `loading`. Antes de `campaigns` chegar, `contentCampaigns` (`linha 151`) é
`[]` e `linhas 161-166` mostram "Nenhuma campanha de conteúdo" com a instrução
de cadastrar campanha no formato `frente-aaaamm-tema`. A tela manda cadastrar o
que já existe e ainda não carregou. `src/App.jsx:411` é a causa:
`const { campaigns } = useMarketingCampaigns({...})` — descarta `loading` e
`error`, que `use-marketing-campaigns.js:240,242` expõem.

**C.2.3 — Relatório de Feiras e Relatório de Conteúdo.**
`src/components/views/FairReportView.jsx:194-201` — props
`{ campaigns, leads, user, activeCompany, variant, ...overrides }`, sem `loading`.
`linha 345` testa `scoped.length === 0` e mostra `emptyTitle`/`emptyDescription`.
Mesma causa que C.2.2.

**C.2.4 — Funil de Vendas.** Já descrito em C.1.1: sem `loading` em
`App.jsx:304-318` nem nas props de `CRMView`, o primeiro paint mostra
"Nenhum lead encontrado" / colunas com "Nenhum negócio nesta etapa".

**Contraexemplos, já corretos:** `ClientsManager.jsx:303-305`
(`loading ? "Carregando…" :` antes do vazio), `DespesasView.jsx:1296-1302`
(`!loading && usages.length === 0`), `FunnelHistoryView.jsx:350`
(`rows.length === 0 && !loading`), `CRMViagensGestorView.jsx:1142,1169`
(`loading = loadingRegistros || loadingDespesas`, gate do bloco inteiro),
`RHOverviewView.jsx:462-465`, `CatalogoView.jsx:409-411`,
`FornecedoresView.jsx:227-231` (skeleton de card antes do vazio).

---

## (d) O que não consegui verificar

1. **168 dos 209 sítios não foram abertos um a um.** Priorizei por consequência
   do dado escondido. O resto é majoritariamente vazio interno de drawer —
   anexos, checklists, comentários, campos de etapa (`LeadDetailDrawer.jsx`,
   `CampaignDetailDrawer.jsx`, `DeliverableDetailDrawer.jsx`,
   `RHDetailDrawerShell.jsx`, `PersonalTaskDetailDrawer.jsx`). Podem esconder
   achados da mesma classe; a consequência de cada um é menor porque o contexto
   (um card aberto) já limita o universo.

2. **Não rodei nada.** Sem build, sem banco, sem navegador, conforme o pedido.
   Nenhum achado aqui foi confirmado em tela — todos são leitura de código.
   Em particular, **não provei que a falha de RLS realmente ocorre** em nenhuma
   dessas tabelas; provei que, se ocorrer, a tela diz outra coisa. Confirmar em
   tela pede a branch de banco da regra 13 do `CLAUDE.md` e uma policy negando
   de propósito.

3. **Os 76 `<EmptyState>` não contam 1 para 1 com estados vazios visíveis.**
   Alguns são ramos mutuamente exclusivos do mesmo lugar da tela (o par
   cru/filtrado conta 2 tags e mostra no máximo 1). E metade dos 25
   `<PanelEmptyState>` (13) está em `MarketingDashboardView.jsx`, onde são
   painéis de dashboard, não listas de registro.

4. **Não auditei as 8 rotas públicas** (`src/components/public/`) além de tropeçar
   em duas linhas na varredura (`ManagerVagaReviewPage.jsx:117`,
   `BemEstarPublicaForm.jsx:348`). Formulário público sem login tem um modelo de
   permissão diferente e merece passada própria.

5. **Não conferi contra `docs/as-is-spec.md` tela a tela.** A seção 3 lista 55
   telas (`## 3.1` a `## 3.55`); minha varredura tocou 52 arquivos de
   `src/components/views/`, que não mapeiam 1 para 1 (uma view serve várias
   rotas, e nem toda tela é um arquivo em `views/`). A cobertura honesta é:
   **varredura mecânica em 100% dos 202 `.jsx`, verificação manual concentrada
   em ~25 telas**, as de maior consequência.

6. **Não verifiquei o comportamento offline.** `use-leads.js` tem cache offline
   (`cacheAge`, `isOnline`, `saveLeadsSnapshot`), então parte dos cenários de
   C.1.1 pode cair no cache em vez de em lista vazia. Não tracei esse caminho —
   em dispositivo novo, ou com cache frio, o cenário descrito vale.

---

## Nota de processo

Nada aqui foi corrigido. Todo item de (b) é mudança de texto de tela, o que é
mudança visual e exige mockup antes (regra 3 do `CLAUDE.md`). Os itens de (c.1)
e (c.2) são de natureza diferente — acrescentar ramo de `error`/`loading` muda o
que aparece na tela, então também passam por mockup, mas o ramo de erro não tem
hoje desenho nenhum a que se comparar: vale decidir um padrão único
(`MarketIntelligenceView.jsx:84-92` é o candidato mais próximo de pronto) antes
de espalhar por 20 telas.
