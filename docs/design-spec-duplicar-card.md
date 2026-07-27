# "Duplicar Card" em todos os Kanbans (existentes e futuros)

Aprovado pelo Daniel via mockup (`https://claude.ai/code/artifact/e5f64395-4088-41a8-8069-437c821a991a`,
seção 2). Confirmado por investigação prévia: `MoveStageMenu.jsx` já aceita props opcionais e é usado por
~13 pontos (4 componentes de card + 2 views diretas) — dá pra somar a ação sem quebrar nenhum consumidor
existente.

## 1. `src/components/shared/MoveStageMenu.jsx` — mudança central

Hoje (linhas 28-35, 80-86): quando não há `targets`/`onMove` (drag-and-drop já cobre mover no board
desktop), o gatilho vira direto o ícone de lixeira (`deleteOnly`), sem dropdown. Isso precisa mudar: com
`onDuplicate` presente, mesmo sem `targets`, agora há 2+ ações — então o dropdown volta a existir.

```jsx
// Assinatura — adiciona onDuplicate (opcional) e duplicateLabel
export function MoveStageMenu({
  targets = [], onMove, onOpenChange, onDelete, deleteLabel = "Excluir card",
  onDuplicate, duplicateLabel = "Duplicar card",
  confirmMessage = "Excluir este card? Não pode ser desfeito.",
}) {
  const [duplicating, setDuplicating] = useState(false);
  // ...resto dos states existentes...

  const hasMoveTargets = Boolean(targets?.length && onMove);
  const hasDuplicate = Boolean(onDuplicate);
  if (!hasMoveTargets && !onDelete && !hasDuplicate) return null;

  // "Só excluir" (gatilho vira lixeira direta, sem dropdown) só se acontece
  // quando NENHUMA outra ação existe — antes bastava não ter targets.
  const deleteOnly = !hasMoveTargets && !hasDuplicate && Boolean(onDelete);

  const handleDuplicate = async (e) => {
    e.stopPropagation();
    if (duplicating) return;
    setDuplicating(true);
    try {
      await onDuplicate();
      setMenuOpen(false);
    } finally {
      setDuplicating(false);
    }
  };

  // ...JSX do botão gatilho: nenhuma mudança (deleteOnly já cobre o caso
  // "só delete", o resto sempre abre dropdown com MoreVertical)...

  // Dentro do dropdown, ENTRE a seção "Mover para" e o botão "Excluir"
  // (mesma ordem do mockup aprovado — ação neutra no meio, destrutiva por
  // último):
  {hasDuplicate && (
    <>
      {hasMoveTargets && <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />}
      <button
        onClick={handleDuplicate}
        disabled={duplicating}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
          background: "transparent", border: "none", cursor: duplicating ? "default" : "pointer",
          fontSize: 13, color: "var(--text)", textAlign: "left", opacity: duplicating ? 0.6 : 1,
        }}
        onMouseEnter={e => { if (!duplicating) e.currentTarget.style.background = "var(--surface-alt)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <Copy size={13} style={{ flexShrink: 0 }} />
        {duplicating ? "Duplicando…" : duplicateLabel}
      </button>
    </>
  )}
  {onDelete && (
    <>
      {(hasMoveTargets || hasDuplicate) && <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />}
      {/* botão Excluir existente, sem mudança */}
    </>
  )}
```

Import novo: `Copy` de `lucide-react` (linha 3, junto de `MoreVertical, ArrowRight, Trash2`).

Sem confirmação inline pra duplicar (diferente de excluir) — não é destrutivo, reverter é só excluir a
cópia.

## 2. Onde plugar `onDuplicate` — 4 componentes de card + 1 view direta

| Componente | Domínio(s) | Boards |
|---|---|---|
| `src/components/rh-pipeline/RHKanbanCard.jsx` | vagas, candidatos, onboarding, ferias, treinamentos, feedback | Recrutamento, Onboarding, Férias, Treinamentos, Avaliação de Desempenho, Pós-venda |
| `src/components/campaign/CampaignKanbanCard.jsx` | campanhas | Campanhas |
| `src/components/campaign/DeliverableKanbanCard.jsx` | entregas, tarefas | Entregas, Tarefas |
| `src/components/lead/LeadKanbanCard.jsx` | leads | Funil de Vendas |
| `src/components/views/ComprasMarketingView.jsx` | compras | Compras (usa `MoveStageMenu` direto, sem componente de card intermediário) |

Cada um recebe uma nova prop opcional `onDuplicate` (função, chamada sem argumento — o card já sabe seu
próprio `item`/`lead`/`request`) e repassa pro `MoveStageMenu` já renderizado ali dentro. A view-mãe (board)
é quem implementa a função de verdade e passa pro card.

## 3. Padrão de "duplicar" — regra geral (aplicar em cada domínio)

Pra cada card, "Duplicar" cria um registro NOVO no mesmo domínio, com:

1. **Copiar** todos os campos de conteúdo (o que o usuário preenche/edita: título, descrição, valores,
   datas relevantes, canal/tipo, `custom_fields`, empresa(s), etc.).
2. **Não copiar** (sempre): `id`, `created_at`, `updated_at`, `created_by` (o duplicador vira o novo
   criador), `notes`/comentários, `activities`, qualquer anexo/checklist (ficam presos ao `record_id`
   original, não fazem sentido "seguir" a cópia).
3. **Resetar etapa**: a cópia sempre nasce na PRIMEIRA etapa do domínio (`order_idx: 0` em
   `rh_pipeline_stages`, ou a primeira do array de stages hardcoded onde aplicável — ex. `PURCHASE_STAGES[0]`
   em Compras) — nunca herda a etapa do original. Cobre o caso óbvio: duplicar um negócio "Fechado" ou uma
   compra "Aprovada" não deveria criar uma cópia já fechada/aprovada.
