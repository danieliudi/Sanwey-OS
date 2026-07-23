# sanwey-gestão — padrão de consistência

Este arquivo é carregado automaticamente em toda sessão do Claude Code neste repo.
Ele existe pra resolver um problema específico: retrabalho recorrente tentando
padronizar a plataforma depois que a inconsistência já foi construída. A partir
de agora, qualquer sessão que mexer em UI/UX segue isto **antes** de escrever
código, não depois.

Duas categorias de regra abaixo: **reaproveitamento obrigatório** (nunca
reimplementar algo que já existe) e **processo de revisão** (design → frontend
→ QA) pra tudo que for genuinamente novo. Reaproveitamento evita retrabalho por
construção; revisão pega o que não dá pra generalizar.

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

## 2. Duplicação conhecida — famílias paralelas (não crie uma terceira)

Estes pares **parecem** compartilhados mas na verdade são duas implementações
lado a lado — uma pra CRM/Pipeline, outra pra RH. Não é mentira dizer que
"existe um padrão", mas hoje são 2 padrões, não 1:

| Conceito | Versão CRM | Versão RH |
|---|---|---|
| Editor de campos por etapa | `src/components/pipeline/StageFieldEditorModal.jsx` | `src/components/rh-pipeline/RHStageFieldEditorModal.jsx` |
| Input de campo customizado | `src/components/lead/StageFieldInput.jsx` | `src/components/rh-pipeline/RHStageFieldInput.jsx` (switch de tipos idêntico, copiado) |
| Card do Kanban | `src/components/lead/LeadKanbanCard.jsx` (só Pipeline) | `src/components/rh-pipeline/RHKanbanCard.jsx` (5 boards de RH) — Marketing/Entregas/Compras têm card próprio, inline, nenhum dos dois |
| Acordeão mobile do board | não existe pro Pipeline | `RHMobileKanbanAccordion.jsx` (só RH) |
| Shell do drawer de detalhe (3 painéis) | `LeadDetailDrawer.jsx` monta tudo à mão | `RHDetailDrawerShell.jsx` (6 telas de RH) |

**Regra pra quando for mexer em qualquer um desses**: decida explicitamente se
o que você está construindo se parece mais com a família CRM ou a família RH,
e siga essa — nunca crie uma terceira variante do zero. Se perceber que está
prestes a copiar o mesmo trecho pela 3ª vez (ex.: um módulo novo que não é nem
CRM nem RH), é o sinal de extrair pra `shared/` — ver regra 4.

## 3. Processo obrigatório pra qualquer mudança de UI/UX genuinamente nova

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

Se estiver rodando como sessão do Claude Code, os três papéis já existem como
sub-agentes em `.claude/agents/design-agent.md` / `frontend-agent.md` /
`qa-agent.md` (local ao ambiente, fora do Git) — use-os via `Agent`/`Task`.
Se não estiverem disponíveis na sessão, siga a sequência acima manualmente.

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
