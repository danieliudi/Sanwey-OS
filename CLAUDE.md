# sanwey-gestão — padrão de consistência

Este arquivo é carregado automaticamente em toda sessão do Claude Code neste repo.
Ele existe pra resolver um problema específico: retrabalho recorrente tentando
padronizar a plataforma depois que a inconsistência já foi construída. A partir
de agora, qualquer sessão que mexer em UI/UX segue isto **antes** de escrever
código, não depois.

Duas categorias de regra abaixo: **reaproveitamento obrigatório** (nunca
reimplementar algo que já existe) e **processo de revisão** (design → frontend
→ QA, mais Segurança quando aplicável — ver 3.1) pra tudo que for genuinamente
novo. Reaproveitamento evita retrabalho por construção; revisão pega o que não
dá pra generalizar.

---

## 1. Reaproveitamento obrigatório — nunca reimplemente do zero

Antes de escrever qualquer coisa relacionada a Kanban, formulário por etapa, ou
badge/token visual, confira esta lista. Se o que você precisa já existe aqui,
**importe — não copie o padrão nem reescreva parecido**.

Confirmado via grep de uso real no código (não é aspiracional):

| Item | Arquivo | Onde já é usado |
|---|---|---|
| Scrollbar de colunas nunca sai da tela | `src/hooks/use-available-height.js` | 9 boards (Pipeline, Marketing, Entregas, Compras, 5 de RH) |
| Botão flutuante de criar card | `src/components/shared/KanbanFab.jsx` | mesmos 9 boards |
| Menu "mover pra etapa / excluir" do card | `src/components/shared/MoveStageMenu.jsx` | Pipeline, Campanhas, Entregas, Compras, todos os boards de RH — já é o componente mais universal da plataforma |
| Campos condicionais/obrigatórios por etapa (mostrar/ocultar/exigir) | `src/utils/field-conditions.js` | 17 arquivos |
| Validação de formato de campo (CNPJ, e-mail, telefone, valor) | `src/utils/field-validation.js` | junto com o acima |
| Badge de comentário não lido | `src/lib/comment-badge.js` | 9 arquivos |
| "Visto por último" / marcar como lido | `src/hooks/use-record-views.js` | 9 arquivos |
| Empilhar avatares de responsáveis | `src/components/shared/AvatarStack.jsx` | 7+ arquivos |
| Formatação de moeda (`formatK`, `formatBRL`) | `src/utils/currency.js` | `formatK`/`formatBRL` já incluem o "R$ " — nunca concatene "R$ " na frente do resultado (foi um bug real, corrigido) |
| Formatação/cálculo de data (`formatDateBR`, `daysSince`, `closeDateUrgencyStyle`) | `src/utils/date.js` | idem |
| Debounce de refetch em `postgres_changes` | `src/utils/debounce.js` | todo hook que assina Realtime |
| Editor de campos por etapa (CRM e RH, um único componente) | `src/components/shared/stage-editor/StageFieldsPanel.jsx` (+ `CRMStageFieldsPanel.jsx`/`RHStageFieldsPanel.jsx` e demais arquivos da pasta) | Pipeline e todos os boards de RH — `StageFieldEditorModal.jsx`/`RHStageFieldEditorModal.jsx` (duas versões separadas, citadas em versões antigas deste arquivo) já foram deletados |
| Título editável do card (lápis sempre visível, não só no hover — funciona em touch) | `src/components/shared/EditableTitle.jsx` | Campanhas, Entregas, Tarefas, Compras (`CampaignDetailDrawer`/`DeliverableDetailDrawer`/`MarketingTaskDetailDrawer`/`PurchaseRequestDetailDrawer`) — padrão da plataforma pra título de card, decidido com o Daniel 29/07/2026. **Funil de Vendas fica de fora por ora**: em `LeadDetailDrawer.jsx` o "título" é o Cliente vinculado (dedup por CNPJ via `ClientSelector`/`ClientQuickCreateModal`), não um texto solto — aplicar `EditableTitle` ali direto ignoraria o dedup. Não aplicar sem decidir antes como isso se encaixa. |
| Tooltip (ícone "?" com texto explicativo) | `src/components/ui/HelpTooltip.jsx` | Extraído 31/07/2026 — era o mesmo SVG copiado 3x (`StatCard.jsx`, `CurrencyInput.jsx`, `CampaignDetailDrawer.jsx`'s `Field`), passou do limite da regra 4. Uso: `<HelpTooltip text={...} />` (prop `size` opcional, default 13). **Não é pra todo hint** — reservado a explicar um conceito/label que não tem elemento próprio pra segurar o hint (rótulo de `StatCard`, campo de formulário). Hint de um elemento que já existe (botão, ícone, texto truncado) continua usando `title="..."` nativo do HTML — é o padrão de facto pra isso (~90 ocorrências), não precisa do ícone dedicado. |
| Toast (notificação temporária) | `src/components/shared/AppToast.jsx` | 8+ telas de Kanban (erro de transição de etapa) + update de versão/novidades no `App.jsx`. `variant="default"` (neutro) ou `variant="danger"` (erro) — cores via token (`--danger`/`--danger-bg`), nunca hex solto. `ChangelogToast.jsx` é variante deliberadamente separada (toast de "Novidades" tem timing/gatilho diferente, documentado no próprio arquivo) — não é duplicação. `alert()`/`window.confirm()` nativos ainda aparecem em ~15 arquivos como fallback onde não há slot de banner pronto — débito conhecido, não migrar de supetão só por existir; ao tocar uma dessas telas por outro motivo, prefira migrar pro `AppToast`/modal de confirmação compartilhado em vez de manter o nativo. |

**Tokens de design (CSS custom properties, `src/index.css`)** — 74+ arquivos já
usam `var(--accent)`; nunca hardcode hex novo pra estado que já tem token:

- `--accent` = cor de ação/marca, **muda por frente comercial em runtime**
  (`COMPANIES[companyId].primary`) — nunca usar pra sinalizar erro/obrigatório
  (já foi bug real: ficava verde na Resibag).
- `--danger` / `--danger-bg` = erro / bloqueio de input do usuário.
- `--warning` / `--warning-bg` = precisa de atenção/configuração (não é
  responsabilidade de quem preenche o formulário resolver).
- `--amber` / `--amber-bg` = urgência intermediária (SLA a 70%+, vencimento
  próximo).
- `--text`, `--text-dim`, `--border`, `--surface`, `--surface-alt` = neutros
  padrão, com variante dark mode automática.

**Padrão de exclusão em toda página "Fornecedores"** — decidido com o Daniel
31/07/2026: referência canônica é `src/components/views/FornecedoresView.jsx`
(Marketing) — ícone `Trash2` no slot `menu` do `Card` compartilhado (canto
superior direito do card na grade), abrindo um `ConfirmDeleteModal` construído
sobre o `Modal` compartilhado (`src/components/ui/Modal.jsx`), com botões
"Cancelar"/"Excluir" (`Excluir` em `var(--danger)`). `RHFornecedoresView.jsx`
já segue este padrão (só o texto do corpo do modal muda por página, pra
refletir o que realmente é perdido — em RH, contratos e histórico de eventos
somem junto via `ON DELETE CASCADE`; em Marketing, cotações já enviadas
continuam no histórico). Só existem 2 páginas de Fornecedores hoje
(Marketing/RH) — por isso isto é uma convenção escrita, não um componente
`shared/` extraído: regra 4 abaixo só manda extrair na 3ª ocorrência real. Se
uma 3ª página de Fornecedores nascer, é o momento de extrair
`ConfirmDeleteModal` (e o botão de lixeira no `menu`) pra `shared/` — antes
disso, qualquer página nova de Fornecedores replica a estrutura acima
olhando `FornecedoresView.jsx`, não inventa variante própria.

## 2. Duplicação conhecida — famílias paralelas (não crie uma terceira)

Estes pares **parecem** compartilhados mas na verdade são duas implementações
lado a lado — uma pra CRM/Pipeline, outra pra RH. Não é mentira dizer que
"existe um padrão", mas hoje são 2 padrões, não 1:

| Conceito | Versão CRM | Versão RH |
|---|---|---|
| Input de campo customizado | `src/components/lead/StageFieldInput.jsx` | `src/components/rh-pipeline/RHStageFieldInput.jsx` (switch de tipos idêntico, copiado) |
| Card do Kanban | `src/components/lead/LeadKanbanCard.jsx` (só Pipeline) | `src/components/rh-pipeline/RHKanbanCard.jsx` (5 boards de RH) — Marketing/Entregas/Compras têm card próprio, inline, nenhum dos dois |
| Acordeão mobile do board | não existe pro Pipeline | `RHMobileKanbanAccordion.jsx` (só RH) |
| Shell do drawer de detalhe (3 painéis) | `LeadDetailDrawer.jsx` monta tudo à mão | `RHDetailDrawerShell.jsx` (6 telas de RH) |

**Regra pra quando for mexer em qualquer um desses**: decida explicitamente se
o que você está construindo se parece mais com a família CRM ou a família RH,
e siga essa — nunca crie uma terceira variante do zero. Se perceber que está
prestes a copiar o mesmo trecho pela 3ª vez (ex.: um módulo novo que não é nem
CRM nem RH), é o sinal de extrair pra `shared/` — ver regra 4.

**Exceção deliberada, não migrar sem perguntar antes**: Compras
(`ComprasMarketingView.jsx`) mantém seu próprio modelo hardcoded de etapas
(`PURCHASE_STAGES`) em vez do `rh_pipeline_stages` configurável usado no resto
da plataforma (regra 5). Isso foi decisão explícita, não descuido — as
transições de etapa de Compras são fortemente acopladas a RPCs de aprovação, e
migrar pro modelo compartilhado significaria reconstruir esse motor sem ganho
funcional. Não tente "arrumar" isso proativamente.

## 3. Processo obrigatório pra qualquer mudança de UI/UX genuinamente nova

**Mockup antes de mexer em produção.** Decidido com o Daniel em 28/07/2026,
reforçado em 28/07/2026 ("Me mostre Mockup para TUDO"): qualquer sugestão de
mudança que altere algo **visualmente e/ou estruturalmente** na plataforma —
reposicionar item de menu, redesenhar um componente, mudar layout de
card/drawer, alterar como um dado é organizado na tela — precisa ser mostrada
como mockup (Artifact ou imagem) **antes** de qualquer implementação, pra
aprovação explícita do Daniel. Vale tanto pra pedido espontâneo do Daniel
quanto pra sugestão proativa da sessão. Na dúvida se algo conta como mudança
visual/estrutural, o padrão é mostrar mockup — não decidir sozinho que "é
pequeno o bastante pra pular". Bug fix puro (algo que já deveria funcionar e
não funciona — filtro vazio que devia listar opções, etapa que não aparece
onde deveria) não precisa de mockup por não mudar nada visível que já não
fosse esse o comportamento esperado; mudança de como algo se parece ou se
organiza, sempre precisa, mesmo que pareça pequena ou reaproveite um
componente já existente.

