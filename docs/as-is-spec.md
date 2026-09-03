# Especificação As-Is — arquitetura, telas e débito

Levantado em 03/09/2026 lendo o código e **consultando a produção**
(`adizvduyfzfftyswkijj`). Descritivo puro: registra o que existe hoje, sem
propor correção. Escrito em português por consistência com o resto de `docs/`.

Complementa `docs/mapa-funcional.md` (o que cada tela é e do que depende).
Aqui: **como está montada, com que campos, com que regras, e onde dói.**

Onde um número vem do banco, ele está marcado com **[prod]** e é do dia
03/09/2026 — envelhece.

---

# Seção 1 — Topologia de navegação e inventário de rotas

## 1.1 As três camadas de navegação

| Nível | O que é | Onde vive |
|---|---|---|
| **L1** | item do menu lateral | `Sidebar.jsx`, montado do `navGroups` (`App.jsx:1520-1780`) |
| **L2** | aba interna, toggle de visão, filtro | dentro da própria view; nunca troca de URL |
| **L3** | drawer de detalhe, modal, bottom-sheet | overlay `position:fixed`; nunca troca de URL |

**Consequência estrutural, verdadeira em toda a plataforma:** só o **L1** tem
URL. Nenhuma aba, nenhum card aberto, nenhum filtro é endereçável. Abrir um
negócio específico não produz link; recarregar a página fecha o drawer e
volta pro topo do quadro. Não existe rota `/pipeline/:id`.

O único caminho de "deep link" que existe é interno: o dispatcher de
`App.jsx` (`setSection` + `setSelectedXId`), acionado pela fila de Pendências
e pelo sino. Ele navega **dentro da sessão** — não é URL, não é
compartilhável, não sobrevive a um F5.

## 1.2 Grupos L1 do menu, na ordem em que aparecem

Composição depende de cargo; um grupo que fica vazio some.

| Grupo | Itens (id → rota) |
|---|---|
| **Meu Espaço** | `dashboard` → `/` · `chat` → `/chat` · `personal-tasks` → `/tarefas-pessoais` · `meu-rh` → `/meu-rh` |
| **Comercial** | `commercial-overview` → `/comercial` · `signals` → `/sinais` · `crm` → `/pipeline` · `posvenda` → `/pos-venda` · `pedidos` → `/pedidos` · `clients` → `/clientes` · `catalogo` → `/catalogo` · `document-library` → `/biblioteca-de-documentos` · `crossref` → `/cross-sell` · `explorer` → `/explorador` · `crm-viagens` → `/viagens` · `comex` → `/comex` |
| **Marketing** | `marketing-home` → `/marketing/inicio` · `marketing` → `/marketing` · `marketing-solicitacoes` · `marketing-entregas` · `marketing-tarefas` · `marketing-fornecedores` · `marketing-compras` · `marketing-despesas` · `marketing-feiras` |
| **Recursos Humanos** | `rh-overview` → `/rh` · `rh-recrutamento` · `rh-onboarding` · `rh-treinamentos` · `rh-feedback` · `rh-ferias` · `rh-funcionarios` · `rh-cargos` · `rh-comunicacao` · `rh-bem-estar` · `rh-fornecedores` · `rh-relatorios` |
| **Meu Desenvolvimento** *(substitui RH pra quem não é RH)* | `meu-rh` · `rh-onboarding` · `rh-treinamentos` · `rh-feedback` |
| **Inteligência** | `executive` → `/executivo` · `market-intel` → `/inteligencia-mercado` · `esg-carbono` · `agents` → `/agentes` |
| **Configuração** | `automations` → `/automacoes` · `settings` → `/configuracoes` |
| *(sem rótulo)* | `tutorials` → `/ajuda` · `central-bugs` → `/central-bugs` |

**Dois shells alternativos, que substituem o menu inteiro:**

- `isAgencia` → **2 itens só**: Campanhas e Entregas. Nada mais existe.
- `isPortalOnly` → **2 itens**: Meu RH e Chat.

## 1.3 Rotas com nível, gatilho de acesso e saídas

