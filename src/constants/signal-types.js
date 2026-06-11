export const SIGNAL_TYPES_BY_COMPANY = {
  resibag: [
    { type: "IBAMA", label: "Publicação IBAMA", urgency: "alto" },
    { type: "ANTT", label: "Atualização ANTT 5998/2022", urgency: "critico" },
    { type: "Inmetro", label: "Portaria Inmetro", urgency: "medio" },
    { type: "RAPP", label: "Prazo RAPP", urgency: "critico" },
    { type: "Fiscalização", label: "Auto IBAMA", urgency: "alto" },
  ],
  industria: [
    { type: "ANP", label: "Atualização ANP Off-shore", urgency: "alto" },
    { type: "Licitação", label: "Licitação off-shore / siderurgia", urgency: "critico" },
    { type: "Inmetro", label: "Certificação Inmetro atualizada", urgency: "medio" },
    { type: "ISO", label: "Mudança norma ISO", urgency: "informativo" },
    { type: "Licenciamento", label: "Novo licenciamento industrial", urgency: "alto" },
  ],
};
