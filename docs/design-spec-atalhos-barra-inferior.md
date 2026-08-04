# Spec — Atalhos personalizáveis da barra inferior (mobile)

Mockup aprovado por Daniel (Artifact `63f56291-30f2-4a86-aea9-c2d472fd11aa`,
aba "Atalhos da barra inferior"). Sem schema novo — preferência por
usuário, salva localmente, mesmo mecanismo já usado por
`useDashboardWidgetPrefs` (localStorage, não banco).

Fatos confirmados no código antes desta spec:

- `src/components/shell/MobileBottomNav.jsx` (275 linhas): `getRoleTabs(roles, navGroups)`
  (definida 56-72, chamada 204) mapeia `roles` → `ROLE_TAB_IDS` (25-35, 4
  ids fixos por cargo) → resolve cada id via `flattenNavGroups(navGroups)`
  (43-49), retornando até 4 itens `{id, label, icon}`. "Menu" **não** faz
  parte desse retorno — é um botão fixo separado, adicionado depois do
  `{tabs.map(...)}` (246-258). Total visível hoje: até 4 + Menu = 5.
- `src/hooks/use-dashboard-widget-prefs.js:19-60` — padrão de referência:
  `usePersistentState(key, fallback)` (assinatura em
  `src/hooks/use-persistent-state.js:11-66`, retorna `[value, setValue]`,
  já debounced) guardando um mapa por `userId`.
- `src/components/views/SettingsView.jsx` (2033 linhas): seções em
  `tabs` (useMemo, ~419-431), cada uma condicionalmente empurrada (veja o
  padrão usado pra `figurinhas`, linha ~421/428, componente `StickersPanel`
  definido linha 172, roteado em ~1945).

## 1. `src/hooks/use-bottom-nav-prefs.js` (novo)

Mesmo padrão de `use-dashboard-widget-prefs.js`, adaptado:

```
usePersistentState(STORAGE_KEYS.bottomNavPrefs, {})  // mapa por userId
```

Retorna `{ selectedIds, setSelectedIds }` — `selectedIds` é um array de até
4 ids de nav item (mesmo vocabulário de `ROLE_TAB_IDS`/`flattenNavGroups`).
Sem entrada no mapa pro usuário = usa o default de `getRoleTabs` de hoje
(comportamento atual, ninguém é afetado até customizar). Adicione a chave
nova em `src/constants/storage-keys.js` (mesmo arquivo que já tem
`dashboardWidgetPrefs`).

## 2. `MobileBottomNav.jsx`

`getRoleTabs` continua sendo a fonte da LISTA DE OPÇÕES disponíveis
(tudo que o cargo do usuário pode acessar via `navGroups`, não só os 4
fixos — reveja `flattenNavGroups` pra pegar a lista completa de módulos
liberados, não só o recorte de 4 que `ROLE_TAB_IDS` define hoje). O
componente passa a: se `use-bottom-nav-prefs` tem `selectedIds` pro
usuário, usa esses (na ordem escolhida, até 4); senão, cai no default
atual (`ROLE_TAB_IDS`). "Menu" continua fixo, fora da escolha, sempre o
5º item — não mude essa parte.

## 3. Tela de escolha (`Configurações → Barra inferior`)

Nova seção em `SettingsView.jsx`, mesmo padrão da seção `Figurinhas`
citada acima (entrada em `tabs`, componente próprio, roteamento
condicional). Componente novo `BottomNavPrefsPanel`:

- Lista todos os módulos que o `flattenNavGroups` do usuário permite
  (não só os 4 defaults), cada um com checkbox/toggle — estilo exato do
  mockup (`pick-row`, ícone + label + check).
- Limite de 4 selecionados — ao tentar marcar um 5º, desmarque
  automaticamente o mais antigo marcado (sem modal de erro, sem travar o
  clique) OU desabilite visualmente as opções não marcadas quando o limite
  for atingido (qualquer uma das duas é aceitável — escolha a mais simples
  de implementar corretamente).
- Preview ao vivo da barra (mesmo componente visual `nav-preview` do
  mockup) refletindo a seleção atual antes de salvar.
- Botão salvar chama `setSelectedIds`.
- Esta seção só aparece pra quem acessa via mobile (abaixo do breakpoint
  `lg`) ou é visível sempre em Configurações mas com uma nota de que só
  afeta a versão mobile — escolha a opção mais simples de implementar
  (visível sempre, com preview deixando claro que é sobre a barra mobile).

## 4. Fora de escopo

- Não mude `ROLE_TAB_IDS`/o default de ninguém — só quem customizar ativa
  o mecanismo novo.
- Não construa um sistema de "arrastar pra reordenar" — a ordem de seleção
  (ordem que a pessoa marcou os checkboxes) já é suficiente, sem
  drag-and-drop.
