# Passagem de bastão — passivo do gate de consistência

**Para:** outra sessão do Claude Code neste repositório (`danieliudi/sanwey-crm`).
**Branch:** `claude/sidebar-employees-sorting-pvtef1`.
**Status:** o gate já está no ar (commit `12b99da`). O que falta é o **passivo** que ele expôs, mais dois itens de infraestrutura. Nada aqui depende de redescobrir contexto: os arquivos, os gabaritos e o critério de pronto estão todos abaixo.

---

## ⚠️ Estado em 28/08/2026 — as 4 tarefas foram executadas

Este documento continua valendo como **registro do racional**, mas o trabalho
já foi feito. Não recomece do zero; confira o que está abaixo antes.

| Tarefa | Estado | Onde |
|---|---|---|
| 1 — `guarda-obsoleta` | **Feita.** 32 dos 33 sítios convertidos. | commit `4c61e1d` |
| 3 — sub-agentes | **Feita.** Os 4 existem e estão versionados. | commit `a6bf5a0` |
| 2 — `update-sem-select` | **Feita.** 61 dos 67 convertidos, 6 documentados como não-aplicáveis. | ver commit da Tarefa 2 |
| 4 — RLS no CI | **Metade.** Matriz atualizada; o secret ainda depende do Daniel. | ver commit da Tarefa 4 |

**Linha de base:** de 100 violações conhecidas para 7 (as 6 da Tarefa 2 mais o
`FeatureSpotlight.jsx` da Tarefa 1) — todas com comentário no próprio arquivo
explicando por que ficaram.

**Correção de fato aplicada ao `CLAUDE.md` durante a Tarefa 3:** a regra 3
mandava rodar `npx vite build` antes de reportar pronto, e este documento
repete isso na Tarefa 3 ("roda `npx vite build` (que agora dispara o
check)"). **Não dispara.** O gate está no `prebuild` do `package.json`, que é
hook de ciclo de vida do npm: `npx vite build` chama o Vite direto e passa por
cima em silêncio. Verificado em 28/08/2026 rodando os dois lado a lado. O
`CLAUDE.md` e os agentes agora dizem `npm run build`; este documento fica com
o texto original de propósito, como registro de onde o engano estava.

**O que sobrou de fato pendente:**

1. **Tarefa 4, passo 1 — configurar o secret `RLS_TEST_DATABASE_URL`.**
   Depende do Daniel. Apontar pra **branch ou staging** do Supabase, nunca
   produção. Enquanto não existir, o job de CI avisa e passa (inerte).
2. **A regra `guarda-obsoleta` tem uma classe de falso positivo** conhecida
   (ref resetado no topo do efeito em vez de desligado no cleanup — é o caso
   do `FeatureSpotlight.jsx`). Dá pra estreitar exigindo que o `= false`
   esteja dentro da função de cleanup retornada. Não foi feito: alterar o
   checker é entrega diferente da de baixar a catraca, e o doc já prescrevia
   comentar e manter na base.

Leia o `CLAUDE.md` da raiz antes de começar — ele governa este repositório e tem precedência sobre este documento em qualquer conflito.

---

## Contexto em 5 linhas

O único gate automatizado da plataforma era o `vite build`, que pega import quebrado e erro de sintaxe — e mais nada. O problema real nunca foi falta de revisão (o processo de 4 papéis do `CLAUDE.md` acha bug de verdade); é que ele **não propaga**: acha a causa raiz num arquivo e as outras N ocorrências ficam de pé. Em 28/08/2026 foi criado `scripts/check-consistencia.mjs` pra fechar exatamente essa lacuna. Ele roda no `prebuild` e no CI, e trabalha por **catraca**: `scripts/consistencia-baseline.json` guarda a contagem de violações conhecidas por arquivo, e a conferência só reprova quando o número **cresce**.

Este documento é a lista do que consertar pra baixar essa catraca.

**Comandos:**
```bash
npm run check                                   # lista todas as violações
node scripts/check-consistencia.mjs             # confere contra a linha de base (exit 1 se piorou)
node scripts/check-consistencia.mjs --baseline  # regrava a linha de base (depois de consertar)
npx vite build                                  # obrigatório antes de reportar pronto
```

