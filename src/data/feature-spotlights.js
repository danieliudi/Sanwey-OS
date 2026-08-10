// Tour guiado contextual (spotlight) — proposta "B" aprovada com o Daniel
// (07/08/2026, artifact "Tour guiado — proposta de spotlight contextual"):
// em vez de forçar um tour tela-por-tela, o aviso só aparece quando a
// pessoa naturalmente visita a tela onde a novidade mora.
//
// Separado do CHANGELOG de propósito — nem toda entrada de changelog aponta
// pra um elemento real de UI (a maioria são fixes/ajustes sem "onde
// apontar"); isto é só o subconjunto que vale destacar com um tooltip.
//
// Cada entrada:
//   id      — identificador estável, único pra sempre (nunca reaproveitar
//             depois de remover uma feature — ver nota de "sumiço" abaixo).
//   route   — mesmo valor de `section` em App.jsx (ex.: "personal-tasks").
//   target  — seletor CSS do elemento marcado com o atributo `data-tour`
//             correspondente (ex.: ViewToggleButton `dataTour="..."`).
//   text    — frase curta, mesmo tom do CHANGELOG.
//   version — versão em que a feature foi ao ar. Ao MUDAR a feature de um
//             jeito que invalida o spotlight antigo, sobe esta versão — quem
//             já viu a anterior vê de novo automaticamente (ver
//             use-feature-spotlight.js, que compara contra a versão vista).
//
// Quando uma feature SOME da plataforma: apague a entrada correspondente
// aqui (nunca deixe órfã) — o runtime já pula em silêncio se o elemento não
// existir (decisão registrada no mockup), mas isso não substitui a limpeza:
// entrada morta aqui é dívida, não é inofensiva só porque não quebra nada.
export const FEATURE_SPOTLIGHTS = [
  {
    id: "lista-pessoal-agenda",
    route: "personal-tasks",
    target: '[data-tour="lista-pessoal-agenda"]',
    text: "Novo: agora dá pra ver suas tarefas num calendário mensal — clique aqui pra experimentar.",
    version: "4.23.0",
  },
  // Achado do Daniel 10/08/2026: esta lista ficou parada em 1 entrada só
  // desde 4.23.0 — várias features grandes (reestruturação de drawer,
  // ESG, StageNavigator) saíram sem spotlight nenhum. As duas abaixo
  // reabrem a prática; ver CLAUDE.md regra 12 pra isso não voltar a
  // travar silenciosamente.
  {
    id: "executive-esg-tab",
    route: "executive",
    target: '[data-tour="executive-esg-tab"]',
    text: "Novo: o Painel Executivo ganhou uma aba de ESG & Carbono — clique aqui pra ver o total de CO2e do Grupo.",
    version: "4.33.0",
  },
  {
    id: "prestacao-de-contas",
    route: "crm-viagens",
    target: '[data-tour="prestacao-de-contas"]',
    text: "Novo: agrupe várias despesas soltas numa prestação de contas e envie de uma vez, em vez de despesa por despesa.",
    version: "4.34.0",
  },
  {
    id: "marketing-orcamento",
    route: "marketing-despesas",
    target: '[data-tour="despesas-abas"]',
    text: "Novo: a aba Orçamento mostra quanto do teto de cada categoria já foi gasto no ano — incluindo o que está comprometido em compras aprovadas.",
    version: "4.39.0",
  },
];

export default FEATURE_SPOTLIGHTS;
