# PageHeader — rollout 5/6 (Campanhas + Compras de Marketing)

Aprovado pelo Daniel via mockup HTML (antes/depois, claro+escuro):
`https://claude.ai/code/artifact/b35b5d7e-8b1e-4059-bb4b-bc06d87dff89`,
incluindo a extensão pra Compras de Marketing (mesma casca, confirmada pelo
Daniel).

Diferente das 4 rodadas anteriores: **não** se usa o componente
`PageHeader` aqui. As duas telas já usam `src/components/shared/
KanbanBoardHeader.jsx` — uma casca deliberadamente diferente (barra chapada,
de ponta a ponta, sem cantos arredondados, documentada no próprio arquivo
como réplica intencional do Pipefy). Forçar o `PageHeader` genérico dentro
dela duplicaria a borda inferior ou exigiria quebrar essa casca — não é o
que foi aprovado. `KanbanBoardHeader.jsx` **não é tocado** nesta rodada.

A única mudança real, nas duas telas: o ícone solto (22px, sem caixa) ganha
a mesma caixa 38×38 (`var(--surface-alt)`, `border: 1px solid var(--border)`,
`border-radius: 10`) que as outras 4 telas já têm via `PageHeader`. Título
(26px/700), subtítulo (13px) e largura (full-width) já batiam — nenhuma
mudança neles.

## 1. `src/components/views/MarketingView.jsx` (linhas 1049–1050)

Hoje:

```jsx
<div className="flex items-center gap-2">
  <Megaphone size={22} style={{ color: "var(--text)" }} />
  <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
    Marketing
  </h1>
</div>
```

Vira:

```jsx
<div className="flex items-center gap-2.5">
  <div
    className="flex items-center justify-center flex-shrink-0"
    style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
  >
    <Megaphone size={18} />
  </div>
  <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
    Marketing
  </h1>
</div>
```

O `<p>` de subtítulo logo abaixo (linhas 1055–1057) ganha o mesmo recuo que
o `PageHeader` usa nas outras telas, pra alinhar com o início do título (não
com o ícone):

```jsx
<p className="text-sm mt-0.5" style={{ color: "var(--text-dim)", marginLeft: 48 }}>
  Kanban de campanhas {isAgencia ? "· acesso de visitante" : ""}
</p>
```

Nada mais no arquivo muda — toolbar (Exportar CSV, toggle de view, filtro de
responsável, botão "Nova campanha"), filtros (empresa/canal/Destaques),
`KanbanBoardHeader` em si, tudo intocado.

## 2. `src/components/views/ComprasMarketingView.jsx` (linhas 665–673)

Mesmo tratamento, ícone `ShoppingCart`:

Hoje:

```jsx
<div className="flex items-center gap-2">
  <ShoppingCart size={22} style={{ color: "var(--text)" }} />
  <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
    Compras de Marketing
  </h1>
</div>
<p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
  Solicitações de compra de itens prontos (brindes, uniformes, materiais impressos) executadas pelo Marketing
</p>
```

Vira:

```jsx
<div className="flex items-center gap-2.5">
  <div
    className="flex items-center justify-center flex-shrink-0"
    style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
  >
    <ShoppingCart size={18} />
  </div>
  <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
    Compras de Marketing
  </h1>
</div>
<p className="text-sm mt-0.5" style={{ color: "var(--text-dim)", marginLeft: 48 }}>
  Solicitações de compra de itens prontos (brindes, uniformes, materiais impressos) executadas pelo Marketing
</p>
```

Nada mais no arquivo muda — `CopyPublicLinkButton`, toggle de view, botão
"Nova solicitação", `KanbanBoardHeader`, matriz de aprovação/motor de
transição de Compras, tudo intocado (esse motor é a exceção documentada na
regra 2 do CLAUDE.md — não mexer em nada além do ícone/subtítulo aqui).

## 3. Fora de escopo

- Visão Geral do Marketing — último mockup da rodada de 6, ainda pendente.
- `KanbanBoardHeader.jsx` em si — não é tocado; continua a mesma casca
  edge-to-edge documentada.

## 4. Verificação

1. `npx vite build` limpo.
2. Confirmar visualmente (claro + escuro) que os dois ícones (`Megaphone`,
   `ShoppingCart`) aparecem na caixa 38×38, igual às outras 4 telas.
3. Confirmar que nenhuma outra parte das duas telas mudou — toolbar, filtros,
   `KanbanFab`, matriz de transição de Compras, tudo como estava.
4. Nenhuma classe de bug conhecida reintroduzida.