Estado inicial: **100 violações conhecidas** — 67 `update-sem-select`, 33 `guarda-obsoleta`.

---

## Tarefa 1 — `guarda-obsoleta` (33 sítios)

### O bug

O padrão errado, presente hoje em 33 arquivos:

```js
const activeRef = useRef(true);

const fetchAll = useCallback(async () => {
  const { data } = await supabase.from("x").select("*");
  if (!activeRef.current) return;      // <-- guarda inútil
  setRows(data);
}, [deps]);

useEffect(() => {
  activeRef.current = true;            // <-- religa
  fetchAll();
  return () => { activeRef.current = false; };
}, [deps]);
```

O `ref` é único **da instância do hook**, não **da execução do efeito**. Quando `deps` muda (trocar de canal, de usuário, de board), o React roda o cleanup do efeito antigo e o corpo do efeito novo **no mesmo commit**: o cleanup põe `false`, e o efeito novo põe `true` logo em seguida. Se o fetch do efeito ANTIGO resolver depois disso, a guarda passa e ele planta o dado errado na tela.

Isso não é teórico: foi diagnosticado em `src/hooks/use-chat.js` (comentário nas linhas ~335-341) depois de um bug real de abrir uma conversa e ver a anterior.

### O gabarito

`src/hooks/use-chat.js`, função `useChannelMessages` (~linha 360). Leia esse arquivo inteiro antes de tocar em qualquer outro — ele é a referência canônica.

```js
// A função de fetch recebe a guarda como parâmetro, com default seguro
// pra não quebrar chamadas de fora do efeito (ex.: refetch manual).
const fetchAll = useCallback(async (isActive = () => true) => {
  const { data } = await supabase.from("x").select("*");
  if (!isActive()) return;
  setRows(data);
}, [deps]);

useEffect(() => {
  let active = true;                   // <-- por execução do efeito
  fetchAll(() => active);
  const canal = supabase.channel(nome).on("postgres_changes", {...}, () => {
    if (!active) return;
    fetchAll(() => active);
  }).subscribe();
  return () => { active = false; supabase.removeChannel(canal); };
}, [deps]);
```

Pontos de atenção, todos vistos no `use-chat.js`:

- **Todo** `setState` dentro do fetch assíncrono passa a checar `isActive()`, inclusive o `setLoading(false)` do `finally` e o `setError` do `catch`.
- O callback do Realtime também checa `active`, não o ref.
- `fetchAll` é frequentemente devolvido no retorno do hook como `refetch` — por isso o default `() => true`, senão o refetch manual vira no-op.
- Quando o hook zera a lista ao trocar de escopo, faça isso **antes** do fetch (síncrono, no corpo do efeito), não dentro do `.then`. Foi um bug separado no chat: a thread abria mostrando a conversa anterior durante todo o fetch.

### Os 33 sítios

Confira sempre com `npm run check`; a lista abaixo é a de 28/08/2026 e as linhas mudam conforme você edita.

**Lote A — hooks de CRM/Comercial (10)**
`use-leads.js:198` · `use-clients.js:88` · `use-lead-history.js:84` · `use-single-lead-history.js:40` · `use-pipelines.js:71` · `use-pipeline-transitions.js:39` · `use-stage-fields.js:83` · `use-crm-viagens.js:23` · `use-crm-viagem-categorias.js:23` · `use-crm-viagem-prestacoes.js:31`

**Lote B — hooks de RH (14)**
`use-rh-bemestar.js:33` · `use-rh-cargo-templates.js:23` · `use-rh-colaboradores.js:117` · `use-rh-comunicacao.js:26` · `use-rh-feedback.js:25` · `use-rh-manager-links.js:32` · `use-rh-movimentacoes.js:26` · `use-rh-onboarding.js:28` · `use-rh-pipeline-stages.js:72` · `use-rh-recrutamento.js:86` · `use-rh-report-presets.js:25` · `use-rh-stage-fields.js:85` · `use-rh-stage-history.js:43` · `use-rh-treinamentos.js:36`

