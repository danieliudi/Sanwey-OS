# Handoff — Auditoria "Zero Bullshit": o que falta corrigir (pra executar em outra sessão)

**Contexto pra sessão que pegar este documento:** a auditoria completa está em
`docs/auditoria-zero-bullshit-2026-07-23.md` (43 achados confirmados por
verificação adversarial + 7 sem veredito final, com arquivo:linha). O **P0
inteiro (17 itens) JÁ FOI CORRIGIDO** — não refaça. Este documento lista o que
resta (P1, P2, backlog de QA e pendências de decisão), com o detalhe necessário
pra implementar sem reler a auditoria inteira.

**Regras da casa (obrigatórias, não opcionais):**
1. Leia `CLAUDE.md` antes de qualquer código — reaproveitamento (regra 1),
   famílias CRM/RH (regra 2), processo Design→Frontend→QA (regra 3), extração
   na 3ª repetição (regra 4), configuração vs. código (regra 5 — **schema novo
   só com confirmação explícita do Daniel**).
2. `npx vite build` antes de reportar qualquer etapa como pronta.
3. Nunca mergear pra `main` sem instrução explícita do Daniel naquela hora.
4. Erros sempre visíveis pro usuário — a classe de bug nº 1 desta auditoria
   foi "a UI mente sucesso".
5. Linhas citadas abaixo são da data da auditoria (23/07/2026) — podem ter
   deslocado; localize pelo conteúdo, não pelo número cego.

---

## Já corrigido (NÃO refazer) — P0 completo, 17 itens

Corrigidos, aprovados por QA e commitados na branch `claude/changelog-update-toast`
(commits "P0 da auditoria (lote 1)", "(lote 2)" e "toast de nova versão"):

| # | Item | Onde ficou |
|---|---|---|
| 1 | Select "Etapa do funil" com etapas reais + matriz + defaults de ganho | `LeadDetailDrawer.jsx` |
| 2 | Guardrail de matriz no attemptStageChange do board + CTA mobile gateado | `CRMView.jsx`, `LeadDetailDrawer.jsx` |
| 3 | Ramo '60d' no filtro do Executivo | `AnalyticsTab.jsx` |
| 4 | Notificações gateadas pelos toggles (ver "mudança intencional" abaixo) | `use-notifications.js`, `user-settings.js`, `App.jsx` |
| 5 | Automações de Marketing aplicam patches/sideEffects | `MarketingView.jsx` |
| 6 | `lead.badges` renderizado no card do Kanban | `LeadKanbanCard.jsx` |
| 7 | `replacePipeline` lança erro (modal não fecha em falha) | `use-pipelines.js` |
| 8 | Falha de e-mail do link do gestor vira aviso com link copiável | `RHRecrutamentoView.jsx` |
| 9 | Minhas Tarefas inclui compras em `cotacao` | `use-my-tasks.js` |
| 10 | Board de Compras exige fornecedor vencedor (abre drawer) | `ComprasMarketingView.jsx` |
| 11 | `getInvalidFields` só valida campos visíveis | `field-validation.js` |
| 12 | Toast de update reaparece a cada novo deploy (reset no `onNeedRefresh`) | `use-app-update.js` |
| 13 | Movimentação de promoção falha com erro visível | `RHFeedbackView.jsx` |
| 14 | Certificado preservado ao voltar pra pendente + NR autodeclarada fora do % | `use-rh-treinamentos.js`, `RHTreinamentosView.jsx` |
| 15 | Follow-up notifica co-responsáveis (`ownerIds`) | `use-notifications.js` |
| 16 | Bulk de candidatos valida campos obrigatórios | `RHRecrutamentoView.jsx` |
| 17 | Férias: etapas protegidas + fim de `alert()`/`prompt()` no fluxo de recusa | `RHFeriasView.jsx` |

**Mudança de comportamento intencional já em vigor** (comunicada ao Daniel):
a notificação de aniversário nasce DESLIGADA — o toggle em Configurações sempre
exibiu "off"; agora o comportamento corresponde. Não "corrigir" de volta.

---

## P1 — Refactor sistêmico (pendente, ordem sugerida)

