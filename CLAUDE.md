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

## 0. Onde está o mapa da plataforma (este arquivo não é ele)

Este arquivo é **como construir**. Ele não descreve funcionalidade nenhuma, de
propósito — e isso já causou confusão: uma sessão perguntou onde estava
documentado "pra que serve cada página, o objetivo, quais conexões precisam
estar funcionando", e a resposta era **em lugar nenhum** (conferido 03/09/2026:
zero ocorrências de "objetivo"/"serve para" aqui, e nenhuma das 58 views tem
comentário de propósito).

Agora está em **`docs/mapa-funcional.md`**: as 47 telas em 54 rotas, as 8 rotas
públicas sem login, as 3 camadas de acesso (cargo → módulo → RLS), as 30 edge
functions com os segredos que cada uma exige, e as integrações externas com o
que quebra quando cada uma cai.

Leia de lá — não repita conteúdo aqui. Se mexer em rota, tela, edge function ou
integração, atualize lá e rode `npm run doc:check` (ele recalcula as contagens
do código e falha apontando a divergência; fora do `prebuild` de propósito —
doc defasado não deve travar deploy).

---

## 1. Reaproveitamento obrigatório — nunca reimplemente do zero

Antes de escrever qualquer coisa relacionada a Kanban, formulário por etapa, ou
badge/token visual, confira esta lista. Se o que você precisa já existe aqui,
**importe — não copie o padrão nem reescreva parecido**.

Confirmado via grep de uso real no código (não é aspiracional):

| Item | Arquivo | Onde já é usado |
|---|---|---|
| Scrollbar de colunas nunca sai da tela | `src/hooks/use-available-height.js` | 13 boards (Pipeline, Campanhas, Tarefas de Marketing, Entregas, Compras, Comex, Pós-venda, Lista Pessoal, 5 de RH) |
| Botão flutuante de criar card | `src/components/shared/KanbanFab.jsx` | mesmos boards |
| Menu "mover pra etapa / excluir" do card | `src/components/shared/MoveStageMenu.jsx` | Pipeline, Campanhas, Entregas, Compras, Lista Pessoal, todos os boards de RH — o componente mais universal no nível do card do Kanban (ver `StageNavigator` abaixo pro equivalente dentro do drawer) |
| Shell de drawer de detalhe (3 colunas: header/left/center/right) | `src/components/shared/SplitPanelDrawer.jsx` | Extraído durante o rollout de 07/08/2026 (modelado no `LeadDetailDrawer` original) — hoje usado por Entregas, Campanhas, Compras, Tarefas de Marketing, Lista Pessoal, Funil de Vendas e os 6 boards de RH (via `RHDetailDrawerShell` no slot `left`). `left` colapsa atrás de "+ detalhes" no mobile; um `StageNavigator` montado dentro de qualquer slot se registra sozinho (via `StageMoveRegistryContext`) no bottom-sheet "Mover para" do mobile, sem precisar de prop nova em cada chamador. Antes de montar um drawer de detalhe do zero, comece por aqui — ver correção na regra 2 abaixo, a antiga separação "CRM monta à mão / RH usa shell" não existe mais. |
| "Mover para etapa", visual Pipefy (próximas etapas em destaque, etapas passadas discretas atrás de um divisor "Etapas anteriores") | `src/components/shared/StageNavigator.jsx` | Decidido com o Daniel 07/08/2026 (referência: Pipefy). Em uso nos 13 pontos que têm "Mover para" — Funil de Vendas, Entregas, Campanhas, Compras (×2), Tarefas de Marketing, Lista Pessoal e os 6 boards de RH. Precisa de `currentStageKey` + `allStages` pra ordenar frente/trás — sem essas duas props cai de volta pra lista plana (compatível com chamadas antigas). |
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
| Densidade de linha de tabela (Confortável/Compacta) | `src/components/shared/TableDensityToggle.jsx` + `src/hooks/use-table-density.js` | Extraído 03/08 durante o rollout do Focus Flutter UI Kit — só `RHFuncionariosView.jsx` usa hoje (referência do padrão "Tabela com filtro", regra 6). `useTableDensity(storageKey)` persiste por usuário via `localStorage`, uma chave por tela (ex.: `"rh-funcionarios-table-density"`) — mesmo espírito do toggle grade/lista já usado em `CardGrid` (`Card.jsx`), não reinventar. Ainda não propagado pras outras telas de tabela — extrair pro `shared/` já foi feito, falta só o rollout quando outra tela pedir. |
| Botão "Exportar CSV" no header (ícone `Download`, mesmo estilo do botão secundário padrão) | `src/utils/export-csv.js` (`csvRow`/`csvCell`/`triggerDownload`/`formatDate`/`formatBRNumber` genéricos + uma função `exportXToCSV` por domínio) | 16 boards — Funil de Vendas, Entregas, Campanhas, RH Funcionários, RH Relatórios, Viagens/Relatórios, Analytics (já existiam) + Compras, Comex, Pós-venda, Onboarding, Férias, Avaliação de Desempenho, Treinamentos, Recrutamento (Vagas e Candidatos), Lista Pessoal (rollout 07/08/2026, decidido com o Daniel). Exporta sempre o array já filtrado que a view atual usa (mesmo princípio da regra 11) — nunca o array cru. Antes de criar uma função de export nova, adicione a `export-csv.js` reaproveitando os primitivos, não escreva CSV na mão. |

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
| Acordeão mobile do board | **não é mais duplicação** — `RHMobileKanbanAccordion.jsx` foi consolidado e hoje serve 14 views, o Funil de Vendas incluído (`CRMView.jsx:932`). Esta linha dizia "não existe pro Pipeline / só RH" e induzia à conclusão errada de que o Funil não tem Kanban no celular. Corrigido 01/09/2026, conferido no código. | idem — mesmo componente |
| Abas internas do drawer de detalhe (Form/Atividades/Histórico/IA/Anexos...) | `LeadDetailDrawer.jsx` compõe as próprias abas inline, dentro do slot `left` do `SplitPanelDrawer` (ver regra 1) | `RHDetailDrawerShell.jsx` (6 telas de RH) — também montado dentro do slot `left` do mesmo `SplitPanelDrawer` |

