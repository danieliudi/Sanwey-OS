# Auditoria: toast "Novidades" × alcance real por cargo

Item declarado não-verificado na varredura visual de 14/09/2026
(`docs/varredura-visual-dicas-de-tela.md`). Classe de defeito: **texto que
promete à pessoa algo que a tela dela não tem.**

Escopo: `src/data/changelog.js` inteiro — **197 versões, 445 itens**, dos quais
**177 interrompem via toast** (166 `kind: "novo"` + 11 com `toast: true`
explícito; nenhum item usa `toast: false`). Auditoria contra o código de
14/09/2026. Zero edição.

---

## 0. Como o mecanismo decide quem recebe

- `src/hooks/use-changelog-notice.js:27-31` — `shouldShowInToast`: só
  `kind: "novo"` toasta por default; `correcao`/`ajuste` ficam na aba
  Novidades. Override por item (`toast: true|false`).
- `src/hooks/use-changelog-notice.js:37-38` — `sees(roles)`: **admin e
  diretoria passam sempre**; item sem `roles` é global (todo mundo);
  item com `roles` só para quem tem pelo menos um deles.
- `src/App.jsx:198` e `src/App.jsx:3020-3026` — o toast é renderizado na raiz
  do App, **fora das `Routes`**. Não há `skip` para agência nem para portal:
  os dois shells reduzidos recebem o toast como qualquer outro usuário.
- `onViewAll` (`src/App.jsx:3024`) leva para `section = "tutorials"`.

Alcance por cargo vem de `src/utils/module-access.js:133-219`
(`defaultModulesForRoles`), filtrado por `gateByModuleStates`
(`module-access.js:233-245`) e reforçado pelos gates de rota em
`src/App.jsx:2104-2187`. Os dois shells fixos: agência
(`src/App.jsx:1808-1817`, só Campanhas + Entregas) e portal
(`src/App.jsx:1795-1806`, só Meu RH).

Vocabulário de cargo vigente (CHECK em
`supabase/migrations/20260911100000_papel_dp.sql:34-35`): `admin`, `gerente`,
`vendedor`, `suporte`, `marketing`, `gerente_marketing`, `agencia`, `rh`,
`gerente_rh`, `dp`, `portal`, `diretoria`, `comex`, `cliente`.

---

## (a) Cargo × quantos itens de novidade recebe

| Cargo | Recebe (toasts) | Citado em `roles` | Chega só como global | Módulos que alcança |
|---|---:|---:|---:|---:|
| admin | 177 | 91 | 86 (bypass) | 43 de 43 |
| diretoria | 177 | 16 | 161 (bypass) | 43 de 43 |
| gerente | 134 | 68 | 66 | 23 |
| vendedor | 112 | 46 | 66 | 18 |
| gerente_rh | 100 | 34 | 66 | 20 |
| rh | 91 | 25 | 66 | 17 |
| gerente_marketing | 88 | 22 | 66 | 20 |
| marketing | 84 | 18 | 66 | 19 |
| suporte | 72 | 6 | 66 | 10 |
| **agencia** | **68** | **2** | 66 | **0** (shell fixo: 2 telas) |
| **dp** | **67** | **1** | 66 | 10 |
| **comex** | **67** | **1** | 66 | 8 |
| **portal** | **66** | **0** | 66 | **0** (shell fixo: 1 tela) |
| **cliente** | **66** | **0** | 66 | 17 — ver F-19 |

66 dos 177 itens que toastam são globais (sem `roles`). São eles que produzem
a maior parte dos achados abaixo: um item global chega a quem tem 1 tela do
mesmo jeito que chega a quem tem 43.

---

## (b) Achados

### B.1 — Promete a um cargo listado em `roles` uma tela que o gate expulsa

**F-01 · [4.15.0] `changelog.js:2137` — agência, 100% inalcançável**
Promete: "Despesas agora também pode se vincular a várias Entregas e várias
Tarefas de Marketing, além da Campanha."
Recebe: `["marketing", "gerente_marketing", "agencia"]`.
Não alcança: `agenciaBlocked` (`src/App.jsx:2165`) contém
`marketing-despesas` **e** `marketing-tarefas`. As duas telas do item são
bloqueadas para a agência; ela é redirecionada para `marketing`
(`src/App.jsx:2166-2168`). Nada nesse item existe para quem recebe.

