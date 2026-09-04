# Polish feeling — Fases 1–2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar tokens de elevação/motion (Fase 1) e o feeling do Painel Executivo alinhado ao mockup `polish-visao.html` (Fase 2), sem trocar o shell.

**Architecture:** Tokens CSS em `src/index.css` (light + dark + `prefers-reduced-motion`). Consumo imediato via `var(--shadow-card)` já espalhado. No Painel: polish em `StatCard`, faixa de saúde, `ChartCard`/Recharts tooltip — motion só onde o mockup A+ mostrou valor.

**Tech Stack:** React 18, Vite, Tailwind 3, Recharts 3, CSS custom properties em `index.css`. Gates: `npm run lint`, `npm run check`, `npm run build`.

**Spec:** `docs/design-spec-polish-feeling.md`  
**Mockups de referência:** `docs/mockups/sanwey-os-ui/polish-visao.html`, `polish-padroes.html`

## Global Constraints

- Shell atual (sidebar) — **não** implementar top nav / lateral nova neste plano
- Sombra **A curta** aprovada (Daniel 04/09): `0 1px 2px …, 0 2px 6px …` — não usar blur longo tipo Worktail “flutuante”
- Sem som de UI
- `prefers-reduced-motion: reduce` zera stagger/grow/count-up; mantém hover/focus sem deslocamento
- Não copiar creme/peach Worktail; accent continua `#CC2936` / `var(--accent)`
- Radius: manter `rounded-lg` / `rounded-xl` atuais (8–12px), não 24px
- Commits em português; código/variáveis em inglês
- Antes de merge em `main`: confirmação explícita do Daniel (ação de produto)
- Mockups-first já cumprido para estas fases; implementação em `src/` autorizada **só após** ok deste plano

## File map

| Arquivo | Responsabilidade |
|---|---|
| `src/index.css` | Tokens `--shadow-card`, `--shadow-card-hover`, `--shadow-drag`, `--motion-*`, `--ease-out`; dark; reduced-motion |
| `scripts/polish-tokens-smoke.mjs` | Smoke: tokens existem em `index.css` (light + dark + reduced-motion) |
| `package.json` | Script `test:polish-tokens` |
| `src/components/ui/StatCard.jsx` | Hover via token; opcional `enterDelay` / classe stagger; sem `hover:shadow-md` Tailwind genérico |
| `src/components/views/ExecutiveDashboard.jsx` | Stagger na faixa de saúde + grid de StatCards; classe utilitária de enter |
| `src/components/views/ExecutiveCharts.jsx` | `ChartCard` com shadow token; Tooltip escuro; animação Recharts padrão; dots de Line sem stretch |
| `src/data/changelog.js` | Entrada `ajuste`/`novo` curta (usuário sente o painel) |
| `docs/design-spec-polish-feeling.md` | Status → em implementação / feito nas fases 1–2 |

---

### Task 1: Smoke dos tokens + script de gate

**Files:**
- Create: `scripts/polish-tokens-smoke.mjs`
- Modify: `package.json` (script `test:polish-tokens`)

**Interfaces:**
- Consumes: conteúdo textual de `src/index.css`
- Produces: exit 0 se todos os tokens obrigatórios existirem em `:root` e em `[data-theme="dark"]`; e bloco `@media (prefers-reduced-motion: reduce)` mencionando `--motion-enter` ou `animation: none`

- [ ] **Step 1: Escrever o smoke que falha (tokens ainda não existem)**

```js
// scripts/polish-tokens-smoke.mjs
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "src/index.css"), "utf8");

const required = [
  "--shadow-card-hover",
  "--shadow-drag",
  "--motion-fast",
  "--motion-base",
  "--motion-enter",
  "--ease-out",
];

const missing = required.filter((t) => !css.includes(`${t}:`));
if (missing.length) {
  console.error("polish-tokens: faltando em index.css:", missing.join(", "));
  process.exit(1);
}

// shadow-card deve deixar de ser só "none" no :root (A curta aprovada)
const rootBlock = css.slice(css.indexOf(":root"), css.indexOf("[data-theme=\"dark\"]"));
if (/--shadow-card:\s*none/.test(rootBlock)) {
  console.error("polish-tokens: --shadow-card ainda é none no :root (esperado sombra A curta)");
  process.exit(1);
}

if (!css.includes("prefers-reduced-motion")) {
  console.error("polish-tokens: falta @media (prefers-reduced-motion: reduce)");
  process.exit(1);
}

console.log("polish-tokens: ok");
```