| Rota | Nível | Como se chega | Saídas |
|---|---|---|---|
| `/` | L1 | pouso pós-login de todo cargo interno; item "Pendências" | cada item da fila faz deep-link interno pro registro (13 tipos de pendência); sem volta explícita — a fila permanece |
| `/pipeline` | L1 | menu Comercial | L2: Kanban / Tabela / Calendário / Análise · L3: drawer do negócio, modal de criação, modal "Editar etapas", modal de import CSV · export CSV (download) |
| `/pipeline` → drawer | L3 | clique no card, em qualquer das 4 visões | fecha com X / Esc / clique no scrim · aba PDF gera arquivo · botão "Enviar para Pós-venda" cria caso em `/pos-venda` (**não navega até lá**) |
| `/clientes` | L1 | menu Comercial | L3: modal de cliente com linha do tempo (`get_client_timeline`) · CNPJ lookup · a timeline linka visita/ata, mas **sem navegação de volta pro negócio** |
| `/viagens` | L1 | menu Comercial | L2: 5 abas (Planejamento · Despesas · Prestação · Gestão · Relatórios) + Calculadora |
| `/executivo` | L1 | menu Inteligência | L2: faixa de saúde + 1 aba por área; absorveu `/historico-funil` |
| `/inteligencia-mercado` | L1 | menu Inteligência | L2: 3 abas (Mercado · Insights · Cruzamento) |
| `/configuracoes` | L1 | menu Configuração; também é o destino de `/perfil` e `/usuarios` | L2: Perfil · Aparência · Notificações · Preferências · Integrações de IA · **Administração** (Usuários, `module_states`, descrições, auditoria de export) |
| `/central-bugs` | L1 | menu (sem gate) **e** ícone de inseto no TopBar, em qualquer tela | L3: modal de report com contexto de origem capturado · board de triagem só `isAdmin` |
| `/ajuda` | L1 | menu **e** ícone salva-vidas no TopBar | L3: modal de passo a passo por tutorial |
| `/agentes` | L1 | menu Inteligência | aprovar/recusar sugestão; badge no sino pela escada de urgência |
| `/marketing/*` (9 rotas) | L1 | menu Marketing | cada board: L2 de visões + L3 de drawer, mesmo padrão do Funil |
| `/rh/*` (12 rotas) | L1 | menu RH | idem; 6 boards usam `RHDetailDrawerShell` dentro do slot `left` |
| 7 rotas de redirect | — | link salvo | `<Navigate replace>` imediato |
| 8 rotas públicas | — | link externo (e-mail, QR, site) | fora do `<App>`, sem shell, sem menu |

## 1.4 As 8 rotas públicas (fora de `ROUTES`, em `src/main.jsx`)

| Rota | Componente | Autenticação |
|---|---|---|
| `/captura/:slug` | `LeadCaptureForm` | nenhuma (rate limit por contato) |
| `/vagas/:slug` | `JobApplicationForm` | nenhuma + token de upload de uso único |
| `/trabalhe-conosco` | `TalentPoolForm` | idem |
| `/solicitar-marketing` | `MarketingRequestForm` | nenhuma (rate limit por RPC) |
| `/solicitar-compra` | `MarketingRequestForm` (`defaultCategory="compra"`) | idem |
| `/gestor-vaga/:token` | `ManagerVagaReviewPage` | **token + confirmação do e-mail** cadastrado |
| `/pesquisa/:id` | `PesquisaPublicaForm` | nenhuma (resposta anônima) |
| `/bem-estar/:id` | `BemEstarPublicaForm` | nenhuma |

---

# Seção 2 — Wireframes ASCII

## 2.1 Shell global (desktop ≥1024px)

Larguras reais: `SIDEBAR_W = 240px`, `SIDEBAR_W_RAIL = 72px`
(`Sidebar.jsx:83-84`), espelhadas em `--sidebar-width` (`index.css:91`), que é
o `margin-left` do conteúdo.

```
┌──────────────┬───────────────────────────────────────────────────────────────┐
│ SIDEBAR 240px│ TOPBAR  (altura fixa, sticky)                                 │
│ (ou 72 rail) │ ┌──────────────────────┐         [🔍][?][🐛][☀/☾][🔔][avatar] │
│              │ │ Buscar…      ⌘K      │  ← busca global (modal L3)           │
│ [logo] [◀]   │ └──────────────────────┘                                      │
│              ├───────────────────────────────────────────────────────────────┤
│ MEU ESPAÇO ▾ │                                                               │
│  ▪ Pendências│   ÁREA DE CONTEÚDO   (padding px-4 sm:px-6)                   │
│  ▪ Chat   (3)│                                                               │
│  ▪ Meu To-do │   ← o KanbanBoardHeader "estoura" esse padding com            │
│  ▪ Meu RH    │     -mx-6/-mt-6 e devolve px-6 só ao conteúdo, pra a          │
│              │     barra encostar na sidebar e na borda da janela            │
│ COMERCIAL  ▾ │                                                               │
│  ▪ Visão Ger.│                                                               │
│  ▪ Sinais    │                                                               │
│  ▪ Funil     │                                                               │
│  ▪ Pós-venda │                                                               │
│  ▪ Pedidos   │                                                               │
│  ▪ Clientes  │                                                               │
│  … (grupos   │                                                               │
│    arrastáv. │                                                               │
│    e coláps.,│                                                               │
│    ordem     │                                                               │
│    salva no  │                                                               │
│    navegador)│                                                               │
│              │                                                               │
│ [sair]       │                                              ╭──────────────╮ │
└──────────────┴──────────────────────────────────────────────│  FAB "＋"    │─┘
                                                              ╰──────────────╯
                                            fixed bottom-right, [data-kanban-fab]
```

