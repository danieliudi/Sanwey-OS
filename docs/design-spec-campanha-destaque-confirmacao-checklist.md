# Campanha em destaque no card de Tarefas + confirmação granular do Checklist de Evento

Aprovado pelo Daniel via mockup (`https://claude.ai/code/artifact/c82f7170-a74c-4c90-994f-9e49b21721f8`),
2 rodadas: (1) escolhida a Opção A (pill colorida por canal) entre 2 opções pro nome da campanha; (2) pedido
adicional pra permitir selecionar itens individuais de cada segmento do checklist, não só o segmento inteiro.

## 1. Campanha em destaque no card de Tarefas

**Arquivo:** `src/components/campaign/DeliverableKanbanCard.jsx:133-140` (usado por `MarketingTarefasView.jsx`).

Hoje:
```jsx
{campaign && (
  <div className="text-[10px] mb-1.5 truncate" style={{ color: "var(--text-dim)" }} title={campaign.name}>
    {campaign.name}
  </div>
)}
```

Troca por uma pill de canal, reaproveitando **exatamente** o padrão já usado no chip de canal do
`CampaignKanbanCard.jsx:140-147` (mesmo fallback, mesmas classes, mesma lógica de borda) — não inventar visual
novo, copiar o padrão:

```jsx
{campaign && (
  <span
    className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold mb-1.5 truncate max-w-full"
    style={{
      background: (CHANNEL_COLORS[campaign.channel] || { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" }).bg,
      color:      (CHANNEL_COLORS[campaign.channel] || { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" }).text,
      border:     `1px solid ${(CHANNEL_COLORS[campaign.channel] || { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" }).border}`,
    }}
    title={campaign.name}
  >
    {campaign.name}
  </span>
)}
```

Import `CHANNEL_COLORS` de `../../constants/marketing-pipelines` (já existe, usado em `CampaignKanbanCard.jsx`).
Sem ícone/emoji (o mockup tinha um 📣 ilustrativo — não faz parte do pedido, e o padrão de chip real do app não
usa emoji). Sem mudança de dado — `campaign` continua vindo de `campaignsById` como já é.

## 2. Confirmação do Checklist de Evento — seleção por segmento E por item

**Arquivo:** `src/components/campaign/CampaignDetailDrawer.jsx`, componente `ApplyEventChecklistButton`
(linhas 177-251 na versão atual — confirmar linha exata antes de editar, o arquivo já sofreu edições desde).

### Estado novo (dentro do mesmo componente, sem extrair pra `shared/` — 1ª ocorrência desse modal)

```jsx
const [confirming, setConfirming] = useState(false);
// selection[segIdx][itemIdx] = boolean. Inicializado com tudo true toda vez que o modal abre.
const [selection, setSelection] = useState(() => EVENT_CHECKLIST_TEMPLATE.map(seg => seg.items.map(() => true)));
const [expandedSegments, setExpandedSegments] = useState(() => new Set());
```

`applying`, `applyError`, `alreadyApplied`, `loading` continuam exatamente como já são — nenhuma mudança de
semântica. Em particular: **não mudar** a lógica de `alreadyApplied`. Ela já verifica "algum card com título de
segmento existe" — isso continua correto mesmo com aplicação parcial (se o usuário aplicar só 3 dos 5 segmentos
hoje, o botão vira "já aplicado" e não deve reabrir o modal depois — comportamento consciente, não bug, não
mexer nisso nesta rodada).

### Abrir o modal (troca o antigo clique direto)

```jsx
const openConfirm = () => {
  if (applying || loading || alreadyApplied) return;
  setSelection(EVENT_CHECKLIST_TEMPLATE.map(seg => seg.items.map(() => true))); // reset a cada abertura
  setExpandedSegments(new Set());
  setApplyError(null);
  setConfirming(true);
};
```
O botão original troca `onClick={handleApply}` por `onClick={openConfirm}` — texto/estilo do botão **não mudam**.

### Derivações (helpers dentro do componente, sem memo — array pequeno, 5×até 15)

```jsx
function segmentState(segIdx) {
  const items = selection[segIdx];
  if (items.every(Boolean)) return "checked";
  if (items.every(v => !v)) return "unchecked";
  return "indeterminate";
}
const taskCount = selection.filter(items => items.some(Boolean)).length;
const itemCount = selection.reduce((sum, items) => sum + items.filter(Boolean).length, 0);
const allState = taskCount === 0 ? "unchecked" : (itemCount === EVENT_CHECKLIST_TEMPLATE.reduce((s,seg)=>s+seg.items.length,0) ? "checked" : "indeterminate");
```

### Toggle handlers

```jsx
function toggleSegment(segIdx) {
  const makeChecked = segmentState(segIdx) !== "checked"; // indeterminate ou unchecked -> marca tudo
  setSelection(prev => prev.map((items, i) => i === segIdx ? items.map(() => makeChecked) : items));
}
function toggleItem(segIdx, itemIdx) {
  setSelection(prev => prev.map((items, i) => i === segIdx ? items.map((v, j) => j === itemIdx ? !v : v) : items));
}
function toggleAll() {
  const makeChecked = allState !== "checked";
  setSelection(EVENT_CHECKLIST_TEMPLATE.map(seg => seg.items.map(() => makeChecked)));
}
function toggleExpand(segIdx) {
  setExpandedSegments(prev => { const next = new Set(prev); next.has(segIdx) ? next.delete(segIdx) : next.add(segIdx); return next; });
}
```

### Aplicar (substitui o corpo de `handleApply`, mesma try/catch/finally de hoje)

```jsx
const handleApply = async () => {
  if (applying || loading) return;
  const segmentsToApply = EVENT_CHECKLIST_TEMPLATE
    .map((seg, segIdx) => ({ segment: seg.segment, items: seg.items.filter((_, itemIdx) => selection[segIdx][itemIdx]) }))
    .filter(seg => seg.items.length > 0);
  if (segmentsToApply.length === 0) return; // guarda, botão já deveria estar disabled
  setApplying(true);
  setApplyError(null);
  try {
    const { error: err } = await supabase.rpc("apply_event_checklist_template", {
      p_campaign_id:  campaign.id,
      p_company_ids:  campaign.companyIds || [],
      p_owner_ids:    campaign.ownerIds || [],
      p_segments:     segmentsToApply,
    });
    if (err) throw err;
    setConfirming(false);
  } catch (err) {
    setApplyError(err?.message || "Erro ao aplicar checklist de evento.");
    // NÃO fechar o modal em erro — deixa a pessoa tentar de novo sem perder a seleção.
  } finally {
    setApplying(false);
  }
};
```

Nenhuma migration nem mudança na RPC `apply_event_checklist_template` — ela já recebe `p_segments` como
`[{segment, items}]` e já pula segmentos cujo título já existe (idempotência server-side inalterada).

### Modal — reaproveitar `src/components/ui/Modal.jsx` (não hand-roll overlay)

```jsx
<Modal open={confirming} onClose={() => !applying && setConfirming(false)} title="Aplicar checklist de evento" width={480}>
  <div className="px-6 pt-1 pb-3 text-xs" style={{ color: "var(--text-dim)" }}>
    Cria um card de tarefa por segmento marcado abaixo, cada um com seu checklist já preenchido. Desmarque o
    que não se aplica a este evento — dá pra desmarcar o segmento inteiro ou só alguns itens dele.
  </div>

  {/* Toolbar: selecionar todos + contador */}
  <div className="flex items-center justify-between px-6 py-2.5" style={{ background: "var(--surface-alt)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
    <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text)", background: "none", border: "none", cursor: "pointer" }}>
      <TriStateCheckbox state={allState} />
      Selecionar todos
    </button>
    <span className="text-xs" style={{ color: "var(--text-dim)" }}>{taskCount} tarefa{taskCount !== 1 ? "s" : ""} · {itemCount} ite{itemCount !== 1 ? "ns" : "m"} selecionado{itemCount !== 1 ? "s" : ""}</span>
  </div>

  {/* Lista, altura travada com scroll próprio — não deixa o footer sumir junto */}
  <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
    {EVENT_CHECKLIST_TEMPLATE.map((seg, segIdx) => (
      <div key={seg.segment} style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-start gap-2.5 px-6 py-3 cursor-pointer" onClick={() => toggleExpand(segIdx)}>
          <button onClick={e => { e.stopPropagation(); toggleSegment(segIdx); }} style={{ background: "none", border: "none", padding: 0, marginTop: 1 }}>
            <TriStateCheckbox state={segmentState(segIdx)} />
          </button>
          <ChevronRight size={14} style={{ color: "var(--text-faint)", flexShrink: 0, marginTop: 2, transform: expandedSegments.has(segIdx) ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold" style={{ color: segmentState(segIdx) === "unchecked" ? "var(--text-faint)" : "var(--text)" }}>{seg.segment}</div>
            <div className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              {selection[segIdx].filter(Boolean).length}/{seg.items.length} itens selecionados
              {segmentState(segIdx) === "unchecked" && " · tarefa não será criada"}
            </div>
          </div>
        </div>
        {expandedSegments.has(segIdx) && (
          <div className="pb-2" style={{ paddingLeft: 60, paddingRight: 24 }}>
            {seg.items.map((item, itemIdx) => (
              <label key={item} className="flex items-center gap-2.5 py-1 cursor-pointer" style={{ fontSize: 12.5 }}>
                <input type="checkbox" checked={selection[segIdx][itemIdx]} onChange={() => toggleItem(segIdx, itemIdx)} style={{ width: 14, height: 14, accentColor: "var(--accent)" }} />
                <span style={{ color: selection[segIdx][itemIdx] ? "var(--text-dim)" : "var(--text-faint)", textDecoration: selection[segIdx][itemIdx] ? "none" : "line-through" }}>{item}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>

  {/* Footer fixo (fora do container com scroll) */}
  <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
    <button onClick={() => setConfirming(false)} disabled={applying} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "transparent" }}>
      Cancelar
    </button>
    <button onClick={handleApply} disabled={applying || taskCount === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--accent)", color: "#FFF", border: "none", opacity: (applying || taskCount === 0) ? 0.6 : 1, cursor: (applying || taskCount === 0) ? "not-allowed" : "pointer" }}>
      <ListChecks size={13} />
      {applying ? "Aplicando…" : `Aplicar (${taskCount})`}
    </button>
  </div>

  {applyError && (
    <div className="px-6 pb-4 text-xs" style={{ color: "var(--danger)" }}>{applyError}</div>
  )}
</Modal>
```

`TriStateCheckbox` é um componente pequeno novo, local a este arquivo (não vale a pena `shared/` numa 1ª
ocorrência): checkbox 16-18px, 3 visuais — `checked` (fundo `var(--accent)` + ícone check), `unchecked` (só
borda `var(--border-strong)`), `indeterminate` (borda `var(--accent)`, sem fundo, traço `var(--accent)` no
meio).

### Import novo necessário
`import { Modal } from "../ui/Modal";` e `ChevronRight` de `lucide-react` (já deve ter outros ícones
importados no topo do arquivo — adicionar ao import existente, não duplicar).

## Fora de escopo (não mudar nesta rodada)
- Estados/textos do botão "Aplicar checklist de evento" (já aprovados numa rodada anterior).
- Texto/comportamento do estado "já aplicado".
- A RPC `apply_event_checklist_template` e sua migration — nenhuma mudança de schema.
- `CHANNEL_COLORS` em si — reaproveitar como está, não adicionar cor nova.

## Verificação
1. `npx vite build` limpo.
2. Testar em Marketing > Tarefas: card com campanha vinculada mostra a pill colorida (canal "Evento" = rosa,
   outros canais = cor correspondente); card sem campanha continua sem nada (sem placeholder).
3. Testar o fluxo completo: abrir uma campanha de canal "Evento" ainda sem checklist aplicado → clicar
   "Aplicar checklist de evento" → modal abre com os 5 segmentos, tudo marcado, "5 tarefas · 48 itens
   selecionados" no topo → desmarcar um segmento inteiro (via checkbox do segmento) → expandir outro e
   desmarcar 2 itens específicos → conferir que o contador do topo e o número no botão "Aplicar" atualizam →
   clicar Aplicar → conferir no board de Tarefas que só os cards esperados foram criados, e que o card com
   itens parciais tem só os itens marcados no checklist (abrir o card, aba Checklist).
4. Cancelar o modal não deve criar nada.
5. Reabrir o modal depois de cancelar deve resetar a seleção pra "tudo marcado" (não lembrar da seleção
   anterior).
6. Nenhuma classe de bug conhecida reintroduzida (guardrail de idempotência do RPC, "R$ R$", validação
   prematura).
