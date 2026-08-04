# Spec — Offline fase 1: ver meus leads + registrar nota sem conexão

Mockup aprovado por Daniel em 01/08/2026 (Artifact
`92105452-6b80-42fe-9c12-ffc9cf89c25b`). Escopo fechado explicitamente:
**leitura** dos leads que o usuário já carregou (respeitando a mesma RLS de
sempre) e **captura de nota/atividade offline**, sincronizada quando a
conexão voltar. Fora de escopo nesta rodada: mover lead de etapa offline,
anexo/comprovante offline, qualquer outro módulo (Chat, RH, Marketing).
Nenhuma tabela nova no banco — 100% infraestrutura de cliente.

Fatos confirmados no código antes desta spec (não são suposição):

- `src/hooks/use-leads.js:161-179` (`fetchAll`) — `supabase.from("leads").select("*")`,
  sem filtro de owner/empresa no servidor; o que volta já é exatamente o que
  a RLS permite pro usuário logado (vendedor vê o próprio escopo, gerente/
  admin veem mais). **Não crie um filtro client-side adicional pro cache** —
  cachear exatamente o array que `fetchAll` já guarda em memória hoje é
  suficiente e não amplia nem restringe nada além do que a RLS já decide.
- `src/hooks/use-leads.js:243-258` (`updateLead`) — update otimista local +
  `supabase.from("leads").update(...)`, com rollback via `fetchAll()` em
  caso de erro (esse rollback-via-refetch **não deve rodar quando offline**
  — ver seção 3).
- `src/hooks/use-leads.js:337-347` (`addLeadActivity`) — chama `updateLead`
  com o array de `activities` já contendo a nova entrada.
- `src/components/lead/LeadDetailDrawer.jsx:231-246` (`handleAddNote`) e
  `:362-379` (`handleAddComment`) — os dois pontos de entrada de nota/
  atividade, ambos chamam `onAddActivity` (prop vinda de `addLeadActivity`).
- `src/components/lead/LeadCreateModal.jsx:329-334` — já gera
  `crypto.randomUUID()` no cliente antes de inserir — é o precedente a
  seguir pra ID de nota gerado offline (idempotência em retry).
- `vite.config.js:15-59` — PWA já configurado, `registerType: "prompt"`
  (linha 25). Não precisa mexer nisso.
- Nenhuma lib de IndexedDB no projeto hoje (`package.json:12-31`) — adicionar
  `idb` (wrapper fino sobre IndexedDB, ~1kb, sem motor de query reativo —
  não precisamos de Dexie aqui, o escopo é só 2 stores simples).
- Nenhuma detecção de conectividade existe hoje em lugar nenhum do `src/`.

## 1. Nova dependência

`npm install idb` — confirmar que entra em `package.json` `dependencies`
(não devDependencies).

## 2. `src/hooks/use-connectivity.js` (novo)

Hook simples: `{ isOnline }`.

- Estado inicial: `navigator.onLine`.
- Escuta `window` `"online"`/`"offline"`. `navigator.onLine` sozinho não é
  confiável (fica `true` em wifi sem internet de verdade) — ao receber o
  evento `"online"`, faça uma sondagem real antes de marcar `isOnline: true`:
  uma chamada leve e já existente no client (ex.
  `supabase.from("profiles").select("id").limit(1)` com timeout curto,
  ~4s). Sucesso → `isOnline: true`. Falha → mantenha `isOnline: false` e
  tente de novo em alguns segundos (backoff simples, não precisa ser
  sofisticado).
- Evento `"offline"` do browser é imediato e confiável o bastante — não
  precisa de sondagem, marca `isOnline: false` na hora.

## 3. `src/hooks/use-offline-cache.js` (novo)

Wrapper fino sobre `idb`. Um banco (`sanwey-offline`), duas object stores:

- `leadsCache` — key: `lead.id`. Value: o objeto lead inteiro + `cachedAt`
  (timestamp). Uma função `saveLeadsSnapshot(leads)` (grava tudo de uma vez,
  substituindo o conteúdo anterior) e `readLeadsSnapshot()` (retorna
  `{ leads, cachedAt }`, usando o `cachedAt` mais recente do lote).
- `pendingActivities` — key: id gerado no cliente (`crypto.randomUUID()`).
  Value: `{ id, leadId, activity, status, error, createdAt }` — `status` é
  `"pending" | "syncing" | "failed"` (removido da store quando sincroniza
  com sucesso, não fica um 4º status "synced" persistido). Funções:
  `enqueueActivity`, `listPending`, `updateStatus(id, status, error?)`,
  `removeFromQueue(id)`.
- `clearAll()` — apaga as duas stores. Chamar no logout (onde já existe o
  fluxo de sign-out, procurar em `use-supabase-auth.js`).

## 4. Mudanças em `use-leads.js`

