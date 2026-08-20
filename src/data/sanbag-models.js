// 15 modelos canônicos Sanbag — skill sanwey-canonical-facts §08/§09/§07
// (consultada 19/08/2026). Lista estática pra Fase 1 do CPQ (ProposalPanel):
// modelo é texto livre OU selecionado daqui (datalist), sem preço-base —
// Fase 2 (fora de escopo aqui) que traria catálogo com precificação real
// (sanbag_models + product_pricing_rules, ver docs/design-spec-cpq-proposta.md).

export const SANBAG_SEGMENTS = {
  alimenticio: "Alimentício",
  mineracao: "Mineração",
  quimico: "Químico / Petroquímica",
  armazenagem: "Armazenagem / Logística",
  agro: "Agrobusiness",
  perigosos: "Cargas perigosas",
};

export const SANBAG_MODELS = [
  { label: "Big Bag Alça Guia", segment: "armazenagem", certificationHint: null },
  { label: "Lacrado", segment: "alimenticio", certificationHint: "FSSC 22000" },
  { label: "Quadrado", segment: "agro", certificationHint: null },
  { label: "Retangular", segment: "agro", certificationHint: null },
  { label: "Liner Aluminizado", segment: "alimenticio", certificationHint: "FSSC 22000" },
  { label: "Standard Plano", segment: "armazenagem", certificationHint: null },
  { label: "Standard Tubular", segment: "armazenagem", certificationHint: null },
  { label: "Reutilizável Lavável", segment: "alimenticio", certificationHint: "FSSC 22000 (BPF)" },
  { label: "Poliéster", segment: "mineracao", certificationHint: null },
  { label: "Type C Condutivo", segment: "quimico", certificationHint: "ANP" },
  { label: "Type B", segment: "quimico", certificationHint: null },
  { label: "Atmosfera Modificada", segment: "alimenticio", certificationHint: "FSSC 22000" },
  { label: "Arejado", segment: "agro", certificationHint: null },
  { label: "Homologado Perigosos", segment: "perigosos", certificationHint: "INMETRO (Res. ANTT 420)" },
  { label: "Térmico", segment: "alimenticio", certificationHint: "FSSC 22000" },
];

export default SANBAG_MODELS;
