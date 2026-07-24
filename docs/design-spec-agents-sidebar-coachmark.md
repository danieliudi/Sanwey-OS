# Coachmark — item "Agentes" na sidebar (Agent Builder Fase 1, público gerente_rh)

Papel **Design** do processo da regra 3 do `CLAUDE.md`. Item de backlog:
gerente_rh acabou de ganhar o item "Agentes" na sidebar (`src/utils/module-access.js:134`,
`src/App.jsx:1223-1228`) — antes só gerente Comercial (`isManager`) via. Precisamos
de um spotlight/coachmark, mostrado uma única vez por usuário, apontando pro item
e incentivando o clique.

---

## Problema observado

`src/App.jsx:1223-1228` — desde o Agent Builder Fase 1, `gerente_rh` (e `admin`)
passam a ver o item "Agentes" (ícone `Bot`) dentro do grupo "Inteligência" da
sidebar, algo que nunca existiu pra esse papel antes. Não há nenhum sinal visual
alertando quem já usa a plataforma há tempos de que apareceu um item novo — a
pessoa só descobre por acaso rolando o menu, ou nunca descobre. `NavItem`
(`src/components/shell/Sidebar.jsx:414-511`) já resolve a técnica de ancorar
algo perto de um item de nav em modo trilho/expandido (tooltip fixed +
`getBoundingClientRect`), mas não tem `data-attribute` hoje pra um componente
externo localizar o elemento do item "agents" (confirmado: nenhum `id`/`data-*`
no `<button>` de `NavItem`, linha 423-457).

---

## Especificação visual

### Bolha (balão do coachmark)

Reaproveita a MESMA técnica de posicionamento do tooltip de `NavItem`
(`Sidebar.jsx:416-427`): `position: fixed` (escapa do `overflow: hidden`/
`overflowX: hidden` do `<nav>`, mesmo motivo do comentário de linha 416-420),
ancorado via `getCurrentTarget().getBoundingClientRect()` do elemento
`[data-nav-id="agents"]`, não do próprio componente do coachmark (que não tem
posição própria no layout — vive fora da `<Sidebar>`).

- **Ancoragem**: `x = rect.right + 12`, `y = rect.top + rect.height / 2`,
  `transform: translateY(-50%)` — mesma fórmula do tooltip existente
  (`Sidebar.jsx:427`), só +2px de respiro (12 em vez de 10) porque o
  coachmark é maior e tem seta, precisa de um pouco mais de ar entre o ícone
  e a ponta da seta.
- **Lado da seta**: sempre aponta pra **esquerda** (sidebar sempre fica à
  esquerda nesta plataforma — não existe variante RTL nem sidebar à direita
  hoje). Seta = triângulo CSS (`border` trick), 8px de base, cor idêntica ao
  fundo da bolha, centralizada verticalmente no balão, encostada na borda
  esquerda.
- **Cor de fundo / texto**: `background: var(--text)`, `color: var(--bg)`.
  **Não** usar `var(--surface)`/`var(--border)`/`var(--text)` (paleta neutra
  clara do `AppToast` default) — ver "Nota de decisão 1" abaixo, por quê.
- **Sombra**: `box-shadow: var(--shadow-pop)` — mesmo token do `AppToast`
  (`AppToast.jsx:47`) e do tooltip de `NavItem` (`Sidebar.jsx:502`), consistência
  de profundidade em toda a plataforma.
- **Raio**: `border-radius: var(--radius-lg)` (12px) — equivalente ao
  `rounded-xl` do `AppToast` (`AppToast.jsx:39`), mesma família de componente
  "balão flutuante".
- **Padding**: `14px 16px`.
- **Largura**:
  - Modo expandido (sidebar 288px, `rail=false`): `max-width: 260px`.
  - Modo trilho (sidebar 72px, `rail=true`): `max-width: 220px` — mais
    estreito porque o ícone-alvo é menor e mais perto da borda da tela; um
    balão de 260px em modo trilho fica com muito espaço vazio entre a seta
    (que já está a poucos px do ícone) e o conteúdo, parece flutuar solto.
    O texto (ver abaixo) já cabe em 2 linhas com essa largura.