Pra tudo que não está nas listas acima (regra de negócio nova, tela nova,
campo/comportamento específico do departamento) — siga o fluxo de 3 papéis
abaixo. Não pule etapas mesmo em mudanças que pareçam triviais: os bugs de
"R$ R$" duplicado e validação prematura pareciam pequenos e só foram pegos
porque passaram pelo QA.

1. **Design** — antes de escrever código de produção, escreva uma spec
   objetiva (arquivo:linha do problema, tokens exatos a usar reaproveitando os
   já existentes acima, comportamento por estado). Se houver decisão
   subjetiva, registre as opções e qual foi escolhida — nunca apresente uma
   escolha subjetiva como única resposta possível.
2. **Frontend** — implementa a menor mudança que resolve a causa raiz, seguindo
   a spec ao pé da letra (não decide token/cor por conta própria). Roda
   `npx vite build` antes de reportar pronto.
3. **QA** — não corrige código diretamente, só aprova ou devolve com
   `arquivo:linha — o que está errado — o que deveria ser`. Roda o build de
   novo, confere contra a spec, e verifica que nenhuma classe de bug já
   conhecida foi reintroduzida (duplicação de "R$", validação antes de
   interação, campo sem opções configuradas renderizando vazio, saudação/
   rascunho de IA com variável ausente, guardrail de transição de etapa
   ignorado).