- [ ] **Step 2: Registrar script e rodar (deve falhar)**

```bash
# em package.json, em "scripts":
"test:polish-tokens": "node scripts/polish-tokens-smoke.mjs"
```

Run: `npm run test:polish-tokens`  
Expected: exit 1 — faltando tokens e/ou `--shadow-card: none`

- [ ] **Step 3: Commit do smoke + script (TDD vermelho)**

```bash
git add scripts/polish-tokens-smoke.mjs package.json
git commit -m "test: smoke dos tokens de polish feeling (ainda vermelho)"
```

---

### Task 2: Fase 1 — tokens em `index.css`

**Files:**
- Modify: `src/index.css` (bloco Elevation em `:root` ~L46–51; dark ~L168–170; novo bloco reduced-motion)

**Interfaces:**
- Consumes: valores aprovados em `docs/design-spec-polish-feeling.md` §3
- Produces: variáveis CSS globais usadas por qualquer `boxShadow: "var(--shadow-card)"`

- [ ] **Step 1: Substituir Elevation no `:root`**

Trocar o comentário + valores atuais por:

```css
  /* Elevation — sombra A curta (Daniel 04/09/2026, mockup polish-visao).
     Substitui a decisão Focus 03/08 (--shadow-card: none) só na elevação
     de repouso; --shadow-pop continua para popover/modal. */
  --shadow-card:       0 1px 2px rgba(55, 53, 47, 0.04), 0 2px 6px rgba(55, 53, 47, 0.05);
  --shadow-card-hover: 0 2px 4px rgba(55, 53, 47, 0.05), 0 4px 10px rgba(55, 53, 47, 0.07);
  --shadow-drag:       0 4px 14px rgba(55, 53, 47, 0.12);
  --shadow-pop:        0 12px 32px rgba(55, 53, 47, 0.14), 0 2px 8px rgba(55, 53, 47, 0.06);

  /* Motion — polish feeling (docs/design-spec-polish-feeling.md) */
  --motion-fast:  150ms;
  --motion-base:  220ms;
  --motion-enter: 420ms;
  --ease-out:     cubic-bezier(0.2, 0.8, 0.2, 1);
```

- [ ] **Step 2: Dark theme — sombra curta legível no escuro**

Em `[data-theme="dark"]`, trocar `--shadow-card: none` por:

```css
  --shadow-card:       0 1px 2px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.28);
  --shadow-card-hover: 0 2px 4px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.32);
  --shadow-drag:       0 4px 16px rgba(0, 0, 0, 0.45);
  --shadow-pop:        0 16px 40px rgba(0, 0, 0, 0.45);
```

(manter `--motion-*` herdados do `:root` — não redeclarar no dark)

- [ ] **Step 3: Reduced motion**

