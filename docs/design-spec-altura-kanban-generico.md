# Corrigir altura divergente dos Kanbans (componente genérico, 1 arquivo)

Diagnosticado via Workflow adversarial (2 fases de verificação) em 27/07/2026. Aprovado pelo Daniel via
mockup (`https://claude.ai/code/artifact/e5f64395-4088-41a8-8069-437c821a991a`, seção 1).

## Causa raiz

`src/hooks/use-available-height.js` mede a altura disponível **uma única vez**, no `useEffect` que roda
quando o componente monta — e desiste em silêncio se o board (`ref.current`) ainda não existir naquele
instante (`if (!el) return;`, hoje na linha 28-29). Quando a tela esconde o board atrás de um "Carregando…"
(Campanhas, Entregas, Tarefas — todas com `!loading && !loadingStages` como gate), o board só nasce DEPOIS
que o efeito já rodou e desistiu — e como as deps hoje são `[]` (constante), o efeito nunca mais roda. O
board fica travado no valor inicial (`useState(480)`, linha 25).

O Funil de Vendas (`CRMView.jsx:451`) chama o hook com os MESMOS argumentos dos boards quebrados — só não
quebra porque, por acidente de estrutura, o board já existe no DOM no primeiro instante.

**Achado extra confirmado pela verificação adversarial**: o próprio Funil de Vendas tem um bug latente — ao
alternar pra "Tabela"/"Calendário" e voltar pro Kanban (`CRMView.jsx:814-832`), um board NOVO nasce no DOM,
mas o hook continua com a referência do board antigo (já removido), medindo posição zero. Como `viewMode`
não está nas deps, o efeito não roda de novo. Esse é exatamente o sintoma original que motivou criar este
hook, e já foi corrigido 4 vezes, view por view (`RHRecrutamentoView.jsx:2672`, `RHOnboardingView.jsx:1152`,
`RHFeedbackView.jsx:1335`, `RHTreinamentosView.jsx:1130`) — reincidiu numa 5ª leva porque a correção estava
espalhada em vez de estar na fonte.

## Correção — só `src/hooks/use-available-height.js`

Trocar de "medir uma vez, na esperança de que o elemento já exista" para "reagir a quando o elemento
aparece", via callback ref (padrão React para isso — dispara toda vez que o nó monta/desmonta, não só na
montagem do componente pai):

```js
// Antes
import { useEffect, useRef, useState } from "react";

export function useAvailableHeight(marginBottom = 16, deps = []) {
  const ref = useRef(null);
  const [height, setHeight] = useState(480);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { /* ... */ };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { window.removeEventListener("resize", measure); ro.disconnect(); };
  }, [marginBottom, ...deps]);

  return [ref, height];
}
```

```js
// Depois
import { useCallback, useEffect, useState } from "react";

export function useAvailableHeight(marginBottom = 16, deps = []) {
  const [el, setEl] = useState(null);
  const ref = useCallback((node) => setEl(node), []);
  const [height, setHeight] = useState(480);

  useEffect(() => {
    if (!el) return;
    const measure = () => { /* corpo idêntico ao de hoje, só troca `el` no lugar de `ref.current` */ };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { window.removeEventListener("resize", measure); ro.disconnect(); };
  }, [el, marginBottom, ...deps]);

  return [ref, height];
}
```

O corpo interno de `measure()` (o cálculo de altura em si — pegar `getBoundingClientRect`, subtrair
`marginBottom`, etc.) **não muda em nada**, só troca toda referência a `ref.current` por `el`.

### Por que nenhuma das 11 telas precisa mudar

`return [ref, height]` continua com a mesma forma — todo consumidor faz `const [boardRef, boardHeight] =
useAvailableHeight(...)` e passa `boardRef` pra alguma `<div ref={boardRef}>`. `ref` deixa de ser um objeto
`useRef` e vira uma função (`useCallback`), mas o React trata os dois casos de forma transparente quando
atribuídos a `ref={...}` de um elemento DOM — nenhuma tela precisa saber a diferença. Confirmado por grep:
nenhuma das 11 views acessa `boardRef.current` diretamente (só aparece em comentários explicativos).

## Fora de escopo (documentado, não corrigir agora)

- **Entregas** vai ficar ~40-300px mais baixo que os outros mesmo depois do fix — tem um painel "Análise das
  entregas" (`EntregasView.jsx:1304-1305`) abaixo do board, contado na altura disponível. Isso é uma escolha
  de layout já existente (no Funil a Análise virou aba separada), não um bug — não mexer nisso aqui.
- **3 boards de RH** (Onboarding, Feedback, Treinamentos) têm um defeito cosmético de ~16px (coluna em altura
  fixa de pixel em vez de 100%, `RHOnboardingView.jsx:335`, `RHFeedbackView.jsx:740`,
  `RHTreinamentosView.jsx:661`) que pode gerar uma barra de rolagem vertical espúria. Baixa prioridade,
  **corrigir só se for trivial** ao mexer nesses arquivos por outro motivo — não é o foco desta rodada.
- `boardHeight`/deps redundantes que sobrarem nas 5 telas de RH depois da correção (já passam `viewMode`,
  agora desnecessário) — não precisa limpar, não quebra nada continuando lá.

## Verificação

1. `npx vite build` limpo.
2. Visualmente: Campanhas, Entregas, Tarefas — as colunas devem esticar até o rodapé da página, igual ao
   Funil de Vendas, mesmo estado (poucos cards, sem scroll).
3. Funil de Vendas: alternar entre Kanban → Tabela → Kanban e confirmar que a altura do board continua
   correta na volta (esse é o teste do bug latente).
4. Os 8 boards que já funcionavam (Funil de Vendas primeira carga, Pós-venda, Compras, 5 boards de RH)
   continuam exatamente como estavam — nenhuma regressão.
