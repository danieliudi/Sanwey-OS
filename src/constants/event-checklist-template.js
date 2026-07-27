// Template padrão de checklist de evento (planilha real do Daniel), aplicado
// via botão manual no drawer da campanha — ver docs/design-spec-checklist-evento.md.
// Hardcoded de propósito (mesmo precedente de PURCHASE_STAGES em
// use-marketing-purchase-requests.js): não foi pedido um editor de template
// configurável; editar isto é código, não UI.
export const EVENT_CHECKLIST_TEMPLATE = [
  {
    segment: "Documentação e Acessos",
    items: [
      "Verificar Contrato",
      "Localização do Stand",
      "Requisitos do Manual do Expositor",
      "Crachá",
      "Credencial convidado VIP",
      "Segurança",
      "Coletor de dados",
      "Energia Elétrica",
      "Autorização da montadora",
      "Funcionamento feira virtual e presencial",
      "Acessar material de divulgação da Organizadora",
      "e-commerce",
    ],
  },
  {
    segment: "Preparação e Divulgação",
    items: [
      "Verificar o projeto Stand",
      "Banner do stand",
      "Vídeo arquivo Pen Drive",
      "Limpeza",
      "Schedule pessoal e comercial",
      "Schedule pessoal de outros departamentos",
      "Orientar os colaboradores",
      "Mailing de divulgação da feira",
      "Convidar cliente e prospects",
      "Estacionamento",
      "Cartão de visitas",
      "Contratação Seguro",
    ],
  },
  {
    segment: "Montagem e Amostras",
    items: [
      "Acompanhamento montagem",
      "Acompanhamento desmontagem",
      "Providenciar as amostras",
      "Verificar modelo para exposição",
      "Fabricação da amostra",
      "Montagem da amostra no stand",
    ],
  },
  {
    segment: "Materiais e Logística",
    items: [
      "Verificar estoque de material impresso",
      "Análise e definição dos vídeos a serem utilizados na feira",
      "Verificar estoque de brindes",
      "Sacola Sanwey",
      "Copos descartáveis, saco de lixo e material para limpeza",
      "Separar kit escritório",
      "Alimentos",
      "Bebidas",
      "Máquina de chopp",
      "Máquina de café",
      "Extintor de incêndio",
      "Emissão de nota fiscal",
      "Transporte para levar material para feira",
      "Levar o material e organizar o stand",
      "Revisar folders",
    ],
  },
  {
    segment: "Pós-evento",
    items: [
      "Dados do coletor de dados",
      "Coleta de dados com a equipe",
      "Relatório",
    ],
  },
];
