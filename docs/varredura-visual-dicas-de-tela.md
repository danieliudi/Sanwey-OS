# Varredura visual: dica de tela e defeitos parentes

Varredura em navegador real (Chromium via Playwright), sem banco, variando o
cargo do usuário mock — pedida depois de o Daniel abrir a plataforma em
14/09/2026 e receber um toast "📊 Visão Geral · RH" cujo corpo descrevia o
Comercial. Ver `CLAUDE.md` raiz, regras 3 (mockup antes de mudar visual), 3.2
(gates + varredura em navegador) e 5 (nada em produção sem confirmação do
Daniel) — nada aqui foi corrigido, só levantado.

Não é conserto. Achados descrevem o que está errado e por quê; recomendações
(seção 6) ficam separadas, sem código.

> **Nota de 14/09/2026, acrescentada ao arquivar este relatório.**
> Esta varredura mediu o código **antes** das correções da v5.12.1 e da
> v5.13.0, que saíram no mesmo dia. Ela é a linha de base — e vale guardada
> justamente por isso: foi levantada de forma independente, em navegador de
> verdade, e confirmou por captura o que a leitura de código tinha concluído.
>
> Já corrigido quando este relatório foi arquivado: a busca por `description`
> virou busca por `route` (Classe A) · a chave de "já visto" virou o id da
> seção (Classe C) · a dica passou a ler `roles[]` (Classe A, caso sintético) ·
> o `AppToast` ganhou teto de altura e rolagem (Classe B) · as 3 chaves mortas
> (Classe C) · o `SECTION_SCREEN_TIP_KEYS` citado ao longo do texto **não
> existe mais**.
>
> Corrigido **por causa deste relatório**, e só dele: a tela Ajuda & Tutoriais
> mostrando os 25 guias de Vendedor com o cabeçalho "Conteúdo para Diretoria",
> e a ausência de guias de Marketing e RH pra quem tem acesso a tudo.
>
> Continua em aberto: o alvo `rh-onboarding-busca-card` (ver a nota no próprio
> `feature-spotlights.js`) e os cinco itens da seção 4.

## 0. Como isto foi feito

Ambiente: sandbox cloud com Chromium pré-instalado, sem acesso ao domínio
`cdn.playwright.dev` (egress bloqueado) — em vez de `npx playwright install
chromium`, apontei `CHROMIUM_PATH` pro binário já presente, mesma técnica que
`scripts/qa/smoke-rotas.mjs:62-66` já suporta nativamente. Não precisei tocar
a infra do repo pra isso.

Rodada 1 — infraestrutura já pronta, sem alteração:

```
npm install
npm i --no-save playwright
CHROMIUM_PATH=<chromium local> npm run qa:smoke       → 52 rotas × 2 viewports, 0 achados
CHROMIUM_PATH=<chromium local> npm run qa:interacao   → 26 leads semeados, drawer, acordeão, 0 achados
```

Confirma que o ambiente sem banco renderiza a tela certa (não caiu na
armadilha do `.env.local` descrita no `CLAUDE.md` 3.2 — as 52 rotas
mostraram conteúdo de verdade, nenhuma caiu em tela de login).

Rodada 2 — script próprio (não versionado, não faz parte de `scripts/qa/`),
reaproveitando o MESMO mecanismo de `smoke-rotas.mjs` (dev server via
`vite.smoke.config.js`, usuário mock gravado em `localStorage` antes de cada
navegação): variei o **cargo** do usuário a cada rodada e, em vez de só
procurar erro de console, medi o conteúdo e a geometria da dica
(`useScreenTips`). Pra cada uma das 140 combinações (10 cargos × 14 telas
mapeadas em `SECTION_SCREEN_TIP_KEYS`, `src/App.jsx:152-167`):

1. Grava `gs_v4_current_user` com aquele cargo (escalar `role` = `roles[0]`,
   confirma-se abaixo por que isso importa).
2. Grava "já visto" pra onboarding, tour, novidades e coachmark — **nunca**
   pra `gs_v4_screen_tips_seen`, porque a dica só aparece na 1ª visita e é
   exatamente isso que estou medindo.
