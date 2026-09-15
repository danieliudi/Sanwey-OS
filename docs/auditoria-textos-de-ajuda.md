# Auditoria — textos de ajuda curtos (`HelpTooltip` e `title=` nativo)

Repositório: `/home/user/sanwey-crm` · data: 14/09/2026 · **auditoria, nenhum arquivo do repo foi alterado.**

Continuação do item deixado como "não verificado" em `docs/varredura-visual-dicas-de-tela.md`:
texto de ajuda que descreve comportamento diferente do que a tela faz.

---

## (a) Inventário — o "~90" do `CLAUDE.md` é uma subestimativa grande

Levantado por varredura de AST-lite sobre todo `src/` (script em
`scratchpad/scan2.mjs`; resolve o elemento dono de cada `title=` andando pra trás
com contagem de `{}`/`()`, pra não confundir atributo de DOM com prop de
componente).

| | quantidade |
|---|---|
| `title=` **em elemento DOM** (tooltip nativo de verdade) | **345**, em **100 arquivos** |
| `title=` que na verdade é **prop de componente React** (`<Modal title>`, `<EmptyState title>`, `<PageTitle>`, `<Section>`, `<ChartCard>`, `<AppToast>`…) | 259, em 75 arquivos |
| **total de ocorrências do token `title=`** | 604 |
| pontos de renderização de `<HelpTooltip>` | **7**, em 6 arquivos |
| textos distintos que chegam a um `HelpTooltip` | **22** |

Quebra dos 345 nativos por elemento:

| elemento | qtd | |
|---|---|---|
| `<button>` | 238 | interativo |
| `<span>` | 70 | não interativo (salvo 3 com `role="button"`) |
| `<div>` | 19 | idem |
| `<input>` | 7 | interativo |
| `<select>` | 5 | interativo |
| `<a>` | 3 | interativo |
| `<th>` / `<td>` | 1 / 1 | não interativo |
| `<iframe>` | 1 | é nome acessível, uso correto (`TutoriaisView.jsx:127`) |

Dos 345: **205 são string literal** e 140 são expressão (`{...}`), a maioria
dessas last só ecoando dado do usuário (nome de campanha, nome de arquivo,
descrição de etapa) — sem afirmação a conferir.

