# AUDITORIA "ZERO BULLSHIT" — sanwey-gestão
**23/07/2026 · 12 auditores (Opus) + verificação adversarial de cada achado · 52 achados brutos → 43 confirmados no código real, 2 refutados, 7 sem veredito final (verificador interrompido por limite de sessão; 2 destes confirmados por evidência independente)**

---

## 1. EXECUTIVE SUMMARY & HEALTH SCORE

**Health Score: 74/100.** O núcleo funciona: CRUD dos 10 Kanbans persiste, RLS e segurança já passaram por 3 auditorias anteriores (zero achado crítico novo), e o redesign/editor unificado recentes saíram sem regressão funcional. O que derruba a nota: **8 achados de severidade alta**, uma família de **ghost features** (UI que promete e não entrega) e a recorrência de um mesmo padrão estrutural — cada caminho paralelo de escrita reimplementa (ou esquece) as regras de negócio.

**Top 3 Critical Bottlenecks:**

1. **Mudança de etapa tem N caminhos e nenhum guardrail central.** O drag-and-drop respeita a matriz de transições e os campos obrigatórios; o dropdown "Etapa do funil" do drawer ignora os dois e ainda oferece etapas que nem existem mais (grava etapa fantasma e o card **some do board**); o CTA mobile "Avançar" fura a matriz; o bulk do Recrutamento fura a validação de campos; o board de Compras aprova sem fornecedor vencedor. Cada superfície nova esquece um gate diferente porque a regra não mora num lugar só.
2. **Escritas críticas falham em silêncio — a UI mente sucesso.** Salvar etapas do CRM reporta sucesso mesmo com gravação falha; o e-mail com o link do gestor externo falha e o RH acha que enviou; a movimentação de promoção com aumento salarial falha só no console. O usuário confia no que a tela diz, e a tela não diz a verdade.
3. **Configuração à frente do consumo (ghost features).** ~30 toggles de Notificações que nada lê; automações de Marketing que aceitam 6 tipos de ação e descartam 5; badge de automação que grava e nunca aparece; campos por etapa do Pós-venda que o gerente configura e ninguém nunca vê.

**Ghost Feature Index: 8** elementos visuais não-funcionais ou enganosos (detalhados na matriz).

| | bug | fluxo | ghost | conformidade | ux | código | **total** |
|---|---|---|---|---|---|---|---|
| **Alto** | 3 | 3¹ | 2 | 1 | — | — | **9** |
| **Médio** | 7¹ | 6¹ | — | 5¹ | 3 | 3² | **25** |
| **Baixo** | 4¹ | 1¹ | 1 | 7 | 2 | 1 | **16** |

¹ inclui achados pendentes de veredito (marcados ⚠ abaixo) · ² inclui 1 pendente. Total: 43 confirmados + 7 pendentes.

---

## 2. THE RUTHLESS BUGS & GHOST FEATURES MATRIX

Status: **Ghost** = 100% fake · **Broken** = tenta e falha · **Partial** = funciona pela metade. ⚠ = verificação adversarial não concluiu (limite de sessão); ✓ = confirmado por verificador independente lendo o código.

