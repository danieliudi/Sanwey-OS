# Mapa funcional — o que cada tela é, pra quem, e do que depende

Este arquivo existe pra responder três perguntas que **nenhum outro documento
do repositório respondia** (conferido em 03/09/2026):

1. Pra que serve cada página da plataforma?
2. Quem consegue abrir cada uma, e por quê?
3. O que precisa estar de pé pra ela funcionar — tabela, edge function,
   integração externa, segredo?

O `CLAUDE.md` é o padrão de **como construir** (reaproveitamento, revisão,
gates). Ele não descreve funcionalidade nenhuma, de propósito. O `README.md` é
setup. As 55 specs em `docs/design-spec-*` descrevem **uma mudança cada**.
Faltava o mapa — e sem ele, cada sessão nova (e cada pessoa nova) redescobria
a plataforma do zero.

**O que este doc NÃO é**: não é spec de design (essas continuam por mudança),
não é dicionário de schema (o banco é a fonte pro schema), e não é manual do
usuário (isso é `src/data/tutorials.js`, exibido em Ajuda & Tutoriais).

**Como saber se envelheceu**: rode `npm run doc:check`.
Ele compara as contagens declaradas aqui com o código e falha se divergirem.
Não valida o texto — só os números e a lista de rotas/functions.

---

## 0. A plataforma em números

Todos conferidos no código em 03/09/2026:

| | |
|---|---|
| Rotas autenticadas (`src/constants/routes.js`) | **53** |
| …das quais só redirecionam | **7** |
| …telas de verdade | **46** |
| Rotas **públicas**, sem login (`src/main.jsx`) | **8** |
| Componentes de view (`src/components/views/`) | **59** |
| Hooks (`src/hooks/`) | **124** |
| …que falam com o banco | **99** |
| Tabelas referenciadas pelo front | **109** |
| Funções RPC chamadas pelo front | **48** |
| Edge functions **ativas em produção** | **30** |
| …com fonte versionada no repo | **27** |
| Buckets de Storage | **13** (2 públicos) |
| Frentes comerciais (`COMPANY_IDS`) | **2** — `industria` (Sanwey) e `resibag` |

Duas observações que contrariam documentação existente:

- O `README.md` diz "multi-tenant para **4** empresas (Comercial, Indústria,
  Resibag, Monte Mor)". No código, `COMPANY_IDS = ["industria", "resibag"]` —
  duas. `montemor` existe só em `MARKETING_UNIT_IDS`, porque a unidade não
  vende, mas pede material de Marketing. "Comercial" é departamento, não
  empresa.
