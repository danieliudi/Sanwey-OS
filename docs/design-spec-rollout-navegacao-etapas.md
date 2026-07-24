# Rollout — navegação de etapas (piloto Entregas → 7 boards "padrão simples")

Papel **Design** do processo da regra 3 do `CLAUDE.md`. Não é design novo —
é propagação fiel de um padrão já aprovado pelo Daniel e em produção em
`src/components/views/EntregasView.jsx` (ver `docs/handoff-stage-editor-unification.md`,
seção 3, "Padrão de referência"). Este documento faz duas coisas: (1)
formaliza o molde com precisão de nome/assinatura pra ser copiado sem
ambiguidade, (2) audita os 7 arquivos-alvo linha a linha e documenta onde
cada peça se encaixa — e onde o molde **não** encaixa sem adaptação.

Dois achados transversais apareceram na auditoria que **bloqueiam ou alteram
a spec de mais de um board** — estão na seção 2, antes da tabela por board,
porque valem a pena ler antes de mexer em qualquer arquivo.

---

## 1. O molde (`EntregasView.jsx`) — anatomia exata

### 1.1 Estado (substituem/complementam `stageEditorOpen`)

```js
const [fieldEditorStage, setFieldEditorStage] = useState(null); // já existe nos 7 boards
const [addingStage,      setAddingStage]      = useState(false); // NOVO
const [draggedColumnKey, setDraggedColumnKey] = useState(null);  // NOVO
```

`stageEditorOpen` (o estado que abre `RHStageListManager`) é **removido**, e
o botão "Editar etapas" junto com ele. `fieldEditorStage` já existe em todos
os 7 boards (abre `RHStageFieldsPanel`) — não muda de nome, só ganha
`records`/`stageField` na chamada (ver 1.4).

### 1.2 Funções de drag de coluna (reordenar) — canal separado do drag de card

```js
// EntregasView.jsx:856-871
const handleColumnDragEnd = useCallback(() => setDraggedColumnKey(null), []);
const handleColumnDrop = useCallback((targetStageKey) => {
  const draggedKey = draggedColumnKey;
  setDraggedColumnKey(null);
  if (!draggedKey || draggedKey === targetStageKey) return;
  const order = kanbanStages.map(s => s.id);
  const fromIdx = order.indexOf(draggedKey);
  const toIdx   = order.indexOf(targetStageKey);
  if (fromIdx === -1 || toIdx === -1) return;
  const nextOrder = [...order];
  nextOrder.splice(fromIdx, 1);
  nextOrder.splice(toIdx, 0, draggedKey);
  const dbIdByKey = new Map(dbStages.map(s => [s.stageKey, s.id]));
  const orderedIds = nextOrder.map(k => dbIdByKey.get(k)).filter(Boolean);
  if (orderedIds.length === nextOrder.length) reorderStages(orderedIds);
}, [draggedColumnKey, kanbanStages, dbStages, reorderStages]);
```

Depende de `addStage`/`reorderStages` vindos de `useRHPipelineStages(domain)`
— o hook (`src/hooks/use-rh-pipeline-stages.js:154-163`) já expõe os dois
independente do domínio, então nenhum board precisa de mudança de hook, só
desestruturar o que falta.

**Atenção, nome de função**: em `EntregasView.jsx` o drop de **card sobre
coluna** (mover registro de etapa) é `handleDrop(toStage)` — nome diferente
de `handleColumnDrop`, de propósito, pra não colidir. Ver seção 2.2: 3 dos 7
boards-alvo já têm uma função **chamada** `handleColumnDrop` fazendo o drop
de *card*, não de coluna — copiar o nome literalmente quebraria (ou
sobrescreveria) a função existente.

### 1.3 Wrapper de drag no cabeçalho da coluna