**Correção de 07/08/2026**: esta tabela chegou a listar "Shell do drawer de detalhe (3 painéis)" como duplicação CRM-vs-RH — não é mais verdade. O *shell* externo (header/left/center/right, incluindo o "Mover para" e o bottom-sheet mobile) foi unificado em `SplitPanelDrawer.jsx` (regra 1) e hoje é usado por CRM, RH e Marketing igualmente. A duplicação real que sobrou é uma camada mais interna — o conteúdo de abas dentro do slot `left` — listada na linha acima.

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


### 2.1 Decisões de segurança já fechadas — leia antes de "corrigir"

O racional completo saiu daqui em 03/09/2026 e vive em
**`docs/decisoes-de-seguranca.md`** (113 linhas). Este arquivo é lido inteiro em
toda sessão; aquilo se consulta quando o assunto aparece.

Só as **regras operativas** ficam aqui:

- **Policy ou função RLS nova usa `roles[]`** (via `current_user_has_role(...)`
  ou `roles &&`), **nunca `profiles.role`** direto. O escalar existe e é
  sincronizado por gatilho, mas usá-lo para decidir permissão **nega** acesso a
  quem tem o cargo como secundário. (MD-11 — a dívida em policy já foi paga:
  das 345 policies em produção, zero leem o escalar. Sobrou 1 função.)
- **Mexeu em cargo por SQL? Grave `role` E `roles` na mesma instrução.** O
  gatilho `profiles_sync_roles` reinjeta o escalar dentro do array, então
  `UPDATE profiles SET roles = ARRAY['x']` **não remove** o cargo antigo — e a
  operação parece ter dado certo. Pela interface não é alcançável; o risco é só
  para escrita que não passa pela tela.
- **Quatro decisões são deliberadas e não se reabrem sem motivo novo**: escopo
  de `rh_colaboradores` é o Grupo inteiro (MD-10) · chave pessoal de IA em texto
  plano é risco residual aceito (MD-12) · `pg_net` no schema `public` fica onde
  está (BX-03) · 6 tabelas com RLS ligada e zero policies são deny-all de
  propósito (BX-04), mais o bucket público de figurinhas (BX-08) e a sessão em
  `localStorage` (BX-10).

