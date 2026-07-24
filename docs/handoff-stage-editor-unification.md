# Handoff — unificar "Editar campos desta etapa" com o formulário do card (todos os Kanbans)

Este documento existe pra uma sessão nova do Claude Code continuar este trabalho
sem re-descobrir o que já foi investigado, e sem pisar no que outra sessão
esteja mexendo ao mesmo tempo. Leia inteiro antes de tocar em código.

Origem: pedido do Daniel — "Editar campos desta etapa" (o editor por etapa)
não estava conectado ao formulário real que aparece no meio do card, em
Tarefas e em Entregas. Investigado e corrigido pra esses dois boards em
`claude/phase-edit-task-details-rh5zys`, já mergeado em `main`
(commit `9edd2b0`, fast-forward, sem merge commit).

## 1. Status — o que já está feito

**Merged em `main`:**

- **Tarefas de Marketing** (`marketing_tasks`): causa raiz era só banco — o
  CHECK `rh_pipeline_stage_fields_domain_check` ainda tinha a lista antiga de
  domínios, sem `marketing_tasks`. O frontend (`MarketingTaskDetailDrawer.jsx`)
  já lia e renderizava os campos dinâmicos corretamente; só a gravação
  falhava. Fix = só migration (nenhuma mudança de frontend precisou).
- **Entregas** (`marketing_deliverables`): causa raiz era um formulário fixo
  em código (`STAGE_FIELDS`, em `DeliverableDetailDrawer.jsx`) rodando em
  paralelo ao sistema dinâmico — "Editar campos desta etapa" só alcançava uma
  seção secundária "Campos adicionais" embaixo do formulário fixo, nunca os
  campos que o usuário via primeiro. Migrado pro sistema dinâmico
  (`rh_pipeline_stage_fields`), com backfill dos valores já salvos em
  produção. "Responsável pela Solicitação" virou um campo geral
  (Responsáveis/`assignee_ids`) em vez de preso à etapa "Solicitação".
- **Piloto de navegação em Entregas**: "Editar etapas" (lista separada) saiu
  do header. Criar/reordenar/excluir etapa agora vivem dentro de "Editar
  campos desta etapa" (`StageAdvancedModal` ganhou "Excluir esta etapa") e no
  próprio board ("+ Nova etapa" no fim do Kanban, arrastar a coluna pra
  reordenar). Só Entregas recebeu essa mudança de navegação — decisão
  explícita do Daniel de pilotar em 1 board antes de propagar.

**Arquivos principais tocados** (ler antes de replicar o padrão):
`src/components/campaign/DeliverableDetailDrawer.jsx`,
`src/components/views/EntregasView.jsx`,
`src/components/shared/stage-editor/StageAdvancedModal.jsx` (novo prop
`onDelete`), `src/components/shared/stage-editor/StageFieldsPanel.jsx` (novo
prop `onDeleteStage`, repassado pro `StageAdvancedModal` interno),
`src/components/shared/stage-editor/RHStageFieldsPanel.jsx` (novos props
opcionais `records`/`stageField` — só quando o chamador passa os dois é que
"Excluir esta etapa" aparece; sem eles, comportamento inalterado — é assim
que os outros 8 boards continuam sem a exclusão até serem migrados de
propósito), `src/components/rh-pipeline/RHStageFieldInput.jsx` (+tipo
`percent_steps`), `src/constants/field-types.js` (+`percent_steps` no
catálogo).

## 2. PENDENTE — aplicar 4 migrations no Supabase (bloqueia teste de tudo acima)

Projeto Supabase confirmado pelo Daniel: **`Sanwey_crm`**
(`adizvduyfzfftyswkijj`, us-east-1).

As migrations já estão em `supabase/migrations/` (na `main`), mas só como
arquivo — **ainda não foram aplicadas no banco**. Sem isso: Tarefas continua
com o mesmo erro de check constraint, e Entregas mostra "Campos desta etapa"
**vazio** em todas as 4 etapas (o fallback fixo antigo foi removido do
frontend — sem a migration, não sobra nada pra renderizar ali).

Aplicar **nesta ordem exata**, uma de cada vez, conferindo erro antes de
seguir pra próxima (via MCP do Supabase — `apply_migration` — ou
`supabase db push` / SQL Editor manual):