| Arquivo/Linha | Elemento | Comportamento esperado | Status | Causa raiz |
|---|---|---|---|---|
| `src/components/lead/LeadDetailDrawer.jsx:1122` ✓ | Select "Etapa do funil" | Listar as etapas reais da empresa | **Broken** (ALTO) | Usa `DEFAULT_PIPELINE_STAGES` estático (l.36); renomes/adições do editor não aparecem; etapa removida ainda é selecionável → grava stage inexistente e o card some do Kanban |
| `src/components/lead/LeadDetailDrawer.jsx:448` ✓ | Mesmo Select — gravação | Respeitar matriz de transições e auto-preencher "ganho" | **Broken** (ALTO) | `handleStageChange` não consulta `isTransitionAllowed` nem aplica `mergeGanhoDefaults` — único caminho que fura os dois; corrompe métricas do Executivo |
| `src/components/views/AnalyticsTab.jsx:17` ✓ | Aba Análise do Executivo, período "60 dias" | Filtrar leads dos últimos 60 dias | **Broken** (ALTO) | `filterByPeriod` não tem ramo `'60d'` → cutoff `undefined` → todos os gráficos zeram |
| `src/components/views/SettingsView.jsx:951` ✓ | ~30 toggles de Notificações | Ligar/desligar cada alerta | **Ghost** (ALTO) | `settings.notifications` é gravado mas **nenhum** gerador de notificação lê — toggles não têm efeito algum |
| `src/components/views/MarketingView.jsx:710` ✓ | Automações módulo Marketing | Executar mover etapa, set de campo, badge, etc. | **Ghost** (ALTO) | `fireAutomations` descarta os `patches` — só a ação "notificar" funciona; as outras 5 são aceitas no builder e jogadas fora |
| `src/components/lead/LeadKanbanCard.jsx:110` ✓ | Ação de automação "Adicionar badge" | Etiqueta visual no card | **Ghost** (ALTO) | Grava `lead.badges` no banco; nenhum card do Kanban renderiza — só o `LeadCard.jsx` morto (sem importador) tinha a marcação |
| `src/hooks/use-rh-manager-links.js:56` ✓ | "Encaminhar ao gestor" (triagem externa) | E-mail enviado ao gestor, ou erro visível | **Partial** (ALTO) | Falha do `rh-send-email` vira `emailSent:false` que o modal ignora — fecha como sucesso, link não é recuperável na UI |
| `src/components/lead/StageFieldInput.jsx:44` ✓ | Inputs de campo customizado (CRM) no dark mode | Acompanhar o tema | **Broken** (ALTO) | `#FFFFFF`/`#D1D5DB` hardcoded em vez de `var(--surface)`/`var(--border-strong)` — inputs brancos no tema escuro |
| `src/hooks/use-my-tasks.js:255` ⚠ | "Aguardando aprovação" (Minhas Tarefas) | Mostrar compras pendentes de decisão | **Partial** (ALTO) | Filtra só `solicitado`; o drawer e a RPC tratam `cotacao` como pendente também — justamente onde o gerente compara fornecedores |
| `src/hooks/use-pipelines.js:176` ✓ | Salvar "Editar etapas" do CRM | Erro visível se a gravação falhar | **Partial** (MÉDIO) | `replacePipeline` engole `hadError` — modal fecha com sucesso falso e o estado reverte sozinho depois |
| `src/components/views/RHFeedbackView.jsx:1294` ⚠ | Fechar avaliação "promovido" c/ aumento | Criar movimentação p/ diretoria aprovar | **Partial** (MÉDIO) | `createMovimentacao` em try/catch de `console.error` — promoção some sem aviso |
| `src/components/views/ComprasMarketingView.jsx:628` ✓ | Mover Cotação→Aprovado pelo board/menu | Exigir fornecedor vencedor (como no drawer) | **Partial** (MÉDIO) | `attemptStageChange` chama `approvePurchase` sem `p_supplier_id` — pula o gate que o drawer torna obrigatório |
| `src/components/views/PosVendaView.jsx:551` ✓ | Gear "Editar fase" do Pós-venda | Campos configurados aparecem no card/form | **Ghost** (MÉDIO) | Nada no Pós-venda renderiza/persiste os campos — config morta sem aviso |
| `src/hooks/use-notifications.js:78` ✓ | "Follow-up para hoje" | Notificar todos os responsáveis | **Partial** (MÉDIO) | Filtra por `l.owner ===` (dono principal); co-responsáveis (`ownerIds`) nunca recebem |
| `src/hooks/use-app-update.js:32` ✓ | Toast "Nova versão" após dismiss | Reaparecer na PRÓXIMA versão | **Broken** (MÉDIO) | `dismissedAt` nunca reseta — fechar uma vez silencia updates pra sempre (contradiz o próprio comentário do hook) |
| `src/utils/field-validation.js:100` ✓ | Validação na troca de etapa | Validar só campos visíveis | **Broken** (MÉDIO) | `getInvalidFields` itera a lista crua (sem `resolveVisibleFields`) — campo oculto inválido trava a transição sem correção possível na tela |
| `src/components/views/RHRecrutamentoView.jsx:3279` ✓ | Bulk "Mover para…" de candidatos | Mesma validação dos outros caminhos | **Partial** (MÉDIO) | `bulkMoveStage` faz update direto sem `getMissingRequiredFields`/`getInvalidFields` |
| `src/hooks/use-rh-treinamentos.js:114` ✓ | Colaborador desmarca treinamento | Não perder dado do RH | **Broken** (MÉDIO) | Voltar pra "pendente" zera `certificado_url` sem confirmação |
| `src/components/views/RHTreinamentosView.jsx:1427` ✓ | Conformidade % de NRs | Refletir conclusão comprovada | **Partial** (MÉDIO) | Colaborador autodeclara NR concluída sem certificado e a métrica conta como conforme |
| `src/App.jsx:1784` ✓ | ⌘K: resultado de campanha/funcionário | Abrir o item clicado | **Partial** (BAIXO) | Handlers só trocam de tela e ignoram o item (leads já abrem certo) |
| `src/components/views/MarketingView.jsx:451` ⚠ | Fallback de etapas do board/análise | Cair em `MARKETING_STAGES` se vazio | **Partial** (BAIXO) | `(stages \|\| MARKETING_STAGES)` — `[]` é truthy; hoje mascarado pelo gate de loading |
| `supabase/functions/comexstat/index.ts:20` ✓ | Erros da function comexstat | Status HTTP de erro | **Broken** (BAIXO) | Todos os caminhos de erro devolvem 200 |

