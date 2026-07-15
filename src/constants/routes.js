// Mapeamento único entre IDs de seção (usados pelo sidebar e por código
// existente como navGroups) e os caminhos das URLs. Mantém ID estável
// pra layout/condicionais e usa path como fonte de verdade pra navegação.

export const ROUTES = {
  dashboard:         "/",
  // "Visão Geral" do Comercial — distinta de `dashboard`, que é o roteador
  // inteligente de pouso pós-login (admin cai no Executivo, RH puro cai no
  // RH etc). Sem essa separação, o item "Visão Geral" do grupo Comercial no
  // menu lateral acabava mostrando o Painel Executivo pra admin, quando
  // deveria mostrar sempre a visão geral do Comercial mesmo.
  "commercial-overview": "/comercial",
  signals:           "/sinais",
  explorer:          "/explorador",
  crm:               "/pipeline",
  "crm-viagens":     "/viagens",
  crossref:          "/cross-sell",
  agents:            "/agentes",
  executive:         "/executivo",
  insights:          "/insights",
  presidency:        "/presidencia",
  "funnel-history":  "/historico-funil",
  "pipeline-builder":"/pipeline-builder",
  automations:       "/automacoes",
  "fair-import":     "/importar-feira",
  users:             "/usuarios",
  settings:          "/configuracoes",
  tutorials:         "/ajuda",
  marketing:                  "/marketing",
  "marketing-home":           "/marketing/inicio",
  "marketing-entregas":       "/marketing/entregas",
  "marketing-despesas":       "/marketing/despesas",
  "marketing-solicitacoes":   "/marketing/solicitacoes",
  "marketing-fornecedores":   "/marketing/fornecedores",
  "marketing-compras":        "/marketing/compras",
  "rh-overview":          "/rh",
  "rh-funcionarios":      "/rh/funcionarios",
  "rh-fornecedores":      "/rh/fornecedores",
  "rh-recrutamento":      "/rh/recrutamento",
  "rh-onboarding":        "/rh/onboarding",
  "rh-treinamentos":      "/rh/treinamentos",
  "rh-feedback":          "/rh/feedback",
  "rh-ferias":            "/rh/ferias",
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