Notas de implementação que importam pro layout:

- `html { scrollbar-gutter: stable }` — reserva a barra de rolagem sempre, senão
  o header desloca horizontalmente ao trocar de tela.
- O FAB é `position:fixed` e o `useAvailableHeight` **mede** ele pra descontar
  da altura das colunas do Kanban.
- Sidebar tem dois estados persistidos por usuário: **rail** (72px) e **grupos
  colapsados**, ambos em `localStorage`, mais **ordem dos grupos arrastável**.

## 2.2 Shell mobile (<1024px)

```
┌───────────────────────────────────────┐
│ TOPBAR  [☰]  Título     [🔍][🔔][av] │
├───────────────────────────────────────┤
│                                       │
│  CONTEÚDO                             │
│  (Kanban vira ACORDEÃO vertical —     │
│   RHMobileKanbanAccordion, 14 views)  │
│                                       │
│  ▸ Prospecção (4)          R$ 120k    │
│  ▾ Qualificação (2)         R$ 80k    │
│      ┌───────────────────────────┐    │
│      │ card                      │    │
│      └───────────────────────────┘    │
│  ▸ Negociação (1)           R$ 45k    │
│                                       │
├───────────────────────────────────────┤
│ BOTTOM NAV — atalhos configuráveis    │
│  [Pendências][Funil][Chat][+][Menu]   │
└───────────────────────────────────────┘
   sidebar vira overlay (240px) sobre scrim
```

## 2.3 Workspace de Kanban (padrão de 13 quadros)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║ KanbanBoardHeader  — chapado, de ponta a ponta, SEM cantos/sombra         ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ Funil de Vendas                                                     │  ║
║  ├─────────────────────────────────────────────────────────────────────┤  ║
║  │ [Buscar negócio…] [Todas as empresas▾] [Todos os vendedores▾]       │  ║
║  │ [Setor▾] [★ Favoritos]        [Importar][Exportar CSV]              │  ║
║  │                               ┌────────────────────────────────┐    │  ║
║  │                               │Kanban│Tabela│Calendário│Análise│    │  ║
║  │                               └────────────────────────────────┘    │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║  REGRA: esta árvore é renderizada ANTES do bloco condicional de viewMode. ║
║  Controle específico de uma visão vira linha própria DENTRO da visão.     ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         ║
║ │Prospecção│ │Qualificaç│ │ Visitas  │ │Negociação│ │  Ganho   │  →      ║
║ │ 4 · 120k │ │ 2 ·  80k │ │ 1 ·  45k │ │ 3 · 210k │ │ 2 · 500k │         ║
║ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤         ║
║ │╭────────╮│ │╭────────╮│ │          │ │╭────────╮│ │╭────────╮│         ║
║ ││[Sanwey]││ ││        ││ │          │ ││        ││ │└────────┘│         ║
║ ││Empresa ││ │└────────┘│ │          │ │└────────┘│ │          │         ║
║ ││R$ 120k ││ │          │ │          │ │          │ │          │         ║
║ ││(78) ⚠  ││ │  ← FitScoreCircle + AlertTriangle (menção a concorrente) ║
║ ││[👤👤] ⋮││ │  ← AvatarStack + MoveStageMenu ("mover / excluir")       ║
║ │╰────────╯│ │                                                           ║
║ └──────────┘ └──────────┘                                                 ║
║   altura da coluna = useAvailableHeight() menos a altura medida do FAB    ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

Card do Kanban (`LeadKanbanCard.jsx`) — componentes confirmados no arquivo:
`CompanyTag` · `FitScoreCircle` · `KanbanCardStatusChips` · `AvatarStack` ·
`MoveStageMenu` · `AlertTriangle` (alerta de concorrente) · valor via
`formatK`.

## 2.4 Drawer de detalhe 360° (`SplitPanelDrawer`)

Um único componente serve Funil, Pós-venda, Entregas, Campanhas, Compras,
Tarefas de Marketing, Lista Pessoal e os 6 quadros de RH.

