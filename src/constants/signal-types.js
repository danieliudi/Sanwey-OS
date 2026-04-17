export const SIGNAL_TYPES_BY_COMPANY = {
  resibag: [
    { type: "IBAMA", label: "Publicação IBAMA", urgency: "alto" },
    { type: "ANTT", label: "Atualização ANTT 5998/2022", urgency: "critico" },
    { type: "Inmetro", label: "Portaria Inmetro", urgency: "medio" },
    { type: "RAPP", label: "Prazo RAPP", urgency: "critico" },
    { type: "Fiscalização", label: "Auto IBAMA", urgency: "alto" },
  ],
  comercial: [
    { type: "ANTT 5947", label: "ANTT Transporte Perigosos", urgency: "alto" },
    { type: "NORMAM 05", label: "NORMAM 05 Marítimo", urgency: "medio" },
    { type: "Nova planta", label: "Anúncio de nova planta industrial", urgency: "medio" },
    { type: "Licitação", label: "Licitação setor alimentício/mineração", urgency: "alto" },
    { type: "Expansão", label: "Cliente grande anunciou expansão", urgency: "medio" },
  ],
  industria: [
    { type: "ANP", label: "Atualização ANP Off-shore", urgency: "alto" },
    { type: "Licitação", label: "Licitação off-shore / siderurgia", urgency: "critico" },
    { type: "Inmetro", label: "Certificação Inmetro atualizada", urgency: "medio" },
    { type: "ISO", label: "Mudança norma ISO", urgency: "informativo" },
    { type: "Licenciamento", label: "Novo licenciamento industrial", urgency: "alto" },
  ],
  montemor: [
    { type: "Produção", label: "Demanda de Sanwey Indústria", urgency: "alto" },
    { type: "Matéria-prima", label: "Oscilação preço polipropileno", urgency: "medio" },
    { type: "Capacidade", label: "Alerta de capacidade fabril", urgency: "alto" },
    { type: "Mercado", label: "Oportunidade venda externa (futuro)", urgency: "informativo" },
  ],
};