3. Navega pra rota da tela, espera 1.500ms, mede: `location.pathname` final
   (prova se houve redirecionamento — muitos cargos não têm acesso e são
   mandados de volta antes de a dica renderizar), título e corpo da dica se
   existir, altura da caixa vs. altura da viewport, se o topo da caixa fica
   acima de `y=0` (cortado, sem como rolar).
4. Screenshot só quando a dica aparece (evita 140 capturas repetindo "nada
   aqui" — a prova de que não apareceu está no dado, não numa imagem vazia,
   exceto no achado #6 abaixo, que ganhou 1 captura mesmo assim).

Viewports: 1440×900 (desktop) e 390×844 (mobile) — a passada mobile só
repetiu as combinações que a passada desktop já tinha confirmado com dica
visível (o conteúdo não muda por viewport, só a geometria).

Cargos cobertos (lista real, `src/constants/user-settings.js:164`, mesma de
`ROLE_OPTIONS_ADMIN`): `vendedor`, `gerente`, `marketing`,
`gerente_marketing`, `agencia`, `rh`, `gerente_rh`, `diretoria`, `comex`,
`admin` — 10, não 8. `portal` existe em `VIDEO_TUTORIALS` mas não nesta
lista (papel à parte, sem nenhuma das 14 seções mapeadas — não entrou na
varredura de navegador, só na análise estática da seção 1).

Script de análise estática (recomputa a mesma expressão que
`useScreenTips.js` roda, direto do módulo real `src/data/tutorials.js`, sem
reescrever os dados à mão) usado pra cruzar com os números do item 1 da
tarefa — resultado na seção 1.

## 1. Matriz tela × cargo

Legenda: **correta** (o que abre bate com o que o guia descreve) ·
**tela errada** (abre, mas descreve outra tela) · **vazia** (a seção está
mapeada em `SECTION_SCREEN_TIP_KEYS` mas nenhum guia do cargo tem aquela
`description` — a dica simplesmente não nasce) · **não testada** (o cargo
foi redirecionado antes de a rota pedida renderizar — sem acesso ao módulo).

| Cargo \ Tela | Funil de Vendas | Sinais | Automações | Executivo | Campanhas | Entregas | Despesas | Rel. Feiras | Rel. Conteúdo | Visão Geral · Mkt | Visão Geral · RH | Funcionários | Recrutamento | Férias |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **vendedor** | vazia | correta | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada |
| **gerente** | vazia | correta | correta | correta | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada |
| **marketing** | não testada | não testada | não testada | não testada | correta | correta | correta | vazia | vazia | correta | não testada | não testada | não testada | não testada |
| **gerente_marketing** | não testada | não testada | não testada | vazia | correta | correta | correta | vazia | vazia | correta | não testada | não testada | não testada | não testada |
| **agencia** | não testada¹ | não testada¹ | não testada¹ | não testada¹ | correta | correta | não testada¹ | não testada¹ | não testada¹ | não testada¹ | não testada¹ | não testada¹ | não testada¹ | não testada¹ |
| **rh** | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | correta | correta | correta | correta |
| **gerente_rh** | não testada | não testada | vazia | vazia | não testada | não testada | não testada | não testada | não testada | não testada | correta | correta | correta | correta |
| **diretoria** | vazia | correta | não testada | vazia | vazia | vazia | vazia | vazia | vazia | **tela errada** | **tela errada** | vazia | vazia | vazia |
| **comex** | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada | não testada |
| **admin** | vazia | correta | correta | correta | vazia | vazia | vazia | vazia | vazia | **tela errada** | **tela errada** | vazia | vazia | vazia |

¹ `agencia` sem acesso é sempre redirecionado pra `/marketing/inicio` —
como é uma navegação de verdade (não um erro), a dica de "Campanhas" (a
correta pra Marketing) aparece, mas pertence à tela de destino, não à
solicitada. Não conta como acerto nem erro da tela pedida.

**Totais (140 combinações, cargo único, sem redirecionamento):**
26 corretas · 4 tela errada · 28 vazia · 82 não testada (78 redirecionado
sem dica + 4 redirecionado com a dica do destino, nota¹).

### Comparação com o levantamento estático do item 1

Duas contagens diferentes, propositalmente:

**Estática (ignora se o cargo alcança a tela — roda a mesma expressão do
código, `videos.find(v => v.description === screenKey)`, pros 10 cargos ×
14 telas, sem navegar)**: meu recálculo deu **27 corretas · 12 tela errada
· 101 vazia**, contra as **26 · 9 · 105** citadas no item 1. Diferença: +1
correta, +3 erradas, -4 vazias. Três números do levantamento original
batem exatos com o meu recálculo — as 3 chaves mortas (achado #6), os
**93 guias** únicos em `VIDEO_TUTORIALS` e o maior passo isolado com
**719 caracteres** — o que sustenta que a metodologia do levantamento
estava certa; a fonte mais provável da diferença fina é rastrear à mão,
guia por guia, qual entrada vem PRIMEIRO num array de até 36 itens
(`gerente`/`admin`) pra saber quem `find()` escolhe — fácil de errar por
contagem manual. Meu número roda a mesma função que o navegador roda, não
relê o array visualmente.

**Empírica (navegador, com redirecionamento real — o que a pessoa de fato
vê)**: **26 · 4 · 28**, mais **82 não testada**. A diferença grande está
aqui: a maioria das combinações "erradas" da análise estática nunca chega a
renderizar — o cargo é redirecionado pra outro lugar antes. Das 12 combinações
estaticamente erradas, só 4 sobrevivem ao controle de acesso: **diretoria**
e **admin**, em `marketing-home` e `rh-overview` — são os únicos dois
cargos com alcance amplo o bastante (13/14 e 14/14 das telas mapeadas,
contra no máximo 7/14 de qualquer outro cargo) pra realmente abrir as duas
telas que colidem na mesma chave.

## 2. Achados por classe

### Classe A — conteúdo errado (usuário confia e age errado)

**[Classe A] Visão Geral · Marketing e Visão Geral · RH · diretoria e admin
— corpo sempre do Comercial, nunca da tela aberta.**
O toast mostra `📊 Visão Geral · Marketing` (ou `· RH`) — título correto — e
8 passos sobre "leads", "Funil de Vendas aberto", "Fit score médio",
"Distribuição por etapa do funil": conteúdo de Comercial, byte-a-byte
idêntico nas duas telas. Nada disso existe em `/marketing/inicio` nem
`/rh`.
Evidência: `docs/mockups/varredura-20260914/desktop_diretoria_rh-overview.png`,
`desktop_admin_marketing-home.png` · `src/hooks/use-screen-tips.js:36`
(`videos.find(v => v.description === screenKey)`) · `src/App.jsx:161,163`
(`"marketing-home": "Visão Geral"`, `"rh-overview": "Visão Geral"`) ·
`src/data/tutorials.js` (guia `v-co1`, `description: "Visão Geral"`,
`route: "commercial-overview"` — 2º guia do array `gerente`/`admin`, mas o
1º com essa `description`).
Mecanismo: `SECTION_SCREEN_TIP_KEYS` mapeia 2 seções diferentes pra mesma
string de busca "Visão Geral", que por sua vez também é a `description` de
um 3º guia (Comercial) que não está mapeado a NENHUMA seção. Como
`Array.find` retorna o primeiro que bate, e o guia do Comercial é o
primeiro com essa `description` no array de `gerente`/`admin`, ele ganha
sempre — em qualquer uma das 2 telas, pra qualquer cargo cujo array de
tutoriais tenha essa colisão.

**[Classe A] Mesmo defeito por outra porta: cargo escalar em vez de
`roles[]` (caso sintético, fora da matriz de 10 cargos, mas alcançável de
verdade).**
Usuário com `role: "vendedor"` (escalar) e `roles: ["vendedor",
"gerente_rh"]` — RH como cargo SECUNDÁRIO. O controle de ACESSO usa
`roles[]` corretamente (`isRHManager = hasAnyRole(["gerente_rh", "admin"])`,
`src/App.jsx:204`, mesma correção já registrada como MD-11 no
`CLAUDE.md` §2.1) e deixa o usuário entrar em `/rh` sem redirecionamento.
Mas o CONTEÚDO da dica usa `currentUser?.role` — o escalar — então esse
usuário recebe o guia de **Vendedor**, que por coincidência também tem um
guia com `description: "Visão Geral"` (do Comercial) — mesmo texto errado
do achado anterior, por um caminho diferente. Se o cargo primário não
tivesse nenhum guia "Visão Geral", o resultado seria "vazia" em vez de
"errada" — é o que acontece no mesmo teste pra `rh-funcionarios` (vendedor
não tem guia "Funcionários").
Evidência: `docs/mockups/varredura-20260914/desktop_vendedor-multi_rh-overview.png`
· `src/hooks/use-screen-tips.js:30` (`const role = currentUser?.role ||
"vendedor";`).
Mecanismo: mesma classe do MD-11 (`CLAUDE.md` §2.1), aqui em conteúdo em
vez de permissão — exatamente como o item 1 da tarefa já apontava.

**[Classe D, mesmo mecanismo] Ajuda & Tutoriais mostra os 25 guias de
Vendedor pra quem é Diretoria.**
`/ajuda` como `diretoria`: cabeçalho diz *"Conteúdo para **Diretoria** — 25
Guias disponíveis para seu perfil"*, e a lista logo abaixo é exatamente a
de Vendedor — "Sua fila de pendências", "Visão Geral do Comercial", "O
quadro do Funil de Vendas...", "Criando um negócio novo"... (confirmado:
`VIDEO_TUTORIALS.vendedor` tem exatamente 25 entradas). `ROLE_LABEL` tem
entrada própria pra "Diretoria" (`TutoriaisView.jsx:19`) — o rótulo está
certo, só o conteúdo por trás é herdado.
Evidência: `docs/mockups/varredura-20260914/desktop_diretoria_ajuda.png` ·
`src/components/views/TutoriaisView.jsx:313-314`
(`VIDEO_TUTORIALS[role] || VIDEO_TUTORIALS.vendedor`) · `src/data/tutorials.js:61-189`
(chaves definidas: `vendedor, gerente, admin, marketing, gerente_marketing,
agencia, rh, gerente_rh, comex, portal` — falta `diretoria`).
Mecanismo: mesmo fallback dos dois achados acima — `diretoria` é o único
dos 10 cargos canônicos sem entrada própria em `VIDEO_TUTORIALS`, e o
fallback é sempre `vendedor`, silenciosamente, nas duas telas que
consultam essa constante.

### Classe B — a caixa não cabe ou não é legível

**[Classe B] A dica errada (achado acima) ocupa 87% da viewport desktop e
95% no mobile — no celular, o topo fica fisicamente fora da tela, sem
rolagem possível.**
2.235 caracteres em 8 passos — 2º maior guia da base inteira. Em 390×844,
`getBoundingClientRect().top = -34px` (medido, não estimado): os primeiros
itens da lista nascem 34px ACIMA do topo da viewport. `overflow-y:
visible` — sem barra de rolagem interna, e o toast é `position: fixed`,
então rolar a página por trás não ajuda.
Evidência: `docs/mockups/varredura-20260914/mobile_diretoria_rh-overview.png`
· `src/components/shared/AppToast.jsx:71-84` (bloco de estilo do container
— sem `maxHeight`, sem `overflow`, `maxWidth: 380` mas nenhum limite de
altura).
Mecanismo: combinação do achado de conteúdo (guia errado, que por acaso é
grande) com um defeito estrutural do `AppToast` que não depende do
conteúdo estar certo ou errado — ver próximo achado.

**[Classe B] Mesmo com conteúdo CORRETO, guias legítimos já estouram
metade da tela.**
"Sinais" (vendedor/gerente/admin/diretoria): 62% da viewport desktop, 70%
mobile. "Recrutamento" (rh/gerente_rh): 55% desktop, 59% mobile. Das 43
combinações em que a dica realmente apareceu nesta varredura, **11 (26%)
passam de 50%** da altura da viewport e **5 (12%) passam de 80%** — as 5
são justamente as do achado de conteúdo errado (inclusive o caso
sintético).
Evidência: `docs/mockups/varredura-20260914/desktop_vendedor_signals.png`,
`desktop_rh_rh-recrutamento.png`, `mobile_rh_rh-recrutamento.png` ·
`src/components/shared/AppToast.jsx:71-84`.
Mecanismo: mesmo defeito estrutural do achado anterior — nenhum teto de
altura no container, para nenhuma das duas variantes (`title`/`children`)
do `AppToast`. Distribuição completa na seção 3.

### Classe C — a dica existe e está vazia, ou não existe onde deveria

**[Classe C] 3 chaves de seção nunca encontram texto, pra nenhum dos 10
cargos.**
`crm: "Negócios"`, `marketing-feiras: "Relatório de Feiras"`,
`marketing-conteudo: "Relatório de Conteúdo"` — busquei essas 3 strings
exatas nos 93 guias únicos da base inteira (não só nos 10 cargos
canônicos): zero ocorrências. A tela mais usada da plataforma (Funil de
Vendas) fica sem dica nenhuma pra ninguém — confirmado ao vivo pra
vendedor, gerente, diretoria e admin (os 4 cargos que alcançam `/pipeline`
sem redirecionamento).
Evidência: `docs/mockups/varredura-20260914/desktop_vendedor_crm_VAZIA.png`
· `src/App.jsx:152` (`crm: "Negócios"`) — os guias reais de Funil de Vendas
usam `description: "Funil de Vendas"` (ex. `v-v1`, `v-v2` em
`src/data/tutorials.js`).
Mecanismo: a string em `SECTION_SCREEN_TIP_KEYS` foi escrita diferente do
`description` real do guia correspondente — provável renomeação de um lado
sem atualizar o outro. Sem relação com o mecanismo dos achados de Classe A
(aqui não há colisão, há divergência simples de texto).

**[Classe C] Diretoria e Admin — os dois cargos com MAIS acesso são os que
MENOS recebem dica.**
Diretoria alcança 13 das 14 telas mapeadas sem redirecionamento; Admin,
14/14 — mais que qualquer outro cargo (o 3º colocado, `gerente_marketing`,
alcança 7/14). Mas das telas que alcançam, só 3 mostram algo certo
(Sinais, Automações\*, Executivo\*) e 2 mostram o conteúdo errado (achado
de Classe A) — as outras 9 ficam vazias: Funil de Vendas, Campanhas,
Entregas, Despesas, Rel. Feiras, Rel. Conteúdo, Funcionários, Recrutamento,
Férias. Resultado: quem mais navega pela plataforma é quem menos é
ajudado por essa feature. (\*Automações e Executivo só existem pra
diretoria via o array `gerente`, e diretoria não tem acesso a
`/automacoes` — só admin/gerente têm; ver matriz.)
Evidência: matriz completa, seção 1 · `src/data/tutorials.js:61-189`
(guias de Marketing/RH vivem só nos arrays `marketing`, `gerente_marketing`,
`rh`, `gerente_rh` — nada equivalente no array `gerente`, que é o que
`admin` usa, nem em nenhum array próprio pra `diretoria`, que nem existe).
Mecanismo: os guias foram escritos por departamento, e `gerente`/`admin`
herdaram só o conjunto de Comercial + Sinais + Automações + Executivo —
sem nada de Marketing ou RH, apesar de admin ter acesso de leitura a tudo.

**[Classe C, achado de leitura de código — sem captura, o efeito é ausência
de algo, ver seção 4] Fechar qualquer uma das 2 dicas "Visão Geral" apaga
as duas pra sempre pro mesmo usuário.**
A chave de "já visto" é `screenTipsSeenMap[userId][screenKey]`
(`use-screen-tips.js:28,41`) — e `screenKey` é literalmente a string "Visão
Geral", compartilhada por `marketing-home` E `rh-overview`
(`src/App.jsx:161,163`). Dispensar o toast numa tela grava "Visão Geral:
true" pro usuário, e a outra tela nunca mais mostra nada — não porque foi
vista, porque a CHAVE foi.
Evidência: `src/hooks/use-screen-tips.js:28,36,41` · `src/App.jsx:161,163`.
Mecanismo: mesma colisão de string do achado de Classe A, agora no lado do
armazenamento em vez da busca de conteúdo — as duas colisões têm a mesma
causa raiz (`screenKey` compartilhado) mas efeitos diferentes o bastante
pra valerem achados separados.

### Classe D — mesmo padrão em outros lugares

**[Classe D] 4 alvos de tour guiado (`data-tour`) não existem na tela na
1ª carga da rota, sem nenhuma nota no arquivo dizendo que são
condicionais.**
`src/data/feature-spotlights.js` documenta, em comentário, pelo menos 20
casos em que um `target` só existe depois de abrir um modal/drawer
específico — cada um com uma nota explícita tipo "alvo vive dentro do
modal X" e a decisão registrada (regra 12 do `CLAUDE.md`). Rodei a mesma
checagem (`document.querySelector(target)`, usuário admin, 1ª carga de
cada rota referenciada) pra TODAS as 39 entradas: 15 não encontraram o
alvo. Filtrando as que TÊM nota explícita de "condicional" no comentário
(ex. `chat-manage-channel`, `ata-voz-gravar`, `lead-tab-email`,
`proposal-line-items`, `registrar-caso-header`, os 2 de `clients`,
`viagens-calcular-atalho`), sobram **4 sem nenhuma explicação no
arquivo**:
- `programas-novo` (rota `rh-bem-estar`, `target='[data-tour="programas-novo"]'`)
- `comunicado-canais` (rota `rh-comunicacao`)
- `captura-utm-dica` (rota `settings`)
- `rh-busca-card` (rota `rh-onboarding`, `target='[data-tour="rh-onboarding-busca-card"]'`)
O mecanismo já documentado no topo do próprio arquivo (`feature-spotlights.js:23`)
é que alvo ausente se auto-marca como visto, em silêncio — se esses 4
`data-tour` de fato não existem mais nos componentes reais, os 4 avisos
correspondentes muito provavelmente nunca apareceram pra ninguém.
Evidência: `docs/mockups/varredura-20260914/desktop_admin_settings_spotlight-ausente.png`,
`desktop_admin_rh-bem-estar_spotlight-ausente.png` ·
`src/data/feature-spotlights.js:92-96` (programas-novo), `:119-124`
(comunicado-canais), `:152-157` (captura-utm-dica), `:566-571`
(rh-busca-card).
Ressalva: não fui atrás de qual componente deveria ter o atributo — é
possível que exista sob alguma condição de estado que o usuário sintético
desta varredura não reproduziu (ex. algo que só aparece com um registro
específico). Ver seção 4.

## 3. Medição de tamanho

Base inteira (`VIDEO_TUTORIALS`, 93 guias únicos, contando por `id` — os
arrays de `gerente` e `admin` são o mesmo objeto, `tutorials.js:189`, não
contei 2x):

| | caracteres |
|---|---|
| mínimo | 185 |
| p25 | 405 |
| mediana | 675 |
| p75 | 1.180 |
| p90 | 1.895 |
| máximo | 2.601 |
| média | 882 |
| maior passo isolado | 719 |

Distribuição: 12 guias com menos de 300 caracteres · 27 entre 300–600 · 26
entre 600–1.000 · 7 entre 1.000–1.500 · **21 com mais de 1.500** — quase 1
em cada 4 guias já nasce longo o bastante pra ser um problema de leitura em
toast, antes mesmo de qualquer erro de conteúdo.

Das 43 combinações cargo×tela que mostraram dica nesta varredura (1ª
visita, cargo único):

| | desktop (1440×900) | mobile (390×844) |
|---|---|---|
| mediana de caracteres | 379 | 379 (mesmo conteúdo) |
| mediana de % da viewport | 22% | 23% |
| > 50% da viewport | 11/43 (26%) | 11/43 (26%) |
| > 80% da viewport | 5/43 (12%) | 5/43 (12%) |
| cortada acima do topo (`top < 0`, sem rolagem) | 0/43 | **5/43** |

As 5 que passam de 80% são as mesmas nos dois viewports (dependem do
conteúdo, não do tamanho de tela) — e são justamente as 5 instâncias do
achado de Classe A (diretoria×2, admin×2, caso sintético×1). No mobile,
essas 5 saem da viewport por cima em -34px, sem barra de rolagem
(`overflow-y: visible`) — inacessíveis de fato, não só grandes.

## 4. Não consegui verificar

- **Fechar dica apaga a outra da mesma chave (achado de Classe C):**
  dedução direta do código (mesma `screenKey` de armazenamento), não
  cliquei em "Fechar" numa tela e recarreguei a outra pra confirmar ao
  vivo.
- **Os 4 alvos de spotlight sem nota (achado de Classe D):** confirmei
  ausência no DOM na 1ª carga da rota com usuário admin — não fui atrás de
  qual componente deveria carregar o `data-tour`, nem testei com dado
  específico que talvez condicione o elemento a aparecer.
- **Toast "Novidades" (changelog) prometendo função que o cargo logado não
  alcança:** fora do escopo desta rodada por tempo — são ~34 entradas com
  campo `roles` em `src/data/changelog.js`, cruzar cada uma contra
  `effectiveModules`/`allowedModules` por cargo é um levantamento à parte.
- **Textos de ajuda de campo (`HelpTooltip`, `title=` nativo) descrevendo
  comportamento diferente da tela:** não verificado — `title=` nativo
  aparece em ~90 lugares (`CLAUDE.md` §1) e não tem estrutura comum pra
  varrer automaticamente.
- **Estado vazio afirmando algo falso (filtro escondendo registro, "nenhum
  encontrado" no lugar de "nenhum com esse filtro"):** não verificado —
  precisaria semear dado com filtro ativo em cada tela, não só abrir vazio.
- **Papel `comex`:** não alcança nenhuma das 14 seções mapeadas (sempre
  redirecionado) — não investiguei se isso é intencional (Comex tem área
  própria fora deste mapa) ou lacuna.
- **Papel `portal`:** só entrou na análise estática (não tem nenhuma das
  14 seções mapeadas em `SECTION_SCREEN_TIP_KEYS`, então não haveria o que
  navegar).
- **Rolagem horizontal e erro de console fora do escopo da dica:** cobertos
  pelo `qa:smoke` padrão (seção 0), 0 achados nas 52 rotas × 2 viewports —
  não repeti essa checagem dentro do script próprio.

## 5. Arquivos desta varredura

Capturas em `docs/mockups/varredura-20260914/` (12 imagens, curadas das ~86
tiradas — uma por achado citado acima, não uma por combinação da matriz).
Script de varredura e o script de análise estática não foram commitados
(ferramenta de uma rodada só, fora de `scripts/qa/`).

## 6. Recomendações

Separado dos achados — nenhuma aqui foi implementada, todas precisam do
fluxo de 4 papéis do `CLAUDE.md` §3 (mockup pro que for visual) antes de
virar código.

- Trocar o critério de correspondência de conteúdo de "por texto
  (`description`)" pra "por id de rota (`route`)" — cada guia já carrega
  `route`; usar isso elimina a colisão por texto igual (achados de Classe
  A) e ao mesmo tempo impede um guia de OUTRA tela de satisfazer uma busca
  por coincidência de string.
- Separar a chave de "já visto" por seção, não por texto de `description`
  — mesmo que o conteúdo continue compartilhado entre 2 telas, o registro
  de "essa pessoa já viu isso" não deveria ser.
- Resolver conteúdo (`useScreenTips`, `TutoriaisView`) pelo mesmo padrão já
  usado pra permissão — `roles[]` com prioridade, não `role` escalar — ou,
  no mínimo, dar a `diretoria` sua própria entrada em `VIDEO_TUTORIALS`
  (mesmo que copiada de `gerente`) pra parar de cair no fallback de
  vendedor sem ninguém ter decidido isso.
- Dar um teto de altura com rolagem interna ao `AppToast` quando carrega
  `children` longos — a variante só com `title`/`description` já é sempre
  curta; o risco está isolado na variante com `<ol>`. Alternativa mais
  barata: truncar acima de um número de caracteres com "ver tutorial
  completo" linkando pra Ajuda.
- Escrever guias de Marketing/RH pro array de `gerente`/`admin` (ou herdar
  por departamento em vez de por cargo fixo) — hoje quem tem mais acesso
  de leitura é quem menos recebe dica.
- Corrigir as 3 chaves mortas (`crm`, `marketing-feiras`,
  `marketing-conteudo`) pro texto real dos guias correspondentes.
- Auditar os 4 `data-tour` do achado de Classe D — confirmar se o atributo
  ainda existe no componente atual ou se ficou órfão depois de um
  refactor; se ficou, decidir entre recolocar o atributo ou remover a
  entrada (regra 12 do `CLAUDE.md` já cobre a segunda opção).