```
        scrim: var(--overlay-scrim) + backdrop-blur(3px), z-50
┌───────────────────────────────────────────────────────────────────────────┐
│ HEADER (sticky, border-b)                                                 │
│  <título / EditableTitle / ClientSelector>            [🗑 Excluir] [✕]    │
│                                                        └ confirmação      │
│                                                          inline no header │
├──────────────┬──────────────────────────────────────┬─────────────────────┤
│ LEFT  340px  │ CENTER  flex-1 (≈740px em 1400)      │ RIGHT  320px        │
│ (lg:w-[340px]│                                       │ (lg:w-[320px])     │
│  shrink-0)   │                                       │                    │
│              │  ┌─ SIDE_TABS (9 abas, Funil) ─────┐ │  StageNavigator     │
│ FitScore ⭕  │  │Form│Email│WhatsApp│Atividades│  │ │  ┌───────────────┐  │
│              │  │Histórico│IA│Anexos│Checklists│  │ │  │ PRÓXIMAS      │  │
│ ClientSelect │  │PDF                             │ │  │ ▸ Negociação   │  │
│  (dedup CNPJ)│  └─────────────────────────────────┘ │  │ ▸ Ganho        │  │
│              │                                       │  ├───────────────┤  │
│ Lead: …      │  campos da ETAPA ATUAL, renderizados │  │ Etapas anter. │  │
│ 📍 local     │  de pipeline_stage_fields            │  │ ▫ Prospecção   │  │
│              │                                       │  └───────────────┘  │
│ [+ detalhes] │                                       │                     │
│  ← só mobile │                                       │  CommentsPanel      │
│    (colapsa) │                                       │  ┌───────────────┐  │
│              │                                       │  │ comentários   │  │
│              │                                       │  │ [escrever…]   │  │
│              │                                       │  └───────────────┘  │
└──────────────┴──────────────────────────────────────┴─────────────────────┘
   container: lg:max-w-[1400px] · lg:max-h-[92vh] · lg:rounded-2xl
   mobile: colunas empilham; LEFT colapsa atrás de "+ detalhes";
           "Mover para" desce pra um BOTTOM-SHEET (border-radius 16px 16px 0 0,
           handle de 36×4px), alimentado por StageMoveRegistryContext —
           qualquer StageNavigator montado em qualquer slot se registra sozinho
```

**Overlays e o que os dispara:**

| Overlay | Gatilho | Tipo |
|---|---|---|
| Drawer de detalhe | clique no card (qualquer visão) | L3 fixed, z-50 |
| Bottom-sheet "Mover para" | botão "Mover" no mobile | L3 fixed, z-61 |
| `AtaVozPanel` | botão "Gravar ata" no drawer do Funil | painel flutuante |
| Modal de criação | FAB "＋" ou "＋" no topo da coluna | `Modal.jsx` |
| "Editar etapas" | botão no header do quadro | `PipelineStagesModal` |
| `ConfirmDeleteModal` | ícone 🗑 no `menu` do card (páginas Fornecedores) | `Modal.jsx` |
| Busca global | ⌘K / clique na busca do TopBar | modal |
| Report de bug | ícone 🐛 no TopBar, **em qualquer tela** | modal com contexto capturado |
| Spotlight de feature | ao visitar a rota da novidade | popover ancorado em `data-tour` |

---

# Seção 3 — Catálogo de componentes e campos por tela

## 3.1 Funil de Vendas — `/pipeline`

**Visões (L2):** Kanban · Tabela · Calendário · Análise. As quatro consomem o
mesmo array `scopedLeads` (já filtrado).

**Campos do negócio** (`src/constants/lead-form-fields.js`, ordem real):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `company` | Empresa | text | obrigatório na criação (`placeholder="Nome da empresa *"`) |
| 2 | `razaoSocial` | Razão social | text | preenchido por CNPJ lookup |
| 3 | `cnpj` | CNPJ | text | chave de dedup contra `clients` |
| 4 | `sector` | Setor | sector | select próprio |
| 5 | `value` | Valor (R$) | currency | `CurrencyInput`; formatação já inclui "R$ " |
| 6 | `owner` | Responsável | user | multi (`owner_ids`), render `AvatarStack` |
| 7 | `closeDate` | Data de fechamento | date | alimenta `closeDateUrgencyStyle` |
| 8 | `contactEmail` | E-mail do contato | email | |
| 9 | `phone` | Telefone | phone | |
| 10 | `city` | Cidade | text | |
| 11 | `state` | Estado (UF) | state | |
| 12 | `notes` | Observações | textarea | |

Além desses, **campos por etapa** vindos de `pipeline_stage_fields` —
**86 definições em 7 etapas [prod]**, das quais 50 marcadas `required`.

**Abas do drawer (`SIDE_TABS`) e o que cada uma faz:**

| Aba | Conteúdo | Entidade relacionada |
|---|---|---|
| Form | campos da etapa atual | `pipeline_stage_fields` |
| Email | compositor + histórico + template | `lead_emails`, `email_templates` → edge `send-crm-email` |
| WhatsApp | conversa | `whatsapp_conversations/messages` |
| Atividades | timeline de ações | `activities` (jsonb no lead) |
| Histórico | mudanças de etapa + snapshot dos campos da visita | `lead_stage_history` |
| IA | rascunho/resumo | edge `ai-assistant` (BYOK ou chave da empresa) |
| Anexos | arquivos | bucket `lead-attachments` |
| Checklists | itens | `lead_checklists` |
| PDF | gera arquivo | client-side |

