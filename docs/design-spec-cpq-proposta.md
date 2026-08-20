# Spec — Estrutura de Linha de Item (CPQ) na Proposta Comercial

Status: investigação/spec, **nada implementado**. É o item mais caro do
levantamento — spec dividida em Fase 1 (mínima viável) e Fase 2 (completa)
pra escolha de profundidade. Schema novo nas duas fases — precisa
confirmação explícita do Daniel antes de aplicar (CLAUDE.md regra 5).

## 1. Estado atual do `ProposalPanel.jsx`

Estrutura real (`src/components/lead/ProposalPanel.jsx:1-249`):

- `handleGenerate` (`:58-94`) chama `complete(proposalPrompt(lead,
  orderHistory))` e joga o resultado num único `<textarea>` (`:147-153`) —
  texto livre, editável à mão, sem estrutura nenhuma por trás.
- O "preço" é `lead.value`, interpolado direto em `proposalPrompt`
  (`src/constants/ai-prompts.js:268`). Não há linha de item — é um número
  solto no lead.
- `useEsgReports` (`:104-108`) já busca o relatório ESG mais recente da
  empresa vendedora e monta um selo (`:186-197` na tela, `:211-237` no
  documento impresso). **Padrão reaproveitável**: card de destaque com borda
  `company.primary`, calculado fora do draft de IA e injetado tanto na
  prévia quanto no `doc-print-only`. A tabela de linhas de item segue a
  mesma lógica.
- `orderHistory` (`:53-56`) já filtra negócios ganhos do mesmo `clientId` —
  dá pra reaproveitar como base de upsell/cross-sell também.
- `onAddActivity` (`:73-88`) registra só o 1º "Gerar" como atividade, com
  `meta.leadValue`/`skuName`. Precisa mudar quando existir subtotal real.

## 2. Catálogo existente — o que já tem, o que falta

- **`src/constants/skus.js:1-17`** — `SKU_CATALOG`, 11 itens, cada um só
  `{id, name, unitPrice}`. **Usado em produção apenas por
  `src/data/generate-leads.js:150,178`** — é dado de seed/demo, não alimenta
  nenhum formulário real. Não bate com a estrutura real de negócio (15
  modelos Sanbag em 5 segmentos com exigência regulatória própria).
- **`leads` já tem `skuName`/`quantity`/`unitPrice`/`value`** como campos de
  UM item só (`src/hooks/use-leads.js:34-37,90-93,129-130,343-346`).
  Exibidos read-only em `LeadDetailDrawer.jsx:913-926` — sem form de edição
  em produção; hoje só chegam via seed/import.
- **Não existe** em lugar nenhum do repo uma lista dos 15 modelos Sanbag nem
  dos 5 segmentos com exigência regulatória — isso só existe na skill
  `sanwey-canonical-facts`, fora do código. **Conclusão: não há catálogo
  real pra reaproveitar — Fase 1 precisa de uma lista nova, que deve nascer
  dos fatos canônicos da skill, não do `SKU_CATALOG` demo.**
- **Precedente direto de child-table de linha de item já em produção**:
  `marketing_expense_items` (`supabase/migrations/20260762_marketing_expense_items.sql:8-16`)
  — `quantity numeric`, `unit_value numeric`, RLS espelhando a tabela-mãe
  (`:24-39`), trigger que recalcula o total do pai a cada INSERT/UPDATE/
  DELETE (`:59-82`). **Este é o modelo a copiar para
  `proposal_line_items`**, não inventar um novo.
- Padrão de isolamento por empresa a espelhar: `clients_read`/
  `clients_insert` em `20260713_fix_clients_company_isolation.sql:8-19`
  (`company_ids && current_user_companies()`).
- `CurrencyInput` (`src/components/ui/CurrencyInput.jsx:10-40`) e o par
  quantidade+preço já usado em `PurchaseRequestDetailDrawer.jsx:755,758` são
  a UX de referência pra editar quantidade/preço unitário.

