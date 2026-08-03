// Frente (unidade/empresa) do módulo de RH — conceito exclusivo do RH,
// separado do COMPANY_IDS do CRM/Marketing (src/constants/companies.js).
// Monte Mor é uma entidade só de folha de pagamento/RH, sem operação
// comercial ou de marketing própria — por isso não entra no COMPANY_IDS
// global, só aqui.

export const RH_FRENTES = ["sanwey", "resibag", "montemor"];

export const RH_FRENTE_LABELS = {
  sanwey: "Sanwey",
  resibag: "Resibag",
  montemor: "Monte Mor",
};

export const RH_FRENTE_COLORS = {
  sanwey: "#CC2936",
  resibag: "#1A6E35",
  montemor: "#6B5B95",
};

export function rhFrenteLabel(id) {
  return RH_FRENTE_LABELS[id] || id;
}