Outros achados de severidade média/baixa (conformidade, UX, consistência e código morto) estão na seção 3 e no Battle Plan — não são "broken", são drift.

**Refutados pela verificação adversarial (2):** "etapas publicada/encerrada hardcoded vs. editor" e "solicitação de compra entra sem avisar ninguém" — ambos caíram quando o verificador leu o código atual. **Sem veredito (5 além dos ⚠ acima):** guardrail centralizado no `attemptStageChange` do CRM (defesa em profundidade, não explorável hoje), camelCase/snake_case misturados no `use-my-tasks.js`, e 2 que eu confirmo por evidência própria desta sessão: hex hardcoded no editor unificado novo (o QA da entrega já tinha apontado) e Compras como último board fora do modelo configurável (constatado na exploração de schema).

---

## 3. ARCHITECTURAL DRIFT & STANDARDIZATION PLAN

### Shared Primitive Strategy — o que JÁ existe vs. o que falta

O caminho até `<StandardKanban/>`, `<StandardTable/>` e `<StandardFormBuilder/>` **não parte do zero** — a plataforma já consolidou muito, e a regra do repo (CLAUDE.md §4: extrair na 3ª repetição, nunca motor especulativo) continua sendo o critério certo. Avaliação fria:

**`<StandardKanban/>` — ~80% existente.** `KanbanColumnHeader` + `KanbanBoardHeader` + `KanbanBoardScrollArea` + `KanbanFab` + `MoveStageMenu` + `useAvailableHeight` + `rh_pipeline_stages` (11 domínios) + editor unificado `stage-editor/` já cobrem 10 boards. Faltam exatamente **2 retardatários**:
- `MarketingTarefasView.jsx` — único board com o chrome antigo (fade na borda, banda 8px, uppercase). Migração mecânica, sem risco.
- `ComprasMarketingView` — último mini-motor próprio (`PURCHASE_STAGES`/`STAGE_COLORS`/transições à mão). Migrar para `rh_pipeline_stages` (domain `compras`) + `pipeline_stage_transitions` **exige schema/dado novo → decisão sua antes** (regra 5). Alternativa honesta: manter hardcoded de propósito (as transições são acopladas a RPCs de aprovação) e documentar como exceção intencional no CLAUDE.md.

**`<StandardFormBuilder/>` — o motor existe, os INPUTS estão bifurcados.** `field-conditions` + `field-validation` + `stage-editor/` já são um form builder configurável real. O drift está na ponta: `StageFieldInput` (CRM) vs `RHStageFieldInput` (RH) — cada um tem um pedaço certo que falta no outro (CRM tem guard de "select sem opções"; RH tem focus ring por token). Com o Pós-venda precisando consumir campos (3º uso), a regra da 3ª repetição **manda unificar agora** num `shared/StageFieldInput`.

**`<StandardTable/>` — NÃO construir agora.** As tabelas são ad-hoc, mas nenhum achado de severidade relevante veio delas. Motor genérico aqui seria exatamente a abstração especulativa que o CLAUDE.md proíbe. Reavaliar quando uma 3ª tabela repetir a mesma lógica de filtro/ordenação.

**Guardrail de etapa como motor único (novo primitivo, esse sim urgente):** a matriz de transições + validação de campos precisa morar numa função só (`attemptStageChange` canônico por domínio) que TODOS os caminhos (drag, menu, dropdown, CTA mobile, bulk) chamam. É a correção estrutural do Bottleneck #1 — hoje são 5+ reimplementações parciais.

### Deprecation List (deletar/corrigir)