### P1.1 Unificar `StageFieldInput` CRM+RH num shared (M) — mata 4 achados
- `src/components/lead/StageFieldInput.jsx` (CRM) e
  `src/components/rh-pipeline/RHStageFieldInput.jsx` (RH) são o mesmo switch de
  tipos copiado, cada um com um pedaço certo que falta no outro:
  - CRM tem o guard "select/radio/multicheck sem opções" (aviso âmbar,
    `StageFieldInput.jsx:58`) — RH NÃO tem (`RHStageFieldInput.jsx:89`): select
    vazio renderiza mudo (classe de bug conhecida do CLAUDE.md).
  - RH tem focus ring por token (`color-mix(...var(--accent)...)`,
    `RHStageFieldInput.jsx:26`) — CRM hardcoda o vermelho da Resibag
    `rgba(199,33,43,.1)` (`StageFieldInput.jsx:49`), errado em outras frentes.
  - CRM hardcoda `#FFFFFF`/`#D1D5DB` no baseStyle (`StageFieldInput.jsx:44-45`)
    — inputs brancos no dark mode (achado ALTO da auditoria).
  - RH hardcoda `#FEF2F2`/`#FECACA` no highlight de obrigatório
    (`RHStageFieldInput.jsx:141`) — deveria ser `var(--danger-bg)`/`var(--danger)`.
- **Correção**: extrair um `src/components/shared/StageFieldInput.jsx` com o
  melhor dos dois (guard de opções + tokens em tudo), e os dois atuais viram
  wrappers finos ou somem (12+ call sites no RH, criação+drawer no CRM —
  mapear com grep antes). Justificativa da extração: regra 4 (3º uso chegando
  com o Pós-venda — ver P1.3).

### P1.2 Migrar `MarketingTarefasView` pro chrome compartilhado do Kanban (M)
- `src/components/views/MarketingTarefasView.jsx:606-628` é o ÚNICO board que
  ficou fora do redesign: fade na borda direita (:608), banda 8px, nome
  uppercase/neutro, sem `KanbanColumnHeader`/`KanbanBoardScrollArea`/`KanbanBoardHeader`.
- **Correção**: mesmo receituário aplicado aos outros 10 boards — banda 4,
  `nameColor=stage.color`, `nameFontSize=14`, `nameFontWeight=700`,
  `uppercase=false`, `countFontSize=12`, coluna com `border: 1px solid
  var(--border)`, `rounded-lg`, `overflow hidden`, `gap-2`, scroll via
  `KanbanBoardScrollArea` (que já dá o respiro pl-6/pr-6), toolbar via
  `KanbanBoardHeader`. Use qualquer board migrado (ex.: `EntregasView.jsx`)
  como gabarito.

### P1.3 Pós-venda: consumir os campos configurados por etapa (M)
- O gear "Editar fase" do Pós-venda grava campos em `rh_pipeline_stage_fields`
  (domain `posvenda`), mas NADA renderiza/valida/persiste: `QuickAddCaseModal`,
  `PosVendaDetailModal` e `caseToRow` (`use-posvenda.js:23-34`) ignoram
  (config morta — achado MÉDIO).
- **Correção**: renderizar os campos no create modal e no detalhe via o
  StageFieldInput compartilhado (P1.1), persistindo em `custom_fields` (a
  tabela `posvenda_cases` precisa da coluna? VERIFICAR — se precisar de coluna
  nova, é schema: **confirmação do Daniel antes**), e validar
  obrigatórios/formato na troca de etapa como o Comercial faz.

### P1.4 Compras → modelo configurável (G) — **DECISÃO DO DANIEL PRIMEIRO**
- Último board com mini-motor próprio: `PURCHASE_STAGES` hardcoded
  (`use-marketing-purchase-requests.js:6`), `STAGE_COLORS`
  (`ComprasMarketingView.jsx:26`), transições à mão.
- Duas rotas (a auditoria não decide sozinha): (a) migrar pra
  `rh_pipeline_stages` (domain novo `compras`) + `pipeline_stage_transitions`
  — schema/dado novo, exige confirmação explícita; ou (b) manter hardcoded de
  propósito (as transições são acopladas às RPCs de aprovação) e documentar
  como exceção intencional no CLAUDE.md. **Perguntar antes de começar.**