**Entidades ligadas ao negócio:** Cliente (`clients`, dedup por CNPJ) ·
Contatos do comitê de compra (`client_contacts`) · Proposta com itens
(`proposals`, `proposal_line_items`) · Documentos da biblioteca
(`lead_document_refs`) · Amostras (`lead_samples`) · Visita/ata
(`crm_viagem_registros`) · Campanha de origem (`campaign_id`) · Caso de
pós-venda (criado a partir do Ganho).

**Gatilhos de ação no drawer:**

| Elemento | Reação imediata |
|---|---|
| Clique no card | abre drawer (não muda URL) |
| Arrastar card entre colunas | valida transição → valida obrigatórios da etapa de origem → grava; erro sobe em `AppToast` |
| `MoveStageMenu` (⋮) no card | mesma validação, sem arrastar |
| `StageNavigator` no drawer | idem; etapas futuras em destaque, passadas atrás do divisor "Etapas anteriores" |
| "Enviar para Pós-venda" (no Ganho) | cria `posvenda_cases`; **permanece no Funil**, sem navegar |
| Botão "Gravar ata" | abre `AtaVozPanel`; captura GPS sempre; casa com visita e faz reverse-geocode |
| 🗑 no header do drawer | confirmação **inline no próprio header**, não modal |

## 3.2 Configuração de campo por etapa (o motor compartilhado)

Editor único: `shared/stage-editor/StageFieldsPanel.jsx` (+ variantes CRM/RH).

**16 tipos de campo** (`src/constants/field-types.js`): `text` · `textarea` ·
`number` · `currency` · `date` · `datetime` · `time` · `email` · `phone` ·
`url` · `checkbox` · `select` · `radio` · `multicheck` · `user` ·
`percent_steps`.

**Propriedades por definição de campo** (colunas reais):
`field_key` · `field_type` · `label` · `required` · `options` · `order_idx` ·
`placeholder` · `help_text` · `visible_if` · `required_if` ·
`validation_rule` (+ `company_id`; RH tem `domain`/`stage_key`, CRM tem
`stage_id`).

**Regras de validação disponíveis** (`field-validation.js`):
`cnpj` (checksum real) · `regex` (com presets `email` e `phone`) · `range` ·
`not_future` · `not_past`.

## 3.3 Painel Executivo — `/executivo`

Estrutura: **faixa de saúde** (1 número + 1 sinal de alerta por área) +
**1 aba de profundidade por área**. Visibilidade por usuário via
`EXECUTIVE_WIDGETS` (`src/constants/user-settings.js`).

## 3.4 Configurações — `/configuracoes`

Único destino de `/perfil` e `/usuarios`. Abas: Perfil · Aparência ·
Notificações · Preferências (Recursos: liga/desliga Meu To-do) · Integrações
de IA (chave pessoal, BYOK) · **Administração** (só gestor): Usuários
(convite, cargo, empresa, acesso por módulo), `module_states`, descrição de
página/etapa, auditoria de export.

---

# Seção 4 — Máquinas de estado e visibilidade condicional

## 4.1 Entidades com etapa/status

`rh_pipeline_stages` é a tabela única de etapas, particionada por `domain` —
**79 etapas em 14 domínios [prod]**, das quais 19 terminais.

| Domínio | Etapas | Escopo |
|---|---|---|
| `comercial` | 7 (Prospecção → Ganho/Perdido) | **por empresa** — única assim |
| `marketing` | 6 | `all` |
| `marketing_deliverables` | 6 | `all` |
| `marketing_tasks` | 6 | `all` |
| `vagas` | 4 · `candidatos` | 7 | `all` |
| `onboarding` | 7 (inclui "Removido", que **não conta na métrica**) | `all` |
| `ferias` | 3 · `feedback` 3 · `treinamentos` 3 | `all` |
| `posvenda` | 4 | `all` |
| `comex_importacao` | 6 · `comex_exportacao` | 6 | `all` |
| `bugs` | 4 | `all` |

**Fora desse modelo, de propósito:** Compras usa `PURCHASE_STAGES` fixo no
código — as transições são acopladas às RPCs `approve_purchase_request` /
`reject_purchase_request`.

Propriedades por etapa: `color` · `order_idx` · `probability` · `sla_days` ·
`terminal` · `won` · `lost` · `code` · `card_preview_fields` · `description`.

## 4.2 Regras duras hoje aplicadas

**a) Campo obrigatório trava o avanço, não o retorno.**
`getMissingRequiredFields()` valida os campos da **etapa de origem** (a que o
card está deixando), semântica Pipefy. Decidido em 11/08/2026: voltar não
conclui a etapa, então não cobra o formulário. Antes disso o `required` era só
o asterisco visual — cards avançavam com campo vazio e corrompiam a métrica do
Executivo.