1. `20260772_drop_rh_pipeline_stage_fields_domain_hardcoded_check.sql`
2. `20260773_add_percent_steps_field_type.sql`
3. `20260774_seed_marketing_deliverables_stage_fields.sql`
4. `20260775_backfill_deliverable_stage_data_to_custom_fields.sql`

A ordem importa: 774 insere linhas em `rh_pipeline_stage_fields` com
`field_type='percent_steps'`, que só é um valor aceito depois que 773 rodar;
775 faz backfill de dado assumindo que 774 já rodou.

### Como verificar que funcionou

- **Tarefas**: abrir um card, "Editar campos desta etapa" numa fase, criar um
  campo de teste → salva sem erro (antes: `violates check constraint
  "rh_pipeline_stage_fields_domain_check"`).
- **Entregas**: abrir um card já existente em "Em Produção" (ou outra etapa
  com dado histórico) → a seção "Campos desta etapa" no meio do card mostra
  os campos (Etapa Atual, Progresso, etc.) **com os valores que já estavam
  preenchidos antes da migration** — se aparecer vazio num card que sabidamente
  tinha dado preenchido, o backfill (775) não rodou ou falhou.
- **Entregas**: mover um card de "Revisão" pra "Entregue" sem preencher os
  campos obrigatórios da etapa → deve bloquear com mensagem, campo a campo
  (antes: só os campos dinâmicos bloqueavam, os antigos "obrigatórios" do
  formulário fixo não travavam nada — bug relacionado já corrigido junto).

## 3. PENDENTE — propagar o padrão de navegação pros outros 8 boards

Pedido do Daniel: "Editar campos desta etapa" deveria substituir "Editar
etapas" **em todos os Kanbans**, não só Entregas. Sequenciado deliberadamente
como piloto-depois-rollout (mesmo padrão já usado nesta base — ver commits
`c5dbba2`/`3b1d009`, "Rollout do redesign do Kanban").

**Antes de tocar em qualquer board, siga o processo da regra 3 do
`CLAUDE.md`** (Design → Frontend → QA) — isto aqui é a entrada da fase
Design, não um substituto dela. Releia a spec do padrão já implementado em
Entregas (`EntregasView.jsx`, seções "+ Nova etapa" / drag de coluna /
`RHStageFieldsPanel` com `records`+`stageField`) antes de decidir a spec de
cada board novo.

### Inventário verificado (grep em 24/07, pode ter mudado — reconfira antes de começar)

Cada board abaixo tem hoje um botão "Editar etapas" separado no header,
abrindo `RHStageListManager` (`src/components/shared/stage-editor/
StageListManager.jsx`) — mesmo padrão que Entregas tinha antes do piloto.
Todos usam o mesmo `StageFieldsPanel` core por baixo (unificado no estilo
Pipefy no commit `aedf2b0`), então a extensão `onDeleteStage` já existe pra
eles — só falta cada view passar `records`+`stageField` e trocar a navegação,
igual foi feito em `EntregasView.jsx`.

**Padrão simples — mesmo shape que Entregas, 1 domínio só:**
- `src/components/views/MarketingTarefasView.jsx` (Tarefas, domain
  `marketing_tasks`) — atenção: já teve o bug de banco corrigido nesta
  sessão, mas a navegação (header) **ainda não foi tocada**.
- `src/components/views/MarketingView.jsx` (Campanhas, domain `marketing`)
- `src/components/views/PosVendaView.jsx` (Pós-venda) — confirmado usa
  `RHStageListManager` + `RHStageFieldsPanel`, 1 domínio.
- `src/components/views/RHOnboardingView.jsx` (Onboarding)
- `src/components/views/RHTreinamentosView.jsx` (Treinamentos)
- `src/components/views/RHFeedbackView.jsx` (Feedback)
- `src/components/views/RHFeriasView.jsx` (Férias)

**Casos especiais — não copiar o padrão simples sem adaptar:**