- **z-index**: `65` — acima do tooltip de `NavItem` (`zIndex: 60`,
  `Sidebar.jsx:502`) e do `AppToast` (`z-50`, `AppToast.jsx:39`), abaixo de
  qualquer modal/drawer da plataforma (faixa 1100+, ex.
  `CampaignCalendar.jsx:92`, `RHBenefitsPicker.jsx:111`) — o coachmark não
  compete com modais, só com os outros elementos "passivos" do shell.
- **Conteúdo interno**:
  - Ícone `Bot` (mesmo ícone do item de nav, `lucide-react`, já importado em
    `App.jsx:5`), 16px, `color: var(--bg)` (mesma cor do texto — bolha é
    monocromática), `opacity: 0.9`.
  - Título, 13px, `font-weight: 600`, `color: var(--bg)`.
  - Corpo, 12px, `font-weight: 400`, `color: var(--bg)`, `opacity: 0.85`
    (leve contraste hierárquico entre título e corpo, mesmo espírito do
    `AppToast` que usa `var(--text-dim)` pro corpo vs `var(--text)` pro
    título — aqui não dá pra trocar de token porque a bolha é monocromática
    sobre fundo escuro, então o contraste vem de opacity, não de token).
  - Botão "Entendi", canto inferior direito do balão, alinhado à direita:
    `background: transparent`, `border: 1px solid color-mix(in srgb, var(--bg) 35%, transparent)`,
    `color: var(--bg)`, `border-radius: var(--radius-sm)` (6px),
    `padding: 5px 12px`, `font-size: 12px`, `font-weight: 600`.
    - Hover: `background: color-mix(in srgb, var(--bg) 15%, transparent)`.
    - Sem estado de erro/disabled (botão único, sempre clicável).

### Estados

| Estado | Quando aparece |
|---|---|
| Visível | `isRHManager` (independente de também ser `isManager`), ainda não visto (ver hook), item "agents" presente no DOM (`document.querySelector('[data-nav-id="agents"]')` resolve), nenhum overlay de prioridade maior ativo (ver seção "Onde entra na cadeia") |
| Oculto (dismissed) | Clique em "Entendi", OU clique no próprio item "Agentes" da sidebar (navegar até lá já é reconhecimento implícito de que a pessoa viu — ver comportamento abaixo) |
| Nunca renderiza / não pisca | `isRHManager` falso, já visto antes, `[data-nav-id="agents"]` não encontrado no DOM (módulo bloqueado por override de "Acesso por módulo", ou ainda carregando `currentUser`/`allowedModules`) |

Não há estado de erro/disabled/foco de formulário — o coachmark não é input,
é só uma leitura + um botão de confirmação.

---

## Comportamento

### Gatilho: no load, não em troca de seção

**Decisão**: o coachmark aparece assim que a sidebar montar com o item
"agents" presente no DOM — não espera o usuário navegar pra nenhuma seção
específica. Justificativa: o item "Agentes" já fica visível no menu o tempo
todo (grupo "Inteligência" não é fechado por padrão — `loadCollapsed()` em
`Sidebar.jsx:17-20` retorna `{}` quando não há preferência salva, e
`!!collapsed[group.label]` é `false` por padrão, então o grupo nasce
expandido pra todo usuário novo desse recurso), então não existe uma "tela
onde isso faz mais sentido aparecer" — é puramente sobre o menu, deve
aparecer o quanto antes na sessão.

### Robustez de ancoragem (nav tem scroll interno e 2 larguras)

- Ao montar, se o elemento existir mas estiver fora da área visível do
  `<nav>` (scroll interno, `overflowY: auto`, `Sidebar.jsx:250`), chamar
  `element.scrollIntoView({ block: "center", behavior: "instant" })` antes de
  capturar o `getBoundingClientRect()` — evita calcular uma posição fora da
  tela.
- Recalcular a âncora (novo `getBoundingClientRect()`) em três gatilhos, pra
  não descolar do ícone:
  1. `ResizeObserver` no próprio elemento `[data-nav-id="agents"]` (dispara
     quando o botão muda de tamanho — cobre o toggle rail/expandido, que
     muda o padding/dimensão do botão, `Sidebar.jsx:100-106`).
  2. `resize` da `window` (breakpoint mobile/desktop, `useIsMobile`,
     `Sidebar.jsx:44-52`).
  3. `scroll` do ancestral `<nav>` (`element.closest("nav")`), caso o menu
     tenha mais itens que a altura da tela em alguma resolução.
