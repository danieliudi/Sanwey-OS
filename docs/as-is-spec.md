# Especificação As-Is — arquitetura, telas e débito

Levantado em 03/09/2026 lendo o código e **consultando a produção**
(`adizvduyfzfftyswkijj`). Descritivo puro: registra o que existe hoje, sem
propor correção. Escrito em português por consistência com o resto de `docs/`.

**Reconsultado em 14/09/2026**: todo número marcado **[prod]** foi refeito
contra o banco nesta data, e a Seção 3 passou a cobrir tela a tela, não só as
quatro que tinha. Nem tudo se confirmou — a mudança mais consequente está em
5.2 (`pipeline_stage_transitions` deixou de estar vazia).

Complementa `docs/mapa-funcional.md` (o que cada tela é e do que depende).
Aqui: **como está montada, com que campos, com que regras, e onde dói.**

Onde um número vem do banco, ele está marcado com **[prod]** e é do dia
**14/09/2026** — envelhece.

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
| **Marketing** | `marketing-home` → `/marketing/inicio` · `marketing` → `/marketing` · `marketing-solicitacoes` · `marketing-entregas` · `marketing-tarefas` · `marketing-fornecedores` · `marketing-compras` · `marketing-despesas` · `marketing-feiras` · `marketing-conteudo` |
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
| `/` | L1 | pouso pós-login de todo cargo interno; item "Pendências" — a tela é `MinhasTarefasView.jsx` (`App.jsx:2382`), **não** `DashboardView.jsx`, que é `/comercial` | cada item da fila faz deep-link interno pro registro. **30 produtores de pendência** (`use-my-tasks.js`, um `id:` por tipo), dos quais o dispatcher (`handleOpenPendingTask`, `App.jsx:1443`) abre o card por id em 11 módulos e nos demais só troca de seção; sem volta explícita — a fila permanece |
| `/pipeline` | L1 | menu Comercial | L2: Kanban / Tabela / Calendário / Análise · L3: drawer do negócio, modal de criação, modal "Editar etapas", modal de import CSV · export CSV (download) |
| `/pipeline` → drawer | L3 | clique no card, em qualquer das 4 visões | fecha com X / Esc / clique no scrim · aba PDF gera arquivo · botão "Enviar para Pós-venda" cria caso em `/pos-venda` (**não navega até lá**) |
| `/clientes` | L1 | menu Comercial | L3: modal de cliente com linha do tempo (`get_client_timeline`) · CNPJ lookup · a timeline linka visita/ata, mas **sem navegação de volta pro negócio** |
| `/viagens` | L1 | menu Comercial | L2: **4 abas** — Minhas viagens · Gestão · Relatórios · Calculadora (`CRMViagensView.jsx:26-31`), montadas por cargo. Despesas e Prestação de contas **não são abas**: são seções dentro de "Minhas viagens" (`CRMViagensPlanejamentoView.jsx:1812`, `:1857`) — corrigido em 14/09/2026, a versão anterior desta linha listava 5 abas |
| `/executivo` | L1 | menu Inteligência | L2: faixa de saúde + 1 aba por área; absorveu `/historico-funil` |
| `/inteligencia-mercado` | L1 | menu Inteligência | L2: 3 abas (Mercado · Insights · Cruzamento) |
| `/configuracoes` | L1 | menu Configuração; também é o destino de `/perfil` e `/usuarios` | L2: Perfil · Aparência · Notificações · Preferências · Integrações de IA · **Administração** (Usuários, `module_states`, descrições, auditoria de export) |
| `/central-bugs` | L1 | menu (sem gate) **e** ícone de inseto no TopBar, em qualquer tela | L3: modal de report com contexto de origem capturado · board de triagem só `isAdmin` |
| `/ajuda` | L1 | menu **e** ícone salva-vidas no TopBar | L3: modal de passo a passo por tutorial |
| `/agentes` | L1 | menu Inteligência | aprovar/recusar sugestão; badge no sino pela escada de urgência |
| `/marketing/*` (10 rotas) | L1 | menu Marketing | cada board: L2 de visões + L3 de drawer, mesmo padrão do Funil |
| `/rh/*` (12 rotas) | L1 | menu RH | idem; 6 boards usam `RHDetailDrawerShell` dentro do slot `left` |
| 7 rotas de redirect | — | link salvo | `<Navigate replace>` imediato |
| 9 rotas públicas | — | link externo (e-mail, QR, site) | fora do `<App>`, sem shell, sem menu |

## 1.4 As 9 rotas públicas (fora de `ROUTES`, em `src/main.jsx`)

Corrigido em 14/09/2026: eram listadas 8, e existem 9 — faltava
`/comunicado/confirmar/:token` (`main.jsx:27`).

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
| `/comunicado/confirmar/:token` | `ComunicadoConfirmacao` | **token** de uso único no link do comunicado |

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

**Cobertura**: as **55 subseções** abaixo cobrem todas as telas da plataforma —
as 47 internas em 54 rotas mais as 9 públicas. Até 03/09/2026 esta seção tinha
4 subseções e as demais telas viviam só no inventário curto da Seção 1;
completada tela a tela em 14/09/2026.

**3.1** (Funil de Vendas) e **3.2** (o motor de campo por etapa) vêm primeiro
por serem a referência de formato e o mecanismo que quase todas as outras
reusam. Da **3.3** em diante a ordem é a do menu lateral (Seção 1.2), agrupada
por bloco do menu.

Cada subseção traz, quando existem na tela: **Visões (L2)** · **Campos** (com o
arquivo de origem e a ordem real) · **Abas do drawer / painéis (L3)** ·
**Gatilhos de ação** · **Entidades ligadas**. Bloco que genuinamente não existe
naquela tela está declarado como inexistente, não omitido — "não tem drawer" é
informação, silêncio não é.


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
**86 definições em 7 etapas [prod]**, das quais 50 marcadas `required`
(reconferido em 14/09/2026: os três números não mudaram desde 03/09).

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


---

### Grupo: Meu Espaço
## 3.3 Pendências — `/`


É a tela de pouso pós-login de todo cargo interno (`App.jsx:2365-2390`). O
componente **não é** `DashboardView.jsx` — esse é `/comercial`
(`App.jsx:2424-2437`). `/` renderiza `MinhasTarefasView.jsx:164`.

Três desvios antes de renderizar (`App.jsx:2366-2377`): `isPortalOnly` →
`/meu-rh`; `isAgencia` → `/marketing`; `isDiretoria` → `/executivo`.

**Visões (L2):** não há toggle de visão. Há **4 abas de filtro** sobre uma
única fila vertical (`MinhasTarefasView.jsx:327-337`): Tudo · Responsabilidades
· Aprovações · Alertas, com contagem em cada. Dentro da fila, os itens são
agrupados em **3 faixas de severidade** (`TIER_META`, linha 56-60): Crítico
(`var(--danger)`) · Atenção (`var(--warning)`) · Em dia (`var(--text-faint)`).
A ordenação é tier primeiro, `urgencyRank` depois (`byPriority`, linha 68-74).
A fila corta em **10 linhas** (`MAX_VISIBLE_ROWS`, linha 29) com um botão
"Ver mais N pendência(s)" (linha 401-422).

**Campos de pendência** — a fila não tem formulário; cada item é um objeto
montado por `src/hooks/use-my-tasks.js`. O contrato do objeto está declarado no
cabeçalho do próprio hook (`use-my-tasks.js:91-93`):

| # | campo | Tipo | Observação |
|---|---|---|---|
| 1 | `id` | string | prefixo (`resp-`/`appr-`/`alert-`) é o que decide botão de ação rápida e de IA |
| 2 | `bucket` | enum | `responsibility` · `approval` · `alert` |
| 3 | `module` | string | chave do dispatcher de deep link (`App.jsx:1446-1470`) |
| 4 | `moduleLabel` | string | rótulo exibido antes do subtítulo |
| 5 | `icon` | componente | ícone lucide |
| 6 | `title` / `subtitle` | string | título e meta do card |
| 7 | `badge` / `badgeTone` | string | pílula de urgência; o tom define a faixa |
| 8 | `urgencyRank` | number | menor = mais urgente; sem data relevante vira `Infinity` (linha 46-62) |
| 9 | `section` | string | id de seção pra `setSection` |
| 10 | `lead` / `colaborador` / `raw` | objeto | passthrough do hook de origem — **casing não normalizado**, documentado em `use-my-tasks.js:94-105` |
| 11 | `informational` | bool | só em aniversário e bodas de empresa (linhas 768, 787) |

**30 tipos de pendência**, produzidos por `use-my-tasks.js` (linha de cada
`id:`):

| Bucket | Tipos (linha) |
|---|---|
| Responsabilidade (12) | `resp-lead-` 207 · `resp-campaign-` 227 · `resp-deliverable-` 246 · `resp-purchase-` 268 · `resp-feedback-` 288 · `resp-vaga-` 309 · `resp-posvenda-` 330 · `resp-mktask-` 351 · `resp-comex-export-` 375 · `resp-comex-import-` 395 · `resp-beneficios-` 685 · `resp-offboarding-` 807 |
| Aprovação (3) | `appr-purchase-` 426 · `appr-request-` 454 · `appr-ferias-` 480 |
| Alerta (15) | `alert-lead-` 504 · `alert-posvenda-` 530 · `alert-mktask-` 558 · `alert-comex-export-` 583 · `alert-comex-import-` 605 · `alert-personal-task-` 632 · `alert-exp-` 662 · `alert-aso-` 704 · `alert-contrato-` 722 · `alert-aprendiz-` 744 · `alert-aniversario-` 763 · `alert-bodas-` 785 · `alert-treino-` 839 · `alert-avaliacao-` 865 · `alert-selfeval-` 896 |

O hook instancia **16 hooks de domínio** (`use-my-tasks.js:110-147`) e o
`loading` é o OU de todos (linha 150-154). A view mostra skeleton completo só
quando `tasks.length === 0` e, a partir da primeira tarefa, troca por um selo
"carregando mais…" (`MinhasTarefasView.jsx:273-283, 296-301`) — a decisão está
comentada nas linhas 287-295.

**Faixa de indicadores (4 tiles, `MinhasTarefasView.jsx:304-325`):**

| Tile | Valor | Origem |
|---|---|---|
| Urgentes agora | contagem de `badgeTone === "var(--danger)"` | linha 222-225 |
| Responsabilidades | `counts.responsibility` | `use-my-tasks.js:922` |
| Aguardando aprovação | `counts.approval` | idem |
| Alertas ativos | alertas **exceto** `informational` | linha 230-233 |

Registrado no código: "Alertas ativos" (tile) e a aba "Alertas" (que usa
`counts.alert`) contam coisas diferentes — aniversário e bodas aparecem na aba
e não no tile (comentário em `MinhasTarefasView.jsx:226-229`).

**Abas do drawer / painéis (L3):** não existe drawer próprio. Há **um modal**,
o de rascunho de IA (`MinhasTarefasView.jsx:428-442`), que monta `RecordAIPanel`
com uma única feature.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no card, item de Leads | `onLeadClick(task.lead)` abre o drawer do negócio sem trocar de seção (linha 251-256) |
| Clique no card, demais módulos | `onOpenPending(task)` → `App.jsx:1443` faz `setSection(task.section)` e, em 11 módulos, também abre o card por id |
| Clique no card, módulo fora do mapa | só troca de seção (o `default: break` em `App.jsx:1468`) |
| "Reciclar" (`alert-treino-`) | `reciclarAtribuicao(task.raw.id)` (linha 193) |
| "Recusar" (`appr-request-` / `appr-purchase-`) | `rejectRequest` / `rejectPurchase` (linhas 195-197) |
| "Enviar lembrete" (`alert-avaliacao-`) | `sendRhEmail("avaliacao_proxima", …)` pra todo gestor de RH/admin com e-mail; erro se não houver nenhum (linha 199-213) |
| "Rascunho de e-mail" (`resp-lead-`) / "Próximo passo" (`alert-lead-`) | abre o modal de IA (linhas 141-149, 388-390) |
| Erro em qualquer ação rápida | `AppToast variant="danger"` no topo direito (linha 263-267) |

`busyIds` é um `Set`, não um id escalar — o motivo (duas ações rápidas em voo
ao mesmo tempo liberando o botão uma da outra) está comentado nas linhas
168-174.

Só 4 dos 30 tipos têm ação rápida (`QUICK_ACTIONS`, linha 103-108); a exclusão
de `appr-ferias` está justificada no comentário das linhas 96-102.

**Entidades ligadas:** `leads` · `marketing_campaigns` ·
`marketing_deliverables` · `marketing_purchase_requests` · `marketing_quotes` ·
`marketing_requests` · `marketing_tasks` · `posvenda_cases` ·
`comex_export_operations` · `comex_import_operations` · `personal_tasks` ·
`rh_feedback` · `rh_ferias` (requests) · `rh_vagas` · `rh_colaboradores` ·
`rh_beneficios` · `rh_treinamentos` (+ atribuições) · `rh_pipeline_stages`
(domínios `posvenda`, `marketing_tasks`, `comex_*`) · `pipelines` —
todas por leitura, via os hooks listados em `use-my-tasks.js:110-147`.
## 3.4 Chat — `/chat`


`ChatView.jsx:1222`. Rota com dois guardas (`App.jsx:2400-2410`): `isAgencia` é
redirecionada pra `/marketing`; `chatEnabled === false` volta pra `/`. O
comentário na própria rota (linhas 2391-2399) registra que o enforcement real é
RLS (`chat_is_member`), e que o guarda existe só pra não renderizar tela vazia.

**Visões (L2):** duas colunas fixas — rail de conversas + thread. Não há toggle.
O que existe é **um filtro único em Combobox** (`ChatView.jsx:1308-1313`) com 4
opções, e um interruptor "Arquivadas":

| Filtro | Critério |
|---|---|
| Todas · n | `!archivedAt` (linha 1283) |
| Não lidas · n | `unreadCount > 0` |
| Grupos e canais · n | `kind === "canal"` |
| Diretas · n | `kind === "dm"` |

A rail separa ainda `grupos` (`kind==="canal" && !readOnly`) de `canaisAvisos`
(`readOnly`) — linhas 1319-1321; o comentário registra que a coluna do banco
continua sendo `kind = "canal"` e que a divisão é só de renderização.
O motivo de o filtro ser um Combobox e não 4 pílulas está comentado nas linhas
1300-1306 (largura de 240px da rail).

No mobile (`<1024px`) a rail e a thread se alternam por `mobileShowThread`
(linhas 1231, 1762, 1786-1796); a altura vem de `useAvailableHeight` com
desconto de 84px pra `MobileBottomNav` (linha 1271-1280).

**Campos de canal** (`CreateChannelModal`, `ChatView.jsx:646-885`, ordem real):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `name` | nome do grupo/canal | text | |
| 2 | `icon` | ícone | select | 18 emojis fixos, `CHANNEL_ICON_PRESETS` (linha 616-634) |
| 3 | `description` | descrição | text | |
| 4 | `readOnly` | canal de avisos | checkbox | `true` = só gestor/admin escreve (`readOnlyForMe`, linha 1324) |
| 5 | `memberMode` | modo de membro | toggle | `"pessoas"` \| `"grupo"` — a UI mostra um por vez, o RPC aceita os dois (comentado nas linhas 636-645) |
| 6 | `selectedIds` | pessoas | multi | vem de `dmCandidates`, a mesma trava de visibilidade do DM |
| 7 | `departments` | departamentos | multi | `RH_DEPARTMENTS` |
| 8 | `companies` | empresas | multi | `COMPANY_IDS` |

**Campos de mensagem** (`rowToMessage`, `use-chat.js:31-44`): `id` ·
`channelId` · `authorId` · `authorName` · `authorInitials` · `authorAvatarBg` ·
`body` · `attachments[]` · `createdAt` · `editedAt`. Mensagem apagada é filtrada
por `deleted_at is null` na consulta (`use-chat.js:368`).

**Painéis e modais (L3):**

| Painel | Conteúdo | Entidade |
|---|---|---|
| `NewConversationModal` (linha 506) | busca por nome sobre `dmCandidates` | RPC `chat_dm_candidates` |
| `CreateChannelModal` (linha 646) | campos acima | RPC `chat_create_channel` |
| `ManageChannelModal` (linha 887) | nome, descrição, só-leitura, membros, admin de membro, sair | `chat_channel_members` + RPCs `chat_update_channel`/`chat_add_member`/`chat_remove_member`/`chat_set_member_admin`/`chat_leave_channel` |
| `EmojiPopover` (linha 430) | `CHAT_EMOJI_CATEGORIES` | constante |
| `StickerPopover` (linha 466) | figurinhas | bucket `chat-stickers`, público (`use-chat-stickers.js:48`) |
| `ComposerPopover` (linha 370) | ancoragem dos dois acima e do FAB mobile | — |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Selecionar conversa | `setSelectedId` + `setMobileShowThread(true)` + `markRead` (RPC `chat_mark_read`), e sai de "arquivadas" (linha 1340-1345) |
| Trocar de conversa | zera rascunho, anexos, popovers e cancela gravação em curso (linha 1326-1334) |
| Mensagem nova | rola o feed pro fim (linha 1336-1338) |
| Clipe de anexo | aceita `.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp`, teto de 10 MB (linhas 23-24) |
| Segurar o microfone | grava áudio; arrastar >60px pra esquerda cancela sem enviar (`AUDIO_CANCEL_DRAG_PX`, linha 27-28) |
| Enviar | filtro de palavrão por `findBannedWord` (`utils/language-filter`) |
| Arquivar | `archivedAt` — arquivado é silenciado: não conta no badge fora da tela (comentado em `use-chat.js:316-320`) |

**Entidades ligadas:** `chat_channels` (via RPC `chat_my_channels`) ·
`chat_messages` (leitura direta com join em `profiles`, `use-chat.js:6-7`) ·
`chat_channel_members` (leitura direta, linhas 230 e 247) · `profiles` (autor e
candidatos a DM) · bucket de anexos (`use-chat-attachments.js`, URL assinada de
3600s) · bucket `chat-stickers` (público). Toda escrita de canal/membro passa
por RPC `chat_*`; só a leitura de mensagens e de membros é `.from()` direto.

Sem Supabase o hook fica inerte de propósito — não há fallback local
(comentado em `use-chat.js:78-80`).
## 3.5 Meu To-do — `/tarefas-pessoais`


`PersonalTasksView.jsx:523`. A rota **não** checa o opt-in
`settings.personalTasksEnabled` — só o item de menu depende dele; o motivo
(RLS de `personal_tasks` já restringe ao dono) está comentado em
`App.jsx:2411-2418`. `isAgencia` é redirecionada.

**Visões (L2):** 4, em `ViewToggleButton` (`PersonalTasksView.jsx:932-935`) —
Kanban · Lista · Agenda · Automações. A escolha persiste em `localStorage` sob
`"personal-tasks-view"` (`useViewMode`, linhas 36, 45-60); o comentário das
linhas 40-44 registra que isso não virou hook compartilhado por ser a 2ª
ocorrência do padrão.

Lista agrupa em 4 seções fixas (linhas 1032-1041): Hoje (inclui atrasadas,
`bucketFor` linha 76-79) · Esta semana · Sem data · Concluídas (só aparece
quando não vazia).

**Campos da tarefa** (`rowToTask`, `src/hooks/use-personal-tasks.js:14-36`):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `title` | Título | text | obrigatório na criação (`PersonalTaskCreateModal.jsx:105`, botão travado sem ele, linha 181) |
| 2 | `description` | Descrição | textarea | opcional |
| 3 | `priority` | Prioridade | select | `baixa`/`media`/`alta` (`constants/personal-tasks.js:45-49`); default `media` |
| 4 | `status` | Etapa | stage | default `a_fazer` |
| 5 | `dueDate` | Prazo | date | |
| 6 | `dueTime` | Hora | time | desabilitado enquanto não houver `dueDate` (`PersonalTaskCreateModal.jsx:137`) |
| 7 | `tags` | Etiquetas | multi | catálogo próprio por usuário |
| 8 | `recurrence` | Repetir | select | 5 opções, `RECURRENCE_OPTIONS` |
| 9 | `recurrenceConfig` | — | jsonb | |
| 10 | `customFields` | campos da etapa | jsonb | de `personal_task_stage_fields` |
| 11 | `notes` | Notas | jsonb | renderizado na coluna direita do drawer, não em aba |
| 12 | `completedAt` | — | timestamp | base do arquivamento automático |
| 13 | `relatedLeadId` | — | uuid | preenchido só quando a tarefa nasce do "Repetir email" do Funil (comentado na linha 33-35) |

**Etapas padrão** (`constants/personal-tasks.js:25-33`): A Fazer · Fazendo ·
Concluído (`terminal`) · Arquivar (`terminal`, chave `feito`). São
customizáveis por usuário em `personal_task_stages`; o catálogo fixo só entra
como fallback (`PersonalTasksView.jsx:1084-1088`). Duas perguntas distintas
convivem: `isTaskDone` (qualquer terminal, linha 42-44) e `isTaskArchived`
(só `feito`, linha 124-127) — a separação e o bug que a motivou estão no
comentário das linhas 108-123.

Arquivamento automático por `personalTasksAutoArchiveDays` (default 30,
`constants/user-settings.js:224`), com aviso a partir da metade do prazo
(`autoArchiveWarnAfter`, linha 146). O estado fica no navegador de quem
configurou — declarado em `user-settings.js:218-223`.

**Abas do drawer (`PersonalTaskDetailDrawer.jsx:580-605`):**

| Aba/slot | Conteúdo | Entidade |
|---|---|---|
| `header` | pílula de etapa + pílula de prioridade + `EditableTitle` (linha 540-556) | — |
| `left` → Detalhes | prazo, hora, recorrência, etiquetas, dependências | `personal_task_tags`, `personal_task_dependencies` |
| `left` → Checklist | itens | tabela de checklist da tarefa |
| `left` → Anexos | arquivos | bucket de anexos da tarefa |
| `center` | **só** o formulário da etapa atual (`StageFieldsTab`) — o pedido que motivou isso está comentado na linha 607-609 | `personal_task_stage_fields` |
| `right` | Notas (log com carimbo de data/hora, sem @menção) + `StageNavigator` | `personal_tasks.notes` |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Busca no header | filtra Kanban, Lista e Agenda igualmente; **desabilitada** (não removida) na aba Automações, pra não mudar a largura do header (comentado em `PersonalTasksView.jsx:921-930`) |
| "Exportar CSV" | `exportPersonalTasksToCSV(filteredTasks)` — arquivada sai da tela, não do relatório (comentário linha 938-940) |
| "Editar etapas" | abre `PersonalStageListManager`; a chave `feito` é protegida contra exclusão |
| "Nova tarefa" | `PersonalTaskCreateModal` |
| Mover de etapa | valida obrigatórios com `getMissingRequiredFields` + `isStageRegression` (import na linha 29), usando `buildTaskConditionValues` |
| Etiqueta | também alimenta condição de campo, sob a chave sintética `__etiquetas` (`constants/personal-tasks.js:59-77`) |
| Faixa "N arquivadas fora do quadro" | alterna `mostrarArquivadas`; fica fora do bloco condicional de `viewMode` (comentário linha 1003-1006) |

**Automações pessoais** (aba Automações, `PersonalTaskAutomationsPanel.jsx`):
gatilho `stage_change` ou outro, e 4 ações — `move_stage`, `set_field`
(fixo em `priority`), `notify`, `create_task` (linhas 56-64). Persistem em
`personal_task_automations`.

**Entidades ligadas:** `personal_tasks` · `personal_task_stages` ·
`personal_task_stage_fields` · `personal_task_tags` ·
`personal_task_dependencies` · `personal_task_automations` ·
`personal_tasks_api_keys` (chaves da "Secretária de IA", geridas em
Configurações → Integrações — ver 3.E11).
## 3.6 Meu RH — `/meu-rh`


`MeuRHView.jsx` (510 linhas). **Rota sem gate nenhum** (`App.jsx:2943-2950`) —
qualquer usuário autenticado renderiza. O item no menu, esse sim, é condicional:
aparece pra `isPortalOnly` (`App.jsx:1803`) e, pros demais, só quando
`temFichaColaborador` (`App.jsx:1855-1856`, `:1993`).

**Visões (L2):** 7 abas possíveis (`TABS_FULL`, `:30-38`), das quais 3 são
removidas para quem não é `isPortalOnly` (`REDUNDANT_WITH_SIDEBAR`, `:39` e
`:482`), porque para quem tem o grupo "Meu Desenvolvimento" na sidebar elas
duplicariam exatamente os itens soltos do menu — mesmo componente, mesmo
`isRHUser={false}`:

| # | id | Label | Conteúdo | Aparece para |
|---|---|---|---|---|
| 1 | `comunicados` | Comunicados | `ComunicadosPanel` — filtra `notifications` por `type` `comunicado`/`comunicado_importante`; clicar marca como lido | todos |
| 2 | `onboarding` | Onboarding | `RHOnboardingView` com `isRHUser={false}` | só `isPortalOnly` |
| 3 | `treinamentos` | Treinamentos | `RHTreinamentosView` com `isRHUser={false}` | só `isPortalOnly` |
| 4 | `avaliacao` | Avaliação | `RHFeedbackView` com `isRHUser={false}` | só `isPortalOnly` |
| 5 | `ferias` | Férias | `MeuFeriasPanel` | todos |
| 6 | `documentos` | Documentos | 2× `RHAttachmentsPanel` `readOnly` — Holerite e Ponto | todos |
| 7 | `meus-dados` | Meus Dados | `MeusDadosPanel` | todos |

`notifications` e `markNotificationRead` chegam **por prop**, não de uma segunda
chamada do hook: `App.jsx` já assina o canal Realtime `notifications_<userId>`
globalmente, e uma segunda assinatura com o mesmo nome derrubava o app inteiro
com "cannot add 'postgres_changes' callback ... after 'subscribe()'" (`:46-51`).

**Campos da solicitação de férias** (`SolicitarFeriasForm`, `:88-171`): Tipo
(`RH_LEAVE_TYPES`) · Início · Fim · Observação. Grava direto em `rh_ferias` com
`user_id = colaboradorId` — `rh_colaboradores.id`, não o id do profile; o
comentário em `:84-87` registra que gravar o id do profile violava a FK e fazia
a lista voltar sempre vazia. É um formulário mais curto que o de `/rh/ferias`:
sem aviso de antecedência CLT e sem aviso de documento exigido.

**Saldo de férias** (`:196-204`): `computeFeriasSaldo(admissionDate, requests)`,
exibido como "N dia(s) de férias disponíveis · X adquiridos, Y já gozados" — os
dois componentes do cálculo aparecem ao lado do número.

**Campos de "Meus Dados"** (`MeusDadosPanel`, `:395`):

| Grupo | Campos | Editável |
|---|---|---|
| Só leitura (`CAMPO_LABELS`, `:227-231`) | Nome completo · CPF · RG · Cargo · Departamento · Admissão · Status | não |
| Editável simples (`EDITABLE_SIMPLE`, `:236`) | Telefone · E-mail | lápis inline → `rh_data_update_requests` |
| Endereço (`ADDRESS_FIELDS`, `:237-245`) | Rua · Número · Complemento · Bairro · Cidade · Estado · CEP | "Atualizar endereço" → uma linha em `rh_data_update_requests` por campo alterado (`:307-309`) |

O texto no rodapé declara a regra: "Nome, CPF, RG, cargo, departamento e admissão
exigem documento — fale com o RH pra corrigir esses" (`:434-437`). Abaixo,
`MinhasSolicitacoesList` (`:340`) mostra os próprios pedidos com status
Aguardando RH / Aprovado / Recusado — é o par de leitura da aba "Solicitações"
de `/rh/funcionarios`.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no comunicado não lido | `markRead(id)` |
| "Solicitar férias/afastamento" | abre o formulário inline; ao enviar, refaz o fetch da lista |
| Lápis em Telefone/E-mail | grava a proposta e incrementa `refreshKey`, que recarrega a lista de solicitações |
| Sem ficha em `rh_colaboradores` | a aba Documentos cai num `EmptyState`, e "Meus Dados" mostra "Nenhum dado cadastrado — fale com o RH se isso não for esperado" (`:398`) |

**Entidades ligadas:** `rh_colaboradores` (via RPC `get_my_colaborador`) ·
`rh_ferias` · `rh_data_update_requests` · `rh_attachments` (domínios `holerite`
e `ponto`) · `notifications` (por prop, de `App.jsx`).

---

### Grupo: Comercial
O Funil de Vendas, item mais usado deste grupo, está em **3.1** — foi escrito primeiro e é o formato que as outras seguem.
## 3.7 Visão Geral Comercial — `/comercial`


Componente: `src/components/views/DashboardView.jsx` (`App.jsx:2424-2438`).
Rota bloqueada com `<Navigate>` pra `isAgencia`, `isPureMarketing` e
`isPureRH` (`App.jsx:2425-2426`) — quem cai nesses três nunca vê a tela.
Distinta de `/`, que é o pouso pós-login e vai pra Minhas Tarefas
(`App.jsx:2365-2379`).

**Visões (L2):** nenhuma. Não há toggle Kanban/Tabela nem abas — é uma página
única de 4 zonas verticais, com ordem invertida no mobile (`order-2 lg:order-1`
na zona 1, `order-1 lg:order-2` na zona 2, `DashboardView.jsx:270` e `:302`).
O único controle de visão é o modal **Personalizar** (`WidgetPrefsModal`,
`DashboardView.jsx:359-367`), que liga/desliga widget por usuário.

Todas as zonas leem o mesmo array `scopedLeads` (`DashboardView.jsx:48-62`),
filtrado em série: empresa ativa → responsável (via `getLeadOwnerIds`, que
inclui co-responsável e subordinado direto) → setor, este último só pra
`role === "vendedor"` (`:58-60`). `isManager` (gerente ou admin) pula o filtro
por responsável (`:55`).

**Widgets toggláveis** (`src/constants/visao-geral-widgets.js:9-19`, ordem real):

| # | `id` | Label | Zona | Observação |
|---|---|---|---|---|
| 1 | `leads_count` | Total de leads | 1 | rótulo muda com o cargo: "Leads no grupo"/"Leads da empresa"/"Meus leads" (`DashboardView.jsx:277`) |
| 2 | `pipeline_open` | Funil de Vendas aberto | 1 | soma de `value` de tudo fora de `ganho`/`perdido` (`:73`) |
| 3 | `won_value` | Valor ganho | 1 | recebe `accent` da empresa ativa (`:287`) |
| 4 | `avg_fit` | Fit score médio | 1 | único com `tooltip` via `HelpTooltip` (`:292`) |
| 5 | `task_overdue` | Fechamento atrasado | 2 | `closeDate < hoje`, tom `var(--danger)` (`:178`) |
| 6 | `task_followups` | Follow-ups agendados | 2 | `nextFollowUp` vencido ou dentro de 7 dias (`:125-130`) |
| 7 | `task_closing` | Fecham nesta semana | 2 | horizonte fixo de 7 dias (`CLOSING_HORIZON_DAYS`, `:29`) |
| 8 | `task_stale` | Leads parados | 2 | `isStale(l, companyStages)` — usa o SLA por etapa configurado, com fallback global (`:132-137`) |
| 9 | `stage_distribution` | Distribuição por etapa do funil | 3 | `StageDistributionBar`, dedupe de etapas entre empresas (`:153-174`) |

Widget sem entrada no mapa de preferências é visível por padrão — só `false`
explícito esconde (`use-dashboard-widget-prefs.js:44`). A preferência é
**por usuário e só em `localStorage`** (`use-dashboard-widget-prefs.js:20`,
chave `STORAGE_KEYS.dashboardWidgetPrefs`), sem coluna no banco; existe uma
migração única do mecanismo antigo `settings.visibleDashboardWidgets` pros 4
StatCards da zona 1 (`:13`, `:25-38`).

**Zona 4** existe mas não tem widget nenhum: renderiza um `EmptyState` fixo
cujo único elemento personalizável é o título (`zone4Title`,
`DashboardView.jsx:351-357`).

**Abas do drawer / painéis (L3):** não existem. A tela não abre drawer próprio
— clique em item de `TaskBucket` chama `onLeadClick(lead)`
(`DashboardView.jsx:182`, `:191`, `:199`, `:207`), que é o `setSelectedLead`
do `App.jsx` e abre o drawer do **Funil de Vendas** por cima, sem trocar de
rota.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Botão "Atualizar" (`:233-240`) | `window.location.reload()` — recarrega a página inteira, não refetch |
| Botão "Exportar" (`:241-250`, só `isManager`) | `exportLeadsToCSV(scopedLeads, …)` + `logExport(user.id, "leads_dashboard", n)` — exporta o array já filtrado |
| Botão "Personalizar" (`:251-260`) | abre `WidgetPrefsModal`; no mobile fica só o ícone (`:259`) |
| "Abrir pipeline" no eyebrow de Pendências (`:303`) | `onNavigate("crm")`; o link só aparece quando `totalTasks > 0` |
| Clique em item de qualquer `TaskBucket` | abre o drawer do negócio (Funil), não navega |

Cada bucket mostra no máximo 4 itens (`.slice(0, 4)`, `:180`, `:188`, `:197`,
`:205`), mas o contador `fullCount` conta todos (`:179`) — não há "ver todos"
dentro do bucket.

Os rótulos de etapa exibidos nos buckets vêm de um mapa **hardcoded no
arquivo** (`STAGE_LABELS`, `DashboardView.jsx:372-384`), não de
`rh_pipeline_stages`; a distribuição da zona 3 usa as etapas reais
(`pipelines`, `:161`). Etapa renomeada no editor aparece com o nome novo na
zona 3 e com o nome antigo nos buckets da zona 2.

**Entidades ligadas:** `leads` (via prop, carregado no `App.jsx`) ·
`profiles`/usuários (`useUsersById`, `:32`; `supervisorId` define subordinados,
`:45`) · `rh_pipeline_stages` domínio `comercial` (via prop `pipelines`, usado
em `isStale` e em `funnelStages`) · auditoria de export (`logExport`, `:246`).

---
## 3.8 Sinais de Mercado — `/sinais`


Componente: `src/components/views/SignalsView.jsx` (`App.jsx:2439-2449`).
`isAgencia` e `isPureRH` são redirecionados (`App.jsx:2440`).

**Visões (L2):** uma só, com dois eixos de controle no mesmo `FilterBar`
(`SignalsView.jsx:150-185`): filtro de urgência em pílulas
(`URGENCY_FILTERS`, `:12-18` — Todos · Crítico · Alto · Médio · Info) e o
`GridListToggle` de densidade grade/lista (`:151`). Não há Kanban, tabela nem
calendário. O array `scopedSignals` (`:119-123`) é o único que a tela consome —
empresa ativa e depois urgência; os dois `StatCard` do topo leem esse mesmo
array já filtrado (`:141`, `:145`), então "Sinais monitorados" muda quando se
troca o filtro de urgência. Nenhum dos dois filtros persiste em reload (estado
local, `:40-41`).

**Campos do sinal** — não há arquivo de constants: a forma do registro é
montada no hook, em `src/hooks/use-market-signals.js:8-20` (`rowToSignal`),
e consumida inline no JSX.