O porquê de cada uma, com o que foi medido no banco, está no doc.

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
   `npm run build` antes de reportar pronto. **`npm run build`, não
   `npx vite build`**: os dois gates (`scripts/check-consistencia.mjs` e o
   ESLint) estão pendurados no `prebuild` do `package.json`, que é hook de
   ciclo de vida do npm — `npx vite build` chama o Vite direto e passa por
   cima dos dois em silêncio. (Corrigido em 28/08/2026: esta linha dizia
   `npx vite build`, de antes de o gate existir. Ampliada em 02/09/2026, com
   a entrada do ESLint — ver 3.2.)
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

Se estiver rodando como sessão do Claude Code, os quatro papéis existem como
sub-agentes **versionados no repositório**, em `.claude/agents/design-agent.md`
/ `frontend-agent.md` / `qa-agent.md` / `security-agent.md` — use-os via
`Agent`/`Task`.

Até 28/08/2026 esta seção dizia que eles eram "local ao ambiente, fora do
Git": `.claude/` inteira era gitignorada e estava **vazia**, ou seja, o
processo mais elaborado deste arquivo apontava pra arquivos que nenhuma
sessão nova encontrava — era reinterpretado do zero toda vez. Os quatro foram
reescritos a partir desta regra 3 e da 3.1 (não recuperados de um original) e
o `.gitignore` passou a liberar só `.claude/agents/`, mantendo o resto de
`.claude/` fora do Git. Cada arquivo diz isso no próprio cabeçalho.

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

### 3.2 Os dois gates automáticos e a varredura em navegador

Escrito em 02/09/2026, depois da 4ª tela morta em três semanas por erro de
escopo puro. O ponto que amarra tudo: **`npm run build` sozinho não prova
nada**. O Vite usa esbuild, que não faz análise de escopo — um `const` usado
no array de dependência de um `useMemo` declarado acima dele (TDZ), ou um
`setXPtoQueNinguemDeclarou("")` sobrando de um refactor, compilam sem um
ruído sequer e a tela morre em produção. O placar real:

| Tela | Causa | Tempo morta | Quem pegou |
|---|---|---|---|
| Recrutamento | TDZ em array de dependência | — | QA manual |
| App.jsx inteiro (tela branca) | TDZ | — | qa-agent, antes de subir |
| Gestão de Viagens & Despesas | TDZ | ~3 semanas | auditoria de 02/09 |
| Compras (painel de detalhe) | `setWinnerSupplierId` órfão | 15 dias | **ESLint**, não o build |

Daí as três camadas que existem hoje, da mais barata pra mais cara:

1. **`scripts/check-consistencia.mjs`** — regras específicas DESTA plataforma
   (cada uma nasceu de um bug real daqui), com linha de base travada.
2. **`.eslintrc.cjs`** — só regra que pega bug de runtime: escopo
   (`no-undef`), `rules-of-hooks`, duplicação silenciosa, condição que nunca
   faz o que parece. **Zero regra de estilo, de propósito** — gate que apita
   por formatação vira gate ignorado. O racional de cada bloco, e das que
   ficaram DE FORA, está no cabeçalho do arquivo. Ruído conhecido
   (`no-unused-vars`, 250; `exhaustive-deps`, 49) fica em `npm run lint:full`,
   que NÃO quebra o build.
3. **`scripts/qa/`** — abre a plataforma num Chromium de verdade, desktop e
   celular, e reporta exceção não tratada, erro de console, tela em branco e
   rolagem horizontal. `npm run qa:smoke` (52 rotas × 2 viewports) e
   `npm run qa:interacao` (com dados: abre card, navega abas do drawer, testa
   o acordeão no toque E no teclado). Playwright NÃO é dependência do
   projeto de propósito (baixa navegador em todo `npm ci` do deploy) —
   instala sob demanda, ver `scripts/qa/README.md`.

