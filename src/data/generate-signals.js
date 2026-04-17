const SIGNALS_BY_COMPANY = {
  resibag: [
    { id: "sig_r1", company: "resibag", source: "IBAMA", title: "IN IBAMA 14/2026 — RAPP 2026 amplia CNAEs obrigados",
      excerpt: "Atualização do RAPP com prazo 31/05/2026. Novos CNAEs de química fina obrigados.",
      urgency: "critico", daysAgo: 1, affectedCount: 247 },
    { id: "sig_r2", company: "resibag", source: "ANTT", title: "Resolução ANTT 6.142/2026 — complementação 5998/2022",
      excerpt: "Novos requisitos para transporte rodoviário de Classe I. Aplicação 01/07/2026.",
      urgency: "alto", daysAgo: 3, affectedCount: 156 },
    { id: "sig_r3", company: "resibag", source: "Inmetro", title: "Portaria 098/2026 — atualização da 320/2021",
      excerpt: "Novos ensaios de estanqueidade para embalagens flexíveis homologadas.",
      urgency: "medio", daysAgo: 6, affectedCount: 34 },
  ],
  comercial: [
    { id: "sig_c1", company: "comercial", source: "ANTT", title: "ANTT 5947/2021 — revisão anual de fornecedores",
      excerpt: "Auditoria de fornecedores de embalagem homologada — novos critérios em 2026.",
      urgency: "alto", daysAgo: 2, affectedCount: 198 },
    { id: "sig_c2", company: "comercial", source: "Mercado", title: "Vale anuncia expansão em Carajás com +40% capacidade",
      excerpt: "Projeto de US$ 2bi exige fornecedores com capacidade em larga escala.",
      urgency: "medio", daysAgo: 4, affectedCount: 12 },
    { id: "sig_c3", company: "comercial", source: "NORMAM 05", title: "NORMAM 05/DPC atualizada para carga marítima",
      excerpt: "Ajustes técnicos em embalagens homologadas para transporte marítimo.",
      urgency: "medio", daysAgo: 7, affectedCount: 67 },
    { id: "sig_c4", company: "comercial", source: "Mercado", title: "Cargill Brasil licita embalagens 2026",
      excerpt: "Edital público para fornecimento anual — fechamento em 30 dias.",
      urgency: "alto", daysAgo: 1, affectedCount: 1 },
  ],
  industria: [
    { id: "sig_i1", company: "industria", source: "ANP", title: "ANP atualiza requisitos off-shore 2026",
      excerpt: "Nova lista de embalagens homologadas para operação em plataformas.",
      urgency: "alto", daysAgo: 2, affectedCount: 23 },
    { id: "sig_i2", company: "industria", source: "Licitação", title: "Petrobras pregão multi-anual off-shore",
      excerpt: "Contrato 3 anos para fornecimento técnico. Proposta até 15/05.",
      urgency: "critico", daysAgo: 1, affectedCount: 8 },
    { id: "sig_i3", company: "industria", source: "Inmetro", title: "Re-certificação Inmetro produtos perigosos",
      excerpt: "Prazo para renovação de certificados de fornecedores.",
      urgency: "medio", daysAgo: 5, affectedCount: 15 },
  ],
  montemor: [
    { id: "sig_m1", company: "montemor", source: "Produção", title: "Sanwey Indústria: pedido especial Petrobras",
      excerpt: "Demanda urgente de tecido condutivo Type C para contrato off-shore.",
      urgency: "alto", daysAgo: 1, affectedCount: 1 },
    { id: "sig_m2", company: "montemor", source: "Matéria-prima", title: "PP oscila +8% na semana",
      excerpt: "Polipropileno granel em alta — impacto em custo de produção.",
      urgency: "medio", daysAgo: 3, affectedCount: 1 },
    { id: "sig_m3", company: "montemor", source: "Capacidade", title: "Ociosidade 15% no turno noturno",
      excerpt: "Oportunidade para absorver demanda externa adicional.",
      urgency: "informativo", daysAgo: 2, affectedCount: 1 },
  ],
};

export function generateMarketSignals() {
  const out = [];
  const now = Date.now();
  Object.values(SIGNALS_BY_COMPANY).forEach(arr => {
    arr.forEach(s => {
      const date = new Date(now - s.daysAgo * 86400000);
      out.push({
        ...s,
        date: date.toLocaleDateString("pt-BR"),
        dateISO: date.toISOString(),
      });
    });
  });
  return out;
}
