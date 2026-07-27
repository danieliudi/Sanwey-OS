# PageHeader — rollout 4/6 (Fornecedores, Marketing)

Aprovado pelo Daniel via mockup HTML (antes/depois, claro+escuro):
`https://claude.ai/code/artifact/a2c1de17-f6b9-4759-a515-7de2c795c50d`.
Continua o rollout — componente `src/components/shared/PageHeader.jsx` já
existe, não recriar. **Não confundir com `RHFornecedoresView.jsx`** (RH,
domínio separado, já tem seu próprio `Eyebrow`/`PanelTitle` internos e não é
tocado aqui) — este é `src/components/views/FornecedoresView.jsx`
(Marketing).

## 1. `src/components/views/FornecedoresView.jsx`

Hoje (linhas 171–191):

```jsx
return (
  <div className="max-w-5xl mx-auto space-y-4">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <Truck size={22} style={{ color: "var(--text)" }} />
        <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>Fornecedores</h1>
      </div>
      {canWrite && (
        <button onClick={() => setEditing("new")} className="..." style={{...}}>
          <Plus size={14} /> Novo fornecedor
        </button>
      )}
    </div>
    <p className="text-sm" style={{ color: "var(--text-dim)", marginTop: -8 }}>
      Agências, gráficas, confecções e outros parceiros de marketing
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard icon={Truck} value={suppliers.length} label="Fornecedores" />
    </div>
```

Vira:

```jsx
import { PageHeader } from "../shared/PageHeader";
// ...
return (
  <div className="space-y-4">
    <PageHeader
      icon={Truck}
      title="Fornecedores"
      subtitle="Agências, gráficas, confecções e outros parceiros de marketing"
      actions={
        canWrite && (
          <button onClick={() => setEditing("new")} className="..." style={{...}}>
            <Plus size={14} /> Novo fornecedor
          </button>
        )
      }
    />

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard icon={Truck} value={suppliers.length} label="Fornecedores" />
    </div>
```

Mudanças exatas:
- Remove `max-w-5xl mx-auto` (largura cheia, igual às outras 3 telas já
  aprovadas) — vira só `className="space-y-4"`.
- Remove o `<h1>`/`<p>` manual (que hoje ficam em dois blocos separados,
  com `marginTop:-8` pra colar um no outro) — o `PageHeader` já resolve
  título+subtítulo+recuo sem esse ajuste manual.
- Botão "Novo fornecedor" migra pro prop `actions`, sem nenhuma mudança de
  lógica/estilo nele mesmo.

## 2. Fora de escopo desta rodada

- Campanhas (Kanban) e Visão Geral do Marketing — mockups próprios depois.
- A grade `grid grid-cols-1 sm:grid-cols-3 gap-3` com um único `StatCard`
  dentro (2 espaços vazios em telas largas) — **não mexer**. É a mesma
  categoria do achado dos 3 cards de Despesas ("cards sem simetria"); fica
  registrado pra uma rodada futura dedicada a isso, não decidida ainda.

## 3. Verificação

1. `npx vite build` limpo.
2. Confirmar que "Novo fornecedor" continua abrindo o formulário de criação
   (`setEditing("new")`) e que `canWrite` continua controlando sua
   visibilidade.
3. Confirmar que `FilterBar`/`CardGrid`/paginação abaixo não foram tocados.
4. Nenhuma classe de bug conhecida reintroduzida.