## 3. Fase 1 — mínima viável

**Schema muda, sim — não dá pra forçar "zero schema".** Um `jsonb` em
`leads` perde histórico (sobrescreve a cada proposta nova) e contraria o
precedente da plataforma (`marketing_expense_items` já resolveu exatamente
esse problema com tabela filha). Duas tabelas novas:

- `proposals` (`id`, `lead_id` FK, `company_id`, `version int`, `status`
  draft/sent, `ai_draft_text`, `esg_snapshot jsonb`, `created_by`,
  `created_at`) — uma linha por proposta gerada, versionada, nunca
  sobrescrita.
- `proposal_line_items` (`id`, `proposal_id` FK `ON DELETE CASCADE`,
  `model_label text` livre, `quantity numeric`, `unit_price numeric`,
  `certification_note text` livre, trigger de subtotal igual ao de
  `marketing_expense_items_sync_amount`).

Modelo em Fase 1 é **texto livre ou selecionado de uma lista estática nova**
(`src/data/sanbag-models.js`, populada a partir da skill
`sanwey-canonical-facts`), sem preço-base nem regra de precificação — o
vendedor digita o preço unitário via `CurrencyInput`.

**RLS**: `proposals`/`proposal_line_items` espelham o predicado já usado em
`leads_select`/`leads_insert`, e `proposal_line_items` espelha `proposals`
(linha-filha vê o que o pai vê, igual `marketing_expense_items`).
**Storage: sem mudança.**

## 4. Fase 2 — completa

`sanbag_models` (id, nome, `segment`, `base_price`, `certification_flags`,
`attributes jsonb`) + `product_pricing_rules` (condição por
atributo/certificação → delta/multiplicador de preço — o motor CPQ real).
`proposal_line_items` ganha `product_id` FK **nullable** (mantém
compatibilidade com a entrada livre da Fase 1). UI de linha vira busca no
catálogo (filtro por segmento), preenche preço-base e badge de certificação
automaticamente; preço unitário continua editável pelo vendedor.

**Schema**: sim, 2 tabelas novas + 1 coluna em `proposal_line_items`.
**RLS**: catálogo legível por qualquer role comercial da(s) empresa(s)
dona(s), escrita restrita a `admin`/`gerente` (mesmo padrão de
`rh_pipeline_stages`). **Storage**: sem mudança (a menos que se decida
anexar imagem de produto — fora de escopo aqui).

## 5. IA + UI

Os dois convivem: `proposalPrompt` (`ai-prompts.js:249`) recebe um novo
parâmetro `lineItems` — quando presente, a seção "Condições comerciais" do
prompt recebe o subtotal real por item + total, texto narrativo continua
gerado pela IA em torno disso. Sem `lineItems`, comportamento atual é
preservado (compatibilidade).

Na UI: tabela editável (adicionar/remover linha, campos modelo/quantidade/
`CurrencyInput`, subtotal calculado, total geral) **acima** do botão "Gerar
proposta com IA" (alimenta o prompt). Também entra no bloco `doc-print-only`
(`:200-243`), no mesmo espírito do selo ESG. `onAddActivity` passa a incluir
`meta.lineItemsTotal`/`meta.itemCount` junto do `leadValue`.

Mockup: ver artifact "Novas Features do Funil", item 4.

## 6. Resumo schema/RLS/Storage

| | Fase 1 | Fase 2 |
|---|---|---|
| Schema | Sim — `proposals` + `proposal_line_items` (novas) | Sim — `sanbag_models` + `product_pricing_rules` + FK em `proposal_line_items` |
| RLS | Sim — espelha `leads`/`marketing_expense_items` | Sim — catálogo com leitura ampla, escrita restrita |
| Storage | Não | Não (a menos que se decida imagem de produto, fora de escopo) |

**Security-agent obrigatório nas duas fases** (schema + RLS novos, regra 3.1
do CLAUDE.md).