```jsx
// EntregasView.jsx:1160-1204 (grifo no wrapper, não no KanbanColumnHeader em si)
<div
  draggable={canWrite}
  onDragStart={() => canWrite && setDraggedColumnKey(stage.id)}
  onDragEnd={handleColumnDragEnd}
  onDragOver={e => { if (draggedColumnKey) { e.preventDefault(); e.stopPropagation(); } }}
  onDrop={e => { if (draggedColumnKey && draggedColumnKey !== stage.id) { e.stopPropagation(); handleColumnDrop(stage.id); } }}
  style={{ cursor: canWrite ? "grab" : "default" }}
>
  <KanbanColumnHeader ...>...</KanbanColumnHeader>
</div>
```

`KanbanColumnHeader.jsx` (componente compartilhado) **não é tocado** — o
`<div draggable>` só envolve a chamada dele. `e.stopPropagation()` no
`onDragOver`/`onDrop` existe pra este canal de drag (coluna) não vazar pro
canal de drag de card, que já tem seu próprio `onDragOver`/`onDrop` no `<div>`
pai da coluna inteira (`draggedItem` vs `draggedColumnKey` — dois estados,
dois `data` de drag, nunca se misturam porque o wrapper intercepta e para a
propagação antes de chegar no listener do card).

### 1.4 `RHStageFieldsPanel` com `records`/`stageField`

```jsx
// EntregasView.jsx:1326-1336
{canWrite && (
  <RHStageFieldsPanel
    open={!!fieldEditorStage}
    onClose={() => setFieldEditorStage(null)}
    domain="marketing_deliverables"
    stageKey={fieldEditorStage?.id}
    stageName={fieldEditorStage?.name}
    records={deliverables}   // NOVO — lista de registros do board
    stageField="stage"       // NOVO — chave do campo que guarda a etapa atual
  />
)}
```

Conforme `RHStageFieldsPanel.jsx:10-15,26-32`: `records`/`stageField` são
**opcionais** — só habilitam "Excluir esta etapa" dentro de "Opções
Avançadas" (`StageAdvancedModal`) quando os dois são passados. A checagem é
só `count = records.filter(r => r[stageField] === stageKey).length; if
(count > 0) throw`. **Não existe nenhuma outra proteção** nesse caminho —
ver achado bloqueante na seção 2.1.

### 1.5 `NewStageModal` (local ao arquivo)

```js
// EntregasView.jsx:655-718
function NewStageModal({ existingKeys, nextOrderIdx, onAdd, onClose }) { ... }
```

Formulário mínimo: nome + `StageColorPicker` (`src/components/shared/stage-editor/StageColorPicker.jsx`,
já compartilhado). Gera `stageKey` via slug local (`slugifyStageKeyLocal`,
função também local ao arquivo — duplicar é aceitável aqui, regra 4 do
`CLAUDE.md` só manda extrair na 3ª cópia, e depois deste rollout haverá até
7 cópias — **isso é gatilho pra extração**, ver seção 5). Chamada:

```jsx
{addingStage && (
  <NewStageModal
    existingKeys={dbStages.map(s => s.stageKey)}
    nextOrderIdx={dbStages.length}
    onAdd={addStage}
    onClose={() => setAddingStage(false)}
  />
)}
```

Tile "+ Nova etapa" no fim do Kanban desktop (`EntregasView.jsx:1249-1261`,
`width:140, height:64`, borda tracejada) e botão de mesma função na versão
mobile empilhada (`EntregasView.jsx:1126-1135`).

### 1.6 O que sai

Botão "Editar etapas" no header (qualquer variante: `ToolbarButton`,
`<button>` cru, `ui/Button.jsx`) e a renderização de `<RHStageListManager
.../>` no fim do arquivo — ambos removidos. `RHStageListManager`
(`StageListManager.jsx`) continua existindo no repo (usado por
`RHRecrutamentoView`/`CRMView`, fora de escopo deste rollout) — não apagar o
componente, só parar de importá-lo nestes 7 arquivos.

---

## 2. Achados transversais (ler antes de tocar em qualquer board)

### 2.1 BLOQUEANTE — `nonDeletableStageKeys` não existe no caminho novo

`RHStageListManager` (`StageListManager.jsx:38,98-101,463`) recebe um prop
`protectedKeys`/`nonDeletableStageKeys` — uma lista de `stageKey` que **nunca
pode ser excluída**, independente de ter registro ativo ou não (bloqueia com
`alert()`, mensagem "é uma etapa estrutural e não pode ser removida").
Hoje isso protege:

- `RHFeriasView.jsx:1175` — `nonDeletableStageKeys={["aprovado", "recusado"]}`
- `RHTreinamentosView.jsx:1221` — `nonDeletableStageKeys={["pendente", "concluido", "vencido"]}`

O caminho novo (`RHStageFieldsPanel` → `StageAdvancedModal`, "Excluir esta
etapa") **não tem esse conceito**. A única proteção em
`RHStageFieldsPanel.jsx:26-32` é contar registros *atualmente* na etapa —
zero registros na etapa agora = exclusão permitida, mesmo que a etapa seja
estruturalmente indispensável (ex.: `aprovado`/`recusado` em Férias são lidos
em código pra decidir aprovação/recusa; `pendente`/`concluido`/`vencido` em
Treinamentos alimentam o cálculo de compliance/atraso pra **todos** os
treinamentos, não só o board aberto).

**Isso significa que, se Férias e Treinamentos forem migrados com o molde
tal como está**, a rede de segurança que existe hoje (bloqueio categórico,
independente de contagem) desaparece — um board vazio na etapa errada no
momento errado permite apagar uma etapa que quebra lógica de negócio em
produção, silenciosamente (sem erro visível até o próximo cálculo de
compliance/aprovação rodar em falso).

Não decido isso sozinho — ver "Perguntas em aberto" (seção 6, item 1) antes
de migrar **Férias** e **Treinamentos**. Os outros 5 boards (Tarefas,
Campanhas, Pós-venda, Onboarding, Feedback) não declaram
`nonDeletableStageKeys` hoje — não têm essa lacuna porque nunca tiveram essa
proteção pra perder (podem seguir o molde sem esta ressalva, embora valha
perguntar se deveriam ganhar proteção também, ver mesma seção).

### 2.2 Colisão de nome — `handleColumnDrop` já existe (com outro significado) em 3 boards

O molde introduz uma função **nova** chamada `handleColumnDrop` (reordenar
coluna arrastando o cabeçalho). Só que em 3 dos 7 arquivos já existe uma
função com **esse nome exato**, fazendo uma coisa **diferente** (soltar um
*card* dentro da coluna, drag de registro — não de coluna):

| Arquivo | `handleColumnDrop` já existe (card→coluna) | linha |
|---|---|---|
| `RHOnboardingView.jsx` | sim | `1159` (+`handleColumnDragOver`/`handleColumnDragLeave`, `1157-1158`) |
| `RHFeedbackView.jsx` | sim | `1379` (+ mesmos dois pares, `1377-1378`) |
| `RHFeriasView.jsx` | sim | `950` |

Copiar o molde literalmente sobrescreveria/colidiria com essas três. Nome
sugerido pra função **nova** (reorder de coluna) nesses 3 arquivos:
`handleStageReorderDrop`/`handleStageReorderDragEnd` (ou qualquer nome que
não seja `handleColumnDrop`/`handleColumnDragOver`/`handleColumnDragLeave`,
que continuam servindo exclusivamente o drop de card, sem mudança). Nos
outros 4 (Tarefas, Campanhas, Pós-venda — e Entregas, já pronto), o
card-drop já se chama `handleDrop` (não `handleColumnDrop`), então os nomes
exatos do molde (`handleColumnDragEnd`/`handleColumnDrop`) podem ser copiados
sem ajuste.

### 2.3 Onde o "+ Nova etapa"/drag de coluna se encaixa por arquétipo de arquivo

Dois arquétipos diferentes entre os 7:

- **Coluna inline** (Tarefas, Campanhas, Pós-venda — mesmo shape de
  `EntregasView.jsx`): a `<div>` da coluna e o `<KanbanColumnHeader>` estão
  escritos direto no corpo do componente principal. Copiar o wrapper
  `<div draggable>` da seção 1.3 quase sem adaptação.
- **Coluna extraída em componente próprio** (Onboarding →
  `OnboardingKanbanColumn`, Treinamentos → `TreinamentoBoardColumn`, Feedback
  → `FeedbackKanbanColumn`, Férias → `FeriasKanbanColumn`): o wrapper
  `<div draggable>` precisa entrar **dentro** desses componentes (em volta do
  `<KanbanColumnHeader>` interno a cada um), e os novos props
  (`isColumnDragging`/callbacks de reorder) precisam ser passados de fora
  pra dentro — mais um nível de plumbing que o molde original (que não tinha
  esse nível de componentização) não exemplifica 1:1. Adaptar a assinatura,
  não o comportamento.

---

## 3. Tabela resumo — mapeamento por board

| Board | Arquivo | Botão/estado atual | `records` a passar | `stageField` | `domain` | Peculiaridade que quebra o molde simples |
|---|---|---|---|---|---|---|
| Tarefas | `MarketingTarefasView.jsx` | estado `stageEditorOpen` (`:299`), botão `:430` | `tasks` | `"stage"` | `marketing_tasks` | Nenhuma — coluna inline, `handleDrop` já livre. Mais simples dos 7. |
| Campanhas | `MarketingView.jsx` | estado `stageEditorOpen` (`:698`), botão `:945-955` | `campaigns` | `"stage"` | `marketing` | Nenhuma — já usa `KanbanColumnHeader` (`:1215`), coluna inline. |
| Pós-venda | `PosVendaView.jsx` | estado `stageEditorOpen` (`:318`), botão `:369-376` | `cases` | `"stage"` | `posvenda` | (a) botão "Editar etapas" só aparece se `isManager && !isGroupView` (`:368`) — "+ Nova etapa"/drag devem herdar essa mesma condição, não só `canWrite`; (b) botão de campos por etapa hoje só aparece em coluna **não-terminal** (`actions={isManager && !stage.terminal && (...)}`, `:468`) — sem correção, colunas terminais ficam sem nenhuma forma de abrir "Editar campos"/"Excluir esta etapa" depois que "Editar etapas" sair do header; corrigir o gate para incluir terminais também faz parte deste rollout, não é opcional. |
| Onboarding | `RHOnboardingView.jsx` | estado `stageEditorOpen` (`:1043`), botão `:1292` | `colaboradores` | `"onboardingStage"` (não é `"stage"`) | `onboarding` | (a) colisão de nome, seção 2.2; (b) coluna extraída (`OnboardingKanbanColumn`, `:233`); (c) etapa terminal "de saída" (ex. "Removido") é resolvida dinamicamente (`stages.find(s => s.terminal && s.lost)`, `:1035`) e renderizada como coluna normal (`stages.map`, `:1376`, sem filtro) — ver pergunta em aberto (seção 6, item 2) sobre se ela deve ficar excluível/reordenável pelo usuário. |
| Treinamentos | `RHTreinamentosView.jsx` | estado `stageEditorOpen` **dentro de `TreinamentoBoardModal`** (`:1005`), botão `:1098` | `atribuicoes` (já filtrado por treinamento — prop do modal, **não é a lista global**) | `"status"` | `treinamentos` | (a) `nonDeletableStageKeys` (seção 2.1); (b) board vive dentro de um **modal** (`TreinamentoBoardModal`, overlay `position:fixed;inset:0`, `:1084`), não uma página — "+ Nova etapa"/drag de coluna afetam o domínio `"treinamentos"` **inteiro** (compartilhado entre todos os treinamentos), mesmo abertos a partir do board de um treinamento só — isso já é verdade hoje (a etapa é por domínio, não por treinamento), não é novidade do rollout, mas fica mais visível quando a ação de criar/reordenar etapa está dentro do board de UM treinamento específico; (c) o guard de exclusão em `RHStageFieldsPanel` conta registros só dentro de `atribuicoes` (escopo de 1 treinamento) — se outro treinamento tiver registros ativos na mesma etapa, a contagem não vê e permite excluir uma etapa em uso por outro treinamento (falha pré-existente do mesmo tipo em `RHStageListManager` hoje, não piora com o rollout, mas também não é corrigida por ele — ver seção 6, item 3). |
| Feedback | `RHFeedbackView.jsx` | estado `stageEditorOpen` (`:1221`), botão `:1499` | `feedbacks` | `"status"` | `feedback` | Colisão de nome (seção 2.2); coluna extraída (`FeedbackKanbanColumn`, `:644`). Sem `nonDeletableStageKeys` hoje — sem lacuna de proteção a resolver. |
| Férias | `RHFeriasView.jsx` | estado `stageEditorOpen` (`:835`), botão `:1023` | `requests` | `"status"` | `ferias` | `nonDeletableStageKeys=["aprovado","recusado"]` (seção 2.1, bloqueante); colisão de nome (seção 2.2); coluna extraída (`FeriasKanbanColumn`, `:404`). Diferente de Treinamentos, aqui `records={requests}` já é a lista **global** (não escopada por sub-entidade) — a contagem de "registros ativos na etapa" está correta, só falta a proteção categórica. |

---

## 4. Detalhe por board

### 4.1 Tarefas de Marketing (`MarketingTarefasView.jsx`) — mais simples

Sem nenhuma peculiaridade encontrada. Card-drop já se chama `handleDrop`
(não colide com `handleColumnDrop` novo). Coluna é `<div>` inline
(`:616-653`), sem `KanbanColumnHeader` (cabeçalho escrito à mão) — o wrapper
`<div draggable>` da seção 1.3 entra em volta desse bloco de cabeçalho
manual, não em volta de um componente `KanbanColumnHeader` (não há um
aqui — tudo bem, o wrapper não depende de `KanbanColumnHeader` existir, só
precisa envolver o que hoje mostra nome/contagem/ações da coluna).
`useRHPipelineStages("marketing_tasks")` (`:294`) hoje só desestrutura
`{ stages: dbStages, loading: loadingStages }` — adicionar `addStage,
reorderStages`.

### 4.2 Campanhas (`MarketingView.jsx`)

Igual a Tarefas, mas já usa `KanbanColumnHeader` (`:1215-1257`) — o wrapper
entra exatamente como no molde (seção 1.3), em volta da chamada existente.
`useRHPipelineStages("marketing")` (`:693`) — mesma adição de
`addStage`/`reorderStages`.

### 4.3 Pós-venda (`PosVendaView.jsx`)

Duas correções que fazem parte do escopo (não são extras opcionais):

1. `isGroupView` — hoje `isManager && !isGroupView` decide se "Editar
   etapas" aparece (`:368`). "+ Nova etapa" e o drag de coluna devem herdar
   a mesma regra (`canWrite && !isGroupView`, ajustando pro nome de variável
   que fizer sentido no escopo de cada botão) — sem isso, um manager
   olhando a visão agregada de várias empresas ganharia um jeito de
   reordenar/criar etapa que hoje é deliberadamente bloqueado nessa visão.
2. Gate `!stage.terminal` no botão de "Editar campos desta etapa"
   (`:468`, rotulado "Editar fase" — nome diferente de "Editar campos desta
   etapa" usado nos outros 6 boards, inconsistência menor, sinalizar mas não
   bloqueia) — remover a exclusão de terminal daqui. Sem isso, depois que
   "Editar etapas" sair do header, colunas terminais (ex. etapas de
   ganho/perda do funil de pós-venda) ficam sem *nenhum* jeito de abrir
   config/exclusão.

`useRHPipelineStages("posvenda")` (`:273`) hoje só desestrutura `{ stages }`
— adicionar `loading` (se precisar) e `addStage`, `reorderStages`.

### 4.4 Onboarding (`RHOnboardingView.jsx`)

- Colisão de nome (seção 2.2) — usar `handleStageReorderDrop`/
  `handleStageReorderDragEnd` (ou equivalente) pro reorder, preservando
  `handleColumnDragOver`/`handleColumnDragLeave`/`handleColumnDrop`
  existentes intocados (card→coluna).
- `stageField` é `"onboardingStage"`, não `"stage"` — conferir isso é
  literalmente o único valor que muda na chamada de `RHStageFieldsPanel` em
  relação ao molde.
- Etapa terminal "de saída" (dinâmica, `terminal && lost`, comentário em
  `:1025-1034`) é renderizada como qualquer outra coluna hoje — ver pergunta
  em aberto (seção 6, item 2): se ela puder ser excluída/renomeada livremente
  pelo usuário via este novo caminho, `onboardingRemovedStageKey` (linha
  `1035`) pode virar `null` em runtime e a função "Remover do onboarding"
  desaparece silenciosamente (o código já trata esse caso com
  `onDeleteCard={... && onboardingRemovedStageKey ? ... : undefined}`, então
  não quebra/crasha — só faz o recurso sumir sem aviso).
- Coluna extraída em `OnboardingKanbanColumn` (`:233-290`) — wrapper de
  drag entra dentro desse componente, em volta do `KanbanColumnHeader`
  interno (`:254`).
- `useRHPipelineStages("onboarding")` (`:1024`) hoje só desestrutura
  `{ stages, loading: loadingStages }` — adicionar `addStage`,
  `reorderStages`.

### 4.5 Treinamentos (`RHTreinamentosView.jsx`) — mais peculiar, migrar por último

- Board não é uma página — é `TreinamentoBoardModal` (`:997-1236`), aberto
  a partir do catálogo de treinamentos (estado `boardTreinamento` no
  componente pai `RHTreinamentosView`, `:1251`). "+ Nova etapa"/drag de
  coluna/"Editar campos"/"Excluir etapa" ficam **dentro do modal**, não na
  view principal.
- `domain="treinamentos"` é **um domínio só, compartilhado por todos os
  treinamentos** — reordenar/criar/excluir etapa a partir do board de um
  treinamento específico afeta o board de **todos** os outros treinamentos
  também. Isso já é assim hoje (mesmo domínio usado por
  `RHStageListManager` atual) — não é regressão do rollout, mas é uma
  characteristic que vale confirmar com o Daniel está ciente antes de expor
  "+ Nova etapa" dentro do contexto de 1 treinamento só (ver seção 6, item
  3).
- `records={atribuicoes}` passado pro board (`:1213` hoje, no
  `RHStageListManager`; seria o mesmo prop no `RHStageFieldsPanel` após
  migração) é a prop `atribuicoes` do **modal**, já filtrada só pro
  treinamento aberto (`atribuicoesByTreinamento.get(boardTreinamento.id)`,
  view principal `:1476`) — **não é a lista global** de atribuições de todos
  os treinamentos. A checagem de "tem registro ativo nesta etapa" em
  `RHStageFieldsPanel`/`StageAdvancedModal` só vê essa fatia — pode liberar
  exclusão de uma etapa que está em uso em outro treinamento. Achado
  pré-existente (mesma limitação já vale pro `RHStageListManager` de hoje),
  não introduzido por este rollout, mas também não resolvido por ele —
  ver seção 6, item 3.
- `nonDeletableStageKeys=["pendente","concluido","vencido"]` (`:1221`) — ver
  achado bloqueante seção 2.1.
- Coluna extraída em `TreinamentoBoardColumn` (`:556-614`). Card-drop já se
  chama `handleDrop` (`:1072`, sem colisão com o `handleColumnDrop` novo).
- `useRHPipelineStages("treinamentos")` (`:1001`) hoje só desestrutura
  `{ stages, loading: loadingStages }` — adicionar `addStage`,
  `reorderStages`.

**Recomendação**: por acumular os 3 achados mais delicados (schema
compartilhado entre treinamentos, escopo de `records` restrito, proteção de
etapas estruturais), migrar Treinamentos **por último** dos 7, só depois que
o padrão já tiver rodado em produção em pelo menos 2-3 boards mais simples.

### 4.6 Feedback / Avaliação de Desempenho (`RHFeedbackView.jsx`)

- Colisão de nome (seção 2.2) — mesmo tratamento do Onboarding.
- Coluna extraída em `FeedbackKanbanColumn` (`:644-703ish`).
- Sem `nonDeletableStageKeys` hoje — sem achado bloqueante equivalente ao
  de Férias/Treinamentos, mas vale a mesma pergunta da seção 6 item 1 (se
  merece proteção categórica também, já que há etapas como
  "autoavaliação"/"concluído" lidas em código).
- `stageField="status"` (não `"stage"`).
- `useRHPipelineStages("feedback")` (`:1211`) — adicionar `addStage`,
  `reorderStages`.

### 4.7 Férias (`RHFeriasView.jsx`)

- `nonDeletableStageKeys=["aprovado","recusado"]` (`:1175`) — achado
  bloqueante da seção 2.1. Diferente de Treinamentos, aqui `records=
  {requests}` já é a lista **completa e global** (não hierárquica por
  sub-entidade) — então, ao contrário de Treinamentos, a contagem de
  "registros ativos" em si está correta; falta só a proteção categórica
  (etapa pode estar com 0 registros ativos no momento e ainda assim ser
  estruturalmente indispensável).
- Colisão de nome (seção 2.2) — `handleColumnDrop` já existe (`:950`).
- Coluna extraída em `FeriasKanbanColumn` (`:404-460ish`).
- `stageField="status"`.
- `useRHPipelineStages("ferias")` (`:825`) — adicionar `addStage`,
  `reorderStages`.

---

## 5. Extração sob demanda (regra 4 do `CLAUDE.md`) — sinalização, não execução

Depois deste rollout, `NewStageModal` (formulário mínimo nome+cor pra criar
etapa) e a lógica de `slugifyStageKeyLocal` existirão **7 vezes** (contando
Entregas). Isso já passou do limite de "3ª cópia" da regra 4 — é candidato
a extração pra `src/components/shared/stage-editor/` (ex.:
`NewStageModal.jsx` compartilhado, recebendo `existingKeys`/`nextOrderIdx`/
`onAdd`/`onClose` como já faz hoje). **Não faço essa extração aqui** — é
decisão de implementação do Frontend, sinalizo porque a regra manda avaliar
no momento em que a 3ª cópia (na prática, aqui, todas de uma vez) acontece.
Mesmo raciocínio vale pro wrapper `<div draggable>` da seção 1.3, que se
repete quase idêntico nos 3 boards de coluna inline (Tarefas, Campanhas,
Pós-venda) — menos óbvio de extrair porque nos 4 boards de coluna
componentizada o wrapper precisa entrar dentro de cada componente próprio,
não dá pra ser 100% genérico sem tocar todos os 4 componentes de coluna
também.

---

## 6. Ordem de implementação recomendada

Do mais parecido com o piloto (Entregas) pro mais peculiar — cada item só
começa depois do anterior passar por QA (regra 3 do `CLAUDE.md`), não em
paralelo, pra não empilhar risco de um padrão ainda não validado:

1. **Tarefas de Marketing** (`MarketingTarefasView.jsx`) — zero
   peculiaridade encontrada, coluna inline, sem colisão de nome. Serve de
   segunda confirmação do molde antes de tocar nos casos com componente de
   coluna extraído.
2. **Campanhas** (`MarketingView.jsx`) — mesma simplicidade, já usa
   `KanbanColumnHeader`, valida o wrapper de drag em cima do componente
   compartilhado (não cabeçalho manual).
3. **Pós-venda** (`PosVendaView.jsx`) — ainda coluna inline, mas exige as
   duas correções da seção 4.3 (`isGroupView`, gate de terminal) — primeiro
   board onde o Frontend precisa decidir algo além de copiar.
4. **Feedback** (`RHFeedbackView.jsx`) — primeiro com coluna componentizada
   e colisão de nome (seção 2.2) — valida o padrão de plumbing "de fora pra
   dentro" do componente de coluna, e a resolução do nome de função, sem
   nenhum outro achado bloqueante em cima.
5. **Onboarding** (`RHOnboardingView.jsx`) — mesma componentização +
   colisão de nome de Feedback, mais a pergunta em aberto sobre a etapa
   terminal "Removido" (seção 6-perguntas, item 2) — decidir essa pergunta
   com o Daniel antes deste item, não durante.
6. **Férias** (`RHFeriasView.jsx`) — só depois que a pergunta sobre
   `nonDeletableStageKeys` (item 1 abaixo) estiver resolvida, porque migrar
   sem resolver isso reintroduziria um jeito de apagar `aprovado`/`recusado`
   sem o bloqueio categórico que existe hoje.
7. **Treinamentos** (`RHTreinamentosView.jsx`) — por último, acumula todos
   os achados (modal em vez de página, domínio compartilhado entre
   treinamentos, escopo de `records` restrito ao treinamento aberto,
   `nonDeletableStageKeys`) — só depois dos outros 6 já validados em
   produção e da pergunta 1 e 3 abaixo resolvidas.

QA (regra 3) roda depois de cada item da lista, não só no fim — mesmo
processo que já vale pra qualquer mudança de UI nova.

---

## Perguntas em aberto pro Daniel (não decidi por conta própria)

1. **`nonDeletableStageKeys` — o que fazer com essa proteção no caminho
   novo?** Bloqueia diretamente Férias e Treinamentos (seção 2.1). Três
   caminhos possíveis, nenhum decidido aqui:
   - (a) Adicionar um prop equivalente (`protectedStageKeys`) em
     `RHStageFieldsPanel`/`StageAdvancedModal`, plumbing igual ao que já
     existe em `StageListManager` — mantém a mesma garantia, mas é mudança
     de código em componente compartilhado por 9 boards (`StageAdvancedModal.jsx`),
     exige cuidado extra e = mais uma rodada de Design→Frontend→QA nesse
     componente específico antes de migrar Férias/Treinamentos.
   - (b) Deixar Férias e Treinamentos com um **híbrido**: "+ Nova
     etapa"/drag de coluna migram pro padrão novo, mas exclusão de etapa
     continua vivendo só na tela antiga de "Editar etapas" (mantendo o botão
     só pra esses 2 boards, só pra a ação de excluir) até (a) ser resolvido.
   - (c) Aceitar o risco (etapas estruturais ficam sem proteção categórica,
     só com a checagem de contagem atual) e comunicar isso como mudança de
     comportamento conhecida.
   Não escolho nenhuma das três — decisão de produto/risco do Daniel.

2. **Onboarding — a etapa "Removido" deve ser excluível/reordenável pelo
   usuário no novo padrão?** Hoje ela é calculada dinamicamente
   (`terminal && lost`) e usada por `handleRemoveFromOnboarding`
   (`RHOnboardingView.jsx:1139-1140`). Se sim, nada muda (já é uma etapa
   normal em `rh_pipeline_stages`, só com essas duas flags marcadas). Se
   não, precisa da mesma decisão da pergunta 1 (proteção categórica) só que
   com uma lista de proteção que hoje **não existe nenhuma** pra Onboarding
   (`nonDeletableStageKeys` nunca foi declarado aqui) — teria que ser
   adicionado como parte deste rollout, não é reaproveitamento do que já
   existe.

3. **Treinamentos — "+ Nova etapa"/drag de coluna abertos de dentro do
   board de 1 treinamento devem deixar isso explícito pro usuário?** O
   domínio `"treinamentos"` é compartilhado por todos os treinamentos (achado
   seção 4.5) — já é assim hoje com "Editar etapas", mas fica mais
   surpreendente quando a ação de criar uma etapa nova está fisicamente
   dentro do modal de UM treinamento específico ("Nova etapa" parece "nova
   etapa deste treinamento", mas na prática é "nova etapa de TODOS os
   treinamentos"). Vale um aviso textual no `NewStageModal` desse board
   específico (ex.: "Esta etapa vale para todos os treinamentos, não só
   {treinamento.titulo}") — não decido a redação nem se é necessário, só
   sinalizo que a ambiguidade existe e fica pior com este rollout
   especificamente neste board. Relacionado: o escopo de `records` restrito
   ao treinamento aberto (mesma seção) significa que a contagem de "tem
   registro nesta etapa" pra bloquear exclusão pode estar errada quando
   olhando de dentro de 1 treinamento só — se isso deve ser corrigido como
   parte deste rollout (exigiria passar a lista global de atribuições, não
   só as do treinamento aberto) ou aceito como limitação pré-existente, não
   decidido aqui.