- `src/components/views/RHRecrutamentoView.jsx` — **2 domínios num arquivo só**
  (`vagas` e `candidatos`, toggle por `viewMode`), com 1 único botão "Editar
  etapas" (linha ~3092) que abre `RHStageListManager` com
  `domain={viewMode}` (linha ~3491) — muda dinamicamente conforme a aba
  ativa. "+ Nova etapa"/drag-reorder/exclusão precisam respeitar esse
  toggle, não assumir domínio fixo.
- `src/components/views/CRMView.jsx` (Pipeline) — **família diferente, ver
  regra 2 do CLAUDE.md**. Não usa `RHStageFieldsPanel`/`RHStageListManager`:
  usa `CRMStageFieldsPanel.jsx` (campos por empresa, tabela
  `pipeline_stage_fields` legada, não `rh_pipeline_stage_fields`) e
  `PipelineStagesModal.jsx` (não confirmado ainda se é equivalente ao
  `CRMStageListManager` que existe em `StageListManager.jsx` mas parece não
  ser usado por `CRMView.jsx` — **investigar antes de mexer**).
  `CRMStageFieldsPanel.jsx` também não tem o `onDeleteStage` wireado ainda
  (só `RHStageFieldsPanel.jsx` recebeu isso nesta sessão) — precisa do mesmo
  tratamento se for migrar este board.

**Fora de escopo — não tem editor de campos por etapa hoje:**
- `src/components/views/ComprasMarketingView.jsx` (Compras) — etapas ainda
  são a constante estática `PURCHASE_STAGES`, sem import de
  `RHStageListManager`/`RHStageFieldsPanel`/`CRMStageFieldsPanel`. Isso não é
  "esqueceram de tirar o Editar etapas" — é um board que nunca ganhou
  configuração de etapa por UI. Fora do escopo deste pedido específico a
  menos que o Daniel confirme que quer isso também.

### Padrão de referência (replicar, não reinventar)

Em `EntregasView.jsx`, ver especificamente:
- Estado: `addingStage`, `draggedColumnKey` (substituem `stageEditorOpen`).
- `handleColumnDragEnd`/`handleColumnDrop` — canal de drag separado do
  drag-and-drop de card existente (`draggedItem`), pra um não interferir no
  outro.
- Wrapper `<div draggable>` em volta de `<KanbanColumnHeader>` — não mexe no
  componente compartilhado `KanbanColumnHeader.jsx` em si.
- `NewStageModal` (componente local ao arquivo — só extrair pra `shared/` se
  for reescrito uma 3ª vez em outro board, regra 4 do CLAUDE.md).
- `RHStageFieldsPanel` invocado com `records={<lista de registros do board>}
  stageField="stage"` pra habilitar a exclusão guardada por registro ativo.

## 4. Risco de conflito com outras sessões

O Daniel roda sessões em paralelo neste mesmo repo. Antes de começar:

```
git fetch origin
git branch -r --sort=-committerdate | head -10   # branches mais recentes primeiro
git diff --name-only origin/main...origin/<branch-suspeita>
```

Se algum board da lista acima aparecer no diff de outra branch ativa, rode
`git merge-tree $(git merge-base origin/main origin/<branch>) origin/main
origin/<branch>` antes de assumir conflito — na prática, mudanças na mesma
*view* costumam ficar em hunks diferentes e mergeiam limpo (foi o caso
verificado com `claude/changelog-update-toast` vs. `EntregasView.jsx` nesta
sessão). Não editar `StageFieldsPanel.jsx` / `StageAdvancedModal.jsx` /
`RHStageFieldsPanel.jsx` sem checar se outra sessão também está — são
compartilhados pelos 9 boards.

## 5. Migrations — convenção deste repo

Nome sequencial `AAAAMMDD_descrição.sql` (não é data real, é só um contador
crescente — confira o último número em `supabase/migrations/` antes de
criar um novo, pra não colidir com o que outra sessão também esteja
criando). Constraints tipo `CHECK (coluna IN (lista))` que replicam a
existência de uma linha em outra tabela (domain, stage_key) são pra
**derrubar**, não estender (ver 20260760/61/63/772) — já causou bug
silencioso 3x nesta base. Constraints que são enumeração fechada de verdade,
sem tabela real por trás (como `field_type`), são pra **estender** (ver
20260773).