**Lote C — resto (9)**
`use-chat.js:113` (é o hook de topo `useChat`, que ainda usa `activeRef` pra lista de canais — o `useChannelMessages` do mesmo arquivo já está certo) · `use-profiles.js:86` · `use-automations.js:110` · `use-agent-runs-summary.js:35` · `use-invitations.js:49` · `use-marketing-budgets.js:73` · `use-crm-despesas.js:25` · `use-personal-task-stages.js:37` · `src/components/shared/FeatureSpotlight.jsx:99`

> `use-personal-task-stages.js` foi "corrigido" em 26/08 usando justamente o padrão errado. É o exemplo mais claro do problema de propagação — trate como qualquer outro.

> `FeatureSpotlight.jsx:99` (`dismissedOrphanRef`) é o único fora de `hooks/`. Leia o que ele faz antes de converter — se o ref não for de fato uma guarda de resposta assíncrona, o certo é **não converter** e sim registrar isso no comentário, e depois rodar `--baseline` (a regra aceita catraca, não exige zero).

### Pronto quando

- `npm run check` mostra `guarda-obsoleta` zerado (ou só com os sítios que você documentou como não-aplicáveis).
- `npx vite build` passa.
- `node scripts/check-consistencia.mjs --baseline` rodado e o baseline commitado junto.
- Sem changelog: nada disso é visível pra quem usa a plataforma (`CLAUDE.md`, regra 10).

---

## Tarefa 2 — `update-sem-select` (67 sítios, 43 arquivos)

### O bug

Um `UPDATE` barrado pela RLS **não é erro**: o PostgREST devolve `error: null` e `data: []` — zero linha afetada. Como as telas aplicam estado otimista antes, a pessoa vê "salvo" e o banco não mudou. Sem `.select()` na cadeia não dá nem pra saber quantas linhas foram.

Já mordeu de verdade: versão 4.55.1 ("uma edição sem permissão podia ser tratada como salva mesmo sem ter gravado nada"), o comentário da agência em Campanhas que fingia aceitar, e `use-profiles.js` de novo em 28/08.

### O gabarito

`src/hooks/use-clients.js:190-196`:

```js
const { data, error: err } = await supabase.from("clients").update(row).eq("id", id).select();
if (err) { setError(err); fetchAll(); throw err; }
if (!data || data.length === 0) {
  fetchAll();   // desfaz o otimista, recarregando a verdade do banco
  throw new Error("Não foi possível salvar as alterações do cliente — verifique suas permissões.");
}
```

A mensagem é em português, específica do domínio, e diz o que fazer. Não use texto genérico.

### **Isto é triagem, não substituição cega**

Ao contrário da tarefa 1, aqui **nem todo sítio deve ser convertido**. Antes de editar cada um, decida em qual caso ele cai:

1. **Escrita do usuário com estado otimista** → converta. É a maioria e é o alvo real.
2. **Fire-and-forget deliberado** (marcar notificação como lida, `updated_at` de telemetria, contador de visualização) → um `throw` aqui transforma ruído de rede em erro na cara do usuário. **Não converta**; deixe um comentário de uma linha dizendo por quê. `use-server-notifications.js` é candidato forte a esta categoria.
3. **Já tem tratamento equivalente por outro caminho** (RPC que devolve a linha, trigger que valida, checagem de permissão antes) → não converta, comente.
4. **O chamador não trata exceção** → converter sem ajustar o chamador troca falha silenciosa por tela branca. Ou ajuste o chamador (`try/catch` → `setError`/`AppToast`), ou não converta. **Sempre verifique quem chama antes de adicionar um `throw`.**

Conversões que envolvem `Promise.allSettled` em lote (ex.: ações em massa) já reportam falha por linha — confira antes de mexer.

### Os 43 arquivos (número de sítios entre parênteses)