- Se em qualquer recálculo o `querySelector` deixar de encontrar o elemento
  (ex.: override de "Acesso por módulo" removeu o acesso a "agents" no meio
  da sessão), o coachmark some imediatamente e **não marca como visto** —
  a pessoa não chegou a ver de fato.

### Nunca aparece durante drag de reordenação da sidebar

`NavItem` tem um mecanismo de segurar-e-arrastar o ícone pra reordenar
(`Sidebar.jsx:410-413`, `onIconDragStart`/`onIconDragEnd`). Não é uma
interação que colide fisicamente com o coachmark (o coachmark não bloqueia
cliques nos outros itens — sem overlay/scrim atrás dele, ver próximo ponto),
mas por clareza: o coachmark não observa nem reage a esse estado de drag,
só ao `[data-nav-id="agents"]` em si.

### Sem scrim/backdrop

Diferente de um modal, o coachmark **não** tem overlay escurecendo o resto da
tela — é só o balão + seta, `pointerEvents` do balão ativo (pro botão
"Entendi" ser clicável), mas o resto da interface continua 100% usável
(clicar em outro item de nav, redimensionar, etc.). Isso é coerente com o
`AppToast` (que também não tem scrim) e com o tooltip de `NavItem`.

### Onde/quando aparece — prioridade na cadeia de overlays do `App.jsx`

Cadeia hoje (`App.jsx:162-166`, `789-797`, `1885-1912`), 4 degraus mutuamente
exclusivos por prioridade:

```
OnboardingModal (showOnboarding)
  > needRefresh (toast "nova versão disponível")
    > changelogItems.length > 0 (toast "novidades")
      > screenTip (toast de dica de tela)
```

**Decisão**: o coachmark novo entra como um **5º degrau**, logo depois de
`needRefresh` e antes de `changelogItems`/`screenTip`:

```
OnboardingModal (showOnboarding)
  > needRefresh
    > agentsCoachmark (NOVO)
      > changelogItems
        > screenTip
```

Isso significa:
- `useAgentsCoachmark(...)` recebe `skip: showOnboarding || needRefresh`.
- `useChangelogNotice(...)` passa a receber
  `skip: showOnboarding || agentsCoachmarkVisible` (em vez de só
  `showOnboarding`).
- `useScreenTips(...)` passa a receber
  `skip: showOnboarding || needRefresh || agentsCoachmarkVisible || changelogItems.length > 0`
  (adiciona `agentsCoachmarkVisible` ao `skip` já existente em
  `App.jsx:796`).

Justificativa (registrada como decisão, não fato — é uma escolha de produto/UX,
não a única ordem válida):
- `OnboardingModal` continua primeiro: quem está no tour de boas-vindas ainda
  não tem contexto nenhum de sidebar pra um coachmark fazer sentido.
- `needRefresh` continua acima: é sobre a aplicação estar desatualizada, o
  que pode afetar até a própria feature nova funcionar corretamente — mais
  urgente que qualquer conteúdo.
- O coachmark fica **acima** de `changelogItems`/`screenTip` porque é o mais
  específico e acionável dos três conteúdos informativos: é role-gated
  (só quem realmente ganhou a feature vê), aponta pro exato lugar da tela, e
  perde relevância se ficar enfileirado atrás de um changelog genérico que
  pode conter várias versões acumuladas. `screenTip` já é o de menor
  prioridade hoje (`App.jsx:796`, `skip` inclui os outros dois) — manter essa
  posição relativa.
- Alternativa descartada: colocar o coachmark **abaixo** de `changelogItems`
  (não acima) — se o changelog já menciona a chegada do Agent Builder pro RH,
  poderia parecer redundante mostrar os dois. Não escolhi essa ordem porque
  o changelog é passivo (lista de texto) e o coachmark é a única peça que
  aponta fisicamente pro item na sidebar — a pessoa pode ler o changelog e
  ainda assim não achar o item no menu depois.

---

## Texto do coachmark (pt-BR)

```
[ícone Bot]  Novo: Agentes de IA
Configure e acompanhe agentes de IA que ajudam sua equipe de RH — comece por aqui.

                                            [Entendi]
```

- Título: **"Novo: Agentes de IA"** (13px, 600) — usa "Novo:" como prefixo
  igual ao vocabulário já usado em changelog/novidades da plataforma, não
  inventa um rótulo diferente tipo "Dica" ou "Aviso".