**Armadilha que já custou uma rodada inteira, não repetir**: a varredura roda
sem banco porque, sem `VITE_SUPABASE_*`, o App cai no caminho de usuário mock
que já existe. Mas o Vite carrega `.env.local` em QUALQUER modo — o "ignora
quando `mode === test`" é regra do Vitest, não do Vite. A primeira execução
deu "104 rotas limpas" que eram 104 telas de LOGIN, e só apareceu porque a
sessão foi conferir o texto renderizado. É por isso que existe
`scripts/qa/vite.smoke.config.js` (envDir apontado pra pasta vazia) e por
isso que a rodada de interação confere que os cards realmente apareceram
antes de declarar sucesso. **Varredura que passa sem provar que renderizou a
tela certa não vale nada** — vale menos que nada, porque dá sensação de
cobertura.

Quando rodar cada uma: os dois primeiros gates rodam sozinhos em todo build.
A varredura em navegador é pra fim de entrega que mexeu em mais de uma tela,
e pra qualquer rodada de auditoria — não precisa a cada commit.

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
| Kanban | ver regra 2 acima — já maduro, 13 boards (ver contagem atualizada na regra 1) | fluxo com etapas/estados que um registro atravessa |
| Grade de cards | novo — spec completa no doc acima | catálogo de registros (card = link) ou seletor de opções (card = checkbox) — uma variante só do mesmo componente, comportamento adaptado |

**Correção de 07/08/2026** — esta seção chegou a listar `Tabs`, `FilterBar` e
`Card`/`EntityCard` como componentes que "ainda não existem". Todos os três já
foram extraídos e já estão em uso; não reescreva um novo:

- `Tabs` → `src/components/shared/Tabs.jsx` (6 telas: Automações, Minhas
  Tarefas, Ajuda & Tutoriais, Fornecedores/RH, Cargos/RH, Configurações).
- `FilterBar` → `src/components/shared/FilterBar.jsx` (7 telas: Sinais,
  Fornecedores, Fornecedores/RH, Cargos/RH, Usuários, Lista Pessoal,
  Relatórios/RH).
- `Card`/`CardGrid` → `src/components/shared/Card.jsx` (9 telas — Automações,
  Fornecedores, Minhas Tarefas, Cargos/RH, Fornecedores/RH, Relatórios/RH,
  Sinais, Ajuda & Tutoriais, Usuários). Densidade grade/lista já embutida no
  próprio `CardGrid` via prop `density`.
- `Modal.jsx` (`src/components/ui/Modal.jsx`) — 13 usos confirmados hoje, não
  mais zero. Ainda vale evitar overlay `position:fixed;inset:0` na mão pra
  quem ainda não migrou.

Nenhum dos três acima está rodando nos boards de Kanban ainda (ver regra 11
abaixo — o filtro de Kanban continua sendo um `<select>` cru repetido por
board); a extração cobriu as telas de tabela/admin, não o Kanban.

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

## 11. Toolbar de Kanban/Tabela/Calendário/Análise: header fixo, filtro compartilhado entre views

Achado de 07/08/2026 (dois bugs reais no mesmo padrão, o Daniel reportou
ambos na mesma mensagem): todo board com múltiplas views segue — ou devia
seguir — duas regras de layout que não estavam escritas em lugar nenhum.

**Header nunca reflui entre views.** O `KanbanBoardHeader` (título + toggle
Kanban/Tabela/Calendário/Análise + filtros + botões de ação) é uma única
árvore JSX renderizada ANTES do bloco condicional de `viewMode` — nunca
dentro dele. Qualquer controle que só faz sentido numa view específica (ex.:
o `<select>` de ordenação da Lista Pessoal, que só existe na view "Lista")
NÃO pode viver dentro do próprio header condicionado a `viewMode === "x"` —
isso muda quantos elementos cabem na linha e empurra os botões vizinhos toda
vez que o usuário troca de view (bug real, corrigido em `PersonalTasksView`
07/08/2026). Controle específico de uma view vira uma linha própria, DENTRO
do conteúdo daquela view, não dentro do header compartilhado.