| # | `id` | Label na tela | Tipo | Observação |
|---|---|---|---|---|
| 1 | `company` (`company_id`) | — | text | só vira `CompanyTag` visível na visão de grupo (`SignalsView.jsx:205`); também colore o ícone do card (`:200`) |
| 2 | `source` | — | text | exibido como `meta` do `Card` (`:202`) |
| 3 | `title` | — | text | título do card (`:201`) |
| 4 | `excerpt` | — | text | corpo do card (`:212-214`) |
| 5 | `url` | "Ver fonte" | url | link externo `target="_blank"`; só renderiza se preenchido (`:216-228`) |
| 6 | `urgency` | Crítico/Alto/Médio/Info | select | `UrgencyTag` na grade e ponto colorido na lista (`URGENCY_STATUS_COLOR`, `:24-29`) |
| 7 | `date` (`detected_at`) | — | date | formatado `pt-BR` no hook (`use-market-signals.js:17`), exibido no `footer` (`:210`) |

Não existe tela de criação/edição de sinal nesta rota: o hook só lê
(`use-market-signals.js:30-33`), e o comentário de topo do arquivo registra que
os sinais nascem por aprovação de rascunho na fila "Agentes de IA"
(`agent_actions` → `market_signals`, `use-market-signals.js:4-7`). O hook assina
Realtime em `market_signals` e refaz o fetch inteiro a cada evento
(`:45-52`).

**Abas do drawer / painéis (L3):** não existem. O `Card` é montado sem
`onClick` (`SignalsView.jsx:196-211`), então `interactive` fica `false`
(`Card.jsx:35`) e o card não abre nada — toda a interação está em dois
elementos internos ("Ver fonte" e "Criar lead").

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Pílula de urgência (`:157-183`) | refiltra `scopedSignals`; os dois StatCards recalculam junto |
| `GridListToggle` (`:151`) | alterna `density` entre `grid` e `list` no `CardGrid` |
| "Ver fonte" (`:216-228`) | abre `s.url` em nova aba; `stopPropagation` no clique |
| "Criar lead a partir deste sinal" (`:286-295`) | expande o formulário inline dentro do próprio card e foca o campo após 50 ms (`:50-57`) |
| `ClientSelector` no formulário inline (`:261-266`) | escolhe cliente já cadastrado; "criar novo" troca pra um `<input>` de texto livre (`creatingNew`, `:46`, `:239-258`) |
| Botão "Criar" (`:269-276`) | monta o lead e chama `onAddLead`; desabilitado enquanto não há cliente escolhido nem nome digitado |
| Enter no campo de texto livre (`:246`) | mesmo efeito de "Criar"; Esc fecha o formulário |

O lead criado nasce com um bloco de valores **fixos no código**
(`SignalsView.jsx:74-113`): `size: "Mid-Market"`, `fitScore: 60`,
`probability: 0.1`, `value: 0`, `quantity: 0`, `situacao: "ATIVA"`,
`stage: "prospeccao"`, `closeDate` = hoje + 60 dias, `trigger` =
"Sinal regulatório"; `city`/`state` caem em `"—"` quando não vêm do cliente
vinculado (`:86-87`). A empresa de destino é a do sinal se ela estiver entre as
acessíveis, senão a primeira acessível, senão `"industria"` literal
(`:68-72`). Depois de criar, o card troca o botão por "Lead adicionado ao
pipeline" (`justAdded`, `:47`, `:232-236`) — **a tela não navega até o negócio
criado**, e o estado `justAdded` é local, some ao recarregar.

**Entidades ligadas:** `market_signals` (leitura + Realtime) · `clients`
(alimenta o `ClientSelector`; o lead nasce com `clientId`, `cnpj`, `sector`,
`city`, `state` do cliente escolhido, `:80-87`) · `leads` (via `onAddLead`,
que é o `handleAddLead` do `App.jsx` e dispara as automações `lead_created`) ·
`COMPANIES` pra cor e tag.

---
## 3.9 Funil de Pós-venda — `/pos-venda`


Componente: `src/components/views/PosVendaView.jsx` (`App.jsx:2511-2524`).
`isAgencia` e `isPureRH` redirecionados (`App.jsx:2512`).

**Visões (L2):** Kanban · Tabela · Calendário · Análise
(`ViewToggleButton` ×4, `PosVendaView.jsx:1121-1126`, estado `viewMode`,
`:946`). As quatro consomem `scopedCases` (`:883-902`) — empresa → responsável
(com subordinados via `supervisorId`, `:871-874`) → busca sem acento por nome
do cliente e nome do responsável (`:894-900`). O `KanbanBoardHeader`
(`:1096-1162`) é renderizado antes do bloco condicional de `viewMode`, com
busca, toggle, seletor de empresa, Exportar CSV e "Novo caso" dentro dele.

No mobile, o Kanban vira `RHMobileKanbanAccordion` (`:1199-1226`); o quadro
horizontal fica em `hidden lg:block` (`:1241`).

**Campos do caso** — não há arquivo de constants: a forma do registro está em
`src/hooks/use-posvenda.js:6-27` (`rowToCase`) / `:29-43` (`caseToRow`), e os
campos do formulário são inline no `QuickAddCaseModal`
(`PosVendaView.jsx:96-338`).

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `clientId` | Cliente do cadastro | client | `ClientSelector` + `ClientQuickCreateModal` (`:181-197`); opcional — sem ele o caso não entra na linha do tempo do cliente (`:370-374`) |
| 2 | `clientName` | Nome do cliente * | text | único obrigatório; bloqueia o submit (`:281`, `:102+179`) |
| 3 | `value` | — | currency | `CurrencyInput` sem label própria (`:207-212`) |
| 4 | `ownerIds` | Responsável(is) | user (multi) | `AssigneeMultiSelect`; opções = vendedor/gerente/admin da empresa (`:117-122`) |
| 5 | `negotiationStartedAt` | Quando começou | date | dentro do card "Já está negociando com esse cliente?", marcado "opcional"; `max` = hoje, pra não quebrar "novo em 48h" e "Tempo no funil" (`:222-252`) |
| 6 | `stage` | — | select | vem da coluna/etapa onde o modal foi aberto (`:175`, `:149`) |
| 7 | `customFields` | (por etapa) | vários | `rh_stage_fields` domínio `posvenda`, via `useRHStageFields("posvenda")` e `resolveVisibleFields` (`:112-113`, `:253-272`) |

Campos de banco sem campo de formulário: `leadId` (preenchido só pelo
"Enviar para Pós-venda" do negócio Ganho), `notes` (feed de atividades),
`stageChangedAt`, `createdBy`.

As 4 etapas nascem do seed de
`supabase/migrations/_historico/20260770_posvenda_kanban.sql:18-21` —
`onboarding_cliente` · `acompanhamento` · `renovacao_upsell` · `encerrado`
(esta última `terminal`), todas `company_id = 'all'`. A tela permite criar
etapa nova (`NewStageModal`, `:784-846`) e reordenar arrastando o cabeçalho da
coluna (`:1266-1272`, `handleColumnDrop` `:1000-1014`), as duas só pra
`canManageStages` = gerente/admin **fora** da visão de grupo (`:858`).

**Abas do drawer / painéis (L3):** o drawer é `SplitPanelDrawer`
(`PosVendaDetailDrawer`, `:321-517`), com as abas do slot central vindas de
`RHDetailDrawerShell` (`:455-469`).

| Aba | Conteúdo | Entidade relacionada |
|---|---|---|
| Form | campos da etapa atual, com `effectiveRequired` calculado | `rh_stage_fields` (`domain = posvenda`) |
| Atividades | feed de atividades do caso | `posvenda_cases.notes` (jsonb) |
| Histórico | mudanças de etapa | `rh_stage_history` (gatilho `trg_log_posvenda_stage_change`, baseline `:7000`) |
| IA | rascunho/resumo | edge `ai-assistant` (aba existe porque `record` é passado, `RHDetailDrawerShell.jsx:684`) |
| Anexos | arquivos | anexos por domínio `posvenda` |

Sem aba Checklists: `showChecklists` só vale pra `vagas`, `candidatos` e
`comex` (`RHDetailDrawerShell.jsx:671`).

