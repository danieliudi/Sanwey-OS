# Agent Builder — Passo 3 diferenciado por tipo de rascunho (Fornecedores RH)

Decisão com o Daniel em 26/07: os 2 tipos de rascunho do Passo 3 (`email_fornecedor` /
`aviso_interno`) hoje usam exatamente o mesmo formulário (`draftType` + `tone` +
`customInstruction`) — achado de QA confirmado em `AgentBuilderWizard.jsx:278-304`, e
intencional no PRD do piloto (`docs/prd-agent-builder.md`, seção "O que a IA deve
preparar": "a plataforma monta o prompt final combinando um template fixo por tipo de
rascunho + tom + dados do registro"). O Daniel decidiu agora ir além do piloto e
diferenciar de verdade os 2 tipos. Esta spec cobre os 4 itens do brainstorm, nesta ordem
de prioridade combinada com ele: (1) destinatário visível, (2) prazo de resposta, (3)
ação sugerida, (4) link direto pro fornecedor/contrato.

Classificação de custo por item (regra 5 do `CLAUDE.md` — mudança de schema real exige
confirmação explícita do Daniel antes de aplicar):

| # | Item | Custo |
|---|---|---|
| 1 | Destinatário visível | Zero schema — dado já existe (`rh_fornecedores.contact_name/email/phone`), só precisa entrar no `payload` (jsonb, já existente) do `agent_actions` e ser exibido |
| 2 | Prazo de resposta | JSON-only — chave nova em `thenActions[0]` (jsonb), sem migration |
| 3 | Ação sugerida | JSON-only — chave nova em `thenActions[0]` (jsonb), sem migration |
| 4 | Link direto pro fornecedor/contrato | Zero schema — `fornecedor_id`/`source_id` já estão no `payload` hoje; só falta UI + navegação |

Nenhum dos 4 itens requer tabela ou coluna nova. Se em algum momento a implementação
esbarrar em algo que pareça exigir coluna nova (ex.: quiser persistir "prazo de
resposta" como campo estruturado fora do JSON pra permitir filtro/relatório por ele),
isso é decisão de produto à parte — voltar a confirmar com o Daniel antes, não assumir.

---

## Investigação — como o fluxo de dados funciona hoje

Referências de código confirmadas antes de especificar (não assumidas):

- **`AgentBuilderWizard.jsx:96`**: `thenActions = [{ type: "suggest_with_ai", draftType, tone, customInstruction }]` — um objeto solto, sem shape fixo além de `type`. Qualquer chave nova aqui é aceita sem migration porque `then_actions` é a coluna jsonb `automations.then_actions` (`use-automations.js:73`, `ruleToRow`).
- **`AgentBuilderWizard.jsx:54`**: `initialThen = initialRule?.thenActions?.[0] || {}` — a edição já lê qualquer chave de volta do objeto salvo automaticamente; campos novos só precisam de um `useState(initialThen.novaChave || default)` espelhando o padrão de `tone`/`customInstruction` (linhas 61-63), nenhuma mudança estrutural no fluxo de edição.
- **`AgentBuilderWizard.jsx:100`**: `canNext` do step 2 hoje exige `draftType` e `tone`. Campos novos condicionais por tipo (itens 2 e 3) **não** devem entrar nessa validação — ambos são opcionais (mesmo espírito de `customInstruction`, que já é opcional).
- **`agent-runner/index.ts:49-73` (`buildPrompt`)**: já ramifica por `draftType` (`if (draftType === "aviso_interno") {...} else {...}`) — é literalmente o "template fixo por tipo" do PRD. Estender esse `if/else` com mais contexto por tipo é continuar o padrão existente, não reescrever a arquitetura.
- **`agent-runner/index.ts:116-127` (`findCandidateContracts`)**: o `select` já faz `*, rh_fornecedores(id, name, tipo)` — **não** traz `contact_name`, `email`, `phone` hoje. Precisa entrar nesse select (zero schema — as colunas já existem em `rh_fornecedores`, migration `20260716_rh_fornecedores_beneficios.sql:9-21`).
- **`agent-runner/index.ts:223-243` (grava a sugestão) e `260-327` (`runPreview`)**: o `payload` gravado em `agent_actions` hoje tem `source_table`, `source_id` (id do contrato), `fornecedor_id`, `fornecedor_nome`, `dias_para_vencer`, e por tipo `subject`/`draft_email` ou `recommended_action`. **`fornecedor_id` e `source_id` (id do contrato) já estão salvos** — item 4 não precisa de nenhum dado novo, só de UI que os use.
- **`AgentActionsView.jsx` / `ActionCard` (linhas 33-201)**: já lê `action.payload` direto (sem join — `agent_actions` não tem FK real pra `rh_fornecedores`, é só um id dentro do jsonb) e já tem um bloco dedicado a fornecedor RH nas linhas 72-84 (comentário explícito: *"Fornecedor de RH — sem lead_id, fica sem contexto nenhum no card fechado se não vier aqui"*). Os itens 1 e 4 estendem esse bloco e o corpo expandido (linhas 113-143), não criam uma seção nova.
- **`RHFornecedoresView.jsx:509,642,714`**: o drawer de detalhe do fornecedor abre via estado local `selectedId` (`setSelectedId(f.id)`), **sem** suporte a query-string nem deep-link vindo de outra tela hoje.
- **Padrão de handoff entre telas já existe no próprio módulo de agentes**: `AutomationsView.jsx:22,130` grava `sessionStorage.setItem("agentActionsFilterAutomationId", automationId)` antes de navegar, e `AgentActionsView.jsx:282-291` lê essa chave no mount. É o precedente direto a reaproveitar pro item 4 (ver especificação abaixo) em vez de inventar um mecanismo de navegação novo.

---

## Item 1 — Destinatário visível (e-mail pro fornecedor)

### Problema observado

`RHFornecedoresView.jsx`, `EMPTY_FORNECEDOR_FORM` (linha 62), já obriga `contactName` e
`email` no cadastro de fornecedor (validação linhas 81-83). Hoje, nem o
`AgentBuilderWizard` nem a tela de aprovação (`AgentActionsView.jsx`) usam esse dado —
um gerente de RH aprova um "rascunho de e-mail pro fornecedor" sem ver pra quem, de
fato, o e-mail vai (nome do contato, endereço, telefone). O dado existe desde a
criação do módulo de Fornecedores; só nunca foi puxado até aqui.

### Especificação visual

**Onde**: dois lugares, papéis diferentes.

**(a) Passo 3 do wizard — nota informativa, não um campo novo.** O wizard configura o
agente (a regra), não uma sugestão individual — ele não sabe ainda qual fornecedor vai
disparar a IA. Não faz sentido pedir pra escolher destinatário aqui. Em vez disso,
quando `draftType === "email_fornecedor"`, adicionar logo abaixo do select "Tipo de
rascunho" (`AgentBuilderWizard.jsx`, depois do bloco das linhas 280-285) uma nota
informativa, reaproveitando o mesmo componente visual já usado no Passo 1 e Passo 4
(`rounded-xl border`, `borderColor: var(--border)`, `background: var(--surface-alt)`,
ícone `Info` de `lucide-react` — já importado no arquivo, linha 3):

```jsx
<div
  className="rounded-xl border px-3.5 py-3 flex items-start gap-2.5"
  style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
>
  <Info size={13} style={{ color: "var(--text-dim)", marginTop: 1 }} className="shrink-0" />
  <p className="text-xs" style={{ color: "var(--text-dim)" }}>
    O e-mail vai usar o contato cadastrado em Fornecedores (nome, e-mail e telefone) —
    quem aprovar a sugestão vê pra quem vai antes de confirmar.
  </p>
</div>
```

**(b) `AgentActionsView.jsx`, `ActionCard` — bloco de destinatário, o que de fato
resolve o problema.** Dentro do corpo expandido (`ActionCard.jsx`, junto ao bloco
"Assunto" das linhas 115-123), acima do "Assunto", um bloco compacto de destinatário —
só quando `action.action_type === "email_fornecedor"` e existe ao menos um dos três
campos:

```jsx
{action.action_type === "email_fornecedor" &&
  (payload.fornecedor_contact_name || payload.fornecedor_email || payload.fornecedor_phone) && (
  <div className="px-3 pt-3 pb-1.5 flex items-start gap-2 border-b" style={{ borderColor: "var(--border)" }}>
    <Mail size={11} style={{ color: agent.color, marginTop: 2 }} className="shrink-0" />
    <div className="text-xs leading-relaxed">
      <span className="font-bold" style={{ color: "var(--text-dim)" }}>Destinatário: </span>
      {payload.fornecedor_contact_name && (
        <span style={{ color: "var(--text)" }}>{payload.fornecedor_contact_name}</span>
      )}
      {payload.fornecedor_email && (
        <span style={{ color: "var(--text-dim)" }}>
          {payload.fornecedor_contact_name ? " · " : ""}{payload.fornecedor_email}
        </span>
      )}
      {payload.fornecedor_phone && (
        <span style={{ color: "var(--text-dim)" }}> · {payload.fornecedor_phone}</span>
      )}
    </div>
  </div>
)}
```

Token de cor: reaproveita `agent.color` (já usado pro ícone `Mail` do "Assunto" logo
abaixo, linha 117) — sem hex novo. Nenhum estado de erro/hover aplicável (bloco
estático, texto).

### Dados — de onde vem, o que precisa mudar

`payload` (jsonb) hoje **não** tem `fornecedor_email`/`fornecedor_contact_name`/
`fornecedor_phone` — só `fornecedor_id`/`fornecedor_nome`. Duas formas de resolver,
avaliadas:

- **Opção A (escolhida) — snapshot no momento da geração.** `agent-runner/index.ts`:
  1. `findCandidateContracts` (linha 119) passa a selecionar
     `rh_fornecedores(id, name, tipo, contact_name, email, phone)` em vez de só
     `id, name, tipo`.
  2. `runSweep` (payload gravado, linhas 230-239) e `runPreview` (resposta JSON,
     linhas 314-323) passam a incluir `fornecedor_contact_name`, `fornecedor_email`,
     `fornecedor_phone` a partir de `fornecedor.contact_name`/`fornecedor.email`/
     `fornecedor.phone`.
  - Zero coluna nova (`payload` já é jsonb; `rh_fornecedores.contact_name/email/phone`
    já existem). Fica gravado como parte do histórico da sugestão — mesmo se o
    fornecedor for editado ou removido depois, a sugestão continua mostrando o
    destinatário de quando foi gerada (rastreável, auditável).
- **Opção B (rejeitada) — busca ao vivo no client.** `AgentActionsView.jsx` faria uma
  query adicional em `rh_fornecedores` usando os `fornecedor_id`s presentes nas ações
  carregadas, e faria o merge client-side (não dá pra usar o embed automático do
  PostgREST tipo `leads(...)` da linha 320, porque `fornecedor_id` vive dentro do
  jsonb `payload`, não é uma coluna real com FK). Mostraria sempre o dado mais
  recente, mas (a) mais uma rodada de rede por carregamento da tela, e (b) quebra se
  o fornecedor for excluído depois de a sugestão ser gerada (contrato real: RH pode
  descadastrar um fornecedor após renovar com outro, mas a sugestão antiga de
  aprovação continua na aba "Aprovados"/"Rejeitados").
  - **Por que a Opção A venceu**: o campo "Destinatário" aqui serve pra decisão de
    aprovação — quem aprova precisa saber pra quem *aquele e-mail específico* vai,
    não o cadastro atual. Snapshot é o comportamento certo mesmo se divergir depois
    (é auditoria, não um link ao vivo).

### Comportamento

- Nota do wizard (a) aparece só quando `draftType === "email_fornecedor"`; some
  imediatamente ao trocar pra `aviso_interno` (mesmo padrão reativo já usado por
  `tone`/`customInstruction`, sem debounce).
- Bloco de destinatário (b) aparece só dentro do corpo expandido do card
  (`expanded === true`, mesmo gate que já existe pro assunto/draft, linha 100), e só
  se `action_type === "email_fornecedor"` — cards de `aviso_interno` nunca mostram
  esse bloco (não tem destinatário externo).
- Se o fornecedor não tiver `contactName`/`email`/`phone` preenchidos no momento da
  geração (não deveria acontecer — são obrigatórios no cadastro, mas registros
  criados antes da obrigatoriedade podem existir), o bloco inteiro não renderiza (a
  mesma guarda condicional do JSX acima já cobre isso) — nunca mostra "Destinatário:"
  com nada na frente.

---

## Item 2 — Prazo de resposta (e-mail pro fornecedor)

### Problema observado

O e-mail gerado hoje (`agent-runner/index.ts:69-72`) não tem prazo nenhum — o corpo
termina sem pedir uma data de retorno, forçando quem aprova a editar manualmente
sempre que quiser cobrar uma confirmação.

### Especificação visual

Novo campo no Passo 3, **só quando `draftType === "email_fornecedor"`**, logo abaixo
do campo "Tom" (`AgentBuilderWizard.jsx`, depois do bloco das linhas 286-291) e acima
de "Algo específico que a IA deve sempre mencionar":

```jsx
{draftType === "email_fornecedor" && (
  <div>
    <label style={labelSt}>Pedir confirmação em até quantos dias?</label>
    <input
      type="number"
      min="1"
      value={followUpDays}
      onChange={e => setFollowUpDays(e.target.value)}
      className={inputCls}
      style={inputSt}
    />
  </div>
)}
```

Reaproveita `labelSt`/`inputCls`/`inputSt` (linhas 43-45) — mesmo tratamento visual de
"Avisar quantos dias antes do contrato vencer?" no Passo 2. Sem placeholder (o valor
já vem preenchido por default, ver Comportamento).

### Estado / dados

- Novo state: `const [followUpDays, setFollowUpDays] = useState(initialThen.followUpDays ?? 5);`
  — junto aos demais `useState` de step 2 (perto da linha 62-63).
- Entra em `thenActions`: `thenActions = [{ type: "suggest_with_ai", draftType, tone, customInstruction: ..., followUpDays: draftType === "email_fornecedor" ? Number(followUpDays) || 5 : undefined }]`
  — `undefined` não persiste chave no jsonb quando o tipo é `aviso_interno` (evita
  salvar um prazo sem sentido pro tipo errado).
- `agent-runner/index.ts`, `buildPrompt` (linhas 49-73): adicionar `followUpDays` à
  assinatura da função e, no ramo `email_fornecedor` (linha 68-72), inserir no
  `system` prompt algo como: `... Feche o e-mail pedindo confirmação em até
  ${followUpDays ?? 5} dia(s) úteis.` — string interpolada no prompt, não no
  `contexto` (é instrução de tom/estrutura, não dado do registro).
- `runSweep` (linha 196) e `runPreview` (linha 300) passam `action.followUpDays` pra
  `buildPrompt`.

### Comportamento

- Campo só existe/aparece quando `draftType === "email_fornecedor"`; ao trocar pra
  `aviso_interno`, o campo some (mesmo tratamento condicional do item 1a) e o valor em
  memória não é enviado no `thenActions` daquele save.
- Campo é **opcional na prática mas sempre visível com default 5** (não é
  "opcional deixado em branco" como `customInstruction` — é um número que sempre faz
  sentido ter um valor, então nasce preenchido em vez de vazio). Não entra em
  `canNext` (linha 100) — não bloqueia avançar mesmo que o usuário zere o campo (nesse
  caso, `agent-runner` cai no fallback `?? 5` do prompt).
- Editar um agente existente (`initialRule`) que foi criado antes deste campo existir:
  `initialThen.followUpDays` é `undefined` → `useState` usa o default `5` — mesmo
  comportamento de qualquer chave nova em objeto salvo antigo, nenhuma migração de
  dado necessária.

### Notas de decisão subjetiva

- **Rótulo exato do campo**: consideradas 3 opções — *"Prazo de resposta (dias)"*
  (técnico, mas ambíguo sobre o que conta como resposta), *"Cobrar confirmação em
  quantos dias?"* (direto mas "cobrar" soa agressivo pro tom "cordial"), e a
  escolhida, *"Pedir confirmação em até quantos dias?"* — mantém o verbo "pedir" (mais
  alinhado a tom cordial/formal) e "até" deixa claro que é um prazo-teto, não uma data
  fixa. Segue o mesmo padrão de fraseado de pergunta direta já usado no campo mais
  parecido do wizard, "Avisar quantos dias antes do contrato vencer?" (Passo 2).
- **Default de 5 dias**: não há requisito de negócio explícito; escolhido por ser um
  prazo comum de resposta comercial (1 semana útil, menos 2 dias de folga). Se o
  Daniel tiver uma preferência de política (ex.: sempre 3 dias, ou variar por tipo de
  fornecedor), é trivial trocar o literal `5` nos dois lugares (`useState` e fallback
  do prompt) sem qualquer outra mudança.
- **Chave `followUpDays` vs. `confirmationDeadlineDays`**: escolhi o nome mais curto
  por consistência com o estilo já usado no objeto (`draftType`, `customInstruction`)
  — nomes descritivos únicos, sem prefixo por domínio.

---

## Item 3 — Ação sugerida (aviso interno pro time)

### Problema observado

O aviso interno gerado hoje (`agent-runner/index.ts:62-66`) só produz `title` +
`recommended_action` livres, decididos inteiramente pela IA a partir do contexto — não
existe forma de o gerente que configurou o agente pré-definir qual ação de negócio
default o time deve considerar (renovar, cotar alternativa, só observar).

### Especificação visual

Novo campo no Passo 3, **só quando `draftType === "aviso_interno"`**, na mesma posição
relativa que o campo do item 2 ocupa pro outro tipo (logo abaixo de "Tom"):

```jsx
{draftType === "aviso_interno" && (
  <div>
    <label style={labelSt}>Ação sugerida</label>
    <select value={suggestedAction} onChange={e => setSuggestedAction(e.target.value)} className={inputCls} style={inputSt}>
      {SUGGESTED_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
    </select>
  </div>
)}
```

com

```js
const SUGGESTED_ACTIONS = [
  { id: "iniciar_renovacao", label: "Iniciar renovação" },
  { id: "buscar_cotacao",    label: "Buscar cotação alternativa" },
  { id: "so_monitorar",      label: "Só monitorar" },
];
```

declarado junto a `DRAFT_TYPES`/`TONES` (linhas 26-35).

### Estado / dados

- `const [suggestedAction, setSuggestedAction] = useState(initialThen.suggestedAction || "iniciar_renovacao");`
- `thenActions`: adicionar `suggestedAction: draftType === "aviso_interno" ? suggestedAction : undefined`.
- `agent-runner/index.ts`, `buildPrompt`: no ramo `aviso_interno` (linhas 62-67),
  incluir no `system` prompt (não no `contexto`, pois é instrução de conteúdo, não
  dado do registro): mapear `suggestedAction` pro rótulo em português (mesma técnica
  de `TONE_LABEL`, linhas 43-47) e instruir a IA a mencionar essa ação explicitamente,
  ex.: `... Considere que a ação recomendada pelo gerente é "${ACTION_LABEL[suggestedAction]}" — mencione isso claramente em recommended_action, adaptando a redação ao contexto do contrato, sem inventar uma ação diferente.`
- `runSweep`/`runPreview` passam `action.suggestedAction` pra `buildPrompt`, mesmo
  padrão do item 2.

### Comportamento

- Campo só aparece quando `draftType === "aviso_interno"`; some ao trocar pra
  `email_fornecedor`.
- Tem default sempre preenchido (`iniciar_renovacao`) — dropdown, não texto livre,
  então não existe estado "vazio" a considerar; não entra em `canNext`.
- Edição de agente antigo sem essa chave: mesmo comportamento do item 2 (`|| "iniciar_renovacao"` cobre `undefined`).

### Notas de decisão subjetiva

- **As 3 opções exatas do dropdown**: vieram do brainstorm já fornecido na tarefa
  ("Iniciar renovação" / "Buscar cotação alternativa" / "Só monitorar") — não
  inventei opções novas. Ordem escolhida (mais proativa → mais passiva) segue a
  lógica de leitura natural de um dropdown de ação recomendada; ordem alfabética foi
  considerada e descartada por ficar contra-intuitiva ("Buscar cotação" antes de
  "Iniciar renovação" mesmo sendo a alternativa, não a ação principal).
- **Dropdown fixo vs. texto livre**: o brainstorm já pede "dropdown curto" — segui
  literalmente. Uma variante possível seria permitir customizar as opções por
  empresa/fornecedor (ex.: um 4º valor específico de RH), mas isso teria que virar
  configuração em tabela (fora de escopo — nenhuma tabela de "tipos de ação" existe
  hoje) e não foi pedido; as 3 opções fixas cobrem o brainstorm como está.
- **Instruir a IA a "mencionar claramente" em vez de literalmente inserir o rótulo
  fixo como primeira frase**: optei por deixar a IA integrar a ação recomendada à
  narrativa do aviso (mais natural) em vez de forçar um template rígido tipo "AÇÃO
  RECOMENDADA: {label}" no topo do texto. Se o Daniel preferir a força bruta de
  sempre abrir com o rótulo fixo (mais fácil de escanear, mas mais robótico), é uma
  troca de uma linha no prompt — sinalizando aqui como alternativa válida, não a
  escolhida.

---

## Item 4 — Link direto pro card do fornecedor/contrato (aviso interno)

### Problema observado

O aviso interno hoje não referencia de forma alguma o registro de origem — quem lê o
aviso em "Time de Agentes" (`AgentActionsView.jsx`) não tem como pular direto pro
cadastro do fornecedor/contrato pra agir, precisa navegar manualmente até
`RHFornecedoresView` e localizar o fornecedor certo (potencialmente vários fornecedores
do mesmo tipo, ex. "Convênio médico").

### Decisão de design: link como elemento de UI clicável, não texto embutido no aviso gerado pela IA

O brainstorm original pede o link "dentro do texto do aviso". Duas formas de
interpretar isso, avaliadas:

- **Opção A (rejeitada) — pedir pra IA embutir uma URL no texto de
  `recommended_action`.** Problema real: o texto de `recommended_action` é
  100% gerado pelo modelo de IA (`callAIProvider`, `agent-runner/index.ts:206-212`) —
  não há garantia de que a URL sobreviva inalterada num JSON de saída de LLM (risco
  de a IA reescrever, truncar ou "alucinar" parte do link), e o `ActionCard` hoje
  renderiza esse texto como `whitespace-pre-wrap` puro (`AgentActionsView.jsx:137-139`),
  **sem** parsing de markdown/links — um link em texto puro não vira clicável de
  qualquer forma, ficaria como string morta.
- **Opção B (escolhida) — link deterministicamente calculado pelo `agent-runner`
  (não pela IA) e renderizado como elemento de UI separado no `ActionCard`**, do
  mesmo jeito que o item 1 já expõe destinatário como bloco de UI e não como texto
  dentro do rascunho. Cumpre a intenção do brainstorm (acesso rápido ao registro,
  "dentro do card do aviso") sem depender da IA acertar uma URL.

Escolhida a Opção B — consistente com o tratamento já dado ao item 1.

### Especificação visual

Dentro do `ActionCard`, no corpo expandido, **abaixo** do bloco "Próximo passo"
existente (`recommended_action`, linhas 134-141), só quando
`action.action_type === "aviso_interno"` e `payload.fornecedor_id` existe:

```jsx
{action.action_type === "aviso_interno" && payload.fornecedor_id && (
  <div className="px-3 pb-3">
    <button
      onClick={() => onOpenFornecedor(payload.fornecedor_id)}
      className="flex items-center gap-1.5 text-xs font-semibold"
      style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <ExternalLink size={11} />
      Ver fornecedor{payload.fornecedor_nome ? ` — ${payload.fornecedor_nome}` : ""}
    </button>
  </div>
)}
```

(`ExternalLink` de `lucide-react`, importar junto aos demais ícones no topo do
arquivo.) Token de cor `var(--accent)` — mesmo padrão de todo link de ação secundária
já usado no arquivo (ex. "Ver todos os agentes", linha 512).

### Navegação — reaproveitando o padrão já existente no mesmo módulo

`onOpenFornecedor` (prop nova de `ActionCard`, repassada por `AgentActionsView`) segue
**exatamente** o mecanismo de handoff via `sessionStorage` já usado por
`AutomationsView.jsx:130` → `AgentActionsView.jsx:282-291` (mesmo módulo de agentes,
mesmo autor do padrão) — não inventa um mecanismo de navegação novo:

1. `AgentActionsView.jsx`: `onOpenFornecedor = (fornecedorId) => { sessionStorage.setItem("rhFornecedoresOpenId", fornecedorId); navigate(ROUTES["rh-fornecedores"]); }` (`navigate` via `useNavigate`, mesmo import já usado em `AgentBuilderWizard.jsx:2`; `AgentActionsView.jsx` precisa importar `useNavigate`/`ROUTES` — hoje não importa nenhum dos dois).
2. `RHFornecedoresView.jsx`: no mount, ler `sessionStorage.getItem("rhFornecedoresOpenId")`, se existir chamar `setSelectedId(id)` (linha 509) e limpar a chave — mesmo padrão de leitura/limpeza do `useState` inicial de `filterAutomationId` (`AgentActionsView.jsx:282-291`).

Isso é código de app (dois arquivos `.jsx`), não schema — mas está fora do escopo do
Passo 3 do wizard em si (a tarefa já sinalizou isso: "não necessariamente no wizard,
já que o wizard só configura o agente"). Documentado aqui pra o frontend-agent saber
exatamente qual o padrão a seguir sem reinventar.

### Dados

`payload.fornecedor_id` (já gravado hoje, `agent-runner/index.ts:233`) e
`payload.source_id`/`payload.source_table` (id do contrato, já gravado hoje, linhas
231-232) são suficientes — nenhuma chave nova em `payload`, nenhuma mudança em
`agent-runner`. Único ajuste possível, se o Daniel quiser abrir direto no contrato
(não só no fornecedor): `RHFornecedoresView` teria que, além de abrir o
`FornecedorDrawer`, também dar scroll/destaque ao contrato específico dentro dele
(`fornecedorContratos`, linha 364) — não implementado nesta spec por não ter sido
pedido explicitamente no brainstorm ("card do fornecedor/contrato" foi lido como "o
card, que é onde o contrato mora dentro do drawer", já que não existe tela própria de
contrato fora do drawer do fornecedor hoje).

### Comportamento

- Link só aparece em avisos internos (`action_type === "aviso_interno"`) — e-mails pro
  fornecedor não têm esse link (fariam sentido um link pro fornecedor também, mas não
  foi pedido no brainstorm pra este tipo; o destinatário já cobre a identificação
  nesse caso).
- Clique navega para `/rh/fornecedores` e abre o drawer do fornecedor já focado,
  sem esperar o usuário localizar a linha manualmente na tabela.
- Se `fornecedor_id` não existir no payload (sugestões antigas geradas antes deste
  ajuste — não deveria acontecer, já que o campo é gravado desde a criação do
  Agent Builder, mas por segurança), o bloco inteiro não renderiza.

---

## Resumo de impacto por arquivo (pra frontend-agent, não implementar aqui)

| Arquivo | Mudança |
|---|---|
| `src/components/agents/AgentBuilderWizard.jsx` | Item 1a (nota informativa), item 2 (campo prazo), item 3 (campo ação sugerida) — tudo dentro do bloco `step === 2` |
| `supabase/functions/agent-runner/index.ts` | Item 1 (select de `contact_name/email/phone` + gravar no payload), item 2 e 3 (`buildPrompt` recebe e usa `followUpDays`/`suggestedAction`) — **e replicar a mesma mudança em `supabase/functions/agent-runner/_shared/` se aplicável e em qualquer cópia física do módulo, conforme já documentado no cabeçalho do arquivo (linhas 1-6)** |
| `src/components/views/AgentActionsView.jsx` | Item 1 (bloco destinatário no `ActionCard`), item 4 (botão "Ver fornecedor" + `onOpenFornecedor` via `sessionStorage`) |
| `src/components/views/RHFornecedoresView.jsx` | Item 4 (ler `sessionStorage` no mount e abrir `FornecedorDrawer` automaticamente) |

Nenhuma migration SQL nesta spec. Se a implementação real revelar necessidade de
schema novo (ex.: querer relatório agregado de "quantos avisos com ação X foram
aprovados"), isso exige confirmação explícita do Daniel antes — não incluído aqui.
