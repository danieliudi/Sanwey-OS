# PRD — Agent Builder: agentes de IA com governança, dentro da plataforma

Status: rascunho
Piloto: RH

## 1. Problema & Decisão

[A escrever]

## 2. Escopo do piloto — RH primeiro

[A escrever]

## 3. Ferramenta de criação de agente

[A escrever]

## 4. Arquitetura técnica

### Fluxo

Gatilho (evento ou agendado) → condição bate → `agent-runner` chama a IA com a chave do
criador do agente → grava sugestão em `agent_actions` como `pending` → aparece em
`AgentActionsView` pro manager aprovar/rejeitar/ignorar. O fluxo de aprovação em si
(estados, quem vê o quê) é o que já existe hoje em `agent_actions` — este PRD não muda
essa parte, só passa a alimentá-la por uma porta de entrada nova além do n8n.

### Decisão: estende `automations`, não cria tabela nova

`automations` já tem `company_id`, `module`, `trigger`, `condition_groups` (motor de
condições AND/OR pronto), `then_actions`/`else_actions`, `created_by`. Um agente de IA é
uma automação cujo `then_action` é do tipo novo `suggest_with_ai` em vez de
`move_stage`/`set_field`/etc. — mesma forma, um valor a mais no enum de ações. Criar uma
tabela `agent_definitions` paralela duplicaria motor de condição, scoping e builder do
zero, contrariando a regra de reaproveitamento deste repo. Na UI (seção 3), "Automações"
e "Agentes de IA" aparecem como dois filtros/abas da mesma tela — não duas telas.

**Mudança de schema necessária (2 colunas novas, requer confirmação do Daniel antes de
aplicar migration):**

- `automations.paused_reason` (`text`, nullable) — preenchido pelo `agent-runner` quando a
  chave de IA do criador falha ou o limite diário é atingido. `null` = automação saudável.
  Independente do `enabled` já existente: `enabled` é intenção do usuário; `paused_reason`
  é intervenção do sistema.
- `agent_actions.automation_id` (`uuid`, `references automations(id)`, nullable) — só
  preenchido pra ações geradas por esse mecanismo novo; ações do n8n continuam com esse
  campo vazio. Serve tanto pra rastrear origem quanto pra contar execuções (ver limite,
  abaixo) sem precisar de uma coluna de contador separada — conta-se direto em
  `agent_actions` por `automation_id` nas últimas 24h.

O prompt que a IA recebe (template com variáveis do registro, ex: `{{nome}}`,
`{{dias_para_vencer}}`) fica dentro do próprio `then_actions[].promptTemplate` — é
conteúdo do JSON já existente, não schema novo.

### `agent-runner`: edge function nova e magra

Dois modos de disparo, mesma function:

1. **Agendado** — Supabase Scheduled Function roda 1x/dia, varre `automations` com
   `then_action = suggest_with_ai` e gatilho do tipo agendado (ex: `date_approaching`,
   novo tipo de trigger genérico — "campo de data X, avisar N dias antes", cobre o caso do
   contrato de fornecedor vencendo e qualquer outro campo de data em qualquer módulo).
2. **Por evento** — reaproveita o motor client-side que já existe (`evaluateAutomations`,
   chamado hoje em `App.jsx` a cada `stage_change`/`field_value`/`lead_created`). Quando a
   automação avaliada é do tipo `suggest_with_ai`, o client chama a `agent-runner` em vez
   de aplicar um patch local — a avaliação da condição continua no lugar de sempre, só a
   chamada de IA (que exige a chave) vai pro servidor.

Internamente, a function chama um módulo compartilhado de resolução de chave/provider
(extraído de `ai-assistant`, não duplicado — `ai-assistant` exige JWT de sessão ativa, o
que não existe no modo agendado, por isso a lógica de resolver BYOLLM vira função
utilitária chamada pelas duas, cada uma com seu próprio modelo de autenticação) e grava o
resultado em `agent_actions` com `automation_id` e `created_by` = dono do agente (não
quem/o que disparou o evento).

**Limite de execução**: antes de chamar a IA, conta quantas linhas em `agent_actions` esse
`automation_id` já gerou nas últimas 24h. Teto de 50/dia, fixo no código da
`agent-runner` — não é campo configurável em nenhuma tela, ninguém consegue elevar isso
pela UI. Ao atingir o teto, a automação recebe `paused_reason = "Limite diário de
execuções atingido"` e para até o dia seguinte.

### Falha de chave e pausa visível

Se a chave do criador falhar (revogada, usuário desligado, sem crédito), a
`agent-runner` seta `paused_reason` e não tenta de novo sozinha — sem retry silencioso.
Qualquer automação com `paused_reason` preenchido mostra um badge com o token
`--warning`/`--warning-bg` (é pendência de configuração, não erro de quem usa o
formulário — mesma distinção já usada no resto da plataforma) visível pra qualquer
manager/admin do módulo, não só pro criador. Resolver exige ação explícita: o criador
corrige a chave, ou outro manager assume o agente com a própria chave.

### `agent-gateway` / n8n (SDR-Q, SCOUT, CADÊNCIA, SENTINELA, CROSS)

Ficam como estão. Continuam publicando em `agent_actions` pelo caminho de hoje
(`X-Agent-Key`, orquestrado no n8n). Os dois caminhos já convergem na mesma tabela de
destino — se algum desses 5 se mostrar simples o bastante pra virar uma automação no
mecanismo novo, a migração é incremental e decidida depois; não é trabalho deste PRD.

### Onde os dados moram: mapeamento módulo → tabela

`evaluateAutomations` hoje só é chamado de dois lugares (`App.jsx` pro CRM,
`MarketingView.jsx` pro Marketing) e assume um registro "formato lead" (`stage`,
`stageChangedAt`, `companyId`). Fornecedores de RH não é um board Kanban, não tem
`stage`, e nenhuma tela chama `evaluateAutomations` hoje ali. Isso separa os dois modos
de disparo por capacidade real:

- **Por evento** só funciona em boards que já são Kanban (Recrutamento, Onboarding,
  Treinamentos, Avaliação de Desempenho, Férias — todos sobre `rh_pipeline_stages`) — e
  mesmo esses exigem plugar uma chamada nova a `evaluateAutomations` na respectiva view,
  que não existe hoje pra nenhum board de RH.
- **Agendado** não depende de tela aberta, mas a `agent-runner` precisa saber em que
  tabela procurar. Em vez de um conector genérico pra "qualquer tabela", um registro
  pequeno e explícito no código da function (`módulo → tabela + campos permitidos`),
  com uma entrada adicionada por vez conforme cada módulo é plugado. Primeira entrada:
  `rh_fornecedores` → `rh_fornecedor_contratos`.

Consequência pro escopo do piloto (seção 2): o caso de uso mais forte de RH (contrato
vencendo) só é viável pelo caminho agendado.

### RLS / permissões

Criar ou editar uma automação com `then_action = suggest_with_ai` exige papel de
manager/admin do módulo correspondente — mesmo mecanismo de `module-access.js`/
`current_user_has_module()` já usado pra esconder item de menu, estendido como gate de
escrita nessa ação específica. Colaborador comum continua vendo e agindo sobre ações em
`agent_actions` que já tocam ele (igual hoje), mas não cria agente novo.

## 5. Fora de escopo & riscos

[A escrever]

## 6. Critérios de sucesso do piloto & rollout

[A escrever]
