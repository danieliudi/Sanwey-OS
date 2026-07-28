# Comex — Importação e Exportação Direta (novo departamento em Comercial)

Baseado na análise `CRM_Comex_vs._CRM_Vendas_B2B__Google_Gemini.pdf` (upload do Daniel) + decisões via
`AskUserQuestion`: **2 boards separados** (Importação Direta / Exportação Direta, mesmo padrão de
sub-boards de Vagas/Candidatos no Recrutamento) e **Fase 1 já inclui Landed Cost + câmbio**.

Esta é uma spec de **schema + estrutura**, não de visual pixel-a-pixel — o mockup separado
(`https://claude.ai/code/artifact/...` a publicar) cobre a parte visual. Esta spec existe pra registrar a
decisão de schema **antes** de qualquer migration ser aplicada — CLAUDE.md regra 5: mudança de schema real
exige confirmação explícita do Daniel, sempre, mesmo já com o escopo geral aprovado.

## 1. Por que 2 tabelas novas (não só domain novo no genérico existente)

Etapas/campos/transições/anexos/checklists — tudo isso a plataforma já resolve de forma 100% genérica
(`rh_pipeline_stages`, `rh_pipeline_stage_fields`, `rh_attachments`, `rh_checklists`, ver tabela de
reaproveitamento no final). O que **não existe hoje em lugar nenhum da plataforma** é:

1. Um registro "base" pro card de Comex (equivalente a `marketing_tasks`/`rh_ferias`/`rh_vagas` — cada
   domínio de Kanban tem sua própria tabela com colunas centrais + `custom_fields` pro resto).
2. Qualquer conceito de **moeda estrangeira + câmbio** — `formatBRL`/`formatK` só fazem BRL, não existe
   coluna de moeda em nenhuma tabela hoje.
3. Um **campo calculado** (Landed Cost = soma de componentes × câmbio) — não existe precedente de campo
   derivado/fórmula na plataforma (todo campo hoje é ou digitado ou vindo de outra tabela via join).

Por isso: 2 tabelas novas, com só as colunas centrais que a calculadora de Landed Cost e o board realmente
precisam de forma estruturada — tudo o resto (NCM, número de PO, canal RFB, etc., ver tabela do
documento) vira **campo configurável por etapa** via `rh_pipeline_stage_fields`, já existente, seguindo
CLAUDE.md regra 5 ("antes de assumir que precisa de coluna nova, confira se já é dado configurável").

## 2. Schema novo proposto (migration única, aditiva — não mexe em tabela existente)

