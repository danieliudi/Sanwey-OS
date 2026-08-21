// Tour guiado sequencial da plataforma inteira — decidido com o Daniel
// 10/08/2026 (mockup "Tour guiado — cobertura completa da plataforma",
// artifact aprovado), com a síntese final: por item (não por seção),
// disponível a todos os usuários (não só quem está entrando agora pela
// primeira vez), skip marca como concluído pra sempre.
//
// Cada entrada aponta pro MESMO `id` usado em `navGroups` (App.jsx) — o
// `data-tour="sidebar-nav-<id>"` correspondente já existe em todo NavItem
// do Sidebar.jsx (passthrough automático via prop `id`). Não precisa de
// lista separada por papel: `use-onboarding-tour.js` filtra em tempo real
// contra o que está de fato no DOM — um item que o papel do usuário não vê
// no menu simplesmente não aparece no tour dele, sem duplicar a lógica de
// `navGroups` aqui.
//
// `blurb` é a versão curta ("pra que serve", 1-2 frases) — não é o guia
// passo a passo completo, que já mora em `tutorials.js`/Ajuda & Tutoriais.
export const ONBOARDING_TOUR_STEPS = [
  // Meu Espaço
  { id: "dashboard", icon: "📋", title: "Pendências",
    blurb: "É a sua fila do dia — reúne tudo que espera por você em qualquer parte da plataforma numa única lista, ordenada do mais urgente pro menos urgente." },
  { id: "chat", icon: "💬", title: "Chat",
    blurb: "O chat interno da empresa — converse com seu time por canal ou no privado com seu gestor e colegas, sem sair da plataforma." },
  { id: "personal-tasks", icon: "✅", title: "Meu To-do",
    blurb: "Sua lista de tarefas 100% privada — nem seu gestor nem o admin veem o que está aqui." },
  { id: "meu-rh", icon: "🏠", title: "Meu RH",
    blurb: "Seu espaço pessoal como colaborador — férias, holerite, treinamentos e avisos do RH, separado das telas onde você gerencia RH pros outros." },

  // Comercial
  { id: "commercial-overview", icon: "📊", title: "Visão Geral",
    blurb: "Seu resumo do dia no Comercial — quantos negócios você tem, quanto vale seu funil, e o que precisa de atenção primeiro." },
  { id: "signals", icon: "📡", title: "Sinais",
    blurb: "Alertas automáticos sobre normas novas e mudanças de mercado que podem virar oportunidade — vira um lead novo com um clique." },
  { id: "crm", icon: "🗺️", title: "Funil de Vendas",
    blurb: "O pipeline comercial — cada coluna é uma etapa da venda. Arraste um card pra avançar, ou clique nele pra ver todo o histórico." },
  { id: "posvenda", icon: "🤝", title: "Funil de Pós-venda",
    blurb: "Acompanha o relacionamento com o cliente depois que a venda fecha. Um clique em 'Enviar para Pós-venda' no negócio Ganho já cria o caso aqui." },
  { id: "clients", icon: "🏢", title: "Clientes",
    blurb: "O cadastro central de empresas clientes — vincula negócios do Funil de Vendas e mostra, num só lugar, tudo que cada cliente já comprou de cada empresa do Grupo." },
  { id: "crossref", icon: "🔀", title: "Cross-sell",
    blurb: "Mostra clientes com potencial de comprar de mais de uma empresa do Grupo — e avisa quando duas equipes já vendem pro mesmo cliente sem saber." },
  { id: "explorer", icon: "🧭", title: "Explorador",
    blurb: "Ferramenta de prospecção — consulte uma empresa pelo CNPJ, filtre sugestões, ou importe uma planilha inteira de leads de uma vez." },
  { id: "crm-viagens", icon: "✈️", title: "Viagens & Despesas",
    blurb: "Registre visitas e despesas — a IA lê o comprovante sozinha, e você agrupa tudo numa prestação de contas pro seu gestor aprovar em lote." },
  { id: "comex", icon: "🚢", title: "Comex",
    blurb: "O fluxo de comércio exterior do Grupo — cada operação atravessa suas próprias etapas, com cálculo automático de Landed Cost." },

  // Marketing
  { id: "marketing-home", icon: "📊", title: "Visão Geral · Marketing",
    blurb: "O painel do módulo de Marketing: campanhas ativas, orçamento comprometido e entregas atrasadas, num só lugar." },
  { id: "marketing", icon: "📣", title: "Campanhas",
    blurb: "O Kanban principal de Marketing: cada campanha passa por etapas (Briefing, Aprovação, Produção…) até ir ao ar." },
  { id: "marketing-solicitacoes", icon: "📥", title: "Solicitações",
    blurb: "Pedidos que outros departamentos enviaram pelo formulário público — material de marketing ou compra de item pronto. Você aprova ou rejeita cada um." },
  { id: "marketing-entregas", icon: "📦", title: "Entregas",
    blurb: "Cada demanda de produção vira um card que passa por Solicitação, Produção, Revisão e Entregue, com prazo e prioridade definidos." },
  { id: "marketing-tarefas", icon: "📋", title: "Tarefas",
    blurb: "O Kanban interno da equipe de Marketing — separado de Entregas porque não envolve a agência." },
  { id: "marketing-fornecedores", icon: "🚚", title: "Fornecedores · Marketing",
    blurb: "As agências, gráficas e outros parceiros que trabalham com o Marketing — daqui você vincula um fornecedor a uma campanha ou compra." },
  { id: "marketing-compras", icon: "🛒", title: "Compras · Marketing",
    blurb: "Itens prontos que o Marketing precisa comprar — brindes, uniformes, material impresso — não peças produzidas sob encomenda como em Entregas." },
  { id: "marketing-despesas", icon: "💰", title: "Despesas · Marketing",
    blurb: "Registre e acompanhe gastos de Marketing — mídia paga, produção, agência — vinculando cada um a uma campanha, entrega ou tarefa." },

  // Recursos Humanos (+ Meu Desenvolvimento, mesmos ids pra quem não é RH)
  { id: "rh-overview", icon: "👥", title: "Visão Geral · RH",
    blurb: "O painel que reúne o que está pendente no RH agora — férias pra aprovar, vagas abertas e desligamentos sem entrevista de saída." },
  { id: "rh-recrutamento", icon: "💼", title: "Recrutamento",
    blurb: "Onde vagas são publicadas (com link e QR de candidatura) e candidatos avançam num funil, da triagem até virarem funcionário." },
  { id: "rh-onboarding", icon: "🧾", title: "Onboarding",
    blurb: "Acompanha a integração de cada novo colaborador etapa por etapa — ou, se for você o novo integrante, mostra seu próprio checklist." },
  { id: "rh-treinamentos", icon: "🎓", title: "Treinamentos",
    blurb: "O catálogo de treinamentos da empresa — ou, se algum estiver atribuído a você, aparece aqui pra marcar como concluído." },
  { id: "rh-feedback", icon: "📝", title: "Avaliação de Desempenho",
    blurb: "Os ciclos de avaliação de desempenho da empresa — ou, se for a sua vez, sua autoavaliação aparece em destaque." },
  { id: "rh-ferias", icon: "🏖️", title: "Férias & Licenças",
    blurb: "Toda solicitação de férias e licença é aprovada aqui — com um calendário pra checar se duas pessoas do mesmo time vão faltar juntas." },
  { id: "rh-funcionarios", icon: "🧑‍💼", title: "Funcionários",
    blurb: "O cadastro completo de funcionários — dados, cargo, contrato e um atalho direto pra Onboarding, Avaliações e Férias de cada um." },
  { id: "rh-cargos", icon: "💼", title: "Cargos & Salários",
    blurb: "O catálogo de cargos com faixa salarial, e onde promoções e reajustes são registrados e aprovados pela diretoria." },
  { id: "rh-comunicacao", icon: "📣", title: "Comunicação",
    blurb: "Onde o RH manda comunicados internos e cria pesquisas — anônimas ou identificadas — pra ouvir o time." },
  { id: "rh-bem-estar", icon: "💆", title: "Bem-estar",
    blurb: "Sessões de bem-estar com agendamento por horário — o colaborador reserva pelo QR code, igual reserva de restaurante." },
  { id: "rh-fornecedores", icon: "🏢", title: "Fornecedores · RH",
    blurb: "Cadastro de fornecedores do RH — convênio médico, seguradora, terceirizada — com alerta de contrato vencendo." },
  { id: "rh-relatorios", icon: "📊", title: "Relatórios · RH",
    blurb: "Monte um relatório sob medida escolhendo métricas de qualquer módulo de RH e exporte tudo num CSV só." },

  // Inteligência
  { id: "executive", icon: "📊", title: "Executivo",
    blurb: "Mostra a saúde de todas as áreas do Grupo num só lugar — um número e um alerta por departamento, com uma aba própria pra se aprofundar." },
  { id: "esg-carbono", icon: "🌱", title: "ESG & Carbono",
    blurb: "Calcula a pegada de carbono da empresa a partir de dados que já estão na plataforma — e gera um relatório em PDF pronto para auditoria ou proposta comercial." },
  { id: "market-intel", icon: "🌐", title: "Mercado",
    blurb: "Dados do setor (atualizados automaticamente), insights internos de RH/Comercial/Marketing, e o cruzamento dos dois num lugar só." },
  { id: "agents", icon: "🤖", title: "Agentes",
    blurb: "Um time de IA que fica de olho no pipeline e sugere ações — mas quem decide se a ação acontece é sempre você." },

  // Configuração
  { id: "automations", icon: "⚡", title: "Automações",
    blurb: "Regras mecânicas que rodam sozinhas, sem IA. A aba 'Agentes de IA', ao lado, é onde você configura os agentes que geram sugestões pra aprovar em 'Agentes'." },
  { id: "settings", icon: "⚙️", title: "Configurações",
    blurb: "Suas preferências pessoais (senha, aparência, notificações) e, se você for gerente ou admin, os ajustes da plataforma inteira." },

  // Ajuda — ponto final natural do tour
  { id: "tutorials", icon: "📚", title: "Ajuda & Tutoriais",
    blurb: "Reveja qualquer coisa que este tour mostrou — cada tela tem um guia passo a passo próprio aqui, sempre que precisar." },
];

export default ONBOARDING_TOUR_STEPS;