**F-02 · [4.86.0] `changelog.js:919` (roles em `:920`) — agência, metade inalcançável**
Promete: "Busca de card em Entregas **e Tarefas de Marketing**."
Recebe: `["marketing", "gerente_marketing", "agencia"]`.
Não alcança: `marketing-tarefas` está em `agenciaBlocked`
(`src/App.jsx:2165`). A agência alcança Entregas e nunca vai ver a metade
"Tarefas".

> F-01 e F-02 são os **dois únicos** itens que toastam citando `agencia`.
> Os dois estão errados. Na prática a agência nunca recebeu uma novidade
> dirigida e correta em 197 versões.

**F-03 · [4.1.0] `changelog.js:2365` — `gerente` (Comercial)**
Promete: "Aba \"Agentes de IA\" (RH → Fornecedores)".
Recebe: `["gerente_rh", "rh", "gerente"]`.
Não alcança: `rh-fornecedores` está em `rhSections` (`src/App.jsx:2141`) e o
gate `!isRHUser && !isDiretoria` (`src/App.jsx:2142-2144`) manda para
`dashboard`. `isRHUser = rh|gerente_rh|admin` (`src/App.jsx:244`) — `gerente`
Comercial não está lá, e `defaultModulesForRoles(["gerente"])` não concede
`rh-fornecedores` (`module-access.js:180-188`).

**F-04 · [4.60.1] `changelog.js:1362` (roles em `:1363`) — `gerente` (Comercial)**
Promete: "Título de Vaga e de Candidato agora é editável direto no card".
Recebe: `["admin", "gerente", "gerente_rh"]`.
Não alcança: Vaga/Candidato são `rh-recrutamento`, também em `rhSections`
(`src/App.jsx:2141`). Mesmo redirecionamento de F-03.

**F-05 · [4.95.0] `changelog.js:618` (roles em `:619`) — `gerente` (Comercial)**
Promete: "Relatório de Conteúdo em Marketing".
Recebe: `["admin", "gerente", "marketing", "gerente_marketing", "diretoria"]`.
Não alcança: `marketing-conteudo` está em `marketingOnly`
(`src/App.jsx:2125`) e o gate `!isMarketingUser && !isAgencia && !isDiretoria`
(`src/App.jsx:2126-2128`) manda para `dashboard`. `isMarketingUser =
marketing|gerente_marketing|admin` (`src/App.jsx:233`).

**F-06 · [4.94.0] `changelog.js:633` (roles em `:634`) — `marketing` / `gerente_marketing`**
Promete: "Ao criar um negócio, dá pra marcar a campanha de origem (…) No
drawer, o seletor de origem agora inclui campanhas de Conteúdo e Digital".
Recebe: `["admin", "gerente", "vendedor", "marketing", "gerente_marketing"]`.
Não alcança: criar negócio é o Funil de Vendas (`crm`). `isPureMarketing`
(marketing e/ou gerente_marketing sem outro cargo) é redirecionado de
`crmSections` — que inclui `crm` — para `dashboard`
(`src/App.jsx:2131-2134`); `defaultModulesForRoles` também não concede `crm`
ao ramo de marketing (`module-access.js:166-178`).

**F-07 · [5.2.0] `changelog.js:364` (roles em `:365`) — `rh` / `gerente_rh`**
Promete: "Novo cargo Departamento Pessoal (…) **Atribuível em Configurações ›
Usuários**."
Recebe: `["rh", "gerente_rh", "admin"]`.
Não alcança: a aba Usuários só é montada quando `usersPanel` é passado, e ele
é `isManager ? <UserManagementView…> : …` (`src/App.jsx:2721`), com
`isManager = isManagerRole = gerente|admin` (`src/App.jsx:1764` → `:231`); a aba só entra em
`buildTabGroups` se `hasUsersPanel` (`SettingsView.jsx:551`), e a rota
`/usuarios` redireciona não-manager para dashboard (`src/App.jsx:2694-2696`).
`rh` e `gerente_rh` recebem uma instrução de ir a uma tela que não existe
para eles. Admin, que a tem, passaria pelo filtro de qualquer jeito
(bypass em `use-changelog-notice.js:37`).

**F-08 · [4.97.12] `changelog.js:471` (roles em `:472`) — promessa pela metade dos dois lados**
Promete: "Em Viagens **e** em Marketing → Despesas, o lançamento pede centro
de custo (…)".
Recebe: `["vendedor", "gerente", "marketing", "gerente_marketing", "admin"]`.
`vendedor` não alcança `marketing-despesas` (`marketingOnly`,
`src/App.jsx:2125`); `marketing`/`gerente_marketing` não alcançam
`crm-viagens` (`crmSections`, `src/App.jsx:2131`). Cada cargo listado só
alcança metade do que a frase promete.