**4 sítios:** `use-rh-bemestar.js` · `use-crm-viagem-prestacoes.js`
**3 sítios:** `use-rh-beneficios.js` · `use-pipelines.js` · `use-marketing-campaigns.js`
**2 sítios:** `use-stage-fields.js` · `use-server-notifications.js` · `use-rh-suppliers.js` · `use-rh-stage-fields.js` · `use-rh-pipeline-stages.js` · `use-posvenda.js` · `use-personal-task-stages.js` · `use-personal-task-stage-fields.js` · `use-marketing-expenses.js` · `use-document-library.js` · `use-client-contacts.js` · `use-chat.js`
**1 sítio:** `use-rh-onboarding.js` · `use-rh-manager-links.js` · `use-rh-ferias-requests.js` · `use-rh-comunicacao.js` · `use-rh-cargo-templates.js` · `use-proposals.js` · `use-pipeline-transitions.js` · `use-personal-tasks.js` · `use-personal-tasks-api-keys.js` · `use-personal-task-automations.js` · `use-personal-events.js` · `use-marketing-suppliers.js` · `use-marketing-requests.js` · `use-marketing-quotes.js` · `use-marketing-quote-template.js` · `use-marketing-budgets.js` · `use-esg-carbon.js` · `use-email-templates.js` · `use-crm-viagens.js` · `use-crm-viagem-categorias.js` · `use-crm-despesas.js` · `use-client-products.js` · `use-automations.js` · `src/components/views/NovoColaboradorModal.jsx` · `src/components/catalogo/MarginRulesPanel.jsx` · `src/components/campaign/CampaignCalendar.jsx`

### Pronto quando

- Todo sítio convertido **ou** com comentário explicando por que ficou de fora.
- Nenhum `throw` novo num caminho cujo chamador não trata.
- `npx vite build` passa, `--baseline` regravado e commitado.
- **Este aqui provavelmente merece changelog** (`CLAUDE.md`, regra 10): "uma edição sem permissão deixa de parecer salva" é mudança de comportamento visível. Uma entrada `correcao` + bump de `version` no `package.json`. Não precisa de spotlight (é fix, não feature nova — regra 12).

---

## Tarefa 3 — os 4 sub-agentes não existem no repositório

`CLAUDE.md:222-223` diz que os papéis de Design, Frontend, QA e Segurança existem como sub-agentes em `.claude/agents/*.md`, "local ao ambiente, fora do Git". Confirmado em 28/08/2026: **`.claude/` está vazia** e é gitignorada (`.gitignore:11`). Ou seja, o processo mais elaborado do arquivo depende de arquivos que nenhuma sessão nova encontra — ele é reinterpretado do zero toda vez.

**O que fazer:** escrever os quatro arquivos a partir do que o `CLAUDE.md` já especifica (regra 3 e 3.1 descrevem o papel de cada um em detalhe), versioná-los, e remover `.claude/agents/` do `.gitignore` mantendo o resto de `.claude/` ignorado.

Cada arquivo precisa deixar explícito:

- **`design-agent`** — produz spec objetiva com `arquivo:linha` do problema, tokens exatos reaproveitando os que já existem (regra 1), comportamento por estado. Decisão subjetiva: registrar as opções e qual foi escolhida, nunca apresentar uma escolha subjetiva como única resposta possível.
- **`frontend-agent`** — implementa a menor mudança que resolve a causa raiz, segue a spec ao pé da letra, não decide token/cor por conta própria, roda `npx vite build` (que agora dispara o check) antes de reportar pronto.
- **`qa-agent`** — não corrige código; aprova ou devolve `arquivo:linha — o que está errado — o que deveria ser`. Roda o build de novo. Confere contra a lista de classes de bug conhecidas do `CLAUDE.md:210-216`.
- **`security-agent`** — só entra quando a mudança toca schema/migration, RLS, Storage, edge function ou rota de escrita/autenticação. Só revisa, nunca aplica migration. Checklist completo em `CLAUDE.md:253-270`.

**Deixe claro no cabeçalho de cada arquivo que ele foi reconstruído a partir do `CLAUDE.md` em 28/08/2026, e não recuperado de uma versão anterior** — se aparecer um original em outra máquina, quem for comparar precisa saber disso.

Depois, atualize `CLAUDE.md:222-223`: a frase "local ao ambiente, fora do Git" deixou de ser verdade.

