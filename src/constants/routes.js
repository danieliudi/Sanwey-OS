// Mapeamento único entre IDs de seção (usados pelo sidebar e por código
// existente como navGroups) e os caminhos das URLs. Mantém ID estável
// pra layout/condicionais e usa path como fonte de verdade pra navegação.

export const ROUTES = {
  dashboard:         "/",
  signals:           "/sinais",
  explorer:          "/explorador",
  crm:               "/negocios",
  crossref:          "/cross-sell",
  agents:            "/agentes",
  executive:         "/executivo",
  presidency:        "/presidencia",
  "funnel-history":  "/historico-funil",
  "pipeline-builder":"/pipeline-builder",
  automations:       "/automacoes",
  "fair-import":     "/importar-feira",
  users:             "/usuarios",
  settings:          "/configuracoes",
  tutorials:         "/ajuda",
  marketing:              "/marketing",
  "marketing-home":       "/marketing/inicio",
  "marketing-entregas":   "/marketing/entregas",
  "marketing-despesas":   "/marketing/despesas",
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