**F-09 · [4.73.0] `changelog.js:1104` (roles em `:1105`) — promessa pela metade**
Promete: quatro resoluções na fila de Pendências, entre elas "recusar uma
solicitação de marketing ou uma compra".
Recebe: `["admin", "gerente_rh", "marketing", "gerente_marketing"]`.
`gerente_rh` não alcança `marketing-solicitacoes` nem `marketing-compras`
(`marketingOnly`, `src/App.jsx:2125`); os dois de marketing não têm o lado de
RH da lista como gestão. Só admin recebe a frase inteira.

### B.2 — Item global cujo conteúdo é de um departamento só

Todos abaixo chegam aos **14 cargos**, inclusive agência e portal.

**F-10 · [4.56.0] `changelog.js:1494` — "qualquer pessoa pode" é falso**
Texto: "Chegou a Central de Bugs (…) Reporte pelo item \"Central de Bugs\" no
menu — **qualquer pessoa pode**."
`central-bugs` foi acrescentado a `agenciaBlocked` em 02/09/2026
(`src/App.jsx:2165`, com o comentário do achado de segurança em
`src/App.jsx:2160-2164`). A agência recebe o toast que afirma, com todas as
letras, que ela pode — e é redirecionada para `marketing` ao tentar.
Companheiro: **[4.92.0] `changelog.js:653`**, "existe um ícone fixo de inseto
na barra do topo", mesma tela, mesmo bloqueio.

**F-11 · [4.20.0] `changelog.js:2087` e `:2088` — ninguém do Marketing abre Automações**
Texto: "Automações agora funcionam em Entregas, não só em Campanhas" e "Nova
ação de automação \"Atribuir responsável\"". Conteúdo puramente de Marketing,
sem `roles`.
`automations` é concedido só a `isManager || isRHManager`
(`module-access.js:211`), e o gate `managerOrRHManagerOnly`
(`src/App.jsx:2105, 2110-2112`) redireciona todo o resto. Ou seja:
`marketing` e `gerente_marketing` — os cargos que operam Campanhas e Entregas
— **não alcançam a tela de Automações**, e recebem os dois toasts. Quem
alcança (`gerente` Comercial, `gerente_rh`) não tem os quadros de que o texto
fala.

**F-12 · Viagens & Despesas — 6 itens globais para uma tela do Comercial**
`changelog.js:2058`, `:2059`, `:1915`, `:1909`, `:1907`, e a menção em `:85`.
`crm-viagens` só é concedido no ramo comercial (`module-access.js:167`) —
fora dele, `marketing` puro, `rh`, `gerente_rh`, `dp`, `comex`, `suporte`,
`agencia` e `portal` não têm a tela, e `crmSections` (`src/App.jsx:2131`) a
bloqueia por URL. Pior caso: **`changelog.js:2059`** ("Aba Gestão de Viagens &
Reembolsos ganhou uma seção \"Divergências\"") é conteúdo de gestor — a mesma
aba que os itens `changelog.js:117` e `:122` corretamente marcam como
`["gerente","admin"]`. O item global promete a todos o que os itens
posteriores restringem a dois cargos.

**F-13 · Comercial — 5 itens globais sobre Funil/Clientes**
`changelog.js:2234` (Funil de Vendas offline), `:1948` (Selo ESG na proposta
do Funil), `:1143` (Cadastro de cliente / busca por CNPJ), `:1095`
(Pendências: "leads sob sua responsabilidade (…) botão de IA"), `:837`
(Ctrl+K encontra CLIENTES). `crm`/`clients` seguem o mesmo ramo comercial de
F-12. Para RH puro, Marketing puro, dp, comex, agência e portal os cinco são
inertes.

**F-14 · Meu To-do / Lista Pessoal — 18 itens globais**
`changelog.js:222, 1086, 1184, 1224, 1233, 1736, 1740, 1971, 2037, 2038,
2039, 2040, 2041, 2047, 2048, 2049, 2050, 2094`.
`personal-tasks` não existe para agência nem para portal: nenhum dos dois
shells monta o item (`src/App.jsx:1795-1817`) e o guard de rota devolve os
dois (`src/App.jsx:2165-2173`). 18 novidades sobre uma tela que esses dois
cargos nunca abriram. (Também chegam a quem desligou a Lista Pessoal em
Preferências — `settings.personalTasksEnabled`, `src/App.jsx:370` e `:1842`.)