```sql
-- Importação Direta
CREATE TABLE comex_import_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_ids         text[] NOT NULL DEFAULT '{}',
  title               text NOT NULL,              -- "PO #123 — Fornecedor XYZ"
  supplier_name       text,
  stage               text NOT NULL,               -- stageKey de rh_pipeline_stages(domain='comex_importacao')
  stage_changed_at    timestamptz NOT NULL DEFAULT now(),
  owner_ids           uuid[] NOT NULL DEFAULT '{}',

  -- Núcleo pra calculadora de Landed Cost (única parte da plataforma com conceito de moeda/câmbio)
  currency            text NOT NULL DEFAULT 'USD', -- USD | EUR
  fob_value           numeric,                     -- valor FOB/FCA na moeda estrangeira
  freight_value       numeric,                     -- frete internacional, mesma moeda
  insurance_value     numeric,                     -- seguro internacional, mesma moeda
  ptax_rate           numeric,                     -- câmbio do dia, digitado manualmente (sem API nesta fase)
  estimated_taxes_brl numeric,                     -- estimativa de II+IPI+PIS+COFINS+ICMS já em BRL (usuário estima; NCM real fica fora de escopo — motor de tributação não existe)
  estimated_fees_brl  numeric,                     -- despesas portuárias/aeroportuárias estimadas, BRL

  custom_fields       jsonb NOT NULL DEFAULT '{}', -- NCM, Incoterm, PO/BL/DI-DUIMP number, canal RFB, instrumento de pagamento etc. — tudo via rh_pipeline_stage_fields
  notes               jsonb NOT NULL DEFAULT '[]',
  activities          jsonb NOT NULL DEFAULT '[]',
  starred             boolean NOT NULL DEFAULT false,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Exportação Direta
CREATE TABLE comex_export_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_ids         text[] NOT NULL DEFAULT '{}',
  title               text NOT NULL,               -- "PI #456 — Comprador ABC (México)"
  buyer_name           text,
  buyer_country        text,
  stage               text NOT NULL,               -- stageKey de rh_pipeline_stages(domain='comex_exportacao')
  stage_changed_at    timestamptz NOT NULL DEFAULT now(),
  owner_ids           uuid[] NOT NULL DEFAULT '{}',

  currency            text NOT NULL DEFAULT 'USD',
  sale_value          numeric,                     -- valor total da operação, moeda estrangeira
  ptax_rate           numeric,                     -- câmbio do dia (recebimento/fechamento), manual

  custom_fields       jsonb NOT NULL DEFAULT '{}', -- Incoterm, NCM destino, PI number, DU-E, BL/HAWB, termos de pagamento etc.
  notes               jsonb NOT NULL DEFAULT '[]',
  activities          jsonb NOT NULL DEFAULT '[]',
  starred             boolean NOT NULL DEFAULT false,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

`landed_cost_brl` **não é coluna** — é calculado em runtime (hook/UI), não precisa ser persistido:
```
landed_cost_brl = (fob_value + freight_value + insurance_value) * ptax_rate + estimated_taxes_brl + estimated_fees_brl
```
Se algum dia precisar de histórico ("qual era o landed cost quando a proposta foi feita"), vira snapshot em
`activities` (mesmo padrão já usado em outras tabelas pra registrar snapshots de mudança de etapa) — não
justifica coluna própria agora.

RLS: mesmo padrão de toda tabela de domínio comercial (`company_ids && auth profile's companies`,
role-gated a `comercial`/`gerente_comercial`/`admin` — confirmar com o Daniel o nome exato do cargo que vai
operar isso, ver seção 6).

## 3. Etapas (seed em `rh_pipeline_stages`, domain-agnostic, zero mudança de schema nessa parte)

### `domain = 'comex_importacao'` (6 etapas, do documento)
| # | stageKey | Nome | Terminal? | Gatilho de passagem (vira campo obrigatório via `rh_pipeline_stage_fields`) |
|---|---|---|---|---|
| 1 | `sourcing` | Sourcing & Qualificação de Fornecedor | não | Fornecedor aprovado (compliance/qualidade) |
| 2 | `cotacao_landed_cost` | Cotação & Landed Cost | não | Landed Cost aprovado pela diretoria/financeiro |
| 3 | `po_fechamento` | PO & Fechamento Financeiro | não | PO confirmado + instrumento de pagamento definido |
| 4 | `producao_embarque` | Produção & Prontidão pra Embarque | não | Booking confirmado, Cut-Off definido |
| 5 | `transito_aduana` | Em Trânsito & Parametrização Aduaneira | não | Desembaraço concluído (canal RFB liberado) |
| 6 | `recebimento` | DTA, Transporte Nacional & Recebimento | **sim (won)** | Mercadoria nacionalizada e conferida |

### `domain = 'comex_exportacao'` (6 etapas, do documento)
| # | stageKey | Nome | Terminal? | Gatilho de passagem |
|---|---|---|---|---|
| 1 | `qualificacao_comprador` | Qualificação do Comprador Internacional | não | Crédito/risco aprovado |
| 2 | `analise_regulatoria` | Análise Regulatória & Precificação por Incoterm | não | Matriz de custos aprovada |
| 3 | `proforma_negociacao` | Proforma Invoice & Negociação | não | PI aceita pelo comprador |
| 4 | `order_entry_producao` | Order Entry & Instrução de Produção | não | Produção concluída, lote pronto |
| 5 | `embarque_despacho` | Gestão do Embarque & Despacho | não | Carga embarcada (Averbação RFB) |
| 6 | `liquidacao` | Documentos Originais & Liquidação Cambial | **sim (won)** | Câmbio liquidado, documentos entregues |

