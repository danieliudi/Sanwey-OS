# PageHeader — rollout 2/6 (Solicitações)

Aprovado pelo Daniel via mockup HTML (antes/depois, claro+escuro):
`https://claude.ai/code/artifact/d8b9a2ad-84e0-4a27-a4f4-10a20d395f3d`.
Continua o rollout iniciado em `docs/design-spec-page-header-viagens.md`
(componente `src/components/shared/PageHeader.jsx`, já existente — não
recriar, só reaproveitar).

## 1. `src/components/views/MarketingRequestsView.jsx`

Hoje (linhas 361–383):

```jsx
return (
  <div className="max-w-4xl mx-auto space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="font-bold text-xl" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
          Solicitações
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
          Pedidos de material recebidos de outros departamentos
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <CopyPublicLinkButton url={...} label="Copiar link público" title={...} variant="strong" />
        <div className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{...}}>
          <AlertCircle size={12} />
          {counts.pendente} pendente{counts.pendente !== 1 ? "s" : ""}
        </div>
      </div>
    </div>

    {/* Status filter tabs */}
    <div className="flex items-center gap-1 flex-wrap">
      {/* ... */}
    </div>
```

Vira:

```jsx
import { Inbox, AlertCircle, ... } from "lucide-react"; // Inbox já importado (linha 3, usado no empty-state)
import { PageHeader } from "../shared/PageHeader";
// ...
return (
  <div className="space-y-4">
    <PageHeader
      icon={Inbox}
      title="Solicitações"
      subtitle="Pedidos de material recebidos de outros departamentos"
      actions={
        <>
          <CopyPublicLinkButton url={`${window.location.origin}/solicitar-marketing`} label="Copiar link público" title={`${window.location.origin}/solicitar-marketing`} variant="strong" />
          <div className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
            <AlertCircle size={12} />
            {counts.pendente} pendente{counts.pendente !== 1 ? "s" : ""}
          </div>
        </>
      }
    />

    {/* Status filter tabs — inalterado */}
    <div className="flex items-center gap-1 flex-wrap">
      {/* ... */}
    </div>
```

Mudanças exatas:
- Remove o wrapper `max-w-4xl mx-auto` (decisão aprovada: largura cheia,
  igual à Viagens & Reembolsos) — vira só `className="space-y-4"`.
- Remove o `<div className="flex items-center justify-between...">` manual
  do header, substituindo por `<PageHeader .../>` com `icon={Inbox}` (mesmo
  ícone já usado no empty-state desta tela, linha ~13 da spec anterior —
  reaproveitar, não escolher outro).
- `CopyPublicLinkButton` e o contador de pendentes migram pro prop `actions`,
  sem nenhuma mudança de lógica/props neles mesmos — só de posição.
- Barra de tabs de status (linhas 386–416) fica **exatamente como está**,
  só que agora abaixo do `PageHeader` em vez de abaixo do header antigo —
  nenhuma mudança de código nela.

## 2. Fora de escopo

Despesas, Fornecedores (Marketing), Campanhas e Visão Geral do Marketing —
cada uma com seu próprio mockup de aprovação antes de mexer.

## 3. Verificação

1. `npx vite build` limpo.
2. Testar as 4 abas de status (Pendentes/Aprovadas/Rejeitadas/Todas) — devem
   continuar funcionando exatamente como hoje, só com o header novo acima.
3. Confirmar que "Copiar link público" e o contador de pendentes continuam
   funcionais (o botão realmente copia o link, o contador reflete
   `counts.pendente` em tempo real).
4. Nenhuma classe de bug conhecida reintroduzida.