**F-15 · Chat — 5 itens globais, e o portal tem o item de menu morto**
`changelog.js:1698, 2220, 2221, 2240, 2248`.
O shell do portal monta "Chat" no menu (`src/App.jsx:1801`), mas o guard
`if (isPortalOnly && section !== "meu-rh") setSection("meu-rh")`
(`src/App.jsx:2171-2173`) devolve o usuário assim que a rota muda — e
`section` vem da URL (`src/App.jsx:1220`), então o clique no próprio item de
menu é desfeito. O portal recebe 5 toasts sobre Chat, tem o Chat no menu, e
não consegue abri-lo. Achado de App, não de changelog, mas é o que transforma
esses 5 itens em promessa vazia.

**F-16 · Ajuda & Tutoriais — a agência não alcança o destino do próprio toast**
`tutorials` está em `agenciaBlocked` (`src/App.jsx:2165`). Isso afeta:
(i) o botão "Ver todas" do próprio toast, que faz
`setSection("tutorials")` (`src/App.jsx:3024`) — para a agência ele devolve
para `marketing`; (ii) os itens globais que mandam o leitor para lá —
`changelog.js:73` ("um link para o guia completo em Ajuda & Tutoriais"),
`:1897`, `:1907`.

**F-17 · [4.99.3] `changelog.js:404` e [4.99.2] `:414` — itens sobre a agência, mandados a todos**
"Entregas: a agência voltou a ver e a subir anexo" / "…voltou a poder
encaminhar um card para Revisão". Os dois são `correcao` com `toast: true`
explícito e **sem `roles`**: os 14 cargos são interrompidos por uma correção
que só interessa a um cargo externo — que, esse sim, alcança Entregas.

### B.3 — Silêncio: cargo que nunca recebe novidade dirigida