| Item | Ação |
|---|---|
| 8 arquivos exportados sem nenhum importador (~790 linhas): `lead/StageFieldsEditor.jsx`, `shell/AppHeader.jsx`, `shell/NavTabs.jsx`, `lead/LeadCard.jsx` + 4 (lista no achado [32]) | **Deletar** — zero referências, build não muda |
| `VAGA_STAGE_FIELDS`/`CANDIDATO_STAGE_FIELDS` hardcoded (`RHRecrutamentoView.jsx:1000-1052`) | Migrar para seeds de `rh_pipeline_stage_fields` e remover `StageFixedFields` |
| `CLAUDE.md` regra 2, linha "Editor de campos por etapa" | Atualizar — aponta para 2 modais que não existem mais; hoje é 1 padrão (`shared/stage-editor/`) |
| Chrome Kanban legado do `MarketingTarefasView.jsx` | Substituir pelos componentes compartilhados |

---

## 4. BATTLE PLAN (P=pequeno · M=médio · G=grande)

### P0 — Blockers: destravar dado, ligar UI morta, consertar CRUD
1. **Select de etapa do drawer** usa etapas reais + matriz + `mergeGanhoDefaults` (`LeadDetailDrawer` [3 achados]) — **P/M**
2. **Guardrail central de etapa** no CRM (`attemptStageChange` consulta a matriz; CTA mobile e menu passam por ele) — **M** (estrutural, resolve 3 achados de uma vez)
3. **AnalyticsTab: ramo '60d'** — **P**
4. **Notificações: gatear cada push pelo toggle** (ou marcar a seção "em breve") — **M**
5. **Automações Marketing: aplicar patches/sideEffects** (ou restringir o builder a "notificar" no módulo marketing) — **M**
6. **Badge de automação: renderizar `lead.badges` no `LeadKanbanCard`** — **P**
7. **`replacePipeline` lança erro; modal não fecha em falha** — **P**
8. **E-mail do gestor: aviso visível quando `emailSent=false`** — **P**
9. **Minhas Tarefas: incluir compras em `cotacao`** — **P**
10. **Compras: board não aprova sem fornecedor vencedor** (abrir drawer no cotação→aprovado) — **M**
11. **`getInvalidFields` só valida campos visíveis** — **P**
12. **Toast de update: dismiss só até a próxima versão** — **P**
13. **Movimentação de promoção: erro visível** — **P**
14. **Treinamentos: não zerar certificado / NR não conta conforme sem comprovante** — **M**
15. **Follow-up notifica co-responsáveis** — **P**
16. **Bulk de candidatos valida campos obrigatórios** — **M**
17. **Férias: `nonDeletableStageKeys` + matar `alert()`/`prompt()` nativos** — **P**

### P1 — Refactor sistêmico
18. **Unificar `StageFieldInput` CRM+RH em `shared/`** (mata 4 achados de uma vez: dark mode, guard de opções, focus ring, highlight) — **M**
19. **Pós-venda consome os campos configurados** (form + drawer + `custom_fields`) — **M**
20. **Migrar `MarketingTarefasView` pro chrome compartilhado** — **M**
21. **Compras → modelo configurável** (⚠ schema novo — **decisão do Daniel antes**) ou documentar exceção — **G**
22. **Deletar os 8 arquivos mortos + atualizar CLAUDE.md** — **P**
23. **`StageFixedFields` → seeds configuráveis** — **M**
24. **Entrega concluída avisa o solicitante** (carregar `requester_email`/`request_id` no deliverable) — **M**
25. **⌘K abre o item de campanha/funcionário** — **P**

### P2 — Polish & Guardrails
26. **Tokens dark**: editor unificado (warning/danger/outline), `PipelineChatPanel`, chip SLA de Campanhas, highlights RH — **P cada**
27. **`window.confirm`/`alert` (26 arquivos) → confirmação inline/AppToast padrão** — **G** (gradual, por tela)
28. **"R$" duplicado nos labels + salário via `formatBRL`** — **P**
29. **`guardedClose` nos modais de Entrega/Tarefa** — **P**
30. Miudezas confirmadas: contadores ignorando filtro de frente, "em 4 empresas" fixo, comexstat (status HTTP + auth em código), rótulo "anônimas" em pesquisa identificada, fallback `[]` truthy, camelCase/snake_case no `use-my-tasks` — **P cada**
31. **Fechar task #208** (Compras→Cotação): causa raiz histórica já corrigida por migrations; só confirmar que a 20260751 foi aplicada em todos os ambientes — **P**

---
*Método: 12 auditores independentes (6 por área, 6 transversais: ghost features, CRUD/persistência, dívida técnica, consistência, duplicação, jornadas) rodando em Opus, cada achado submetido a um verificador cético instruído a refutá-lo lendo o código atual. Nenhum achado desta lista foi aceito sem evidência arquivo:linha. 2 achados dos auditores morreram na verificação — o filtro funcionou.*