4. **Segurança** (`security-agent`, condicional — só entra quando a mudança
   toca schema/migration, RLS, Storage, edge function, ou qualquer rota de
   escrita/autenticação) — ver 3.1 pro checklist completo.

Se estiver rodando como sessão do Claude Code, os quatro papéis já existem
como sub-agentes em `.claude/agents/design-agent.md` / `frontend-agent.md` /
`qa-agent.md` / `security-agent.md` (local ao ambiente, fora do Git) — use-os
via `Agent`/`Task`. Se não estiverem disponíveis na sessão, siga a sequência
acima manualmente.

### 3.1 QA multi-lente (mudança não-trivial) e o papel de Segurança

Decidido com o Daniel em 03/08/2026, depois de uma entrega real (vínculo
Despesas↔Entregas/Tarefas) onde a checagem de segurança da RLS nova
(comparar contra o predicado já em produção na tabela-irmã, rodar
`get_advisors` depois da migration) foi feita à mão pelo orquestrador em vez
de ser parte formal do processo — daqui pra frente isso é regra, não
lembrete pontual.

**QA multi-lente** — pra mudança que não seja um ajuste cosmético isolado
(mexeu em hook/componente compartilhado, criou tabela nova, mudou RLS, mudou
fluxo de autenticação/aprovação), rode o QA como 2-3 revisores independentes
em paralelo, cada um com uma lente diferente, em vez de uma passada única:
fidelidade à spec (o que o `qa-agent` já faz), correção funcional/
não-regressão, e uma passada adversarial que assume por padrão que tem
problema e só aprova se não achar nenhum caso de borda que quebre. Só
aprove se a maioria concordar. Isso custa mais tempo/tokens que uma passada
só — reserve pra mudança de risco real, não pra ajuste de 1 linha.