Ao final de `index.css` (após utilitários existentes):

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-fast: 0ms;
    --motion-base: 0ms;
    --motion-enter: 0ms;
  }
  .polish-enter,
  .polish-stagger > * {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

Utilitários de entrada (usados na Fase 2):

```css
@keyframes polish-rise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
.polish-enter {
  animation: polish-rise var(--motion-enter) var(--ease-out) both;
}
.polish-stagger > *:nth-child(1) { animation-delay: 40ms; }
.polish-stagger > *:nth-child(2) { animation-delay: 80ms; }
.polish-stagger > *:nth-child(3) { animation-delay: 120ms; }
.polish-stagger > *:nth-child(4) { animation-delay: 160ms; }
.polish-stagger > *:nth-child(5) { animation-delay: 200ms; }
.polish-stagger > *:nth-child(6) { animation-delay: 240ms; }
.polish-stagger > *:nth-child(7) { animation-delay: 280ms; }
.polish-stagger > *:nth-child(8) { animation-delay: 320ms; }
.polish-stagger > * {
  animation: polish-rise var(--motion-enter) var(--ease-out) both;
}
```

- [ ] **Step 4: Rodar smoke (deve passar)**

Run: `npm run test:polish-tokens`  
Expected: `polish-tokens: ok`

- [ ] **Step 5: Gates**

Run: `npm run lint && npm run check`  
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "feat: tokens de sombra curta e motion (polish feeling fase 1)"
```

**Verificação visual Fase 1:** abrir o app, Painel Executivo e Funil — cards que já usam `var(--shadow-card)` devem ter sombra curta (não “flutuar”). Dark mode: sombra visível sem halo branco.

---

### Task 3: Fase 2a — `StatCard` e hover por token

**Files:**
- Modify: `src/components/ui/StatCard.jsx` (~L67–73)

**Interfaces:**
- Consumes: `--shadow-card`, `--shadow-card-hover`, `--motion-base`, `--ease-out`
- Produces: mesmo API público de `StatCard`; visual hover alinhado ao mockup

- [ ] **Step 1: Trocar casca do variant `card`**

No `return` principal (não `ruler`), substituir classes Tailwind de sombra genérica:

De:
```jsx
className={`${dense ? "h-full p-2.5 md:p-5" : "p-5"} rounded-lg border transition-all duration-150 hover:shadow-md cursor-default`}
style={{
  background: accent || "var(--surface)",
  borderColor: accent ? "transparent" : "var(--border)",
  boxShadow: accent ? "none" : "var(--shadow-card)",
}}
```

Para:
```jsx
className={`${dense ? "h-full p-2.5 md:p-5" : "p-5"} rounded-lg border cursor-default polish-stat-card`}
style={{
  background: accent || "var(--surface)",
  borderColor: accent ? "transparent" : "var(--border)",
  boxShadow: accent ? "none" : "var(--shadow-card)",
  transition: `box-shadow var(--motion-base) var(--ease-out), transform var(--motion-fast) var(--ease-out)`,
}}
```

Em `src/index.css`, adicionar (só se não-accent — hover via CSS quando não tem fundo sólido):

```css
.polish-stat-card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}
```

Nota: cards com `accent` (fundo sólido) — manter sem sombra; o hover pode só `filter: brightness(1.02)` se necessário, sem shadow.

- [ ] **Step 2: Lint**

Run: `npx eslint src/components/ui/StatCard.jsx`  
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/StatCard.jsx src/index.css
git commit -m "feat: StatCard usa hover de sombra curta (token polish)"
```

---

### Task 4: Fase 2b — stagger no Painel Executivo

**Files:**
- Modify: `src/components/views/ExecutiveDashboard.jsx` (faixa `exec-health-band` ~L500; `StatCardGrid` ~L562)

**Interfaces:**
- Consumes: classes `.polish-stagger` / `.polish-enter` da Task 2
- Produces: entrada em cascata na primeira pintura da faixa + KPIs

- [ ] **Step 1: Faixa de saúde**

No `div.exec-health-band`, adicionar `polish-stagger` às classes:

```jsx
className="exec-health-band polish-stagger grid gap-2.5"
```

Nos botões filhos, garantir `transition` de border/shadow já existente; opcional:

```jsx
className="text-left rounded-xl border p-3 cursor-pointer transition-colors polish-enter"
```

(Se pai já é `polish-stagger`, **não** duplicar `polish-enter` nos filhos — só a classe do pai.)

- [ ] **Step 2: StatCardGrid comercial**

Envolver o `StatCardGrid` (bloco ~L562) com:

```jsx
<div className="polish-stagger">
  <StatCardGrid desktopClassName="md:grid-cols-3 lg:grid-cols-7">
    …
  </StatCardGrid>
</div>
```

Se `StatCardGrid` não repassa filhos diretos como `> *` (usa `cloneElement` / wrapper), aplicar `polish-stagger` **dentro** de `StatCardGrid.jsx` no container da grade — ler o arquivo e colocar a classe no elemento que tem os cards como filhos diretos.

- [ ] **Step 3: Verificação manual**

Abrir `/executivo` (ou rota `ROUTES.executive`). Recarregar: faixa e KPIs sobem em cascata. Ativar “reduzir movimento” no SO: entrada instantânea.

- [ ] **Step 4: Commit**

```bash
git add src/components/views/ExecutiveDashboard.jsx src/components/shared/StatCardGrid.jsx
git commit -m "feat: stagger de entrada no Painel Executivo"
```

---

### Task 5: Fase 2c — gráficos (ChartCard, tooltip, animação)

**Files:**
- Modify: `src/components/views/ExecutiveCharts.jsx`

**Interfaces:**
- Consumes: Recharts `Tooltip`, `Line`, `Bar`; tokens de sombra
- Produces: tooltip escuro; ChartCard elevado; animação default Recharts; Line dots circulares

- [ ] **Step 1: ChartCard com shadow token**

```jsx
function ChartCard({ title, subtitle, children }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      …
    </div>
  );
}
```

- [ ] **Step 2: Tooltip compartilhado escuro**

No topo do arquivo (após imports):

