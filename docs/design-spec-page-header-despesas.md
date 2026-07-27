# PageHeader — rollout 3/6 (Despesas)

Aprovado pelo Daniel via mockup HTML (antes/depois, claro+escuro):
`https://claude.ai/code/artifact/21b9d878-4887-4e9d-bec6-55a1ccf6d68e`.
Continua o rollout (`docs/design-spec-page-header-viagens.md`,
`docs/design-spec-page-header-solicitacoes.md`) — componente
`src/components/shared/PageHeader.jsx` já existe, não recriar.

Menor mudança das 3 rodadas até aqui: `DespesasView.jsx` já usava
`fontSize:26`/`font-bold` (700) e já era largura cheia (sem `max-w-*`). A
única diferença real é o ícone (hoje solto, 22px, sem caixa) e a ausência de
divisor abaixo do header.

## 1. `src/components/views/DespesasView.jsx`

Hoje (linhas 620–646):

```jsx
return (
  <div>
    <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2">
          <DollarSign size={22} style={{ color: "var(--text)" }} />
          <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Despesas
          </h1>
        </div>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
          Controle de gastos e investimentos de marketing · Total filtrado: {formatK(totals.all)}
        </p>
      </div>
      {canWrite && (
        <button onClick={openNew} className="..." style={{...}}>
          <Plus size={15} />
          Nova Despesa
        </button>
      )}
    </div>
```

Vira:

```jsx
import { PageHeader } from "../shared/PageHeader";
// ...
return (
  <div>
    <PageHeader
      icon={DollarSign}
      title="Despesas"
      subtitle={`Controle de gastos e investimentos de marketing · Total filtrado: ${formatK(totals.all)}`}
      actions={
        canWrite && (
          <button onClick={openNew} className="..." style={{...}}>
            <Plus size={15} />
            Nova Despesa
          </button>
        )
      }
    />
```

O botão "Nova Despesa" mantém exatamente as mesmas classes/estilo/hover que
já tem hoje — só muda de posição (entra no prop `actions`). Nenhuma mudança
de largura (já era full-width) nem no restante do arquivo (stat tiles,
filtros, tabela).

## 2. Fora de escopo desta rodada

- Fornecedores (Marketing), Campanhas, Visão Geral — mockups próprios depois.
- Os 3 cards "Total/Pendente/Pago" (linhas 648–673) — estilo próprio dessa
  tela, diferente do `StatCard` usado em Visão Geral/RH/Comercial. Daniel
  optou por não decidir agora se isso vira `StatCard` de verdade ou fica
  como está — fica em aberto pra uma rodada separada, **não mexer aqui**.

## 3. Verificação

1. `npx vite build` limpo.
2. Confirmar que "Nova Despesa" continua abrindo o modal de criação
   (`openNew`) e que `canWrite` continua controlando sua visibilidade.
3. Confirmar que o subtítulo segue reativo — `Total filtrado` deve mudar
   quando os filtros de categoria/status/empresa mudam (já é o comportamento
   atual via `totals.all`, só confirmar que não quebrou).
4. Nenhuma classe de bug conhecida reintroduzida.