4. **Não copiar** (por decorrência do ponto 3): qualquer campo de aprovação/rejeição (`approved_by`,
   `approved_at`, `rejected_reason` e equivalentes), `stage_changed_at` (a cópia recebe timestamp novo, não o
   do original), número de protocolo/sequência (`request_number` e equivalentes — a cópia gera o próprio via
   sequence/trigger do banco, nunca herda o do original).
5. **Título**: sufixo " (cópia)" no campo de título/nome, pra ficar visualmente óbvio no board qual card é a
   duplicata, sem precisar abrir os dois lado a lado.
6. Depois de criado, o board **não abre o drawer automaticamente** — o card novo só aparece na primeira
   coluna, como qualquer criação manual. Usuário abre se quiser editar.

### 3.1 Exemplo totalmente resolvido — `marketing_tasks` (Tarefas)

```js
// src/hooks/use-marketing-tasks.js — nova função no hook, ao lado de createTask
const duplicateTask = useCallback(async (source) => {
  return createTask({
    companyIds:   source.companyIds,
    campaignId:   source.campaignId,
    title:        `${source.title} (cópia)`,
    description:  source.description,
    priority:     source.priority,
    deadline:     source.deadline,
    stage:        "a_fazer", // primeira etapa do seed (20260764_marketing_tasks.sql:82)
    assigneeIds:  source.assigneeIds,
    customFields: source.customFields,
    // NÃO copiar: activities, notes, stageChangedAt, campaignStageKey (é
    // rollup calculado, não faz sentido herdar de outro card)
  });
}, [createTask]);
```

Aplicar exatamente essa lógica (adaptando os nomes de campo) aos demais hooks abaixo — **ler cada hook antes
de escrever a função**, não assumir nomes de campo por analogia:

| Hook | Domínio | Excluir, além do padrão geral (seção 3) |
|---|---|---|
| `use-marketing-campaigns.js` | Campanhas | `approvalChecklist` (checklist da campanha, específico daquele planejamento — não copiar) |
| `use-marketing-deliverables.js` | Entregas | mesmo padrão de Tarefas (`stage`/`stageChangedAt`/`notes`/`activities`) |
| `use-marketing-purchase-requests.js` | Compras | `requestNumber` (sequência própria), `approvedBy`/`approvedAt`/`rejectedReason`, `invoiceDate`/`invoiceUrl`/`invoiceNumber`/`expenseId`/`paymentControlNumber`, `deliveredAt`/`receivedBy` — a cópia é uma NOVA solicitação, não herda nada do ciclo de vida de compra concluído. `stage` reseta pra `"solicitado"` (`PURCHASE_STAGES[0]`, `use-marketing-purchase-requests.js:7`). |
| hook de leads (procurar `use-leads.js` ou nome equivalente) | Funil de Vendas | campos de fechamento/perda (motivo de perda, data de fechamento) — ler o hook pra confirmar nomes exatos antes de excluir |
| hooks de RH (`use-rh-vagas.js`/`use-rh-candidatos.js`/`use-rh-onboarding.js`/`use-rh-treinamentos-atribuicoes.js`/`use-rh-feedback.js`/`use-rh-ferias-requests.js` — confirmar nomes reais dos arquivos) | Recrutamento, Onboarding, Treinamentos, Avaliação, Férias | campos de aprovação/decisão específicos de cada um (ex. `approved_by`/`approved_at` em Férias, já confirmado na investigação prévia) — ler cada hook, aplicar o mesmo raciocínio: nada que representa uma DECISÃO JÁ TOMADA sobre o registro original deve ir pra cópia |

Se algum hook tiver um campo cujo destino (copiar ou não) não for óbvio pela regra geral, documente a
dúvida no relatório final em vez de decidir silenciosamente.

## 4. Fora de escopo

- Não duplicar anexos/checklists/comentários (item 2 da seção 3) — mesmo se tecnicamente possível, não foi
  pedido e aumenta a superfície de bug (ex. duplicar anexo geraria 2 linhas de storage apontando pro mesmo
  arquivo físico, sem necessidade real).
- Duplicação em lote (selecionar vários cards e duplicar todos de uma vez) — não foi pedido, cada card
  duplica individualmente.
- Motor de aprovação/transição de Compras (`PURCHASE_STAGES`, RPCs) — não é tocado, só o dado copiado pro
  registro novo.

## 5. Verificação

1. `npx vite build` limpo.
2. Testar duplicar em pelo menos 1 board de cada família: Funil de Vendas (Lead), Campanhas, Compras (o mais
   arriscado — mais campos excluídos), Tarefas, e 1 board de RH.
3. Confirmar que a cópia SEMPRE nasce na 1ª etapa, mesmo duplicando um card que estava na última etapa
   (Ganho/Concluído/Pago/Aprovado).
4. Confirmar que "Excluir" e "Mover para" continuam funcionando exatamente como antes nos boards que NÃO
   ganharam `onDuplicate` ainda (se a implementação for faseada) ou que já tinham esses fluxos (regressão).
5. Confirmar que `deleteOnly` (gatilho vira lixeira direta) só ainda acontece nos casos que JÁ eram assim
   antes (nenhum board que tinha esse comportamento deve ganhar dropdown à toa por engano de lógica).
6. Nenhuma classe de bug conhecida reintroduzida (duplicação de "R$", card duplicado abrindo com dado do
   original ainda visível por um instante antes do insert completar, etc.).