### P1.5 Deletar código morto + atualizar CLAUDE.md (P)
- 8 arquivos exportados sem nenhum importador (~790 linhas), confirmados por
  grep: `lead/StageFieldsEditor.jsx` (269), `shell/AppHeader.jsx` (137),
  `shell/NavTabs.jsx` (43), `lead/LeadCard.jsx` e mais 4 (regrep de
  "exportados sem importador" pra fechar a lista atual — a auditoria listou 8;
  ATENÇÃO: `LeadCard.jsx` era referência do formato de badges, o formato já
  foi portado pro `LeadKanbanCard`, pode deletar).
- `CLAUDE.md` regra 2: a linha "Editor de campos por etapa" aponta
  `StageFieldEditorModal.jsx`/`RHStageFieldEditorModal.jsx` — ambos deletados;
  atualizar pra `src/components/shared/stage-editor/` (1 padrão, não 2).

### P1.6 `StageFixedFields` → seeds configuráveis (M)
- `RHRecrutamentoView.jsx:1000-1052`: `VAGA_STAGE_FIELDS`/`CANDIDATO_STAGE_FIELDS`
  hardcoded por stage_key literal, convivendo com o sistema configurável e
  gravando no MESMO `custom_fields` — some se renomearem a etapa.
- **Correção**: migrar pra seeds de `rh_pipeline_stage_fields` (é dado, não
  schema) e remover `StageFixedFields`.

### P1.7 Entrega concluída avisa o solicitante (M)
- `use-marketing-deliverables.js:15/:50`: deliverable só carrega
  `requester_name` texto — sem `requester_email`/`request_id`, o solicitante
  nunca sabe que a entrega ficou pronta (elo quebrado da jornada 2).
- **Correção**: carregar `requester_email` (ou `request_id`) da
  marketing_request no RPC `approve_marketing_request` (VERIFICAR se exige
  coluna nova em `marketing_deliverables` — se sim, schema: confirmação do
  Daniel) e disparar e-mail/notificação na etapa terminal.

### P1.8 ⌘K abre o item (P)
- `App.jsx:1784`: `onSelectCampaign`/`onSelectEmployee` só trocam de tela e
  ignoram o item clicado (leads já abrem). Fazer receber o item e abri-lo
  (ex.: setSelected da campanha), igual ao `onSelectLead`.

## P2 — Polish & guardrails (pendente)

1. **Token "on-accent" (1 item resolve 4 ocorrências)**: texto branco fixo
   sobre cor de destaque quebra no dark (`--accent`/`--warning`/`--danger`
   viram claros): `ui/StatCard.jsx:21/45`, `ui/Button.jsx:17` (primary),
   `shared/Card.jsx` GridListToggle (`#FFF` sobre accent), botão Excluir do
   dropdown de modelos em `RHRelatoriosView.jsx`. Criar `--on-accent` (light:
   `#FFFFFF`; dark: um escuro legível) em `index.css` e usar nos 4.
2. **Tokens dark no editor de etapas unificado**: `stage-editor/StageListManager.jsx:168`
   (`#FFFBEB/#FDE68A/#92400E` → `--warning-bg`/`--warning`), `:286/:315` +
   `StageAdvancedModal.jsx:229` + `StageConditionsModal.jsx:160/170`
   (`#B91C1C`/`#FEF2F2` → `--danger`/`--danger-bg`),
   `StageColorPicker.jsx:33` (`#1E40AF` → `var(--accent)`).
3. **`PipelineChatPanel.jsx:99-291`**: `#FFFFFF`/`#E5E7EB` fixos — painel
   branco no dark; trocar por `var(--surface)`/`var(--border)`.
4. **Chip de SLA de Campanhas ilegível no dark**: `KanbanCardStatusChips.jsx:19`
   fundo `#FEE2E2` fixo + `CampaignKanbanCard.jsx:97` passa `var(--danger)`
   (claro no dark) — padronizar os 4 cards e usar `--danger-bg`/`--danger`.
5. **`window.confirm`/`alert` → padrão estilizado (26 arquivos, gradual)**:
   ex. `RHBemEstarView.jsx:211`, `RHComunicacaoView.jsx:497`,
   `DespesasView.jsx:828`, `RHCargosView.jsx:153/615`,
   `RHFuncionariosView.jsx:310/319`, `UserManagementView.jsx:273/287/298`, e
   os `alert()` remanescentes de `RHFeriasView` (caminhos de erro do
   confirmarRecusa + fallback onBlocked). Idioma: confirmação inline tipo
   `MoveStageMenu.jsx:120-135` pra exclusão; `AppToast` pra erro.