Ambas seguem o padrão já usado em toda seed de domínio (cor, ordem, `sla_days` sugerido — a definir com o
Daniel por etapa, mesmo espírito de `PURCHASE_STAGES.slaDays`).

## 4. Campos por etapa (via `rh_pipeline_stage_fields`, reaproveitado, zero schema novo)

Não centralizados em coluna — cada etapa ganha os campos do documento relevantes àquele momento, editáveis
depois pelo próprio "Editar campos desta etapa" (StageFieldsPanel, já existe). Exemplos de mapeamento
(não exaustivo — o editor já é a ferramenta certa pra ajustar isso depois, sem precisar de código):

- Importação, etapa "Cotação & Landed Cost": `ncm` (texto), `incoterm` (select: EXW/FOB/CIF/DDP/FCA/CPT),
  `modal` (select: Marítimo/Aéreo/Rodoviário).
- Importação, etapa "PO & Fechamento Financeiro": `po_number` (texto), `payment_instrument` (select: Carta
  de Crédito/Câmbio Antecipado/Outro).
- Importação, etapa "Em Trânsito & Parametrização Aduaneira": `bl_hawb_number` (texto), `di_duimp_number`
  (texto), `rfb_channel` (select: Verde/Amarelo/Vermelho) — **obrigatório antes de avançar** (motor de campo
  obrigatório por etapa já existe e enforça isso, mesma regra de todos os outros boards).
- Exportação, etapa "Proforma Invoice & Negociação": `pi_number` (texto), `payment_terms` (select: L/C,
  Pagamento Antecipado, Caderneta).
- Exportação, etapa "Gestão do Embarque & Despacho": `due_number` (texto, DU-E), `bl_hawb_number` (texto).

## 5. Calculadora de Landed Cost — única peça genuinamente nova de engenharia

Sem precedente na plataforma (confirmado — `src/utils/currency.js` só tem BRL). Escopo mínimo pra Fase 1:

- **Câmbio manual, não automático**: campo `ptax_rate` digitado pelo usuário no momento do cálculo — nada de
  integração com API de câmbio nesta fase (fora de escopo, precisaria de decisão própria sobre fonte/custo
  de API). Documentar isso claramente na UI ("PTAX do dia, digite manualmente").
- **Impostos e taxas: estimativa, não motor fiscal.** O documento cita II/IPI/PIS/COFINS/ICMS por NCM — isso
  exigiria uma tabela de alíquotas por NCM (matéria de compliance fiscal real, fora do escopo de um CRM).
  O que a Fase 1 entrega: 2 campos de estimativa em BRL (`estimated_taxes_brl`, `estimated_fees_brl`) que o
  usuário preenche com base no que já sabe/já calculou fora — o card mostra o Landed Cost total consolidado,
  não pretende ser o motor de cálculo fiscal.
- **Novos utils de moeda**: `src/utils/currency.js` ganha `formatUSD`/`formatCurrency(value, code)` (ou
  equivalente) — extensão aditiva, não mexe nas funções BRL existentes.
- **UI**: dentro da aba "Form" do card de Importação, uma seção "Landed Cost" com os campos de entrada
  (moeda, FOB, frete, seguro, PTAX, impostos estimados, taxas estimadas) e o total consolidado em BRL
  calculado ao vivo conforme o usuário digita — sem salvar o total como coluna (ver seção 2).

## 6. Reaproveitamento confirmado (nenhuma dessas peças é código novo)