---

## Tarefa 4 — ligar de fato o teste de RLS

`supabase/tests/rls_stage_matrix.sql` já existe, é um teste de regressão de verdade (14 personas × 14 domínios × INSERT e DELETE, impersonando cada papel via `set_config('request.jwt.claims', ...)`), documenta no próprio cabeçalho ter havido **3 ocorrências** da mesma classe de bug — e **nunca rodou uma vez**.

O passo de CI já está escrito (`.github/workflows/ci.yml`, job `rls`) e é inerte: sem o secret `RLS_TEST_DATABASE_URL` ele avisa e passa.

**Falta:**

1. **Configurar o secret.** Precisa do Daniel. Aponte pra um **branch ou staging do Supabase, nunca produção** — o script cria e apaga usuários, perfis e etapas de teste (`__audit.invalid` / `_audit_%`). O próprio cabeçalho do `.sql` avisa.
2. **Atualizar a matriz.** Ela cobre 13 domínios (linhas ~51-66) e o código já usa pelo menos `marketing_purchase_requests` (ver `PurchaseRequestDetailDrawer.jsx:632,656,659`), que não está na lista. Levante os domínios reais com:
   ```sql
   select distinct domain from rh_pipeline_stages order by 1;
   ```
   e compare com a matriz antes de acrescentar. Aplicar migration continua exigindo confirmação explícita do Daniel (`CLAUDE.md`, regra 5) — mas **este script não é migration**, é leitura + dados de teste que ele mesmo limpa.

---

## Ordem sugerida

1. Tarefa 1 (guardas) — mecânica, gabarito claro, maior redução de risco por hora.
2. Tarefa 3 (sub-agentes) — barata, e torna o processo executável pras próximas sessões.
3. Tarefa 2 (updates) — a mais longa, por causa da triagem caso a caso.
4. Tarefa 4 (RLS no CI) — depende do Daniel pro secret.

Faça uma tarefa por commit, com `--baseline` regravado junto. Não junte as quatro num commit só: se algo regredir, quer dar pra isolar qual lote foi.

## O que NÃO fazer

Está registrado aqui pra você não gastar tempo redescobrindo e propondo de novo:

- **Não migre pra TypeScript.** São 115.853 linhas de JS em 391 arquivos. Custo desproporcional ao que pegaria.
- **Não crie suíte Playwright de fluxos de negócio.** A plataforma é multi-tenant com RLS por papel e empresa; um fluxo precisaria de dados semeados por persona, e a conta de teste conhecida (`CLAUDE.md`, regra 8) é fake sem caixa de entrada. Manutenção cara num repositório com ~13 commits/dia. Se um dia valer um teste de browser, o que vale é **um só**, varrendo as ~52 rotas de `ROUTES` e falhando se alguma renderizar ErrorBoundary — é ali que estão os bugs de "tela não carrega" que apareceram no changelog.
- **Não persiga meta de cobertura de teste.** Nenhum dos bugs caros desta plataforma seria pego por cobertura de linha em componente.
- **Não substitua o processo humano/agente por lint.** Mockup antes de mudança visual (regra 3), QA adversarial (regra 3.1) e `get_advisors` pós-migration pegam coisa que nenhuma regra de grep pega. O gate é complemento, não troca.
- **Não adicione regra ao `check-consistencia.mjs` que não venha de um bug real desta plataforma.** É a regra de ouro do arquivo, e está escrita no cabeçalho dele. Regra que acusa não-bug vira ruído e o gate inteiro passa a ser ignorado — duas sub-regras já foram estreitadas ou removidas por isso durante a construção.


---

## Adendo — 28/08/2026, depois de tudo executado