6. **"R$" duplicado**: `LeadDetailDrawer.jsx:853` label "Valor (R$)" com
   `formatBRL` (vira "Valor (R$) R$ 380") e `CampaignDetailDrawer.jsx:1295`
   idem com `formatK` — tirar o "(R$)" do label nas linhas de leitura.
   `RHFuncionariosView.jsx:1121`: salário com `toLocaleString` manual →
   `formatBRL` (importar de `utils/currency`).
7. **`guardedClose` nos modais de Entrega/Tarefa**: `EntregasView.jsx:181-184`
   e `MarketingTarefasView.jsx:119-122` fecham no clique-fora descartando o
   formulário — aplicar o snapshot+confirmação do CreateModal de Compras
   (`ComprasMarketingView.jsx:186+`).
8. **Miudezas confirmadas**: contadores do header de Recrutamento ignoram o
   filtro de frente (`RHRecrutamentoView.jsx:3059-3061` — contar sobre a lista
   filtrada); "em 4 empresas" fixo (`DashboardView.jsx:131` →
   `COMPANY_IDS.length`); `comexstat/index.ts` devolve 200 em erro (:20/:35/:39/:91/:98/:110
   → 400/502) e sem auth em código (adicionar gate JWT igual às irmãs — idem
   `cnpj-lookup`); rótulo "anônimas" fixo em pesquisa identificada
   (`RHComunicacaoView.jsx:297` — condicionar ao `pesquisa.modo` e, se
   identificada, mostrar respondente); fallback `[]` truthy
   (`MarketingView.jsx:451/:613` → `stages?.length ? stages : MARKETING_STAGES`;
   conferir o mesmo padrão em `EntregasView`); camelCase×snake_case misturados
   em `use-my-tasks.js` (padronizar saída dos hooks ou anotar JSDoc).
9. **Fechar task #208 (Compras→Cotação)**: causa raiz histórica já corrigida
   por migrations (CHECK sem 'cotacao' + overload órfão); só confirmar que a
   migration 20260751 foi aplicada em TODOS os ambientes (767/769 têm
   comentário de aplicadas; 751 não tem).

## Backlog registrado pelos QAs desta sessão (menor prioridade)

- Guard "já concluída" no retry de Concluir avaliação (evita efeito duplicado
  de notificação no retry após falha de movimentação).
- Bulk de candidatos não intercepta etapa `lost` (o individual abre modal de
  motivo; o bulk move direto) — gap pré-existente.
- Toggles de notificação sem gerador (stale_lead, cross_sell, weekly_digest,
  new_candidato…) seguem sem efeito — decidir: implementar geradores ou marcar
  "em breve" na UI (o achado da auditoria aceitava as duas saídas).
- `Tabs` compartilhado sem roving tabindex/navegação por setas; checkbox de
  header da tabela de Funcionários sem estado `indeterminate`; checkboxes de
  linha sem `aria-label` individual; skeleton de card aparece na aba Contratos
  de Fornecedores durante loading (cosmético).
- Achados sem veredito adversarial que NÃO foram corrigidos nem refutados
  (verificar antes de implementar): camelCase×snake_case em `use-my-tasks.js`
  (P2.8) e fallback `[]` truthy (P2.8) — os outros cinco pendentes já foram
  corrigidos no P0 ou confirmados por evidência independente.

## Pendências que dependem do Daniel (não decidir sozinho)

1. **P1.4 Compras**: migrar pro modelo configurável (schema novo) ou
   documentar como exceção intencional.
2. **Validação visual dos pilotos do Padrão C** (Fornecedores RH + Relatórios,
   prints já enviados) → libera propagar o padrão pra Cargos, Gestão de
   Usuários, Sinais, Tutoriais e Fornecedores Marketing (spec
   `docs/design-spec-padroes-de-pagina.md`, seção 6 passo 5).
3. **Toggles sem gerador** (acima): implementar ou "em breve".
4. Qualquer item de P1/P3/P1.7 que exija coluna/tabela nova (schema — regra 5).