**Segurança (`security-agent`)** — 4º papel, acionado sempre que a mudança
tocar schema/migration nova, policy RLS nova ou alterada, bucket/path de
Storage, edge function, ou rota que aceite escrita de usuário
não-autenticado (formulário público). Roda depois do `frontend-agent`,
antes de considerar o item pronto. Só revisa (mesma regra do `qa-agent`:
aprova ou devolve achado específico `arquivo:linha`) — nunca aplica
migration nem corrige RLS direto; aplicar migration continua exigindo
confirmação explícita do Daniel (regra 5). Checklist mínimo:

- RLS habilitada em toda tabela nova (`ENABLE ROW LEVEL SECURITY`).
- Policy nova compara com o predicado já em produção na tabela-irmã mais
  próxima, não inventa um modelo de permissão do zero — foi assim que a RLS
  de `marketing_expense_deliverables`/`marketing_expense_tasks` foi
  validada, espelhando `marketing_expense_items`.
- Isolamento por empresa/tenant onde o dado é escopado por empresa (classe
  de bug já encontrada nesta plataforma: `clients` sem isolamento, Storage
  cross-fornecedor).
- Nenhum self-escalation — usuário alterando a própria role/aprovação via
  UPDATE na própria linha (já aconteceu em `profiles`, `rh_ferias`).
- Edge function valida JWT e autorização de papel/empresa antes de agir
  (já aconteceu edge function sem essa checagem).
- Rota pública (formulário sem login) não grava coluna arbitrária nem
  permite abuso sem limite de taxa.
- Roda `get_advisors` (Supabase MCP, tipo `security`) depois de qualquer
  migration aplicada — nenhum achado novo introduzido pela mudança.

## 4. Extração sob demanda — quando (e quando não) criar algo em `shared/`

Não construa um "motor genérico de Kanban" especulativamente — o custo de uma
abstração errada (que não captura as regras reais de cada departamento, tipo a
etapa "Removido" do Onboarding que não conta na métrica, ou o Kanban de
Treinamentos onde "criar" significa atribuir colaborador existente) é maior que
o benefício.

Regra prática: toda vez que a mesma lógica visual/estrutural (não regra de
negócio) for escrita pela **3ª vez** em módulos diferentes, extraia pra
`src/components/shared/` ou `src/hooks/` naquele momento — nunca antes, nunca
depois. Foi assim que `KanbanFab`, `useAvailableHeight` e `MoveStageMenu`
nasceram, e é o motivo de já serem universais sem ter sido um projeto à parte.

## 5. Configuração vs. código — o que já não precisa de mudança de schema

Antes de assumir que uma feature nova precisa de coluna/tabela nova, confira
se já existe como dado configurável:

- Etapas de um pipeline (nome, cor, ordem, probabilidade, SLA, terminal/
  ganho/perdido): `rh_pipeline_stages` (tabela compartilhada entre domínios,
  `domain` = "comercial" pro Pipeline, outros valores por módulo de RH).
- Campos customizados por etapa (tipo, obrigatório, condição de
  visibilidade/obrigatoriedade, validação de formato): `pipeline_stage_fields`
  (CRM) / `rh_stage_fields`-equivalente (RH).
- Transições permitidas entre etapas: `pipeline_stage_transitions` — motor já
  pronto (`usePipelineTransitions`/`isTransitionAllowed`), só precisa ser
  consultado por quem lista os destinos possíveis.
- Preview de campo do card do Kanban: `rh_pipeline_stages.card_preview_fields`.
- Automações (gatilho → ação): tabela `automations`, `module` = "crm" ou
  "marketing", `company_id` = empresa específica ou "all".

Se o que você precisa cabe em uma dessas, é dado — não código novo, e
certamente não schema novo. Mudança de schema real (nova tabela/coluna) exige
confirmação explícita do Daniel antes de aplicar, sempre.

## 6. Padrões de página — Tabela, Kanban, Cards

Decidido com o Daniel em 23/07/2026 — spec completa, com `arquivo:linha` de
cada achado e a especificação visual por estado, em
`docs/design-spec-padroes-de-pagina.md`. Três formas de mostrar dados que se
repetem pela plataforma; página nova (ou reescrita) que for fundamentalmente
uma dessas três **segue o padrão do doc, não inventa uma variante**:

| Padrão | Referência | Quando usar |
|---|---|---|
| Tabela com filtro | `RHFuncionariosView.jsx` | lista de registros com muitas colunas/comparação lado a lado |
| Kanban | ver regra 2 acima — já maduro, 9 boards | fluxo com etapas/estados que um registro atravessa |
| Grade de cards | novo — spec completa no doc acima | catálogo de registros (card = link) ou seletor de opções (card = checkbox) — uma variante só do mesmo componente, comportamento adaptado |

Componentes que **ainda não existem** e precisam ser extraídos antes de
migrar qualquer página pro padrão (regra 4 — já passaram do limite de 3ª
ocorrência, diagnóstico completo no doc): `Tabs` (reescrito 4×), `FilterBar`
(busca+filtro reescrito 4×+), `Card`/`EntityCard` (grade ad hoc em 7+ telas).
Adotar também o `Modal.jsx` já existente (`src/components/ui/Modal.jsx`, 0
usos confirmados hoje) em vez de overlay `position:fixed;inset:0` na mão.