**b) Transição permitida** — `pipeline_stage_transitions`, com uma regra de
leitura que importa: **existe linha → usa `allowed`; não existe → aberto.**

**c) Visibilidade condicional** — `visible_if` / `required_if`, avaliados por
`evalFieldCondition` no formato `{ fieldKey, operator, value }`. `resolveVisibleFields()`
devolve os campos visíveis já com `effectiveRequired` calculado.

**d) Gate de etapa por condição** — `pipeline_stage_transitions.condition_groups`
avaliado por `evaluateConditionGroups()`.

**e) Permissão** — três camadas em série (cargo → módulo → RLS), detalhadas em
`docs/mapa-funcional.md §1`. `module_states` com `off` esconde de todos,
inclusive admin; `test` deixa só admin e quem tem `profile_module_overrides.allow`.

**f) Diretoria** — lê tudo, escreve nada; a proibição é RLS, não UI.

## 4.3 Automações — o que dispara e o que faz

Tabela `automations` (`module` = "crm" | "marketing", `company_id` = empresa ou
"all"). **7 regras cadastradas, todas ativas [prod].**

| Gatilho (`TRIGGER_TYPES`) | Quando |
|---|---|
| `stage_change` | card muda de etapa |
| `field_value` | campo atinge um valor |
| `time_in_stage` | card fica X dias sem avançar |
| `pending_required_field` | X dias na etapa com obrigatório vazio |
| `lead_created` | card novo |

| Ação (`ACTION_TYPES`) | Efeito |
|---|---|
| `move_stage` | move o card |
| `set_field` | altera valor |
| `assign_owner` | define responsável |
| `add_badge` | etiqueta visual |
| `notify` | alerta no painel |
| `create_deliverable` | **cruza módulo** — cria card em Entregas |
| `enrich_cnpj` | busca setor/cidade/estado |

**Eventos automáticos fora de `automations`** (gatilhos e RPCs no banco):
`stage_changed_at` reescrito a cada movimento · `lead_stage_history` e
`rh_stage_history` gravados por gatilho (com snapshot de `custom_fields`) ·
e-mail transacional disparado na conclusão de entrega, no encaminhamento a
fornecedor, na cotação e na mudança de status de solicitação ·
`profiles_sync_roles` reinjeta o `role` escalar dentro de `roles[]` em todo
INSERT/UPDATE de `profiles`.

---

# Seção 5 — Auditoria de fricção e débito

Nenhum item aqui é impressão. Cada um vem de leitura de código ou de consulta
à produção em 03/09/2026. **[prod]** marca número de banco.

## 5.1 Dado órfão e becos sem saída

### a) Nove tabelas de features entregues estão vazias em produção [prod]

| Tabela | Linhas | Feature que ela sustenta | Nível na navegação |
|---|---|---|---|
| `posvenda_cases` | **0** | Funil de Pós-venda | **item L1 do menu** |
| `orders` | **0** | Pedidos | **item L1 do menu** |
| `lead_document_refs` | **0** | Biblioteca de Documentos | **item L1 do menu** |
| `proposals` / `proposal_line_items` | **0** | CPQ, proposta com itens | aba no drawer |
| `lead_emails` | **0** | aba Email do negócio | aba no drawer |
| `email_templates` | **0** | modelos de e-mail | modal |
| `whatsapp_conversations` | **0** | WhatsApp fase 1 | aba no drawer (documentado como dormente) |
| `sales_cases` | **0** | casos de prospecção | painel |
| `client_contacts` | **2** | comitê de compra | painel no drawer |

Comparação pra dimensionar: `leads` **27**, `clients` **41**,
`marketing_deliverables` **19**, `products` **15**, `rh_colaboradores` **15**,
`personal_tasks` **19**, `market_signals` **21** [prod].

**Três itens de menu L1 abrem vazios pra qualquer usuário, sempre.** Não é
estado transitório: é o estado atual desde que subiram.

### b) Nenhum registro tem URL — a plataforma inteira

Não existe `/pipeline/:id`, `/clientes/:id`, nem equivalente em nenhum módulo.
Consequências concretas, todas verificáveis:

- Não dá pra mandar link de um negócio pra um colega.
- O botão **voltar do navegador** não fecha o drawer: sai da tela.
- **F5 perde o contexto** — fecha o drawer, volta ao topo do quadro, zera o
  filtro que não estiver em estado persistido.
- Notificação e fila de Pendências navegam por `setSection` + `setSelectedXId`
  **dentro da sessão**. Não sobrevive a recarregar, não é compartilhável.

### c) Fluxos que criam registro em outro módulo e não levam até lá

