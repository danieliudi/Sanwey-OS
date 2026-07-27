# Padronização do modal de detalhe de card (Kanban) — baseline genérico + fechamento do gap Marketing/RH

Decidido com o Daniel em 27/07/2026, via `AskUserQuestion`: rodada única (Marketing + RH, não faseada) e
"Mover cards com IA" continua exclusivo de Campanhas/Entregas. Gatilho: o board "Tarefas" (Marketing) abre
um modal flat (sem abas) enquanto "Campanhas" abre um modal rico com abas. Esta spec cobre **todo modal de
card da plataforma** — os que já têm abas, os que não têm, e o que falta pra ficarem consistentes.

Esta spec só cobre o **modal/drawer de detalhe do card** (o que abre ao clicar num card do Kanban). O editor
de campos/etapas (`StageFieldsPanel` e afins) já foi padronizado em outra rodada — não é tocado aqui.

## 0. Achado que corrige a premissa inicial da tarefa — leia antes do resto

A tarefa que originou esta spec partiu da premissa de que os 5 arquivos de view de RH (`RHFeriasView.jsx`,
`RHOnboardingView.jsx`, `RHTreinamentosView.jsx`, `RHFeedbackView.jsx`, `RHRecrutamentoView.jsx`) duplicam à
mão o overlay (`position:fixed;inset:0`) e **não** usam `SplitPanelDrawer`. Isso **não é mais verdade** — os
7 drawers de detalhe de RH (os 5 arquivos + `VagaDrawer`/`CandidatoDrawer` dentro de
`RHRecrutamentoView.jsx`) já retornam `<SplitPanelDrawer onClose={...} header={...} left={...} center={...}
right={...} onDelete={...} />` como último elemento de cada função. Os `position:fixed;inset:0` que ainda
existem nesses arquivos são de **outros** modais (ex. `NewStageModal`, `SolicitarFeriasModal`,
`RecusarFeriasModal`, `NovaTemplateModal`, `EncaminharGestorModal`) — não o drawer de detalhe do card, que já
foi migrado numa rodada anterior (o comentário em `RHDetailDrawerShell.jsx:606-610` confirma: "Separado de
RHDetailDrawerShell... desde a unificação visual com a referência do Pipefy").

Confirmado por leitura direta de cada arquivo:

| Arquivo | Função do drawer | Return (`SplitPanelDrawer`) |
|---|---|---|
| `src/components/views/RHFeriasView.jsx` | `FeriasDrawer` (L568-765) | L754-764, com `onDelete` |
| `src/components/views/RHOnboardingView.jsx` | `OnboardingDrawer` (L431-687) | L684-686, **sem** `onDelete` |
| `src/components/views/RHTreinamentosView.jsx` | `AtribuicaoDrawer` (L727-937) | L926-936, com `onDelete` |
| `src/components/views/RHFeedbackView.jsx` | `FeedbackDrawer` (L818-1046) | L1037-1047, com `onDelete` |
| `src/components/views/RHRecrutamentoView.jsx` | `VagaDrawer` (L998-1290) | L1280-1289, com `onDelete` |
| `src/components/views/RHRecrutamentoView.jsx` | `CandidatoDrawer` (L1719-2140) | L2131-2140, com `onDelete` |

`OnboardingDrawer` não passa `onDelete`/`deleteLabel` pro `SplitPanelDrawer` — hoje não dá pra excluir um
colaborador em onboarding pelo drawer. Não faz parte do que foi pedido nesta rodada (ninguém pediu exclusão
de onboarding); só registro o achado — **não mexer** nisso aqui.

**O que realmente falta em RH** (e é o que a Seção 5 desta spec resolve): o *molde* (`SplitPanelDrawer`) já
está certo; o que diverge do baseline Marketing/Lead é que os campos específicos do domínio (o "Form") ainda
não são uma aba — vivem soltos, ora dentro de `center` acima do `RHDetailDrawerShell`, ora (só em
Treinamentos) dentro de `left`. Detalhe completo na Seção 5.

---

## 1. Baseline genérico obrigatório

Todo modal de detalhe de card — existente e futuro, qualquer departamento — segue isto:

| Slot | Regra |
|---|---|
| **Shell** | Sempre `src/components/shared/SplitPanelDrawer.jsx` (130 linhas). Nunca reimplementar overlay/header à mão — é a mesma classe de bug que já foi corrigida antes na plataforma (RC3, moldura duplicada). |
| **Right** | Sempre `StageNavigator` (`src/components/shared/StageNavigator.jsx`) + `CommentsPanel` (ou o wrapper `RHDetailComments`, que já é `CommentsPanel` por baixo — ver `RHDetailDrawerShell.jsx:611-633`). Já é assim em toda a plataforma hoje — esta seção só formaliza como regra, não muda nada. |
| **Center** | Uma tab strip com, no mínimo e nesta ordem: **Form (conteúdo específico do domínio) → Atividades (timeline de eventos) → Anexos → Checklist**. Extras por departamento (IA em Campanhas/Entregas; Histórico em RH; PDF/Proposta em Lead) continuam permitidos **em cima** desse baseline — nunca substituindo Form/Atividades/Anexos/Checklist quando existirem dados pra eles. |
| **Left** | Livre por domínio — já é assim em todo lugar (stats do registro, listas read-only, campos de contexto). Não padronizar conteúdo, só confirmar que a coluna existe e que nada que devia estar em Form/Atividades foi deixado ali "porque sim". |

### 1.1 Achado extra: onde o tab strip mora hoje difere por família — decisão de escopo

Ao mapear os 3 arquivos com abas hoje, achei uma divergência que a tarefa original não previu: o tab strip
de pílulas **não** fica sempre em `center`.

- **Campaign/Deliverable** (`CampaignDetailDrawer.jsx`, `DeliverableDetailDrawer.jsx`): o tab strip
  (`SideTabs`) fica dentro de **`left`** (`CampaignDetailDrawer.jsx:1473-1500`,
  `DeliverableDetailDrawer.jsx:764-798`). `center` nesses dois arquivos é o formulário condicional por etapa
  (`BriefingFields`/`AprovacaoFields`/etc. em Campaign; "Responsáveis" + "Campos desta etapa" em
  Deliverable) — sem abas.
- **RH** (`RHDetailDrawerShell`): o tab strip fica dentro de **`center`** — é chamado de dentro do bloco
  `center` em todos os 7 drawers (ex. `RHFeriasView.jsx:680-688`, `RHTreinamentosView.jsx:914-924`).

**Decisão pra esta rodada**: adoto `center` como posição canônica do tab strip daqui pra frente (é onde RH
já está, é onde as abas novas de Tarefas/Compras vão entrar, e `center` é a coluna larga —
`flex-1 min-w-0` — o que acomoda melhor uma tab strip com várias pílulas do que as colunas laterais fixas em
300px). **Não vou mexer em `CampaignDetailDrawer.jsx`/`DeliverableDetailDrawer.jsx` pra realocar o tab strip
de `left` pra `center`** — não foi pedido, os dois já resolvem o problema original do Daniel (modal com
abas), e mexer no layout de dois drawers maduros sem necessidade funcional é risco sem ganho (mesmo racional
que already justifica a exceção documentada do Compras no CLAUDE.md regra 2). A extração do componente de
aba (Seção 2) é column-agnostic — funciona tanto dentro de `left` (Campaign/Deliverable, sem mudança de
posição) quanto dentro de `center` (RH, Tarefas, Compras) — então a consolidação de código não depende de
mexer no layout. Se o Daniel quiser unificar a posição física também, é um follow-up separado, não parte
desta rodada.

---

## 2. Extrair o tab-pílula pra `src/components/shared/DetailDrawerTabs.jsx`

O mesmo componente visual de "tab strip em pílulas" está implementado **3 vezes**, quase byte-idênticas, e
esta rodada adiciona pelo menos **+2 usos** (Tarefas, Compras) — já passou muito do limite de 3ª ocorrência
da regra 4 do CLAUDE.md.

| Cópia | Arquivo:linha | Estilo |
|---|---|---|
| `SideTabs` (1ª) | `src/components/campaign/CampaignDetailDrawer.jsx:56-82` | `className` Tailwind |
| `SideTabs` (2ª) | `src/components/campaign/DeliverableDetailDrawer.jsx:43-72` | `style={{...}}` inline, valores idênticos à 1ª |
| `RHSideTabs` (3ª) | `src/components/rh-pipeline/RHDetailDrawerShell.jsx:15-42` | `className` Tailwind, idêntico à 1ª exceto prop `activeTab` em vez de `activeId` |

As três renderizam exatamente: `flex flex-wrap`, `gap` de 4px, pílula com `padding: 4px 10px` (`px-2.5
py-1`), `border-radius: 9999` (`rounded-full`), `font-size: 11px`, `font-weight: 600`; ativa =
`background: var(--surface)`, `color: var(--accent)`, `border: 1px solid var(--accent)`; inativa =
`background: transparent`, `color: var(--text-dim)`, `border: 1px solid var(--border)`, hover inativa =
`background: var(--surface)`.

### Especificação visual — `DetailDrawerTabs.jsx` (novo arquivo)

Não muda nenhum valor visual — só consolida o código das três cópias acima, byte-idênticas em resultado.

```jsx
// src/components/shared/DetailDrawerTabs.jsx
import React from "react";

// Tab strip em pílulas do drawer de detalhe de card — consolidado de 3 cópias
// quase idênticas (CampaignDetailDrawer.SideTabs, DeliverableDetailDrawer.SideTabs,
// RHDetailDrawerShell.RHSideTabs). Nenhum valor visual mudou nesta extração.
export function DetailDrawerTabs({ tabs, activeId, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map(t => {
        const active = t.id === activeId;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color:      active ? "var(--accent)" : "var(--text-dim)",
              border:     `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >
            {Icon && <Icon size={11} />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default DetailDrawerTabs;
```

`tabs` = `[{ id, label, icon? }]`. Prop chamada `activeId` (não `activeTab`) — os 3 consumidores existentes
convergem pra esse nome; `RHDetailDrawerShell` precisa renomear a variável de estado interna ao trocar pra
importar daqui (não muda comportamento, só o nome da prop passada).

### Comportamento

- **Antes**: `CampaignDetailDrawer.jsx`, `DeliverableDetailDrawer.jsx` e `RHDetailDrawerShell.jsx` definem e
  usam a própria função local `SideTabs`/`RHSideTabs`.
- **Depois**: os 3 importam `DetailDrawerTabs` de `../shared/DetailDrawerTabs` e removem a função local. Os
  novos consumidores (Tarefas — Seção 3, Compras — Seção 4) importam o mesmo componente desde o início, sem
  nunca ter tido uma cópia própria.
- Nenhuma mudança de posição de coluna nesta extração (ver 1.1) — só troca de import.

### Nota sobre `AtividadesTab`/`ActivityLog`/`RHActivitiesPanel` — não extrair

A tarefa original pediu pra avaliar se o conteúdo da aba Atividades também merece extração. Não merece,
porque os três já divergem de verdade nos dados que consomem, não só na casca:

- `ActivityLog` (`CampaignDetailDrawer.jsx:426-445`) e o mesmo componente reaproveitado em `MarketingTaskDetailDrawer` (Seção 3) consomem `activities: [{ type, description, at }]` — texto pronto em `description`.
- `AtividadesTab` (`DeliverableDetailDrawer.jsx:232-256`) consome o mesmo formato `{ type, description, at }`, mas adiciona cor por `type` (`stage_change`/`field_save`/`note_added`/`created`) — já é uma pequena divergência de apresentação sobre o mesmo schema.
- `RHActivitiesPanel` (`RHDetailDrawerShell.jsx:80-120`) consome um schema **diferente**: `{ id, type, body, createdBy, createdAt }`, e resolve o nome do autor via `authorLabel(createdBy, currentUser, users)` — RH usa `activities` também pra guardar comentários (`type: "comment"`), o que Marketing não faz (comentários de Marketing vivem em `campaign.notes`/`item.notes`, um array separado).

Forçar um único componente aqui exigiria normalizar os dois schemas de `activities` primeiro (mudança de
dados, não de apresentação) — fora do que foi pedido. Documento a divergência e **não** extraio.

---

## 3. Marketing → Tarefas (`MarketingTaskDetailDrawer.jsx`) — fechar o gap

### Problema observado

`src/components/campaign/MarketingTaskDetailDrawer.jsx` (487 linhas) já usa `SplitPanelDrawer` (L477-486) e
já tem `right` = `StageNavigator` + `CommentsPanel` (L445-474) — só falta o `center`, que hoje é um único
bloco "Detalhes da tarefa" sem abas (L350-443): título/descrição/prioridade/prazo/responsáveis/campanha
vinculada + campos customizados da etapa (`useRHStageFields("marketing_tasks")`, L83-84). Não há nenhum
import de hook de anexo/checklist neste arquivo — a tabela/domínio não existe pra tarefas (confirmado por
`grep` — zero ocorrências de `Attachment`/`Checklist` no arquivo).

### Especificação visual

`center` passa a ser uma `DetailDrawerTabs` (Seção 2) com 2 abas nesta rodada:

| Aba | id | Conteúdo | Ícone (lucide) |
|---|---|---|---|
| Form | `form` | Exatamente o conteúdo atual de `center` (L350-443), sem nenhuma mudança de campo/validação | `FileText` |
| Atividades | `atividades` | `item.activities` (já populado com `stage_change` no `handleMoveStage`, L256-263, e `field_save` no `handleFieldChange`, L140), reaproveitando o componente `ActivityLog` já usado em `CampaignDetailDrawer` (Seção 2 — não extraído, mas reaproveitável como está: mesmo schema `{type, description, at}`) | `Activity` |

`left` (L294-348) e `right` (L445-474) **não mudam** — inclusive o mini-bloco "Histórico de Etapas" em
`left` (L332-346, filtrado só a `stage_change`) continua existindo mesmo com a aba Atividades mostrando
todos os tipos — isso **não é duplicação nova**: é o mesmo padrão que `DeliverableDetailDrawer.jsx` já usa
hoje (`left:710-725` tem o mesmo mini-histórico, e a aba Atividades mostra os `stage_change` de novo,
lado a lado). Não "corrigir" essa sobreposição aqui — ela já é aceita na família Marketing.

### Antes / depois (esqueleto)

```jsx
// Antes — MarketingTaskDetailDrawer.jsx:350-443 (center sem abas)
const center = (
  <div>
    <div style={{ ...saveStatus header... }}>...</div>
    {canWrite ? (<>{/* Título, Descrição, Prioridade, Prazo, Responsáveis, Campanha */}</>) : (<>...</>)}
    {visibleCustomDefs.length > 0 && (<div>{/* Campos adicionais da etapa */}</div>)}
  </div>
);
```

```jsx
// Depois
const [centerTab, setCenterTab] = useState("form");

const center = (
  <>
    <DetailDrawerTabs
      tabs={[
        { id: "form",       label: "Form",       icon: FileText },
        { id: "atividades", label: "Atividades", icon: Activity },
      ]}
      activeId={centerTab}
      onChange={setCenterTab}
    />
    {centerTab === "form" && (
      <div>
        {/* conteúdo idêntico ao "Antes" acima, sem nenhuma alteração de campo */}
      </div>
    )}
    {centerTab === "atividades" && <ActivityLog activities={item.activities || []} />}
  </>
);
```

`ActivityLog` precisa ser importado ou reimplementado localmente (ele hoje é uma função privada, não
exportada, de `CampaignDetailDrawer.jsx:426-445`) — mais simples exportar essa função de
`CampaignDetailDrawer.jsx` e importar nos dois lugares (Tarefas e, futuramente, Compras se ganhar
`activities`) do que duplicar o corpo pela 3ª vez.

### Comportamento

- Aba default ao abrir o drawer: `form` (nunca `atividades`) — consistente com Campaign/Deliverable, que
  também abrem em `form`.
- Trocar de card (`item.id` muda) reseta pra `form` — mesmo padrão do `useEffect` de reset já existente em
  `MarketingTaskDetailDrawer.jsx:98-124` (só adicionar `setCenterTab("form")` nesse mesmo efeito).
- **Anexos e Checklist não entram nesta rodada** — ver Seção 6 (schema pendente).

### Notas de decisão subjetiva

Nenhuma central — a única escolha (ordem Form → Atividades, ícones) segue diretamente o padrão já
estabelecido em Campaign/Deliverable, não é uma decisão nova.

---

## 4. Marketing → Compras (`PurchaseRequestDetailDrawer.jsx`) — fechar o gap parcialmente

### Problema observado

`src/components/campaign/PurchaseRequestDetailDrawer.jsx` (858 linhas) já usa `SplitPanelDrawer` (L846-855)
e já tem `right` = ações de aprovação + `StageNavigator` + `CommentsPanel` (L726-844). `center` (L517-722) é
inteiramente flat: "Cotação de fornecedores" (L519-565) + "Execução da compra" (L570-683) + "Nota fiscal"
(L688-720) — sem abas.

**Achado que muda o que dá pra entregar aqui**: diferente da premissa da tarefa original ("Compras tem o
mesmo padrão de `activities`"), **`marketing_purchase_requests` não tem coluna `activities`** — confirmado
por `grep -n activities` no arquivo inteiro (zero ocorrências) e na migration de criação da tabela
(`supabase/migrations/20260714_marketing_purchase_requests.sql`, que não declara essa coluna). Compare com
`marketing_tasks`, que tem `activities jsonb not null default '[]'` explícito
(`supabase/migrations/20260764_marketing_tasks.sql:29`). Isso não é um esquecimento pontual — Compras
também não usa `useRHStageFields`/`rh_pipeline_stage_fields` (é o modelo hardcoded `PURCHASE_STAGES`
documentado como exceção deliberada na regra 2 do CLAUDE.md); o histórico de mudança de etapa de Compras
vive só implicitamente no `notes`/timestamps de aprovação via RPC, não num array `activities` genérico.

**Consequência**: a aba "Atividades" pedida pra Compras **não pode ser adicionada nesta rodada sem mudança
de schema** (nova coluna `activities` em `marketing_purchase_requests`, populada nos mesmos pontos que hoje
já persistem `stage`/aprovação/rejeição). Fica junto com Anexos/Checklist na Seção 6 (fora de escopo,
aguardando aprovação do Daniel).

### Especificação visual

`center` passa a ser uma `DetailDrawerTabs` com **1 aba só** nesta rodada:

| Aba | id | Conteúdo |
|---|---|---|
| Form | `form` | Exatamente o conteúdo atual de `center` (L517-722: Cotação de fornecedores + Execução da compra + Nota fiscal), sem nenhuma mudança de campo/regra de aprovação |

### Antes / depois (esqueleto)

```jsx
// Depois
const [centerTab, setCenterTab] = useState("form"); // única aba nesta rodada

const center = (
  <>
    <DetailDrawerTabs
      tabs={[{ id: "form", label: "Form", icon: FileText }]}
      activeId={centerTab}
      onChange={setCenterTab}
    />
    {centerTab === "form" && (
      <>
        {/* conteúdo idêntico ao center atual (L519-722), sem alteração */}
      </>
    )}
  </>
);
```

### Comportamento

- Mesmo com 1 aba só, a tab strip aparece — dá a mesma "moldura" visual do resto da plataforma (consistência
  de chrome), e deixa o código pronto pra receber Atividades/Anexos/Checklist assim que o schema for
  aprovado, sem precisar reestruturar o `center` de novo.
- Nenhuma regra de aprovação/rejeição/transição de etapa muda — só o wrapper visual do `center`.

### Notas de decisão subjetiva

Havia duas opções: (a) mostrar a tab strip com 1 pílula só, ou (b) não tocar em Compras nesta rodada até que
Atividades também esteja disponível, pra não ter uma aba solitária esquisita. **Escolhi (a)** — o ganho de
consistência de chrome (todo modal de card tem uma tab strip, mesmo que hoje só com Form) supera o
estranhamento de uma pílula única, e evita reabrir este arquivo uma segunda vez só pra adicionar a tab strip
quando Atividades for aprovado. Se o Daniel preferir (b), é reverter só o wrapper `DetailDrawerTabs`, o
conteúdo interno do Form não muda de qualquer forma.

---

## 5. RH — consolidar o "Form" como primeira aba

Como a Seção 0 corrigiu: o shell (`SplitPanelDrawer`) já está certo nos 7 drawers. O que falta é que os
campos específicos do domínio — hoje um bloco solto, sem nome, renderizado **antes** de
`<RHDetailDrawerShell>` (ou, só em Treinamentos, dentro de `left`) — virem a primeira aba ("Form") da mesma
tab strip que já existe dentro de `RHDetailDrawerShell` (Atividades/Histórico/Anexos/[Checklists]).

### 5.1 Onde o "Form" vive hoje, por drawer

| Drawer | Onde fica hoje | Arquivo:linha |
|---|---|---|
| `FeriasDrawer` | Bloco em `center`, **acima** de `<RHDetailDrawerShell>` | `RHFeriasView.jsx:661-677` (campos customizados); shell logo abaixo em `:680-688` |
| `OnboardingDrawer` | Bloco em `center`, acima do shell — inclui também o checklist de integração específico (`rh_onboarding_tarefas`, não é o `RHChecklistsPanel` genérico) | `RHOnboardingView.jsx:548-571` (campos) + `:573-632` (checklist de integração); shell em `:636-646` |
| `AtribuicaoDrawer` (Treinamentos) | **Diferente dos outros 4**: certificado + campos customizados ficam em **`left`**, não em `center`; `center` é só o shell, nada mais | `RHTreinamentosView.jsx:823-846` (`certBlock`/`customBlock`, montados em `left`); `center` = só `:914-924` |
| `FeedbackDrawer` | Bloco em `center`, acima do shell — inclui também o resumo de conteúdo quando concluído | `RHFeedbackView.jsx:944-967`; shell em `:969-979` |
| `VagaDrawer` | Bloco em `center`, acima do shell — inclui também as ações (copiar link, WhatsApp, QR, editar vaga, ver candidatos, encaminhar gestor) | `RHRecrutamentoView.jsx:1104-1213`; shell em `:1216-1226` |
| `CandidatoDrawer` | Bloco em `center`, acima do shell — inclui também converter/contratar e as notas do candidato | campos em torno de `:1872-1966` (não recontado linha a linha nesta spec — ver nota abaixo), notas em `:1967-2033`; shell em `:2035-2046` |

> Nota: não recontei `CandidatoDrawer` campo a campo com a mesma precisão dos outros 5 porque a leitura desta
> rodada cobriu o início (header/left, `L1719-1870`) e o fim (notas + shell, `L1960-2140`) — o
> frontend-agent deve reconferir o miolo (`~1870-1966`) antes de recortar o bloco pro Form, mas a costura
> (envolver tudo entre o fim do `left` e o início do `RHDetailDrawerShell` numa aba) é a mesma operação dos
> outros 5.

### 5.2 Especificação — mudança em `RHDetailDrawerShell.jsx`

Adicionar uma prop `formContent` (`ReactNode`, opcional). Quando presente, prepend uma aba "Form" (`id:
"form"`, ícone `FileText`) como primeira da lista, e ela vira a aba ativa por padrão.

```jsx
// Antes — RHDetailDrawerShell.jsx:635-651
export function RHDetailDrawerShell({
  domain, recordId, activities = [], onAddActivity, currentUser,
  users = [], stages,
}) {
  const showChecklists = domain === "vagas" || domain === "candidatos";

  const tabs = useMemo(() => {
    const list = [
      { id: "atividades", label: "Atividades", icon: Activity },
      { id: "historico", label: "Histórico", icon: History },
      { id: "anexos", label: "Anexos", icon: Paperclip },
    ];
    if (showChecklists) list.push({ id: "checklists", label: "Checklists", icon: ListChecks });
    return list;
  }, [showChecklists]);

  const [tab, setTab] = useState("atividades");
  ...
```

```jsx
// Depois
export function RHDetailDrawerShell({
  domain, recordId, activities = [], onAddActivity, currentUser,
  users = [], stages, formContent,
}) {
  const showChecklists = domain === "vagas" || domain === "candidatos";

  const tabs = useMemo(() => {
    const list = [];
    if (formContent) list.push({ id: "form", label: "Form", icon: FileText });
    list.push(
      { id: "atividades", label: "Atividades", icon: Activity },
      { id: "historico", label: "Histórico", icon: History },
      { id: "anexos", label: "Anexos", icon: Paperclip },
    );
    if (showChecklists) list.push({ id: "checklists", label: "Checklists", icon: ListChecks });
    return list;
  }, [showChecklists, formContent]);

  const [tab, setTab] = useState(formContent ? "form" : "atividades");
  ...
  {tab === "form" && formContent}
  ...
```

Trocar `RHSideTabs` local por `DetailDrawerTabs` (Seção 2) nesse mesmo arquivo, e importar `FileText` de
`lucide-react` (já importado em vários dos arquivos consumidores, só falta aqui).

### 5.3 Especificação por drawer — mover o bloco existente pra `formContent`

Pra cada um dos 6 arquivos, a mudança é: **extrair o bloco de campos específicos (tabela da Seção 5.1) pra
uma variável** (ex. `const formContent = (<>...</>);` com o JSX idêntico ao que já existe hoje) **e passar
essa variável pro `<RHDetailDrawerShell formContent={formContent} .../>`** — sem alterar o JSX interno do
bloco em si (mesmos campos, mesma ordem, mesmo comportamento de leitura/escrita/debounce).

```jsx
// Antes — RHFeriasView.jsx:659-691 (padrão dos outros 4: Onboarding, Feedback, Vaga, Candidato)
const center = (
  <>
    {visibleCustomDefs.length > 0 && (
      <div>
        <div style={labelSt}>Campos desta etapa</div>
        {/* ... */}
      </div>
    )}
    <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
      <RHDetailDrawerShell domain="ferias" recordId={req.id} activities={req.activities || []}
        onAddActivity={onAddActivity} currentUser={currentUser} users={users} stages={stages} />
    </div>
  </>
);
```

```jsx
// Depois
const formContent = visibleCustomDefs.length > 0 ? (
  <div>
    <div style={labelSt}>Campos desta etapa</div>
    {/* ... idêntico ao bloco "Antes" ... */}
  </div>
) : null;

const center = (
  <RHDetailDrawerShell
    domain="ferias" recordId={req.id} activities={req.activities || []}
    onAddActivity={onAddActivity} currentUser={currentUser} users={users} stages={stages}
    formContent={formContent}
  />
);
```

Repetir a mesma operação (extrair o bloco existente pra `formContent`, sem mudar o conteúdo) em:

- `RHOnboardingView.jsx` — `formContent` inclui o bloco de campos customizados (L548-571) **e** o checklist
  de integração (L573-632, tudo dentro da mesma aba Form — não criar uma aba separada pra ele, é conteúdo do
  domínio, não um checklist genérico).
- `RHFeedbackView.jsx` — `formContent` inclui campos customizados (L944-960) **e** o resumo de "pontos
  fortes"/"a desenvolver" quando concluído (L962-967).
- `RHRecrutamentoView.jsx` (`VagaDrawer`) — `formContent` inclui campos customizados (L1104-1126) **e** o
  bloco de ações (copiar link, WhatsApp, QR, editar vaga, ver candidatos, encaminhar gestor — L1128-1213).
- `RHRecrutamentoView.jsx` (`CandidatoDrawer`) — `formContent` inclui campos customizados **e** o bloco de
  notas (L1967-2033) **e** o botão de converter/contratar.

**Treinamentos é o caso à parte** — hoje `certBlock`/`customBlock` vivem em `left` (`RHTreinamentosView.jsx:
823-846`), não em `center`. Pra ficar consistente com os outros 5 (Form dentro da tab strip, não numa coluna
separada), mover esse bloco de `left` pra virar o `formContent` de `RHDetailDrawerShell`. Quando nenhum dos
dois existir (`!certBlock && !customBlock`), `left` já vira `null` hoje (`RHTreinamentosView.jsx:841`,
`const left = (certBlock || customBlock) ? (...) : null;`) — então `left` ficar vazio depois dessa mudança
não é um comportamento novo, é o que já acontece quando a atribuição não tem certificado nem campo
customizado configurado. `SplitPanelDrawer` já tolera `left` vazio (renderiza um `<aside>` vazio, sem
quebrar layout).

### 5.4 Comportamento

- Aba default ao abrir: `form` quando existir conteúdo (`formContent` truthy); cai pra `atividades` só se
  `formContent` for `null` (ex. Ferias/Feedback sem nenhum campo customizado configurado pro estágio atual —
  nesse caso não faz sentido ter uma aba "Form" vazia).
- Aba "Histórico" continua existindo e na mesma posição relativa (depois de Atividades) — é extensão
  legítima de RH, não inconsistência a remover, conforme já determinado no brief desta tarefa.
- Aba "Checklists" continua restrita a `vagas`/`candidatos` (`showChecklists`, `RHDetailDrawerShell.jsx:639`)
  — não expandir pra outros domínios de RH nesta rodada, não foi pedido.

### 5.5 Notas de decisão subjetiva

A ordem final das abas de RH fica **Form → Atividades → Histórico → Anexos → [Checklists]** — ou seja,
"Histórico" (extensão exclusiva de RH) entra na 3ª posição, antes de Anexos/Checklist. O baseline da Seção 1
só define a ordem mínima obrigatória (Form → Atividades → Anexos → Checklist) e permite extras "em cima",
sem especificar onde um extra deve entrar. Escolhi manter Histórico logo depois de Atividades (e não, por
exemplo, como última aba) porque as duas já são conceitualmente vizinhas — "o que aconteceu com este
registro ao longo do tempo" — antes das abas de arquivo/tarefa (Anexos/Checklist). É também a mudança de
menor diff: hoje a ordem interna do `RHDetailDrawerShell` já é Atividades → Histórico → Anexos →
[Checklists] (`RHDetailDrawerShell.jsx:642-648`); esta rodada só faz *prepend* de Form, sem reordenar mais
nada.

---

## 6. Schema pendente — fora de escopo desta rodada, aguardando aprovação do Daniel

Nenhuma migration é aplicada nesta rodada. As mudanças de schema que ficariam prontas pra receber
Anexos/Checklist/Atividades em Tarefas e Compras, caso o Daniel aprove depois, são:

| Necessidade | Tabela/coluna | Precedente já existente |
|---|---|---|
| Atividades em Compras | `ALTER TABLE marketing_purchase_requests ADD COLUMN activities jsonb NOT NULL DEFAULT '[]'` | Idêntico ao que `marketing_tasks` já tem (`supabase/migrations/20260764_marketing_tasks.sql:29`) |
| Anexos em Tarefas e Compras | Ampliar `rh_attachments_domain_check` pra incluir `'marketing_tasks'` e `'marketing_purchase_requests'` | O mesmo `CHECK` **já foi ampliado duas vezes** sem trocar de tabela: `supabase/migrations/20260709_widen_rh_attachments_domain.sql` (adicionou `feedback`/`ferias`/`treinamentos`) e depois `supabase/migrations/20260716_rh_fornecedores_beneficios.sql:88-91` (adicionou `fornecedor_contratos`) — é exatamente o precedente citado no brief desta tarefa, só que já usado 2x, não 1x |
| Checklist em Tarefas e Compras | Ampliar `rh_checklists_domain_check` (hoje **hardcoded** `CHECK (domain in ('vagas','candidatos'))`, `supabase/migrations/20260707_rh_pipeline_customization.sql:68` — nunca foi ampliado, ao contrário de `rh_attachments`) pra incluir os dois novos domínios | Precisa trocar de `IN (...)` fixo pra `= ANY(ARRAY[...])`, mesmo padrão de `rh_attachments`, já que checklist hoje é deliberadamente restrito a Recrutamento |

**Decisão de arquitetura (pra quando isso for aprovado)**: reaproveitar as tabelas genéricas já existentes
(`rh_attachments`/`rh_checklists`, com `domain` + `record_id`) em vez de criar uma tabela nova dedicada (como
`marketing_deliverable_attachments`, que Entregas usa hoje e é uma arquitetura **diferente e mais antiga** —
tabela própria com FK direta `deliverable_id`, não genérica por domínio). Criar uma terceira variante de
"tabela de anexo" pra Tarefas/Compras seria exatamente o problema que a regra 4 do CLAUDE.md pede pra evitar
— o padrão genérico por domínio já existe, já foi ampliado 2x, e é o caminho de menor fricção. Essa é uma
recomendação de arquitetura pra quando o Daniel aprovar, **não uma migration aplicada agora**.

**Nomes de domínio recomendados**: `marketing_tasks` (já é o valor usado em produção por
`useRHStageFields("marketing_tasks")`, `MarketingTaskDetailDrawer.jsx:83` — reaproveitar, não inventar um
novo) e `marketing_purchase_requests` (nome da tabela real; não existe um valor de domínio já em uso pra
Compras hoje, já que este drawer nunca usou `rh_pipeline_stage_fields` — ver Seção 4 — então este é o
primeiro precedente e segue o padrão "domínio = nome da tabela" já usado por `marketing_tasks`).

Até aprovação explícita, os itens desta seção ficam **fora de escopo** — não implementar, e não simular com
placeholder vazio (ex. uma aba "Anexos" que sempre mostra "nenhum anexo" sem hook nenhum por trás seria pior
que não ter a aba: passa a impressão de feature pronta quando não está).

---

## 7. Fora de escopo (consolidado)

- Nenhuma migration/schema é aplicada nesta rodada (Seção 6).
- "Mover cards com IA" não se espalha pra mais domínios — continua exclusivo de Campanhas/Entregas.
- `LeadDetailDrawer.jsx` (CRM) não muda — já é a referência mais rica, inspiração mas não edição.
- Motor de aprovação/transição de etapa do Compras (`PURCHASE_STAGES`, RPCs `approve_purchase_request`/
  `reject_purchase_request`) não é tocado — só o wrapper visual do `center` (Seção 4).
- Relocação física do tab strip de `left` pra `center` em `CampaignDetailDrawer.jsx`/
  `DeliverableDetailDrawer.jsx` não é feita nesta rodada (Seção 1.1) — só a extração do componente.
- `onDelete` ausente em `OnboardingDrawer` (Seção 0) não é adicionado — não foi pedido.
- Ampliar `showChecklists` de RH pra além de `vagas`/`candidatos` não é feito — Checklist continua exclusivo
  de Recrutamento.

## 8. Verificação (pra QA)

Depois da implementação, conferir:

- [ ] `npx vite build` passa sem erro.
- [ ] Nenhum modal de card (Tarefas, Compras, os 7 de RH, Campanhas, Entregas, Lead) reimplementa overlay à
      mão — todos passam por `SplitPanelDrawer`.
- [ ] Tarefas: abrir um card, ver 2 abas (Form, Atividades); aba Form idêntica ao comportamento anterior
      (mesmos campos, mesma validação, mesmo debounce de 600ms); aba Atividades mostra `stage_change` e
      `field_save` com data.
- [ ] Compras: abrir uma solicitação, ver 1 aba (Form) com o conteúdo idêntico ao `center` anterior; nenhuma
      regra de aprovação/rejeição/transição mudou.
- [ ] RH (nos 7 drawers): aba "Form" aparece primeiro e ativa por padrão quando há conteúdo; quando não há
      campo customizado configurado pro estágio atual, abre direto em "Atividades" (sem aba Form vazia).
      Nenhum campo que já existia sumiu ou duplicou.
- [ ] Treinamentos: conferir que `left` fica vazio (sem quebra de layout) quando a atribuição não tem
      certificado nem campo customizado — mesmo comportamento de antes, só que originado por `formContent`
      vazio em vez de `left` vazio.
- [ ] `DetailDrawerTabs` renderiza pixel-idêntico ao `SideTabs`/`RHSideTabs` anterior nos 3 consumidores
      originais (Campaign, Deliverable, RH) — nenhuma mudança visual, só de import.
- [ ] Anexos/Checklist aparecem em Tarefas e Compras (schema aprovado — ver Seção 10, que substitui a
      Seção 6).
- [ ] Guardrails já conhecidos continuam intactos: sem "R$ R$" duplicado, sem validação de campo obrigatório
      antes da primeira interação, sem campo sem opções configuradas renderizando vazio.

## 10. Atualização — Seção 6 aprovada e já aplicada (schema)

O Daniel aprovou explicitamente ("Pode incluir para Tarefas e Compras e no modelo genérico para sempre")
depois da Seção 6 ter sido escrita. A migration já foi aplicada no projeto vivo:
`supabase/migrations/20260782_marketing_tasks_purchase_generic_domains.sql`. **Isso substitui a Seção 6** —
Anexos/Checklist/Atividades entram nesta rodada, não ficam mais pendentes. O que mudou no banco:

- `marketing_purchase_requests.activities jsonb NOT NULL DEFAULT '[]'` — nova coluna. As RPCs
  `approve_purchase_request`/`reject_purchase_request` já foram atualizadas pra fazer `append` de um evento
  `{type:"stage_change", description, at}` nessa coluna (mesmo formato usado em `marketing_tasks`/
  `ActivityLog`). **As demais transições de etapa de Compras (`solicitado→cotacao`,
  `aprovado→pedido_fornecedor→entrega_parcial→entregue→pago`) são `.update()` client-side — o frontend
  precisa fazer o append de `activities` nesses pontos também**, mesmo padrão de
  `MarketingTaskDetailDrawer.jsx:256-263` (`handleMoveStage`). Ver 10.1.
- `rh_attachments_domain_check` e `rh_checklists_domain_check` ampliados pra incluir `'marketing_tasks'` e
  `'marketing_purchase_requests'` (checklist inclusive: antes era hardcoded só `vagas`/`candidatos`, nunca
  tinha sido ampliado).
- 2 novas policies RLS (`rh_attachments_marketing_access`, `rh_checklists_marketing_access`), aditivas —
  gated por `domain = ANY(ARRAY['marketing_tasks','marketing_purchase_requests']) AND
  current_user_is_marketing()` (mesmo critério de `marketing_tasks_select`/`marketing_purchase_requests_read`
  — sem carve-out de agência, igual ao resto do domínio). Nenhuma policy de RH existente foi alterada em
  comportamento (RLS combina policies permissivas com OR).
- Achado adjacente corrigido de passagem: `rh_checklists_rh_access` ainda checava `profiles.role` (escalar)
  em vez de `roles` (array) — mesma classe de bug já corrigida em `rh_attachments_rh_access`
  (`20260739_rh_attachments_holerite_ponto_self_read.sql`). Alinhado ao padrão
  `current_user_is_admin()/current_user_has_role()`.

### 10.1 `MarketingTaskDetailDrawer.jsx` — Form + Atividades + Anexos + Checklist (4 abas, não 2)

A Seção 3 previa só 2 abas (Form, Atividades) porque Anexos/Checklist estavam bloqueados. Agora:

```jsx
const [centerTab, setCenterTab] = useState("form");

const center = (
  <>
    <DetailDrawerTabs
      tabs={[
        { id: "form",       label: "Form",       icon: FileText },
        { id: "atividades", label: "Atividades", icon: Activity },
        { id: "anexos",     label: "Anexos",     icon: Paperclip },
        { id: "checklist",  label: "Checklist",  icon: ListChecks },
      ]}
      activeId={centerTab}
      onChange={setCenterTab}
    />
    {centerTab === "form" && (/* conteúdo idêntico ao "Antes" da Seção 3 */)}
    {centerTab === "atividades" && <ActivityLog activities={item.activities || []} />}
    {centerTab === "anexos" && (
      <RHAttachmentsPanel domain="marketing_tasks" recordId={item.id} currentUser={currentUser} />
    )}
    {centerTab === "checklist" && (
      <RHChecklistsPanel domain="marketing_tasks" recordId={item.id} currentUser={currentUser} />
    )}
  </>
);
```

`RHAttachmentsPanel`/`RHChecklistsPanel` já são exportados de `RHDetailDrawerShell.jsx` (`export function
RHAttachmentsPanel` na Seção de Anexos, `RHChecklistsPanel` não é exportado hoje — **precisa exportar** essa
função também, mesmo tratamento). São genéricos por `domain`+`recordId` — nenhuma mudança neles, só uso com
um `domain` novo, exatamente como desenhado. Reset de aba ao trocar de card: igual à Seção 3, sempre volta
pra `form`.

### 10.2 `PurchaseRequestDetailDrawer.jsx` — Form + Atividades + Anexos + Checklist (4 abas, não 1)

A Seção 4 previa só 1 aba porque não havia coluna `activities`. Agora existe. Mesma estrutura de 10.1, com
`domain="marketing_purchase_requests"` e `recordId={request.id}` (confirmar o nome exato da prop do item
neste arquivo — pode ser `req`/`purchase`/`item`, checar a assinatura do componente antes de aplicar).

**Importante**: como a maioria das transições de etapa de Compras é `.update()` client-side (não RPC), o
hook (`src/hooks/use-marketing-purchase-requests.js`, função de update/moveToStage — conferir o nome exato)
precisa, nesses pontos, fazer o append de um evento `activities` (`{type:"stage_change", description:
"Movido para <Nome da Etapa>", at: new Date().toISOString()}`) na mesma chamada que já grava `stage` — sem
isso, a aba Atividades ficaria completa só pra aprovar/rejeitar (que já vem populado pela RPC) e muda pra
todas as outras transições. Mesmo padrão exato de `MarketingTaskDetailDrawer.jsx:256-263`.

### 10.3 Verificação adicional (soma à Seção 8)

- [ ] Tarefas e Compras: aba Anexos faz upload/download/remoção normalmente (mesmo componente genérico do
      RH, só domínio novo).
- [ ] Tarefas e Compras: aba Checklist cria/edita/marca item/exclui normalmente.
- [ ] Aprovar e rejeitar uma solicitação de Compras grava um evento em `activities` (conferir via aba
      Atividades depois da ação).
- [ ] Mover uma solicitação de Compras entre as etapas client-side (ex. `aprovado→pedido_fornecedor`) também
      grava evento em `activities` — não só as 2 transições via RPC.
- [ ] RLS: um usuário só com papel `marketing` (sem `rh`/`gerente_rh`/`admin`) consegue anexar arquivo e criar
      checklist num card de Tarefas/Compras; um usuário só com papel `rh` (sem `marketing`) **não** consegue
      (nem deveria aparecer a opção, já que a tela nem carrega pra ele).

## 9. Ordem de implementação recomendada

1. `src/components/shared/DetailDrawerTabs.jsx` (novo arquivo, Seção 2) — não depende de mais nada.
2. Trocar os 3 consumidores existentes (`CampaignDetailDrawer.jsx`, `DeliverableDetailDrawer.jsx`,
   `RHDetailDrawerShell.jsx`) pra importar de lá, sem mudar posição/conteúdo — valida que a extração não
   quebrou nada antes de somar mais escopo.
3. `RHDetailDrawerShell.jsx` — adicionar prop `formContent` (Seção 5.2) e exportar `RHChecklistsPanel` (10.1).
4. Os 6 arquivos de RH — extrair o bloco existente pra `formContent` (Seção 5.3), um de cada vez, testando
   a cada um (mesmo JSX, só de lugar).
5. `MarketingTaskDetailDrawer.jsx` — 4 abas: Form + Atividades + Anexos + Checklist (Seção 10.1).
6. `PurchaseRequestDetailDrawer.jsx` — 4 abas: Form + Atividades + Anexos + Checklist (Seção 10.2), incluindo
   o append de `activities` nas transições client-side do hook.
7. QA (Seções 8 + 10.3) contra todos os 9+ modais afetados.