**Calendário/Agenda consome o mesmo dado já filtrado que o Kanban usa —
nunca o array cru.** Levantamento nos 12 boards com view de
Calendário/Agenda (07/08/2026) achou só 1 violação real — `PipelineCalendarView`
(Funil de Vendas) recebia `leads` crus e reimplementava seu próprio escopo
por dentro (empresa + `owner === user.id`), ignorando o filtro de vendedor,
setor, consultor/subordinados e favoritos que o `CRMView` já calculava em
`scopedLeads` — corrigido passando `scopedLeads` direto. Os outros boards já
estavam certos (Entregas, Tarefas de Marketing, Campanhas, Férias passam o
array já filtrado; Onboarding/Comex/Compras/Pós-venda/Feedback/Treinamentos
não tinham filtro nenhum pra vazar). Ao criar uma view de Calendário nova (ou
portar uma existente), ela recebe o MESMO array que a Kanban da mesma tela
usa — nunca reimplementa o próprio escopo por dentro. Quando o board tiver
filtro, ele já deve estar fora do bloco condicional de `viewMode` (regra
acima) — assim aparece automaticamente em toda view, sem esforço extra.

**Correção de 07/08/2026 — causa raiz real do "header desloca ao trocar de
view".** O fix acima (header fora do condicional) não era a causa inteira: o
Daniel reportou que mesmo com o header idêntico, trocar pra uma view com
mais conteúdo (ex.: Kanban populado) ainda empurrava os botões alguns
pixels — a página inteira, não só um board. Causa real: `body` não tinha
`scrollbar-gutter: stable` (`src/index.css`), então a barra de rolagem
vertical nativa só ocupava espaço quando o conteúdo da página passava da
altura da viewport — toda vez que ela aparecia/sumia (o que acontece a
qualquer troca de tela cujo conteúdo mude de altura, não só Kanban↔Lista),
o `body.clientWidth` mudava e tudo dentro dele, incluindo o header, deslizava
horizontalmente. Corrigido com `scrollbar-gutter: stable` no seletor `html`
(reserva o espaço sempre, mesmo sem precisar rolar) — efeito colateral
positivo: corrige esse deslocamento em QUALQUER página da plataforma, não só
boards com múltiplas views. Verificado (Playwright): `document.body.clientWidth`
idêntico entre uma tela sem scroll e uma com >1000px de conteúdo extra.
Degrada normalmente em navegadores sem suporte (ex. Safari < 18.2) — sem essa
propriedade, volta ao comportamento de antes, não quebra nada.

## 12. Tour guiado (spotlight) também é parte de "pronto" — igual ao changelog

Achado do Daniel em 10/08/2026, mesmo formato do achado que originou a regra
10: o mecanismo de tour guiado contextual (`src/data/feature-spotlights.js`,
decidido com o Daniel 07/08/2026, proposta "B" — aponta pra um elemento real
da tela quando a pessoa naturalmente visita a rota onde a novidade mora, em
vez de forçar um tour tela-por-tela) foi construído, ganhou 1 entrada de
exemplo (Agenda da Lista Pessoal, 4.23.0) — e parou aí. Várias entregas
grandes depois (reestruturação de drawer em 7 boards, StageNavigator estilo
Pipefy, ESG & Carbono completo, Prestação de contas) saíram sem nenhum
spotlight novo, apesar do mecanismo continuar funcionando perfeitamente — é
exatamente o mesmo padrão de "decidimos isso uma vez e ninguém tratou como
parte recorrente de pronto" que a regra 10 já corrigiu pra changelog/versão.

**Daqui pra frente, uma mudança de UI genuinamente nova e não-óbvia** (algo
que quem já usa a plataforma não vai necessariamente notar sozinho — um
botão novo, uma aba nova, um fluxo que substitui outro) **só está pronta
quando também tiver**:

1. Um `data-tour="algum-id-estável"` no elemento real que representa a
   novidade (mesmo padrão já usado em `ViewToggleButton`/`KanbanBoardHeader`
   — a maioria dos componentes compartilhados já repassa a prop sem
   precisar de mudança extra).
2. Uma entrada nova em `FEATURE_SPOTLIGHTS` (`route` = mesmo id de `section`
   usado em App.jsx pra essa tela, `target` = o seletor do `data-tour`
   acima, `version` = a versão em que a feature foi ao ar).