| Origem | Cria | Comportamento |
|---|---|---|
| "Enviar para Pós-venda" (negócio Ganho) | `posvenda_cases` | fica no Funil; nenhum aviso, nenhum link |
| Automação `create_deliverable` | card em Entregas | idem |
| Aprovar solicitação de Marketing | entrega **ou** compra **ou** tarefa | idem |
| Converter candidato → funcionário | `rh_colaboradores` | idem |

O registro nasce em outro quadro e o usuário não é levado, nem avisado de onde
ele foi parar. Pra conferir se deu certo, precisa trocar de módulo na mão.

### d) Beco sem volta na linha do tempo do cliente

`get_client_timeline` projeta ata, visita, mudança de etapa e faturamento. A
ata mostra a visita vinculada — mas **não existe caminho de volta pro negócio
que a originou**. A navegação é de mão única.

### e) Quem reporta bug não acompanha o próprio report

Reportar é aberto a todo mundo (ícone 🐛 no TopBar, 1 clique, em qualquer
tela). O board de triagem é `isAdmin`. Um vendedor reporta e **nunca mais vê o
que aconteceu** — não há "meus reports". `bug_reports` = 3 [prod].

## 5.2 Motores construídos e não configurados

Esta é a categoria mais cara do levantamento: infraestrutura pronta, testada,
citada como pilar de reaproveitamento no `CLAUDE.md`, com **zero configuração
em produção**.

| Motor | Configurado [prod] | Onde está o código |
|---|---|---|
| **Campo condicional** (`visible_if`) | **0** de 136 definições | `field-conditions.js`, usado em 17 arquivos |
| **Obrigatoriedade condicional** (`required_if`) | **0** de 136 | idem |
| **Validação de formato** (`validation_rule`) | **0** de 136 | `field-validation.js` (CNPJ com checksum, regex, range, not_future, not_past) |
| **Transição permitida** (`pipeline_stage_transitions`) | **0 linhas** | `use-pipeline-transitions.js` + `PipelineStagesModal` |
| **Descrição de etapa** (`description`) | **0** de 79 etapas | feature entregue em 01/09/2026 |
| **Preview de campo no card** (`card_preview_fields`) | **0** de 79 etapas | `rh_pipeline_stages` |

As 136 definições são 86 do CRM (7 etapas) + 50 de RH (18 etapas); 50 e 13
delas estão marcadas `required` — ou seja, **a obrigatoriedade estática é
usada, e nada além disso**.

**O caso mais grave é `pipeline_stage_transitions` com 0 linhas.** A regra de
leitura é: *existe linha → usa `allowed`; não existe → aberto*. Com a tabela
vazia, **toda etapa pode ir pra toda etapa, em todos os quadros**. O guarda-
corpo de transição existe em código, tem tela de configuração, e hoje não
impede nada. Um negócio pode pular de Prospecção direto pra Ganho.

## 5.3 Inconsistências de schema

### a) Escalar e array convivendo pro mesmo conceito, em 5 tabelas [prod]

| Tabela | Escalar | Array | Tipo do escalar |
|---|---|---|---|
| `leads` | `owner` | `owner_ids` | **text** |
| `marketing_campaigns` | `owner` | `owner_ids` | **uuid** |
| `marketing_deliverables` | `assignee` | `assignee_ids` | uuid |
| `marketing_purchase_requests` | `responsible_id` | `responsible_ids` | uuid |
| `profiles` | `role` | `roles` | text |

Três problemas de uma vez: o par existe em 5 tabelas; **o mesmo conceito
"dono" é `text` em `leads` e `uuid` em `marketing_campaigns`**; e
`marketing_tasks` tem só `assignee_ids`, sem escalar — o padrão duplicado nem
é aplicado de forma consistente.

Em `profiles` isso já produziu comportamento silencioso documentado: o gatilho
`profiles_sync_roles` reinjeta o escalar dentro do array, então
`UPDATE profiles SET roles = ARRAY['suporte']` **não remove** o cargo antigo —
e a operação parece ter dado certo.

### b) Modelo de tenancy incoerente dentro do mesmo funil [prod]

| Tabela | Coluna | Cardinalidade |
|---|---|---|
| `leads` | `company_id` **text** | uma empresa |
| `posvenda_cases` | `company_id` **text** | uma empresa |
| `clients` | `company_ids` **array** | várias |
| `marketing_campaigns` / `deliverables` / `tasks` / `purchase_requests` | `company_ids` **array** | várias |

Um cliente pode pertencer a duas frentes; o negócio dele, não. A conversão
negócio → caso de pós-venda mantém o singular, mas o cliente ligado aos dois é
plural. Toda policy de RLS precisa saber qual das duas formas está tratando.

### c) `notes` é três coisas diferentes com o mesmo nome [prod]

