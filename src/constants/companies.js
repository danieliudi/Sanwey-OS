export const COMPANIES = {
  all: {
    id: "all",
    name: "Visão Grupo",
    short: "Grupo Sanwey",
    primary: "#2D3436",
    dark: "#1A1D1E",
    light: "#EDEEEF",
    active: "#4D5456",
    accent: "#2D3436",
    description: "Visão consolidada de todas as empresas do Grupo",
  },
  resibag: {
    id: "resibag",
    name: "Resibag",
    short: "Resibag",
    primary: "#1A6E35",
    dark: "#0F4A23",
    light: "#E8F2EC",
    active: "#2D9B52",
    accent: "#1A6E35",
    description: "Big bags homologados para resíduos perigosos (Classe I, filtrante, verde)",
    focus: "Compliance ambiental",
  },
  industria: {
    id: "industria",
    name: "Sanwey",
    short: "Sanwey",
    primary: "#C7212B",
    dark: "#8B1419",
    light: "#FBE9EB",
    active: "#D42830",
    accent: "#C7212B",
    description: "Fabricação de Sanbags e contentores flexíveis — atende carteira B2B complexa",
    focus: "Fabricação e parceria técnica",
  },
};

export const NEUTRAL = {
  graphite:  "#37352F",  // --text
  slate:     "#57534E",  // --text-dim
  warmWhite: "#FFFFFF",  // --surface
  lightGray: "#F7F6F3",  // --surface-alt
  sombra:    "#E9E8E5",  // --border
  red:       "#C7212B",  // --color-industria (Indústria brand red)
  redDark:   "#8B1419",  // red hover
  redTint:   "#FBE9EB",  // red tint
  amber:     "#E8920A",
  amberBg:   "#FEF3C7",
  success:   "#16A34A",  // --color-resibag
  gold:      "#C49B2A",
};

export const COMPANY_IDS = ["industria", "resibag"];

// Unidades que podem ser selecionadas em solicitações INTERNAS de Marketing
// (material, compra) — não empresas vendedoras do CRM. Monte Mor não vende
// nada (por isso fora de COMPANY_IDS), mas ainda gera pedidos de material/
// compra pro Marketing atender, então entra aqui como uma unidade a mais.
export const MARKETING_UNIT_IDS = [...COMPANY_IDS, "montemor"];

export const MARKETING_UNIT_LABELS = {
  industria: COMPANIES.industria.short,
  resibag: COMPANIES.resibag.short,
  montemor: "Monte Mor",
};

export const MARKETING_UNIT_COLORS = {
  industria: COMPANIES.industria.primary,
  resibag: COMPANIES.resibag.primary,
  montemor: "#6B5B95",
};

export function marketingUnitLabel(id) {
  return MARKETING_UNIT_LABELS[id] || id;
}