As quatro tarefas acima foram feitas e mergeadas na main (PR #126). A catraca
do `check-consistencia.mjs` desceu de **100 violações para 7**, e as 7 que
sobraram não são pendência: são as exceções da triagem, cada uma com o motivo
escrito no próprio código (ex.: `use-server-notifications.js`, onde marcar
notificação como lida é fire-and-forget de propósito). **Este documento virou
registro histórico — não é mais fila de trabalho.**

Uma coisa mudou de rumo: a **Tarefa 4 não vai rodar automática por ora.**
O branch `staging-rls` foi criado, o teste foi validado nele (392 checagens,
0 divergências, e o trigger de criação de perfil confirmado presente — ou
seja, o branch é fiel o bastante), e depois **branch e secret foram apagados**
por decisão do Daniel: US$ 0,01344/hora não se justifica pra pegar um bug que
aparece quando nasce um board novo.

O passo de CI continua no `ci.yml`, inerte de propósito. Religar é só recriar
o branch e regravar o secret — nenhum arquivo precisa mudar. Até lá, o
procedimento manual está descrito no comentário do próprio `ci.yml` e no
cabeçalho do `rls_stage_matrix.sql`.

**Correção de 30/08/2026 — esta conclusão foi substituída.** O parágrafo
acima continua valendo como registro do *porquê* (o custo por hora não se
justifica), mas a saída "job inerte + rodar a mão" durou pouco e teve um
efeito colateral imediato: com o secret apagado o job voltava a avisar e
passar, mas **antes disso ele chegou a existir apontando pro branch já
deletado** — e aí o pooler respondia `(ENOTFOUND) tenant/user postgres.<ref>
not found`, que deixaria vermelho todo PR com migration, por configuração e
não por código.

A saída adotada entrega o mesmo custo zero sem abrir mão da automação: o job
`rls` agora sobe o **Supabase local dentro do runner** (`supabase start`) e
roda o teste contra ele. Docker já vem nos runners do GitHub, o banco é
descartável, não existe secret nem conexão externa. Ganho extra: `supabase
start` aplica as 292 migrations do zero, então o job também passa a provar
que o repositório consegue reconstruir o banco sozinho — algo que nunca tinha
sido verificado.

Duas correções de número enquanto isso: a matriz hoje cobre **16 domínios**
(os dois últimos entraram na Tarefa 4), então são **448 checagens**, não 392;
e o cleanup do script não apagava `rh_colaboradores` — um gatilho cria um
colaborador por perfil, com FK `ON DELETE SET NULL`, então sobravam 14
órfãos e o script rodava exatamente uma vez. Corrigido; a 2ª execução em
diante passa limpa.


---

## Pendência aberta — o repositório não reconstrói o banco

**Achado em 30/08/2026, na primeira execução real do job `rls` com Supabase
local.** Ele foi criado prometendo "provar que o repositório consegue
reconstruir o banco sozinho". Rodou e provou o contrário. São dois problemas
independentes:

**1. Onze migrations são puladas em silêncio.** A CLI exige
`<timestamp>_nome.sql`, e esses arquivos têm uma letra colada na data:

```
20260807b_rh_stage_history_custom_fields_snapshot.sql
20260817b_sec_client_billing_history_delete_scope.sql
20260820b_sec_rh_treinamento_atrib_guard_fix_vencido.sql
20260824b_sec_revoke_net_http_from_public.sql
20260825b_rh_attachments_marketing_deliverables_campaigns_domains.sql
20260827b_crm_viagem_registros_valor_previsto.sql
20260828b_agencia_escopo_por_etapa_e_b2b_company_fix.sql
20260831b_crm_viagem_prestacoes_fix_bypass.sql
20260902b_chat_count_profiles_matching_filter.sql
20260902c_chat_channel_groups_sync_security_fix.sql
20260902d_crm_viagem_despesas_restore_missing_write_policies.sql
```

Elas **estão aplicadas em produção**, mas sob outro nome — a
`20260828b_agencia_escopo_por_etapa_e_b2b_company_fix` está em
`supabase_migrations.schema_migrations` como versão `20260828150215`. Foram
aplicadas direto no banco (via MCP `apply_migration`), e o arquivo no Git é uma
cópia com nome que a CLI não reconhece. **`supabase db push` também as
ignoraria** — não é um problema só de CI.

**2. A primeira migration já quebra.** `20260504_add_client_classification.sql`
faz `ALTER TABLE public.leads` num banco onde `leads` não existe. Nunca houve
no repositório uma migration que **cria** as tabelas base: o banco foi montado
antes de alguém começar a versionar.

### Por que isso importa mais que o CI

É a **causa raiz** do bug crítico do Onboarding de 28/08 — a função de trigger
`rh_onboarding_tarefas_guard_self_update()` que existia só em produção, nunca
commitada, e que quebrou quando uma migration derrubou a coluna que ela
referenciava. Aquilo não foi descuido isolado: é o sintoma previsível de um
repositório que nunca foi a fonte de verdade do schema. Enquanto for assim,
qualquer migration nova pode colidir com um objeto que ninguém sabe que existe.

### O conserto

1. `supabase db dump` do schema de produção → salvar como primeira migration
   (ex.: `00000000000000_baseline.sql`). Isso captura tudo que hoje só existe
   no banco: triggers, funções, policies aplicadas fora do Git.
2. Renomear as 11 acima pro nome que a CLI aceita — **com cuidado**: elas já
   constam em `schema_migrations` com versão numérica própria, então renomear
   sem reconciliar faz a CLI tratá-las como não-aplicadas.
3. Remover o `continue-on-error: true` do job `rls` no `ci.yml`.

Envolve dump de produção, então **precisa de confirmação do Daniel** antes
(regra 5 do `CLAUDE.md` é sobre aplicar migration, mas o espírito vale: mexer
no histórico de migrations de um banco vivo não se faz sozinho).

### Enquanto isso

O job `rls` está **não-bloqueante** (`continue-on-error: true`). Ele roda,
aparece no log, e não trava merge. A alternativa — deixar bloqueante — pintaria
de vermelho todo PR com migration, para sempre, por configuração e não por
código; e um gate que sempre falha vira ruído que todo mundo aprende a ignorar.


---

## Fechamento da pendência — 31/08/2026

O baseline existe: `supabase/migrations/00000000000000_baseline.sql` (643 KB).
Os 292 arquivos antigos foram para `supabase/migrations/_historico/`, com um
LEIA-ME explicando por que não rodam mais.

**A reconciliação foi pior que o diagnóstico original.** Não eram 11 arquivos
com nome errado: produção tinha **381 migrations registradas contra 292
arquivos**, e **127 registros sem arquivo nenhum** — incluindo todas as que
criam as tabelas base. O repositório nunca teve as primeiras semanas de
schema. Por isso renomear os 11 não resolveria nada, e por isso o baseline
era a única saída.

**Como foi gerado, e o que isso implica.** Não por `supabase db dump`: a CLI
exige Docker, que não estava instalado na máquina do Daniel. Foi por
introspecção do catálogo do Postgres de produção (`pg_get_functiondef`,
`pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_triggerdef`, `pg_policies`,
`aclexplode`). Cada bloco veio com md5 calculado pelo próprio Postgres e
conferido do lado de cá — a **cópia é exata**. O que não se pode afirmar é que
a **reconstrução** cubra tudo que o `pg_dump` cobriria: é reimplementação, não
cópia de dump.

As contagens batem uma a uma com produção: 124 tabelas, 154 funções, 492
constraints, 201 índices (fora os de constraint), 345 policies, 101 triggers,
RLS nas 124 tabelas, 13 buckets.

**A prova de que valia a pena:** a função `rh_onboarding_tarefas_guard_self_
update()` — que só existia em produção, nunca foi commitada, e derrubou o
Onboarding em 28/08 — está capturada no baseline.

### O que ainda falta

**Uma escrita em produção**, e só uma: inserir o baseline em
`supabase_migrations.schema_migrations` como já aplicado.

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('00000000000000', 'baseline')
on conflict (version) do nothing;
```

É metadado — não muda schema. Sem isso, um `supabase db push` futuro tentaria
aplicar o baseline em produção. **Deve ser feita só depois de o CI provar que
o baseline sobe um banco do zero e passa a matriz de RLS**, nunca antes: se o
arquivo estiver torto, é melhor descobrir no runner descartável.

O job `rls` segue com `continue-on-error: true`. Remover essa linha é o último
passo, depois do primeiro verde.