**Escopo efetivamente lido linha a linha contra o código:** os 22 textos de
`HelpTooltip` + os 48 literais nativos com 28 caracteres ou mais + 8 expressões
com afirmação embutida (limiar, fórmula, nome de aba) = **78 textos auditados**.
Os demais 267 são rótulo puro de ação ("Salvar", "Remover campo", "Excluir
comentário") — verdadeiro por construção, nada a checar.

**Achados: 10 divergências confirmadas + 2 padrões estruturais.**
A maioria está correta, e vários textos são notavelmente disciplinados
(`utils/cac.js:48` troca a frase conforme a janela realmente aplicada;
`RHOnboardingView.jsx:1265` declara a ressalva da importação). O problema se
concentra em **texto fixo dentro de componente compartilhado, lido por um
consumidor que alimenta outro dado** — 4 dos 10 achados são isso.

---

## (b) Achados

### Gravidade 1 — leva a pessoa a agir errado

#### 1. "compra aprovada" onde o gatilho exige "compra paga" · `DespesasView.jsx:1750`

Texto — selo em toda despesa auto-criada, na tabela de Despesas:

```jsx
title="Criada automaticamente a partir de uma compra aprovada"
```

Código — `supabase/migrations/00000000000000_baseline.sql:4801`
(`marketing_purchase_requests_sync_expense`):

```sql
IF NEW.stage = 'pago' AND OLD.stage IS DISTINCT FROM 'pago' AND NEW.expense_id IS NULL THEN
```

`aprovado` e `pago` são etapas distintas e separadas por quatro posições
(`src/hooks/use-marketing-purchase-requests.js:10-18`: solicitado → cotacao →
**aprovado** → pedido_fornecedor → entrega_parcial → entregue → **pago**).

O próprio arquivo se contradiz duas vezes, do lado certo:
- `DespesasView.jsx:1825` — "Esta despesa foi criada automaticamente pela **compra paga** correspondente."
- `DespesasView.jsx:875` — "Quando a compra **é paga**, o sistema cria a despesa sozinho e o valor migra para a faixa 'Pago'."

Consequência: quem aprova uma compra e lê o selo conclui que a despesa já foi
lançada e que o valor está contado duas vezes. Está no "comprometido", que é
exatamente o que `DespesasView.jsx:1275` explica — e o selo desmente.

#### 2. Manda procurar um painel chamado "Decisão" que nesse estado se chama outra coisa · `PurchaseRequestDetailDrawer.jsx:753` (e `:744`)

Texto, no botão Aprovar desabilitado:

```jsx
title={!canApproveNow ? "Escolha o fornecedor vencedor em Decisão antes de aprovar" : undefined}
```

Mesma frase no parágrafo de apoio, `:744`: "escolha o fornecedor vencedor em
Decisão (à direita) e aprove".

Código — o botão só desabilita nessa condição (`:491`):

```jsx
const canApproveNow = isCotacao ? (quoteOptions.length === 0 || winnerIndex !== "") : true;
```

…ou seja, `!canApproveNow` **exige** `isCotacao === true`. E o rótulo do painel
(`:932`) é:

```jsx
<SectionLabel>{isCotacao ? "Aprovar solicitação" : "Decisão"}</SectionLabel>
```

Quando a dica aparece, a seção na tela lê **"Aprovar solicitação"**. "Decisão"
só aparece em `solicitado`, estado em que `canApproveNow` é sempre `true` e o
seletor de vencedor nem existe. A dica nomeia, portanto, uma seção que nunca
está visível no momento em que a dica é exibida.

#### 3. Anel de progresso de Onboarding se apresenta como "Fit score do lead" · `FitScoreCircle.jsx:20` ← `RHOnboardingView.jsx:288`

Texto, fixo dentro do componente compartilhado:

```jsx
title={`Fit score: ${score}/100 — pontuação de potencial do lead com base no perfil e comportamento`}
```

Consumidor — `RHOnboardingView.jsx:271-273, 288`:

```jsx
const done = tarefas.filter((t) => t.status === "concluida").length;
const progresso = total > 0 ? Math.round((done / total) * 100) : 0;
...
{total > 0 && <FitScoreCircle score={progresso} size={28} />}
```

No card de Onboarding o número é **percentual de tarefas de checklist
concluídas de um colaborador**. Ao passar o mouse, a plataforma afirma que é a
pontuação de potencial comercial de um lead. Dois domínios sem relação nenhuma.

Efeito colateral menor do mesmo texto fixo: `ProspectSuggestions.jsx:102` usa
`score={seed.fit_score || 65}` — sem fit score, o anel mostra 65 e a dica
declara "Fit score: 65/100" como se fosse medido. (Regra 14 do `CLAUDE.md`:
número em tela declara de onde veio.)

#### 4. Limiar de "lead quente" que não existe em lugar nenhum da UI · `DashboardView.jsx:292`

Texto, no `tooltip` do `StatCard` "Fit score médio":

```jsx
tooltip="Pontuação de 0 a 100 que indica o potencial do lead. Acima de 70 é considerado quente."
```

Código — o único 70 relacionado a fit em todo o `src/` é
`DashboardView.jsx:70`:

```jsx
if (fs >= 70) fitCount70++;
```

e `fitCount70` é calculado, devolvido em `:76` e **nunca renderizado**
(`grep -rn "fitCount70" src/` devolve exatamente essas três linhas, todas neste
arquivo). Os limiares que a pessoa de fato enxerga são outros:

- `CRMView.jsx:1393-1394` (badge de fit na tabela/card do Funil): `>= 80` verde, `>= 50` âmbar, abaixo vermelho.
- `FitScoreCircle.jsx:5-6` (o anel): `>= 80`, `>= 65`, `>= 50`.

Nenhum deles vira em 70. A dica ensina um critério que a tela não usa.

#### 5. "dias nesta etapa" quando o número é "dias desde a última edição" · `BugsView.jsx:79` e `:239` ← `KanbanCardStatusChips.jsx:163`

Texto, fixo no componente compartilhado:

```jsx
title={agingTitle ?? `${agingDays} dias nesta etapa`}
```

Consumidor — `BugsView.jsx:79` (e idêntico em `:239`):

```jsx
agingDays={daysSince(r.updated_at || r.created_at)}
```

`updated_at` muda a cada edição do registro — comentário, troca de prioridade,
anexo. Um bug parado na mesma coluna há três semanas e comentado hoje exibe
"0d" e a dica "0 dias nesta etapa". Todos os outros 9 consumidores do chip
passam um `*_stage_changed_at` / `status_changed_at` de verdade
(`ComexView.jsx:559`, `RHFeriasView.jsx:556`, `RHRecrutamentoView.jsx:1073`…) —
Bugs é o único fora do padrão, e o texto fixo não tem como saber.

### Gravidade 2 — promete o que a tela não entrega, sem causar erro de decisão

#### 6. Dica promete dois campos que o modal esconde · `StageListManager.jsx:308`

```jsx
title="Opções avançadas (descrição, probabilidade, SLA, fase final)"
```

`PersonalStageListManager.jsx:96` e `:101` passam ao mesmo componente:

```jsx
showProbability={false}
showDescription={false}
```

e `StageAdvancedModal.jsx` respeita os dois — `:170` `{showDescription && (` e
`:233` `{showProbability && !terminal && (`. No editor de etapas da Lista
Pessoal o modal abre com **SLA e fase final apenas**. (O comentário em
`PersonalStageListManager.jsx:97-100` explica por quê: `personal_task_stages`
não tem coluna `description`.) O texto da dica é o único que não recebeu o
recado.

#### 7. "Ciclos" conta menos regressões do que declara · `FunnelHistoryView.jsx:328`

```jsx
<th ... title="Quantas vezes o cliente regrediu para uma etapa anterior do funil">
  Ciclos
```

`countRecycles` (`:58-71`) ordena as etapas contra a lista fixa
`DEFAULT_PIPELINE_STAGES` e pula silenciosamente qualquer etapa fora dela:

```jsx
const order = new Map(DEFAULT_PIPELINE_STAGES.map((s, i) => [s.id, i]));
...
const a = order.get(prev), b = order.get(curr);
if (a == null || b == null) continue;
```

As etapas do Funil são configuráveis — `CRMView.jsx:429`
`const stages = pipelines[companyForPipeline] || DEFAULT_PIPELINE_STAGES`. Numa
frente com etapa customizada, toda regressão que entre ou saia dessa etapa
desaparece da conta, e a coluna mostra um número menor que o real sem dizer o
que ficou de fora (regra 14, item 3).

#### 8. Mesmo campo, duas versões da dica — a do Kanban perde a ressalva · `RHOnboardingView.jsx:410` e `:1750`

Na lista (`:1265`) o texto é honesto e o comentário logo acima (`:1258-1264`)
explica por que a ressalva é obrigatória:

```jsx
title="Dias corridos desde a última mudança de etapa. Para fichas criadas por importação, conta a partir da importação."
```

No card do Kanban, o mesmo dado vai pro chip compartilhado:

```jsx
agingDays={daysSince(c.onboardingStageChangedAt)}   // :410 e :1750
```

e o chip renderiza o texto fixo `${agingDays} dias nesta etapa`
(`KanbanCardStatusChips.jsx:163`) — sem a ressalva que o próprio arquivo
documenta como necessária. Ficha importada mostra "há 40 dias nesta etapa" como
se fosse estagnação, que é exatamente o que o comentário de `:1261-1264` diz
que não pode acontecer.

#### 9. Nome de tela inexistente e navegação que não acontece · `PosVendaView.jsx:83`

```jsx
title="Ver negócio de origem em Venda"
```

Não existe tela chamada "Venda": o item de menu é **"Funil de Vendas"**
(`App.jsx:1879`, `{ id: "crm", label: "Funil de Vendas" }`). E o botão não
navega para tela nenhuma — `App.jsx:2519` passa `onOpenLead={setSelectedLead}`,
que abre o drawer do lead por cima do Pós-venda.

#### 10. "continua na busca" — o contador continua, o card não · `PersonalTasksView.jsx:344`

```jsx
title="Arquivar não apaga: a tarefa continua na coluna Arquivar, no CSV e na busca."
```

Dois terços verdadeiros, um terço não:

- **CSV**: verdadeiro — `:941` exporta `filteredTasks` (pré-recorte de arquivadas), e o comentário `:938-940` confirma que é deliberado.
- **busca**: a busca roda em `filteredTasks` (`:614-628`), mas `visibleTasks` (`:634-637`) remove as arquivadas a menos que `mostrarArquivadas` esteja ligado. Uma tarefa arquivada que casa com o termo **não aparece como card** — sobra só no contador "N tarefas arquivadas fora do quadro" (`:1016`).
- **"coluna Arquivar"**: é só o nome de fábrica (`constants/personal-tasks.js:30`, `{ id: "feito", name: "Arquivar" }`) — as colunas são renomeáveis pelo usuário (`:540`, `stagesHook.stages`), e o próprio comentário de `:550` cita alguém que renomeou.

### Padrões estruturais (classe 5) — não é texto errado, é texto que não chega

**91 dos 345 `title=` nativos estão em elemento não interativo** (`<span>` 70,
`<div>` 19, `<th>` 1, `<td>` 1). Tooltip nativo não abre em toque: nenhum
desses textos existe no celular. O caso que mais custa:

- `DespesasView.jsx:1825` — a **única** frase que explica a consequência de um
  botão destrutivo ("Excluí-la não cancela a compra — o valor volta a aparecer
  como 'comprometido' no painel de Orçamento") é `title=` de um `<span>` ao
  lado do botão "Excluir". No celular a pessoa vê apenas
  "Excluir? (veio de uma compra)" e o botão vermelho.
- Mesma classe, menor impacto: `PersonalTasksView.jsx:344`,
  `RHOnboardingView.jsx:1265`, `RHBemEstarView.jsx:516`,
  `DespesasView.jsx:713`, `BugsView.jsx:33`, `FunnelHistoryView.jsx:328`.

**10 `title=` repetem texto que já está sempre visível** (ruído, não erro):
`EntregasView.jsx:1044` ("Exportar CSV", com `Exportar CSV` em texto no botão) e
nove botões "Nova etapa" — `ComexView.jsx:1404`, `EntregasView.jsx:1335`,
`MarketingTarefasView.jsx:1408`, `MarketingView.jsx:1370`,
`PosVendaView.jsx:1367`, `RHFeedbackView.jsx:1817`, `RHFeriasView.jsx:1451`,
`RHOnboardingView.jsx:1814`, `RHTreinamentosView.jsx:1471`.
(`TableDensityToggle.jsx:21` e `:35` também duplicam, mas só a partir de `sm` —
o rótulo é `hidden sm:inline`, então no celular o `title` é o único texto.
Não conta.)

**Uma inversão da regra 1 do `CLAUDE.md`, isolada.** `FunnelHistoryView.jsx:328`
põe o hint de conceito no `title=` de um `<th>` ("Ciclos"), enquanto
`AbmAccountsView.jsx:205` resolve exatamente o mesmo caso — rótulo de coluna que
precisa explicar um conceito — com `<HelpTooltip>` no `<th>` "Fit". Fora essa,
nenhuma inversão clara: os 7 pontos de `HelpTooltip` estão todos em rótulo de
`StatCard`, rótulo de campo de formulário, rótulo de checkbox ou cabeçalho de
coluna, que é o que a regra reserva pra ele.

**`title` vazio: zero.** `grep -rn 'title=""' src/` não devolve nada. O único
`title` que não é tooltip (`<iframe>`, `TutoriaisView.jsx:127`) está correto:
ali `title` é nome acessível obrigatório, não dica.

---

## Nota sobre a pista da PTAX (fora do universo, confirmada)

A divergência citada no pedido é real e tem os dois lados, mas não é
`HelpTooltip` nem `title=` — é texto de tela contra `src/data/tutorials.js`:

- `ComexView.jsx:369`: "PTAX do dia — digite manualmente (sem integração automática nesta fase)."
- `tutorials.js:532`: "O sistema calcula o Landed Cost automaticamente usando a PTAX do dia"

O código confirma o primeiro: `ptaxRate` é `<input type="number">`
(`ComexView.jsx:426`), gravado direto (`use-comex-import-operations.js:52`), e
não há chamada de rede a cotação em lugar nenhum do `src/` nem em
`supabase/functions/`. `utils/currency.js:155` comenta literalmente "pra BRL via
PTAX **manual**". A frase do tutorial não é falsa ao pé da letra (o *Landed
Cost* é calculado sozinho), mas lida em sequência ela sugere que a PTAX chega
sozinha. Registro aqui porque é a mesma classe de defeito; corrigir é decisão de
outra frente.

---

## (c) O que não consegui verificar

1. **As 140 expressões `title={...}` cujo valor é dado** (nome de campanha,
   `stage.description`, nome de arquivo, `rule.pausedReason`). O texto é
   conteúdo do banco, não afirmação do código — não há "os dois lados" pra
   comparar sem consultar o banco, o que o pedido veda.
2. **Os 259 `title=` que são prop de componente.** Classifiquei todos pelo
   componente receptor (Modal 48, EmptyState 59, Section 20, PageTitle 16,
   ChartCard 12, MobileTableCards 12, AppToast 10, PageHeader 7, StatusChip 6,
   QRCodeButton 5, …), mas só confirmei o encaminhamento pra `title` nativo em
   `StatusChip.jsx:59`, `HelpTooltip.jsx:11`, `CopyPublicLinkButton.jsx:53`,
   `ViewToggleButton.jsx:19`, `KanbanAnalyticsPanel.jsx:18` e
   `PageTitle.jsx:142`. Os demais tratei como título/rótulo visível. Se algum
   dos não conferidos também virar `title=`, o universo nativo cresce.
3. **Texto que depende de comportamento do servidor que não dá pra ler no
   repo.** Confirmei o gatilho de Compras direto na migration
   (`baseline.sql:4801`) porque ele está versionado; para RPC/policy citada por
   texto de dica eu não abri o banco (vedado pelo pedido) — é o caso, por
   exemplo, das dicas de cota de IA.
4. **Se a dica aparece de fato.** Não rodei navegador (`npm run qa:smoke` /
   `qa:interacao`), então a afirmação "não aparece em toque" para os 91 casos
   não interativos é dedução do elemento, não observação. A parte lida no
   código — qual elemento carrega o `title` — é segura.
5. **Cobertura dos rótulos curtos.** Dos 345 nativos, deixei 267 rótulos de
   ação de uma a três palavras sem leitura individual do código ao redor. São
   verdadeiros por construção ("Remover campo" num botão que remove campo), mas
   não são prova: um "Excluir" num botão que arquiva passaria batido aqui.

---

### Como reproduzir o inventário

```
node scratchpad/scan2.mjs    # gera scratchpad/html2.txt — um title= nativo por linha
node scratchpad/dup.mjs      # lista os title= que repetem texto visível
```
