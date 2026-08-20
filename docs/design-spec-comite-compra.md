# Spec — Comitê de Compra (`client_contacts`) no Funil de Vendas

Status: investigação/spec, **nada implementado**. Sem schema/RLS novos — tabela
e políticas já existem em produção, dormentes.

## 1. Schema hoje (`client_contacts`)

`supabase/migrations/20260918_pedidos_catalogo_portal_b2b.sql:123-133`:

```
id uuid pk, client_id uuid not null (fk clients, on delete cascade),
name text not null, email text, phone text, job_title text,
active boolean not null default true,
created_at/updated_at timestamptz not null default now()
```
Índice: `idx_client_contacts_client` (`:134`). `updated_at` mantido por trigger
`trg_client_contacts_touch` (`:385`). Sem coluna de "papel no comitê"
(Procurement/EHS/CFO) — só `job_title` texto livre.

**RLS** — habilitada (`:135`). Predicado **em produção hoje** (confirmado ao
vivo via `pg_policies` no projeto Supabase, não só lido da migration — o
arquivo `20260918` cria o predicado antigo `is_comercial_operator()` nas
linhas `:137-142`, mas foi substituído por um fix de isolamento posterior):

- `client_contacts_interno` (ALL): `current_user_is_admin() OR current_user_can_manage_client(client_id)`
  — `supabase/migrations/20260818_sec_client_addr_contacts_marketing_expense_scope.sql:19-23`.
  Mesmo predicado de `client_addresses`/`client_products`, escopado por
  empresa+dono do cliente.
- `client_contacts_cliente` (SELECT): `client_id = current_user_client_id()`
  (`20260918...sql:141-142`, portal do cliente lê os próprios contatos).
- `client_contacts_suporte_read` (SELECT): `is_comercial_support()`
  (`supabase/migrations/20260921_papel_suporte_comercial.sql:94-95`).

Conclusão: schema e RLS **já cobrem** o caso de uso — nenhuma migration nova
necessária pra feature em si.

## 2. Telas atuais de cliente

- `ClientSelector.jsx` (192 linhas) — busca/seleciona cliente no lead, 3
  estados (vazio/busca/selecionado), mini-card com categoria/cidade/CNPJ.
- `ClientQuickCreateModal.jsx` — criação rápida a partir do lead.
- `ClientsManager.jsx` — cadastro central. `ClientDetailModal` (`:536-807`)
  usa `EntityProfileModal` com abas dinâmicas: hoje `Dados` /
  `Produtos & Preços` (`ClientProductsTab`, só se `editing`) / `Histórico`
  (`:586-590`). **É aqui que uma 4ª aba "Contatos" encaixa** — mesmo padrão
  de `ClientProductsTab.jsx` (tab isolada, recebe `clientId`, tem seu próprio
  modal de add/edit local ao arquivo).
- `ClientProductsTab.jsx` (309 linhas) é o melhor molde: `ReleaseModal`
  interno pra criar/editar, toggle ativo/pausado em vez de exclusão dura,
  hook próprio (`useClientProducts`) sobre a tabela — mesmo shape que um
  `useClientContacts(clientId)` teria sobre `client_contacts`
  (`src/hooks/use-client-products.js:14-45` como referência de hook).

## 3. `decision_maker` — o que existe e o que fazer

Uso real (grep completo): campo do lead, mapeado em
`src/hooks/use-leads.js:47,103,134,354`. Consumido em
`LeadKanbanCard.jsx:36-37` (preview do card), `LeadDetailDrawer.jsx:411-413,808-815`
(rail direito), `constants/ai-prompts.js` (6 usos, prompts de IA),
`constants/pipelines.js:29` (campo do form). Seed/geração de dados:
`data/generate-leads.js`, `CnpjLookupCard.jsx`, `ProspectSuggestions.jsx`,
`SignalsView.jsx`, `CRMView.jsx`, `FairImportView.jsx` — todos inicializam
com `{ name: "—", role: "—" }`.

**Recomendação: aposentar como campo de escrita direta, manter como snapshot
histórico congelado.**

- É `jsonb` solto no `leads`, sem FK — não tem como "virar" `client_contacts`
  sem migração de dado, e qualquer lead fechado/antigo tem esse par
  name/role como foi digitado *naquele momento* (pode não bater com o
  comitê atual do cliente).
- Continua sendo lido pelos ~30 pontos existentes sem quebrar nada — zero
  risco de regressão.
- Fecha a entrada de dado (troca placeholder por leitura), sem mudança de
  schema — é só trocar o label de "Decisor" pra "Contato inicial
  (histórico)" e não oferecer mais edição livre. O contato de verdade passa
  a viver em `client_contacts`.
- **Não vira** "apenas contato principal derivado" porque não há como marcar
  qual contato é "principal" no schema atual (sem flag de primário) —
  proposta separada, fora de escopo aqui.

## 4. Componentes a reaproveitar (nenhum novo)

| Uso | Componente |
|---|---|
| Aba "Contatos" dentro do cliente | `EntityProfileModal` (mesmo padrão de `ClientProductsTab`) |
| Grade de contatos | `Card`/`CardGrid` (`src/components/shared/Card.jsx`) |
| Excluir contato | Padrão canônico "Fornecedores" (`Trash2` no card + `Modal` com "Cancelar"/"Excluir" em `--danger`) |
| Badges de papel no `LeadDetailDrawer` | pill simples, mesmo estilo de `LEAD_BADGE_STYLE` (`ClientsManager.jsx:921-925`) |
| `AvatarStack`/`EntityMultiSelect` | não se aplica — não é seleção de usuário interno, é CRUD de registro de terceiro |

## 5. UI proposta

- **Fonte de verdade**: aba `Contatos` em `ClientDetailModal`, mesma posição
  de `Produtos & Preços`. Grid de `Card`s: nome, `job_title`, e-mail/telefone,
  toggle ativo/pausado, `Trash2` → confirm modal local.
- **No `LeadDetailDrawer`**: seção **read-only** logo abaixo do bloco
  "Decisor" atual, listando os `client_contacts` **ativos** do
  `lead.clientId`, cada um com nome + pill de `job_title` como "papel".
  Estados: vazio (nada, mesma regra já aplicada ao Decisor), populado
  (lista), sem `clientId` vinculado (seção não renderiza).
- Sem "vincular contato do comitê a este negócio" como relação N:N
  lead↔contato — `client_contacts` já é por `client_id`, e o lead já tem
  `clientId`. Introduzir tabela de junção lead↔contato é escopo novo, fora
  do que foi pedido ("ligar a tomada").

## 6. Resumo de impacto

- **Schema**: não muda — tabela e colunas já existem.
- **RLS**: não muda — já cobre interno, portal do cliente e suporte.
- **Storage**: não toca.
- Único código novo: hook `useClientContacts(clientId)` (molde de
  `use-client-products.js`), aba `ClientContactsTab` (molde de
  `ClientProductsTab`), e leitura read-only no `LeadDetailDrawer`.
- Mockup: ver artifact "Novas Features do Funil", item 1.