Nem toda entrada de changelog vira spotlight — mesmo critério de bug fix já
usado pra pular tutorial (regra 10): fix que não muda nada visível não
precisa. Mas mudança estrutural/visual real (a mesma categoria que já exige
mockup pela regra 3) **precisa** de spotlight, não só de changelog — o
changelog exige que a pessoa leia a aba "Novidades"; o spotlight aparece
sozinho, no lugar certo, no momento certo, e é o que realmente resolve "eu
nem sabia que isso existia". Registrar a decisão de pular (e por quê) não
precisa de mockup separado — só não pular a pergunta, mesmo espírito da
regra 10 pro tutorial.

## 13. Testar contra o banco: branch sob demanda, nunca produção

Achado de 01/09/2026, quando o Daniel perguntou "tem um ambiente de
testes?": **não tinha**. Local, deploy preview do Netlify e produção apontavam
os três para o MESMO projeto Supabase — `netlify.toml` não tem nenhum
`[context.*]` sobrescrevendo variável de ambiente, então o preview de um PR lê
e escreve no banco real. Não existia lugar onde errar sem consequência.

Decidido com o Daniel no mesmo dia, depois de levantar o custo real na
organização Sanwey (`bqhwdtxslqvdejvfylpi`):

| Opção | Custo | Decisão |
|---|---|---|
| Projeto Supabase novo | **US$ 10/mês**, fixo | descartado — a org já tem 4 projetos, não há cota grátis, e um banco parado 90% do tempo não vale mensalidade |
| **Branch de banco** | **US$ 0,01344/hora** | **escolhida** |

**Correção registrada**: esta sessão chegou a afirmar ao Daniel que um segundo
projeto seria *gratuito*. Não é — a informação estava errada e mudava a
decisão. Não repetir: sempre rodar `get_cost` antes de afirmar preço, e
`get_cost` exige a organização (o custo varia por org, nunca assumir).

**Como usar.** A branch é criada sob demanda (`create_branch` no MCP do
Supabase), já nasce com todas as migrations aplicadas — é cópia do schema, não
projeto vazio a reconstruir pelo baseline — e é **apagada logo depois**
(`delete_branch`). O custo é por hora de existência: uma sessão de 3h custa uns
4 centavos; esquecer uma branch ligada um mês custa quase o mesmo que o projeto
fixo, então **apagar faz parte do trabalho**, não é limpeza opcional.

**Quando vale criar uma**: migration que altera dado existente (não só
`ADD COLUMN`), policy RLS nova cuja negação você precisa ver acontecendo,
qualquer coisa que você queira ver falhando antes de ver funcionando. Para
mudança só de UI, não precisa — o `npm run dev` local já resolve.

**O que NÃO muda**: aplicar migration em PRODUÇÃO continua exigindo
confirmação explícita do Daniel, sempre (regra 5). Ter onde testar antes não é
autorização para aplicar depois.
## 14. Todo número em tela declara de onde veio

Achado de 03/09/2026, na auditoria das telas de rastreio. O `trackforge-os`
tem uma disciplina que este repositório não tem: lá, nenhuma afirmação é
publicada sem nível de proveniência, e existe verificação automática que barra
termo proibido antes da peça sair. Aqui, quatro telas cheias de número subiram
sem nada equivalente, e dois defeitos previsíveis apareceram na mesma semana.

O primeiro: em `AbmAccountsView`, a conversão por conta é ganhas dividido por
ganhas mais perdidas, com as abertas fora do denominador. Uma conta ganha e
nenhuma perdida exibe **100%** num cartão de destaque, e esse é o cartão que vai
para a diretoria. O segundo: no Relatório de Conteúdo, `unlinkedTrigger` é
`null` por decisão documentada, então lead sem campanha some dos números sem
contador. A conversão fica sem denominador honesto, porque não dá para saber
quantos entraram sem origem no mesmo período.

Nenhum dos dois é bug de código. Os dois fazem exatamente o que foi escrito. O
que faltou foi a regra.

**Daqui pra frente, número que aparece em tela só está pronto com três coisas:**

1. **Origem declarada.** Tabela, campo e cálculo, no comentário de topo do
   utilitário que produz o número, e na spec da tela. Vale para cartão de
   destaque, coluna de tabela e rótulo de gráfico.