Decisões já fechadas com o Daniel (não reabrir sem motivo novo — ver "Notas
de decisão" no doc pra racional completo): densidade de card é toggle
grade/lista controlado pelo usuário, não fixo por página nem única pra tudo;
faixa de resumo (`StatCard`) no topo de toda página de catálogo com métrica
óbvia; catálogo e seletor são uma variante só do mesmo componente de card.

## 7. Nunca pausar por mensagem que chega no meio do trabalho

Instrução do Daniel (28/07/2026), permanente pra toda sessão futura: quando
uma mensagem nova chegar **no meio** de um trabalho já em andamento, a sessão
nunca para o que está fazendo nem pausa esperando confirmação. Duas opções,
na ordem de preferência:

1. Se der pra paralelizar (agente em background, ou uma edição rápida e
   independente que não conflita com o que já está em andamento — como
   atualizar este próprio arquivo), fazer em paralelo, sem soltar o fio do
   que já estava em curso.
2. Se não der pra paralelizar sem risco de conflito, colocar o pedido na fila
   e continuar o trabalho atual até um ponto de corte natural, aí sim tratar
   o que chegou.

Isso vale pra qualquer mensagem nova — pedido de feature, bug reportado,
pergunta — não só pra itens já enfileirados explicitamente como "faça em
paralelo". Só interromper de verdade quando a mensagem for uma correção de
rumo do que já está em andamento (ex.: "não, faça diferente") ou pedir
explicitamente pra parar.

## 8. Conta de teste conhecida — não é incidente de segurança

`teste@sanwey.com.br` é uma conta fake/mockup criada de propósito (sem caixa
de entrada real por trás) — não é um usuário real esquecido nem uma conta
comprometida. Se aparecer em log de autenticação (ex.: pedido de redefinição
de senha, tentativa de login), **não é sinal de invasão** e não precisa virar
investigação — mas também ainda não foi limpa do sistema, então fica
documentado aqui até alguém decidir removê-la ou trocar por um endereço mais
claramente fake (ex.: `naoresponder@sanwey.com.br`). Não construir automação
nem depender dela existir.

## 9. Painel Executivo tem que acompanhar a plataforma inteira

Instrução do Daniel (29/07/2026), permanente: o Painel Executivo
(`src/components/views/ExecutiveDashboard.jsx`, rota `executive`) é o único
lugar que presidência/diretoria olha pra ter visão do Grupo inteiro — não
pode ficar defasado. **Toda vez que um departamento, Kanban ou domínio de
dado novo nascer na plataforma, adicionar uma seção correspondente no Painel
Executivo faz parte de "pronto" pra esse trabalho, não é item de backlog
separado.**

Auditoria de 29/07/2026 encontrou o painel cobrindo só Comercial (Funil de
Vendas, com detalhe completo) + Marketing + RH (cartão-resumo simples cada)
— Compras, Comex, Pós-venda, CRM Viagens, Treinamentos e vários outros
domínios não tinham nenhuma seção lá. Mockup mostrado e aprovado (spec
completa nesse commit): "Visão geral" virou uma faixa de saúde por área
(1 número + 1 sinal de alerta cada), e cada área ganhou sua própria aba de
profundidade — mesmo padrão que Comercial já usava (Gráficos/Análise/
Histórico), agora generalizado. **Departamento novo = uma aba nova + uma
entrada na faixa de saúde, nunca um redesign da grade.** Visibilidade por
usuário continua via `EXECUTIVE_WIDGETS` em `src/constants/user-settings.js`.

Isso é uma mudança visual/estrutural (rule 3 se aplica: mockup antes de
implementar) — mas a lacuna em si (departamento existir na plataforma e não
ter aba no Executivo) não precisa ser redescoberta a cada auditoria: se um
módulo não tem entrada na faixa de saúde + aba própria, está incompleto até
ganhar uma.

## 10. Toda entrega termina com changelog + versão — nunca só o merge

Achado de 30/07/2026: o toast "Novidades" (`useChangelogNotice`) e o aviso
de nova versão disponível (`use-app-update.js`) só disparam quando
`package.json.version` muda — comparam contra `CHANGELOG[0].version`
(`src/data/changelog.js`). Uma sessão inteira de trabalho real (RLS,
Painel Executivo, título editável, Compras, etc.) foi mergeada na main sem
bump nenhum: o toast simplesmente não tinha nada de novo pra detectar,
mesmo com dezenas de mudanças reais no ar. Não é um bug de código — é um
passo que faltou em "pronto".

**Daqui pra frente, mergear na main não é o último passo de uma entrega
com impacto pro usuário final** (feature nova, fix de comportamento
visível, mudança de fluxo) — os dois itens abaixo fazem parte de "pronto",
não são follow-up:

1. Adicionar uma entrada no topo de `CHANGELOG` (`src/data/changelog.js`)
   — mesmo tom das entradas existentes: frase curta, o que mudou pro
   usuário, sem jargão técnico. Bump de `version` em `package.json`
   (semver simples: patch pra fix pontual, minor pra feature) — sem os
   dois juntos o toast não dispara pra ninguém.
2. Avaliar se a mudança merece entrar em Ajuda & Tutoriais
   (`src/data/tutorials.js`, `TutoriaisView.jsx`) — nem toda entrada de
   changelog vira tutorial (um fix de bug não precisa), mas uma feature
   nova que muda como alguém faz uma tarefa (ex.: reordenar o menu,
   escolher destino de uma solicitação) geralmente merece um guia rápido
   ali. Registrar a decisão (adicionou ou não, e por quê) não precisa de
   mockup separado — só não pular a pergunta.

Mudança interna sem nada visível pro usuário (migration de reconciliação,
script de teste, refactor) não precisa de changelog — o critério é "alguém
que usa a plataforma notaria essa mudança?".
