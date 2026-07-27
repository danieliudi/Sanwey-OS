# PageHeader — extração + rollout 1/6 (Viagens & Reembolsos)

Aprovado pelo Daniel via mockup HTML (comparação antes/depois, claro+escuro):
`https://claude.ai/code/artifact/cb96a021-4ad5-45d9-8945-57b3f95e4042`.

Contexto: levantamento real de código confirmou que as 6 telas mencionadas pelo
Daniel (Marketing → Visão Geral/Solicitações/Despesas/Fornecedores/Campanhas +
Comercial → Viagens & Reembolsos) não têm nenhum componente de header em
comum — cada uma escreve título/ícone/subtítulo na mão, com tamanho e peso
levemente diferentes (26px/800, 26px/700, 20px/700, ou nenhum). Esta spec cria
o componente compartilhado e aplica **só em Viagens & Reembolsos** — as outras
5 entram uma a uma, cada uma com seu próprio mockup de aprovação.

## 1. Componente novo: `src/components/shared/PageHeader.jsx`

Props: `{ icon: Icon, title, subtitle, actions }` (`actions` é opcional,
`ReactNode` renderizado à direita, mesma linha do título).

```jsx
import React from "react";

export function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div
      className="flex items-start justify-between gap-4 flex-wrap"
      style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}
    >
      <div>
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <Icon size={18} />
            </div>
          )}
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
            {title}
          </h1>
        </div>
        {subtitle && (
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "4px 0 0 48px" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export default PageHeader;
```

Reaproveita só tokens já existentes (`--surface-alt`, `--border`, `--text`,
`--text-dim`) — nenhum hex novo. `48px` de recuo do subtítulo = 38px do ícone
+ 10px de gap, pra alinhar com o início do título.

## 2. `src/components/views/CRMViagensView.jsx` — adiciona o header

Hoje (linhas 40–82) o componente só renderiza a barra de tabs (condicional a
`tabs.length > 1`) e delega pro sub-componente da aba ativa — sem nenhum h1.

Adicionar, logo no topo do `return`, antes da barra de tabs:

```jsx
import { Plane } from "lucide-react";
import { PageHeader } from "../shared/PageHeader";
// ...
return (
  <div className="flex flex-col gap-4">
    <PageHeader
      icon={Plane}
      title="Viagens & Reembolsos"
      subtitle="Planeje visitas, acompanhe aprovações e lance reembolsos do time comercial"
    />
    {tabs.length > 1 && ( /* barra de tabs, inalterada */ )}
    {/* ... */}
  </div>
);
```

## 3. `src/components/views/CRMViagensPlanejamentoView.jsx` — remove o título interno redundante

Linhas 831–840 hoje:

```jsx
return (
  <div className="flex flex-col gap-6">
    {/* Header */}
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="font-bold leading-tight" style={{ fontSize: 24, color: "var(--text)", letterSpacing: "-0.02em" }}>Viagens e visitas</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Planeje suas visitas do mês e lance despesas de reembolso</p>
      </div>
      <MonthNav mesRef={mesRef} onChange={setMesRef} />
    </div>
```

Decisão aprovada: remover o `<h1>`/`<p>` (redundante com o `PageHeader` novo,
que já fica visível o tempo todo, inclusive nesta aba) e manter só o
`MonthNav`, alinhado à direita:

```jsx
return (
  <div className="flex flex-col gap-6">
    <div className="flex items-center justify-end">
      <MonthNav mesRef={mesRef} onChange={setMesRef} />
    </div>
```

Não mexer nas outras 3 sub-views (`CRMViagensGestorView.jsx`,
`CRMViagensRelatoriosView.jsx`, `CRMViagensCalculadoraView.jsx`) nesta rodada —
cada uma tem seu próprio cabeçalho interno, fora do escopo deste mockup
(o Daniel só aprovou o `PageHeader` de nível de página + a remoção pontual
deste título específico).

## 4. Largura — full-width (decisão aprovada)

`CRMViagensView.jsx` já é full-width (`<div className="flex flex-col gap-4">`,
sem `max-w-*`/`mx-auto`) — **nenhuma mudança necessária aqui**. Confirmar que
nenhum wrapper intermediário nas 4 sub-views adiciona `max-w-*` que
contradiga isso (verificar ao implementar; se existir, remover).

## 5. Fora de escopo desta rodada

- As outras 5 telas (Visão Geral/Solicitações/Despesas/Fornecedores/Campanhas)
  — cada uma recebe seu próprio mockup de aprovação antes de ganhar o
  `PageHeader`. Não adiantar a migração delas agora.
- Decisão de largura para as telas hoje centralizadas (Visão Geral 1080px,
  Solicitações 896px, Fornecedores 1024px) — fica pro mockup de cada uma.

## 6. Verificação

1. `npx vite build` limpo.
2. Testar as 4 abas de Viagens & Reembolsos (Minhas viagens/Gestão/
   Relatórios/Calculadora) — o `PageHeader` deve aparecer igual em todas,
   já que agora vive no componente-pai, não mais dentro de uma aba
   específica.
3. Confirmar visualmente (claro + escuro) que o ícone/título/subtítulo batem
   com o mockup aprovado.
4. Nenhuma classe de bug conhecida reintroduzida.
