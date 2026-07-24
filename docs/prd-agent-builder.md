# PRD — Agent Builder: agentes de IA com governança, dentro da plataforma

Status: rascunho
Piloto: RH

## 1. Problema & Decisão

[A escrever]

## 2. Escopo do piloto — RH primeiro

**Quem participa**: sem lista fechada de convidados — qualquer gerente/admin de RH já
pode criar e testar um agente assim que a feature for ao ar. O que contém o risco nessa
fase não é restringir quem usa, é restringir o quê dá pra usar.

O piloto tem duas fases dentro do mesmo "RH primeiro" — não porque uma seja mais
importante, mas porque usam caminhos de disparo com custo de engenharia diferente (ver
seção 4). Fase 2 só começa depois que a Fase 1 estiver rodando de verdade.

### Fase 1 — Fornecedores (caminho agendado, baseado em prazo/data)

- Uma fonte de dados só: Contratos de fornecedores (RH) — `rh_fornecedor_contratos`.
- Gatilho é sempre "baseado em data" (ex: `vigenciaFim` se aproximando) — verificado
  todo dia pela `agent-runner`, sem depender de ninguém com a tela aberta e sem precisar
  de board Kanban. **Isso já cobre o caso do prazo de contrato** — não é uma limitação,
  é o caminho certo pra esse tipo de gatilho.
- Assistente guiado dentro de `AutomationsView` + atalho contextual em
  `RHFornecedoresView`.
- Dois tipos de rascunho: "e-mail pro fornecedor" e "aviso interno pro time".
- Preview obrigatório antes de ativar; pausa automática por falha de chave; limite de
  50 execuções/dia por agente.
- RLS: só manager/admin de RH cria agente; qualquer manager de RH vê e aprova as
  sugestões geradas (mesma regra que `agent_actions` já usa hoje).

**Exemplo ponta a ponta** (o caso que motivou este PRD): o contrato do "wellhub" vence
em 23/07. Um gerente de RH cria um agente "avisar 15 dias antes do vencimento", tipo de
rascunho "e-mail pro fornecedor", tom cordial. Todo dia, a `agent-runner` verifica os
contratos ativos; ao entrar na janela dos 15 dias, gera o rascunho e grava uma entrada
`pending` em `agent_actions`, visível pra qualquer manager de RH em `AgentActionsView`
pra aprovar, editar ou rejeitar antes de qualquer coisa sair da plataforma.

### Fase 2 — Recrutamento e Onboarding (caminho por evento, baseado em etapa)

Diferente de Fornecedores, Recrutamento (`rh_vagas`/`rh_candidatos`/`rh_aplicacoes`) e
Onboarding rodam sobre `rh_pipeline_stages` — são boards Kanban de verdade. Isso libera
o caminho por evento (`stage_change`, `time_in_stage`, igual ao motor que o CRM já usa),
mas exige plugar `evaluateAutomations` nessas duas telas — hoje só CRM e Marketing
chamam essa função, nenhuma tela de RH chama.

- Mesma ferramenta da Fase 1 (assistente guiado, preview, pausa, limite diário) — o que
  muda é só o tipo de gatilho disponível no passo 2 do assistente.
- Registro módulo → tabela (seção 4) ganha duas entradas novas:
  `rh_recrutamento` → `rh_aplicacoes`, `rh_onboarding` → o registro com
  `onboarding_stage`.
- **Exemplo Recrutamento**: quando um candidato se aplica, dispara a mesma triagem que
  já existe hoje sob o botão manual "Triar com IA" (`RHRecrutamentoView`) — só que
  automático, com o resultado indo pra aprovação em vez de aparecer direto na tela. Não
  reinventa o prompt de triagem, reaproveita o que já está em produção.
- **Exemplo Onboarding**: quando um colaborador entra na etapa "Documentação", IA monta
  um checklist personalizado com base no cargo, pra aprovação de quem conduz o
  onboarding.

**Prazo**: sem data de corte fixa — o piloto fica no ar até bater os critérios de
sucesso da seção 6. O raio de explosão já nasce pequeno (uma fonte de dados, limite
diário, aprovação humana obrigatória em toda sugestão), então não há urgência em
encerrar cedo por segurança.

## 3. Ferramenta de criação de agente

Premissa que guia toda esta seção: quem vai criar um agente é um gerente de RH, não
alguém de TI. A régua de qualidade é "impacto positivo já na primeira tentativa" — se
for confuso ou parecer "coisa de programador", a pessoa abandona e não volta.

### Reaproveita a tela, mas com um modo guiado novo