**F-18 · `portal` — 0 itens dirigidos em 197 versões**
Nenhum item do arquivo inteiro cita `portal` em `roles` (grep em
`changelog.js`; contagem por cargo na tabela (a)). O portal recebe os 66
itens globais e alcança **uma** tela, Meu RH (`src/App.jsx:1795-1806`). Dos
66, o único que descreve algo que ele pode abrir é `changelog.js:240`
("Baixar o próprio holerite, cartão de ponto ou anexo de onboarding voltou a
funcionar"). Os outros 65 descrevem telas que ele não tem — 18 de Meu To-do
(F-14), 5 de Chat (F-15, que nem abrem), 6 de Viagens (F-12), 5 do Comercial
(F-13), e por aí.

**F-19 · `cliente` — 0 itens dirigidos, e sem tratamento no frontend**
`cliente` é cargo válido no banco
(`supabase/migrations/20260911100000_papel_dp.sql:34-35`), tratado como
externo junto com `agencia` nas policies de chat
(`supabase/migrations/00000000000000_baseline.sql:2475, 2497, 2873`). No
frontend não existe: `computeRoleFlags` não tem flag para ele
(`module-access.js:96-127`), não há shell reduzido, e
`defaultModulesForRoles(["cliente"])` cai no **ramo genérico**
(`module-access.js:166-169`) devolvendo 17 módulos — o menu Comercial
inteiro. Recebe os 66 globais e nenhum dirigido. (O alcance excessivo é
achado de acesso, não de changelog — registrado aqui porque muda a resposta
de "quem recebe".)

**F-20 · `comex` — 1 item dirigido em 197 versões**
Único: `changelog.js:2340` ([4.2.2] "Comex: Iene (JPY) agora é uma opção de
moeda"). Alcançável (`module-access.js:198`). O cargo tem 8 módulos e recebe
67 toasts; 66 são globais e quase todos de telas que ele não tem
(`isPureComex` é redirecionado de todo `crmSections`,
`src/App.jsx:2152-2154`).

**F-21 · `dp` — 1 item dirigido, desde 11/09/2026**
Único: `changelog.js:310` ([5.5.0] "Onboarding ganhou a relação de documentos
de admissão", `roles` inclui `"dp"`). Alcançável — `rh-onboarding` entra pelo
ramo de todo colaborador (`module-access.js:184-188`). Cargo novo; o silêncio
ainda é jovem, mas já vale registrar que as três telas dele
(`rh-funcionarios`, `rh-cargos`, `rh-ferias`, `module-access.js:194-196`)
nunca tiveram uma novidade dirigida.

**F-22 · `agencia` — 2 dirigidos, os dois quebrados** → ver F-01 e F-02.

**F-23 · `consultor` é etiqueta inerte**
`changelog.js:1120` (item de `:1119`, [4.72.0]) usa
`roles: ["admin","gerente","vendedor","consultor"]`. `consultor` **não está**
no CHECK de `profiles.roles` vigente
(`supabase/migrations/20260911100000_papel_dp.sql:34-35`; ele existia até
`_historico/20260784_comex_module.sql:14` e sumiu no baseline
`00000000000000_baseline.sql:6564`, substituído por `suporte`). Nenhum
usuário pode ter esse cargo, então a etiqueta não muda o alcance do item —
os outros três cobrem. Hygiene, não dano. Fora do toast, aparece em mais 7
itens (`changelog.js:854, 864, 869, 874` e vizinhos), todos `correcao`/
`ajuste` que não toastam.

**Contraste (não é achado): `suporte`** — 6 itens dirigidos
(`changelog.js:1567, 1572, 1619, 1634, 1639, 1649`), todos alcançáveis:
`pedidos`, `clients` e `catalogo` são exatamente os 3 módulos do ramo
`isPureSuporte` (`module-access.js:164-165`). É o único cargo estreito com
cobertura correta.

---

## (c) Não consegui verificar

1. **Efeito de `module_states` e de overrides por usuário.** Toda a auditoria
   usa o **padrão de cargo** (`defaultModulesForRoles`). O alcance real é
   `gateByModuleStates(effectiveModules(roles, overrides), states, …)`
   (`src/App.jsx:222-229`), e tanto `profile_module_overrides` quanto
   `module_states` vivem no banco. Um override pode conceder uma tela a quem
   o cargo nega (desfazendo alguns achados de B.1) ou revogar uma tela de
   quem o cargo concede (criando achados novos). Não consultei o banco,
   conforme instrução.
2. **Quem de fato tem cada cargo.** Não sei se existe usuário `portal`,
   `cliente`, `comex`, `dp` ou `agencia` em produção. Os achados de silêncio
   (F-18 a F-22) são sobre o conteúdo do arquivo, não sobre pessoas afetadas.
   `cliente` e `suporte`, aliás, nem aparecem em `ROLE_OPTIONS_BASE`/
   `ROLE_OPTIONS_ADMIN` (`UserManagementView.jsx:35-59`) — só são atribuíveis
   por SQL.
3. **Multi-cargo.** `sees()` usa `some` (`use-changelog-notice.js:38`) e
   `defaultModulesForRoles` soma os ramos, então quem acumula cargos alcança
   mais. Os achados de B.1 valem para o cargo **puro** listado; um
   `gerente`+`gerente_rh`, por exemplo, não sofre F-03/F-04. Não há como
   saber a distribuição real de combinações sem o banco.
4. **`changelog.js:364` afirma que o DP não tem "Avaliação de Desempenho"** —
   e `defaultModulesForRoles(["dp"])` concede `rh-feedback`
   (`module-access.js:184-188`), cujo rótulo é literalmente "Avaliação de
   Desempenho" (`module-access.js:50`). O comentário em
   `module-access.js:109-111` diz que essa é justamente uma das três telas
   que o escopo aprovado exclui. Pode ser que `rh-feedback` seja a avaliação
   *do próprio colaborador* (é o que o comentário de `:185-187` sugere) e a
   frase do changelog fale da tela de gestão — não consegui separar as duas
   sem abrir `RHFeedbackView` e conferir o gate interno, o que sai do escopo
   desta auditoria. Registrado como suspeita, não como achado.
5. **Itens que descrevem coisa que não é tela** (notificação, e-mail
   automático, cálculo, tour) foram avaliados pelo lugar onde a pessoa
   *veria* o efeito. Onde esse lugar é ambíguo (ex.: `changelog.js:603`,
   link de captura pública com UTM), não classifiquei.
6. **Não rodei build nem varredura em navegador**, conforme instrução. Nada
   aqui foi confirmado em tela renderizada — é leitura de código.

---

## Nota de processo

Não é achado, e a instrução pedia explicitamente para não contar como tal:
**268 itens não toastam** (184 `correcao` + 95 `ajuste` menos os 11 com
`toast: true`), e **178 deles não têm `roles`**. Isso é a política de
04/09/2026 funcionando como escrita
(`src/data/changelog.js:23-37`), não falta de etiqueta. O problema está
inteiro nos 66 itens **globais que toastam**.