```jsx
const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "#1A1A18",
    border: "none",
    borderRadius: 9999,
    padding: "6px 10px",
    boxShadow: "0 8px 20px rgba(0,0,0,.18)",
    fontSize: 12,
    fontWeight: 700,
  },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#E5E5E5", marginBottom: 2 },
  cursor: { fill: "rgba(204,41,54,0.06)" },
};
```

Em cada `<Tooltip … />`, espalhar props:

```jsx
<Tooltip formatter={(v) => formatK(v)} {...CHART_TOOLTIP_STYLE} />
```

(ajustar onde já tem `formatter` / sem formatter)

- [ ] **Step 3: Line chart — dots sem distorção**

No `LineChart` de receita mensal, garantir:

```jsx
<Line
  type="monotone"
  dataKey="…"
  stroke="var(--accent)"
  strokeWidth={2}
  dot={{ r: 4, strokeWidth: 0, fill: "var(--accent)" }}
  activeDot={{ r: 5 }}
  isAnimationActive
  animationDuration={700}
/>
```

Barras: manter `isAnimationActive` default (true) — crescer na entrada.

- [ ] **Step 4: Lint + build**

Run: `npx eslint src/components/views/ExecutiveCharts.jsx && npm run build`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/components/views/ExecutiveCharts.jsx
git commit -m "feat: tooltip escuro e elevação nos gráficos do Painel"
```

---

### Task 6: Changelog + fechar spec das fases 1–2

**Files:**
- Modify: `src/data/changelog.js` (topo da lista / versão atual)
- Modify: `docs/design-spec-polish-feeling.md` (§6 e §9)
- Modify: `package.json` version **somente se** o fluxo do repo exige bump junto do changelog (seguir padrão do último commit de feature visual)

- [ ] **Step 1: Changelog**

Entrada curta, `kind: "ajuste"` (polish visual, não feature de negócio):

```js
{ kind: "ajuste", text: "Painel Executivo: cards com sombra mais suave, entrada leve dos indicadores e tooltips dos gráficos mais legíveis." }
```

- [ ] **Step 2: Spec**

Em §6, marcar Fases 0–2 como feitas no sentido “implementadas”; em §9 marcar ok do rollout 1–2.

- [ ] **Step 3: Gates finais**

```bash
npm run test:polish-tokens
npm run lint
npm run check
npm run build
```

Expected: todos exit 0

- [ ] **Step 4: Commit**

```bash
git add src/data/changelog.js docs/design-spec-polish-feeling.md package.json
git commit -m "docs: changelog e spec — polish feeling fases 1–2"
```

---

### Task 7: Verificação visual (obrigatória antes de pedir merge)

**Files:** nenhum (manual)

- [ ] **Step 1:** Abrir `docs/mockups/sanwey-os-ui/polish-visao.html` e o app em `/executivo` lado a lado — sombra curta, stagger, tooltip escuro
- [ ] **Step 2:** Dark mode — cards não “somem” nem ganham halo
- [ ] **Step 3:** Funil (Kanban) — sombra curta nos cards que usam token; **não** exige drag-lift ainda (Fase 3, fora deste plano)
- [ ] **Step 4:** `prefers-reduced-motion` — sem animação de entrada
- [ ] **Step 5:** Pedir ok do Daniel para merge em `main`

---

## Fora deste plano (próximas fases)

| Fase | Escopo |
|---|---|
| 3 | Kanban drag lift (`--shadow-drag`) — CRM depois RH/Marketing |
| 4 | FilterBar / Tabs / Button / Select |
| 5 | Drawer scrim/enter (estrutura intacta) |
| 6 | Restante opportunista por tela |

## Spec coverage (self-review)

| Requisito da spec | Task |
|---|---|
| Sombra A curta light+dark | Task 2 |
| Motion tokens + reduced-motion | Task 2 |
| Smoke/gate | Task 1 |
| Painel stagger / KPI feeling | Tasks 3–4 |
| Gráficos tooltip + animação + dots | Task 5 |
| Sem shell novo / sem som | Global Constraints |
| Changelog | Task 6 |

## Placeholder scan

Nenhum TBD / “implement later” / “similar to Task N” sem código.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-04-polish-feeling-fases-1-2.md`.**

Duas formas de executar:

1. **Subagent-Driven (recomendado)** — um subagente por task, review entre tasks  
2. **Inline** — executar neste chat com checkpoints  

Qual prefere? (Só começo o `src/` depois do seu ok explícito neste plano.)