- Corpo: **"Configure e acompanhe agentes de IA que ajudam sua equipe de RH — comece por aqui."**
  (12px, 1 frase, sem jargão técnico de "prompt"/"LLM" — o mesmo tom usado em
  `VIDEO_TUTORIALS` quickStart, ver `use-screen-tips.js:6-11`).
- Botão: **"Entendi"** (não "Done ✓" — plataforma é pt-BR; sem emoji, ver
  convenção do resto da spec/código).

---

## Hook novo

`src/hooks/use-agents-coachmark.js`

```js
export function useAgentsCoachmark(currentUser, { isRHManager, skip = false } = {}) {
  // retorna { visible, dismiss }
}
```

- Segue exatamente o modelo de `useScreenTips`/`useChangelogNotice`: sem
  coluna no banco, `usePersistentState(STORAGE_KEYS.agentsCoachmarkSeen, {})`,
  mapa `{ [userId]: true }` (não precisa de versão — é um evento único, não
  uma sequência de conteúdo como o changelog).
- Nova chave em `src/constants/storage-keys.js`:
  `agentsCoachmarkSeen: \`gs_${V}_agents_coachmark_seen\`` (mesmo padrão de
  nomenclatura das outras 2 chaves de "visto uma vez", linhas 18-19 do
  arquivo).
- `visible` é `true` somente quando: `!skip && isRHManager && userId &&
  !seenForUser[userId]` — a checagem de "o elemento existe no DOM" **não**
  entra no hook (hook não deve tocar DOM), fica por conta do componente
  (que só renderiza o balão se o `querySelector` resolver, e trata a ausência
  como "ainda não pronto", sem marcar como visto).
- `dismiss()` grava `{ [userId]: true }` — chamado tanto pelo clique em
  "Entendi" quanto pelo clique no próprio item "Agentes" da sidebar (ver
  comportamento abaixo).
- Este hook **não** decide `isRHManager` sozinho — recebe como parâmetro
  (calculado a partir de `computeRoleFlags`/`currentUserRoles`, já existente
  em `App.jsx:175-176`, ver `module-access.js:80`), pro hook não duplicar a
  lógica de multi-cargo que já existe centralizada.

## Componente novo

`src/components/shell/AgentsSidebarCoachmark.jsx` (pasta `shell/`, não
`shared/`, porque é acoplado 1:1 à `Sidebar` — não é um padrão genérico
reutilizável em outro contexto ainda; se um dia outro coachmark ancorado a
item de nav for necessário, aí sim vira candidato a generalizar pra
`shared/` seguindo a regra de "3ª ocorrência" do `CLAUDE.md` seção 4, não
antes).

```jsx
<AgentsSidebarCoachmark
  visible={agentsCoachmarkVisible}   // do hook
  onDismiss={dismissAgentsCoachmark} // do hook
  rail={/* precisa saber se a sidebar está em modo trilho, pra largura do balão */}
/>
```

- Monta fora de `<Sidebar>`, ao lado dos outros overlays em `App.jsx`
  (mesmo bloco de `1885-1912`), não dentro do componente `Sidebar.jsx` —
  mantém `Sidebar.jsx` sem conhecer a lógica de "primeira vez"/role, só
  expõe o `data-nav-id`.