2. **Denominador visível quando for razão.** Percentual nunca aparece sozinho:
   exibe o `n` ao lado, ou não exibe. Abaixo de um mínimo definido por tela,
   mostrar a contagem em vez do percentual.
3. **O que ficou de fora, contado.** Se o filtro descarta linha (lead sem
   campanha, registro de demonstração, fora da frente ativa), a tela mostra
   quantas foram descartadas. Número sem denominador honesto não sustenta
   decisão de investimento, que é para o que ele é olhado.

Regra 5 continua valendo: antes de assumir que falta coluna, veja se o dado já é
configurável.

## 15. O laço do mockup fecha com captura de tela

A regra 3 exige mockup **antes** de implementar e não exige nada depois. O
resultado apareceu em 03/09/2026: o Daniel abriu a tela nova de Contas · ABM e a
frase foi que não sabia dizer se estava de acordo com o que se queria. O mockup
tinha sido aprovado. Nada nunca conferiu o construído contra ele.

O `trackforge-os` fecha esse laço na seção 8 do arquivo dele, e é a peça que
falta aqui.

**Acrescentar ao passo de QA da regra 3:** antes de aprovar, captura de tela na
largura real, conferida contra o mockup aprovado, junto com a devolutiva. Build
verde não é prova de que a tela ficou como foi combinado, e os dois gates da
regra 3.2 provam ausência de erro de execução, não presença do que foi
especificado.

Vale a frase do repositório irmão, que descreve um bug real de lá: uma regra de
CSS venceu o atributo `hidden`, e aquilo passou por typecheck, por lint e por um
teste que media a propriedade errada. Só a captura mostrou as telas empilhadas.

## 16. Custo de IA é visível ou não existe

Transplantado do `trackforge-os`, onde é seção própria porque a ferramenta
inteira gasta por chamada. Aqui a exposição é menor e a regra é a mesma.

`ai-assistant`, `agent-runner`, `crm-ata-voz` e `caso-prospeccao-voz` gastam
dinheiro por uso. A cota diária de IA por pessoa **limita**, que não é a mesma
coisa que **medir**: ela impede o estouro e não diz quanto custou o mês, nem
qual funcionalidade puxou.

**O que existe hoje** (conferido 03/09/2026, respondendo o `[FALTA DADO]` que
esta seção carregava): as quatro edge functions de IA **registram uso por
chamada** — `ai-assistant/index.ts:93` emite um `console.log` com
`event: "ai_assistant_call"`, `user_id`, `crm_module`, `provider`,
`execution_status`, `latency_ms`, `prompt_tokens` e `completion_tokens`. É
trilha de auditoria deliberada (GAP 2, 18/08/2026), só metadado, nunca o
conteúdo da conversa.

**O que NÃO existe**: nada disso vai pra tabela. Fica só no log da edge
function, que é efêmero e não dá pra consultar. E **não há cálculo de custo em
lugar nenhum** — não existe tabela de preço por modelo, não existe conversão
USD→BRL, não existe soma por período. A cota
(`ai_org_quota_increment(p_user_id, p_daily_limit)`) conta CHAMADAS por dia
contra `AI_ORG_DAILY_LIMIT`; ela não sabe o que cada chamada custou.

Ou seja: dá pra saber que alguém chamou, e quantos tokens gastou naquele
instante, se você estiver olhando o log na hora. Não dá pra responder "quanto
a plataforma gastou de IA em agosto" nem "qual tela puxa mais custo".

**Regra.** Funcionalidade nova que chama modelo declara, na entrega, o que uma
execução típica custa e onde esse custo aparece pra quem olha. Busca externa,
quando existir, é linha separada, nunca embutida no custo do modelo.
Estimativa sai rotulada como estimativa, com a origem do número.

**Débito registrado, não tarefa aberta**: transformar o `console.log` numa
tabela e acrescentar preço por modelo (como o `trackforge-os` faz em
`src/constants/pricing.ts`, com `satisfies` que quebra o build se faltar
modelo) é a saída real. Não fazer por conta própria — é decisão de produto, e
o volume de hoje pode não justificar.