Continua sendo `AutomationsView` — mesma tabela, mesmo mecanismo de salvar, mesma lista.
O que muda: quando a ação escolhida é "Sugerir com IA", o modal de criação troca o
formulário técnico atual (campo cru de trigger, operadores tipo `eq`/`gt`, grupos de
condição) por um assistente guiado, passo a passo, em linguagem direta. Automações
comuns (`move_stage`, `set_field` etc.) continuam exatamente como estão hoje — só o
caminho de criar um agente de IA ganha essa camada nova por cima do mesmo motor.

### Entrada direta pela tela onde o problema mora

Além do link central em "Automações", `RHFornecedoresView` ganha um atalho ("Criar
agente de IA para este cadastro") que abre o assistente já com a fonte de dados
pré-selecionada. Ninguém deveria precisar sair de Fornecedores, achar o menu
"Automações" e entender o que é "módulo" pra chegar no mesmo lugar.

### O assistente, passo a passo

1. **O que observar** — no piloto, uma opção só, já selecionada: "Contratos de
   fornecedores (RH)". Nada de dropdown fingindo suportar módulos que ainda não existem.
2. **Quando agir** — pergunta única, em português: "Avisar quantos dias antes do
   contrato vencer?" (número). Por trás, isso monta o `trigger` do tipo
   `date_approaching` sobre `vigenciaFim` — o usuário nunca vê esses nomes técnicos.
   Um link discreto "Adicionar filtro avançado" (colapsado por padrão) expõe
   `condition_groups` pra quem quiser restringir por tipo de fornecedor ou status —
   fica fora do caminho de quem só quer o caso simples.
3. **O que a IA deve preparar** — guiado, não texto livre solto:
   - Tipo de rascunho (dropdown com opções fixas no piloto: "E-mail pro fornecedor" /
     "Aviso interno pro time")
   - Tom (formal / direto / cordial)
   - Algo específico que a IA deve sempre mencionar (campo curto, opcional)
   A plataforma monta o prompt final combinando um template fixo por tipo de rascunho +
   tom + dados do registro (nome do fornecedor, dias até vencer, valor) + o texto
   opcional do usuário. Ninguém escreve prompt do zero — reduz o problema da "folha em
   branco" e mantém o resultado consistente entre agentes diferentes.
4. **Quem aprova** — não é uma pergunta. Reaproveita a regra que `agent_actions` já
   usa hoje (managers veem tudo, vendedor/colaborador só o que toca ele) — um passo a
   menos no assistente.
5. **Testar antes de ativar** — roda o agente contra um registro real (o contrato mais
   próximo de vencer, ou um exemplo se não houver nenhum) e mostra o rascunho que seria
   gerado, sem gravar em `agent_actions`. Só depois de ver e aceitar o resultado o botão
   "Ativar agente" fica disponível. Se o preview vier ruim, volta pro passo 3 e ajusta
   tom/instrução — não precisa recomeçar do zero.
6. **Nome** — sugerido automaticamente a partir das escolhas anteriores (ex: "Aviso de
   renovação — Fornecedores RH"), editável.

### Se não tem chave de IA configurada

O assistente deixa terminar e ativar mesmo assim — nasce com `paused_reason`
preenchido e um aviso em `--warning`/`--warning-bg` explicando exatamente o que falta
("Configure sua chave de IA em Configurações → Integrações de IA pra este agente
começar a rodar"), com atalho direto pra essa tela. Não bloqueia a criação, mas também
não finge que está tudo certo.

### Depois de criado: "Meus agentes de IA"

Dentro de `AutomationsView`, uma seção separada da lista de automações comuns —
cartão por agente, mostrando nome, status (ativo / pausado + motivo), quando rodou pela
última vez, e um link direto pras sugestões que ele já gerou (`AgentActionsView`
filtrado por `automation_id`). Editar reabre o mesmo assistente guiado com os valores
já preenchidos; pausar/reativar é um toggle simples.

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

- **Por evento** (`stage_change`, `time_in_stage` etc.) só funciona em boards que já são
  Kanban (Recrutamento, Onboarding, Treinamentos, Avaliação de Desempenho, Férias —
  todos sobre `rh_pipeline_stages`) — e mesmo esses exigem plugar uma chamada nova a
  `evaluateAutomations` na respectiva view, que não existe hoje pra nenhum board de RH.
- **Agendado** (`date_approaching` — baseado em campo de data, não em etapa) não
  depende de tela aberta nem de Kanban: a `agent-runner` varre a tabela direto todo dia.
  Precisa saber em que tabela procurar — em vez de um conector genérico pra "qualquer
  tabela", um registro pequeno e explícito no código da function
  (`módulo → tabela + campos permitidos`), com uma entrada adicionada por vez conforme
  cada módulo é plugado. Primeira entrada: `rh_fornecedores` → `rh_fornecedor_contratos`.

Os dois caminhos resolvem coisas diferentes, não são "básico vs. avançado": prazo de
contrato é `date_approaching` (agendado) mesmo depois do rollout completo — não precisa
de Kanban pra isso nunca. Consequência pro escopo do piloto (seção 2): Fase 1
(Fornecedores) usa só o caminho agendado; Fase 2 (Recrutamento/Onboarding, que são
Kanban) é o que introduz o caminho por evento.

### RLS / permissões

Criar ou editar uma automação com `then_action = suggest_with_ai` exige papel de
manager/admin do módulo correspondente — mesmo mecanismo de `module-access.js`/
`current_user_has_module()` já usado pra esconder item de menu, estendido como gate de
escrita nessa ação específica. Colaborador comum continua vendo e agindo sobre ações em
`agent_actions` que já tocam ele (igual hoje), mas não cria agente novo.

## 5. Fora de escopo & riscos

### Fora de escopo

- **Agentes multi-etapa.** O modelo é sempre 1 condição → 1 chamada de IA → 1
  aprovação. Encadear múltiplas chamadas ou múltiplas ferramentas (o que o n8n já faz
  pros 5 agentes atuais) não faz parte deste mecanismo.
- **Execução automática sem aprovação humana.** Nenhum agente criado por este builder
  manda e-mail, muda dado ou executa qualquer coisa sozinho — toda sugestão sempre para
  em `agent_actions` como `pending`.
- **Templates prontos pra copiar entre usuários.** Cada agente nasce do zero, criado por
  quem precisa dele. Uma biblioteca de modelos compartilháveis é ideia natural de
  próxima iteração, não deste PRD.
- **Migração dos 5 agentes do `agent-gateway`/n8n** (SDR-Q, SCOUT, CADÊNCIA, SENTINELA,
  CROSS). Ficam exatamente como estão (seção 4).
- **Conector genérico pra "qualquer tabela".** O registro módulo → tabela continua
  sendo uma entrada explícita por vez, nunca um sistema que aponta pra uma tabela
  arbitrária escolhida na hora.
- **Chave de IA paga pela empresa.** Hoje é sempre a chave pessoal de quem criou o
  agente. Centralizar isso numa chave/custo da empresa é possibilidade futura (ver
  risco abaixo), não decisão deste PRD.
- **Outros módulos além de RH** (Compras, Entregas, um segundo tipo de agente em
  CRM/Marketing) — isso é rollout, seção 6.
- **Dashboard de ROI/métricas dos agentes.** Fora de escopo aqui; os critérios de
  sucesso da seção 6 são deliberadamente simples, não um painel novo.

### Riscos

- **Custo pessoal, benefício coletivo.** A chave de quem criou o agente é debitada por
  um uso que beneficia o time inteiro — e se essa pessoa sair da empresa ou desativar a
  chave, o agente que outros dependem para de rodar (vira `paused_reason`, não
  silencioso, mas ainda assim é uma dependência de pessoa física). Não tem mitigação
  fechada neste PRD — é para acompanhar durante o piloto e decidir se compensa migrar
  pra uma chave paga pela empresa depois.
- **Fadiga de aprovação.** Se um agente gerar sugestões repetitivas ou de baixa
  qualidade, managers tendem a aprovar sem ler de verdade — esvazia o próprio sentido do
  human-in-the-loop. O preview obrigatório na criação (seção 3) e o limite de 50/dia
  (seção 4) reduzem volume, mas não garantem qualidade continuada. Vale medir taxa de
  rejeição/edição das sugestões como sinal — ver seção 6.
- **Pausa que ninguém percebe.** Hoje, um agente pausado (chave quebrada ou limite
  atingido) só aparece pra quem abre a tela de Automações. Se ninguém abrir por semanas,
  o agente fica parado sem que o time perceba que parou de ajudar. Este PRD não fecha a
  solução — quem implementar deve avaliar dar mais visibilidade a isso (ex: contagem de
  agentes pausados em algum lugar de maior tráfego).
- **Dado indo pra provedor de IA externo.** Prompts de agentes de RH (e depois
  Recrutamento/Onboarding) carregam dado de fornecedor, candidato ou colaborador pro
  provedor de LLM configurado (OpenAI/Anthropic/Gemini). Não é risco novo — é o mesmo
  modelo que já vale hoje pras outras features de IA da plataforma — mas vale ter em
  mente que o volume de dado sensível passando por esse caminho cresce com o rollout.

## 6. Critérios de sucesso do piloto & rollout

[A escrever]
