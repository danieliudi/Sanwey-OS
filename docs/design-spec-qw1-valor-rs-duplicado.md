# QW1 — "R$ R$" duplicado na view Tabela do Pipeline

## Problema observado

Arquivo: `src/components/views/CRMView.jsx`, componente `LeadTableView` (declarado na linha 1162).

Dois call-sites concatenam manualmente o prefixo `"R$ "` na frente do retorno de `formatK(lead.value)` — mas `formatK` (em `src/utils/currency.js`, linhas 38-50) já devolve a string com `"R$ "` embutido em todos os seus três ramos:
- valor `< 1.000` → cai em `brlFull.format(value)` (linha 49), que via `Intl.NumberFormat({ style: "currency", currency: "BRL" })` já produz `"R$ 850"`;
- valor `≥ 1.000` → `` `R$ ${ptBRNumber(decimals).format(value / 1_000)}k` `` (linha 47), já com `"R$ "` manual;
- valor `≥ 1.000.000` → `` `R$ ${ptBRNumber(d).format(value / 1_000_000)}M` `` (linha 44), idem.

Os dois pontos com bug:

```
1264:                  {lead.value > 0 ? `R$ ${formatK(lead.value)}` : "—"}
1408:                  {lead.value > 0 ? `R$ ${formatK(lead.value)}` : "—"}
```

- **Linha 1264** — card mobile empilhado (`md:hidden`, bloco que renderiza `sorted.map(lead => …)` a partir da linha ~1220), no badge de valor ao lado do botão de favorito (estrela).
- **Linha 1408** — célula `<td>` "Value" da tabela desktop (`md:` e acima), mesma `LeadTableView`.

Resultado visual com `lead.value` pequeno (ex.: `121`): texto exibido é **"R$ R$ 121"** em vez de **"R$ 121"**. O bug só é visível nesse tier (`< 1.000`), porque é o único ramo de `formatK` que não tem letra de sufixo (`k`/`M`) separando os dois "R$" — em valores compactados o efeito é o mesmo (`"R$ R$ 12k"`), mas menos comentado porque o sufixo distrai menos o olho.

Confirmado por grep que esse é o único padrão de dupla concatenação no arquivo: `grep -n 'R\$ \${formatK' src/components/views/CRMView.jsx` retorna exatamente as linhas 1264 e 1408. As demais ~7 chamadas de `formatK` no mesmo arquivo (linhas 257, 258, 259, 387, 662, 843, 970) já usam a função sozinha, sem prefixo extra, e estão corretas.

## Especificação visual

Nenhum token novo é necessário — esta é uma correção puramente textual, não uma mudança de aparência. Os tokens/cores que já envolvem o texto do valor permanecem exatamente como estão hoje, intocados:

| Elemento | Estado | Estilo atual (mantido) |
|---|---|---|
| Texto do valor | `lead.value > 0` | cor `#15803D` (verde, hardcoded pré-existente — fora de escopo desta correção), `font-weight: 600` (desktop) / `font-semibold text-sm` (mobile) |
| Texto do valor | `lead.value <= 0` (zero, null, undefined) | `"—"` (em-dash), cor `var(--text-dim)` |

A única mudança de conteúdo é o texto renderizado quando `lead.value > 0`:

- **Antes:** `` `R$ ${formatK(lead.value)}` `` → produz `"R$ R$ 121"` (valores `< 1.000`) ou `"R$ R$ 12k"` / `"R$ R$ 1,5M"` (valores compactados).
- **Depois:** `formatK(lead.value)` (sem template literal, sem prefixo extra) → produz `"R$ 121"`, `"R$ 12k"`, `"R$ 1,5M"` — um único `"R$ "`, já embutido pela própria função.

## Comportamento

- Linha 1264 (card mobile) e linha 1408 (célula desktop) devem passar a renderizar apenas `formatK(lead.value)` no lugar de `` `R$ ${formatK(lead.value)}` ``, condicionado do mesmo jeito que já está (`lead.value > 0 ? formatK(lead.value) : "—"`).
- Nenhuma outra condição, cor, ou breakpoint muda. O comportamento responsivo (mobile vs. desktop) e o fallback `"—"` para valor zero/ausente permanecem idênticos.
- `formatK` em `src/utils/currency.js` **não deve ser alterada** — a função está correta; o bug está isolado aos dois call-sites em `CRMView.jsx`.
- As demais ~7 chamadas de `formatK` no mesmo arquivo (linhas 257-259, 387, 662, 843, 970) já estão corretas e não devem ser tocadas.

## Notas de decisão subjetiva

Nenhuma. É uma correção mecânica de duplicação de string — não há decisão de design/UX em aberto. A cor hardcoded `#15803D` usada para valores positivos é uma inconsistência pré-existente com o design system (o arquivo já usa tokens como `var(--text-dim)`, `var(--accent)`, `var(--border)` em outros pontos, mas essa cor de "valor positivo" nunca foi tokenizada) — sinalizo aqui apenas para registro, mas **não faz parte do escopo desta correção** e não deve ser alterada junto.