- **`jsonb`** (fio de comentários) em `leads`, `marketing_campaigns`,
  `marketing_deliverables`, `marketing_tasks`, `marketing_purchase_requests`,
  `posvenda_cases`, `personal_tasks`.
- **`text`** (campo livre) em `clients` e `rh_colaboradores`.

Mesmo rótulo na interface, semântica diferente por trás.

### d) Log de evento guardado dentro da linha

`activities` é `jsonb` em `leads`, `marketing_campaigns`,
`marketing_deliverables`, `marketing_tasks`, `marketing_purchase_requests`,
`rh_colaboradores` [prod]. Consequências: sem FK pro autor, sem RLS por item,
não dá pra consultar "tudo que fulano fez" sem varrer todas as tabelas, e
duas escritas concorrentes no mesmo card sobrescrevem o array inteiro.

Convivem com isso duas tabelas relacionais de histórico — `lead_stage_history`
e `rh_stage_history` — que fazem a coisa certa. São modelos opostos no mesmo
sistema.

### e) Duas famílias paralelas para o mesmo motor

| Conceito | CRM | RH |
|---|---|---|
| Definição de campo por etapa | `pipeline_stage_fields` (chaveada por `stage_id`) | `rh_pipeline_stage_fields` (chaveada por `domain` + `stage_key`) |
| Componente de input | `lead/StageFieldInput.jsx` | `rh-pipeline/RHStageFieldInput.jsx` (switch de tipos idêntico, copiado) |
| Card do Kanban | `LeadKanbanCard.jsx` | `RHKanbanCard.jsx` |

Mesmos 16 tipos, mesmas 3 colunas condicionais, chaves primárias diferentes.
Marketing/Entregas/Compras não usam nem um nem outro — têm card inline
próprio.

### f) Anexo em quatro lugares diferentes

Bucket dedicado por domínio (13 buckets), tabela `rh_attachments`,
`lead_attachments`, e referência dentro de `custom_fields`/`notes`.

## 5.4 Excesso de interação

| Fluxo | Cliques / trocas de contexto |
|---|---|
| **Mover card com obrigatório vazio** | arrastar → toast de erro → abrir card → achar a aba → preencher → fechar → arrastar de novo = **6 passos**, e o erro só aparece depois da tentativa |
| **Chegar em Usuários** | menu Configurações → grupo Administração → aba Usuários = **3 níveis**, sendo que `/usuarios` existe e só redireciona |
| **Conferir o que virou uma aprovação** | aprovar em Solicitações → trocar de módulo → achar o card em Entregas/Compras/Tarefas = **troca de contexto obrigatória** |
| **Ver um negócio que alguém citou** | não existe link; a pessoa descreve, a outra busca na mão |
| **Acompanhar um bug reportado** | impossível pra quem não é admin |

## 5.5 Ruído cognitivo

**a) Barra do Funil com 11 controles concorrentes na mesma linha:** busca +
empresa + vendedor + setor + favoritos + Importar + Exportar CSV + 4 toggles
de visão. Nenhum é claramente o primário.

**b) Drawer do negócio com 9 abas, 3 delas vazias pra todo mundo:** Form,
Email (**0 registros**), WhatsApp (**0**), Atividades, Histórico, IA, Anexos,
Checklists, PDF. Um terço da barra de abas leva a tela vazia.

**c) Menu de admin com ~40 itens L1 em 7 grupos.** A mitigação existente —
colapsar grupo, reordenar por arrasto, modo rail de 72px — é toda manual e
por usuário; o padrão é tudo aberto.

**d) "Visão Geral" significa três coisas.** `/` (Pendências), `/comercial`
(Visão Geral do Comercial), `/marketing/inicio` e `/rh` (idem por módulo). O
TopBar desambigua com sufixo (`Visão Geral · Comercial`), o menu lateral
não — lá são três itens com o mesmo rótulo em grupos diferentes.

**e) Dois destinos de "criar" no mesmo quadro:** o FAB flutuante e o "＋" no
topo de cada coluna fazem a mesma coisa, com a diferença de que o da coluna
pré-seleciona a etapa.

## 5.6 Resumo executivo do débito

| Categoria | Achado que mais pesa |
|---|---|
| **Endereçamento** | nenhum registro tem URL — sem link, sem voltar, sem F5 |
| **Motor ocioso** | 136 campos configurados, 0 usam condição ou validação; 0 transições cadastradas ⇒ toda etapa vai pra toda etapa |
| **Superfície vazia** | 3 itens de menu L1 (`Pós-venda`, `Pedidos`, `Biblioteca`) com 0 registros |
| **Schema** | escalar+array em 5 tabelas, `owner` é text num lugar e uuid noutro, `notes` é jsonb ou text conforme a tabela |
| **Fluxo** | criar em outro módulo nunca leva até lá |
| **Governança** | quem reporta bug não consegue acompanhar |
