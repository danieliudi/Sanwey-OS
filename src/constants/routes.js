// Mapeamento único entre IDs de seção (usados pelo sidebar e por código
// existente como navGroups) e os caminhos das URLs. Mantém ID estável
// pra layout/condicionais e usa path como fonte de verdade pra navegação.

export const ROUTES = {
  dashboard:         "/",
  chat:              "/chat",
  // "Visão Geral" do Comercial — distinta de `dashboard`, que é o roteador
  // inteligente de pouso pós-login (admin cai no Executivo, RH puro cai no
  // RH etc). Sem essa separação, o item "Visão Geral" do grupo Comercial no
  // menu lateral acabava mostrando o Painel Executivo pra admin, quando
  // deveria mostrar sempre a visão geral do Comercial mesmo.
  "commercial-overview": "/comercial",
  signals:           "/sinais",
  explorer:          "/explorador",
  crm:               "/pipeline",
  posvenda:          "/pos-venda",
  clients:           "/clientes",
  pedidos:           "/pedidos",
  catalogo:          "/catalogo",
  "crm-viagens":     "/viagens",
  crossref:          "/cross-sell",
  comex:             "/comex",
  agents:            "/agentes",
  executive:         "/executivo",
  "esg-carbono":     "/esg-carbono",
  insights:          "/insights",
  // Hub "Inteligência de Mercado" (19-20/08/2026): 3 abas (Mercado/Insights/
  // Cruzamento) numa página só, mesmo padrão do Executivo (regra 9). A antiga
  // rota /insights (ROUTES.insights acima) passou a redirecionar pra cá —
  // InsightsView virou a aba "Insights" deste hub, não sumiu, só mudou de
  // endereço (ver App.jsx).
  "market-intel":    "/inteligencia-mercado",
  presidency:        "/presidencia",
  "funnel-history":  "/historico-funil",
  "pipeline-builder":"/pipeline-builder",
  "document-library":"/biblioteca-de-documentos",
  automations:       "/automacoes",
  "fair-import":     "/importar-feira",
  users:             "/usuarios",
  settings:          "/configuracoes",
  tutorials:         "/ajuda",
  "central-bugs":    "/central-bugs",
  marketing:                  "/marketing",
  "marketing-home":           "/marketing/inicio",
  "marketing-entregas":       "/marketing/entregas",
  "marketing-tarefas":        "/marketing/tarefas",
  "marketing-despesas":       "/marketing/despesas",
  "marketing-solicitacoes":   "/marketing/solicitacoes",
  "marketing-fornecedores":   "/marketing/fornecedores",
  "marketing-compras":        "/marketing/compras",
  "marketing-feiras":         "/marketing/feiras",
  "marketing-conteudo":       "/marketing/conteudo",
  "rh-overview":          "/rh",
  "rh-funcionarios":      "/rh/funcionarios",
  "rh-fornecedores":      "/rh/fornecedores",
  "rh-recrutamento":      "/rh/recrutamento",
  "rh-onboarding":        "/rh/onboarding",
  "rh-treinamentos":      "/rh/treinamentos",
  "rh-feedback":          "/rh/feedback",
  "rh-ferias":            "/rh/ferias",
  "rh-cargos":            "/rh/cargos",
  "rh-comunicacao":       "/rh/comunicacao",
  "rh-bem-estar":         "/rh/bem-estar",
  "rh-relatorios":        "/rh/relatorios",
  "meu-rh":               "/meu-rh",
  "personal-tasks":       "/tarefas-pessoais",
  profile:                "/perfil",
};

// Reverso: path → id (não inclui dashboard porque qualquer path desconhecido
// cai no dashboard de qualquer forma).
export const PATH_TO_SECTION = Object.fromEntries(
  Object.entries(ROUTES).map(([id, path]) => [path, id])
);

export function sectionFromPath(pathname) {
  return PATH_TO_SECTION[pathname] || "dashboard";
}