- O `README.md` lista `views/` como 7 arquivos ("Dashboard, Signals, Explorer,
  CRM, Executive, CrossReferrals, UserManagement"). São 58. Aquela árvore é a
  foto da reescrita v4 e nunca foi atualizada.

---

## 1. Quem enxerga o quê — o acesso tem 3 camadas, não 1

Errar isso é a causa de uma classe de bug que já aconteceu várias vezes aqui:
a pessoa vê o item no menu, clica, e cai numa tela vazia ou volta pro início.
As três camadas são independentes e todas precisam liberar.

```
CARGO (roles[])  →  MÓDULO (module_states + overrides)  →  RLS (no banco)
   quem, por        liga/desliga por página,               qual LINHA cada
   função           por pessoa ou pra empresa toda         um lê e escreve
```

**Camada 1 — cargo.** `src/utils/module-access.js` é a fonte única.
`computeRoleFlags(roles)` deriva as flags; `defaultModulesForRoles(roles)` diz
quais páginas o cargo concede por padrão. O espelho em SQL é
`current_user_has_module()`. **Mudou aqui, muda lá** — as duas metades têm que
concordar, senão o menu promete o que a RLS nega.

Cargos existentes e o que cada um significa:

| Cargo | O que é |
|---|---|
| `admin` | tudo, escrita inclusa |
| `gerente` | gestão Comercial (funil do time, Executivo, Automações, Cross-sell) |
| `vendedor` | funil próprio, clientes, pedidos, viagens |
| `suporte` | opera pedido e mantém catálogo — **não vende**: sem funil, sinais nem prospecção |
| `comex` | só Comex, cargo dedicado sem carve-out pro Comercial geral |
| `marketing` / `gerente_marketing` | módulo Marketing; o gerente também alcança Executivo |
| `rh` / `gerente_rh` | módulo RH; o gerente também alcança Cargos, Comunicação, Bem-estar, Relatórios, Agentes e Automações |
| `agencia` | **shell fixo e restritíssimo**: só Campanhas e Entregas, mais nada |
| `portal` | conta externa de cliente (Portal B2B) |
| `diretoria` | lê **tudo** da plataforma, **escreve nada** — a proibição de escrita é RLS (`20260756_papel_diretoria.sql`), não código de tela. Não é sinônimo de admin |

Dois cuidados que já custaram bug real:

- **Cargo "puro" muda o menu inteiro.** `isPureRH`, `isPureMarketing`,
  `isPureComex`, `isPureSuporte` significam "não tem NENHUM outro cargo além
  desses". Quem é `{rh}` não vê o grupo Comercial; quem é `{rh, vendedor}` vê.
- **Policy nova lê `roles[]`, nunca `profiles.role`** (regra do CLAUDE.md,
  achado MD-11). O escalar existe e é sincronizado por gatilho, mas usá-lo pra
  decidir permissão nega acesso a quem tem o cargo como secundário.

**Camada 2 — módulo.** Tabela `module_states`, uma linha por página, três
estados. **Isto RESTRINGE, nunca AMPLIA** — é filtro por cima do que o cargo
já concedeu:

| Estado | Quem abre |
|---|---|
| `live` | regra normal de cargo (é também o padrão de quem não tem linha na tabela) |
| `test` | **só admin** e quem tiver exceção explícita (`profile_module_overrides.allow = true`) |
| `off` | ninguém, nem admin |

> Este é o mecanismo que `docs/treinamento/README.md` cita ao avisar que a
> sessão de treinamento trava se "Catálogo e Pedidos" estiverem em `test` — a
> sala inteira abre um menu sem essas telas. Onde se muda: Configurações →
> Administração. `isModuleInTest()` é só pra decidir se mostra a tarja "em
> teste" no topo; o acesso já foi resolvido antes.

**Camada 3 — RLS.** Decide qual **linha** cada pessoa lê/escreve. Liberar a
tela não libera o dado — foi exatamente o que aconteceu com o suporte em
Clientes (01/09/2026): o módulo estava liberado, a policy `clients_read` não
incluía `suporte`, e a tela abria **vazia, sem erro nenhum**. Corrigido na
RLS, não no menu.

Duas decisões de escopo deliberadas, registradas no CLAUDE.md, que não devem
ser "consertadas" por conta própria: `rh_colaboradores` é lido pelo Grupo
inteiro sem filtro por empresa (RH é centralizado de propósito — MD-10), e a
chave pessoal de IA fica em texto plano em `profile_secrets.ai_config`
(risco residual aceito — MD-12).

---

## 2. As telas, grupo por grupo

Cada entrada segue o mesmo formato: **rota** · arquivo · pra que serve · quem
abre · dado principal · integração externa (quando tem).

### 2.1 Meu Espaço — todo mundo tem

| Rota | Tela | Pra que serve |
|---|---|---|
| `/` | `MinhasTarefasView.jsx` | **Pendências.** Pouso pós-login de todo cargo interno. Fila única do dia, juntando o que precisa de atenção em qualquer tela da plataforma — aprovação de compra, lead parado, avaliação pendente, tarefa vencida. Cada item leva direto ao registro (dispatcher genérico de deep-link no `App.jsx`). Agência não passa por aqui: cai em Campanhas. |
| `/chat` | `ChatView.jsx` | Chat interno: grupos, canais e conversa direta. Quem você pode chamar no privado segue a estrutura da empresa. Grupos por departamento se sincronizam ao vivo (`sync_filter` + gatilho). Liga/desliga **por pessoa** em `profiles.chat_enabled`. Dado: `chat_channels`, `chat_channel_members` + 12 RPCs `chat_*`. Realtime. |
| `/tarefas-pessoais` | `PersonalTasksView.jsx` | **Meu To-do.** Kanban privado por usuário (RLS por dono), com etapas e campos configuráveis, etiquetas, checklist, anexo, recorrência, dependência entre tarefas e automações pessoais. Vem ligado por padrão; desliga em Configurações → Preferências → Recursos. Tem API própria (`personal_tasks_api_keys` + edge `personal-tasks-agent`). |
| `/meu-rh` | `MeuRHView.jsx` | Portal do colaborador: comunicados, onboarding, treinamentos, avaliação, férias, documentos e dados pessoais, em abas. **Só aparece pra quem tem ficha em `rh_colaboradores`** — sem ela a tela abre vazia, porque holerite/férias/dados são ancorados no id do colaborador, não no do profile. |

### 2.2 Comercial

| Rota | Tela | Pra que serve |
|---|---|---|
| `/comercial` | `DashboardView.jsx` | **Visão Geral do Comercial**, personalizável por usuário. Distinta de `/` (que é o roteador de pouso). Sem essa separação, "Visão Geral" mostrava o Painel Executivo pra admin. |
| `/sinais` | `SignalsView.jsx` | Sinais de mercado — publicação regulatória, licitação, movimento de concorrente. Topo mostra "Sinais monitorados" e "Sinais críticos". Serve pra criar lead a partir do sinal. Dado: `market_signals`. |
| `/pipeline` | `CRMView.jsx` | **Funil de Vendas** — o Kanban principal. Card = negócio. Detalhe em 3 colunas (dados / campos da etapa / ações). Comitê de compra (vários contatos por cliente), proposta com itens (CPQ), gate de etapa por valor de campo, ata de visita por voz com GPS, alerta de menção a concorrente, fit_score. Views: Kanban, Tabela, Calendário, Análise. Etapas **por empresa** (única no sistema). Integra: IA, CNPJ, voz. |
| `/pos-venda` | `PosVendaView.jsx` | **Funil de Pós-venda.** Ligado ao anterior: o botão "Enviar para Pós-venda" num negócio Ganho cria o caso aqui, e o negócio original continua existindo no funil. Onboarding do cliente → acompanhamento → renovação/upsell. Dado: `posvenda_cases`. |
| `/pedidos` | `PedidosView.jsx` | Pedidos: registro e acompanhamento por etapa. É a tela que o `suporte` opera. Dado: `orders`, `order_items`, `order_stage_history`, `client_products`. |
| `/clientes` | `client/ClientsManager.jsx` | Base de clientes, com deduplicação por CNPJ. Endereço, contatos (comitê de compra), produtos liberados com preço negociado, e linha do tempo consolidada (`get_client_timeline`: ata, visita, mudança de etapa, faturamento). Integra: CNPJ, voz, reverse-geocode. |
| `/abm` | `AbmAccountsView.jsx` | **Contas · ABM** — agrega leads de campanha Conteúdo/Digital por conta (`client_id` → CNPJ → o próprio lead). Mostra toques, fit score determinístico (mesma fórmula do Funil) e tamanho do comitê (`client_contacts`). Não é um segundo motor de métricas. |
| `/catalogo` | `CatalogoView.jsx` | Catálogo de produtos: código, preço de tabela, pedido mínimo, certificações, regras de margem (`margin_rules`). Marketing também alcança, porque mantém a metade "vitrine" (chamada, destaques, especificações) que o Portal B2B mostra. |
| `/biblioteca-de-documentos` | `DocumentLibraryView.jsx` | "Datasheet, certificado e ficha técnica reutilizáveis — anexe a qualquer negócio sem reenviar". Dado: `lead_document_refs` + bucket `document-library`. |
| `/explorador` | `ExplorerView.jsx` | Prospecção: busca direta por CNPJ e lista de sugestões com filtro (`prospect_seeds`). Absorveu a importação de feira. Integra: CNPJ. |
| `/viagens` | `CRMViagensView.jsx` | **Viagens & Despesas**, 5 abas: Planejamento (minhas viagens), Despesas, Prestação de contas em lote, Gestão (aprovar do time) e Relatórios, mais a Calculadora de custo. Integra: Google Places/Distance Matrix e IA (lê valor do comprovante). Alimenta o Escopo 3 do ESG. |
| `/cross-sell` | `CrossReferralsView.jsx` | Indicação entre empresas do Grupo — deriva sobreposição dos leads vivos e sugere. Só gerente/admin. |
| `/comex` | `ComexView.jsx` | Importação e exportação, dois fluxos com etapas próprias, alternador no topo. Cargo `comex` dedicado (ou diretoria). |

### 2.3 Marketing

| Rota | Tela | Pra que serve |
|---|---|---|
| `/marketing/inicio` | `MarketingDashboardView.jsx` | KPIs do módulo: campanhas ativas, orçamento comprometido, performance média. |
| `/marketing` | `MarketingView.jsx` | **Campanhas** — Kanban. Checklist de aprovação, anexo via Google Drive, calendário exportável (.ics). É a tela onde a **agência** entra. |
| `/marketing/solicitacoes` | `MarketingRequestsView.jsx` | Caixa de entrada das solicitações que chegam pelo **link público** `/solicitar-marketing`. Quem pede escolhe "Material de Marketing" ou "Compra". A aprovação vira entrega **ou** vira compra **ou** vira tarefa (3 RPCs distintas). |
| `/marketing/entregas` | `EntregasView.jsx` | Fila de produção sob demanda, normalmente com agência. Notifica por e-mail na conclusão e no encaminhamento ao fornecedor. |
| `/marketing/tarefas` | `MarketingTarefasView.jsx` | Board do dia a dia da equipe interna — separado de Entregas de propósito, pra não misturar com produção. |
| `/marketing/fornecedores` | `FornecedoresView.jsx` | Agências, gráficas, confecções. **Referência canônica do padrão de exclusão** de toda página "Fornecedores" (CLAUDE.md regra 1). |
| `/marketing/compras` | `ComprasMarketingView.jsx` | Itens prontos (brindes, uniformes, gráfica) — não é produção. Cotação com fornecedor por e-mail, aprovação por RPC. **Exceção deliberada**: usa `PURCHASE_STAGES` fixo no código, não `rh_pipeline_stages` — as transições são acopladas às RPCs de aprovação. |
| `/marketing/despesas` | `DespesasView.jsx` | Gastos de marketing, com vínculo a entrega/tarefa. Comprovante em bucket. |
| `/marketing/feiras` | `FairReportView.jsx` | "Custo, leads e retorno de cada feira — comparados na mesma idade." |
| `/marketing/conteudo` | `FairReportView.jsx` (`ContentReportView`) | Mesmo motor das Feiras (`computeFairMetrics`), filtro canal Conteúdo + Digital. |

### 2.4 Recursos Humanos

| Rota | Tela | Pra que serve |
|---|---|---|
| `/rh` | `RHOverviewView.jsx` | Painel: funcionários, férias pendentes, vagas em aberto, turnover aproximado. |
| `/rh/recrutamento` | `RHRecrutamentoView.jsx` | Vagas (Kanban) + candidatos de cada uma. O board é a **junção** candidato×vaga (`rh_aplicacoes`) — sem aplicação, o candidato não aparece. Aprovação do gestor por **link público com token** (`/gestor-vaga/:token`). Converte candidato → funcionário. Currículo em bucket. |
| `/rh/onboarding` | `RHOnboardingView.jsx` | Checklist de integração por colaborador, a partir de template. A etapa "Removido" **não conta na métrica** — é a razão de não existir motor genérico de Kanban (CLAUDE.md regra 4). Todo colaborador vê o próprio, não só RH. |
| `/rh/treinamentos` | `RHTreinamentosView.jsx` | Catálogo + atribuição + conformidade (validade em dias). Aqui "criar" significa **atribuir colaborador existente**, não criar registro novo. |
| `/rh/feedback` | `RHFeedbackView.jsx` | Ciclos de avaliação de desempenho, com autoavaliação (`rh_submit_self_rating`) e movimentação (promoção/mérito) sujeita a aprovação. |
| `/rh/ferias` | `RHFeriasView.jsx` | Férias & licenças em Kanban por status; aprovação em lote. Anexo em `rh_attachments`. |
| `/rh/funcionarios` | `RHFuncionariosView.jsx` | Tabela completa da equipe — **referência canônica do padrão "Tabela com filtro"** e a única tela com o toggle de densidade hoje. Pedido de atualização de dado pelo próprio colaborador (aprova/recusa), benefícios, e assinatura de documento via D4Sign. |
| `/rh/fornecedores` | `RHFornecedoresView.jsx` | Convênio médico, seguradora, terceirizada: cadastro, contratos e eventos. Contrato e histórico somem juntos no `ON DELETE CASCADE` — por isso o texto do modal de exclusão é diferente do de Marketing. Piloto do Agent Builder. |
| `/rh/cargos` | `RHCargosView.jsx` | Cargos & salários: catálogo com faixa salarial, e movimentações. Só gerente_rh/admin/diretoria. |
| `/rh/comunicacao` | `RHComunicacaoView.jsx` | Comunicados (notificação pra todos, por frente ou por departamento) e pesquisas internas, com link público `/pesquisa/:id` e agregado anônimo. |
| `/rh/bem-estar` | `RHBemEstarView.jsx` | Sessões (massagem, avaliação física) com fila e inscrição por link público `/bem-estar/:id`. |
| `/rh/relatorios` | `RHRelatoriosView.jsx` | Montador de relatório: métricas por categoria (Funcionários, Recrutamento, Férias…), presets salvos, export CSV. |

### 2.5 Inteligência

| Rota | Tela | Pra que serve |
|---|---|---|
| `/executivo` | `ExecutiveDashboard.jsx` | **Painel Executivo** — o único lugar que presidência/diretoria olha. Faixa de saúde por área (1 número + 1 alerta cada) + uma aba de profundidade por área. **Departamento novo na plataforma = uma aba nova aqui, e isso faz parte de "pronto"** (CLAUDE.md regra 9). Visibilidade por usuário via `EXECUTIVE_WIDGETS`. Absorveu o Histórico de Funil. |
| `/inteligencia-mercado` | `MarketIntelligenceView.jsx` | Hub "Mercado", 3 abas: Mercado, Insights e Cruzamento. Substituiu a rota `/insights` solta. Único módulo desta lista visível pra vendedor. |
| `/esg-carbono` | `ESGCarbonoView.jsx` | Inventário de emissão (Escopos 1/2/3, GWP), relatório por período, dossiê exportável e selo na proposta comercial. Escopo 3 vem de `/viagens`. Gate = as 3 tabelas `esg_*` (gerente/admin/diretoria), **não** `canSeeExecutive`. |
| `/agentes` | `AgentActionsView.jsx` | Fila de sugestões dos agentes de IA. **A IA nunca executa sozinha, só sugere** — aqui se aprova ou recusa. Dado: `agent_actions`. Dois badges distintos: no menu, agentes pausados **pelo sistema** (chave de IA quebrada — pausa manual foi decisão do time, não pede atenção); no sino, a **escada de urgência** da fila (`use-agent-queue-alert.js`, 03/09/2026) — sugestão que envelhece vira âmbar. O vendedor lê as sugestões de prospect que são dele e "puxar" é uma função no banco (`puxar_prospect_sugerido`), não um UPDATE da tela. |

### 2.6 Configuração e sempre-visíveis

| Rota | Tela | Pra que serve |
|---|---|---|
| `/automacoes` | `AutomationsView.jsx` | Duas abas: "Automações" (regras determinísticas, sem IA — gatilho → ação, tabela `automations`) e "Agentes de IA" (Agent Builder). |
| `/configuracoes` | `SettingsView.jsx` + `UserManagementView.jsx` | Perfil, aparência, notificações, preferências, chaves de IA — e, pra gestor, o grupo Administração com **Usuários** (convite, cargo, empresa, acesso por módulo), `module_states`, descrição de página/etapa e auditoria de export. |
| `/ajuda` | `TutoriaisView.jsx` | Ajuda & Tutoriais, conteúdo em `src/data/tutorials.js`, filtrado por cargo. Sem gate. |
| `/central-bugs` | `BugsView.jsx` | **Reportar é aberto a todo mundo** (por isso o item de menu não tem gate); o board de triagem é `isAdmin`. Reporta de dentro da tela em 1 clique, e o registro carrega o contexto de origem (rota, cargo, último erro de console — `src/utils/bug-context.js` + `error-log.js`), então não depende da pessoa saber descrever. Tem rotina diária de investigação automática que preenche um diagnóstico pra aprovar/recusar. |

### 2.7 As 7 rotas que só redirecionam

Existem pra não quebrar link salvo. Nenhuma renderiza tela.

| Rota | Vai pra | Por quê |
|---|---|---|
| `/insights` | `/inteligencia-mercado` | virou aba do hub Mercado |
| `/presidencia` | `/executivo` | consolidado no Executivo |
| `/historico-funil` | `/executivo` | virou aba do Executivo |
| `/pipeline-builder` | `/pipeline` | absorvido pelo botão "Editar etapas" dentro do próprio Kanban |
| `/importar-feira` | `/explorador` | absorvido pelo Explorador |
| `/perfil` | `/configuracoes` | perfil é uma seção de Configurações |
| `/usuarios` | `/configuracoes` (gestor) ou `/` | Usuários virou aba dentro de Configurações → Administração |

### 2.8 As 8 rotas públicas — sem login

**Não estão em `ROUTES`.** Vivem em `src/main.jsx`, fora do `<App>`, e são a
superfície de escrita de usuário **não autenticado** — a categoria que exige
o `security-agent` (CLAUDE.md 3.1).

| Rota | Formulário | O que grava |
|---|---|---|
| `/captura/:slug` | `LeadCaptureForm` | lead (origem UTM oculta → `campaign_id` quando migration Fase 3 aplicada) |
| `/vagas/:slug` | `JobApplicationForm` | candidatura + currículo no bucket `rh-curriculos` |
| `/trabalhe-conosco` | `TalentPoolForm` | banco de talentos + currículo |
| `/solicitar-marketing` | `MarketingRequestForm` | solicitação de material |
| `/solicitar-compra` | `MarketingRequestForm` (`defaultCategory="compra"`) | solicitação de compra |
| `/gestor-vaga/:token` | `ManagerVagaReviewPage` | decisão do gestor sobre candidato, **autenticada por token**, não por login |
| `/pesquisa/:id` | `PesquisaPublicaForm` | resposta de pesquisa interna (anônima) |
| `/bem-estar/:id` | `BemEstarPublicaForm` | inscrição em sessão |

O upload de currículo usa token de uso único (`rh_curriculo_upload_tokens`,
tabela deny-all deliberada). `rh_pesquisa_respostas` também é deny-all: só
`SECURITY DEFINER` toca.

---

## 3. Conexões — o que precisa estar de pé

### 3.1 O essencial: sem isto, nada funciona

| Peça | Onde se configura | O que acontece se faltar |
|---|---|---|
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | build (Netlify) / `.env.local` | **A plataforma não cai** — `isSupabaseConfigured` fica falso e o app entra num caminho de usuário mock, com todo board vazio. Silencioso e enganoso: parece funcionando. É esse caminho que `npm run qa:smoke` usa de propósito. |
| Projeto Supabase `adizvduyfzfftyswkijj` | — | fonte de tudo: Postgres, Auth, Realtime, Storage, edge functions |
| `terms_acceptances` do usuário | banco | a pessoa loga e **para na tela de Termos de uso** — nenhuma rota renderiza |
| Ficha em `rh_colaboradores` | RH | `/meu-rh` abre vazia e o item some do menu |

> **Um só banco pra tudo.** `netlify.toml` não tem nenhum `[context.*]`
> sobrescrevendo variável, então local, deploy preview de PR e produção
> apontam os três pro **mesmo** projeto Supabase. Pra testar contra banco sem
> risco, o caminho é branch sob demanda — CLAUDE.md regra 13.

### 3.2 As 30 edge functions

**Chamadas pelo front (19)** — cai a função, cai a feature, o resto segue:

| Function | Serve a | Precisa de |
|---|---|---|
| `ai-assistant` | todo rascunho/resumo de IA da plataforma | `AI_ORG_*` (chave da empresa) ou chave pessoal do usuário |
| `crm-ata-voz` | ata de visita por voz (Funil) | `AI_ORG_*` + `AI_AUDIO_MODEL` |
| `caso-prospeccao-voz` | registro de prospecção por voz | idem |
| `cnpj-lookup` | Clientes, Explorador, Funil | `SERPRO_*` (com BrasilAPI de fallback) |
| `places-autocomplete` | endereço em Viagens/Clientes | `GOOGLE_PLACES_API_KEY` |
| `distance-matrix` | distância/custo em Viagens | idem |
| `reverse-geocode` | GPS → endereço no check-in de visita | idem |
| `rh-send-email` | RH (vaga, gestor, colaborador) | `RESEND_API_KEY` |
| `send-crm-email` | aba E-mail do negócio, com template | idem |
| `send-quote-request` | cotação a fornecedor (Compras) | idem |
| `send-request-status-email` | retorno de solicitação de Marketing | idem |
| `send-deliverable-complete-email` | conclusão de entrega | idem |
| `send-deliverable-supplier-notify` | encaminhamento ao fornecedor | idem |
| `resend-invite` | reenviar convite de usuário | service role |
| `delete-user` | excluir usuário (Configurações) | service role |
| `google-drive-upload` | anexo de campanha no Drive | `GOOGLE_SERVICE_ACCOUNT_JSON` |
| `d4sign-send` | enviar documento de RH pra assinatura | 5 segredos `D4SIGN_*` |
| `d4sign-status` | consultar status da assinatura | idem |
| `manager-vaga-review` | decisão do gestor externo sobre candidato | service role (token + e-mail, sem JWT) |

**Chamadas de fora do navegador (6):**

| Function | Quem chama | Precisa de |
|---|---|---|
| `agent-gateway` | agentes externos da esteira, por chave própria | 6 segredos `AGENT_GATEWAY_KEY_<AGENTE>` (CADENCIA, CROSS, ESTEIRA, SCOUT, SDR_Q, SENTINELA) + `RESEND_API_KEY` |
| `agent-runner` | **pg_cron diário** (`agent_runner_daily_cron`, via `net.http_post`) | `AGENT_RUNNER_ENABLED` + `AI_ORG_*` |
| `personal-tasks-agent` | API do Meu To-do, autenticada por **hash** de chave (`personal_tasks_api_keys`) | service role |
| `sanwey-crm-mcp` | claude.ai como Custom Connector (MCP) | `SANWEY_MCP_TOKEN` |
| `d4sign-webhook` | callback da D4Sign | `D4SIGN_WEBHOOK_SECRET` |
| `calendar-ics` | app de calendário do usuário, por **URL direta com token** (não `invoke`) | service role |

**Implantadas e sem nenhuma chamada no código (2)** — ver §4:
`comexstat`, `check-document-legibility`.

**Implantadas sem fonte no repositório (3)** — ver §4:
`analyze-lead`, `backfill-avatars-once`, `chat-sticker-upload`.

**As 7 que aceitam requisição sem JWT** (`verify_jwt: false` em produção) são
exatamente a superfície que precisa de autenticação própria:
`agent-gateway` (chave por agente), `personal-tasks-agent` (hash de chave),
`sanwey-crm-mcp` (token), `manager-vaga-review` (token + e-mail),
`calendar-ics` (token na URL), `d4sign-webhook` (segredo do webhook),
`cnpj-lookup` (**a única sem segredo próprio** — checa JWT por dentro, no
código, em vez de deixar a plataforma barrar).

### 3.3 Integrações externas, por fornecedor

| Fornecedor | Host | Serve a | Se cair |
|---|---|---|---|
| **Resend** | `api.resend.com` | todo e-mail transacional da plataforma | nada é enviado; a ação no banco **acontece**, só o aviso não sai |
| **SERPRO** | `gateway.apiserpro.serpro.gov.br` | consulta de CNPJ | cai pra BrasilAPI (`brasilapi.com.br`) |
| **Google Maps/Places** | `places.googleapis.com`, `maps.googleapis.com` | endereço, distância, GPS→endereço | Viagens perde autocompletar e cálculo de distância |
| **Google Drive** | `www.googleapis.com`, `oauth2.googleapis.com` | anexo de campanha | anexo de Marketing não sobe |
| **D4Sign** | `secure.d4sign.com.br` | assinatura de documento de RH | fluxo de assinatura para |
| **OpenAI** | `api.openai.com` | IA (provedor configurável) | rascunho/resumo/voz param |
| **Anthropic** | `api.anthropic.com` | IA (provedor configurável) e legibilidade de documento | idem |
| **MDIC Comex Stat** | `api-comexstat.mdic.gov.br` | dado público de comércio exterior | (função sem chamada hoje) |

Duas notas de segurança que valem mais que a lista:

- **A chave de IA tem dois caminhos.** BYOK (cada pessoa cola a própria em
  Configurações → Integrações de IA, guardada em `profile_secrets.ai_config`)
  e chave da empresa (`AI_ORG_API_KEY`, segredo de servidor). No caminho BYOK,
  **o navegador chama o provedor direto** — é por isso que o CSP tem
  `api.openai.com` e `generativelanguage.googleapis.com` em `connect-src`, e
  por isso a Anthropic fica **de fora**: ela só é chamada a partir da edge
  function, nunca do browser.
- **CSP ainda é `Report-Only`** (`netlify.toml`). Só reporta violação no
  console, não bloqueia. A troca pra `Content-Security-Policy` de verdade está
  pendente de validação contra produção.

### 3.4 Os 13 buckets de Storage

Conferidos em `storage.buckets` (produção, 03/09/2026). **Dois são
públicos** e os dois são deliberados: `avatars` e `chat-stickers` (figurinha
precisa ser vista por todo mundo no chat; o upload é restrito a
`chat_is_manager` e o limite é 2 MB — achado BX-08, confirmado intencional).
Os outros 11 são privados.

| Bucket | Limite | Serve a |
|---|---|---|
| `avatars` (público) | 2 MB | foto de perfil |
| `chat-stickers` (público) | 2 MB | figurinhas do chat |
| `chat-attachments` | 10 MB | anexo de conversa |
| `crm-comprovantes` | 10 MB | comprovante de despesa de viagem |
| `document-library` | 10 MB | datasheet/certificado reutilizável |
| `personal-task-attachments` | 10 MB | anexo do Meu To-do |
| `rh-attachments` | 10 MB | anexo de RH (férias, funcionário) |
| `rh-curriculos` | 10 MB | currículo (upload por token de uso único) |
| `rh-documentos-assinatura` | 10 MB | documento enviado à D4Sign |
| `rh-documentos-colaborador` | 10 MB | documento pessoal do colaborador |
| `deliverable-attachments` | 50 MB | arquivo de entrega de Marketing |
| `lead-attachments` | 50 MB | anexo de negócio |
| `marketing-attachments` | 50 MB | anexo de campanha/despesa |

### 3.5 A camada de dados: 98 hooks

Dos 123 hooks, **98 falam com o banco** — um por domínio (`use-leads.js` →
`leads`, `use-rh-colaboradores.js` → `rh_colaboradores`…). Os outros 25 são
de UI ou dado derivado (`use-available-height`, `use-kanban-sort`,
`use-users-by-id`…).

**Antes de escrever `supabase.from(...)` numa view, procure o hook.** Hoje
**13 componentes** consultam tabela direto, e cada um é dívida, não padrão:
`CampaignCalendar`, `MarginRulesPanel`, `AtaVozPanel`, `NovoPedidoModal`,
`AgentActionsView`, `CRMViagensCalculadoraView`, `ChatView`, `MeuRHView`,
`NovoColaboradorModal`, `RHFeriasView`, `RHFuncionariosView`,
`RHOverviewView`, `SettingsView`.

A maioria assina Realtime (`postgres_changes`), sempre com debounce
(`src/utils/debounce.js`). Componente que renderiza dado de outro módulo deve
receber o array **já filtrado** de quem tem o filtro, nunca refazer o escopo
por dentro (CLAUDE.md regra 11).

---

## 4. Achados deste levantamento (03/09/2026)

Não são opinião — cada um foi medido no código ou no projeto de produção.
Nenhum foi corrigido nesta passada: documentar não é consertar.

1. **3 edge functions rodam em produção sem fonte no repositório.**
   `analyze-lead` (v9), `backfill-avatars-once` (v5) e `chat-sticker-upload`
   (v3) estão `ACTIVE` no projeto e não têm pasta em `supabase/functions/`.
   Ninguém pode revisar, alterar ou reimplantar as três a partir do Git. O
   nome sugere que `backfill-avatars-once` foi one-shot; as outras duas, não.
2. **2 edge functions implantadas sem nenhuma chamada.** `comexstat` (v11) e
   `check-document-legibility` (v7) — zero referência em `src/`, tirando um
   comentário que diz "ainda NÃO" ligado. São superfície ativa sem uso.
3. **13 das 53 rotas não têm tutorial nenhum** em `src/data/tutorials.js`:
   `pedidos`, `catalogo`, `marketing-feiras`, `marketing-conteudo`, `central-bugs`, `market-intel`,
   `tutorials`, mais as 6 de redirect. Pedidos e Catálogo são as duas que
   pesam — são o dia a dia do `suporte`, e é o cargo sem nenhum guia.
4. **Nenhuma das 58 views tem comentário dizendo pra que serve.** Os
   comentários do código são densos, mas todos de decisão ("por que esta linha
   é assim"), não de propósito. Foi o que tornou este levantamento necessário.
5. **A árvore de `src/` no `README.md` está errada** (7 views, hoje 58) e a
   contagem de empresas também (4, hoje 2 + Monte Mor só em Marketing).

---

## 5. Como manter isto vivo

O risco óbvio deste arquivo é virar a próxima árvore defasada do README. Duas
defesas, uma automática e uma humana:

**Automática** — `npm run doc:check` (`scripts/mapa-funcional-check.mjs`) confere as contagens
declaradas na §0 e a lista de rotas/edge functions contra o código, e falha
apontando a divergência. Não está no `prebuild` de propósito: doc defasado não
deve travar deploy. Rode em auditoria e quando nascer módulo novo.

**Humana** — nasceu departamento, tela ou domínio de dado novo? Então, além do
que a regra 9 do CLAUDE.md já exige (aba no Painel Executivo), acrescente:

1. uma linha na tabela do grupo certo na §2;
2. se trouxe integração ou segredo novo, uma linha na §3.

Uma linha por tela é o suficiente — este doc responde "o que é e do que
depende", não "como usar" (isso é tutorial) nem "como foi decidido" (isso é
`docs/design-spec-*`).
