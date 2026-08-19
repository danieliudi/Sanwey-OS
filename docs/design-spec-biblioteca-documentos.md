# Spec — Biblioteca de Documentos Técnicos (reutilizável, sem reenvio por negócio)

Status: investigação/spec, **nada implementado**. Schema/RLS/Storage novos —
precisam confirmação explícita do Daniel antes de aplicar (CLAUDE.md regra 5).

## 1. Padrão-referência encontrado (mais novo, pós-correção de RLS)

Gap real hoje: `lead_attachments` é 100% escopado a `lead_id`, path
`${leadId}/${timestamp}-${rand}.ext`
(`supabase/migrations/20260713_fix_lead_attachments_storage_scope.sql:10,20,31`,
espelhado em `src/hooks/use-lead-attachments.js:40`). Não existe conceito de
documento reutilizável.

O padrão mais recente e correto pra "anexo genérico multi-domínio" já existe:
**`rh_attachments`** (tabela) + bucket **`rh-attachments`** (Storage), criado
em `supabase/migrations/20260707_rh_pipeline_customization.sql:51-61` (colunas:
`domain text`, `record_id uuid`, `file_name`, `file_path`, `file_size`,
`mime_type`, `uploaded_by`) com índice `(domain, record_id)` (linha 62). Path
convention: `${domain}/${record_id}/...` — confirmado em
`20260825b_rh_attachments_marketing_deliverables_campaigns_domains.sql:71,84`
via `(storage.foldername(name))[1]`/`[2]`.