- Precisa saber se a sidebar está em `rail` (modo trilho) pra ajustar a
  largura do balão (ver "Especificação visual" acima). Hoje `railCollapsed`
  é estado interno de `Sidebar.jsx:87` (não sobe pro `App.jsx`). Duas opções,
  registradas como decisão subjetiva:
  - **(A)** Ler `document.documentElement.style.getPropertyValue("--sidebar-width")`
    (já setada por `Sidebar.jsx:96-98` toda vez que o rail muda) e inferir
    `rail = width === "72px"` — não exige subir estado nem prop drilling.
  - **(B)** Subir `railCollapsed` de `Sidebar` pro `App.jsx` via prop
    controlada, e passar pro coachmark.
  - **Escolhida: (A)**. Motivo: `--sidebar-width` já existe exatamente pra
    isso (comentário em `Sidebar.jsx:93-95`: "Outros componentes... leem a
    largura real da sidebar via essa custom property em vez de assumir
    288px fixo"), então ler o valor já resolvido é mais consistente com o
    padrão existente do que promover mais um pedaço de estado de UI pro
    componente pai só pra esse uso pontual.

## Mudança mínima em `Sidebar.jsx`

`NavItem` (linha 423, `<button onClick={onClick} ...>`) ganha
`data-nav-id={item.id}` — precisa ser passado como prop nova de `NavItem`
(hoje não recebe `id`, só `icon`/`label`/`badge`/`active`/etc., linha 414) e
repassado na chamada em `Sidebar.jsx:298-311` (`<NavItem key={item.id} ...
id={item.id} />`, renderizado como `data-nav-id` no elemento). Essa é a única
mudança pedida no `Sidebar.jsx` — o resto do coachmark vive fora dele.

## Reconhecimento implícito ao clicar no próprio item

Além do botão "Entendi", clicar no item "Agentes" da sidebar (que já dispara
`handleNavClick("agents")` → navega pra seção) também deve chamar
`dismiss()` do coachmark — a pessoa foi conferir a feature, o objetivo foi
cumprido, não faz sentido o balão reaparecer ou continuar por cima da tela
depois da navegação. Isso é adicionado no `onClick` do próprio
`AgentsSidebarCoachmark` (listener de clique delegado no
`document`/elemento alvo) ou, mais simples, o componente escuta um clique no
elemento `[data-nav-id="agents"]` capturado e chama `onDismiss` antes de
deixar o evento seguir — não precisa mexer no `onClick` de `NavItem`.

---

## Notas de decisão subjetiva

1. **Paleta da bolha: dark solid (`var(--text)`/`var(--bg)`) em vez da
   paleta neutra clara do `AppToast` (`var(--surface)`/`var(--border)`/
   `var(--text)`)**. Havia duas opções válidas:
   - **(A) Reusar a paleta neutra clara do `AppToast` variant="default"**
     (fundo `var(--surface)`, borda `var(--border)`, texto `var(--text)`) —
     mais "seguro" por já ser literalmente os tokens do componente citado
     como referência de consistência.
   - **(B) Reusar a paleta dark solid que já existe no próprio `NavItem`**
     pro tooltip de modo trilho (`background: var(--text)`, `color:
     var(--bg)`, `Sidebar.jsx:501`).
   - **Escolhida: (B)**. Motivo: a referência visual do Daniel é
     explicitamente uma "bolha escura" com seta (padrão Pipefy de coachmark),
     não um card claro tipo toast — usar a paleta clara do `AppToast`
     produziria um resultado visualmente mais próximo de "mais um toast"
     do que de "spotlight apontando pro ícone". A paleta dark solid
     (B) já é usada hoje na mesma tela, no mesmo componente-pai
     (`NavItem`), pro mesmo tipo de elemento (balão ancorado a item de nav)
     — reaproveita vocabulário existente e ainda cobre dark mode
     automaticamente (os tokens invertem sozinhos, sem novo hex). Onde a
     tarefa pede pra reusar tokens do `AppToast`, a leitura que fiz foi
     "reuse o *vocabulário* de tokens de tema da plataforma (nunca hex
     literal novo)", não necessariamente a combinação exata de
     `--surface`/`--border` — e a sombra (`--shadow-pop`) e o raio
     (`--radius-lg`) ESSES sim vieram direto do `AppToast`, ficando
     consistentes nesse ponto.

2. **Gatilho no load vs. esperar 1ª troca de seção**: ver seção
   "Comportamento" acima — escolhido "no load" porque o alvo (item de menu)
   não pertence a nenhuma seção específica, ao contrário do `useScreenTips`
   (que é por tela). Alternativa descartada: esperar a pessoa navegar pra
   "rh-overview" ou primeira tela pós-login, o que atrasaria a descoberta
   sem ganho — o coachmark não compete visualmente com conteúdo de tela
   nenhuma.

3. **Local do novo componente (`shell/` vs. `shared/`)**: ver seção
   "Componente novo" acima — escolhido `shell/` por ser específico da
   `Sidebar` hoje; extrair pra `shared/` fica pra quando (e se) surgir um 2º
   coachmark ancorado a item de nav, seguindo a regra de 3ª ocorrência do
   `CLAUDE.md`.

4. **Como o componente descobre `rail`**: ver seção "Componente novo" acima
   — escolhida a leitura de `--sidebar-width` (opção A) em vez de subir
   estado (opção B).