Painéis fixos do drawer, fora das abas: coluna esquerda com `ClientSelector`,
Valor, Responsáveis, Empresa e "Nesta etapa há" em grid 2×2, mais o botão
"Ver negócio de origem em Venda" quando há `leadId` resolvido
(`PosVendaView.jsx:356-424`); coluna direita com "Mover para"
(`StageNavigator`, `:483-490`) e `RHDetailComments` (`:494-502`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no card | abre o drawer (`setSelectedCaseId`, `:1336`); marca como visto (`useRecordViews("posvenda_cases", …)`, `:1025-1030`) |
| Arrastar card entre colunas (`:1250-1252`) | `attemptStageChange` — valida obrigatórios e formato **da etapa de origem**, só ao avançar (`isStageRegression`, `:966-978`); erro sobe em `AppToast` `variant="danger"` (`:1090-1094`) |
| Menu ⋮ do card no acordeão mobile (`:1215`, `showMoveOptions` `:1221`) | mesma validação. No desktop `showMoveOptions={false}` (`:1344`) — mover sem arrastar só existe no mobile e no drawer |
| `StageNavigator` no drawer (`:483-490`) | mesma validação; erro é mostrado **inline** na coluna direita (`onBlocked`, `:962`) e o drawer fecha no sucesso (`:488`) |
| "Ver negócio de origem" (card `:77-87` / drawer `:412-420`) | chama `onOpenLead(sourceLead)` e fecha o drawer — abre o drawer do Funil por cima da tela de Pós-venda, sem trocar de rota |
| Ícone de engrenagem no cabeçalho da coluna (`:1293-1304`, só `isManager`) | abre `RHStageFieldsPanel` da etapa (`:1393-1401`) |
| "+ Novo caso" (FAB `:1164-1166`, botão do header `:1150-1159`, botão no rodapé da coluna `:1350-1359`, "+" do acordeão `:1207`) | abre o mesmo `QuickAddCaseModal`, com a etapa de origem correspondente |
| "Exportar CSV" (`:1139-1149`) | `exportPosVendaCasesToCSV(scopedCases, { stages })` — 5 colunas: Cliente, Empresa, Etapa, Valor, Na etapa desde (`export-csv.js:189-202`) |
| Excluir caso (card `:1339-1341` / drawer `:513-514`) | `deleteCase`, com `window.confirm` de mensagem própria no card |
| Vincular cliente no drawer (`:383-389`) | `updateCase(id, { clientId })`; falha de RLS vira `stageError`/toast (`:1036-1043`) |

Na visão **Calendário**, o caso é posicionado no dia em que entrou na etapa
atual (`stageChangedAt`) — `posvenda_cases` não tem coluna de prazo
(`:625-627`, `:662-663`); caso sem essa data some da visão e é contado num
rodapé próprio (`:760-762`).

Na visão **Análise** (`KanbanAnalyticsPanel`, `:1185-1195`), as estatísticas
específicas são Valor Total + contagem por empresa — a distribuição por tipo de
caso não tem coluna equivalente na tabela (`:1074-1086`).

**Entidades ligadas:** `posvenda_cases` (tabela própria, criada em
`20260770_posvenda_kanban.sql:27-40`; `lead_id` é `text` com
`ON DELETE SET NULL`, `:30`) · `leads` (negócio de origem; `sent_to_posvenda_at`
marca o envio, `:9-10`) · `clients` (vínculo opcional, alimenta
`get_client_timeline`) · `rh_pipeline_stages` domínio `posvenda` ·
`rh_stage_fields` domínio `posvenda` · `rh_stage_history` ·
`profiles`/usuários (responsáveis, menções). `canWrite` é calculado no cliente
a partir de `roles` (admin/gerente/vendedor, `use-posvenda.js:51`).

---
## 3.10 Pedidos — `/pedidos`


Componente: `src/components/views/PedidosView.jsx` (`App.jsx:2538-2552`).
`isAgencia`, `isPureMarketing` e `isPureRH` redirecionados (`App.jsx:2539`).
`canOperate` = suporte, vendedor, gerente ou admin (`App.jsx:2547`).

**Visões (L2):** uma só — Kanban por situação. Não há toggle de visão, tabela,
calendário nem análise. O header (título, contadores, Exportar CSV, "Novo
pedido") é renderizado antes do bloco de conteúdo (`PedidosView.jsx:121-144`) e
o `FilterBar` (`:154-167`) fica fora do `loading` — busca por nome do cliente,
nº do pedido ou nº do Kronosys, mais Empresa, Vendedor e Origem. O array
`filtrados` (`:89-103`) alimenta o quadro e o export.

As colunas são as `SITUACOES` com `interno !== false`
(`COLUNAS_INTERNAS`, `use-orders.js:30`): Enviado · Conferência · Confirmado ·
Em produção · Faturado · Cancelado. `rascunho` fica de fora de propósito — é o
carrinho aberto do cliente no portal (`use-orders.js:15-18`).

**Campos do pedido** — sem arquivo de constants; o `SELECT` do hook é a lista
real (`src/hooks/use-orders.js:40-44`), e o formulário de criação é inline em
`src/components/pedidos/NovoPedidoModal.jsx`.

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `company_id` | Empresa | select | trocar limpa cliente e itens (`NovoPedidoModal.jsx:94-97`) |
| 2 | `origem` | Como chegou | select | `ORIGENS` (`use-orders.js:32-38`); o modal esconde `portal` (`NovoPedidoModal.jsx:102`) |
| 3 | `client_id` | Cliente | select | só clientes com a empresa em `companyIds` (`:86`) |
| 4 | `ordem_compra_cliente` | Ordem de compra do cliente | text | "opcional — sai na nota" (`:117`) |
| 5 | itens | Itens | lista | produto + quantidade; **preço não é digitável** — vem de `client_products.price` (`:46-53`, `:61-65`) |
| 6 | `situacao` | — | select | nasce fixo em `"conferencia"` (`:74`) |
| 7 | `kronosys_numero` | Nº no Kronosys | text | só no drawer, salvo no `onBlur` (`OrderDetailDrawer.jsx:207-227`) |
| 8 | `observacao` | Observação | text | exibido no drawer (`OrderDetailDrawer.jsx:115`); sem campo no modal de criação |
| 9 | `total` | Total | currency | calculado pelo trigger `recalc_order_total` no banco, nunca enviado pela tela (`use-orders.js:9-11`, `OrderDetailDrawer.jsx:164-167`) |
| 10 | `numero` | # | number | gerado no banco; usado no card e no header do drawer |
| 11 | `confirmed_by` / `confirmed_at` | Confirmado por | — | só leitura, aba Dados (`OrderDetailDrawer.jsx:194-196`) |
| 12 | `contact_id` / `address_id` | — | — | estão no `SELECT` (`use-orders.js:41`) e não têm campo em nenhuma tela desta rota |

**Abas do drawer / painéis (L3):** `OrderDetailDrawer` usa `SplitPanelDrawer`
com `DetailDrawerTabs` próprio (`OrderDetailDrawer.jsx:19-24`).

| Aba | Conteúdo | Entidade relacionada |
|---|---|---|
| Itens | tabela Produto/Qtd/Unitário/Subtotal + Total; `thead` sempre presente (`:120-168`) | `order_items`, `products` |
| Dados | Empresa, Origem, Confirmado por (`:190-197`) | `orders` |
| Histórico | movimentações de situação, data → de/para → quem (`:169-189`) | `order_stage_history` (`use-orders.js:132-142`) |
| Anexos | texto fixo descrevendo o que viveria ali; nenhum upload implementado (`:198-202`) | — |

Painéis fixos: coluna esquerda com Cliente, Ordem de compra, Observação e
Criado em (`:110-118`); coluna direita com o campo Nº do Kronosys, o
`StageNavigator` e a cidade de entrega (`:204-241`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no card (`PedidosView.jsx:196`) | abre o drawer; não muda URL |
| "Novo pedido" (header `:136-142` e FAB `:216`, só `canOperate`) | abre `NovoPedidoModal`; ao salvar, `AppToast` "Pedido criado." (`:240`) |
| Escolher cliente no modal (`NovoPedidoModal.jsx:46-53`) | busca `client_products` ativos daquele cliente e zera os itens já montados |
| "+ Adicionar produto…" (`:154-163`) | só lista o que está liberado pra aquele cliente e pertence à empresa escolhida (`:55-57`); sem nenhum liberado, mostra aviso em `var(--warning)` apontando Clientes → Produtos & Preços (`:164-169`) |
| "Criar pedido" (`:191-195`) | recusa sem cliente e sem item (`:68-69`); insere em `orders` e depois em `order_items` (`use-orders.js:72-85`) |
| Campo Nº do Kronosys, no `onBlur` (`OrderDetailDrawer.jsx:69`) | grava; a mensagem de erro da trava do banco é propagada como veio (`use-orders.js:90-92`) |
| `StageNavigator` no drawer (`:230-236`) | sem Kronosys preenchido, "Confirmado", "Em produção" e "Faturado" somem da lista de destinos (`:62-65`); a garantia real é o trigger `orders_guard_stage_change` (`:58-60`) |
| "Exportar CSV" (`PedidosView.jsx:106-115`) | 8 colunas montadas inline com `csvRow`/`triggerDownload`, sobre `filtrados` |

Não há arrastar-e-soltar: o card é um `<button>` que só abre o drawer
(`PedidosView.jsx:33-35`) — a única forma de mover um pedido é o
`StageNavigator` do drawer, e ele só aparece com `canOperate` (`:229`).

Dois sinais de tempo na mesma tela: a faixa de aviso do topo
(`PedidosView.jsx:146-152`) e o selo "N DIAS" no card (`:41-46`), os dois com
o mesmo limiar de 3 dias (`DIAS_PARADO`, `:22`; `use-orders.js:101`) aplicado a
`conferencia`, `confirmado` e `producao`.

**Entidades ligadas:** `orders` · `order_items` · `order_stage_history` ·
`client_products` (preço negociado, lido no modal de criação) · `products`
(nome do item, via `useProducts`) · `clients` (nome, cidade, `ownerIds` — o
filtro por vendedor usa o dono do **cliente**, não do pedido,
`PedidosView.jsx:94-97`) · `profiles`/usuários.

---
## 3.11 Clientes — `/clientes`


Componente: `src/components/client/ClientsManager.jsx` (`App.jsx:2574-2609`).
`isAgencia`, `isPureMarketing` e `isPureRH` redirecionados (`App.jsx:2575`).
`canDelete` = `isManager`; `canReleaseProducts` = vendedor/gerente/admin
(`App.jsx:2589`).

**Visões (L2):** uma só — tabela com filtro, em painel único
(`ClientsManager.jsx:253`). Abaixo de `md` a tabela de 9 colunas é substituída
por cards (`:327` e `:414`), com o mesmo array `paged`. Não há toggle de
densidade nem abas de nível de página. Os controles são busca por nome, cidade,
CNPJ ou categoria (`:110-119`), a caixa "Somente oportunidades de cross-sell"
(`:120-122`, `:297-300`), ordenação por clique no cabeçalho (`:169-174`) e
paginação de 50 em 50 (`PAGE_SIZE`, `:79`; `:166-168`, `:490-507`). Nenhum
desses estados persiste em reload.

**Colunas da tabela** (`ClientsManager.jsx:129-139`, ordem real): Nome ·
Categoria · Cidade / UF · CNPJ · Cross-sell (não ordenável) · Produtos ·
Último pedido · Ticket médio (numérica) · ações. Cross-sell, Produtos, Último
pedido e Ticket médio são derivados dos negócios **ganhos** do cliente, não de
colunas de `clients` (`statsByClient`, `:95-108`); `wonDate`/`wonValue` leem
antes os custom fields `data_fechamento` e `valor_final` da etapa Ganho
(`:34-40`).

**Campos do cliente** (formulário inline em `ClientDetailModal`, aba Dados;
forma do registro em `src/hooks/use-clients.js:11-30`):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `name` | Nome * | text | obrigatório; trava o botão Salvar (`ClientsManager.jsx:901`) |
| 2 | `razaoSocial` | Razão social | text | preenchido pelo lookup de CNPJ; abaixo dele aparece o selo de situação cadastral (`:702-711`) |
| 3 | `category` | Categoria | select | `CLIENT_CATEGORIES` (`client-categories.js:5-12`): posto, condomínio, indústria, comércio, transporte, outro |
| 4 | `cnpj` | CNPJ | text | chave de dedup; campo fica com borda `--danger` quando há duplicado (`:730`) |
| 5 | `city` | Cidade | text | `:766-772` |
| 6 | `state` | UF | select | lista `BR_STATES` hardcoded no arquivo (`:24`) |
| 7 | `address` | Endereço | text | `:783-794` |
| 8 | `companyIds` | Empresas relacionadas * | multi (chips) | obrigatório na prática — o save recusa com array vazio porque a RLS exige overlap (`:215-217`) |
| 9 | contato principal | Nome / Cargo / E-mail / Telefone | text ×4 | **só no cadastro novo** e só com `canReleaseProducts` (`:828-844`); ao editar, contato vive na aba Contatos |
| 10 | `ownerIds` | Vendedor responsável | user (multi) | `AssigneeMultiSelect` sobre `vendedores`; vazio = qualquer vendedor da empresa opera (`:851-861`) |
| 11 | `notes` | Observações | textarea | `:863-868` |

Campos que existem no registro e não têm campo no formulário:
`externalCodes` e `status` (`use-clients.js:23-24`).

**Abas do drawer / painéis (L3):** o detalhe é um `EntityProfileModal`
(`ClientsManager.jsx:653-675`), não um `SplitPanelDrawer`. Para cliente novo há
só a aba Dados; para cliente já salvo, quatro (`:644-650`).

| Aba | Conteúdo | Entidade relacionada |
|---|---|---|
| Dados | formulário acima + "Resumo comercial" (ticket médio, produtos distintos, empresas atendidas, último pedido) quando há negócio ganho (`:870-894`) | `clients`, `leads` |
| Produtos & Preços | tabela Produto/Tabela/Margem/Preço do cliente (`ClientProductsTab.jsx:225`); é onde o preço do cliente nasce (`ClientProductsTab.jsx:8-14`) | `client_products`, `products`, `margin_rules` |
| Contatos | tabela Nome/Cargo e papel/Contato (`ClientContactsTab.jsx:175`) — comitê de compra | `client_contacts` |
| Histórico | linha do tempo cronológica única (`ClientTimelinePanel`, `:1151`) + painel de ata por voz no topo (`:1224-1235`) | RPC `get_client_timeline` |

O modal tem ainda um botão "Registrar aprendizado" no header, que abre
`SalesCaseVoicePanel` por cima de qualquer aba (`:661-670`, `:676-687`).

A linha do tempo separa passado de futuro: item com `ts` futuro (visita
planejada, follow-up agendado) sai da lista principal e não conta em "Só
interações" (`:1168-1184`). Os `kind` mapeados são comentário, nota, etapa,
follow-up, visita, amostra, anexo, posvenda, e-mail, proposta e ata
(`TIMELINE_KIND_ACTIVITY`, `:960-974`), mais faturamento, que tem meta própria
(`:977`). O hook não assina Realtime, por decisão registrada no arquivo
(`use-client-timeline.js:8-13`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no nome do cliente (`:354-359`) | abre o modal na aba **Histórico** quando há negócio vinculado, e na aba **Dados** quando não há |
| Ícone de lápis (`:395-398`) | abre o modal sempre na aba Dados |
| Ícone de lixeira (`:399-404`, só `canDelete`) | abre confirmação que declara quantos negócios perdem a referência (`:553-575`) |
| "Novo cliente" (`:274-281`) | abre o modal em branco; carrega `data-tour="clientes-novo-cliente"`, alvo do spotlight 4.71.0 (`feature-spotlights.js:204-215`) |
| "Importar planilha" (`:265-273`, só `isManager`) | `onOpenImport` — abre o importador de base, montado no `App.jsx` |
| Botão "Buscar" ao lado do CNPJ (`:731-738`) | `useCnpjLookup`; só preenche Nome, Razão social, Endereço, Cidade e UF que estiverem **vazios** (`:626-637`), e grava a situação cadastral num selo |
| CNPJ já existente (`:750-764`) | aviso inline + botão "Abrir X em vez de criar outro"; o botão Salvar fica desabilitado enquanto o duplicado existir (`:901`) |
| Clique no cabeçalho de coluna ordenável (`:333`) | alterna asc/desc e volta pra página 0 |
| Etiqueta do negócio na linha do tempo (`:1123-1127`) | `onOpenLead(fullLead)` + fecha o modal — abre o drawer do Funil; só funciona quando o lead completo está em `deals` (`:1075`) |
| Título de item de visita na linha do tempo (`:1103-1108`) | `onOpenViagem(viagemId)` → troca a seção pra `crm-viagens` (`App.jsx:2582`) |
| "Registrar aprendizado" (`:661-670`) | abre `SalesCaseVoicePanel` com `client_id` já preenchido |

Erro ao salvar o contato principal não desfaz a criação do cliente: o modal
fecha e o aviso vai num `AppToast variant="danger"` (`:227-232`, `:511-518`).

**Entidades ligadas:** `clients` (dedup por CNPJ, `findClientByCnpj` /
`DuplicateClientError`, `:211`, `:225-226`) · `client_contacts` ·
`client_products` · `products` e `margin_rules` (aba Produtos & Preços) ·
`leads` (estatísticas derivadas e etiquetas da linha do tempo) ·
`crm_viagem_registros` (itens de visita/ata) · `client_billing_history`
(faturamento na linha do tempo) · `posvenda_cases` (item `posvenda` na linha
do tempo) · RPC `get_client_timeline` · edge `cnpj-lookup`.

---
## 3.12 Catálogo — `/catalogo`


Componente: `src/components/views/CatalogoView.jsx` (`App.jsx:2556-2573`).
Única rota do grupo Comercial que **não** barra Marketing — o comentário no
`App.jsx:2557-2558` registra que é porque Marketing mantém a metade vitrine.
`isAgencia` e `isPureRH` são redirecionados (`App.jsx:2559`). Três permissões
separadas: `canEdit` (suporte/gerente/admin), `canEditRules`
(gerente/admin) e `canEditVitrine` (marketing/gerente_marketing/gerente/admin)
(`App.jsx:2564-2571`).

**Visões (L2):** aba Produtos (tabela com filtro) e aba "Regras de margem",
esta última só renderizada quando `canEditRules` (`CatalogoView.jsx:320-323`);
com uma aba só, o `Tabs` nem aparece (`:354`). O header fica fora do
condicional de aba (`:328-352`). A tabela usa `FilterBar` +
`TableDensityToggle` com persistência por tela
(`useTableDensity("catalogo-table-density")`, `:284`) — é a segunda tela da
plataforma a usar o toggle de densidade. Filtros: busca por código ou nome,
Empresa, e Status (Ativos · Inativos · Sem preço de tabela · Todos,
`:376-384`). O array `filtered` (`:288-298`) alimenta a tabela e o export.

**Campos do produto** (formulário inline em `ProductModal`,
`CatalogoView.jsx:69-273`; `SELECT` real em `src/hooks/use-products.js:14-20`).
Metade comercial:

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `company_id` | Empresa * | select | `:152-158` |
| 2 | `sku` | Código * | text | obrigatório (`:108`); placeholder "SAN-BB-1000" |
| 3 | `name` | Nome * | text | obrigatório (`:108`) |
| 4 | `unit` | Unidade | select | `UNIDADES` hardcoded: un, kg, m, m², pç, cx (`:40`) |
| 5 | `moq` | Pedido mínimo | number | `:180-184` |
| 6 | `preco_tabela` | Preço de tabela | number | vazio dispara aviso inline em `var(--warning)` (`:192-197`) |
| 7 | `certifications` | Certificações | multicheck | vocabulário fechado, `CERTIFICACOES` (`:31-33`): INMETRO, ANTT 5998, NORMAM-05, ANP, ISO 9001, FSSC 22000 |
| 8 | `homologado` | Homologado | checkbox | libera as três restritas `RESTRITAS` (`:38`); desmarcar limpa as três do formulário junto (`:224-230`) |
| 9 | `active` | Ativo no catálogo | checkbox | `:241-245` |

Metade vitrine (`src/components/catalogo/VitrineFields.jsx`, campos desativados
quando `!canEditVitrine`, com faixa explicando que o que for digitado não é
salvo, `:106-113`):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 10 | `tagline` | Chamada | text | `VitrineFields.jsx:116` |
| 11 | `description` | Descrição | textarea | `:123` |
| 12 | `features` | Destaques | lista de textos | uma linha por item (`StringList`, `:37-65`) |
| 13 | `specs` | Especificações | lista de pares rótulo/valor | jsonb, não dois arrays paralelos (`SpecList`, `:67-100`) |
| 14 | `applications` | Aplicações | lista de textos | `:142` |
| 15 | `category` | Categoria | select | `CATEGORIAS` hardcoded: Resibag®, EPI & Segurança, Movimentação, Compliance (`:10-15`) |
| 16 | `proposed` | Produto conceitual | checkbox | aparece na vitrine como proposta, sem valer como item de catálogo (`:161-170`) |
| 17 | `icon` | — | text | está em `emptyForm` e no payload de save (`CatalogoView.jsx:49`, `:127`) e **não tem campo em nenhuma das duas abas** |

**Regras de margem** (`MarginRulesPanel.jsx`, aba separada): um eixo só, com
sinal — a variação percentual sobre o preço de tabela, `+20` = 20% acima,
`−10` = 10% de desconto (`:10-15`, `:122-127`). Dois níveis: regra padrão por
empresa (`:210-242`) e exceções por produto, que ganham da padrão
(`:104-106`, `:244-281`). Cada regra tem "Avisar abaixo de"
(`margem_aviso_pct`) e "Nunca abaixo de" (`margem_minima_pct`), com validação
de que o aviso não pode ficar abaixo do mínimo (`:64-67`) e de que ao menos um
dos dois precisa estar preenchido (`:60-63`).

**Abas do drawer / painéis (L3):** não há drawer. O detalhe do produto é o
`ProductModal` (`Modal` compartilhado, 520px, `CatalogoView.jsx:139`), com duas
abas internas — Comercial e Vitrine (`Tabs`, `:144-148`). A aba de abertura é
Comercial pra quem tem `canEdit` e Vitrine pra quem não tem (`:95`). O
formulário é semeado por `editing?.id`, não pelo objeto, pra um refetch do
Realtime no meio da digitação não apagar o que foi escrito (`:76-97`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Ícone de lápis na linha (`:456-462`, só `canEdit`) | abre `ProductModal` com o produto |
| "Novo produto" (`:344-350`, só `canEdit`) | abre o modal em branco; carrega `data-tour="catalogo-novo-produto"`, atributo sem entrada em `FEATURE_SPOTLIGHTS` |
| "Cadastrar o primeiro produto" no estado vazio (`:423-428`) | mesmo modal; só aparece quando `products.length === 0` e `canEdit` |
| "Salvar" no modal (`:107-136`) | recusa sem código ou nome; o erro do banco (constraint `products_certificacao_restrita`) volta cru na faixa `--danger-bg` (`:252-257`) |
| Marcar/desmarcar "Homologado" (`:220-231`) | esconde ou revela as três certificações restritas e as remove do formulário ao desmarcar |
| "Exportar CSV" (`:301-309`) | 8 colunas sobre `filtered`; certificações unidas por `\|` |
| `TableDensityToggle` (`:386`) | alterna o padding da linha entre `6px` e `11px` (`rowPad`, `:286`); persistido em `localStorage` por tela |
| "Definir"/"Editar" numa linha de regra padrão (`MarginRulesPanel.jsx:227-237`) | abre `RuleModal`; ao editar, Empresa e "Aplica a" ficam travados (`:91`, `:99`) |
| "Adicionar exceção" (`MarginRulesPanel.jsx:249-253`) | abre o mesmo `RuleModal` sem regra prévia |
| Lixeira numa exceção (`MarginRulesPanel.jsx:274-277`) | `delete` direto na tabela, sem confirmação |

Produto não é apagado: sai do catálogo desativando, porque `order_items`
referencia `products` com `ON DELETE RESTRICT`
(`use-products.js:71-74`); a tela mostra produto inativo com `opacity: 0.55`
(`CatalogoView.jsx:432`). Update de regra de margem que volta zero linha é
tratado como recusa de RLS e vira mensagem explícita
(`MarginRulesPanel.jsx:180-183`).

Dois sinais sobre preço ausente: a faixa de aviso do topo da aba Produtos
(`:360-366`, contando `stats.semTabela` = ativos sem preço,
`use-products.js:79`) e a célula "sem tabela" em `var(--warning)` na própria
linha (`:443-447`).

**Entidades ligadas:** `products` (metade comercial e metade vitrine na mesma
linha, separadas por trigger `products_enforce_field_ownership`,
`VitrineFields.jsx:4-8`) · `margin_rules` (aba de regras) · `order_items`
(impede exclusão) · `client_products` (consome `preco_tabela` como base do
preço do cliente, ver 3.A5) · `COMPANIES`.
## 3.13 Biblioteca de Documentos — `/biblioteca-de-documentos`


Componente: `src/components/views/DocumentLibraryView.jsx`, montado em
`src/App.jsx:2506-2510` com `canManage={isManager}`. A rota redireciona pra
`/marketing` quando `isAgencia` e pro painel de Pendências quando `isPureRH`
(`App.jsx:2507`); não há entrada no guard de seção de `App.jsx:2107-2175`, então
todo cargo interno restante abre a tela — em leitura quando não é gerente.

**Visões (L2):** não existe toggle Kanban/Tabela/Calendário. A única alternância
é **grade ↔ lista**, pelo `GridListToggle` no slot `trailing` do `FilterBar`
(`DocumentLibraryView.jsx:258`), estado local `density` sem persistência
(`:187` — `useState("grid")`, não `useTableDensity`). O resto da tela é
`PageHeader` + 1 `StatCard` + `FilterBar` + `CardGrid`
(`:231-259`).

**Filtros (L2):** busca por título ou tag (`:250`, casa contra `d.title` e
`d.tags`, `:194`) e um `<select>` de categoria (`:251-257`). Ambos alimentam o
`filtered` do `useMemo` de `:190-197`; `clearFilters` (`:200`) zera os dois.

**Campos do documento** (`DocumentModal`, `DocumentLibraryView.jsx:38-141`,
ordem real de render):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `title` | Título * | text | `autoFocus`; validação local bloqueia vazio (`:52`) |
| 2 | `category` | Categoria | select | 5 opções fixas em `CATEGORY_LABELS` (`:22-28`): Certificado · Datasheet · Manual · Ficha técnica · Outro. Default `outro` (`:40`) |
| 3 | `expires_at` | Validade (opcional) | date | comparada com `new Date()` em `:292` pra marcar "vencido" |
| 4 | `tags` | Tags (separadas por vírgula) | text | string dividida por vírgula no submit (`:58`) — vira `text[]` |
| 5 | `company_ids` | Empresas * | pills multi | botões por `COMPANY_IDS` (`:101-109`), pinta com `COMPANIES[id].primary`; exige ao menos uma (`:53`) |
| 6 | arquivo | Arquivo | file | `accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"` (`:116`); obrigatório só na criação (`:54`) |

Campos gravados sem aparecer no formulário: `file_name`, `file_path`,
`file_size`, `mime_type`, `uploaded_by` (`use-document-library.js:46-50`). Não
existe campo por etapa — a biblioteca não tem pipeline.

**Abas do drawer / painéis (L3):** não existe drawer de detalhe. Os três
overlays da tela são modais sobre `ui/Modal.jsx`:

| Overlay | Gatilho | Conteúdo |
|---|---|---|
| `DocumentModal` (novo) | botão "Novo documento" no `PageHeader` (`:237`) ou no `EmptyState` (`:271`) | os 6 campos acima |
| `DocumentModal` (editar) | ícone `Pencil` no slot `menu` do card (`:304`) | idem, com aviso de que trocar o arquivo atualiza todos os negócios que já anexaram (`:121-123`) |
| `ConfirmDeleteDocumentModal` | ícone `Trash2` no slot `menu` (`:308`) | texto diz que negócios que já anexaram perdem a referência (`:164-165`); botão "Excluir" em `var(--danger)` |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no corpo do card | dispara download: `getSignedUrl` (1h, `use-document-library.js:108`) e `<a download>` sintético (`:216-227`); enquanto corre, o nome do arquivo vira "Baixando…" (`:316`) |
| Salvar documento novo | insere a linha em `document_library` com `id` gerado no cliente e **depois** sobe o arquivo; falha no Storage apaga a linha (rollback explícito, `use-document-library.js:56-61`) |
| Salvar edição com arquivo novo | `replaceFile` sobrescreve o objeto no bucket (`upsert: true`, `:85`) mantendo o mesmo `file_path`; se o UPDATE seguinte voltar zero linha, a mensagem diz que o arquivo já subiu mas o registro não atualizou (`:94-96`) |
| Salvar edição sem arquivo | só `update` de metadados; zero linha = RLS barrou, erro explícito (`:74`) |
| Excluir | remove do bucket e depois a linha (`:99-104`); sem transação |
| Validade no passado | rodapé do card ganha " (vencido)" (`:301`) e uma linha "Certificado vencido" em `var(--danger)` (`:320-322`) |

**Entidades ligadas:**

- `document_library` — a linha de metadados (`use-document-library.js:12`).
- bucket `document-library` — o arquivo em si (`:13`); a policy de INSERT do
  Storage exige a linha já existente, por isso o `id` nasce no cliente
  (comentário `:4-10`).
- `lead_document_refs` — a referência "anexar da biblioteca" a um negócio,
  lida/escrita pelo hook irmão `useLeadDocumentRefs` (`:118-151`), consumido
  na aba Anexos do `LeadDetailDrawer`, não nesta tela. Esta tela **não lista**
  quantos negócios referenciam um documento.
- `COMPANIES` / `COMPANY_IDS` (`src/constants/companies.js`) — as pílulas de
  empresa e o rótulo curto no card (`:318`).

Não há botão "Exportar CSV" nesta tela (a regra 1 do `CLAUDE.md` lista 16
boards com export; este não está entre eles).

---
## 3.14 Cross-sell — `/cross-sell`


Componente: `src/components/views/CrossReferralsView.jsx` (205 linhas), montado
em `src/App.jsx:2681-2690`. Gate duplo: a rota devolve `<Navigate>` pro painel
de Pendências quando não é `isManager` (`App.jsx:2689`), e `crossref` está na
lista `managerOnly` do guard de seção (`App.jsx:2107`). O item de menu só é
inserido pra `isManager` (`App.jsx:1894`).

**Visões (L2):** não existe toggle de visão nem filtro. A tela é uma coluna
única com três blocos fixos, nesta ordem: faixa de 3 `StatCard`
(`:41-48`), seção "Overlap" (`:50-127`) e seção "Sugestões de cross-sell"
(`:129-192`). Quando os dois arrays estão vazios, um `EmptyState` substitui
ambos (`:194-200`).

**Campos do registro de cross-sell** — não há formulário; nada é digitado nesta
tela. O array vem derivado de `buildCrossReferrals(leads, overrides)`
(`src/data/cross-referrals.js:70-81`), chamado pelo `useCrossReferrals`
(`src/hooks/use-cross-referrals.js:15-18`). Campos que a tela lê:

| # | Campo | Origem | Onde aparece |
|---|---|---|---|
| 1 | `type` | `"overlap"` (derivado) ou `"suggestion"` (semente fixa) | separa os dois blocos (`CrossReferralsView.jsx:24-25`) |
| 2 | `status` | `"active"` nos overlaps, `"pending"` nas sugestões, sobrescrito por `approved`/`rejected` | conta o `StatCard` "Aprovadas" (`:23`) e filtra sugestões (`:25`) |
| 3 | `companyName` | `leads[0].company` do grupo | título do bloco (`:69`, `:148`) |
| 4 | `sector` · `city` | do primeiro lead do grupo | subtítulo (`:74`, `:153`) |
| 5 | `totalValue` | soma de `lead.value` do grupo (`cross-referrals.js:58`) | "Valor consolidado", via `formatK` (`:85`) |
| 6 | `leads[]` | `{id, companyId, owner, value, stage, fitScore}` (`cross-referrals.js:54-57`) | uma linha por negócio, com `CompanyTag`, nome do responsável, etapa, `FitScoreCircle` e valor (`:90-115`) |
| 7 | `presentIn` | `Array.from(new Set(companyId))` do grupo | origem da seta na sugestão (`:161`) |
| 8 | `suggestedFor` | campo da semente | destino da seta (`:163`) |
| 9 | `confidence` | campo da semente | `Badge variant="success"` "Confiança N%" (`:150`) |
| 10 | `reason` | campo da semente | linha "Racional:" (`:166`) |

Como o overlap é derivado: `computeOverlaps` agrupa os leads por nome de
empresa normalizado — minúsculas, com o que estiver entre parênteses removido
(`cross-referrals.js:40`) — e só emite o grupo quando ele tem mais de um
`companyId` distinto (`:47`). O id do overlap é `cross_<chave normalizada>`
(`:49`), então ele muda se o nome da empresa mudar no negócio.

De onde vêm as sugestões: **duas constantes fixas no código**,
`SYNTHETIC_CROSS_SUGGESTIONS` (`cross-referrals.js:5-32`) — Yara Brasil
Fertilizantes e Suzano S.A., ambas `presentIn: ["industria"]`,
`suggestedFor: "resibag"`. O comentário do arquivo as chama de "Synthetic
seeds — same as v3" e diz que não são derivadas dos leads (`:3-4`). Não há
tabela de banco por trás delas.

**Abas do drawer / painéis (L3):** não existe drawer, modal, nem overlay nesta
tela. Nenhum elemento da tela é clicável para abrir detalhe — nem o bloco de
overlap, nem a linha de negócio dentro dele (`:90-115` não tem `onClick`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Aprovar indicação" (`:169-176`) | `approve(id)` grava `{status:"approved", approvedAt}` no objeto de overrides (`use-cross-referrals.js:20-25`) |
| "Rejeitar" (`:177-186`) | `reject(id)` grava `{status:"rejected", rejectedAt}` (`:27-32`) |
| Efeito dos dois | o override é persistido em `localStorage` sob `gs_<V>_cross_referral_overrides` (`use-cross-referrals.js:10-13` + `src/constants/storage-keys.js:13`), via `usePersistentState`. Nada vai pro banco; a decisão é por navegador e por usuário. |
| Depois de aprovar | a sugestão sai do bloco (o filtro exige `status === "pending"`, `:25`) e o `StatCard` "Aprovadas" incrementa. Nenhum registro é criado em outro módulo e não há navegação. |
| Overlap novo aparecendo | `App.jsx:1083-1100` dispara `pushNotification` do tipo `cross_sell` pra quem tem `vendedor`/`gerente`/`admin`, com `link: { module: "crm_cross_sell", id }`. O dispatcher mapeia `crm_cross_sell → "crossref"` (`App.jsx:1384`) mas **não** tem setter de "selecionado" (lista explícita em `App.jsx:1399`), então o sino leva à tela e para aí — não destaca a indicação citada. |

**Entidades ligadas:**

- `leads` (o array em memória do `App.jsx`, não uma consulta própria) — única
  fonte real dos overlaps; `useCrossReferrals(leads)` é chamado em
  `App.jsx:371`.
- `profiles` via `users` — só pra resolver o nome do responsável de cada
  negócio (`useUsersById`, `:16`).
- `localStorage` — o único armazenamento de aprovação/rejeição.
- `ExecutiveDashboard.jsx:255-256` consome o mesmo array pra contar
  "pendente ou overlap" numa métrica do Painel Executivo.

Duas cores fora de token nesta tela: `NEUTRAL.amber + "40"` na borda do overlap
(`:63`) e `"var(--color-resibag)"` fixo como cor da seção de sugestões e do
botão "Aprovar" (`:132`, `:142`, `:172`) — cor de frente comercial, não
`var(--accent)`.

---
## 3.15 Explorador de Mercado — `/explorador`


Componente: `src/components/views/ExplorerView.jsx` (246 linhas), montado em
`src/App.jsx:2450-2477`. Redireciona pra `/marketing` se `isAgencia` e pro
painel se `isPureRH` (`App.jsx:2451`); `explorer` está na lista `crmSections`
do guard, o que barra `isPureMarketing`, `isPureRH`, `isPureComex` e `isAgencia`
(`App.jsx:2137-2170`).

**Visões (L2):** duas abas, e elas **só existem pra gerente** — a barra de abas
é renderizada sob `{fairImportPanel && …}` (`:86`), e `fairImportPanel` é
passado apenas quando `isManager` (`App.jsx:2465`). Para quem não é gerente a
tela não tem aba nenhuma, só o conteúdo do Explorador.

| Aba | Conteúdo | Componente |
|---|---|---|
| Explorador (default, `:31`) | card de busca por CNPJ + card de filtros + lista de sugestões + banner de CRM vazio | `CnpjLookupCard` / `ProspectSuggestions` |
| Importar feira | fluxo de upload de planilha de feira | `FairImportView` (`src/components/views/FairImportView.jsx`), passado como prop |

Os botões do cabeçalho ("Limpar", "Importar planilha", "Exportar") somem quando
a aba ativa é "feira" (`:55`).

**Campos do filtro de curadoria** (`ExplorerView.jsx:15-21`, ordem de render):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `search` | *(sem label)* | text | placeholder "Empresa ou CNPJ..." (`:144`); casa contra `company`, `razao_social` e `cnpj` da semente (`ProspectSuggestions.jsx:234`) |
| 2 | `sector` | Setor | select pill | opções de `CANONICAL_SECTORS` (`src/constants/taxonomy.js`) |
| 3 | `state` | UF | select pill | `CANONICAL_STATES` |
| 4 | `size` | Porte | select pill | 3 opções fixas em `SIZE_OPTIONS` (`:23`): PME · Mid-Market · Enterprise |
| 5 | `fitMin` | Fit min | range 0-100 passo 5 | (`:189-195`) |

O contador "Limpar (N)" conta quantos filtros estão fora do default, tratando
`fitMin` à parte (`:36-41`). Os filtros só atingem a lista de sugestões — não
tocam nem no CNPJ lookup nem no botão Exportar.

**Campos do lead criado pela busca de CNPJ** (`CnpjLookupCard.jsx:45-87`): o
formulário é de um campo só (o CNPJ, `:120-125`) mais a escolha da empresa do
Grupo (`:257-276`). O objeto gravado carrega 30 chaves preenchidas a partir da
resposta da edge function: `cnpj`, `company`, `razaoSocial`, `sector`, `cnae`,
`size`, `city`, `state`, `address`, `capitalSocial`, `contactEmail`, `phone`,
`situacao`, mais os fixos `trigger: "Prospecção ativa"`,
`triggerLabel: "Entrada manual via Receita Federal"`, `fitScore: 60`,
`probability: 0.15`, `stage/status: "prospeccao"`, `owner: null`, `value: 0` e
`closeDate` em +45 dias (`:64-83`). O `id` é `lead_${Date.now()}` (`:49`).

**Campos da semente de prospecção** (`ProspectSuggestions.jsx`, lidos de
`prospect_seeds`): `company`, `razao_social`, `cnpj`, `sector`, `city`,
`state`, `size`, `fit_score`, `source`, `evidence`, `relevant_for[]`,
`public_signals[]` (`{source, label, detail, year}`, renderizados como pílulas
em `:144-156`), `enabled`. O `seedToLead` (`:16-55`) converte a semente num
lead com `fitScore` default 65, `probability: 0.1`, `closeDate` em +60 dias e
`triggerLabel: "Curadoria Inteligência Sanwey"`.

**Abas do drawer / painéis (L3):** não existe drawer de detalhe — clicar num
card de sugestão não abre nada; o card só tem os botões de empresa e
"Adicionar". O único overlay é o `ImportModal`
(`src/components/lead/ImportModal.jsx`), de 3 passos (`:193`,
`:440-442`): 1 upload do arquivo, 2 mapear colunas, 3 prévia e importação. Os
13 destinos de mapeamento estão em `CRM_FIELDS` (`ImportModal.jsx:12-26`) —
`cnpj` (marcado `*`), `company`, `sector`, `city`, `state`, `phone`,
`contactEmail`, `value`, `owner`, `stage`, `clientClassification`, `notes`,
mais "— Ignorar —"; há auto-detecção por nome de coluna (`AUTO_DETECT_MAP`,
`:29+`).

Na aba "Importar feira", o `FairImportView` detecta 18 colunas do padrão
Swapcard/RD Station Events (`SWAPCARD_COLUMNS`, `FairImportView.jsx:16-35`) e
vincula o lote a uma **campanha de canal "Evento"** em vez de nome de feira
digitado (`:225-232`, com o racional de por que o texto livre foi trocado). O
estado do fluxo (`fairName`, `fairCampaignId`, `phase`, `rows`, `importResult`)
vive içado no `App.jsx` pra sobreviver à troca de aba (`FairImportView.jsx:216`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Enter ou "Buscar" no CNPJ | `useCnpjLookup.lookup` invoca a edge function `cnpj-lookup` (`use-cnpj-lookup.js:36-38`); erro não-2xx é lido do corpo pendurado em `e.context` pra mostrar a mensagem em português do servidor (`:11-21`) |
| Resultado com `data.cached` | rodapé "cache · atualizado em …" (`CnpjLookupCard.jsx:232-236`) |
| "Adicionar lead" (CNPJ) | chama `onAddLead` (= `handleAddLead` do `App.jsx`) e troca o bloco por "Lead adicionado. Vá pro final da lista ou filtre pelo CNPJ." (`:245`) — **não navega** pro Funil |
| "Adicionar" num card de sugestão | idem; o card vira "Adicionado como lead em <empresa>. Ver na aba Kanban." (`:167`) — também sem navegação |
| CNPJ já existente naquela empresa | o botão fica desabilitado com rótulo "Já existe" e ícone `AlertTriangle` (`ProspectSuggestions.jsx:201-205`); a chave de dedup é `<cnpj só-dígitos>::<companyId>` (`:220`) |
| "Exportar" | `exportLeadsToCSV(leads, …)` **sobre o array cru de leads**, não sobre `filtered` (`ExplorerView.jsx:75`), e registra `logExport(user, "leads_explorer", leads.length)` (`:76`) |
| Ícones dos dois botões | "Importar planilha" usa o ícone `Download` (`:65`) e "Exportar" usa `Upload` (`:72`) |
| Lista com mais de 30 resultados | corta em 30 (`:245`) e mostra "Mostrando 30 de N sugestões · refine os filtros" (`:306`) |
| CRM sem nenhum lead | banner "Carregar demonstração" + atalho pra Configurações (`:220-239`) |

**Entidades ligadas:**

- `prospect_seeds` — a lista de sugestões; consulta filtra `enabled = true` e
  ordena por `fit_score` desc (`use-prospect-suggestions.js:17-21`).
- `leads` — array em memória, usado só pro cálculo de duplicidade
  (`ProspectSuggestions.jsx:216-223`) e pro export.
- edge function `cnpj-lookup` — Receita Federal via SERPRO/BrasilAPI; o card diz
  "BrasilAPI" no subtítulo (`CnpjLookupCard.jsx:113`).
- `marketing_campaigns` (canal "Evento") — via RPC/consulta do `FairImportView`,
  chave estável do lote de feira.
- `export_logs` (via `logExport`) — trilha do export.
- `COMPANIES`/`COMPANY_IDS` e `CANONICAL_SECTORS`/`CANONICAL_STATES` — taxonomia
  dos seletores.

O rodapé do cabeçalho da lista anuncia as fontes como texto fixo —
"CNAE/UF · ComexStat · BNDES · IBGE · IBAMA · ANP · ANDA · SNIC"
(`ProspectSuggestions.jsx:266`) — enquanto a procedência real de cada semente
está em `public_signals` linha a linha.

---
## 3.16 Viagens & Despesas — `/viagens`


> Estado do código em `git HEAD` (`26ef804`). Esta tela está sendo alterada em
> paralelo; tudo abaixo foi lido via `git show HEAD:…`, não do working tree.

Orquestrador: `src/components/views/CRMViagensView.jsx` (124 linhas), montado em
`App.jsx:2526-2540`. Redireciona pro painel quando `isAgencia`,
`isPureMarketing` ou `isPureRH` (`:2527`); `crm-viagens` também está em
`crmSections` e em `agenciaBlocked` (`App.jsx:2137`, `:2168`).

**Visões (L2):** **4 abas montadas por cargo**, não 5 —
`CRMViagensView.jsx:25-31`:

| Aba | `id` | Quem vê | Componente |
|---|---|---|---|
| Minhas viagens | `minhas` | quem tem `vendedor`/`gerente` (`COMERCIAL_ROLES`) **ou** `admin` (`:22`) | `CRMViagensPlanejamentoView` |
| Gestão | `gestao` | `gerente` ou `admin` (`MANAGER_ROLES`, `:10`, `:23`) | `CRMViagensGestorView` |
| Relatórios | `relatorios` | idem Gestão | `CRMViagensRelatoriosView` |
| Calculadora | `calculadora` | **todos** — empurrada sem condição (`:31`) | `CRMViagensCalculadoraView` |

Despesas e Prestação de contas **não são abas**: são duas seções dentro de
"Minhas viagens" (`CRMViagensPlanejamentoView.jsx:1812` e `:1857`). A barra de
abas só é renderizada com mais de uma aba disponível (`:72`); sem nenhuma, a
tela mostra "Você não tem acesso a Viagens & Despesas" (`:57-63`).

Cada aba tem sua própria sub-visão Lista/Calendário: "Minhas viagens" alterna
entre grade de `VisitaCard` e `VisitaCalendarView` (`Planejamento:1820-1822`);
"Gestão" alterna entre `VisitasTable` e `TeamWeekCalendar`
(`Gestor:1155-1158`). Os dois calendários consomem o mesmo recorte filtrado que
a lista irmã, com comentário explícito sobre a regra 11 em
`Planejamento:1838-1841` e `Gestor:895-898`.

**Campos da saída externa** (`NovaVisitaModal`,
`CRMViagensPlanejamentoView.jsx:347-540`, ordem real):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `tipo` | Tipo | seletor de 3 | `TIPO_SAIDA` (`src/utils/viagens.js:14-18`): "Visita a cliente" (exige cliente) · "Evento ou feira" · "Outra saída" |
| 2 | `destino_planejado` | Destino / local * | text + autocomplete | `usePlacesAutocomplete` (`:357`), guarda `destino_place_id` junto (`:355`) |
| 3 | `data_planejada` | Data planejada * | date | (`:470`) |
| 4 | `client_id` | Cliente | select | rótulo vira "Cliente *" ou "Cliente (opcional)" conforme `tipoInfo.clienteObrigatorio` (`:475`); tem mini-cadastro embutido (`quickCreateName`, `:363`) |
| 5 | `campaign_id` | Feira / campanha (opcional) | select | só campanhas de canal Evento, via RPC `list_evento_campaigns` (`:104-109`) |
| 6 | `objetivo` | Objetivo | textarea | placeholder "O que você planeja tratar?" (`:500`) |
| 7 | `valor_previsto` | Valor previsto | currency | "Quanto você estima gastar nesta visita" (`:505`) |

**Campos da despesa** (`NovaDespesaModal`, `Planejamento:784-1072`, ordem real):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | comprovante | Comprovante | file / câmera | dois alvos de upload (`:935`, `:940`); alimenta a extração por IA |
| 2 | `categoria` | Categoria * | select | lê `crm_viagem_categorias` ativas; aviso quando a lista está vazia (`:979`) |
| 3 | `contexto` | Onde foi * | 2 pills | `CONTEXTOS` (`src/utils/despesa-referencia.js:25-28`): Capital (centro urbano) · Interior (estrada/rodovia) |
| 4 | `valor` | Valor (R$) * | `CurrencyInput` | `prefix={null}` — o prefixo "R$" vem do rótulo, não concatenado (`:1010`) |
| 5 | `data_despesa` | Data da despesa * | date | (`:1019`) |
| 6 | `registro_id` | Vincular a uma visita | select | opcional; sem vínculo a despesa vira candidata a divergência `sem_visita` |
| 7 | `centro_custo` | Centro de custo * | select | (`:1030`) |
| 8 | `cartao` | Cartão * | select | (`:1039`) |
| 9 | `descricao` | Descrição | text | (`:1050`) |

Validação sequencial no submit, nesta ordem exata: categoria → centro de custo →
cartão → valor > 0 → data → contexto (`:879-889`).

**Abas do drawer / painéis (L3):** não existe `SplitPanelDrawer` aqui. Todo o
detalhe é modal, um por entidade:

| Overlay | Gatilho | Conteúdo / entidade |
|---|---|---|
| `NovaVisitaModal` (`:347`) | "Nova saída externa" (`:1824-1831`) | os 7 campos acima → `crm_viagem_registros` |
| `VisitaDetalheModal` (`:542`) | clique num `VisitaCard` ou num dia do calendário | ações "realizado" (pede destino real, resumo, data real) / "não realizado" (pede motivo) / excluir com confirmação inline (`:544-551`) |
| `NovaDespesaModal` (`:784`) | "Nova despesa" (`:1865-1874`) | 9 campos → `crm_viagem_despesas` + bucket `crm-comprovantes` |
| `DespesaDetalheModal` (`:1159`) | clique numa `DespesaRow` | ver comprovante (URL assinada de 300s, `use-crm-despesas.js:83`), refazer despesa rejeitada |
| `NovaPrestacaoModal` (`:1294`) | "Enviar prestação", na barra que aparece quando há despesa solta marcada (`:1915-1926`) — a caixa de seleção só existe nas despesas com `status_reembolso === "pendente"` (`:1900`) | título sugerido a partir do mês e do destino (`:1674-1675`); salva como rascunho ou já envia |
| `PrestacaoResumoModal` (`:1370`) | clique numa `PrestacaoRow` | enviar rascunho, excluir rascunho |
| `PrestacaoDecisaoModal` (`Gestor:656`) | clique numa `PrestacaoQueueRow` (aba Gestão) | aprovar/rejeitar item a item **ou** em lote, com motivo obrigatório na rejeição; marcar paga |
| `ReferenciasPanel` (`Gestor:360`) | acordeão no fim da aba Gestão (`Gestor:1330`) | edita `referencia_capital` / `referencia_interior` por categoria |

**Seções da aba Gestão** (`CRMViagensGestorView.jsx`, ordem real):
filtros de mês + vendedor no topo (`:1133-1139`) · "Visitas do mês" /
"Calendário do time" (`:1149-1167`) · "Divergências" (`:1169-1208`) · "Análise
cruzada por IA" (`:1211-1225`) · "Prestações a decidir" (`:1240`) · "Despesas
avulsas pendentes de aprovação" (`:1273`) · painel de Referências (`:1330`).

**Seções da aba Relatórios** (`CRMViagensRelatoriosView.jsx`): filtros vendedor +
intervalo de meses (`:428-436`) · 4 KPIs — % do planejado realizado, total
aprovado, total pendente, visitas realizadas (`:451-454`) · 3 KPIs de
divergência — despesas sem visita, visitas sem desfecho, total estourado
(`:462-464`) · barra "% cumprido por vendedor" (só com "todos", `:467-489`) ·
pizza "Despesas por categoria" (`:492-510`) · linha "Tendência mensal" com dois
eixos (`:512-533`) · "Exportar dados do período" (2 CSVs, `:536-549`) ·
"Importar planejamento em lote" (`:551-576`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Calcular N saídas →" (`Planejamento:1782-1808`) | leva paradas + noites sugeridas pra aba Calculadora via `calcSeed` no pai (`CRMViagensView.jsx:36-40`); o bloco só aparece com saída planejada futura (`:1749`) e as saídas vêm pré-marcadas por proximidade de até 2 dias (`:1529-1540`) |
| Upload de comprovante | `complete(receiptExtractionPrompt(...))` do `useAI` lê valor/data/categoria da imagem (`Planejamento:825`); a categoria sugerida só é aplicada se casar com uma cadastrada (`:837-838`) |
| Valor + contexto preenchidos | `avaliarDespesa` compara com a referência da categoria e mostra `ReferenciaAviso` (`:768`, `:1012-1014`); sem contexto informado assume Capital e **diz** que assumiu (`despesa-referencia.js:50-55`) |
| Gestor decide um reembolso | o vendedor recebe `pushNotification` do tipo `reembolso_decidido` (`Planejamento:1582-1597`), comparando contra o último status visto por despesa, não contra "pendente" fixo |
| "Usar como valor previsto" (Calculadora) | grava `valor_previsto` dividido igualmente entre as saídas marcadas, escrevendo direto em `crm_viagem_registros` sem passar pelo hook (`Calculadora:586-595`); `window.confirm` nativo antes de sobrescrever valor já existente (`:582`) |
| Rota preenchida na Calculadora | invoca a edge function `distance-matrix` com os `placeIds` (`Calculadora:355`); as noites são sugeridas por faixa de km — ≤150 → 0/0, ≤400 → 1/0, acima → 2/1 (`:500`) — e param de se auto-ajustar assim que o usuário encosta no contador (`:445-446`) |
| Importar planejamento (Relatórios) | aceita `.csv`/`.xlsx` com `destino_planejado`, `data_planejada`, `objetivo`, `cliente_nome`, por ordem ou por cabeçalho (`:563`); cria as visitas **em nome de quem está logado**, e o bloco é negado a quem não é comercial nem admin (`:556-559`) |
| Notificação de despesa pelo sino | `crm_despesas → "crm-viagens"` (`App.jsx:1383`) troca a seção; `crm_despesas` está na lista dos módulos sem setter de "selecionado" (`App.jsx:1399`), então não abre a despesa citada |
| Deep-link de viagem | `initialSelectedViagemId` vem do painel de Conexões do Cliente (`App.jsx:2593`); gestor cai na aba "Gestão" (que não abre detalhe por id, `CRMViagensView.jsx:49-51`), vendedor cai em "Minhas viagens", que consome o id (`Planejamento:1570-1575`) |

**Entidades ligadas:**

- `crm_viagem_registros` — a saída externa (`use-crm-viagens.js:15`), com
  Realtime debounçado a 400ms (`:31`).
- `crm_viagem_despesas` — a despesa (`use-crm-despesas.js:17`), idem Realtime;
  `categoria` é **texto** (o nome), não FK (`Gestor:869-872`).
- `crm_viagem_prestacoes` — o agrupamento pra decisão em lote
  (`use-crm-viagem-prestacoes.js:23`); status em `STATUS_PRESTACAO`
  (`viagens.js:59-66`): rascunho · enviada · aprovada · rejeitada · parcial ·
  paga.
- `crm_viagem_categorias` — categoria + `referencia_capital` /
  `referencia_interior` (`use-crm-viagem-categorias.js:15`, `:71`).
- bucket `crm-comprovantes` (`use-crm-despesas.js:5`), upload com `upsert: true`
  e leitura por URL assinada de 300s.
- `clients` — vínculo da visita; `marketing_campaigns` de canal Evento — vínculo
  de feira.
- edge functions `places-autocomplete` (endereço) e `distance-matrix`
  (distância/custo); `ai-assistant` via `useAI` para ler o comprovante e para a
  "Análise cruzada por IA" do gestor.
- `crm_viagem_registros` também é lido por `AtaVozPanel.jsx:255` (casar ata de
  voz com visita) e por `use-client-timeline.js` (linha do tempo do cliente);
  `crm_viagem_despesas.valor` alimenta o cálculo de CAC (`src/utils/cac.js:57`).

Três status convivem na tela, com vocabulários distintos: `STATUS_VISITA`
(planejado/realizado/não realizado/cancelado, `viagens.js:41-46`),
`STATUS_REEMBOLSO` (pendente/aprovado/rejeitado/pago, `:48-53`) e
`STATUS_PRESTACAO` (6 valores, `:59-66`).

---
## 3.17 Comex — `/comex`


Componente: `src/components/views/ComexView.jsx` (1514 linhas), montado em
`App.jsx:2691-2695` só para `isComex || isDiretoria`, com
`canWrite={isComex}` — diretoria abre em leitura. O guard de seção repete a
negação (`App.jsx:2150-2152`), e `isPureComex` é jogado de volta pra `/comex`
ao tentar qualquer rota comercial (`App.jsx:2160-2162`). Quem só tem `comex`
recebe um grupo de menu de item único (`App.jsx:1902-1905`).

**Visões (L2):** dois níveis de alternância.

1. **Sub-view Importação / Exportação** — toggle de 2 botões renderizado no
   `headerExtra` do board (`:1490-1505`). Não são duas telas: é o mesmo
   `ComexBoard` instanciado duas vezes, com `key` distinta, parametrizado por
   `IMPORT_CONFIG` / `EXPORT_CONFIG` (`:1507-1511`). Trocar de sub-view
   remonta o board inteiro — o estado de busca e de visão se perde.
2. **Kanban · Tabela · Calendário · Análise** (`:1283-1286`), estado
   `viewMode` local do board (`:1088`). As quatro consomem o mesmo
   `filteredOperations` (`:1206-1215`), com comentário citando a regra 11.

A busca fica fora do bloco condicional de `viewMode` (`:1274-1281`,
`dataTour="comex-busca-card"`) e casa contra `title`, `supplierName`,
`buyerName` e `buyerCountry` — a união dos dois domínios, de propósito
(`:1200-1205`). Não há filtro de empresa, de responsável nem de etapa.

**Campos da operação de Importação** (`use-comex-import-operations.js:6-35`,
ordem do mapeamento):

| # | `id` | Label na tela | Tipo | Observação |
|---|---|---|---|---|
| 1 | `title` | Título | text | único obrigatório na criação (`ComexView.jsx:990`) |
| 2 | `supplierName` | Fornecedor | text | no modal de criação e no slot `left` do drawer (`:259-275`) |
| 3 | `companyIds` | Empresa(s) | pills multi | `CompanyPillSelect` (`:236`) |
| 4 | `ownerIds` | Responsáveis | multi-select | `AssigneeMultiSelect`; render `AvatarStack` no card (`:458`) |
| 5 | `currency` | Moeda | select | 3 opções fixas: USD · EUR · JPY (`:283-285`) |
| 6 | `fobValue` | FOB / FCA (moeda) | number | calculadora (`:317`) |
| 7 | `freightValue` | Frete internacional (moeda) | number | (`:318`) |
| 8 | `insuranceValue` | Seguro internacional (moeda) | number | (`:319`) |
| 9 | `ptaxRate` | PTAX do dia | number | digitado à mão; rodapé diz "sem integração automática nesta fase" (`:369`) |
| 10 | `estimatedTaxesBrl` | Impostos estimados (BRL) | number | (`:321`) |
| 11 | `estimatedFeesBrl` | Taxas/despesas estimadas (BRL) | number | (`:322`) |
| 12 | `stage` / `stageChangedAt` | — | derivado | etapa e data da última mudança |
| 13 | `customFields` | Campos desta etapa | jsonb | de `rh_stage_fields`, domínio `comex_importacao` |
| 14 | `starred` · `activities` · `notes` | — | jsonb/bool | comentários e log dentro da linha |

**Campos da operação de Exportação** (`use-comex-export-operations.js:6-32`):
`title` · `buyerName` (Comprador) · `buyerCountry` (País do comprador) ·
`companyIds` · `ownerIds` · `currency` (mesmas 3 opções) · `saleValue` (Valor da
venda) · `ptaxRate` · `stage`/`stageChangedAt` · `customFields` · `starred` ·
`activities` · `notes`. Os campos de venda ficam em `ExportSaleFields`
(`ComexView.jsx:377-437`), que mostra o equivalente em BRL abaixo quando valor e
PTAX estão preenchidos (`:430-434`). **Não há calculadora de Landed Cost na
Exportação** — decisão registrada em `:291-292` e `:375`.

Campos por etapa: `rh_stage_fields` com `domain` = `comex_importacao` /
`comex_exportacao` (`:982`, `:1037`), editados pelo `RHStageFieldsPanel`
compartilhado (`:1461-1469`). Comex é o único módulo em que o domínio dos
campos difere do `domain` do shell do drawer (`RHDetailDrawerShell.jsx:673-675`).

**Abas do drawer / painéis (L3):** `ComexDrawer` (`:803-976`) monta um
`SplitPanelDrawer` com os três slots:

| Slot | Conteúdo | Entidade relacionada |
|---|---|---|
| header | título da operação + pílula da etapa atual (`:841-850`) | `rh_pipeline_stages` |
| left | Empresa(s) · Responsáveis · campos específicos da variante (`renderLeftFields`) · `RHDetailDrawerShell` com as abas internas (`:888-917`) | — |
| center | **Campos desta etapa** (`:856-880`); vazio vira o link "Clique aqui para editar essa etapa" (`:862`) | `rh_stage_fields` |
| right | banner de erro de movimentação · `StageNavigator` "Mover para" · `RHDetailComments` · link "Editar campos desta etapa" (`:919-963`) | `activities`, `rh_pipeline_stages` |

Abas dentro do slot `left` (`RHDetailDrawerShell.jsx:677-688`), na ordem em que
são empurradas: **Form** (só quando há `formContent` — em Comex é a calculadora
de Landed Cost na Importação, `ExportSaleFields` na Exportação) · **Atividades**
· **Histórico** · **IA** · **Anexos** · **Checklists**. Comex é um dos três
domínios que ganham Checklists (`:671`, junto de `vagas` e `candidatos`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Toggle Importação/Exportação | remonta o board pela `key` (`:1508`/`:1510`) — busca, `viewMode` e drawer aberto se perdem |
| Clique no card / na linha da tabela / no dia do calendário | abre o `ComexDrawer` (`:1317`, `:1319`, e o Kanban por `onCardClick`) |
| Arrastar card entre colunas | `handleColumnDrop` → `handleMoveToStageGeneric`, que primeiro valida (`:1150-1157`) |
| Validação de etapa | `getStageBlockMessage` (`:1108-1120`): pula a checagem se for regressão (`isStageRegression`), depois cobra obrigatórios (`getMissingRequiredFields`) e só então formato (`getInvalidFields`); mensagem lista os rótulos faltando |
| Erro de movimentação | `AppToast variant="danger"` no topo direito (`:1250-1254`); dentro do drawer, banner inline no slot `right` (`:921-926`) |
| `StageNavigator` no drawer | mesma validação; ao mover com sucesso, `reopenAfterMove` fecha e reabre o drawer no mesmo id (`:1448`) |
| Arrastar o cabeçalho de uma coluna | reordena as etapas e grava a ordem (`:1160-1174`) |
| "Nova etapa" (botão tracejado no fim do Kanban, `:1401-1413`) | `NewStageModal` (`:88-152`) — nome + cor; o `stageKey` é slugificado com sufixo numérico em caso de colisão (`:100-102`) |
| FAB "Nova operação" | mesmo modal do botão do header (`:1421`, `:1289`); só com `canWrite` |
| "Exportar CSV" (`:1288`) | `exportComexOperationsToCSV(filteredOperations, { stages })` — exporta o array já filtrado. O cabeçalho é fixo: "Operação, Etapa, País, Valor de venda (USD), Criado em" (`src/utils/export-csv.js:176`), colunas de Exportação; na Importação, "País" e "Valor de venda" saem vazias |
| Editar campo da calculadora | grava no `onBlur`, campo a campo (`:300-304`); o total recalcula em memória com o rascunho mesclado (`:306-314`) |
| Menção num comentário | `notifyMentions` com `link: { module: "comex_import_operations" \| "comex_export_operations", id }` (`:943`); o dispatcher manda os dois pra seção `comex` (`App.jsx:1379-1380`), sem abrir a operação (`App.jsx:1399`) |
| Abrir o drawer | `markViewed` registra a leitura (`:1102`); o card mostra o badge de comentário não lido via `hasUnreadRHComment` (`:1391`) |

**Faixa de indicadores** (`:1294-1310`, sempre calculada sobre
`filteredOperations`):

| Variante | Cartões |
|---|---|
| Importação (`:1014-1024`) | Operações · Recebidas este mês (etapa `terminal && won`, no mês corrente) · Landed Cost total estimado |
| Exportação (`:1058-1068`) | Operações · Liquidadas este mês · Valor total em vendas (soma de `saleValue × ptaxRate`) |

Na aba Análise entram ainda os `specificStats`: Landed Cost médio e "Canal RFB
Vermelho" — este último contado de `customFields.rfb_channel === "Vermelho"`,
um campo por etapa (`:1025-1032`) — do lado da Importação; Valor médio por
operação e Países atendidos do lado da Exportação (`:1069-1077`).

**Entidades ligadas:**

- `comex_import_operations` e `comex_export_operations` — as duas tabelas de
  operação (`use-comex-import-operations.js:4`,
  `use-comex-export-operations.js:4`); `canWrite` no hook é
  `["admin","comex"]` (`use-comex-import-operations.js:71`).
- `rh_pipeline_stages` com `domain` = `comex_importacao` / `comex_exportacao` —
  etapas, cor, ordem, `terminal`/`won`, SLA (`:1085`).
- `rh_stage_fields` nos mesmos dois domínios — campos por etapa (`:1086`).
- `profiles` via `users` — responsáveis e menções.
- `COMPANIES`/`COMPANY_IDS` — pílulas de empresa da operação.
- `activities` e `notes`, jsonb dentro da própria linha — comentários e log; não
  há tabela relacional de histórico neste módulo.

A visão de Calendário posiciona cada operação **pela data de mudança de etapa**
(`stageChangedAt`, `:695`), não por ETA/ETD — não existe campo de data de
chegada nestas tabelas — e conta em rodapé quantas operações ficaram de fora por
não ter essa data (`:793`).

---

### Grupo: Marketing
## 3.18 Visão Geral · Marketing — `/marketing/inicio`


Componente: `MarketingDashboardView.jsx` (`App.jsx:2745-2749`; `isMarketingUser || isDiretoria`).

**Visões (L2):** não há toggle de visão. A tela é uma coluna única de 4 zonas
fixas, na ordem: Zona 1 (Resumo, tiles), Zona 2 ("O que fazer", baldes),
Zona 3 (Tendência, painéis) e Zona 4 ("Sua seção livre", só título
personalizável e nenhum widget — `MarketingDashboardView.jsx:794-799`).
O único seletor de escopo é a faixa `CompanyTabs` (Todas / Sanwey / Resibag),
`MarketingDashboardView.jsx:47-83` + `654-660`.

**Campos:** não existe formulário nesta tela — ela só lê. Bloco omitido.

**Widgets (`VISAO_GERAL_WIDGETS.marketing`, `src/constants/visao-geral-widgets.js:20-40`, ordem real):**

| # | `id` | Rótulo | Zona | Observação |
|---|---|---|---|---|
| 1 | `kpi_active` | Campanhas ativas | 1 | `stage !== "encerrado"`; seta MoM (`:456`, `:530-543`) |
| 2 | `kpi_live` | Ao vivo agora | 1 | `stage === "ao_vivo"` (`:457`) |
| 3 | `kpi_budget` | Consumido no ano | 1 | despesas do ano fiscal, pago + a pagar (`:484-495`); `id` preservado de quando o rótulo era "Orçamento comprometido" (`visao-geral-widgets.js:23-27`) |
| 4 | `kpi_deliverables` | Entregas concluídas | 1 | `stage === "entregue"` (`:462`) |
| 5 | `kpi_score` | Performance médio | 1 | média de `performanceScore > 0` (`:458-461`) |
| 6 | `kpi_agency_sla` | SLA cumprido | 1 | `roleGate: "not_agencia"` |
| 7 | `kpi_agency_leadtime` | Lead time médio | 1 | `roleGate: "not_agencia"` |
| 8 | `bucket_deliveries_late` | Entregas atrasadas | 2 | 4 itens; clique navega a `/marketing/entregas` com `state.filterStage` (`:575`) |
| 9 | `bucket_agency_stuck` | Presas em revisão | 2 | `roleGate: "not_agencia"`; clique leva `state: { filterStage: "revisao", stuckOnly: true }` (`:585`) |
| 10 | `panel_monthly_activity` | Atividade mensal | 3 | 6 meses, campanhas criadas × entregas concluídas |
| 11 | `panel_channel` | Campanhas por canal | 3 | |
| 12 | `panel_stage_pipeline` | Pipeline por etapa | 3 | `StageDistributionBar` |
| 13 | `panel_burn_rate` | Burn rate | 3 | `roleGate: "not_agencia"` |
| 14 | `panel_category_donut` | Por categoria | 3 | `roleGate: "not_agencia"` |
| 15 | `panel_top_performance` | Top 5 · performance | 3 | |

Widget vetado pro cargo não entra na checklist de "Personalizar" nem pode
ficar visível com preferência antiga salva (`:419-426`). Zona sem widget
visível mostra "Nenhum item selecionado para esta seção."

**Abas do drawer / painéis (L3):** a tela não tem drawer. Um único overlay:
`WidgetPrefsModal` ("Personalizar Marketing", `:803-806`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| `CompanyTabs` | refiltra `fCampaigns`/`fDeliverables`/`fExpenses` por `companyIds` (`:437-455`) |
| "Atualizar" | `window.location.reload()` (`:623`) |
| "Exportar" | `exportCampaignsToCSV(fCampaigns)` + `logExport(user.id, "campaigns_dashboard", n)`; escondido pra agência (`:627-636`) |
| "Personalizar" | abre `WidgetPrefsModal` (`:611-616` no mobile, `:637-646` no desktop) |
| Item de balde da Zona 2 | `navigate()` pro board de Entregas com filtro pré-aplicado (`:575`, `:585`) |
| Badge "N ao vivo" | só indicador, sem ação (`:647-653`) |

**Entidades ligadas:** `marketing_campaigns` (`useMarketingCampaigns`) ·
`marketing_deliverables` · `marketing_expenses` · `marketing_budgets`
(leitura pura — quem escreve teto é `/marketing/despesas`) ·
`rh_pipeline_stages` domain `marketing` (etapas vivas; `MARKETING_STAGES` é
fallback estático, `:401-410`).

---
## 3.19 Campanhas — `/marketing`


Componente: `MarketingView.jsx` (`App.jsx:2750-2762`). Única rota da fatia
que a agência alcança além de Entregas.

**Visões (L2):** Kanban · Tabela · Calendário · Análise
(`MarketingView.jsx:730`, toggles em `:1008-1035`). As quatro consomem o mesmo
`filteredCampaigns` (`:733-756`), calculado fora do bloco condicional de
`viewMode`. No mobile o Kanban vira `RHMobileKanbanAccordion` (`:1160`).

**Etapas:** `rh_pipeline_stages` com `domain="marketing"` (`:610-614`);
`MARKETING_STAGES` (`src/constants/marketing-pipelines.js:1-8`) é fallback —
briefing · aprovacao · producao · revisao · ao_vivo · encerrado (terminal).

**Campos da campanha** (modal "Nova campanha", `MarketingView.jsx:59-396`, ordem real):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `name` | Nome da campanha | text | obrigatório; validado por `campaignNameError(name, channel)` — canal com taxonomia exige `frente-aaaamm-tema` (`:182-183`, hint em `:200-204`) |
| 2 | `companyIds` | Empresa | multi-chip | obrigatório (`:181`); `COMPANY_IDS` = industria, resibag |
| 3 | `channel` | Canal | select | `MARKETING_CHANNELS`: Email, Social, Conteúdo, Digital, Outdoor, Evento |
| 4 | `kpi` | KPI principal | select | `MARKETING_KPIS`: Alcance, Conversões, Leads, Awareness, Engajamento, ROI |
| 5 | `budget` | Orçamento (R$) | currency | `CurrencyInput` com `prefix={null}` (`:264-274`) |
| 6 | `ownerIds` | Responsável(is) | user (multi) | `AssigneeMultiSelect`; grava `owner` escalar = `ownerIds[0]` (`:118-127`) |
| 7 | `launchDate` | Data de lançamento | date | |
| 8 | `endDate` | Encerramento | date | |
| 9 | `agencyName` | Agência (opcional) | text | |
| 10 | `supplierId` | Fornecedor vinculado (opcional) | select | só aparece com fornecedor de `category === "agencia"` ativo (`:85-86`, `:334-350`) |

Além desses, **campos por etapa** de `rh_pipeline_stage_fields`
(`useRHStageFields("marketing")`, `:62`), renderizados por `RHStageFieldInput`
sob "Campos desta etapa" (`:353-376`). Em produção são **1 definição em 1
etapa** [prod, 14/09/2026] — ou seja, o motor configurável está ligado nesta
tela e praticamente não é usado; o que aparece no drawer é quase todo o bloco
fixo de código descrito acima.

Colunas da entidade lidas do banco (`use-marketing-campaigns.js:9-32`):
`performanceScore`, `utmUrl`, `driveFolderUrl`/`driveFolderId`,
`approvalChecklist`, `starred`, `notes` (jsonb), `activities` (jsonb),
`customFields`, `stageChangedAt`.

**Abas do drawer (`CampaignDetailDrawer.jsx`, `SplitPanelDrawer` em `:1920-1927`):**

Layout: `header` = chips de etapa/canal/"Visitante" + `EditableTitle` +
estrela (`:1790-1848`); `left` = chips de empresa + `LEFT_TABS` (`:66-74`);
`center` = "Fase atual"; `right` = `StageNavigator` + `CommentsPanel` +
atalho "Mover cards com IA".

| Aba (`LEFT_TABS`) | Conteúdo | Entidade relacionada |
|---|---|---|
| Form | Nome, Empresas, Canal, KPI, Orçamento, Performance (hint por KPI), Lançamento, Encerramento, Responsável interno, Responsável pela Execução, Link UTM, Pasta Google Drive (`:1568-1740`) | `marketing_campaigns` |
| Atividades | `ActivityLog` | `activities` (jsonb na linha) |
| Histórico | `RHStageHistoryPanel` domain `marketing` | `rh_stage_history` |
| IA | `CampaignAIPanel`, feature "Resumo & Próximo passo" | edge `ai-assistant` |
| Arquivos | upload drag-and-drop, máx 50 MB | tabela `marketing_campaign_attachments` + bucket `marketing-attachments` (`use-marketing-campaign-attachments.js:4-5`); com `driveFolderUrl` preenchido o arquivo também vai pro Google Drive (`:386`, `:425-431`) |
| Checklist | `ChecklistPanel` sobre `approvalChecklist` | coluna jsonb, gravada por RPC `mc_set_checklist` (`use-marketing-campaigns.js:228`) |
| Entregas | lista as entregas da campanha e cria nova ali (`:673-700`) | `marketing_deliverables` (`campaign_id`) |

**Painel "Fase atual" (centro):** quatro etapas têm formulário FIXO no código,
além dos campos configuráveis (`:1481-1560`):

| Etapa | Bloco | Campos (`custom_fields`) |
|---|---|---|
| briefing | Planejamento | `briefing_owner` (Responsável pelo Planejamento) · `briefing_status` * (Status do Planejamento) · `briefing_resources` (Recursos Necessários) · `briefing_review_date` (Data de Revisão) · Anexos do Planejamento |
| aprovacao | Aprovação | `aprovacao_checklist` * (Checklist de Requisitos) · `aprovacao_status` * (Aprovação do Documento) · `aprovacao_owner` (Responsável pela Aprovação) · `aprovacao_date` * (Data de Aprovação) · `aprovacao_comments` |
| producao | Execução | `producao_task` * · `producao_date` * · `producao_owner` · `producao_status` * · `producao_resources` |
| revisao | Análise dos Resultados | `revisao_method` * · `revisao_date` * · `revisao_owner` · `revisao_summary` |

Etapa sem campo fixo e sem campo configurado mostra "Nenhum campo nessa fase.
Clique aqui para editar essa etapa." (`:1484-1492`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no card | abre `CampaignDetailDrawer`; `markCampaignViewed` zera o badge de comentário não lido (`:878-880`) |
| Arrastar card entre colunas | `attemptStageChange` → bloqueia avanço com obrigatório vazio da etapa de ORIGEM; regressão não cobra (`isStageRegression`, `:846-869`); erro sobe em `AppToast variant="danger"` (`:962-966`) |
| `MoveStageMenu` (⋮) no card | mesma validação; no desktop só a lixeira, porque o arrastar já move (`CampaignKanbanCard.jsx:55`, `:117`) |
| `StageNavigator` no drawer | idem, alimentado por `effectiveStages` (`CampaignDetailDrawer.jsx:1884-1890`) |
| Estrela no card / no drawer | alterna `starred`; erro de RLS aparece no header do drawer (`:1825-1840`) |
| "Exportar CSV" no header | `exportCampaignsToCSV(filteredCampaigns)` (`:807-809`) |
| "Destaques" | filtra `starred` (`:1096-1109`) |
| Arrastar coluna | `reorderStages` (`:610`) |
| "+ Nova etapa" no fim do board | `NewStageModal` → `addStage` (`:413`, `:1458`) |
| "Editar campos desta etapa" | `RHStageFieldsPanel` (`:1424`, `:1433`); excluir etapa fica dentro dele |
| Canal = "Evento" no drawer | libera "Aplicar checklist de evento" → RPC `apply_event_checklist_template` (`:177-202`, `:1658`) |
| FAB "＋" | `setQuickAddStage("briefing")` — mesma modal do botão "Nova campanha" (`:1117`) |

**Filtros do header** (fora do bloco de `viewMode`, `:1063-1113`): busca livre
(nome, canal, siglas de empresa) · Empresa · Canal · Responsável (só
`isManager`, `:703`) · toggle "Destaques". As opções de Responsável saem de
`campaigns` cru, não do array filtrado (`:780-806`).

**Entidades ligadas:** `marketing_campaigns` (principal) ·
`rh_pipeline_stages` domain `marketing` · `rh_pipeline_stage_fields` ·
`rh_stage_history` · `marketing_campaign_attachments` + bucket
`marketing-attachments` · `marketing_deliverables` (aba Entregas) ·
`marketing_suppliers` (vínculo de agência, escopo de RLS pra `role=agencia`) ·
`personal_events` (Calendário, `usePersonalEvents`) · `automations` module
`marketing` (`fireAutomations`).

---
## 3.20 Solicitações — `/marketing/solicitacoes`


Componente: `MarketingRequestsView.jsx` (`App.jsx:2806-2815`). Bloqueada pra
agência. É a caixa de entrada do formulário público `/solicitar-marketing` e
`/solicitar-compra`.

**Visões (L2):** não há Kanban nem tabela. Uma lista de cards, com 4 abas de
status: Pendentes · Aprovadas · Rejeitadas · Todas, cada uma com contador
(`:540-570`). Padrão inicial = "pendente" (`:420`).

**Campos da solicitação** (`MarketingRequestForm` público, `src/components/public/MarketingRequestForm.jsx`; mapeamento em `src/hooks/use-marketing-requests.js:6-33`):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `requesterName` | Seu nome | text | obrigatório (`:288`) |
| 2 | `requesterEmail` | Seu e-mail | email | |
| 3 | `department` | Departamento | select | obrigatório; só na categoria "material" (`:310`) |
| 4 | `requestType` | Tipo de material | select | obrigatório; `DELIVERABLE_REQUEST_TYPES` (12 opções, `marketing-pipelines.js:87-92`) |
| 5 | `title` | Título da solicitação | text | obrigatório (`:336`); na categoria compra vira "O que você precisa comprar?" (`:399`) |
| 6 | `description` | Descrição detalhada | textarea | |
| 7 | `priority` | Prioridade | select | `DELIVERABLE_PRIORITIES`: baixa/média/alta |
| 8 | `deadline` | Prazo desejado | date | |
| 9 | `budget` | Orçamento (se aplicável) | currency | |
| 10 | `approverName` | Aprovação necessária de quem? | text | |
| 11 | `companyIds` | Empresa / unidade | multi-chip | `MARKETING_UNIT_IDS` = industria, resibag, **montemor** (`companies.js:60`) — Monte Mor só existe aqui, não vende |

`category` ("material" ou "compra") vem do caminho: `/solicitar-marketing` ou
`/solicitar-compra` com `defaultCategory="compra"`. Colunas derivadas na fila:
`requestNumber` (protocolo editável), `status`, `rejectionReason`, `notes`,
`approvedAt`/`approvedBy`, `deliverableId`, `taskId`, `purchaseRequestId`,
`emailError`, `isDemo`.

**Abas do drawer / painéis (L3):** não existe drawer. Três overlays:

| Overlay | Conteúdo |
|---|---|
| `ApproveModal` (`:134-240`) | "Criar como": Entrega (agência externa) **ou** Tarefa (equipe interna) — radio; **categoria "compra" não escolhe destino**, vai sempre pro Kanban de Compras (`:148-155`); campo "Observações internas" |
| `RejectModal` (`:79-122`) | "Motivo (opcional)", texto livre |
| Descrição expandida | inline no card, não é overlay (`:373-391`) |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Aprovar" (só `canWrite` e status pendente) | abre `ApproveModal`; confirmar chama uma de 3 RPCs — `approve_marketing_request_as_purchase`, `approve_marketing_request_as_task` ou `approve_marketing_request` (`:484-491`), cada uma criando o registro e marcando a solicitação na mesma transação; depois dispara e-mail ao solicitante |
| "Rejeitar" | `rejectRequest(id, reason)` + e-mail (`:503-512`) |
| Falha de e-mail | grava `emailError`, o card mostra o aviso e o botão "Tentar enviar e-mail de novo" → `sendStatusEmail` / edge `send-request-status-email` (`:340-350`, `:515-524`) |
| Protocolo (`EditableProtocolNumber`) | `updateRequest(id, { requestNumber })` (`:592`) |
| "Copiar link público" | copia `${origin}/solicitar-marketing` (`:530`) |
| Deep-link da fila de Pendências | força o card expandido, troca o filtro de status pro status do registro e rola até ele com destaque de 2,5 s (`:434-459`) |
| Chip "Entrega criada" / "Tarefa criada" / "Compra criada" | rótulo apenas — **não leva ao registro criado** (`:319-337`) |

**Entidades ligadas:** `marketing_requests` (principal) ·
`marketing_deliverables` / `marketing_tasks` / `marketing_purchase_requests`
(um dos três nasce da aprovação) · edge `send-request-status-email`.

---
## 3.21 Entregas — `/marketing/entregas`


Componente: `EntregasView.jsx` (`App.jsx:2763-2771`). Segunda e última rota
que a agência alcança.

**Visões (L2):** Kanban · Tabela · Calendário · Análise
(`EntregasView.jsx:754`, toggles em `:1036-1039`). Todas consomem `filtered`.
Mobile: `RHMobileKanbanAccordion` (`:1153`).

**Etapas:** `rh_pipeline_stages` domain `marketing_deliverables` (`:738-739`);
`DELIVERABLE_STAGES` (`marketing-pipelines.js:10-15`) é o fallback de 4 —
solicitacao · em_producao · revisao · entregue (terminal). O código também
trata `encaminhado_para_agencia`, que existe no banco e não está na constante
(`marketing-pipelines.js:30`). Em produção o domínio `marketing_deliverables`
tem **6 etapas, 1 terminal** [prod, 14/09/2026]: Solicitação · Encaminhado à
Agência · Em Produção · Revisão e Aprovação · Entregue · Reprovados/Arquivados
— duas a mais do que a constante de fallback de 4. O domínio `marketing`
(Campanhas) também tem 6, 1 terminal: Briefing · Aprovação · Produção ·
Revisão · Ao Vivo · Encerrado.

**Escrita da agência é assimétrica** e espelha a policy `md_update`
(`marketing-pipelines.js:17-70`): pode mexer em cards em
`encaminhado_para_agencia` e `em_producao` (USING); pode mandar card pra esses
dois **mais** `revisao` (WITH CHECK). Encaminhar pra revisão é caminho só de
ida.

**Campos da entrega** (modal "Nova entrega", `EntregasView.jsx:199-300`, ordem real):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `requesterName` | Nome do Solicitante | text | obrigatório |
| 2 | `department` | Departamento | select | obrigatório; `DELIVERABLE_DEPARTMENTS` (8 opções) |
| 3 | `description` | Descrição do Entregável | textarea | |
| 4 | `title` | Título resumido | text | obrigatório |
| 5 | `deadline` | Prazo | date | obrigatório |
| 6 | `priority` | Prioridade | select | obrigatório; baixa/média/alta |
| 7 | `companyIds` | Empresa | multi-chip | |
| 8 | `campaignId` | Campanha relacionada | select | opcional |

Mais os campos por etapa de `useRHStageFields("marketing_deliverables")`
(`:84`, `:688`). Colunas próprias da entidade
(`use-marketing-deliverables.js:6-41`): `requestNumber`, `requesterEmail`,
`emailError`, `assignee` + `assigneeIds`, `stageData` (jsonb),
`customFields`, `starred`, `activities`, `notes`.

**Abas do drawer (`DeliverableDetailDrawer.jsx`, `SplitPanelDrawer` em `:974-982`):**

| Aba (`LEFT_TABS`, `:44-51`) | Conteúdo | Entidade relacionada |
|---|---|---|
| Form | Nº da Solicitação (`EditableProtocolNumber`), Título, Solicitante, Departamento, Descrição, Prazo — leitura, exceto o protocolo (`:769-804`) | `marketing_deliverables` |
| Atividades | `AtividadesTab` | `activities` (jsonb) |
| Histórico | `RHStageHistoryPanel` domain `marketing_deliverables` | `rh_stage_history` |
| IA | `DeliverableAIPanel` | edge `ai-assistant` |
| Anexos | `AnexosTab` | bucket `deliverable-attachments` |
| Checklists | `ChecklistsTab` | checklists de entrega |

Centro ("Fase atual", `:683-760`): Responsáveis (`AssigneeMultiSelect`),
Campanha relacionada (select editável pós-criação) e os campos configuráveis
da etapa, com indicador "Salvando… / ✓ Salvo / ✗ Falha ao salvar".
Direita: avisos de e-mail, botão "Devolver para <etapa>" com motivo,
`StageNavigator` e `CommentsPanel` (`:872-970`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no card | abre `DeliverableDetailDrawer` e marca como visto (`:902`) |
| Arrastar / `MoveStageMenu` / `StageNavigator` | `attemptStageChange`; bloqueia avanço com obrigatório vazio; pra agência, destino fora de `AGENCIA_DELIVERABLE_MOVE_TARGETS` devolve `AGENCIA_STAGE_MOVE_BLOCKED_MSG` |
| Mover pra `entregue` com `requesterEmail` preenchido | dispara `sendCompleteEmail` → edge `send-deliverable-complete-email` (`:890-892`) |
| Criar entrega | dispara `sendSupplierNotifyEmail` → edge `send-deliverable-supplier-notify` (`:935`) |
| Falha de e-mail | `emailError` vira faixa no drawer + botão "Tentar enviar de novo" (`DeliverableDetailDrawer.jsx:885-899`) |
| "Devolver para <etapa>" | textarea de motivo opcional e volta o card (`:901-936`) |
| "Filtros" | abre a linha de filtros; contador de filtros ativos no próprio botão (`:1013-1022`) |
| Chip "Presas em revisão · +3 dias" | chega por `navigate state` da Visão Geral; some ao clicar no × (`:1024-1032`) |
| "Exportar CSV" | `exportDeliverablesToCSV(filtered, { stages })` (`:1043`) |
| Automação disparada | `AppToast variant="default"` com ícone `Zap` (`:981-984`) |
| "+ Nova etapa" / "Editar campos desta etapa" | `NewStageModal` (`:605`, `:1447`) / `RHStageFieldsPanel` (`:1426`, `:1435`) |

**Filtros** (`:1077-1140`): busca livre · Responsável (só `isManager`) ·
Campanha · Prazo (Vencidas / Próximos 7 dias / Sem prazo) · chips de empresa ·
Favoritos · "Limpar".

**Entidades ligadas:** `marketing_deliverables` (principal) ·
`marketing_campaigns` (`campaign_id`) · `rh_pipeline_stages` domain
`marketing_deliverables` · `rh_pipeline_stage_fields` · `rh_stage_history` ·
bucket `deliverable-attachments` · `automations` module `marketing` ·
edges `send-deliverable-complete-email` e `send-deliverable-supplier-notify` ·
`marketing_requests` (origem, quando a entrega nasceu de aprovação).

---
## 3.22 Tarefas — `/marketing/tarefas`


Componente: `MarketingTarefasView.jsx` (`App.jsx:2776-2780`). **Agência não
entra**: a rota exige `isMarketingUser && !isAgencia`, e o comentário no
próprio `App.jsx:2772-2775` registra que a RLS de `marketing_tasks` já barra
no SELECT — o gate de rota é a segunda camada.

**Visões (L2):** Kanban · Tabela · Calendário · Análise (`:663`, toggles em
`:977-980`). Mobile: `RHMobileKanbanAccordion` (`:1215`). O card do Kanban é
o **mesmo** `DeliverableKanbanCard` de Entregas (`:7`, `:1239-1240`).

**Etapas:** `rh_pipeline_stages` domain `marketing_tasks` (`:645`). Sem
constante de fallback própria no arquivo.

**Campos da tarefa** (`use-marketing-tasks.js:6-37`):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `title` | Título | text | |
| 2 | `description` | Descrição | textarea | |
| 3 | `priority` | Prioridade | select | baixa/média/alta |
| 4 | `deadline` | Prazo | date | |
| 5 | `assigneeIds` | Responsáveis | user (multi) | **sem coluna escalar** `assignee` — diferente de `marketing_deliverables` (comentário em `use-marketing-tasks.js:22-26`) |
| 6 | `companyIds` | Empresa(s) | multi-chip | |
| 7 | `campaignId` | Campanha vinculada | select | |
| 8 | `campaignStageKey` | — | text | lido e devolvido no update, **nunca escrito por nenhuma tela** (`:11-13`) |
| 9 | `archivedAt` | — | timestamp | arquivamento; sai do quadro, continua no CSV |
| 10 | `customFields` | campos da etapa | jsonb | `useRHStageFields("marketing_tasks")` |

**Abas do drawer (`MarketingTaskDetailDrawer.jsx`, `SplitPanelDrawer` em `:535-552`):**

Diferença estrutural em relação a Campanhas e Entregas: aqui as abas moram no
slot **center**, não no `left` (`:446-460`). O `left` traz só Responsáveis e
Campanha vinculada (`:312-339`).

| Aba | Conteúdo | Entidade relacionada |
|---|---|---|
| Fase atual | campos configuráveis da etapa | `rh_pipeline_stage_fields` |
| Form | Título, Descrição, Prioridade, Prazo, Responsáveis, Campanha vinculada (`:360-400`) | `marketing_tasks` |
| Atividades | `ActivityLog` | `activities` (jsonb) |
| Histórico | `RHStageHistoryPanel` domain `marketing_tasks` | `rh_stage_history` |
| IA | `RecordAIPanel`, "Resumo & Próximo passo" | edge `ai-assistant` |
| Anexos | `RHAttachmentsPanel` domain `marketing_tasks` | `rh_attachments` |
| Checklist | `RHChecklistsPanel` domain `marketing_tasks` | checklists de RH |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no card | abre o drawer, marca como visto (`:827-828`) |
| Arrastar / `StageNavigator` | move; erro em `AppToast variant="danger"` (`:917-920`) |
| `EditableTitle` no header | grava `title` (`:304-308`) |
| Botão de arquivar no drawer | arquiva **sem fechar o drawer** — o chip "Arquivada em <data>" aparece no header e o botão vira "Desarquivar" (`:546-551`) |
| Filtro "Arquivamento" | Ativas / Arquivadas (com contador do que está oculto) / Todas (`MarketingTarefasView.jsx:1093-1101`) |
| "Exportar CSV" | `exportMarketingTasksToCSV(baseFiltered, { stages, usersById, campaignsById, priorityLabels })` (`:988`) |
| FAB "＋" | `setQuickAddStage(kanbanStages[0]?.id)` — primeira etapa do board (`:1181`) |

**Filtros:** busca livre · Responsável (só `isManager`) · Prioridade ·
Campanha · Prazo · Arquivamento. Colunas da Tabela: Título, Campanha,
Prioridade, Etapa, Responsável, Prazo (`:106`).

**Entidades ligadas:** `marketing_tasks` (principal) · `marketing_campaigns` ·
`rh_pipeline_stages` domain `marketing_tasks` · `rh_pipeline_stage_fields` ·
`rh_stage_history` · `rh_attachments` · `marketing_requests` (quando a tarefa
nasceu de `approve_marketing_request_as_task`; nome/e-mail/departamento do
solicitante entram formatados no topo da descrição, porque a tabela não tem
colunas próprias pra isso — `MarketingRequestsView.jsx:135-139`).

---
## 3.23 Fornecedores — `/marketing/fornecedores`


Componente: `FornecedoresView.jsx` (`App.jsx:2816-2820`). Bloqueada pra
agência. É a **referência canônica do padrão de exclusão** citado no
`CLAUDE.md` regra 1.

**Visões (L2):** grade de cards, com toggle grade/lista (`GridListToggle`,
`:216`) — não há Kanban, tabela nem calendário. Uma faixa de resumo com um
`StatCard` ("Fornecedores", contagem total, `:205-207`).

**Campos do fornecedor** (`SupplierModal`, `:25-131`, ordem real):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `name` | Nome | text | obrigatório (`:45`) |
| 2 | `category` | Categoria | select | Agência · Gráfica · Confecção · Stand de Feira · Outro (`:14-20`) |
| 3 | `email` | E-mail | email | obrigatório (`:45`) |
| 4 | `contactName` | Contato | text | |
| 5 | `phone` | Telefone | text | |
| 6 | `companyIds` | Empresas atendidas | multi-chip | obrigatório — array vazio bate na RLS `company_ids && current_user_companies()` e o usuário via só o erro cru do Postgres (`:46-49`) |
| 7 | `notes` | Observações | textarea | |

**Abas do drawer / painéis (L3):** não existe drawer. Dois modais, ambos
sobre `src/components/ui/Modal.jsx`:

| Overlay | Gatilho |
|---|---|
| `SupplierModal` ("Novo fornecedor" / "Editar fornecedor") | "Novo fornecedor" no header, ou clique no card quando `canWrite` (`:259`) |
| `ConfirmDeleteModal` ("Excluir fornecedor?") | ícone `Trash2` no slot `menu` do `Card` (`:267-271`); corpo diz "Cotações já enviadas continuam no histórico" (`:157-159`) — texto diferente do de `RHFornecedoresView.jsx` |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no card | abre `SupplierModal` em edição (só `canWrite`) |
| `Trash2` no canto do card | abre `ConfirmDeleteModal`; "Excluir" em `var(--danger)` |
| Busca / filtro de Categoria | filtra local por nome e categoria (`:180-188`) |
| `GridListToggle` | alterna densidade grade/lista do `CardGrid` |
| Estado sem resultado de filtro | `EmptyState` com botão "Limpar filtros" (`:241-255`) |

**Entidades ligadas:** `marketing_suppliers` (principal, via
`useMarketingSuppliers`). O fornecedor com `category === "agencia"` é o que
escopa o `role=agencia` em Campanhas (`MarketingView.jsx:80-86`) e alimenta o
select de cotação em Compras. O comentário em `:169-171` registra que o fluxo
antigo de cotação por e-mail, que tinha aba própria aqui, foi aposentado —
cotação hoje é a etapa "Cotação" do Kanban de Compras.

---
## 3.24 Compras — `/marketing/compras`


Componente: `ComprasMarketingView.jsx` (`App.jsx:2821-2830`). Bloqueada pra
agência.

**Visões (L2):** Kanban · Tabela · Calendário · Análise (`:641`, toggles em
`:866-869`). Todas consomem `visiblePurchases` (`:688`), derivado de
`searchedPurchases`. O Kanban mobile **não** usa
`RHMobileKanbanAccordion`: tem um `MobileKanban` próprio (`:367-388`, com o
motivo escrito no comentário).

**Etapas — hardcoded, não configuráveis.** `PURCHASE_STAGES` vive em
`src/hooks/use-marketing-purchase-requests.js:10-18`, não em
`rh_pipeline_stages`:

| # | `id` | Nome | `slaDays` |
|---|---|---|---|
| 1 | `solicitado` | Solicitado | 2 |
| 2 | `cotacao` | Cotação | 5 |
| 3 | `aprovado` | Aprovado | 3 |
| 4 | `pedido_fornecedor` | Pedido ao Fornecedor | 10 |
| 5 | `entrega_parcial` | Entrega Parcial | 7 |
| 6 | `entregue` | Entregue | 3 |
| 7 | `pago` | Pago (terminal) | 5 |

Existe uma 8ª, `PURCHASE_REJECTED_STAGE = "rejeitado"` (`:22`), que **não é
coluna do Kanban** — só se chega a ela pela RPC `reject_purchase_request`, e
os cards aparecem numa tira retrátil acima do board (`:914-941`). As cores
das etapas também são um mapa fixo no arquivo da view (`:37-46`), não
`rh_pipeline_stages.color`. Como Compras não lê `rh_pipeline_stages`, não
existe "Editar campos desta etapa" nem "+ Nova etapa" neste board.

**Campos da solicitação de compra** (modal "Nova solicitação", `:231-260`, ordem real):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `itemName` | Item a comprar | text | obrigatório |
| 2 | `description` | Descrição | textarea | |
| 3 | `requesterName` | Solicitante | text | obrigatório |
| 4 | `dueDate` | Prazo desejado | date | |
| 5 | `companyIds` | Empresas | multi-chip | obrigatório; `MARKETING_UNIT_IDS` (inclui Monte Mor) |

Campos preenchidos etapa a etapa, no drawer (`use-marketing-purchase-requests.js:24-69`):
`requestNumber` · `supplierId` · `quantity` · `unitPrice` · `totalValue` ·
`responsibleId` + `responsibleIds` · `quoteOptions` (jsonb) · `paymentTerms` ·
`supplierOrderCode` · `deliveryDeadline` · `partialDeliveredQty` ·
`partialRemainingQty` · `partialNewDeadline` · `partialNotes` ·
`invoiceNumber` · `invoiceDate` · `invoiceUrl` · `paymentControlNumber` ·
`deliveredAt` · `receivedBy` · `approvedBy`/`approvedAt` · `rejectedReason` ·
`expenseId`.

**Abas do drawer (`PurchaseRequestDetailDrawer.jsx`, `SplitPanelDrawer` em `:1038`):**

O drawer não tem uma aba "Form": o formulário por etapa é o conteúdo fixo do
centro, e as abas cobrem só o entorno (`:623-633`).

| Aba | Conteúdo | Entidade relacionada |
|---|---|---|
| Atividades | log de movimentos | `activities` (jsonb) |
| Histórico | mudanças de etapa | histórico de etapa |
| IA | resumo do card | edge `ai-assistant` |
| Anexos | arquivos | bucket de anexos |
| Checklist | itens | checklists |

Blocos por etapa, no corpo do drawer:

| Bloco | Campos |
|---|---|
| Solicitação (`:568-577`) | Solicitante · Prazo desejado · Descrição |
| Cotação de fornecedores (`:675-760`) | linhas `Fornecedor N` + `Valor`, alimentando `quoteOptions`; `getLastPurchasePrice` traz o último preço pago àquele fornecedor pelo mesmo item (RPC `get_supplier_last_purchase_price`) |
| Aprovado (`:771-800`) | Fornecedor · Responsável · Quantidade · Preço unitário · Valor total · Prazo de pagamento |
| Pedido ao fornecedor (`:802-810`) | Código de pedido do fornecedor · Prazo de entrega |
| Entrega parcial (`:816-830`) | Quantidade entregue · Quanto falta entregar · Novo prazo de entrega (restante) · Detalhes extras |
| Entrega (`:836-852`) | Número da nota fiscal · Data da nota fiscal · Número da CP (controle de pagamento) · Data da entrega · Quem recebeu |
| Nota fiscal (`:874`) | upload pro Storage com URL assinada de 300 s (`:356-371`) |
| Decisão / Aprovar solicitação (`:932-960`) | Fornecedor vencedor (select sobre `quoteOptions`) · Responsável pela execução |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no card | abre `PurchaseRequestDetailDrawer`, marca visto (`:720-721`) |
| Arrastar / `MoveStageMenu` / `StageNavigator` | `attemptStageChange` com **transições acopladas às RPCs**: de `solicitado` só pra `cotacao`; de `cotacao` só pra `aprovado`, e aí via `approve_purchase_request` (`:773-806`) |
| Aprovar com cotações registradas e sem vencedor | não aprova: mostra "escolha o fornecedor vencedor no detalhe pra aprovar" e **abre o drawer** (`:792-798`) |
| "Rejeitar" no drawer | `reject_purchase_request(p_id, p_reason)`; o card sai do board e vai pra tira de rejeitadas |
| Mover pra `pago` | trigger `marketing_purchase_requests_sync_expense` cria a despesa de categoria "Compra de Marketing" (`marketing-pipelines.js:94-99`) |
| `pago` no menu do card | **não aparece** — terminal só por arrastar ou pelo drawer (`:83-93`) |
| "Exportar CSV" | `exportPurchasesToCSV(visiblePurchases, …)` — exclui as rejeitadas de propósito, exceção registrada no próprio comentário do código (`:875-885`) |
| "Copiar link público" | copia `${origin}/solicitar-compra` (`:864`) |
| Tira de rejeitadas | retrátil; clique numa linha abre o drawer daquela solicitação (`:929`) |

**Filtro:** só busca livre — item, protocolo, fornecedor, solicitante e nomes
dos responsáveis (`:672-686`). Não há selects de filtro neste board.
Colunas da Tabela: Protocolo, Item, Fornecedor, Valor, Vencimento, Etapa,
Responsável (`:477`).

**Entidades ligadas:** `marketing_purchase_requests` (principal) ·
`marketing_suppliers` (cotação e fornecedor vencedor) ·
`marketing_expenses` (`expense_id`, criada por trigger na etapa "pago") ·
`marketing_requests` (origem, quando nasceu de
`approve_marketing_request_as_purchase`) · RPCs `approve_purchase_request`,
`reject_purchase_request`, `get_supplier_last_purchase_price`.

---
## 3.25 Despesas — `/marketing/despesas`


Componente: `DespesasView.jsx` (`App.jsx:2801-2805`). Bloqueada pra agência.

**Visões (L2):** duas abas pelo `Tabs` compartilhado — **Despesas** e
**Orçamento** (`:1585-1592`). As abas ficam fora do bloco condicional de
conteúdo, e os controles de cada uma (filtros da tabela, ano do teto) vivem
dentro da aba (`:1578-1583`). Não há Kanban nem calendário.

**Campos da despesa** (`ExpenseModal`, `:142-660`, ordem real):

| # | `id` | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `description` | Descrição | text | obrigatório |
| 2 | `campaignId` | Campanha relacionada (opcional) | select | |
| 3 | `deliverableIds` | Entregas vinculadas (opcional) | multi (`EntityMultiSelect`) | tabela de junção `marketing_expense_deliverables` |
| 4 | `taskIds` | Tarefas vinculadas (opcional) | multi | tabela de junção `marketing_expense_tasks` |
| 5 | `category` | Categoria | select | `MANUAL_EXPENSE_CATEGORIES` — "Compra de Marketing" fica **fora** do select porque só o trigger de Compras a grava (`marketing-pipelines.js:94-113`) |
| 6 | `status` | Status | select | Pendente / Pago |
| 7 | `costCenter` | Centro de custo | select | obrigatório (`<option value="">Centro de custo *</option>`, `:451`); `COMMERCIAL_COST_CENTERS` |
| 8 | `creditCard` | Cartão (opcional) | select | `COMMERCIAL_CREDIT_CARDS` |
| 9 | `amount` | Valor | currency | some quando há itens: o total passa a ser calculado a partir deles (`:469-486`) |
| 10 | `dueDate` | Vencimento | date | |
| 11 | itens | Itens | linhas (descrição, quantidade, valor unitário) | `marketing_expense_items`; "Adicionar item" |
| 12 | `invoiceDate` | Data da fatura | date | |
| 13 | `receiptUrl` | Nota fiscal | upload | bucket `marketing-attachments` (`:34`), URL assinada de 300 s (`:250`) |
| 14 | `companyIds` | Empresas | multi-chip | |
| 15 | `notes` | Observações | textarea | |

**Campos do teto de orçamento** (`marketing_budgets`, `use-marketing-budgets.js:7-30`):
`companyIds` · `category` · `periodYear` · `amount` · `notes`.

**Abas / painéis:**

| Aba | Conteúdo | Entidade relacionada |
|---|---|---|
| Despesas | 3–4 `StatCard` (Total, Pendente, Pago e, com busca de item ativa, `Total em "<termo>"`) + 6 filtros + tabela (`:1616-1710`) | `marketing_expenses`, `marketing_expense_items` |
| Orçamento | `BudgetPanel`: barras consumo × teto por categoria, `StatCard` "Teto total"/"Consumido"/"Comprometido", legenda Pago / A pagar / Comprometido em compra, e um bloco do que ficou FORA das barras (`computeBudgetGaps`) | `marketing_budgets`, `marketing_purchase_requests` |

O painel de Orçamento é o único que carrega `marketing_purchase_requests`, e
só quando a aba está aberta (`enabled: tab === "orcamento"`, `:1373`). Gestão
de teto exige `isMarketingManager` (`:1379-1382`); analista vê as barras, não
os botões.

**Colunas da tabela de despesas** (`:1715`): Descrição · Campanha · Entregas ·
Tarefas · Categoria · Empresa(s) · Valor · Vencimento · Status · (ações).
A célula Descrição ganha o chip "Origem: Compras" quando `notes` contém
"Origem: compra " — marcação do trigger, **sem deep-link pra solicitação de
origem** (`:1741-1756`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Nova Despesa" | abre `ExpenseModal` vazio (`:1542-1575`) |
| Clique na linha / ícone lápis | abre `ExpenseModal` em edição |
| Ícone lixeira | `confirmDeleteId` → confirmação; erro aparece em `deleteError` (`:1814-1830`) |
| "Adicionar item" | acrescenta linha; com item presente o campo Valor some e o total vira `formatBRL(computedTotal)` (`:469-486`) |
| Upload de nota fiscal | sobe pro bucket com o `id` gerado no cliente antes do primeiro save (`:238`, `:1512-1516`) |
| Filtro "Item" | busca na descrição das LINHAS; despesa com itens só entra se algum item bater, e o `StatCard` mostra a soma só dos itens que bateram; despesa sem item cai no fallback da própria Descrição, valendo o valor cheio (`:1437-1468`) |
| Filtro de empresa | vale pra tabela **e** pro painel de Orçamento — o painel nunca calcula recorte próprio (`:1490-1497`) |
| Ano do Orçamento | `budgetYear` separado de `filterYear` de propósito: a tabela aceita "todos os anos", um teto é sempre de um ano (`:1402-1404`) |

**Entidades ligadas:** `marketing_expenses` (principal) ·
`marketing_expense_items` (linhas) · `marketing_expense_deliverables` e
`marketing_expense_tasks` (junções com Entregas e Tarefas) ·
`marketing_budgets` (tetos) · `marketing_campaigns` (`campaign_id`) ·
`marketing_purchase_requests` (comprometido do painel; e a origem das despesas
criadas por trigger) · bucket `marketing-attachments`.

---
## 3.26 Relatório de Feiras — `/marketing/feiras`


Componente: `FairReportView.jsx` (`App.jsx:2781-2790`). Bloqueada pra agência.
Recebe `campaigns`, `leads` e `activeCompany` do `App.jsx` — não tem hook de
dado próprio, exceto `useMarketingExpenses` pro custo (`:230`).

**Visões (L2):** sem toggle. Sequência fixa: faixa "Fora destes números" →
4–5 `StatCard` → avisos condicionais → lista de cards de feira → painel de
detalhe da feira selecionada. Selecionar é um acordeão de um item só: clicar
de novo no mesmo card fecha (`:424`).

**Escopo:** feira = campanha de canal **"Evento"** (`FAIR_COPY.channels`,
`:155`), filtrada pela frente ativa (`:243-251`).

**Campos:** a tela não tem formulário. Bloco omitido — o cadastro da feira
acontece em `/marketing` (Campanhas) e o custo, em `/marketing/despesas`.

**Métricas por feira** (`FairCard`, `:64-133`; motor em `src/utils/fair-report.js`):

| Métrica | Origem |
|---|---|
| Custo | soma de `marketing_expenses` com `campaign_id` da feira |
| Leads | `leads.campaign_id` |
| Ganhos | leads em `WON_STAGES` |
| CAC | custo ÷ leads ganhos |
| Retorno | receita ÷ custo, exibido como `N.Nx` |
| Δ vs. edição anterior | `compareAtSameAge` — corta as duas edições na MESMA idade em dias; o arquivo existe pra evitar a comparação de acumulados, que faz a feira nova parecer sempre pior (`fair-report.js:13-20`) |

Data de referência da feira = `launchDate`, e na falta dela `createdAt`
(`fair-report.js:43-47`). Se a edição anterior for mais recente que a atual, a
comparação é omitida com aviso explícito, em vez de invertida (`:127-131`).

Painel de detalhe (`:429-460`): Custo · Leads · Custo/lead · Conversão ·
Em aberto · Receita. A Conversão passa por `razaoHonesta`, que devolve valor
**e** nota com o denominador (`n` de decididos, mais "X em aberto fora da
conta") — `:437-449`.

**Faixas de aviso:**

| Faixa | Condição | Texto |
|---|---|---|
| "Fora destes números" | há lead descartado | conta leads sem campanha vinculada e leads de demonstração, sobre a base do recorte (`:351-373`) |
| Escopo parcial | usuário não é admin/gerente/diretoria | "Você está vendo só os negócios sob sua responsabilidade" — o custo é total, o resultado é parcial (`:393-407`) |
| Origem não indicada | leads com `trigger === "feira"` e sem `campaignId` | "N negócios vieram de feira sem indicar qual" (`:409-426`) |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique num card de feira | abre/fecha o painel de detalhe daquela feira (`:424`) |
| Sem campanha de canal Evento | `EmptyState` "Nenhuma feira cadastrada", apontando o caminho: cadastrar em Campanhas e importar a lista de contatos (`:344-348`) |

Não há botão de exportar, criar, editar nem excluir nesta tela.

**Entidades ligadas:** `marketing_campaigns` (canal "Evento") · `leads`
(`campaign_id`, `trigger`, `isDemo`) · `marketing_expenses` (`campaign_id`) ·
`WON_STAGES` de `src/constants/pipelines.js`.

**Nota de reuso:** o mesmo componente serve `/marketing/conteudo`
(`ContentReportView`, `FairReportView.jsx:501-504`), que troca `FAIR_COPY` por
`CONTENT_COPY` — canais "Conteúdo" e "Digital", pareamento por
`contentCampaignPairKey` e overlay de conta
(`collapseLeadsToAccounts`/`accountMetrics`). Nessa variante
`unlinkedTrigger` é `null` por decisão documentada (`:181-186`), então a
faixa de origem não indicada não aparece lá. Essa rota está fora desta fatia.
## 3.27 Relatório de Conteúdo — `/marketing/conteudo`


Décima rota do menu Marketing (`src/constants/routes.js:54`, item em
`App.jsx:1929`), acessível a usuário de Marketing não-agência ou diretoria;
qualquer outro cargo é redirecionado para `/marketing` (`App.jsx:2791-2800`).

**Não é componente próprio.** É `FairReportView` com `variant="content"`
(`FairReportView.jsx:502-504`) — o mesmo arquivo que serve `/marketing/feiras`.
A `variant` troca só a cópia e o filtro de canal; o motor de métrica
(`computeAllFairMetrics` / `compareAtSameAge`) é o mesmo nos dois.

**Visões (L2):** nenhuma. Não há toggle Kanban/Tabela/Calendário nem abas; a
tela é uma faixa de `StatCard` seguida de uma lista de cartões por campanha, e
o cartão selecionado abre um detalhe abaixo da lista, na mesma página
(`:424-440`).

**O que separa esta rota de `/marketing/feiras`** (`CONTENT_COPY`,
`FairReportView.jsx:169-187` vs `FAIR_COPY`, `:153-168`):

| Propriedade | `/marketing/feiras` | `/marketing/conteudo` |
|---|---|---|
| `channels` (filtro de campanha) | `["Evento"]` | `["Conteúdo", "Digital"]` |
| `pairKey` (como duas campanhas viram par comparável) | `fairPairKey` | `contentCampaignPairKey` (formato `frente-aaaamm-tema`) |
| `showChannelBadge` | `false` | `true` |
| `unlinkedTrigger` | `"feira"` | **`null`** |
| Overlay de conta | não | sim (`accountByCampaign`, `contentAccounts`, `:306-325`) |

**Cartões de resumo** (`StatCardGrid`, `:375-392`) — 4 na variante de feira, 5
aqui, porque "Contas" só existe quando `contentAccounts` não é nulo:

| # | Valor | Rótulo | Sublinha | Origem do número |
|---|---|---|---|---|
| 1 | `metrics.length` | Campanhas | — | campanhas de canal Conteúdo/Digital no recorte de frente |
| 2 | `totals.leadCount` | Leads captados | `{wonCount} viraram negócio` | soma por campanha |
| 3 | `contentAccounts.accountCount` | Contas | `{pct(accountConversion)} ganhas / decididas`, ou `{touchCount} toques · conversão —` quando o denominador é zero | `collapseLeadsToAccounts` + `accountMetrics` |
| 4 | `totals.cac` | CAC médio | `custo ÷ leads ganhos` | `cost / wonCount`, `—` quando `wonCount = 0` |
| 5 | `totals.roi` | Retorno | `{revenue} sobre {cost}` | `revenue / cost`, `—` quando `cost = 0` |

O cartão 3 é o único da plataforma que troca o percentual pela contagem
absoluta quando não há denominador — `accountConversion == null` cai em
"toques · conversão —" (`:385-387`).

**Faixa "Fora destes números"** (`:353-373`) — renderizada **antes** de
qualquer cartão, quando há descarte. Conta duas causas separadamente e informa
a base: `{n} leads sem campanha vinculada · {n} de demonstração — de {base}
leads no recorte`. O cálculo está em `:235-241`: `base` é todo lead da frente
ativa, `demo` é `isDemo || is_demo`, `semCampanha` é não-demo sem
`campaignId || campaign_id`.

**Aviso de escopo parcial** (`:394-409`) — para quem não é admin, gerente ou
diretoria (`hasFullLeadScope`, `:335-336`): "o custo da campanha é o total, mas
o resultado é só a sua parte".

**Aviso de origem não registrada** (`:411-427`) — o bloco existe, mas nesta
rota nunca renderiza: ele depende de `unlinked > 0`, e `unlinked` retorna `0`
imediatamente quando `unlinkedTrigger` é nulo (`:328-334`), o que é o caso de
`CONTENT_COPY`. O comentário no próprio arquivo (`:184-186`) registra a
decisão: não há `trigger` dedicado a conteúdo como há a feira, e sem sinal
confiável a tela não monta o balde "origem não registrada". O lead sem campanha
fica de fora dos números — e é contado pela faixa "Fora destes números" acima,
que não depende de `unlinkedTrigger`.

**Abas do drawer (L3):** não existem. Não há drawer nesta tela; o detalhe da
campanha selecionada é uma seção que abre abaixo da lista, e clicar de novo no
mesmo cartão fecha (`:430-431`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Clique no cartão de campanha | alterna `selectedId`; abre/fecha o detalhe abaixo da lista, sem trocar de URL |
| Troca da frente ativa no TopBar | recalcula `descartados`, `scoped` e todas as métricas |
| Estado vazio | quando nenhuma campanha de canal Conteúdo/Digital existe no recorte, a tela inteira vira `EmptyState` e nenhum cartão é montado (`:345-350`) |

**`data-tour`:** `marketing-conteudo-report` no contêiner raiz, presente só
quando `variant === "content"` (`:338`).

**Entidades ligadas:** `marketing_campaigns` (filtradas por `channel` e
`company_ids`) · `leads` (via `campaign_id`) · `marketing_expenses` (custo por
campanha) · nenhuma escrita — a tela é somente leitura, não cria nem altera
registro nenhum.

---

### Grupo: Recursos Humanos
Meu RH, o portal do colaborador, está no grupo Meu Espaço por ser onde o menu o coloca para quem não é RH.
## 3.28 Visão Geral · RH — `/rh`


`RHOverviewView.jsx`. Rota aberta a `isRHUser || isDiretoria`; `canWrite` é
`isRHManager` (`App.jsx:2830-2834`).

**Visões (L2):** nenhuma. Página única, em 4 zonas fixas, com visibilidade por
widget via `useDashboardWidgetPrefs(userId, "rh")` (`:107`) e o modal
`WidgetPrefsModal` alimentado por `VISAO_GERAL_WIDGETS.rh` (`:527-535`).

**Zona 1 — 6 tiles `StatCard`** (`:341-368`, cada um atrás de `widgetVisible`):

| # | id do widget | Rótulo | Origem do número |
|---|---|---|---|
| 1 | `stat_total` | Total de Funcionários | `colaboradores.length`; trend contra headcount reconstruído no início do mês (`:177-190`) |
| 2 | `stat_ativos` | Ativos | `employeeStatus` vazio ou `"ativo"` (`:145-147`) |
| 3 | `stat_ferias` | De Férias | `employeeStatus === "ferias"` |
| 4 | `stat_afastados` | Afastados | `employeeStatus === "afastado"`; `accent` vira `--warning` se > 0 |
| 5 | `stat_desligamentos` | Desligamentos (12 meses) | desligados com `desligamentoDate` nos últimos 365 dias (`:153-160`) |
| 6 | `stat_turnover_rate` | Taxa de turnover aproximada | `desligados12m / (ativos + desligados12m)`; `null` — exibido "—" — quando o denominador é 0 (`:163-165`); `accent` `--danger` a partir de 20% |

**Zona 2 — 3 `TaskBucket`** (`:223-258`), cada um com `fullCount` e no máximo 4
itens listados:

| id | Título | Fonte | Clique |
|---|---|---|---|
| `bucket_ferias_pendentes` | Férias pendentes | `rh_ferias` com `status = "pendente"` (`:129-137`) | `onNavigate("rh-ferias")` |
| `bucket_vagas_abertas` | Vagas em aberto | `rh_vagas` com `stage = "publicada"` (`:119-127`) | `onNavigate("rh-recrutamento")` |
| `bucket_desligamento_sem_entrevista` | Desligamentos sem entrevista | desligados 12m sem `desligamentoTipo` (`:170`) | `onNavigate("rh-funcionarios")` |

**Zonas 3 e 4** (`:403-513`): painel "Distribuição por Departamento"
(`StageDistributionBar`, top 8 departamentos, paleta categórica fixa
`DEPT_COLORS` porque departamento é texto livre sem cor em tabela — `:40-45`) ·
"Desligamentos por Tipo" (% voluntário + `Badge` por tipo de
`RH_DESLIGAMENTO_TIPOS`) · "Admissões Recentes" (5 mais recentes). A Zona 4 é um
`EmptyState` que diz no próprio texto que ainda não mostra widget — só o título
é personalizável (`:505-512`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Atualizar" | `window.location.reload()` (`:296`) |
| "Exportar" (só `canWrite`) | `exportColaboradoresToCSV` + `logExport(userId, "rh_overview_dashboard", n)` (`:305`) |
| "Personalizar" | abre `WidgetPrefsModal` |
| item de bucket | `onNavigate(section)` — troca de rota, sem abrir o registro |

**Entidades ligadas:** `rh_colaboradores` (via `useRHColaboradores`) ·
`rh_vagas` (consulta direta, `:119`) · `rh_ferias` com join
`profiles:user_id(full_name, job_title)` (`:130`) · `rh_pipeline_stages` domínio
`vagas`, só para nomear a etapa no badge da vaga.

---
## 3.29 Recrutamento — `/rh/recrutamento`


`RHRecrutamentoView.jsx` (4331 linhas, o maior arquivo da fatia). Rota aberta a
`isRHUser || isDiretoria`; `canWrite = isRHManager`, `canTriage = isRHUser`
(`App.jsx:2858-2869`).

**Visões (L2):** duas dimensões ortogonais, declaradas assim no código
(`:3068-3069`):

- `viewMode` — **Vagas** | **Candidatos**. Toggle colado no título, "porque é o
  que decide o que a tela inteira mostra" (`:3731-3747`).
- `boardMode` — **Kanban** | **Tabela** | **Calendário** | **Análise**
  (`:3775-3778`).

São 8 combinações. O `FilterBar` do header é um só, sempre renderizado; o que
muda com `viewMode` é qual estado ele edita (`vagaSearch` ou `candSearch`), mais
um filtro fixo de **Frente** (`RH_FRENTES`) — `:3757-3771`.

**Campos da vaga** (`NovaVagaModal`, `:492-535`, ordem real do formulário):

| # | chave | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `title` | Título da vaga * | text | obrigatório |
| 2 | `company_ids` | Frente(s) * | chips multi | `RH_FRENTES` = sanwey · resibag · montemor |
| 3 | `cargo_template_id` | Modelo de cargo salvo | select | preenche 7 campos abaixo; escolher "Sem modelo" **limpa** os que o modelo tinha preenchido (`:526-545`) |
| 4 | `job_title` | Cargo * | text | |
| 5 | `department` | Departamento * | select | `RH_DEPARTMENTS` (12) |
| 6 | `contract_type` | Tipo de contrato | select | `RH_CONTRACT_TYPES` (7) |
| 7 | `priority` | Prioridade | select | `PRIORITY_OPTIONS`: baixa/média/alta/urgente (`:103-108`) |
| 8 | `salary_min` | Salário mín. (R$) | currency | `CurrencyInput` |
| 9 | `salary_max` | Salário máx. (R$) | currency | |
| 10 | `positions` | Posições | number 1-999 | normalizado no blur e no submit |
| 11 | `hiring_deadline` | Prazo para contratação | date | |
| 12 | `schedule_blocks` | Jornada | `RHJornadaEditor` | blocos por dia da semana (`RH_WEEKDAYS`) |
| 13 | `escala` | Escala | select | `RH_ESCALA_TYPES` (5) |
| 14 | `benefits` | Benefícios | `RHBenefitsPicker` | |
| 15 | `description` | Descrição | textarea | |
| — | `custom_fields` | "Campos desta etapa" | por etapa | `rh_pipeline_stage_fields` domínio `vagas`, via `resolveVisibleFields` |

Obrigatórios checados no submit: título, ao menos uma frente, departamento e
cargo (`:554-558`), depois `getMissingRequiredFields` e `getInvalidFields` sobre
os campos de etapa.

**Vaga com mais de uma posição** — `posicoesInfo()` (`:109-135`) documenta a
origem de cada número no próprio comentário: `total` é `rh_vagas.positions`
(NOT NULL default 1); `contratados` conta candidaturas com `rh_aplicacoes.hired_at`
preenchido (o carimbo da conversão, não o da aprovação); `aguardando` conta
quem está na etapa `aprovado` ainda sem `hired_at`. Os dois são separados de
propósito, e a barra de progresso conta só a conversão.

**Campos do candidato** (`NovoCandidatoModal`, `:1721-1771`):

| # | chave | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `name` | Nome | text | obrigatório |
| 2 | `email` | E-mail | email | usado como chave de `upsert` em `rh_candidatos` (`:197`) |
| 3 | `phone` | Telefone | text | |
| 4 | `vaga_id` | Vaga | select | **opcional** — sem vaga o candidato só entra no banco de talentos; a opção literal é "Sem vaga — só banco de talentos" (`:1820`) |
| 5 | `source` | Origem | text | |
| 6 | — | "Campos desta etapa" | por etapa | só aparece se houver vaga: "sem vaga não existe etapa_pipeline pra vincular" (`:1738`) |

**Abas do drawer / painéis (L3) — drawer da VAGA** (`VagaDrawer`, `:1088-1427`):

| Slot | Conteúdo | Entidade relacionada |
|---|---|---|
| `header` | `EditableTitle` do `title` + cargo/departamento + badge de etapa + badge de prioridade + badges de frente (`:1131-1152`) | `rh_vagas` |
| `center` | "Campos desta etapa"; quando não há nenhum, um botão-texto "Nenhum campo nessa fase. Clique aqui para editar essa etapa." (`:1155-1185`) | `rh_pipeline_stage_fields` |
| `left` | Responsáveis (`AssigneeMultiSelect` sobre `responsible_ids`), benefícios, descrição, e então `RHDetailDrawerShell` (`:1284-1361`) | `profiles` |
| `left` › aba Form | link público `/vagas/:link_slug` + WhatsApp + QR (só quando `stage === "publicada"`) · "Editar vaga" · "Ver candidatos" · bloco "Avaliação do gestor de área" com lista de links, status Ativo/Expirado/Revogado e botão Revogar (`:1188-1282`) | `rh_vaga_manager_links` |
| `left` › Atividades/Histórico/IA/Anexos/Checklists | padrão do shell | `rh_stage_history`, `rh_attachments`, `rh_checklists` |
| `right` | "Mover para" (`StageNavigator` com `currentStageKey`+`allStages`) · `RHDetailComments` (mention `module: "rh_vagas"`) · link "Editar campos desta etapa" | |

**Drawer do CANDIDATO** (`CandidatoDrawer`, `:1882-2356`):

| Slot | Conteúdo | Entidade relacionada |
|---|---|---|
| `header` | avatar de iniciais + `EditableTitle` do nome + e-mail + badge de etapa + "Nd nesta etapa" (`:1986-2001`) | `rh_candidatos` |
| `center` | "Campos desta etapa" (domínio `candidatos`) | `rh_pipeline_stage_fields` |
| `left` | grade Vaga · Origem · Telefone · Aplicado em · Avaliação (`StarRating` 0-5) · botão "Ver currículo" que gera `createSignedUrl` de 1h no bucket `rh-curriculos` (`:2212-2225`) · caixa de fit score da triagem por IA quando `fit_score` é número (`:2227-2237`) · `RHDetailDrawerShell` | `rh_aplicacoes`, bucket `rh-curriculos` |
| `left` › aba Form | motivo de reprovação já registrado · faixa "Contratado" com data e botão "Desfazer" · faixa "Candidato aprovado!" com botão "Converter" (só em `aprovado` e sem `hired_at`) · lista de Notas com composer (`:2040-2188`) | `rh_aplicacoes.notes` |
| `right` | "Mover para" + caixa inline "Motivo da reprovação *" quando o destino é etapa `lost` · `RHDetailComments` (`module: "rh_candidatos"`) · "Editar campos desta etapa" | |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Toggle Vagas/Candidatos | troca o board inteiro; `FilterBar` continua no lugar, sem refluir |
| "Exportar CSV" | `exportVagasToCSV(vagasVisiveis)` ou `exportCandidatosToCSV(filteredCandidatos)` — sempre o array já filtrado (`:3783-3792`) |
| "Editar etapas" (só `canWrite`) | abre `RHStageListManager` para o domínio ativo |
| "Nova vaga" / FAB | `NovaVagaModal`; carrega `data-tour="vaga-posicoes"` (`:3810`) |
| "Triar com IA" (só `canTriage`, só em Candidatos) | `TriagemIAModal` (`:186-415`) — roda sobre o **banco de talentos** filtrado por frente, só currículos `pdf`/`docx`; conta quantos ficaram de fora por não ter currículo; resultado permite "Adicionar à vaga" |
| Arrastar candidato pra coluna `lost` | `ReprovacaoDropModal` exige motivo antes de mover (`:2505`) |
| Seleção múltipla na Tabela de candidatos | `BulkReprovarModal` (`:2569`) — motivo + caixa "enviar e-mail"; o resumo informa quantos e-mails distintos e quantos sem e-mail |
| "Converter" (candidato aprovado) | abre `NovoColaboradorModal` com `hireContext`; ao salvar: cria ficha em `rh_colaboradores` com `aplicacaoId` do elo, aplica template de onboarding que bata com `vaga.job_title`, chama `markHired`, e **só se o carimbo deu certo** reconta contratados no banco e encerra a vaga quando as posições fecham (`:3186-3247`) |
| "Desfazer" (contratado) | `DesfazerContratacaoModal` (`:2368`) pede motivo; `handleDesfazerContratacao` (`:3280-3321`) faz 3 passos: `unmarkHired` (único que precisa dar certo), move a ficha pra etapa "Removido" do Onboarding, e reabre a vaga em `em_triagem` se ela estava `encerrada`. Falha dos passos 2/3 volta como lista `falhas` que o modal exibe |
| Reconhecer a ficha no desfazer | `encontrarColaboradorDaCandidatura` (`:3255-3278`) tenta `aplicacaoId`, depois e-mail dentro da mesma vaga, depois nome; devolve `null` quando não há unicidade |
| "Encaminhar pro gestor" | `EncaminharGestorModal`; só fecha como sucesso se `emailSent` for verdadeiro (`:1268-1280`) |
| Seletor de vaga (pílulas) em Candidatos | filtra o board; "Todas as vagas" é a primeira pílula (`:3946`) |
| Banco de talentos | barra fixa com copiar-link e QR de `/trabalhe-conosco` (`:3935-3941`) |
| Vaga não publicada | faixa âmbar: "mova para 'Publicada' na aba Vagas pra liberar o link de candidatura" (`:3983`) |

**Entidades ligadas:** `rh_vagas` · `rh_candidatos` · `rh_aplicacoes` (a junção
candidato×vaga — o board de Candidatos É essa junção) · `rh_cargo_templates`
(modelo de cargo) · `rh_vaga_manager_links` (link de avaliação sem login) ·
`rh_colaboradores` (destino da conversão) · `rh_onboarding_templates` /
`rh_onboarding_tarefas` (checklist aplicado na contratação) ·
`rh_pipeline_stages` domínios `vagas` e `candidatos` ·
`rh_pipeline_stage_fields` · `rh_stage_history` · `rh_attachments` ·
`rh_checklists` · buckets `rh-curriculos`.

---
## 3.30 Onboarding — `/rh/onboarding`


`RHOnboardingView.jsx`. **Rota sem gate de cargo** (`App.jsx:2870-2879`): todo
mundo entra; o que muda é a prop `isRHUser = isRHUser || isDiretoria`, e o
componente bifurca em duas telas completamente diferentes no meio do render
(`:1610`).

**Visões (L2):**

- **Colaborador comum (`isRHUser === false`)** — sem Kanban. Duas seções
  empilhadas: o próprio checklist (`MeuChecklist`, alimentado por
  `useMyColaborador` → RPC `get_my_colaborador`) e, abaixo, "Minha equipe em
  onboarding".
- **RH** — Kanban | Tabela | Calendário | Análise (`:1681-1686`).

**"Minha equipe em onboarding"** (`EquipeEmOnboarding`, `:1207-1273`; hook
`use-onboarding-equipe.js`): duas RPCs em paralelo, `tenho_equipe_de_rh` e
`get_onboarding_da_minha_equipe` (`:39-42` do hook). São duas e não uma porque
"não sou gestor de ninguém" e "sou gestor mas ninguém está entrando agora" são
estados diferentes que a contagem sozinha não distingue. Lê por RPC e nunca
direto de `rh_colaboradores`, porque a RLS daquela tabela devolve zero linha pra
quem não é do RH e afrouxá-la entregaria a linha inteira (salário, CPF,
endereço). Carrega só quando `!isRHUser` (`:1290`). Erro na carga apaga a seção
em silêncio e registra no console (`:50-58` do hook). Cada linha mostra nome,
cargo·departamento·admissão·vaga de origem, badge da etapa (cor via
`stageTextColor`) e "há N dias nesta etapa" com `title` avisando que, em fichas
vindas de importação, a coluna guarda o instante da importação.

**Campos do colaborador** — não há formulário próprio: criar abre
`NovoColaboradorModal` (`:1688-1696`), o mesmo da contratação e de Funcionários.
Ordem real do modal (`NovoColaboradorModal.jsx:379-560`): documento (RG ou CNH,
obrigatório na criação, com extração por IA) · Nome completo * · CPF * · RG * ·
Nascimento * · Telefone * · E-mail * · Rua * · Número * · CEP * · Bairro * ·
Cidade * · Estado * (`BR_UFS`) · Cargo * (select do catálogo) · Frente * ·
Departamento * · Gestor · Tipo de contrato * · Data de admissão * · Dias de
período de experiência * · Início/Fim do contrato de aprendizagem * (só
`aprendiz`) · Status · Salário (R$) * · Vencimento do ASO * · Fim do contrato *
(só temporário) · campos de etapa do domínio `onboarding`.

**Abas do drawer / painéis (L3)** (`OnboardingDrawer`, `:429-731`):

| Slot | Conteúdo | Entidade relacionada |
|---|---|---|
| `header` | avatar de iniciais, nome, cargo·departamento, badge de etapa | `rh_colaboradores` |
| `center` | "Campos desta etapa" (domínio `onboarding`), salvos com debounce de 600ms e flush no cleanup (`:455-477`) | `rh_pipeline_stage_fields` |
| `left` | grade Telefone · E-mail · Tipo de contrato · Data de admissão · Vaga de origem · Checklist (`n/m concluídas`) · `DocumentosAdmissao` · `RHDetailDrawerShell` (`:652-689`) | |
| `left` › aba Form | "Checklist de integração": lista de `TaskRow` + aplicar template (só quando ainda não há tarefa) + adicionar tarefa avulsa com prazo em dias e responsáveis | `rh_onboarding_tarefas`, `rh_onboarding_templates` |
| `right` | "Mover para" · `RHDetailComments` (`module: "rh_onboarding"`) | |

`DocumentosAdmissao` (`rh-pipeline/DocumentosAdmissao.jsx`) mora **dentro** do
slot `left`, junto do checklist, e o cabeçalho do arquivo registra por quê: não
vira aba nova no shell, que serve 6 telas. Cada item tem status
pendente/recebido/não se aplica, arquivo, quem recebeu e observação; grupos
`identificacao` · `residencia` · `trabalho` · `familia` · `saude` · `formacao` ·
`outros` (`:16-24`). Tabelas `rh_documento_tipos` + `rh_colaborador_documentos`,
bucket `rh-documentos-colaborador`.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Novo colaborador" / "+" da coluna / FAB | `NovoColaboradorModal` na etapa correspondente (`:1693`) |
| "Tarefa em lote" | aplica uma tarefa a vários colaboradores de uma vez |
| "Template" | cria `rh_onboarding_templates` |
| "Exportar CSV" | `exportOnboardingToCSV(colaboradoresEmOnboarding, { stages })` |
| Aplicar template no drawer | marcos ancorados na **data de admissão**, não na data de aplicação; sem admissão cadastrada, cai em hoje (`:481-489`) |
| Lixeira no card (⋮) | não apaga: move pra etapa `terminal && lost` ("Removido"), com a mensagem `REMOVE_FROM_ONBOARDING_CONFIRM_MESSAGE` (`:105-107`) — "Nada é apagado — o cadastro e o histórico continuam intactos em Funcionários" |
| Aba Análise | `analyticsStages` exclui toda etapa `terminal` (`:1574-1577`); `colaboradoresEmOnboarding` exclui a etapa Removido do denominador (`:1327`); há uma métrica dedicada "Tempo médio até Removido" (`:1592-1601`) |

`deleteColaborador` (hard delete com CASCADE) foi removido do hook — o
comentário em `:1287-1292` registra que nenhuma tela oferecia caminho seguro
pra ele.

**Entidades ligadas:** `rh_colaboradores` · `rh_onboarding_tarefas` ·
`rh_onboarding_templates` · `rh_documento_tipos` · `rh_colaborador_documentos` ·
`rh_vagas` (nome da vaga de origem) · `rh_pipeline_stages`/`_stage_fields`
domínio `onboarding` · RPCs `get_my_colaborador`, `tenho_equipe_de_rh`,
`get_onboarding_da_minha_equipe`.

---
## 3.31 Treinamentos — `/rh/treinamentos`


`RHTreinamentosView.jsx`. Rota sem gate de cargo (`App.jsx:2880-2890`); bifurca
por `isRHUser` (`:1671`).

**Visões (L2):**

- **Colaborador comum** — lista dos próprios treinamentos atribuídos
  (`atribuicoes` filtradas por `meuColaborador.id`, `:1606`).
- **RH** — faixa `ComplianceStats` + catálogo em acordeão. Cada treinamento do
  catálogo abre um **board próprio em modal de tela cheia**
  (`TreinamentoBoardModal`, `:1175`), e é lá dentro que existe o toggle Kanban |
  Tabela | Calendário | Análise (`:1349-1352`).

"Criar" nesta tela tem dois significados diferentes: **Novo treinamento** cria
uma linha em `rh_treinamentos`; dentro do board de um treinamento, adicionar um
card significa **atribuir um colaborador já existente**
(`AtribuirModal`, `:220`), que grava em `rh_treinamento_atribuicoes`.

**Campos do treinamento** (`NovoTreinamentoModal`, `:95-211`):

| # | chave | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `titulo` | Título * | text | obrigatório |
| 2 | `descricao` | Descrição | textarea | |
| 3 | `tipo` | Tipo | select | `opcional` \| `obrigatorio` |
| 4 | `validade_dias` | Validade (dias) | number | em branco = não expira; o hint cita "NR anual = 365" |
| 5 | `frente` | Frente aplicável | select | vazio = todas |
| 6 | `cargo_alvo` | Cargo alvo | text | atribuição automática |
| 7 | `departamento_alvo` | Departamento alvo | select | idem |
| 8 | `link_conteudo` | Link do conteúdo | url | |

O texto sob os dois campos de alvo declara o gatilho: "Se obrigatório e o cargo
ou departamento bater, o treinamento é atribuído sozinho quando o colaborador
entra em 'Integração' no onboarding" (`:190`).

**Faixa de conformidade** (`ComplianceStats`, `:397-548`): `FilterBar` com
filtros **Treinamento** e **Frente**, mais um seletor de data de auditoria no
slot `trailing`. Quatro tiles — Conformidade (%) · Concluídos · Pendentes ·
Vencidos (`:431-443`). O tile Concluídos carrega um sublabel declarando o que
ficou de fora: `+N autodeclarado(s) (obrigatório sem certificado, fora do %)`.
Com data de auditoria preenchida, `computePreAuditoria` (`:368`) monta os
baldes de pendência até aquela data.

**Abas do drawer / painéis (L3)** (`AtribuicaoDrawer`, `:750-973`) — **é o único
drawer desta fatia com `left = null`** (`:871`) e o `RHDetailDrawerShell` no
slot `center` (`:941`):

| Slot | Conteúdo | Entidade relacionada |
|---|---|---|
| `header` | colaborador · treinamento · badge de etapa | `rh_treinamento_atribuicoes` |
| `left` | `null` | — |
| `center` | `RHDetailDrawerShell` inteiro (`domain="treinamentos"`, `record.stage = atribuicao.status`) | |
| `center` › aba Form | campo de link do certificado, com aviso `--warning` "Sem certificado em mãos — o auditor vai cobrar" quando vazio · "Campos desta etapa" | |
| `right` | "Reciclar treinamento" (zera conclusão e certificado; texto muda conforme `status === "vencido"` ou antecipação) · `RHDetailComments` (`module: "rh_treinamentos"`) · "Editar campos desta etapa" | |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Novo treinamento" (só `canWrite`) | `NovoTreinamentoModal` |
| Clique no cabeçalho do treinamento no catálogo | expande/colapsa a lista de atribuições |
| Abrir o board do treinamento | `TreinamentoBoardModal` em `position:fixed inset:0`, com margem de 24px e cantos de 16px (`:1329-1331`) |
| Atribuir | `AtribuirModal` sobre `rh_colaboradores` já cadastrados |
| "Reciclar treinamento" | reabre a atribuição, zerando conclusão e certificado |
| Aba Análise do board | stats próprios: Taxa de conclusão = `concluído / (concluído + vencido)`, `null` → "—" quando o denominador é 0; Certificados emitidos (`:1313-1327`). O comentário registra que "no período" não existe aqui porque o board não tem filtro de datas |

**Entidades ligadas:** `rh_treinamentos` · `rh_treinamento_atribuicoes`
(`status`, `data_conclusao`, `certificado_url`, `custom_fields`, `activities`) ·
`rh_colaboradores` · `rh_pipeline_stages`/`_stage_fields` domínio `treinamentos`
· `rh_stage_history` · `rh_attachments`.

---
## 3.32 Avaliação de Desempenho — `/rh/feedback`


`RHFeedbackView.jsx`. Rota sem gate de cargo (`App.jsx:2891-2900`); bifurca por
`isRHUser` (`:1607`).

**Visões (L2):**

- **Colaborador comum** — sem Kanban. Duas listas: "Pendentes (n)" e
  concluídos, escopadas a `f.user_id === meuColaborador.id || f.evaluator_id ===
  currentUser.id` (`:1608`). Só quem é o avaliado, e só enquanto `self_rating`
  está vazio, vê o botão "Preencher autoavaliação" (`:1632`).
- **RH** — **cinco** visões: Kanban | Tabela | Calendário | **Lembretes** |
  Análise (`:1697-1701`). Lembretes é exclusiva desta tela.

**Escala de nota** (`RATING_SCALE`, `:69-75`) — qualitativa ancorada, com o
valor numérico 0-10 por trás: 2 Abaixo do esperado · 5 Em desenvolvimento · 7
Atende as expectativas · 9 Supera as expectativas · 10 Excepcional.

**Tipos de ciclo** (`CICLO_TIPOS`, `utils/rh-feedback-cycles.js:13-21`):
`30_dias` · `60_dias` · `90_dias` · `semestral` · `anual` · `ad_hoc` ·
`reavaliacao`. Cadência recorrente é anual para cargo que contenha diretor /
gerente / coordenador / supervisor, ou a partir de 730 dias de casa; senão
semestral (`:42-53` do util).

**Campos do feedback avulso** (`NovoFeedbackModal`, `:162-260`): Colaborador * ·
Tipo · **Nota geral *** · Pontos fortes · Pontos de desenvolvimento · Notas.
A nota é obrigatória com justificativa explícita na mensagem de erro: "o
feedback já nasce em Concluído, precisa refletir uma avaliação de fato feita"
(`:182`).

**Campos da conclusão de ciclo** (`CompletarFeedbackModal`, `:268-414`): Nota do
gestor · Pontos fortes · Pontos de desenvolvimento · Notas · **Desfecho**
(`DESFECHOS`, `:261-266`) · Novo salário (só `promovido`) · Reavaliar em N meses
(só `reavaliar`). Quando existe `self_rating`, uma faixa no topo mostra a
autoavaliação antes de o gestor dar a dele (`:325-329`).

| Desfecho | Efeito declarado na tela | Efeito no código |
|---|---|---|
| `mantido` | "Segue no ciclo normal de avaliação" | nada além de gravar |
| `promovido` | "Envia o ajuste de salário para aprovação da diretoria" | `desfechoMeta.aguardando_aprovacao = true` e `createMovimentacao` em `rh_movimentacoes` (`:1394-1414`) — **não** altera o salário direto |
| `reavaliar` | "Agenda uma nova avaliação em 3 ou 6 meses" | `createPendingCycle` (`:1419-1424`) |
| `reprovado` | "Encerra com parecer negativo" | grava o desfecho |

**Abas do drawer / painéis (L3)** (`FeedbackDrawer`, `:780-1030`): `header` com
colaborador e etapa · `center` com "Campos desta etapa" (domínio `feedback`) ·
`left` com o resumo do ciclo e o `RHDetailDrawerShell` (`:943`) · `right` com
"Mover para", `RHDetailComments` e "Editar campos desta etapa". Existe ainda um
overlay separado, `HistoricoDrawer` (`:476`), com a tendência de notas por
colaborador — é o destino do clique na visão Lembretes.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Novo feedback" (só `canWrite`) | `NovoFeedbackModal`; o registro nasce em Concluído |
| "Preencher autoavaliação" | `AutoavaliacaoModal` → RPC `rh_submit_self_rating(p_avaliacao_id, p_self_rating)` (`use-rh-feedback.js:123`) |
| Concluir ciclo | `CompletarFeedbackModal`; promoção vira movimentação pendente e notifica com `link: { module: "rh_movimentacoes", id }` (`:1411`) |
| Visão Lembretes | lista só colaboradores `ativo`, ordenados por dias até a próxima avaliação (`avaliacaoDiasParaProxima`); o filtro de departamento fica **dentro** da visão, não no header (`:1134-1140`) |
| "Exportar CSV" | `exportFeedbackToCSV(filteredFeedbacks, …)` |
| Aba Análise | stats próprios (`:1579-1595`): Ciclos ativos · Atrasados · Concluídos · Nota média (`toFixed(1)`, "—" sem notas) · Resultaram em promoção |

`EVALUATOR_ROLES` (`:56`) = `admin`, `gerente_rh`, `rh` — é quem pode figurar
como avaliador.

**Entidades ligadas:** `rh_avaliacoes` (`self_rating`, `final_rating`,
`desfecho`, `desfecho_meta`, `evaluator_id`/`evaluator_ids`, `custom_fields`,
`activities`) · `rh_colaboradores` · `rh_movimentacoes` (destino da promoção) ·
`rh_pipeline_stages`/`_stage_fields` domínio `feedback` · RPC
`rh_submit_self_rating`.

---
## 3.33 Férias & Licenças — `/rh/ferias`


`RHFeriasView.jsx`. Rota aberta a `isRHUser || isDiretoria || isDP`;
`canWrite = isRHManager` (`App.jsx:2901-2912`).

**Visões (L2):** Kanban | Tabela | Calendário | Análise (`:1310-1313`).
Abaixo do header, **fora** dele, há mais duas linhas de controle (`:1348-1360`):
as pílulas Todas / Pendentes / Aprovadas / Recusadas (`PILL_TABS`, `:1262-1267`)
e o toggle "Minhas solicitações" ↔ "Todos os funcionários" (só `canWrite`).

**Campos da solicitação** (`SolicitarFeriasModal`, `:311-434`):

| # | chave | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `type` | Tipo * | select | `RH_LEAVE_TYPES` (7): Férias · Licença Médica · Lic. Maternidade · Lic. Paternidade · Folga Compensatória · Lic. Luto · Outros |
| 2 | `start_date` | Início * | date | |
| 3 | `end_date` | Término * | date | `min = startDate`; validação recusa fim antes do início |
| 4 | `notes` | Observações | textarea | placeholder cita CID para licença médica |
| — | `user_id` | — | — | é `rh_colaboradores.id`, não o id do profile |

Quatro tipos exigem documento (`DOCUMENTO_OBRIGATORIO_POR_TIPO`, `:54-59`):
licença médica → atestado; luto → certidão de óbito ou comprovante de
parentesco; maternidade/paternidade → certidão de nascimento ou declaração
médica. O aviso aparece no modal ("Vai precisar anexar: X (depois do envio)") e
de novo no drawer, apontando a aba Anexos.

**Aviso de antecedência** — `AVISO_MINIMO_DIAS_FERIAS = 30` (`:64`), com o
racional CLT Art. 135 no comentário. É não-bloqueante: sinaliza no modal e no
drawer, não impede envio nem aprovação.

**Abas do drawer / painéis (L3)** (`FeriasDrawer`, `:571-800`):

| Slot | Conteúdo | Entidade relacionada |
|---|---|---|
| `header` | colaborador + período + badge de status | `rh_ferias` |
| `center` | "Campos desta etapa" (domínio `ferias`) | `rh_pipeline_stage_fields` |
| `left` | observações do colaborador · faixa de aviso de antecedência · caixa "Documento exigido pra aprovar" · `RHDetailDrawerShell` (`:697`). `formContent = null` de propósito (`:672`), então a aba **Form não existe** aqui | |
| `right` | Aprovar / Recusar (só `canWrite` e só em `pendente`) · faixa "Aprovado/Recusado por <nome> em <data>" quando já decidido (`:735-746`) · "Mover para" · `RHDetailComments` (`module: "rh_ferias"`) · "Editar campos desta etapa" | `profiles` via `approver:approved_by(name)` |

**Faixa de 3 tiles** acima do board (`:1322-1346`): Pendentes · Aprovadas este
mês · Dias em férias agora.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Solicitar" | `SolicitarFeriasModal`, disponível para todo mundo que alcança a rota |
| "Aprovar" | grava status, carimba `approved_by`/`approved_at` |
| "Recusar" | `RecusarFeriasModal` (`:270`) pede motivo |
| "Exportar CSV" | `exportFeriasToCSV(filtered, …)` — array já filtrado |
| Aba Análise | stats próprios (`:1275-1285`): uma linha por tipo de licença + "Total de dias afastados" |

**Entidades ligadas:** `rh_ferias` (`status`, `status_changed_at`,
`approved_by`, `approved_at`, `custom_fields`, `activities`) ·
`rh_colaboradores` · `profiles` (aprovador) · `rh_attachments` (bucket
`rh-attachments`) · `rh_pipeline_stages`/`_stage_fields` domínio `ferias`.

---
## 3.34 Funcionários — `/rh/funcionarios`


`RHFuncionariosView.jsx` (2583 linhas). Rota aberta a `isRHUser || isDiretoria
|| isDP`; `canWrite = isRHManager` (`App.jsx:2835-2852`). **Referência do padrão
"Tabela com filtro" e única tela da plataforma com `TableDensityToggle`**
(`:51-52`, montado em `:2007`), persistido em `localStorage` sob a chave
`"rh-funcionarios-table-density"` (`:1667`).

**Visões (L2):** nenhuma troca de visão — é sempre a tabela. Paginação fixa de
`PAGE_SIZE = 50` (`:659`).

**Colunas da tabela** (`FUNC_TABLE_COLS`, `:641-650`, todas ordenáveis menos a
última): Funcionário · Cargo · Frente · Departamento · Contrato · Status ·
Admissão · (coluna sem rótulo, de ações).

**Filtros** (`:2121-2200`) — construídos com `<input>` e `<select>` crus, **não**
com o `FilterBar` compartilhado (o arquivo não o importa): busca por nome ou
e-mail · Todas as frentes (`RH_FRENTES`) · Todos os departamentos
(`RH_DEPARTMENTS`) · Todos os status (`RH_EMPLOYEE_STATUSES`) · Todos os
contratos (`RH_CONTRACT_TYPES`) · toggle "só minha equipe"
(`soMinhaEquipe`, compara `u._gestorId === meuColaboradorId`, `:1845`).

**Faixa de tiles** (`:2071-2082`): Total · Ativos · Férias · Desligados ·
**Aprendizes (cota)** — este último só aparece se houver aprendiz ou se
`RH_APRENDIZ_COTA_ALVO > 0`, e fica em `--danger` quando abaixo da cota;
a constante está hoje em `0` (`rh-config.js:73`), o que significa "cota não
definida" e faz o tile mostrar só a contagem.

**Campos do funcionário** — modal `EmployeeDetailModal` (`:877`), montado sobre
`EntityProfileModal` com `width={560}`. Aba **Dados**, modo edição
(`:1289-1495`):

| # | chave | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `job_title` | Cargo * | select | opções de `rh_cargo_templates`, filtradas pelo departamento; cargo fora do catálogo aparece como opção avulsa |
| 2 | `frente` | Frente * | select | `RH_FRENTES` |
| 3 | `department` | Departamento * | select | `RH_DEPARTMENTS` |
| 4 | `gestor_id` | Gestor | select | `rh_colaboradores.gestor_id`. A própria pessoa e os descendentes aparecem **desabilitados com o motivo**, não somem (`:923-940`); gestor desligado fora da lista vira opção avulsa pra não renderizar select em branco (`:944-952`). A trava real é um trigger no banco |
| 5 | `contract_type` | Tipo de Contrato * | select | `RH_CONTRACT_TYPES` |
| 6 | `admission_date` | Data de Admissão * | date | |
| 7 | `employee_status` | Status | select | `RH_EMPLOYEE_STATUSES` (4) |
| 8 | `salary` | Salário (R$) * | currency | |
| 9 | `aso_vencimento` | Vencimento do ASO * | date | |
| 10 | `contrato_fim` | Fim do contrato (se temporário) | date | |
| 11 | `aprendiz_inicio` | Início do contrato de aprendizagem | date | só `aprendiz` |
| 12 | `aprendiz_fim` | Fim do contrato de aprendizagem | date | idem |
| 13 | `desligamento_tipo` | Tipo de desligamento | select | `RH_DESLIGAMENTO_TIPOS` (5) |
| 14 | `desligamento_date` | Data do desligamento | date | |
| 15 | `desligamento_motivo` | Motivo | textarea | |
| 16 | `desligamento_meta` | 4 perguntas de entrevista de saída | textarea cada | `RH_ENTREVISTA_SAIDA_PERGUNTAS`: motivo principal · o que a empresa faz bem · o que poderia melhorar · recontrataria |

Em leitura (`:1505-1518`) a grade mostra Cargo · Departamento · Gestor ("Sem
gestor definido" quando vazio) · Tipo de Contrato · Data de Admissão · Status ·
Salário · Vencimento do ASO · Fim do contrato (+ os dois de aprendizagem). Abaixo:
bloco "Lidera N pessoa(s)" com as chips dos liderados, deduzido por
`equipeDe()` e não digitado (`:1526-1543`); faixa do período de experiência CLT
(`periodoExperienciaInfo`); faixa "Aviso-prévio estimado: N dias (Lei
12.506/2011 — confirme com RH/jurídico antes de aplicar)".

**Abas do modal (L3)** (`:1209-1214`):

| Aba | Conteúdo | Entidade relacionada |
|---|---|---|
| Dados | grade acima + `DocumentosSection` (Holerite e Ponto, dois `RHAttachmentsPanel` lado a lado, domínios `holerite` e `ponto`, `:292-312`) | `rh_colaboradores`, `rh_attachments` |
| Benefícios | catálogo + benefícios do colaborador, status solicitado/aprovado/ativo/cancelado | `rh_beneficios_catalogo`, `rh_colaborador_beneficios` |
| Assinatura | envio de documento pra assinatura via edge `d4sign-send`; status pendente de envio/enviado/assinado/recusado/cancelado | `rh_signature_requests`, bucket `rh-documentos-assinatura` |
| Solicitações | pedidos de atualização de dado que a própria pessoa propôs em `/meu-rh`, só os `pendente`; aprovar chama `approve_rh_data_update_request` | `rh_data_update_requests` |
| Conexões | `ConnectionsPanel` sobre a RPC `get_colaborador_connections` — **escondida do DP** porque a RPC devolve avaliações com nota final no mesmo payload, e Avaliação de Desempenho está fora do escopo do DP (`:1201-1207`) | — |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| `TableDensityToggle` | Confortável ↔ Compacta, persistido por usuário |
| "Exportar CSV" | exporta `filtered`; desabilitado com 0 linhas |
| "Importar pessoas" | `ColaboradorImportModal` (planilha, cria/atualiza ficha); `data-tour="importar-pessoas"` |
| "Importar documentos" | `BulkDocumentUploadModal` (`:414`), casa arquivo↔pessoa por `matchDocumentToColaborador` com nível de confiança (`CONFIDENCE_INFO`, `:404`) |
| "Novo Funcionário" | `NovoColaboradorModal` |
| Seleção em lote | `BulkStatusModal` (`:725`) + "Exportar seleção"; `applyBulkStatus` grava por `onUpdateUser` quando a pessoa tem login e por `updateColaborador` quando não tem, e devolve a lista de falhas em vez de engolir (`:1948-1964`) |
| Atalhos do modal | `onOpenAvaliacao` → `rh-feedback` · `onOpenMovimentacao` → `rh-cargos` · `onOpenTreinamento` → `rh-treinamentos` · `onOpenFerias` → `rh-ferias` (`App.jsx:2846-2849`), cada um com `setSelectedXId` — deep-link **interno**, sem URL |

**Entidades ligadas:** `rh_colaboradores` (fonte única de "funcionário", inclui
quem não tem login) · `profiles` (quem tem login; a tabela unifica as duas
origens em `unifiedRows`, `:1795-1820`) · `rh_cargo_templates` ·
`rh_beneficios_catalogo` / `rh_colaborador_beneficios` ·
`rh_signature_requests` · `rh_data_update_requests` · `rh_attachments`
(domínios `holerite`, `ponto`) · RPCs `get_colaborador_connections`,
`approve_rh_data_update_request` · edge `d4sign-send`.

---
## 3.35 Cargos & Salários — `/rh/cargos`


`RHCargosView.jsx`. Rota aberta a `isRHManager || isDiretoria || isDP`;
`canWrite = isRHManager || isDP`, `isDirector = isAdmin` (`App.jsx:2913-2927`).
O comentário na rota registra que o DP entra com `canWrite` porque "ver e editar
Cargos & Salários foi a única permissão que o Daniel qualificou com o verbo
editar".

**Visões (L2):** `Tabs` compartilhado com 2 abas (`:713-722`) — **Cargos** e
**Movimentações** (esta com `count` de pendentes no badge). Dentro de
Movimentações há um segundo toggle, Cards | Tabela (`:2827-2841`).

**Campos do cargo** (`CargoModal`, `:60-275`):

| # | chave | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `name` | Nome do cargo * | text | |
| 2 | `department` | Departamento * | select | `RH_DEPARTMENTS` |
| 3 | `contract_type` | Tipo de contrato * | select | `RH_CONTRACT_TYPES` |
| 4 | `salary_min` / `salary_max` | Faixa salarial * | currency ×2 | ambos obrigatórios; mín não pode passar o máx |
| 5 | `schedule_blocks` | Jornada | `RHJornadaEditor` | |
| 6 | `shift` | Turno | 2× `<input type="time">` | gravado como "HH:MM às HH:MM"; `temTurno` nasce ligado só para `RH_OPERATIONAL_DEPARTMENTS` (`:78-80`) |
| 7 | `escala` | Escala | select | `RH_ESCALA_TYPES` |
| 8 | `benefits` | Benefícios | `RHBenefitsPicker` | |
| 9 | `description` | Descrição | textarea | botão de geração por IA (`cargoDescriptionPrompt` + `useAI`) |

**Campos da movimentação** (`MovimentacaoModal`, `:276-405`): Colaborador * ·
Tipo (`TIPO_MOV`: promoção · mérito · transferência · rebaixamento · ajuste) ·
Cargo novo · Departamento novo · Salário novo · Data efetiva · Motivo. O modal
declara no subtítulo "Vai pra aprovação da diretoria antes de valer" (`:333`), e
o submit exige ao menos uma mudança entre cargo, departamento e salário
(`:300-301`). Os valores "anteriores" são capturados do colaborador no momento
da criação (`:308-313`).

**Painéis (L3 e L2):**

| Painel | Conteúdo | Entidade relacionada |
|---|---|---|
| Aba Cargos | 2 `StatCard` (Cargos cadastrados · Departamentos cobertos, com sublabel "N de 12") + `FilterBar` (busca + departamento + `GridListToggle`) + `CardGrid`/`Card` com `fmtBanda` no footer | `rh_cargo_templates` |
| Aba Movimentações | 3 `<select>` crus (colaborador · tipo · status) + toggle Cards/Tabela; bloco "Aguardando aprovação" com sufixo "· você é diretoria" ou "· só a diretoria decide" (`:845`); bloco "Histórico" | `rh_movimentacoes` |
| `CargoModal` / `MovimentacaoModal` | overlays `position:fixed` próprios | |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Botão primário do header | muda com a aba: "Novo cargo" ou "Nova movimentação" (`:705-708`) |
| Aprovar movimentação | RPC `approve_rh_movimentacao(p_id)` (`use-rh-movimentacoes.js:69`) — só `isDirector` |
| Recusar | RPC `reject_rh_movimentacao(p_id, p_motivo)` (`:77`) |
| Gerar descrição por IA | `useAI(currentUser).complete(...)`, `maxTokens: 900` |
| `FilterBar` sem nenhum cargo cadastrado | continua visível de propósito — o comentário em `:732-736` registra que sumir junto com o `EmptyState` "parecia bug" |

**Entidades ligadas:** `rh_cargo_templates` · `rh_movimentacoes` ·
`rh_colaboradores` · RPCs `approve_rh_movimentacao` / `reject_rh_movimentacao` ·
edge de IA via `useAI`.

---
## 3.36 Comunicação — `/rh/comunicacao`


`RHComunicacaoView.jsx`. Rota aberta a `isRHManager || isDiretoria`;
`canWrite = isRHManager` (`App.jsx:2928-2932`).

**Visões (L2):** dois botões-aba próprios (não o `Tabs` compartilhado,
`:913-921`) — **Comunicados** e **Pesquisas**.

Escrever e ler são separados: a diretoria entra na rota e a policy
`rh_comunicados_diretoria_read` a autoriza a ler, então quem não tem `canWrite`
vê a lista "Enviados" e recebe um `EmptyState` "Só leitura" no lugar do
formulário (`:941-943`). O comentário em `:922-937` registra também a decisão de
**não** abrir aba nova no Painel Executivo por causa desta tela.

**Campos do comunicado** (`ComunicadoComposer`, `:40-345`):

| # | chave | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | — | Partir de um modelo | chips | `rh_comunicado_modelos`; preenche título/corpo/importante/sensível e nunca envia sozinho |
| 2 | `title` | Título * | text | |
| 3 | `body` | Corpo | textarea | |
| 4 | `scopeType` | Enviar para | select | `todos` \| `frente` \| `departamento` |
| 5 | `scopeValue` | Frente/Departamento | select | obrigatório quando o escopo não é "todos" |
| 6 | `canais` | Canais | chips multi | `CANAIS` (`:29-33`): Plataforma · E-mail · **WhatsApp marcado `indisponivel: true` com hint "Em breve"** — aparece apagado de propósito, "responde 'e o WhatsApp?' sem ninguém precisar perguntar" |
| 7 | `importante` | Importante | checkbox | |
| 8 | `sensivel` | Conteúdo sensível | checkbox | `TOOLTIP_SENSIVEL` (`:35-38`) via `HelpTooltip`: tira corpo e imagem do e-mail |
| 9 | `imagem` | Imagem | arquivo | bucket `comunicado-anexos` |
| 10 | `documento` | Documento | arquivo | idem |

**Prévia de alcance** — recarrega a cada troca de escopo via RPC
`comunicado_alcance`; escopo incompleto zera em vez de manter o número anterior,
"que seria um número certo para a pergunta errada" (`:57-67`).

**Campos da pesquisa** (`NovaPesquisaModal`, `:600-735`): Título * · Descrição ·
**Modo** (`anonima` = via QR/link, respostas nunca identificadas; `identificada`
= enviada como comunicado, sabe quem respondeu) · Enviar para + Frente/
Departamento (só no modo identificada) · Fecha em · lista de perguntas, cada uma
com rótulo e tipo, chaveadas `q1`, `q2`… no salvamento (`:632`).

**Painéis (L3):**

| Painel | Conteúdo | Entidade relacionada |
|---|---|---|
| `HistoricoComunicados` (`:401`) | lista "Enviados" com alcance por canal, status do e-mail, reenvio (só `canWrite`), leituras e assinantes | `rh_comunicados`, `rh_comunicado_leituras` |
| `AssinaturaComunicado` (`:347`) | lista de quem assinou | `rh_signature_requests` |
| `ResultadosModal` (`:736`) | agregado das respostas | RPC `pesquisa_respostas_aggregado` |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Enviar comunicado" | RPC `broadcast_announcement` (`use-rh-comunicacao.js:140`), depois patch em `rh_comunicados` com o resultado do envio |
| "Reenviar e-mail" | edge `rh-send-email` (`:83`) |
| "Ver leituras" | RPC `comunicado_leituras` (`:195`) — separa confirmou / não confirmou / sem canal |
| "Nova pesquisa" (só na aba Pesquisas) | `NovaPesquisaModal` |
| "Notificar" na pesquisa | RPC `enviar_pesquisa_notificacao` (`:273`) |
| QR / copiar link | `/pesquisa/:id`, rota pública |
| Filtros de pesquisa | busca + status (aberta/encerrada) + modo (anônima/identificada), em `<select>` crus, sempre visíveis mesmo com zero pesquisas (`:964-968` registra o motivo) |

**Entidades ligadas:** `rh_comunicados` · `rh_comunicado_modelos` ·
`rh_comunicado_leituras` · `rh_pesquisas` · `rh_signature_requests` · buckets
`comunicado-anexos` · RPCs `broadcast_announcement`, `comunicado_alcance`,
`comunicado_leituras`, `enviar_pesquisa_notificacao`,
`pesquisa_respostas_aggregado` · edge `rh-send-email`.

---
## 3.37 Programas (Bem-estar) — `/rh/bem-estar`


`RHBemEstarView.jsx`. Rota aberta a `isRHManager || isDiretoria`;
`canWrite = isRHManager` (`App.jsx:2933-2937`). O título na tela é **"Programas"**
(`:487`), não "Bem-estar" — o rótulo do menu também é "Programas"
(`App.jsx:1976`).

**Visões (L2):** nenhuma. Lista de programas em acordeão, `maxWidth: 760`
(`:499`). Cada programa expande para a agenda por data.

**Campos do programa** (`ProgramaFormModal`, `:156-298`):

| # | chave | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `titulo` | Título * | text | |
| 2 | `descricao` | Descrição | textarea | |
| 3 | `inicio` | Data inicial | date | default hoje |
| 4 | `padrao.horarioInicio` / `horarioFim` | Janela de horário | time ×2 | início precisa vir antes do fim |
| 5 | `padrao.slotMinutos` | Duração do horário | number | > 0 |
| 6 | `padrao.vagasPorHorario` | Vagas por horário | number | ≥ 1 |
| 7 | `rec` | Recorrência | `BlocoRecorrencia` (`:78`) | tipo · dias da semana · intervalo em dias · até · nº de ocorrências |
| 8 | `extras` / `removidas` | Datas avulsas / removidas | — | a lista final é a união das geradas com as extras, menos as removidas (`:182-185`) |

Na criação, pelo menos uma data é obrigatória, com a justificativa no próprio
erro: "sem data o link público não oferece horário nenhum" (`:194`).

**Campos da data** (`DataFormModal`, `:299`): data + os mesmos 4 parâmetros de
janela/slot/vagas, por data.

**Fila** (`AgendaData`, `:355`) — `FILA_STATUS` (`:29-36`): `na_fila` e
`chamado` exibem ambos "Agendado" · `atendido` · `faltou` · `cancelado` ·
`espera` ("Na espera"). `OCUPA_VAGA = ["na_fila", "chamado", "atendido"]`
(`:41`), com o comentário registrando que é a mesma lista da função de banco
`get_bemestar_horarios_por_data` — divergir faz a tela do RH e a página pública
contarem coisas diferentes.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Novo programa" | `ProgramaFormModal`; `dataTour="programas-novo"` (`:491`) |
| Cabeçalho do programa | expande/colapsa a agenda |
| Programa sem data | badge âmbar "Sem data" com `title` explicando que o link público não tem horário a oferecer (`:513-518`) |
| Copiar link / QR | `/bem-estar/:id`, rota pública |
| ✓ / ✗ na linha da fila | `setFilaStatus(id, "atendido" \| "faltou")`; alvos de toque de 40×40 |
| "Promover" | `promoverDaEspera` — move de `espera` para `na_fila` |

**Entidades ligadas:** `rh_bemestar_sessoes` (o programa) ·
`rh_bemestar_datas` · `rh_bemestar_fila` · função de banco
`get_bemestar_horarios_por_data` (consumida pela página pública).

---
## 3.38 Fornecedores · RH — `/rh/fornecedores`


`RHFornecedoresView.jsx`. Rota aberta a `isRHUser || isDiretoria`
(`App.jsx:2853-2857`) — é a única rota RH cujo componente **não recebe
`canWrite`** de `App.jsx`.

**Visões (L2):** `Tabs` compartilhado com 2 abas (`:616-624`) — **Fornecedores**
(grade de `Card`) e **Contratos** (tabela).

**Campos do fornecedor** (`NovoFornecedorModal`, `:64`, forma em
`EMPTY_FORNECEDOR_FORM`, `:62`): `name` · `tipo` (`TIPO_LABELS`, 8 valores:
convênio médico · seguradora · terceirizada de RH · gráfica · uniformes ·
agência de marketing · fotógrafo/videomaker · outro) · `contactName` · `email` ·
`phone` · `notes`.

**Campos do contrato** (`NovoContratoModal`, `:146`, forma em
`EMPTY_CONTRATO_FORM`, `:144`): `titulo` · `vigenciaInicio` · `vigenciaFim` ·
`valor` · `status` (`STATUS_LABELS`: ativo · vencido · renovação pendente ·
cancelado) · `responsavelId`.

**Campos do evento de contrato** (`NovoEventoForm`, `:231`): tipo
(`EVENTO_TIPO_LABELS`: reajuste · renovação · fatura · nota fiscal · orçamento ·
compra · outro), com data e valor.

**Painéis (L3):**

| Painel | Conteúdo | Entidade relacionada |
|---|---|---|
| `FornecedorDrawer` (`:362`) | contratos do fornecedor (`ContratoRow`), eventos por contrato, troca de responsável | `rh_fornecedor_contratos`, `rh_fornecedor_contrato_eventos` |
| `ContratosTableView` (`:423`) | todos os contratos, com clique voltando pro fornecedor | |
| `ConfirmDeleteModal` (`:515`) | confirmação de exclusão, construída sobre `Modal` compartilhado; o corpo cita a contagem de contratos que somem junto | |

**Faixa de 3 `StatCard`** (`:647-656`): Fornecedores · Contratos ativos ·
Vencendo em 30 dias (sublabel "Contratos ativos", `accent` `--warning` quando > 0).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Novo fornecedor" | `NovoFornecedorModal` |
| `Trash2` no slot `menu` do `Card` | abre `ConfirmDeleteModal` — o padrão canônico de exclusão de páginas Fornecedores |
| "Criar agente de IA" (só `canCreateAgent`, = `gerente_rh` ou `admin`, `:565`) | abre o wizard do Agent Builder — esta é a tela piloto dele |
| `FilterBar` | só na aba Fornecedores (`:658-663`): busca + `GridListToggle` |
| Troca de responsável no contrato | `updateContrato(id, { responsavelId })`, erro só no console (`:604-606`) |

**Entidades ligadas:** `rh_fornecedores` · `rh_fornecedor_contratos` ·
`rh_fornecedor_contrato_eventos` · `profiles` (responsável) · `automations`
(agentes com `module === "rh-fornecedores"`, contados em `App.jsx:2032`).

---
## 3.39 Relatórios de RH — `/rh/relatorios`


`RHRelatoriosView.jsx` (381 linhas). Rota aberta a `isRHManager || isDiretoria`
(`App.jsx:2938-2942`). O cabeçalho do arquivo declara o padrão que segue: "Padrão
C, variante seletor" de `docs/design-spec-padroes-de-pagina.md` (`:29-30`).

**Visões (L2):** nenhuma. Grade de `Card` — um card por categoria, cada métrica
é um checkbox dentro dele.

**Métricas** (`src/utils/rh-report-metrics.js`, 17 ids em 8 categorias):

| Categoria | Métricas |
|---|---|
| Headcount | `headcount_departamento` · `headcount_frente` · `headcount_cargo` · `headcount_contrato` · `headcount_detalhado` |
| Turnover | `turnover_geral` · `turnover_motivo` · `turnover_detalhado` |
| Recrutamento | `tempo_contratacao` · `tempo_preenchimento_vaga` · `funil_recrutamento` · `vagas_status` |
| Férias | `ferias_resumo` |
| Avaliação | `avaliacao_resumo` |
| Treinamentos | `treinamentos_conclusao` |
| Cargos e Salários | `movimentacoes_resumo` |
| Fornecedores e Benefícios | `fornecedores_contratos` |

`RH_REPORT_CATEGORIAS` é derivada das próprias métricas (`:305`), não uma lista
paralela. Cada categoria ganha o mesmo ícone do item de menu correspondente
(`CATEGORIA_ICONS`, `:34-43`).

**Barra de ação** (`:277-303`): contador "N métricas selecionadas" ·
`ModelosDropdown` · "Salvar como modelo" · "Exportar CSV (N)". Os dois últimos
ficam desabilitados com seleção vazia. Abaixo, um `FilterBar` só de busca
("Buscar métrica…"), que filtra as métricas visíveis; o botão "Todas" de cada
card opera **apenas sobre as métricas visíveis da categoria**, não sobre as
escondidas pelo filtro (`:223-233`).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Checkbox da métrica | entra/sai do `Set` `selected` |
| "Todas" no card | marca/desmarca as visíveis daquela categoria |
| "Exportar CSV" | `buildRelatorioCSV([...selected], datasets)` → `triggerDownload("sanwey-relatorio-rh-<data>.csv")` — um CSV só, uma seção por métrica (`:242-247`) |
| "Salvar como modelo" | `Modal` compartilhado pede um nome; `createPreset({ name, metricKeys })`; o texto diz "modelo compartilhado com a equipe" |
| Aplicar modelo | filtra por `VALID_METRIC_IDS` antes de aplicar, descartando id de métrica que não existe mais (`:236`) |
| Excluir modelo | confirmação inline dentro do dropdown, com erro exibido ali mesmo |

**Entidades ligadas:** os datasets vêm todos de hooks já existentes, sem consulta
própria (`:241`): `rh_colaboradores` · `rh_vagas` + `rh_aplicacoes` ·
`rh_ferias` · `rh_avaliacoes` · `rh_treinamentos` + `rh_treinamento_atribuicoes`
· `rh_movimentacoes` · `rh_fornecedor_contratos`. Os presets ficam em
`useRHReportPresets`.

---

---

### Grupo: Inteligência
## 3.40 Painel Executivo — `/executivo`


`ExecutiveDashboard.jsx:122`. Rota gated por `canSeeExecutive`
(`App.jsx:2640-2644`); quem não tem volta pra `/`. O comentário de topo do
arquivo (linhas 43-50) declara a estrutura como consequência da regra 8 do
`CLAUDE.md`.

**Visões (L2) — duas camadas:**

*Camada 1: faixa de saúde* (`healthCards`, linha 409; render 511-543).
Um cartão por área, cada um com **1 número + 1 sinal**, e clicar no cartão troca
a aba (`onClick={() => setAreaTab(h.id)}`, linha 519). O número de colunas do
desktop entra por custom property inline porque varia com as áreas visíveis
(comentado nas linhas 500-506).

| Área | Número | Sinal | Cor |
|---|---|---|---|
| Comercial | `formatK(totals.pipeline)` | `N parado(s)` | `var(--text)` |
| Marketing | campanhas ativas | orçamento ≥80% consumido **ou**, quando não dispara, tarefas atrasadas (+ arquivadas fora) | `#7C3AED` |
| RH | vagas publicadas | posições extras + avaliações pendentes | `#0EA5E9` |
| Comex | importações + exportações abertas | "operações em curso" | `#0D9488` |
| Pós-venda | casos abertos | "casos abertos" | `#DB2777` |
| ESG & Carbono | `fmtT(esgTotalKg)` | "CO2e no período" | `#16A34A` |

A precedência do sinal de orçamento sobre o de tarefas está declarada no
comentário das linhas 415-421.

*Camada 2: abas por área* (`AREA_TABS`, linhas 72-80) — Visão geral · Comercial
· Marketing · RH · Comex · Pós-venda · ESG & Carbono. **7 abas, 6 áreas.**
Dentro de Comercial há um 2º nível, `COMERCIAL_SUBTABS` (linhas 64-70):
Visão geral · Gráficos · Análise · IA · Histórico.

**Visibilidade por aba** (linhas 131-146) — cruzamento de cargo com
`EXECUTIVE_WIDGETS` (`constants/user-settings.js:10-27`):

| Aba | Condição de cargo | Widget que também precisa estar ligado |
|---|---|---|
| Comercial | `isAdmin \|\| isComercialManager` | — |
| Marketing | `isAdmin \|\| isMarketingManager` | `outras_marketing` |
| RH | `isAdmin \|\| isRHManager` | `outras_rh` |
| Comex | `isAdmin \|\| isComexManager` | `tab_comex` |
| Pós-venda | `isAdmin \|\| isComercialManager` — declarado como "não é departamento à parte" (comentário 139-141) | `tab_posvenda` |
| ESG & Carbono | `isEsgViewer` | `tab_esg` |
| Sub-abas de Comercial | — | `tab_charts` / `tab_analytics` / `tab_ia` / `tab_historico` |

Esconder a aba ativa em Configurações devolve o painel pra "Visão geral"
(efeitos das linhas 165-173). Com nenhuma área visível, a tela inteira vira um
`EmptyState` com botão pra Configurações (linhas 496-521).

**Filtro de período** (`PERIODS`, linhas 54-60): Todo período · 30d · 60d · 90d
· Este ano. **Só aparece na aba Comercial** (`areaTab === "comercial"`, linha
461) e só afeta `filteredLeads` (linha 173) — o comentário das linhas 196-201
registra que o teto de orçamento de Marketing é anual e ignora esse filtro.
O botão "Exportar PDF" (`window.print()`, linha 480) fica na mesma condição.

**Indicadores da aba Comercial** (7 tiles, linhas 583-608):

| # | Tile | Cálculo |
|---|---|---|
| 1 | Funil de Vendas aberto | soma de `value` de não-terminais |
| 2 | Forecast | `weightedValue` por etapa |
| 3 | Receita realizada | soma de ganhos + contagem |
| 4 | Conversão | `razaoHonesta(wonCount, totalCount)` — sai com o `n`, e abaixo do piso vira fração (comentário linhas 586-591); o denominador é **tudo que entrou**, não "decisões", e a distinção contra o win rate do Analytics está declarada em `totals` (linhas 216-218) |
| 5 | CAC médio | `calculateCAC` sobre despesas de viagem + custo de amostras no período, sobre ganhos (linhas 224-243) |
| 6 | Leads parados | `isStale` por SLA de etapa |
| 7 | Cross-sell pendente | `status === "pending" \|\| type === "overlap"` (linha 250-253) |

Os dois hooks do CAC (`useCRMDespesas`, `useAllLeadSamples`) foram movidos pra
antes do `useMemo` por causa de um TDZ que quebrava o painel inteiro —
comentário nas linhas 229-238.

**Conteúdo por aba:**

| Aba | Componente | Conteúdo |
|---|---|---|
| Visão geral | `OverviewTab` (linha 980) | Funil por empresa (barra) · Funil de conversão do Grupo (share por etapa) · matriz "Desempenho por empresa" com 7 colunas (Empresa/Leads/Funil/Forecast/Ganho/Ativação/Parados) |
| Comercial → Visão geral | mesmo `OverviewTab` + `DeptStatRow` com "Viagens em andamento" (linhas 632-636, componente na linha 750) | — |
| Comercial → Gráficos | `ExecutiveCharts.jsx` | evolução e distribuição |
| Comercial → Análise | `AnalyticsTab.jsx` | diagnóstico por etapa, sobre `leads` cru + `period` |
| Comercial → IA | `AIExecutivePanel` (linha 892) | 2 blocos: Forecast e Diagnóstico de Funil, via `useAI` |
| Comercial → Histórico | `FunnelHistoryView.jsx` | absorveu a antiga rota `/historico-funil` (redirect em `App.jsx:2663-2665`) |
| Marketing | `AreaDetail` (linha 763) | 7 números: campanhas ativas · entregas abertas · tarefas atrasadas · compras no mês · despesas no mês · orçamento do ano · % consumido |
| RH | `AreaDetail` | 7 números: vagas publicadas · candidatos em processo · onboarding em andamento · em férias (7d) · férias pendentes · treinamentos ativos · avaliações pendentes |
| Comex | `AreaDetail` | importações em curso · exportações em curso |
| Pós-venda | `AreaDetail` | casos abertos · valor em carteira |
| ESG & Carbono | `AreaDetail` | CO2e no período · fatores vigentes · último relatório |

Cada `AreaDetail` traz um botão de saída pro módulo (`navigate(ROUTES.x)`,
`AreaDetail` linha 775-782) — é a única navegação de saída do painel.

**Regras de cálculo que o código declara explicitamente:**

- `isOpenStage`/`countOpen` (linhas 113-121) usam a etapa real do domínio em
  `rh_pipeline_stages`; sem etapas carregadas assumem "aberto".
- Tarefa arquivada não conta como atrasada (comentário linhas 315-318).
- Mês de despesa/compra é **data fiscal** (nota → vencimento → criação), nunca
  `createdAt` (comentário linhas 322-326).
- Teto de orçamento 0 conta como "sem teto"; não há percentual contra zero
  (linha 345-346). `formatBudgetPct` já devolve o "%" (comentário 422-424).
- Vaga × posição: quando `sum(positions) > count(vagas)`, os dois números
  aparecem; quando iguais, só "vagas" (comentário linhas 366-374).
- `overlapsNext7Days` (linha 739) é janela rolante, não semana de
  calendário, e só conta férias `aprovado`.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Cartão da faixa de saúde | troca `areaTab` |
| Aba / sub-aba | troca de conteúdo; nenhuma troca URL |
| Pílula de período | recalcula `filteredLeads` e o CAC |
| "Exportar PDF" | `window.print()`; header, faixa e abas são `print:hidden` |
| "Gerar" em IA | `complete()` de `useAI`; com chave ausente `onGenerate` vem `undefined` (linha 957) |
| "Ver Marketing/RH/Comex/Pós-venda/ESG" | `navigate` pra rota do módulo |
| "Ir para Configurações" (estado vazio) | `navigate(ROUTES.settings)` |

**Entidades ligadas:** `leads` · `pipelines` · `cross_referrals` ·
`marketing_campaigns` · `marketing_deliverables` · `marketing_tasks` ·
`marketing_purchase_requests` · `marketing_expenses` · `marketing_budgets` ·
`rh_vagas`/`rh_candidatos` · `rh_colaboradores` · `rh_ferias` ·
`rh_treinamentos` · `rh_feedback` · `comex_import_operations` ·
`comex_export_operations` · `posvenda_cases` · `crm_viagem_registros` ·
`crm_despesas` · `lead_samples` · `esg_emission_records`/`esg_emission_factors`/
`esg_reports` · `rh_pipeline_stages` (5 domínios). São **19 hooks de domínio**
chamados incondicionalmente (linhas 286-306) — a razão está comentada nas
linhas 282-285 (React não permite hook condicional; cada área decide se mostra).
## 3.41 Inteligência de Mercado — `/inteligencia-mercado`


`MarketIntelligenceView.jsx:221`. Gated por `canSeeMarketIntel`
(`App.jsx:2655-2659`). A rota antiga `/insights` redireciona pra cá
(`App.jsx:2654`).

**Visões (L2):** 3 abas via `Tabs` compartilhado (linhas 225-231) — Mercado ·
Insights · Cruzamento. As duas últimas só existem com `canSeeDeepIntel`; com
uma aba só, o `Tabs` nem é renderizado (linha 242).

**Campos de item de mercado** (lidos de `market_intelligence_items`,
`use-market-intelligence.js:12`; render em `MarketItemCard`, linhas 31-69):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `category` | categoria | enum | 6 valores em `CATEGORY_META` (linhas 22-29): `visao_geral`, `concorrencia`, `regulatorio`, `sustentabilidade`, `regional`, `preco_insumo` |
| 2 | `detected_at` | data | date | `formatDateBR` |
| 3 | `title` | título | text | |
| 4 | `summary` | resumo | text | |
| 5 | `sector` | setor | text | usado no cruzamento |
| 6 | `source_url` / `source_name` | fonte | link externo | abre em nova aba |

Não há formulário de criação nesta tela — o conteúdo é escrito de fora. O texto
do estado vazio nomeia a origem: workflow n8n "Scout de Mercado" (Perplexity),
`MarketIntelligenceView.jsx:110`.

**Conteúdo por aba:**

| Aba | Conteúdo |
|---|---|
| Mercado | 3 tiles (itens de mercado · setores cobertos · última atualização, linhas 96-104) + filtro de categoria em pílulas (linhas 114-140) + grade de cards |
| Insights | `InsightsView.jsx:48` reaproveitado inteiro, não reimplementado (declarado no comentário de topo, linhas 13-20) |
| Cruzamento | tabela por setor canônico: negócios abertos · pipeline · ganhos · itens de mercado (`CrossTab`, linhas 150-219); linha só entra se tiver algum dos três (`filter` linha 168) |

**Aba Insights — 3 blocos** (`InsightsView.jsx:130-186`):

| Bloco | Cartões |
|---|---|
| Velocidade | tempo médio de contratação · de onboarding · de fechamento (Comercial) · de aprovação de cotação (Marketing) |
| Custos | fornecedores RH vigentes · benefícios mensais · compras de Marketing · leads ganhos |
| Riscos | contratos de fornecedor vencendo em 90 dias (com valor em risco e o próximo a vencer) |

**Abas do drawer / painéis (L3):** não existem. Nenhum item abre detalhe; o
único caminho de saída é o link externo da fonte.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Pílula de categoria | filtra a grade (estado local `categoryFilter`) |
| Selo de contagem no Cruzamento | `title` nativo lista os títulos dos itens daquele setor (linha 205) |
| Link "Fonte" | abre `source_url` em nova aba |

**Entidades ligadas:** `market_intelligence_items` (leitura + Realtime,
`use-market-intelligence.js:25, 48`) · `leads` (prop, para Insights e
Cruzamento) · `pipelines` (prop) · `CANONICAL_SECTORS`
(`constants/taxonomy.js`) como eixo do cruzamento. Os números de Insights vêm
de `useInsightsMetrics`, que cruza RH, Comercial e Marketing.
## 3.42 ESG & Carbono — `/esg-carbono`


`ESGCarbonoView.jsx:156`. Gated por `isManager || isDiretoria`
(`App.jsx:2645-2649`).

**Visões (L2):** 3 abas (`Tabs`, linhas 291-299) — Visão Geral · Lançamentos ·
Fatores de Emissão. Acima delas, um `<select>` de empresa fora das abas
(linhas 280-289), com opção "Todas as empresas".

**Campos de fator de emissão** (`NovoFatorModal`, linhas 616-660; mapeamento em
`use-esg-carbon.js:15-29`):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `category` | Categoria | text | ex.: "Diesel S10 — frota" |
| 2 | `scope` | Escopo | select | 1 / 2 / 3 |
| 3 | `unit` | Unidade | text | L, kWh, kg, R$… |
| 4 | `factor_value` | Fator (kgCO2e/unidade) | number | |
| 5 | `gwp` | GWP | number | default 1; usado no lugar do fator para gás refrigerante (linha 508) |
| 6 | `source` | Fonte | text | MCTI, PBGHG, IPCC, Defra… |
| 7 | `valid_from` | Vigente a partir de | date | versionamento; `valid_to` nulo = vigente |

**Campos de lançamento manual** (`LancamentosTab`, linhas 527-547):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `company` | Empresa | select | `COMPANY_IDS` |
| 2 | combustível | Combustível — frota (L) | number | Escopo 1 |
| 3 | energia | Energia elétrica (kWh) | number | Escopo 2, fator "Energia elétrica (SIN)" |
| 4 | gás | Gás refrigerante — recarga (kg) | number | Escopo 1, calculado por `gwp` |

Sem fator vigente para a categoria, o lançamento é recusado com mensagem
nomeando a categoria (linhas 501, 506); sem nenhum consumo preenchido, idem
(linha 511).

**Registro gravado** (`rowToRecord`, `use-esg-carbon.js:31-45`): `companyId` ·
`scope` · `sourceType` (`manual` \| `compras`) · `sourceId` · `activityData` ·
`activityUnit` · `emissionFactorId` · `co2eCalculated` · `createdBy`.
O fator fica travado no registro — a premissa de auditoria está declarada no
comentário de topo (linhas 15-18).

**Conteúdo por aba:**

| Aba | Conteúdo |
|---|---|
| Visão Geral | 4 tiles (Total CO2e, Escopo 1, 2, 3) · `TrendChart` de 12 meses empilhado por escopo (linha 114, dados em `monthlyTotals` linha 75) · seletor de período do relatório · botões Exportar CSV, Calcular Escopo 3, Gerar relatório, Dossiê |
| Lançamentos | formulário "Lançamento do mês" + tabela Histórico |
| Fatores de Emissão | lista versionada + "Novo fator" |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| "Calcular Escopo 3" | soma compras `stage === "pago"` ainda não computadas (dedup por `sourceType/sourceId`, linha 190) contra o fator "Compras gerais — spend-based"; sem fator, mensagem de erro nomeando o cadastro que falta (linha 188) |
| "Exportar CSV" | 6 colunas: Origem, Escopo, Dado de atividade, Unidade, Fator usado, CO2e (kg) — linhas 220-231 |
| "Gerar relatório" | snapshot congelado do período escolhido, com `recordIds` dos registros filtrados; o bug de o snapshot nascer com o histórico inteiro está registrado no comentário das linhas 243-247 |
| Período do relatório | `REPORT_PERIODS` (linhas 42-47): Mês atual · Mês anterior · Últimos 3 meses · Personalizado; sempre em dias fechados (`computeReportPeriod`, linhas 49-72) |
| "Dossiê" | `printDossie()` injeta `@page A4` e marca `body.printing-doc` — duplicação deliberada do mecanismo de `ProposalPanel.jsx`, 2ª ocorrência (comentário linhas 91-96) |
| Seletor de empresa | refaz `useEsgEmissionRecords`/`useEsgReports` com `companyId` |

**Entidades ligadas:** `esg_emission_factors` · `esg_emission_records` ·
`esg_reports` (`use-esg-carbon.js:11-13`) · `marketing_purchase_requests`
(origem do Escopo 3 spend-based, carregada só quando `tab === "overview"`,
linha 163).
## 3.43 Time de Agentes — `/agentes`


`AgentActionsView.jsx:400`. Gated por `isManager || isRHManager`
(`App.jsx:2631-2635`).

**Visões (L2):** 5 abas de status (linhas 683-689) — Pendentes · Aprovados ·
Rejeitados · Ignorados · Todos. Fora das abas, a lista é **agrupada por
agente** em acordeão; quando chega filtrada por automação
(`filterAutomationId`), vira lista simples (comentário linha 758).

**Agentes** (`AGENTS`, linhas 17-24): SDR-Q (Qualificador) · SCOUT
(Inteligência de Conta) · CADÊNCIA (Follow-up Engine) · SENTINELA (Monitor de
Funil) · CROSS (Cross-sell). Ordem de exibição em `agentOrder` (linha 520).
Ações do Agent Builder chegam com `agent_id = "automation"` e são agrupadas por
`automation_id` com o nome real da automação — o motivo está no comentário das
linhas 536-540.

**Campos da sugestão** (`agent_actions`, select em `AgentActionsView.jsx:450`):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `priority` | prioridade | enum | `urgent`/`high`/`normal`/`low` (`PRIORITY`, linhas 26-31) |
| 2 | `agent_id` | agente | enum | 5 acima + `automation` |
| 3 | `automation_id` | agente de IA | uuid | só pra `agent_id = "automation"` |
| 4 | `status` | status | enum | `pending`/`approved`/`rejected`/`ignored` |
| 5 | `company_id` | empresa | text | |
| 6 | `lead_id` → `leads(id, company, stage, company_id)` | contexto do negócio | join | |
| 7 | `payload` | corpo | jsonb | chaves em uso no card: `days_stale`, `fornecedor_nome`, `dias_para_vencer`, `candidato_*` |
| 8 | `created_at` / `resolved_at` | datas | timestamp | |

**Abas do drawer / painéis (L3):** não há drawer. Há **um modal**,
`AgentConfigModal` (botão "Configurar agentes", só `isManager`, linhas 630-641),
que liga/desliga agente por empresa via `useAgentConfig`.

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Aprovar / Rejeitar / Ignorar | `PATCH` na edge `agent-gateway?action=resolve` com o JWT da sessão; atualização otimista da linha (linhas 470-497) |
| "Atualizar" | refaz a consulta (limite fixo de 200 linhas, ordenada por `created_at` desc, linha 452-453) |
| "Ver fornecedor" | grava `rhFornecedoresOpenId` em `sessionStorage` e navega pra `/rh/fornecedores` (linhas 501-508) |
| "Ver candidato" | grava `rhRecrutamentoOpenCandidatoId` e navega pra Recrutamento (linhas 510-517) |
| "Ver todos os agentes" | limpa `filterAutomationId` |
| Agente desligado em `useAgentConfig` | some da lista; em "Todas as empresas" basta estar ativo em uma (comentário linhas 522-526) |

**Entidades ligadas:** `agent_actions` (leitura direta) · `leads` (join) ·
`automations` (prop vinda de `App.jsx`, pra resolver nome do agente de IA) ·
configuração por empresa em `useAgentConfig` · edge function `agent-gateway`
(única via de escrita) · `rh_fornecedores` e `rh_candidatos` como destino de
handoff.

---

### Grupo: Configuração
## 3.44 Automações — `/automacoes`


`AutomationsView.jsx:125`. Gated por `isManager || isRHManager`
(`App.jsx:2670-2680`).

**Visões (L2):** 2 abas principais (`Tabs`, linhas 297-303) — **Automações**
(regras sem IA) e **Agentes de IA** (Agent Builder). O comentário das linhas
294-296 registra que são duas abas do mesmo motor. Dentro da aba Automações há
um 2º filtro, por módulo (linhas 357-362): Todas · CRM · Marketing · Universal,
cada um com a contagem.

**Campos da regra** (`AutomationBuilder`, tipos declarados no topo do arquivo):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `name` | nome | text | |
| 2 | `module` | módulo | enum | `crm` \| `marketing` (default `crm`) |
| 3 | `trigger.board` | quadro | enum | só Marketing: `campanhas` \| `entregas` (`BOARD_OPTIONS`, linhas 60-63) |
| 4 | `trigger.type` | gatilho | enum | 5 tipos, `TRIGGER_TYPES` linhas 29-35 |
| 5 | `conditionGroups` | condições | array | 7 operadores, `OPERATORS` linhas 96-106 |
| 6 | `thenActions` / `elseActions` | ações | array | 7 tipos, `ACTION_TYPES` linhas 37-45 |
| 7 | `companyId` | empresa | enum | `all` \| `industria` \| `resibag` (`COMPANY_OPTIONS`, linhas 117-121) |
| 8 | `enabled` | ativa | bool | |

**5 gatilhos** (`TRIGGER_TYPES`): `stage_change` (mudança de etapa) ·
`field_value` (valor de campo) · `time_in_stage` (X dias sem avançar) ·
`pending_required_field` (X dias na etapa com obrigatório vazio) ·
`lead_created` (card criado).

**7 ações** (`ACTION_TYPES`): `move_stage` · `set_field` · `assign_owner`
(com `mode` "add" vs. definir, linha 462-468) · `add_badge` · `notify` ·
`create_deliverable` (cruza módulo, cria card em Entregas) · `enrich_cnpj`.

**Campos alvo por módulo**: CRM — `value`, `fitScore`, `owner`, `urgency`
(`LEAD_FIELDS`, linhas 65-70); Marketing — `budget`, `kpi`, `performanceScore`, `channel`
(`MARKETING_FIELDS`, linhas 75-80). Valores de urgência: crítico/alto/médio/informativo/imediato/
30d/90d/indefinido (`URGENCY_VALUES`, linhas 85-94). 6 cores de badge (`BADGE_COLORS`, linhas 108-115).

As etapas oferecidas no builder vêm ao vivo de `rh_pipeline_stages`
(`marketing` e `marketing_deliverables`), com `MARKETING_STAGES`/
`DELIVERABLE_STAGES` só como fallback estático — o motivo (builder ignorar
etapa renomeada) está nos comentários das linhas 205-212 e 219-223.
`resolveStagesForRule` (linha 240) resolve por regra, não por merge
global, porque `stage_key` pode repetir entre quadros.

**Abas do drawer / painéis (L3):**

| Overlay | Gatilho | Conteúdo |
|---|---|---|
| `AutomationBuilder` | "Nova automação" ou clique num template | formulário completo acima |
| `AgentBuilderWizard` | "Novo agente de IA" | assistente próprio; persiste sozinho, não recebe `onSave` (comentário linhas 429-430) |
| `AutomationRow` expandida | clique na linha | resumo legível de gatilho e ações (`actionSummary`, linha 455) |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Faixa de estatística | 1 cartão por `TRIGGER_TYPE`, com a contagem de regras daquele gatilho (linhas 309-326) |
| `TemplateGallery` | só aparece com **≤3** automações criadas (linhas 347-352) |
| Toggle da linha | `toggleAutomation(rule.id)` |
| Lixeira da linha | `deleteAutomation(rule.id)` |
| "Ver sugestões geradas →" (aba Agentes) | `goToSuggestions` — leva a `/agentes` já filtrado por `automation_id` |
| Ícone "?" no título | `title` nativo distinguindo Automações × Time de Agentes × aba IA do card (linhas 262-273) |

**Entidades ligadas:** `automations` (via `useAutomations`) · `profiles` (via
`useProfiles`, buscado aqui porque `App.jsx` não passa `users` — comentado nas
linhas 229-233) · `pipelines` (etapas do CRM) · `rh_pipeline_stages` (domínios
`marketing` e `marketing_deliverables`) · `agent_runs` (resumo na aba Agentes) ·
`agent_actions` (destino do "Ver sugestões").
## 3.45 Configurações — `/configuracoes`


`SettingsView.jsx:563`. **Rota sem gate** — qualquer cargo entra
(`App.jsx:2698`). É também o destino de `/usuarios` (redirect só pra
`isManager`, `App.jsx:2695-2697`) e de `/perfil`.

**Visões (L2) — menu lateral em 3 grupos** (`buildTabGroups`, linhas 524-561).
No mobile o mesmo conjunto vira uma barra horizontal achatada (`flatTabs`,
linha 594). O comentário das linhas 517-523 registra por que o menu foi
reagrupado: antes eram até 10 itens planos em dois ramos, e o ramo de gestor
nunca incluía Aparência.

| Grupo | Item | Quem vê |
|---|---|---|
| Minha conta | Perfil · Preferências · Notificações | todos |
| Plataforma | Geral | `isManager \|\| canSeeExecutive \|\| isChatManager` |
| Plataforma | Captura pública | `isManager` |
| Plataforma | Integrações | todos |
| Administração | Usuários | só se `usersPanel` foi passado (isto é, `isManager`, `App.jsx:2723`) |
| Administração | Módulos | `isAdmin` |
| Administração | Segurança & dados | `isManager \|\| isAdmin` |

Cada página guarda sua própria aba interna em estado separado, pra trocar de
item e voltar sem perder o lugar (linhas 599-605).

**Página Perfil** (2 abas, linhas 1129-1136):

| Aba | Campos |
|---|---|
| Dados | avatar (upload), Nome, Email (desabilitado com Supabase ligado — "gerenciado pelo login"); cabeçalho mostra nome, e-mail e a lista de cargos (linhas 1165-1172) |
| Senha | Nova senha (mín. 6), Confirmar nova senha |

**Página Preferências** (3 abas, linhas 1975-1982):

| Aba | Conteúdo |
|---|---|
| Aparência | "Cor de destaque" — 7 presets (`ACCENT_PRESETS`, `SettingsView.jsx:497-505`: Vermelho, Carvão, Verde, Azul, Roxo, Laranja, Rosa) + dois campos de cor livre (destaque e hover), gravados em `localStorage` (`sanwey-accent`, `sanwey-accent-hover`, linhas 630-635); "Modo escuro", com nota de que o botão fica no TopBar |
| Recursos | "Meu To-do" liga/desliga (`personalTasksEnabled`), com o texto declarando que nem gerente nem admin veem a lista; abaixo, o `<select>` de arquivamento automático (`AUTO_ARCHIVE_OPTIONS`) |
| Barra inferior | atalhos da `MobileBottomNav` |

**Página Notificações** (linhas 1426-1450): `NOTIFICATION_AREAS`
(`constants/user-settings.js:32-37`) — Comercial · Marketing · RH · Sistema —
como abas sobre `NOTIFICATION_GROUPS`. O agrupamento veio da auditoria de
05/08/2026 (eram 9 blocos num scroll só, comentário no arquivo de constantes,
linhas 29-31); nenhum id de item mudou, então preferência salva continua
valendo.

**Página Geral** (abas montadas por cargo, `geralTabs`, linha 609):

| Aba | Quem vê | Conteúdo |
|---|---|---|
| Empresas | `isManager` | "Empresas ativas" — quais aparecem no seletor do topo e nos filtros |
| Painel Executivo | `canSeeExecutive` | "Widgets do Painel Executivo" — `EXECUTIVE_WIDGETS` filtrados pelo `dept` do cargo |
| Chat | `isChatManager` | `StickersPanel` — figurinhas do Chat, com `ConfirmDeleteModal` próprio |

O fallback quando `geralTab` aponta pra aba inexistente pro cargo está nas
linhas 1318-1324, com o motivo comentado.

**Página Captura pública** (3 abas, linhas 2300-2318):

| Aba | Conteúdo |
|---|---|
| Leads | um cartão por empresa com `/{origin}/captura/{companyId}`, botão Copiar e Abrir; caixa de dica de UTM (`data-tour="captura-utm-dica"`, linha 2375) explicando `utm_source/medium/campaign/content` e o `?src=` legado |
| Solicitações internas | links de `/solicitar-marketing` e `/solicitar-compra` |
| Vagas | vagas com `stage === "publicada"` e `link_slug` (`vagasPublicadas`, linha 620) |

**Página Integrações** (3 abas, linhas 1537-1546):

| Aba | Conteúdo | Quem vê |
|---|---|---|
| Inteligência Artificial | "IA da empresa (org-wide)": status configurado/não, provider, e o nome dos secrets que faltam (`AI_ORG_PROVIDER`, `AI_ORG_MODEL`, `AI_ORG_API_KEY`) — bloco só `isAdmin`. Abaixo, "Minha chave pessoal", que **trava** quando a chave da empresa existe: `canManageOwnAIKey = isAdmin \|\| canSeeExecutive \|\| !orgAIStatus.configured` (linha 584) — quem já tinha chave continua vendo o selo pra poder desconectar (comentário linhas 1589-1591) | todos (o bloco org-wide, só admin) |
| Secretária de IA | chaves de conexão do "Mia" — uma por conta a conectar, escrevem em `personal_tasks_api_keys`; modal "Nova chave de conexão" | todos |
| Assinatura eletrônica | D4Sign | `canSeeD4Sign` |

**Página Módulos** (`ModuleStatesPanel.jsx:62`, só `isAdmin`): liga/desliga
página inteira pra empresa toda, em 3 estados (`STATES`, linhas 14-18) —
**Desligada** ("Ninguém vê, nem admin"), **Em testes** ("Só admin e quem
estiver marcado como exceção em Usuários"), **Liberada**. O texto da tela
declara que isso **soma** ao acesso por cargo, não substitui (linhas 87-92), e
uma faixa conta quantas estão desligadas/em teste (linhas 94-105). A lista vem
de `MODULE_GROUPS` (`src/utils/module-access.js:10-88`): 5 grupos — Comercial
(12), Marketing (10), Recursos Humanos (12), Inteligência (5), Pessoal (4).
O cabeçalho de `module-access.js` (linhas 1-8) declara que o espelho em SQL é
`current_user_has_module()` e que as duas mudam juntas.

**Página Segurança & dados** (3 abas, linhas 2184-2188):

| Aba | Quem vê | Conteúdo |
|---|---|---|
| Exportações | `isAdmin` | `ExportAuditPanel` — log de quem exportou o quê |
| Demonstração | `isManager` | "Leads de exemplo · Comercial" e "Dados de exemplo · Marketing e RH" |
| Zona de risco | `isManager` | "Dados locais" e "Excluir todos os leads", com modal de confirmação por digitação (`clearTyped`, linha 627) |

A separação em abas é registrada no comentário das linhas 2178-2183: a aba
antiga punha carregar dados fictícios ao lado de apagar leads reais.

**Página Usuários** — `UserManagementView.jsx:121`, injetada como prop
`usersPanel` (`App.jsx:2723-2741`), não importada aqui. Campos do modal de
usuário (linhas 627-813):

| # | Campo | Tipo | Observação |
|---|---|---|---|
| 1 | Nome * | text | |
| 2 | Função principal | select | 13 cargos (linhas 36-58) |
| 3 | Cargos adicionais | multi | "usuário acumula acesso dos dois" |
| 4 | Email | email | desabilitado com Supabase ligado |
| 5 | Empresas com acesso | multi | obrigatório conforme o cargo (`formCompanyRequired`) |
| 6 | Setores | multi | |
| 7 | Supervisor | select | só vendedores; exclui o próprio id (linha 717) |
| 8 | Fornecedor vinculado | select | só Agência |
| 9 | Acesso por módulo | checkboxes por grupo | exceções ao cargo; item personalizado ganha botão de restaurar padrão (linhas 772-784) |
| 10 | Chat interno | toggle | só na edição de usuário existente (linhas 793-813) |

Há ainda um modal de **convite** separado (linha 830 em diante) com Nome,
Email, cargo, empresas, setores e fornecedor.

**Gatilhos de ação (tela inteira):**

| Elemento | Reação imediata |
|---|---|
| Item do menu lateral | troca `activeTab`; nenhuma troca URL |
| Preset de cor | `applyAccentGlobal` na hora, sem salvar em tabela |
| Upload de avatar | sobe o arquivo e atualiza `profileForm.avatarUrl` |
| "Salvar alterações" (Perfil) | `onUpdateUser` + `onUpdateAuthUser` (ou `onUpdateMockUser` sem Supabase) |
| Toggle de módulo (Módulos) | otimista; em erro o hook desfaz e a tela mostra o motivo (comentário `ModuleStatesPanel.jsx:71-73`) |
| Toggle de módulo (Usuários) | grava override em `profile_module_overrides` |
| "Excluir todos os leads" | modal com confirmação digitada |

**Entidades ligadas:** `profiles` (+ `profile_module_overrides`) ·
`module_states` · `chat_stickers` (bucket público) · `rh_vagas` (links de vaga
publicada) · `personal_tasks_api_keys` · `invitations` · log de exportações ·
`localStorage` (cor de destaque, tema, preferências de `useUserSettings`).
Status da IA org-wide e da D4Sign vêm de edge function, não de tabela
(`useOrgAIStatus`, `orgAiStatus`, efeitos nas linhas 779-802).

---

### Grupo: Sem rótulo no menu
## 3.46 Ajuda & Tutoriais — `/ajuda`


`TutoriaisView.jsx:312`. **Rota sem gate** (`App.jsx:2742-2744`). Dois
caminhos de entrada: item de menu e o ícone salva-vidas do TopBar
(`onHelpClick`, `App.jsx:2306`). O toast de Novidades entra já na aba certa via
`initialTab` (`App.jsx:213, 3026`).

**Visões (L2):** 5 abas (`TABS`, linhas 23-27) — Tutoriais · Automações ·
Perguntar à IA · Novidades · FAQ, com `iconOnlyMobile`.

**Campos de tutorial** (`VIDEO_TUTORIALS`, `src/data/tutorials.js:61`):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `id` | — | string | |
| 2 | `title` | título | text | |
| 3 | `description` | tela a que se refere | text | |
| 4 | `route` | destino | string | id de seção pra `onNavigate` |
| 5 | `duration` | duração | number | **null em todas as entradas** |
| 6 | `url` | vídeo | url | **null em todas as entradas** |
| 7 | `quickStart` | passo a passo | `{ icon, steps[] }` | é o conteúdo real; abre em `Modal` (linha 67) |

O catálogo é indexado por cargo — só existem os blocos `vendedor` e `gerente`
(`tutorials.js:62` e `tutorials.js:114`), e `VIDEO_TUTORIALS[role] || VIDEO_TUTORIALS.vendedor`
(linha 314) é o fallback de qualquer outro cargo. A tela declara o estado dos
vídeos no rodapé da aba: "Os vídeos serão publicados em breve" (linha 388-390).

**Conteúdo por aba:**

| Aba | Conteúdo | Origem |
|---|---|---|
| Tutoriais | bloco fixo "Atalhos de teclado" (⌘K / Ctrl K) + tile com a contagem de guias do cargo + `CardGrid` de `VideoCard` | `VIDEO_TUTORIALS` |
| Automações | intro + passos + 6 receitas (`RecipeCard`, linha 176) | `AUTOMATION_GUIDE` (`tutorials.js:404`) |
| Perguntar à IA | prompts prontos agrupados por categoria (`PromptCard`, linha 234) | `AI_PROMPTS` (`tutorials.js:521`) |
| Novidades | histórico completo do changelog, sem filtro de cargo | `src/data/changelog.js` |
| FAQ | **18 perguntas** com busca por texto sobre pergunta e resposta (linhas 318-324) | `FAQ_ITEMS` (`tutorials.js:329`) |

`ONBOARDING_STEPS` (`tutorials.js:3`) mora no mesmo arquivo mas alimenta o
onboarding do primeiro acesso, não esta tela; `ONBOARDING_STEPS.admin` é um
alias de `gerente` (linha 59).

**Abas do drawer / painéis (L3):** um `Modal` por tutorial, com o passo a passo
do `quickStart` (`VideoCard`, linhas 32-98).

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Card de tutorial | abre o modal do passo a passo |
| Botão de ir pra tela, dentro do modal | `onNavigate(video.route)` |
| Busca do FAQ | filtra `FAQ_ITEMS` por pergunta ou resposta |
| Toast "Novidades" → "Ver tudo" | `setTutoriaisInitialTab("novidades")` + `setSection("tutorials")` + `dismissChangelog()` (`App.jsx:3026`) |

**Entidades ligadas:** nenhuma tabela. Todo o conteúdo é estático, em
`src/data/tutorials.js` e `src/data/changelog.js`.
## 3.47 Central de Bugs — `/central-bugs`


`BugsView.jsx:90`. **Rota sem gate** (`App.jsx:2628-2630`) — o que muda por
cargo é o conteúdo, não o acesso. Segundo caminho de entrada: o ícone de inseto
do TopBar, que abre o modal de report **em qualquer tela**; ele é montado no
fim do `App.jsx` e **fora de qualquer `ErrorBoundary`**, de propósito, pra
sobreviver à tela que quebrou (comentário `App.jsx:3085-3087`).

**Visões (L2):** duas, decididas por `isAdmin` (linha 186):

- **Admin** — Kanban completo sobre `rh_pipeline_stages` domain `bugs`
  (`useRHPipelineStages("bugs")`, linha 93), com acordeão no mobile
  (`RHMobileKanbanAccordion`) e colunas de 272px no desktop; `KanbanFab`
  "Reportar" (linha 265).
- **Quem não é admin** — lista simples dos próprios reports; a RLS já
  restringe a isso (comentário linhas 187-188). Cada linha mostra título,
  módulo, tempo relativo, pílula de prioridade e pílula de etapa.

A busca fica fora de qualquer bloco condicional e serve as duas visões
(comentário linhas 161-163), casando com título e nome de quem reportou
(`filteredReports`, linhas 109-116).

**Campos do report** (`ReportBugModal.jsx:17-56`, e colunas de `bug_reports`):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `relato` → `description` | o que aconteceu | textarea | único campo do caminho principal; libera o Enviar com qualquer frase (linha 30) |
| 2 | `title` | — | text | **gerado**, por `tituloAutomatico({relato, erro, rota})` |
| 3 | `priority` | O quanto atrapalha | radio | 3 níveis, `BUG_PRIORITIES` (`constants/bug-reports.js:6-10`): "Detalhe, sem pressa" (Leve) · "Incomoda, mas dá pra contornar" (Médio) · "Atrapalha o trabalho" (Alto). O vocabulário deliberadamente não-técnico está declarado nas linhas 1-5 do arquivo |
| 4 | `module` | Onde | select | `BUG_REPORT_MODULES`; pré-preenchido por `moduloDaRota(rota)` |
| 5 | `contexto` | — | jsonb | `montarContexto({rota, empresa, erro})` — rota, tela, navegador, versão do app, URL, erro e pilha |
| 6 | `origem` | — | text | `"central"` (modal da tela) ou `"atalho"` (ícone do TopBar) |

Prioridade e módulo ficam **colapsados atrás de "+ detalhes"** (linha 20-22).
Quando o modal é aberto a partir de uma tela de erro (`erro` preenchido), o
campo de relato vira opcional e o Enviar já nasce liberado (linhas 24-26, 30).

**Painéis do drawer (L3)** — `BugReportDrawer.jsx:174`, sobre
`SplitPanelDrawer`:

| Slot | Conteúdo | Entidade |
|---|---|---|
| `header` | título, quem reportou, módulo, tempo relativo; "Excluir report" só `isAdmin` (linha 176) | `bug_reports` |
| `left` | Prioridade, Módulo, Descrição, "Contexto anexado" (rota/tela/navegador/versão/origem/URL) e o erro técnico com pilha em `<pre>` | `bug_reports.contexto` |
| `center` | diagnóstico da IA, com aprovar/recusar; link do PR quando `pr_url` existe (linhas 29, 66-68) | `bug_reports` |
| `right` | comentários (`notes`, jsonb com `authorId/authorName/text/createdAt`, linhas 160-171) | `bug_reports.notes` |

**Gatilhos de ação:**

| Elemento | Reação imediata |
|---|---|
| Ícone 🐛 no TopBar | abre `ReportBugModal` com rota e empresa já capturadas |
| "Enviar" | `createReport` → insert em `bug_reports` |
| Arrastar card entre colunas (admin) | `changeStage`; erro sobe em `AppToast variant="danger"` (linhas 146-150) |
| `MoveStageMenu` do card | mesma mutação sem arrastar |
| Aprovar / recusar diagnóstico | `approveDiagnosis` / `rejectDiagnosis` |
| "PR pronto" no card | etapa `correcao_proposta` com `pr_url`; o link abre em nova aba |
| Excluir | `deleteReport` e fecha o drawer |

Estado "🤖 Em análise" no card é a etapa `em_analise` (`BugsView.jsx:37-40`).

**Entidades ligadas:** `bug_reports` (leitura com join `reporter:reported_by` e
`resolver:resolved_by`, `use-bug-reports.js:6`; Realtime na linha 31) ·
`rh_pipeline_stages` domain `bugs` (4 etapas, conforme §4.1 do arquivo
principal) · `profiles`.

---

### Grupo: Rotas públicas (fora do `<App>`, sem shell)

Todas as 9 ficam fora do `<App>`, montadas direto em `src/main.jsx:19-28`. Sem
shell, sem menu, sem sessão. Todas param cedo quando `isSupabaseConfigured` é
falso, com a mesma tela "Indisponível — o sistema está em modo demonstração".

A nona, `/comunicado/confirmar/:token` (`main.jsx:27`,
`ComunicadoConfirmacao.jsx`), não ganha subseção própria porque não tem campo
nem interação: chama a RPC `confirmar_leitura_por_token` e nada mais. O
comentário de topo do arquivo declara que a RPC devolve o mesmo resultado para
token inválido e para token inexistente, "pra a página não virar um oráculo".
## 3.48 Captura de lead — `/captura/:slug`


`LeadCaptureForm.jsx:62`.

**Resolução do slug:** `COMPANY_IDS` direto, com um alias de leitura
`{ sanwey: "industria" }` (linha 60). O motivo — o slug usa o id interno
`industria`, mas o nome comercial é Sanwey — está no comentário das linhas
53-59. Slug fora disso renderiza "Link inválido" (linhas 101-110).

**Campos** (`Field`, linhas 230-352; estado na linha 74-84):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `customerName` | Nome do responsável | text | **obrigatório**, mín. 2 caracteres |
| 2 | `companyName` | Nome da empresa | text | vai pro bloco de `notes`, não pra coluna |
| 3 | `phone` | Telefone | tel | **obrigatório**, mín. 10 dígitos; máscara `formatPhone` (linhas 41-47) |
| 4 | `email` | E-mail | email | opcional; formato validado no servidor |
| 5 | `industry` | Setor da empresa | select | 15 opções fixas (`INDUSTRIES`, linhas 17-33) |
| 6 | `priority` | Prioridade | select | Alta/Média/Baixa (linha 15) |
| 7 | `callbackDate` | Preferência de retorno | date | vira `p_prospect_date`; sem ela, hoje |
| 8 | `callbackTime` | horário | select | 3 faixas (linhas 35-39); entra em `notes` |
| 9 | `notes` | Mensagem (opcional) | textarea | |

**Validação no cliente:** `canSubmit` = nome ≥2 **e** telefone ≥10 dígitos
(linhas 95-99). Tudo o mais é opcional.

**Origem oculta:** UTM lidos da querystring por `parseAttributionSearchParams`
(linha 67); `?src=` continua como fallback legado.

**O que acontece no envio** — RPC `submit_lead_capture` (linha 156 ou 171),
`SECURITY DEFINER`, com `GRANT EXECUTE` nominal a `anon`
(`supabase/migrations/20260903180000_submit_lead_capture_utm.sql:193-200`):

1. Valida empresa, nome, contato, data e prioridade; e-mail por formato
   (linhas 57-73 da migration).
2. **Rate limit em duas camadas**: por telefone normalizado, **3 em 24h**
   (linhas 77-82); circuit-breaker global por empresa, **30 em 10 minutos**
   (linhas 85-90).
3. Resolve `campaign_id` casando `utm_campaign` com
   `marketing_campaigns.name` restrito a canal `Conteúdo`/`Digital` e à mesma
   empresa (linhas 102-110).
4. Monta `custom_fields` com 8 chaves `capture_*` mais as `capture_utm_*`
   presentes (linhas 112-135).
5. Insere em `leads` na etapa `prospeccao`, urgência derivada da prioridade,
   `trigger = 'formulario_publico'` e `trigger_label` montado a partir da
   origem (`v_trigger_label` linhas 138-144; INSERT linha 147).
6. Insere em `lead_captures` e devolve
   `{ ok, capture_id, lead_id, campaign_id }`.

Quando a migration de UTM ainda não estiver aplicada, o cliente detecta o erro
por `isMissingUtmRpcError` e repete a chamada sem os argumentos de UTM, jogando
a atribuição dentro de `notes` (linhas 152-169 do componente).

**Entidades ligadas:** `leads` · `lead_captures` · `marketing_campaigns`
(resolução de campanha).
## 3.49 Candidatura a vaga — `/vagas/:slug`


`JobApplicationForm.jsx`.

A vaga é carregada por RPC `get_vaga_publica(p_slug)` (linha 61); slug sem vaga
publicada renderiza tela de indisponível.

**Campos** (linhas 242-310):

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `nome` | Nome completo | text | **obrigatório**, mín. 2 |
| 2 | `email` | E-mail | email | **obrigatório** |
| 3 | `telefone` | Telefone | tel | **obrigatório** |
| 4 | `linkedin` | LinkedIn (opcional) | url | |
| 5 | `unidade` | Unidade de interesse | select | além desta vaga |
| 6 | currículo | Currículo | file | `.pdf,.docx`, teto **10 MB** (`MAX_FILE_SIZE`, linha 8; checagem linha 77) |
| 7 | `consentimento` | LGPD | checkbox | **obrigatório** (linha 96) |

E-mail e telefone foram os dois obrigatórios: o histórico ("pelo menos um" →
os dois, por pedido explícito, 29/07/2026) está no comentário das linhas 89-93.

**Currículo condicionalmente obrigatório:** `resumeRequired =
!RH_OPERATIONAL_DEPARTMENTS.includes(vaga.department)` (linha 84) — vaga
operacional aceita candidatura sem arquivo, e a RPC relaxa a mesma exigência
(comentário linhas 80-83).

**O que acontece no envio:**

1. RPC `submit_job_application` com `p_resume_ext` (linha 113). A RPC valida
   consentimento, nome, e-mail e telefone
   (`supabase/migrations/_historico/20261020_sec_public_rpc_ratelimit_per_contact.sql:27-37`).
2. **Rate limit**: por telefone normalizado, **3 em 24h** (linhas 39-47 da
   migration); circuit-breaker global de **200 em 10 minutos** (linhas 49-55).
3. A RPC devolve `{ candidate_id, resume_object_path }` — o path é de **upload
   de uso único e curta validade**; antes ela devolvia o UUID cru do candidato,
   reaproveitável por quem soubesse o e-mail de outra pessoa (comentário
   `JobApplicationForm.jsx:106-112`).
4. O arquivo sobe pro bucket `rh-curriculos` naquele path (linhas 127-130).
5. E-mail de confirmação pela edge `rh-send-email` (`type:
   "candidatura_recebida"`), **fire-and-forget**: não bloqueia a tela de
   sucesso nem falha a candidatura (comentário linhas 132-135).

**Entidades ligadas:** `rh_vagas` (leitura pela RPC) · `rh_candidatos` ·
`rh_aplicacoes` · bucket `rh-curriculos` · edge `rh-send-email`.
## 3.50 Banco de talentos — `/trabalhe-conosco`


`TalentPoolForm.jsx`. Gêmeo do anterior sem vaga: mesmos 7 campos (linhas
178-220), mesma trava de consentimento (linha 77), mesmo teto de 10 MB, mesmo
par e-mail+telefone obrigatórios.

Diferença: currículo é **sempre** obrigatório aqui ("PDF ou DOCX, até 10MB",
linha 200) — não há departamento de vaga pra relaxar a exigência.

**Envio:** RPC `submit_talent_pool_application` (linha 93), com o mesmo desenho
de rate limit por contato da RPC irmã, e o mesmo padrão de upload por path
devolvido. Mesmo bucket `rh-curriculos`.

**Entidades ligadas:** `rh_candidatos` · bucket `rh-curriculos`.
## 3.51 Solicitação ao Marketing — `/solicitar-marketing`


`MarketingRequestForm.jsx:115`, com `defaultCategory = "material"`.

**Campos** — o formulário é **bifurcado por `category`** (linhas 117-129):

*Comuns:*

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `requesterName` | Seu nome | text | **obrigatório**, mín. 2 |
| 2 | `requesterEmail` | Seu e-mail | email | opcional; é a chave do rate limit |
| 3 | `companyIds` | Empresa / unidade | multi | vazio = todas (`MARKETING_UNIT_IDS`, linha 203) |
| 4 | `description` | Descrição detalhada | textarea | |
| 5 | `deadline` | Prazo desejado | date | |

*Só `material`:*

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 6 | `department` | Departamento | select | **obrigatório** |
| 7 | `requestType` | Tipo de material | select | **obrigatório** |
| 8 | `title` | Título da solicitação | text | **obrigatório**, mín. 3 |
| 9 | `priority` | Prioridade | select | default `media` |
| 10 | `budget` | Orçamento (se aplicável) | number | |
| 11 | `approverName` | Aprovação necessária de quem? | text | |

*Só `compra`:* `title` vira "O que você precisa comprar?" (mín. 2, linha 402) e
os campos 6-7 e 9-11 saem.

**Validação:** `missing` é uma **lista do que falta**, não um booleano — o
botão desabilitado sem dizer por quê dava a impressão de que só "Compra"
funcionava (`missing`, linha 153; comentário nas linhas 149-152). `canSubmit = !submitting &&
missing.length === 0` (linha 166).

**O que acontece no envio** — RPC `submit_marketing_request` (linha 192):

1. Valida categoria, nome, os obrigatórios de cada categoria, formato de
   e-mail, prioridade e empresa
   (`20261020_sec_marketing_requests_rpc_ratelimit.sql:36-69`).
2. **Rate limit**: por e-mail, **5 em 24h** (linhas 75-80); global, **100 em 10
   minutos** (linhas 85-89). O motivo da migração de INSERT direto pra RPC
   (chave anon sem limite nenhum) está no comentário do componente, linhas
   186-191.
3. Segunda chamada, `get_marketing_request_number(p_id)` (linha 207), pra
   mostrar o número do protocolo na tela de sucesso.

**Entidades ligadas:** `marketing_requests`. A aprovação posterior da
solicitação cria entrega, compra ou tarefa em outro módulo — comportamento
descrito em §5.1(c) do arquivo principal.
## 3.52 Solicitação de compra — `/solicitar-compra`


Mesmo componente, montado com `defaultCategory="compra"` (`main.jsx:23`). Não é
uma tela separada: só o valor inicial de `category` muda, e com ele o conjunto
de campos descrito em 3.E15. O `document.title` acompanha
("Solicitar Compra ao Marketing", `MarketingRequestForm.jsx:136`).

O seletor de categoria continua na tela, então quem abrir `/solicitar-compra`
pode trocar pra "material" e vice-versa.
## 3.53 Revisão de candidatos pelo gestor — `/gestor-vaga/:token`


`ManagerVagaReviewPage.jsx:13`. Única rota pública com **duas** camadas de
autenticação própria, declaradas no comentário de topo (linhas 8-12): o token
de alta entropia na URL **e** a confirmação do e-mail cadastrado. A página
nunca lê tabela direto — tudo passa pela edge `manager-vaga-review`, que roda
com service role.

**Campos:**

| Etapa | Campo | Tipo | Observação |
|---|---|---|---|
| Destrava | e-mail | email | comparado com `manager_email` do link, normalizado (`manager-vaga-review/index.ts:50`) |
| Por candidato | Observações (opcional) | text | vai em `manager_decision_notes` |
| Por candidato | Aprovar / Reprovar | botões | `decision` ∈ `aprovado`/`reprovado` (validado na edge, linha 103) |

**Validação do link, na edge:** token e e-mail obrigatórios (linha 32);
link revogado (`revoked_at`) ou expirado (`expires_at`) é recusado (linha 49);
e-mail que não confere, idem. **Toda falha devolve a mesma mensagem genérica**
— o comentário da linha 42 registra que isso é deliberado, pra não revelar qual
das checagens falhou.

**O que aparece por candidato** (select da edge, linha 63): etapa do pipeline,
fit score, justificativa, pontos fortes, gaps, decisão já registrada e link do
currículo.

**O que acontece na decisão:** `action: "decide"` grava `manager_decision`,
`manager_decision_at` e `manager_decision_notes` (linhas 119-124), e dispara
notificação `vaga_manager_decision` (linhas 130-135). A tela atualiza a linha
localmente e o card passa a mostrar "Você aprovou/reprovou este candidato"
(`ManagerVagaReviewPage.jsx:46-49, 174-178`).

**Entidades ligadas:** tabela de links de revisão de vaga (token,
`manager_name`, `manager_email`, `expires_at`, `revoked_at`) · `rh_vagas` ·
`rh_aplicacoes` · `rh_candidatos` · edge `manager-vaga-review`.
## 3.54 Pesquisa — `/pesquisa/:id`


`PesquisaPublicaForm.jsx:11`.

A pesquisa é carregada por RPC `get_pesquisa_publica(p_id)` (linha 33), com
**timeout de 10 segundos** e botão "Tentar de novo" (linhas 31, 71-82). A
separação entre "erro de rede" e "pesquisa não existe" está registrada no
comentário das linhas 18-22 — antes os dois tinham o mesmo texto e o spinner
girava pra sempre.

**Campos:** não há formulário fixo. As perguntas vêm da coluna `perguntas`
(array, linha 44) e cada uma tem `key`, `label` e `tipo`:

| `tipo` | Render | Observação |
|---|---|---|
| `escala` | 5 botões (1-5) | `answers[key]` numérico |
| qualquer outro | `<textarea rows=3>` | |

**Validação:** não existe flag de obrigatoriedade por pergunta no cadastro, e
o código trata **toda pergunta renderizada como obrigatória** — asterisco em
todas e botão travado enquanto faltar alguma (`canSubmit`, linhas 51-55; o
motivo está comentado nas linhas 47-50).

**Modo:** `pesquisa.modo === "identificada"` (linha 89) troca o selo do
cabeçalho. No modo anônimo a tela declara **como** o anonimato é garantido:
"O RH só vê os resultados a partir de 5 respostas, e sempre juntas — nunca uma
a uma" (linhas 117-122).

**O que acontece no envio:** RPC `submit_pesquisa_resposta(p_pesquisa_id,
p_respostas)` (linha 61) — só o conteúdo das respostas, **nunca identidade nem
contato** (declarado nas linhas 7-8). Não há rate limit no caminho do cliente.

**Entidades ligadas:** tabela de pesquisas de RH (leitura pela RPC) e tabela de
respostas (escrita pela RPC). O piso de 5 respondentes é aplicado do lado da
tela de resultados, em RH → Comunicação.
## 3.55 Agendamento de bem-estar — `/bem-estar/:id`


`BemEstarPublicaForm.jsx`. É a única rota pública com fluxo de **passos**:
`step` ∈ `contato` → `data` → `horario` (linha 59); o passo de data é pulado
quando a sessão tem uma só (`handleAdvance`, linhas 121-123).

Sessão carregada por RPC `get_bemestar_sessao_publica(p_id)` (linha 78), com o
mesmo timeout/retry do formulário de pesquisa (linhas 65-66). Horários por
data vêm de `get_bemestar_horarios_por_data(p_data_id)` (linha 102), a cada
troca de data.

**Campos:**

| # | id | Label | Tipo | Observação |
|---|---|---|---|---|
| 1 | `nome` | Nome completo * | text | mín. 2 |
| 2 | `email` | E-mail * | email | regex `EMAIL_RE` (linha 107) |
| 3 | `whatsapp` | Celular * | tel | mín. 8 caracteres |
| 4 | `ramal` | Ramal | text | opcional |
| 5 | `unidade` | Unidade | select | 4 opções, `UNIDADES` (linhas 34-37), inclusive "Não informar" |
| 6 | `dataEscolhida` | Escolha a data * | cartões | só quando há mais de uma |
| 7 | `horarioEscolhido` | Escolha um horário * | cartões | mostra vagas livres por horário |
| 8 | `aceitaEspera` | fila de espera | checkbox | só aparece quando o horário escolhido está lotado |

**Validação:** `canAdvance` cobre os 3 campos do passo 1 (linha 109). O avanço
também valida campo a campo com mensagem específica (linhas 115-119).
`canSubmit` exige horário escolhido **e**, se ele estiver lotado, o aceite da
espera — o motivo (o banco recusaria e a pessoa levaria erro por um clique que
a tela permitiu) está comentado nas linhas 110-111.

**O que acontece no envio:** RPC `submit_bemestar_agendamento` com sessão,
horário, dados de contato, unidade, data e `p_aceita_espera` (linhas 139-147).
A resposta traz `status` e `posicao_espera`, exibidos na confirmação
(linhas 149-154). Com e-mail preenchido, dispara a edge `rh-send-email`
(`type: "bemestar_confirmado"`) sem bloquear (linha 155-157).

**Em caso de erro**, a tela recarrega os horários, zera a escolha e o aceite —
porque o horário pode ter lotado no meio do caminho (linhas 158-164).

**Entidades ligadas:** sessão e datas de bem-estar · horários (com vagas
livres) · agendamentos (com fila de espera) · edge `rh-send-email`.

---

# Seção 4 — Máquinas de estado e visibilidade condicional

## 4.1 Entidades com etapa/status

`rh_pipeline_stages` é a tabela única de etapas, particionada por `domain` —
**79 etapas em 14 domínios [prod]**, das quais 19 terminais (reconferido em
14/09/2026: os três números não mudaram). Nenhuma das 79 tem `description`
preenchida nem `card_preview_fields` com conteúdo.

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
Em 14/09/2026 a tabela tem **84 linhas [prod]**, todas do domínio `comercial`
(42 por frente, `industria` e `resibag`), das quais 22 marcam `allowed =
false`. Para o Funil de Vendas a regra passou a barrar de fato; para os outros
13 domínios, que não têm linha nenhuma, continua valendo "aberto".

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
"all"). **7 regras cadastradas, todas ativas [prod]** (reconferido em
14/09/2026: os dois números não mudaram).

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
| `client_contacts` | **4** | comitê de compra | painel no drawer |

Comparação pra dimensionar: `leads` **29**, `clients` **43**,
`marketing_deliverables` **25**, `products` **15**, `rh_colaboradores` **15**,
`profiles` **15**, `personal_tasks` **20**, `market_signals` **25** [prod].

As oito primeiras linhas da tabela seguem em **0** em 14/09/2026, onze dias
depois do primeiro levantamento — `client_contacts` foi de 2 para 4, e é a
única das nove que se mexeu.

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

| Motor | Configurado [prod] 14/09/2026 | Em 03/09/2026 | Onde está o código |
|---|---|---|---|
| **Campo condicional** (`visible_if`) | **0** de 148 definições | 0 de 136 | `field-conditions.js`, usado em 17 arquivos |
| **Obrigatoriedade condicional** (`required_if`) | **0** de 148 | 0 de 136 | idem |
| **Validação de formato** (`validation_rule`) | **0** de 148 | 0 de 136 | `field-validation.js` (CNPJ com checksum, regex, range, not_future, not_past, min_length, not_in) |
| **Transição permitida** (`pipeline_stage_transitions`) | **84 linhas** | 0 linhas | `use-pipeline-transitions.js` + `PipelineStagesModal` |
| **Descrição de etapa** (`description`) | **0** de 79 etapas | 0 de 79 | feature entregue em 01/09/2026 |
| **Preview de campo no card** (`card_preview_fields`) | **0** de 79 etapas | 0 de 79 | `rh_pipeline_stages` |

As 148 definições são 86 do CRM (7 etapas) + 62 de RH (21 etapas); 50 e 11
delas estão marcadas `required`. Fora dessas duas famílias existe uma terceira
tabela de campo por etapa, `personal_task_stage_fields`, com **0 linhas** — ou
seja, **a obrigatoriedade estática continua sendo a única coisa configurada**
nos três casos.

**O que mudou desde 03/09**: `pipeline_stage_transitions` saiu de 0 para **84
linhas** — 42 por frente comercial (`industria` e `resibag`), todas no domínio
`comercial`, cobrindo as 7 etapas de origem do Funil. Delas, **62 marcam
`allowed = true` e 22 marcam `allowed = false`**. A regra de leitura é: *existe
linha → usa `allowed`; não existe → aberto*. Com a tabela preenchida para o
Funil, as 22 transições marcadas falsas passaram a ser efetivamente barradas
ali — um negócio não pula mais de qualquer etapa para qualquer etapa nesse
quadro.

A afirmação de 03/09 ("o caso mais grave é `pipeline_stage_transitions` com 0
linhas") **não descreve mais o estado do banco** e fica registrada aqui só
como histórico. O escopo do que foi configurado é o Funil de Vendas: nenhum
dos outros 13 domínios de `rh_pipeline_stages` tem linha de transição, e para
eles a regra "não existe → aberto" continua valendo.

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
"dono" é `text` em `leads` e `uuid` em `marketing_campaigns`** (e o array
acompanha: `_text` num, `_uuid` no outro); e o padrão duplicado nem é aplicado
de forma consistente — reconferido em 14/09/2026, **nove tabelas têm só o
array, sem escalar nenhum**: `marketing_tasks` (`assignee_ids`), `clients` e
`posvenda_cases` (`owner_ids`), `comex_export_operations` e
`comex_import_operations` (`owner_ids`), `rh_candidatos` e `rh_vagas`
(`responsible_ids`). Ou seja, o par escalar+array é minoria: 5 tabelas contra
9 que já fazem só o array.

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
| `comex_import_operations` / `comex_export_operations` | `company_ids` **array** | várias |
| `rh_vagas`, `document_library`, `uniform_*` | `company_ids` **array** | várias |
| `orders`, `proposals`, `products`, `market_signals`, `sales_cases`, `whatsapp_conversations`, `automations`, `esg_*`, `chat_channels`, `agent_actions` | `company_id` **text** | uma |

Um cliente pode pertencer a duas frentes; o negócio dele, não. A conversão
negócio → caso de pós-venda mantém o singular, mas o cliente ligado aos dois é
plural. Toda policy de RLS precisa saber qual das duas formas está tratando.

### c) `notes` é três coisas diferentes com o mesmo nome [prod]

Levantamento refeito em 14/09/2026 — **24 tabelas têm coluna `notes`**,
partidas em dois tipos:

- **`jsonb`** (fio de comentários) em 11: `leads`, `marketing_campaigns`,
  `marketing_deliverables`, `marketing_tasks`, `marketing_purchase_requests`,
  `posvenda_cases`, `personal_tasks`, `bug_reports`, `rh_aplicacoes`,
  `rh_candidatos`, `comex_import_operations` / `comex_export_operations`.
- **`text`** (campo livre) em 13: `clients`, `rh_colaboradores`, `rh_ferias`,
  `rh_avaliacoes`, `rh_fornecedores`, `rh_fornecedor_contratos`,
  `rh_colaborador_beneficios`, `marketing_suppliers`, `marketing_requests`,
  `marketing_budgets`, `marketing_expenses`, `lead_captures`, `lead_samples`,
  `uniform_people`.

Mesmo rótulo na interface, semântica diferente por trás.

### d) Log de evento guardado dentro da linha

`activities` é `jsonb` em **15 tabelas** [prod, 14/09/2026 — eram 6 na
listagem de 03/09]: `leads`, `marketing_campaigns`, `marketing_deliverables`,
`marketing_tasks`, `marketing_purchase_requests`, `rh_colaboradores`,
`rh_aplicacoes`, `rh_avaliacoes`, `rh_ferias`, `rh_movimentacoes`,
`rh_treinamento_atribuicoes`, `rh_vagas`, `bug_reports`,
`comex_import_operations`, `comex_export_operations`. Consequências: sem FK pro autor, sem RLS por item,
não dá pra consultar "tudo que fulano fez" sem varrer todas as tabelas, e
duas escritas concorrentes no mesmo card sobrescrevem o array inteiro.

Convivem com isso duas tabelas relacionais de histórico — `lead_stage_history`
e `rh_stage_history` — que fazem a coisa certa. São modelos opostos no mesmo
sistema.

### e) Duas famílias paralelas para o mesmo motor

| Conceito | CRM | RH |
|---|---|---|
| Definição de campo por etapa | `pipeline_stage_fields` (chaveada por `stage_id`) | `rh_pipeline_stage_fields` (chaveada por `domain` + `stage_key`) |
| Componente de input | `lead/StageFieldInput.jsx` | `rh-pipeline/RHStageFieldInput.jsx` |
| Card do Kanban | `LeadKanbanCard.jsx` (247 linhas) | `RHKanbanCard.jsx` (105 linhas) |

**Correção de 14/09/2026 — o input não é mais duplicado.** Esta tabela dizia
que `RHStageFieldInput.jsx` era um "switch de tipos idêntico, copiado".
Conferido: os dois arquivos têm **1 linha cada** e são reexports do mesmo
módulo, `shared/StageFieldInput.jsx` (230 linhas):

```
lead/StageFieldInput.jsx:      export { StageFieldInput, default } from "../shared/StageFieldInput";
rh-pipeline/RHStageFieldInput.jsx: export { StageFieldInput as RHStageFieldInput, default } from "../shared/StageFieldInput";
```

A duplicação que sobra nessa linha é só o **nome de import**, não o código. A
dos cards do Kanban continua real (dois arquivos, 247 e 105 linhas). A das
tabelas de definição também.

O mesmo texto obsoleto vive na regra 2 do `CLAUDE.md` ("switch de tipos
idêntico, copiado") — registrado aqui como constatação; aquele arquivo é a
fonte e se corrige por lá.

Mesmos 16 tipos, mesmas 3 colunas condicionais, chaves primárias diferentes.
Marketing/Entregas/Compras não usam nem um nem outro — têm card inline
próprio. Desde 03/09 apareceu uma **terceira** tabela com o mesmo formato,
`personal_task_stage_fields` (16 colunas, **0 linhas** [prod]), ao lado de
`personal_task_stages`.

### f) Anexo em quatro lugares diferentes

Bucket dedicado por domínio (**14 buckets** [prod, 14/09/2026]: `avatars`,
`chat-attachments`, `chat-stickers`, `comunicado-anexos`, `crm-comprovantes`,
`deliverable-attachments`, `document-library`, `lead-attachments`,
`marketing-attachments`, `personal-task-attachments`, `rh-attachments`,
`rh-curriculos`, `rh-documentos-assinatura`, `rh-documentos-colaborador`),
tabela `rh_attachments`, `lead_attachments`, e referência dentro de
`custom_fields`/`notes`. Dois buckets são públicos: `avatars` e
`chat-stickers` (decisão registrada em `docs/decisoes-de-seguranca.md`,
BX-08).

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
| **Motor ocioso** | 148 campos configurados, 0 usam condição ou validação. As transições deixaram de ser o pior caso: 84 linhas cadastradas (22 bloqueios) cobrem o Funil de Vendas; os outros 13 domínios seguem sem nenhuma |
| **Superfície vazia** | 3 itens de menu L1 (`Pós-venda`, `Pedidos`, `Biblioteca`) com 0 registros |
| **Schema** | escalar+array em 5 tabelas (contra 9 que já só têm array), `owner` é text num lugar e uuid noutro, `notes` é jsonb em 11 tabelas e text em 13, `activities` é log dentro da linha em 15 |
| **Fluxo** | criar em outro módulo nunca leva até lá |
| **Governança** | quem reporta bug não consegue acompanhar |