- `fetchAll` (161-179): em caso de sucesso, além de setar o state como
  hoje, chama `saveLeadsSnapshot(data)` (fire-and-forget, não precisa
  bloquear o state update por causa disso).
- Novo `useEffect` inicial: se `!isOnline` (via `useConnectivity`) no
  primeiro mount e ainda sem state carregado, lê `readLeadsSnapshot()` e
  popula o state a partir do cache, guardando o `cachedAt` num state próprio
  (`cacheAge`) pra UI mostrar "dados salvos de X atrás".
- `addLeadActivity` (337-347): se `isOnline`, comportamento idêntico ao de
  hoje. Se `!isOnline`:
  1. Gera `id = crypto.randomUUID()` pra a atividade (hoje o id da
     atividade já é gerado em algum lugar do fluxo — confirme e reaproveite
     o mesmo formato, só adiantando a geração pro momento da criação em vez
     de depois).
  2. Aplica a MESMA atualização otimista local de sempre (a nota já aparece
     na tela), mas marca essa entrada de activity com `pending: true` no
     objeto local (campo novo, só existe em memória/cache, não é gravado no
     banco — é metadado de UI).
  3. Chama `enqueueActivity({ id, leadId, activity })`.
  4. **Não chama `supabase.update` nem o rollback-via-refetch** — isso é o
     desvio do padrão online, documentado aqui de propósito pra não ser
     "corrigido" de volta sem querer.

## 5. `src/hooks/use-offline-sync.js` (novo)

Hook sem retorno de UI direto — só efeito colateral, chamado uma vez perto
da raiz (`App.jsx`, junto dos outros hooks globais como `useChat`/
`useServerNotifications`).

- Observa `isOnline` (de `useConnectivity`). Dispara `syncQueue()`:
  - No mount, se já `isOnline` (cobre o caso de fila deixada de uma sessão
    anterior que fechou antes de sincronizar).
  - Toda vez que `isOnline` passa de `false` para `true`.
- `syncQueue()`: lê `listPending()`, processa em ordem de `createdAt`. Pra
  cada item: marca `status: "syncing"`, chama a mesma chamada Supabase que
  `updateLead`/`addLeadActivity` já fariam online (extraia a chamada crua
  pra uma função reaproveitável em vez de duplicar a query). Sucesso →
  `removeFromQueue(id)` + atualiza o state em memória tirando o
  `pending: true` daquela activity. Falha → `updateStatus(id, "failed", err.message)`,
  mantém na fila (sem retry automático em loop — só quando o usuário tocar
  no selo "não sincronizou" ou na próxima reconexão).
  - Ao final, se `syncedCount > 0`, dispara `AppToast` (variant default)
    com "{n} nota sincronizada" / "{n} notas sincronizadas" (plural
    correto).

## 6. UI

**Faixa offline global** — novo componente `src/components/shared/OfflineBanner.jsx`,
montado uma vez perto do topo do layout autenticado em `App.jsx` (abaixo do
`TopBar`, mesmo nível de outros banners globais se existirem). Visível só
quando `!isOnline`. Estilo exato do mockup: fundo `var(--warning-bg)`, texto
`var(--warning)`, borda inferior `1px solid color-mix(in srgb, var(--warning) 30%, transparent)`,
bolinha de 7px + texto "Sem conexão — mostrando dados salvos de {tempo}
atrás" (formatar `cacheAge` com o mesmo helper de tempo relativo que
`daysSince`/`date.js` já usa, adaptado pra minutos/horas). Se não houver
`cacheAge` ainda (nunca carregou nada), o texto vira só "Sem conexão".

**Selo de status na nota** (`LeadDetailDrawer.jsx`, dentro do item de
activity tipo nota/comentário): 4 variações, classes exatas do mockup —

```
pending  → fundo var(--surface-alt), texto var(--text-faint) — "🕐 Vai enviar quando voltar o sinal"
syncing  → fundo var(--accent-tint), texto var(--accent)      — "↻ Enviando…"
failed   → fundo var(--danger-bg),  texto var(--danger)       — "⚠ Não sincronizou · toque para tentar de novo"
```

(Não existe selo "synced" persistente — uma vez sincronizada, a nota vira
igual a qualquer outra nota antiga, sem selo nenhum; o selo só existe
enquanto o item está na fila local.) O container do note-item ganha
`border-style: dashed` só enquanto `pending` ou `failed` (nunca depois de
sincronizado). Selo `failed` é clicável — retry manual só daquele item
(chama a mesma função de sync, passando o id específico).

## 7. Fora de escopo — não implementar agora

- Mover etapa de lead offline, criar lead offline, editar campos do lead
  offline (só nota/atividade).
- Qualquer coisa em Chat, RH, Marketing, Despesas.
- Retry automático em loop pra itens `failed` (só manual ou próxima
  reconexão).
- Criptografia adicional do IndexedDB além da já dada pelo SO do aparelho
  (decisão já registrada e aceita no mockup).