O ponto crítico (regra 3.1 do CLAUDE.md — "policy nova compara com o
predicado já em produção na tabela-irmã"): as duas correções de segurança
mais recentes sobre Storage (`20260825_sec_storage_deliverable_campaign_attachments_scope.sql:28-70`
e `20260825b_...:16-64,68-124`) mostram o padrão certo — a policy de
`storage.objects` **não reimplementa** a regra de acesso; ela faz `EXISTS`
contra a tabela de metadados (SELECT/DELETE, via `file_path = objects.name`)
ou contra a tabela-pai (INSERT, via primeiro/segundo segmento do path com
`storage.foldername`), reusando a mesma função de predicado
(`current_user_is_marketing()`, `agencia_sees_supplier()`,
`company_ids && current_user_companies()`) já usada na policy da tabela
"irmã". Antes disso (fix de 13/07,
`20260713_fix_lead_attachments_storage_scope.sql:14-21`), a policy de Storage
só checava `bucket_id = '...'` sem NENHUM filtro por usuário — bug real de
Storage cross-empresa. **Não copiar o modelo de `lead-attachments` como
referência de isolamento — copiar o modelo pós-fix de `rh-attachments`.**

## 2. Schema proposto — `document_library`

```
id                uuid pk default gen_random_uuid()
title             text not null
category          text not null check (category in ('certificado','datasheet','manual','ficha_tecnica','outro'))
tags              text[] not null default '{}'   -- segmento/modelo Sanbag (ex.: 'sanbag-standard','iso-9001')
company_ids       uuid[] not null default '{}'   -- isolamento — mesmo padrão array de marketing_campaigns.company_ids
file_name         text not null
file_path         text not null                  -- bucket document-library, path abaixo
file_size         bigint
mime_type         text
expires_at        date                            -- opcional, só certificado com validade (ISO/INMETRO/FSSC)
uploaded_by       uuid references public.profiles(id) on delete set null
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
```

`company_ids` como array (não `company_id` singular) segue o padrão já
validado em `marketing_campaigns`/`marketing_campaign_attachments` (citado em
`20260825_sec_storage_deliverable_campaign_attachments_scope.sql:81`) — um
datasheet Sanbag pode servir Sanwey e Resibag ao mesmo tempo; um certificado
ISO 9001 corporativo pode não ter empresa nenhuma restrita (array vazio =
visível a nenhuma, mesmo comportamento já documentado em
`FornecedoresView.jsx` sobre o guard de `company_ids` vazio — reaproveitar o
mesmo guard client-side no formulário de upload).

Bucket novo: **`document-library`**, privado, mesmo molde de criação do
bucket `rh-attachments` (`20260707_rh_pipeline_customization.sql:157-162`).
Path: `${document_library_id}/${timestamp}-${rand}.ext` — não precisa de
prefixo de domínio (não é multi-domínio como `rh_attachments`, é uma
biblioteca só).

## 3. RLS proposta

Predicado mais próximo: `marketing_campaign_attachments`/
`marketing_campaigns` (RLS por `company_ids && current_user_companies()`
combinada com papel), não o modelo `vendedor`-dono-do-lead de
`lead_attachments` (`20260713_fix_lead_attachments_storage_scope.sql:53-71`)
— porque a biblioteca não pertence a um vendedor, pertence à empresa/módulo
comercial inteiro.

- **Gestão (upload/editar/apagar)** — `current_user_is_admin()` OR papel de
  marketing/gestão comercial com `company_ids && current_user_companies()`.
  Não é todo vendedor — espelha o `current_user_is_marketing()` já usado em
  `mca_storage_insert` (`20260825_sec_storage_deliverable_campaign_attachments_scope.sql:111-124`).
  Decisão em aberto pro Daniel: reaproveitar `current_user_is_marketing()`
  puro, ou criar variante `current_user_manages_document_library()` restrita
  a admin/gerente comercial — registrar como opção A/B na revisão de Design,
  não decidir sozinho (regra 3).
- **Leitura/anexar (todo vendedor do módulo comercial)** — `SELECT` liberado
  a qualquer `current_user_role() IN ('vendedor','gerente','consultor')` com
  `company_ids && current_user_companies()` — mesmo predicado de leitura já
  usado em `attachments_select`/`leads_select` para o módulo comercial
  (`20260713_fix_lead_attachments_storage_scope.sql:54,57,66`), só trocando
  `company_id = ANY(...)` por `company_ids && ...` (array).
- **Storage (`document-library` bucket)** — 3 policies (`select`/`insert`/
  `delete`), cada uma fazendo `EXISTS` contra `document_library` via
  `file_path = objects.name` (SELECT/DELETE) ou primeiro segmento do path
  (INSERT, registro ainda não existe) — mesma estrutura de
  `20260825_sec_storage_deliverable_campaign_attachments_scope.sql:28-70`.
  Nunca reimplementar o predicado dentro da policy de Storage.

## 4. "Anexar da biblioteca" sem duplicar arquivo — `lead_document_refs`

```
id                    uuid pk default gen_random_uuid()
lead_id               uuid not null references public.leads(id) on delete cascade
document_library_id   uuid not null references public.document_library(id) on delete cascade
attached_by           uuid references public.profiles(id) on delete set null
created_at            timestamptz not null default now()
unique (lead_id, document_library_id)
```

Só a referência é gravada — nenhum arquivo é copiado pro bucket do lead.
Resolve a pergunta "documento atualizado, link antigo aponta pro registro
certo?": sim, porque `lead_document_refs` guarda `document_library_id`, não
`file_path`. Se o certificado for **atualizado no lugar** (novo upload
sobrescrevendo o mesmo registro `document_library`, mesmo `id`), todo lead
que já referenciou esse `id` automaticamente enxerga a versão nova — o
comportamento desejado pra "single-source-of-truth". Se em vez disso a
prática for **criar um novo registro** por revisão de certificado (auditoria
de validade mais rastreável, já que `expires_at` é por linha), o link antigo
fica congelado na versão que foi anexada — decisão de produto a confirmar
com o Daniel na etapa de Design, não código: registrar a opção escolhida
(sobrescrever vs. nova revisão) antes de implementar.

RLS de `lead_document_refs`: espelha `lead_attachments`
(`20260713_fix_lead_attachments_storage_scope.sql:49-72`) pro lado do lead
(mesmo dono/gerente/vendedor) **E** exige que o `document_library_id`
referenciado seja visível pela RLS de leitura de `document_library` (regra 3
acima) — sem isso um vendedor poderia referenciar um documento de empresa
que não enxerga.

## 5. UI proposta

**Tela de gestão — "Biblioteca de Documentos"** (rota nova, catálogo):
reaproveita `CardGrid`/`Card` (`src/components/shared/Card.jsx:10,24`, com
densidade grade/lista já embutida — `GridListToggle` linha 251) +
`FilterBar` (`src/components/shared/FilterBar.jsx:14`) pra filtrar por
categoria/tags/empresa — mesmo padrão de `FornecedoresView.jsx` (regra 6 do
CLAUDE.md). Card = link (abre detalhe/edita), não checkbox — variante
"catálogo" do componente. Botão de exclusão segue o padrão canônico
"Fornecedores" (`Trash2` no slot `menu`, `ConfirmDeleteModal` sobre
`Modal.jsx` — CLAUDE.md seção "Padrão de exclusão").

**Seletor "Anexar da biblioteca" dentro do `LeadDetailDrawer`**: hoje a aba
Anexos monta `AttachmentsPanel` em
`src/components/lead/LeadDetailDrawer.jsx:1138-1145` (`useLeadAttachments`
importado linha 23, hook usado linha 1987). Adicionar um botão "Anexar da
biblioteca" ao lado do upload de arquivo existente nesse painel, abrindo um
modal com `CardGrid`/`FilterBar` (mesma tela de catálogo em modo
seletor/checkbox, reaproveitando a variante já decidida na regra 6) filtrado
por `company_ids && [lead.companyId]`; ao confirmar, grava em
`lead_document_refs` (não em `lead_attachments`) — a lista renderizada da aba
Anexos passa a mesclar `attachments` (arquivo próprio do lead) +
`lead_document_refs` resolvidos (nome/categoria/validade do
`document_library`), com um badge visual distinguindo "anexo próprio" de
"da biblioteca". Este é um layout novo dentro de um componente existente —
mockup obrigatório antes de codar (CLAUDE.md regra 3).

## 6. O que muda (confirmação explícita antes de aplicar)

- **Schema: SIM** — 2 tabelas novas (`document_library`,
  `lead_document_refs`).
- **RLS: SIM** — policies novas nas 2 tabelas + Storage.
- **Storage: SIM** — bucket novo `document-library` (não reaproveitar
  `lead-attachments` nem `rh-attachments` — domínio e ciclo de vida
  diferentes: biblioteca não pertence a um lead nem a RH).
- **Segurança**: roda pelo `security-agent` (schema+RLS+Storage novos, regra
  3.1) antes de qualquer aplicação — checklist inclui isolamento por
  `company_ids` (classe de bug já encontrada: `clients` sem isolamento,
  Storage cross-fornecedor) e `get_advisors` depois da migration.
- **Painel Executivo / changelog / spotlight**: se aprovado e implementado,
  é feature nova e visível — changelog + versão (regra 10) e
  `data-tour`/`FEATURE_SPOTLIGHTS` (regra 12) fazem parte de "pronto", não
  são follow-up.