## 17. Espelho de regra para o Cursor, com precedência declarada

Achado de 03/09/2026. A regra 3 deste arquivo termina apontando para quatro
sub-agentes versionados em `.claude/agents/`, e a própria seção conta que em
28/08/2026 eles apontavam para arquivos que nenhuma sessão nova encontrava,
porque `.claude/` era gitignorada e estava vazia. Foi corrigido.

O mesmo defeito voltou por outra porta: as Fases 1 a 4 do rastreio saíram de
branches `cursor/rastreio-*`, e este repositório não tinha `.cursor/rules/`. O
processo mais elaborado deste arquivo era invisível na ferramenta onde o código
estava sendo escrito.

**Resolvido em 03/09/2026** — `.cursor/rules/` existe, com 8 arquivos:

| Arquivo | Ativação | Espelha |
|---|---|---|
| `00-nucleo.mdc` | **sempre** | mockup antes de código (regra 3), reaproveitar (1), 3ª ocorrência (4), nada em produção sem confirmação (5), pronto = verificado (3.2) |
| `10-reaproveitamento.mdc` | `src/**` | regra 1 + a duplicação conhecida da regra 2 |
| `20-ui-tokens.mdc` | componentes, `index.css` | tokens da regra 1 + padrões de página (6) + toolbar/calendário (11) |
| `30-gates.mdc` | sob demanda | regra 3.2 inteira + o "pronto" das regras 10 e 12 |
| `40-seguranca-dados.mdc` | `supabase/**`, hooks | checklist da 3.1 + as decisões fechadas da regra 2 + branch de banco (13) |
| `50-revisao.mdc` | sob demanda | o fluxo de 4 papéis da regra 3, adaptado — **o Cursor não tem sub-agentes**, então vira passe sequencial com passada adversarial declarada |
| `60-mapa.mdc` | sob demanda | regra 0 |
| `70-quando-passar-pro-claude.mdc` | **sempre** | não tem equivalente aqui — é a regra que manda o Cursor parar e devolver a tarefa quando ela exige mockup, produção, componente compartilhado, dado de produção ou varredura |

**Regra.** Este arquivo é a fonte. Mudou uma regra aqui, mude o `.mdc`
correspondente; e vice-versa. Se os dois discordarem, **este vence** e o outro
é o que está errado.

**Cuidado que já mordeu**: o `npm run doc:check` confere `docs/`, **não confere
os `.mdc`**. O `60-mapa.mdc` subiu com "45 telas em 52 rotas" no mesmo dia em
que a main foi para 54 — pego na revisão, não pelo gate. Número em `.mdc`
envelhece em silêncio; prefira apontar para `docs/mapa-funcional.md` a repetir
a contagem.

## 18. String que é contrato, não nome

O `trackforge-os` abre o arquivo dele com um comentário explicando por que o
nome antigo do repositório continua no código: é prefixo das chaves de
armazenamento local e do campo `origem` que o gateway daqui lê. Renomear apaga
rascunho e peça produzida de quem já usa.

Este repositório tem o caso gêmeo sem nenhum aviso. **`industria` é o
identificador da frente Sanwey**, e é o que o `trackforge-os` usa para mapear
`sanwey` ao ler `market_signals`. Conferido no código do outro lado
(`trackforge-os/src/lib/marketSignals.ts:28-31`):

```ts
export const COMPANY_ID: Record<BrandId, string> = {
  resibag: "resibag",
  sanwey: "industria",
};
```

— e a consulta é `market_signals?company_id=eq.${COMPANY_ID[brandId]}`.
Renomear `industria` aqui não quebra nada aqui: quebra a leitura de sinais do
outro lado, **em silêncio**, e o sintoma aparece como uma seção que
simplesmente deixa de existir na outra ferramenta.

**Regra.** Identificador que outro sistema lê não é nome, é contrato. Antes de
renomear id de empresa, chave de agente do gateway, valor de canal de campanha,
`action_type` ou nome de campo dentro de `custom_fields`, confira quem lê do
outro lado e registre a decisão no comentário do próprio código. A lista atual
do que atravessa a fronteira vive em `docs/mapa-funcional.md`.
