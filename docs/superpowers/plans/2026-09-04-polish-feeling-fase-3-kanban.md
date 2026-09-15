# Polish feeling — Fase 3 Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar feeling de Kanban (hover curto + drag lift + settle) nos shells compartilhados, começando pelo Funil e cobrindo RH/Marketing via os mesmos cards.

**Architecture:** Classes CSS em `index.css` (`.polish-kanban-card`, `.is-dragging`) usando tokens já existentes (`--shadow-card-hover`, `--shadow-drag`, `--motion-*`). Estado `dragging` local em cada shell de card. Colunas já têm ring de drop — não redesenhar boards.

**Tech Stack:** React 18, HTML5 DnD nativo (sem @dnd-kit), CSS custom properties.

## Global Constraints

- Shell atual — sem top nav / lateral nova
- Sombra A curta já na main; hover de card = `--shadow-card-hover` (não `--shadow-pop`)
- `prefers-reduced-motion: reduce` zera scale/translate do drag/hover; mantém ring de coluna
- Sem som de UI; sem mudar densidade de coluna
- Commits/variáveis em inglês; respostas ao Daniel em PT-BR
- Merge em `main` só com ok explícito do Daniel

## File map

| Arquivo | Responsabilidade |
|---|---|
| `src/index.css` | `.polish-kanban-card`, `.is-dragging`, reduced-motion |
| `scripts/polish-tokens-smoke.mjs` | Assert classes Kanban existem |
| `src/components/lead/LeadKanbanCard.jsx` | Funil CRM |
| `src/components/rh-pipeline/RHKanbanCard.jsx` | RH / Pós-venda / Comex / Bugs |
| `src/components/campaign/CampaignKanbanCard.jsx` | Marketing campanhas |
| `src/components/campaign/DeliverableKanbanCard.jsx` | Entregas / Tarefas |
| `src/data/changelog.js` + `package.json` | v4.97.8 |
| `docs/design-spec-polish-feeling.md` | Marcar fase 3 |

**Fora desta fase:** `PurchaseKanbanCard`, `TaskKanbanCard` (fase 6 opportunista); FilterBar/Tabs (fase 4); drawer enter (fase 5).

---

### Task 1: CSS + smoke

**Files:** `src/index.css`, `scripts/polish-tokens-smoke.mjs`

- [ ] **Step 1:** Adicionar bloco Kanban após polish-bar:

```css
.polish-kanban-card {
  box-shadow: var(--shadow-card);
  transition:
    transform var(--motion-base) var(--ease-out),
    box-shadow var(--motion-base) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    opacity var(--motion-fast) var(--ease-out);
}
.polish-kanban-card:hover:not(.is-dragging) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-card-hover);
  border-color: var(--border-strong);
}
.polish-kanban-card.is-dragging {
  cursor: grabbing;
  opacity: 0.92;
  transform: scale(1.02);
  box-shadow: var(--shadow-drag);
  z-index: 5;
}
```

- [ ] **Step 2:** Em `prefers-reduced-motion`, zerar transform/opacity animation do card.
- [ ] **Step 3:** Smoke exige `.polish-kanban-card` e `.is-dragging`.
- [ ] **Step 4:** `npm run test:polish-tokens` → ok.

---

### Task 2: Quatro shells de card

**Files:** Lead / RH / Campaign / Deliverable KanbanCard

Em cada um:

- [ ] Estado `const [dragging, setDragging] = useState(false)`
- [ ] Classe: `p-3.5 rounded-lg cursor-pointer polish-kanban-card${dragging ? " is-dragging" : ""}`
- [ ] Remover `boxShadow` inline e handlers `onMouseEnter`/`onMouseLeave` de sombra/transform (CSS cuida)
- [ ] Manter `background`/`border`/`position` inline (terminal + cor)
- [ ] `onDragStart`: `setDragging(true)` + callback existente
- [ ] `onDragEnd`: `setDragging(false)` + callback existente
- [ ] `onMouseLeave` durante drag: não resetar (não há mais handlers de hover inline)

---

### Task 3: Changelog + spec + gates

- [ ] Changelog 4.97.8 + bump version + lockfile
- [ ] Spec §6 fase 3 marcada; §9 ok fases 3+
- [ ] `npm run test:polish-tokens` + `npm run build`
- [ ] Demo visual: Funil — hover + drag entre colunas
- [ ] Pedir ok do Daniel para merge

## Spec coverage

| Spec §4.3 | Task |
|---|---|
| Card hover elevate + shadow-card-hover | 1–2 |
| Drag lift shadow-drag + scale | 1–2 |
| Drop settle | CSS transition ao tirar `.is-dragging` |
| Coluna ring | Já existe nos boards — sem mudança |
| CRM depois RH/Marketing | Lead + RH + Campaign + Deliverable |

## Fora deste plano

| Fase | Escopo |
|---|---|
| 4 | FilterBar / Tabs / Button / Select |
| 5 | Drawer scrim/enter |
| 6 | Purchase/Task cards + resto opportunista |
