# Spec · "Comece por" com destino

15/09/2026. Mockup aprovado pelo Daniel (artifact "Comece Por, com destino"),
fase 1 de duas. Nasce da pergunta dele: "o que acha de fazermos guias
interativos, para o primeiro uso?".

## O achado que mudou a resposta

O guia interativo **já estava construído e ligado**. `ScreenTipCard.jsx` aceita
`comece` como objeto `{ texto, alvo, rotulo }` e, com `alvo`, monta um botão
que chama `irParaAlvoDaDica` (`src/App.jsx:1323`) — rola até o elemento e o
destaca por 2s. Medido antes de propor:

| | |
|---|---|
| guias com `resumo` e `comece` | **115** |
| que usavam a forma de objeto | **0** |
| âncoras `data-tour` já no código | 53 |
| mecanismos de ajuda convivendo | 5 |

É o padrão que as regras 10 e 12 já corrigiram duas vezes: o mecanismo nasce,
é usado uma vez, e preencher nunca vira parte de "pronto". Por isso a fase 1
**não cria um sexto mecanismo** — liga o que estava desligado.

## O que foi feito

**1 · O botão só aparece se o alvo existir.** `ScreenTipCard.jsx` consulta o
DOM (dois `requestAnimationFrame`, o mesmo achado de `use-onboarding-tour.js`)
antes de mostrar o botão. Sem isso ele apareceria sempre que o guia
declarasse um alvo, e clicar não faria nada quando o elemento não estivesse
montado — lista vazia, aba fechada, cargo sem acesso ao bloco.
**Botão morto é pior que botão ausente**: ensina a pessoa a não confiar nele.
Não estava no mockup; foi decidido na implementação e é o que impede a fase 1
de ser cosmética.

**2 · `Tabs.jsx` ganhou `tourPrefix`.** Cada aba passa a emitir
`data-tour="{prefixo}-aba-{id}"` sozinha, em um lugar só — mesmo princípio do
`NavItem` do Sidebar (regra 1). As 6 telas que usam `Tabs` ganham âncora de
graça quando quiserem.

**3 · Quatro guias com destino**, nas telas de chegada:

| Tela | Alvo | Botão |
|---|---|---|
| Pendências | `pendencias-aba-all` (via `tourPrefix`) | Ver a aba Tudo |
| Meu RH | `meu-rh-aba-ferias` | Ver a aba Férias |
| Onboarding | `onboarding-primeira-tarefa` (1ª linha da lista) | Ver a primeira tarefa |
| Meu To-do | `todo-nova-tarefa` | Ver onde criar |

## A armadilha que quase passou

A primeira conversão trocou **uma** ocorrência por guia. Os guias são
**duplicados por cargo** em `VIDEO_TUTORIALS`, e o mesmo texto aparece até 6
vezes — "Meu RH" tinha 6. O resultado teria funcionado para um cargo e
falhado calado para os outros cinco: é a mesma classe do MD-11 e do bug de
14/09 em que a dica mostrava a tela do vizinho, aqui em conteúdo e não em
permissão. Pego pela verificação em navegador, não pelo build: 12 ocorrências
convertidas no total, não 4.

## Verificado em navegador

| Rota | Alvo no DOM | Botão | Destacou |
|---|---|---|---|
| `/meu-rh` | sim | "Ver a aba Férias" | sim |
| `/tarefas-pessoais` | sim | "Ver onde criar" | sim |
| `/rh/onboarding` (base sem tarefa) | **não** | **ausente** | — |
| `/` (Pendências) | as 4 abas emitidas pelo `Tabs` | — | — |

A terceira linha é a guarda funcionando, não uma falha.

## Fora de escopo — fase 2

Um passo, não vários. Não abre gaveta nem modal. Não confere se a pessoa fez.
Os três só caem com um motor que ESPERE o elemento aparecer em vez de
consultar uma vez — decidir isso depois de medir se a fase 1 é usada.

`crm` (Funil de Vendas) ficou de fora de propósito: o texto do guia manda
"percorrer as colunas e abrir o card com o chip de dias parado em vermelho",
que não é um elemento só. Ou o texto muda, ou o alvo vira o primeiro card
parado — decisão de redação, não de código.