| Peça | Componente/hook já existente |
|---|---|
| Board Kanban (colunas, scroll, altura) | `KanbanColumnHeader`, `KanbanBoardScrollArea`, `useAvailableHeight` |
| Botão flutuante de criar | `KanbanFab` |
| Menu "mover/duplicar/excluir" | `MoveStageMenu` (já suporta `onDuplicate`) |
| Toggle Kanban/Análise | `ViewToggleButton` |
| Dashboard de Análise | `KanbanAnalyticsPanel` (specificStats = ex. Landed Cost médio, operações c/ canal Vermelho) |
| Shell do modal de detalhe | `SplitPanelDrawer` + `DetailDrawerTabs` (Form/Atividades/Anexos/Checklist) |
| Etapas configuráveis | `rh_pipeline_stages` / `useRHPipelineStages("comex_importacao"|"comex_exportacao")` |
| Campos por etapa | `rh_pipeline_stage_fields` / `useRHStageFields(domain)` + `StageFieldsPanel` |
| Documentos (BL, Invoice, Packing List...) | `rh_attachments` (domain novo, migration aditiva — mesmo padrão já feito 3x) |
| Checklist dentro do card | `rh_checklists` (domain novo, mesma migration aditiva) |
| Duplicar Card | `MoveStageMenu` + `duplicateX` no novo hook (mesmo padrão dos outros 7 hooks) |

**Única peça que precisa de trabalho extra além do "encaixar no padrão"**: `pipeline_stage_transitions` —
hoje hardcoded pro domínio `comercial` (`DOMAIN = "comercial"` fixo no hook, CHECK constraint sem os novos
domains). Se o Comex precisar de matriz de transição restrita (nem toda etapa pode ir pra qualquer outra),
isso pede: (a) migration alargando o CHECK, (b) generalizar `use-pipeline-transitions.js` pra aceitar
`domain` como parâmetro. **Fica como decisão em aberto** — se o Daniel topar transição livre (como a
maioria dos boards de RH, sem matriz restrita) nesta 1ª rodada, essa peça fica de fora e simplifica bastante.

## 7. Navegação (3 arquivos, edições pequenas — sem tabela nova aqui)

- `src/constants/routes.js`: `comexImportacao: "/comex/importacao"`, `comexExportacao: "/comex/exportacao"`.
- `src/utils/module-access.js`: novos ids `comex-importacao`/`comex-exportacao` no grupo "Comercial" de
  `MODULE_GROUPS` + `defaultModulesForRoles()`.
- `src/App.jsx`: 2 novos itens no grupo "Comercial" da sidebar (provavelmente com toggle
  Importação/Exportação dentro de uma única entrada "Comex", igual Vagas/Candidatos em Recrutamento, não 2
  entradas separadas na sidebar) + rotas.

## 8. Decisões ainda em aberto (perguntar ao Daniel antes de implementar)

1. **Cargo/role**: quem opera isso — `comercial` existente ganha acesso, ou precisa de um cargo/role novo
   tipo `comex`? Afeta RLS das 2 tabelas novas e `defaultModulesForRoles()`.
2. **Matriz de transição restrita ou livre** (seção 6) — decide se `pipeline_stage_transitions` entra
   nesta rodada ou fica pra depois.
3. **`sla_days` por etapa** — o documento não sugere prazos; preciso de uma estimativa realista por etapa
   (ex.: quantos dias é razoável ficar em "Em Trânsito" antes de virar alerta?) pra alimentar o badge de SLA
   já existente no cabeçalho da coluna.

## 9. Verificação (quando for implementar)

1. Migration aplicada via `mcp__Supabase__apply_migration` **só depois** de confirmação explícita do Daniel
   nesta spec (schema real, regra 5 do CLAUDE.md).
2. `npx vite build` limpo.
3. Criar uma operação de Importação e uma de Exportação ponta a ponta: stage inicial → editar campos por
   etapa → preencher Landed Cost e conferir o total calculado → mover pelas 6 etapas até a etapa terminal →
   Duplicar Card → aba Análise mostrando specificStats de Comex → anexar um documento na aba Anexos.
4. Nenhuma classe de bug conhecida reintroduzida (campo obrigatório bloqueando certo, SLA batendo com o
   cabeçalho da coluna, sem "R$ R$" duplicado nos novos utils de moeda).
