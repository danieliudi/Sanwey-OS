import { Layers, Bell, CalendarDays, PlusCircle, Users, Workflow, Zap, BarChart3, BookOpen, PartyPopper } from "lucide-react";

export const ONBOARDING_STEPS = {
  consultor: [
    {
      icon: PartyPopper,
      title: "Bem-vindo ao CRM Sanwey",
      body: "Aqui você acompanha leads atribuídos a você e registra interações com clientes de forma organizada.",
    },
    {
      icon: Layers,
      title: "Seus negócios",
      body: "Na tela de Negócios você visualiza todos os leads atribuídos a você em modo Kanban ou Calendário.",
    },
    {
      icon: BookOpen,
      title: "Detalhes do lead",
      body: "Clique em qualquer card para abrir histórico, arquivos, comentários e próximos passos da negociação.",
    },
    {
      icon: Bell,
      title: "Sinais de mercado",
      body: "Na tela Sinais, acompanhe alertas regulatórios e oportunidades relevantes para os seus leads.",
    },
  ],
  vendedor: [
    {
      icon: PartyPopper,
      title: "Bem-vindo ao CRM Sanwey",
      body: "Aqui você gerencia seus leads, move cards no Kanban e registra o progresso de cada negociação.",
    },
    {
      icon: Layers,
      title: "Kanban de Negócios",
      body: "Arraste cards entre colunas para avançar um lead no pipeline. Cada coluna é uma etapa da negociação.",
    },
    {
      icon: PlusCircle,
      title: "Criar um lead",
      body: "Use o botão ＋ em qualquer coluna para criar um novo lead. Preencha empresa, setor e valor estimado.",
    },
    {
      icon: CalendarDays,
      title: "Calendário de follow-up",
      body: "Troque para a visão Calendário para ver e planejar acompanhamentos por data de forma visual.",
    },
    {
      icon: Bell,
      title: "Sinais de mercado",
      body: "Use os Sinais para identificar oportunidades e criar leads a partir de publicações regulatórias e licitações.",
    },
  ],
  gerente: [
    {
      icon: PartyPopper,
      title: "Bem-vindo ao CRM Sanwey",
      body: "Você tem acesso a todo o pipeline da equipe, relatórios executivos e configurações avançadas da plataforma.",
    },
    {
      icon: Users,
      title: "Gestão de equipe",
      body: "Em Usuários, convide membros, defina papéis (vendedor, consultor) e associe às unidades por e-mail seguro.",
    },
    {
      icon: Workflow,
      title: "Construtor de pipeline",
      body: "Defina etapas, probabilidades e regras de negócio do funil de conversão para cada unidade da empresa.",
    },
    {
      icon: Zap,
      title: "Automações",
      body: "Crie regras automáticas: mova leads por inatividade, dispare alertas e atribua responsáveis sem intervenção manual.",
    },
    {
      icon: BarChart3,
      title: "Painel Executivo",
      body: "Acompanhe KPIs consolidados, funil de conversão e performance individual de cada vendedor em tempo real.",
    },
  ],
};
ONBOARDING_STEPS.admin = ONBOARDING_STEPS.gerente;

export const VIDEO_TUTORIALS = {
  consultor: [
    { id: "v-c1", title: "Visão geral do CRM", description: "Negócios", duration: null, url: null,
      quickStart: { icon: "🗺️", steps: ["Acesse 'Negócios' no menu lateral para ver o pipeline", "Use o Kanban para acompanhar leads por etapa", "Clique em qualquer card para ver detalhes e histórico"] } },
    { id: "v-c2", title: "Visualizando e filtrando leads", description: "Negócios", duration: null, url: null,
      quickStart: { icon: "🔍", steps: ["No Kanban, use os filtros no topo para filtrar por vendedor", "Alterne entre Kanban e Calendário pelo seletor no topo direito", "Clique numa coluna para ver os leads de uma etapa específica"] } },
    { id: "v-c3", title: "Preenchendo um lead", description: "Negócios", duration: null, url: null,
      quickStart: { icon: "✏️", steps: ["Clique em qualquer card para abrir o painel de detalhes", "Edite campos diretamente: valor, setor, responsável, data de fechamento", "Use a seção 'Notas' para registrar interações e próximos passos"] } },
    { id: "v-c4", title: "Follow-up pelo calendário", description: "Negócios", duration: null, url: null,
      quickStart: { icon: "📅", steps: ["Alterne para a visão 'Calendário' no topo da tela de Negócios", "Cada card aparece na data de fechamento esperada", "Leads com data vencida aparecem em vermelho — priorize-os"] } },
  ],
  vendedor: [
    { id: "v-v1", title: "Visão geral do pipeline", description: "Negócios", duration: null, url: null,
      quickStart: { icon: "🗂️", steps: ["Acesse 'Negócios' — cada coluna é uma etapa do funil de vendas", "Arraste cards entre colunas para avançar um negócio de etapa", "O número no topo de cada coluna mostra o total e o valor em aberto"] } },
    { id: "v-v2", title: "Criando e editando leads", description: "Negócios", duration: null, url: null,
      quickStart: { icon: "➕", steps: ["Clique em '+ Novo Negócio' no menu lateral para abrir um card", "Preencha nome da empresa, setor, valor estimado e responsável", "Clique no card a qualquer momento para editar, adicionar notas e arquivos"] } },
    { id: "v-v3", title: "Movendo leads no Kanban", description: "Negócios", duration: null, url: null,
      quickStart: { icon: "↔️", steps: ["Arraste um card para outra coluna para mudar a etapa", "Ou use o menu ⋮ no card e escolha 'Mover para →'", "O histórico de movimentações fica registrado no painel do lead"] } },
    { id: "v-v4", title: "Calendário de follow-up", description: "Negócios", duration: null, url: null,
      quickStart: { icon: "📅", steps: ["Alterne para 'Calendário' no seletor de visão", "Leads aparecem na data de fechamento prevista", "Cards vermelhos indicam atraso — priorize esses contatos"] } },
    { id: "v-v5", title: "Transformando sinais em leads", description: "Sinais", duration: null, url: null,
      quickStart: { icon: "📡", steps: ["Acesse 'Sinais' no menu lateral para ver alertas regulatórios e de mercado", "Clique em 'Criar lead a partir deste sinal' em qualquer card de sinal", "Digite o nome da empresa afetada e confirme — o lead vai direto ao Kanban"] } },
  ],
  gerente: [
    { id: "v-g1", title: "Gestão de equipe e convites", description: "Usuários", duration: null, url: null,
      quickStart: { icon: "👥", steps: ["Acesse 'Usuários' → 'Convidar' para adicionar membros", "Defina o papel: Vendedor, Consultor, Gerente ou Admin", "Associe cada usuário à unidade Sanwey correta (Indústria, Resibag…)"] } },
    { id: "v-g2", title: "Configurando o pipeline", description: "Construtor de pipeline", duration: null, url: null,
      quickStart: { icon: "⚙️", steps: ["Acesse 'Construtor de pipeline' em Configuração", "Arraste etapas para reordenar; clique para renomear e definir probabilidade", "Use as regras de transição para controlar quais movimentos são permitidos"] } },
    { id: "v-g3", title: "Criando automações", description: "Automações", duration: null, url: null,
      quickStart: { icon: "⚡", steps: ["Acesse 'Automações' → 'Nova automação' ou escolha um template pronto", "Defina o gatilho (ex: mudança de etapa) e a ação (ex: notificar)", "Ative a automação e monitore execuções no painel de logs"] } },
    { id: "v-g4", title: "Painel executivo", description: "Executivo", duration: null, url: null,
      quickStart: { icon: "📊", steps: ["Acesse 'Executivo' para ver KPIs consolidados do Grupo", "Use os filtros de período (30d, 90d, Este Ano) para comparar janelas", "A aba 'IA' gera análises e forecasts automáticos do pipeline"] } },
    { id: "v-g5", title: "Sinais de mercado para gestores", description: "Sinais", duration: null, url: null,
      quickStart: { icon: "📡", steps: ["Acesse 'Sinais' para monitorar alertas regulatórios e comerciais", "Filtre por urgência (Crítico, Alto, Médio) para priorizar atenção", "Use 'Criar lead' em sinais críticos para abrir oportunidades direto no pipeline"] } },
    { id: "v-g6", title: "Relatório histórico do funil", description: "Histórico do funil", duration: null, url: null,
      quickStart: { icon: "📈", steps: ["Acesse 'Histórico do funil' em Inteligência", "Cada célula mostra quantos dias um cliente esteve naquela etapa", "Cores mais intensas = mais tempo parado — identifique gargalos do processo"] } },
  ],
};
VIDEO_TUTORIALS.admin = VIDEO_TUTORIALS.gerente;

export const FAQ_ITEMS = [
  {
    question: "Como faço para redefinir minha senha?",
    answer: "Acesse Configurações → Meu perfil → seção Alterar senha. Em modo Supabase, você também pode usar o e-mail de recuperação na tela de login.",
  },
  {
    question: "Posso ver leads de outros vendedores?",
    answer: "Gerentes e administradores visualizam todos os leads. Vendedores veem os próprios leads e de seus subordinados. Consultores veem apenas os leads atribuídos a eles.",
  },
  {
    question: "Como adiciono um novo membro à equipe?",
    answer: "Vá em Usuários (menu lateral) → clique em Convidar → informe o e-mail e defina o papel. O convite chega por e-mail com link de acesso.",
  },
  {
    question: "O que são os Sinais de Mercado?",
    answer: "São alertas automáticos sobre publicações regulatórias (IBAMA, ANTT, Inmetro), licitações, mudanças de norma e oportunidades de mercado relevantes para cada unidade do grupo.",
  },
  {
    question: "Como configuro as etapas do pipeline?",
    answer: "Acesse Construtor de Pipeline no menu lateral (disponível para gerentes e admins). Lá você cria, edita e reordena as etapas de cada unidade.",
  },
  {
    question: "Os dados ficam salvos se eu fechar o navegador?",
    answer: "Sim. Com Supabase configurado, tudo é salvo em nuvem em tempo real. Em modo offline, os dados ficam em localStorage do navegador.",
  },
  {
    question: "O que são automações e quem pode criar?",
    answer: "Automações são regras que executam ações sem intervenção manual — mover um lead de etapa, disparar uma notificação, atribuir responsável. Apenas Gerentes e Administradores podem criar e editar automações.",
  },
  {
    question: "Como a IA do CRM funciona?",
    answer: "O CRM tem um assistente de IA integrado acessível pelo botão 'Perguntar à IA' na tela de Negócios. Ele lê o pipeline em tempo real e responde perguntas em linguagem natural sobre leads, etapas, desempenho e estratégias comerciais.",
  },
  {
    question: "Posso importar minha planilha de leads?",
    answer: "Sim. No Explorador de leads, clique em 'Importar planilha'. São aceitos arquivos CSV e Excel (.xlsx). O sistema mapeia as colunas automaticamente e deduplica por CNPJ.",
  },
];

export const AUTOMATION_GUIDE = {
  intro: "Automações permitem que o CRM execute ações repetitivas automaticamente — sem que nenhum vendedor precise lembrar de fazer isso manualmente. São configuradas por Gerentes e Admins em Menu → Automações.",
  steps: [
    {
      number: 1,
      title: "Acesse Automações",
      description: "No menu lateral, clique em Automações. Você verá as regras ativas e poderá criar novas.",
    },
    {
      number: 2,
      title: "Escolha um gatilho (Trigger)",
      description: "O gatilho define quando a automação dispara. Exemplos: 'Lead ficou X dias sem atividade', 'Lead entrou em etapa Y', 'Lead foi criado com valor acima de R$ Z'.",
    },
    {
      number: 3,
      title: "Defina condições (filtros opcionais)",
      description: "Refine quando a regra se aplica. Exemplo: só para leads da unidade Resibag, ou apenas leads com valor acima de R$ 50.000, ou de um setor específico.",
    },
    {
      number: 4,
      title: "Configure a ação",
      description: "O que acontece quando o gatilho dispara: mover para outra etapa, enviar notificação, atribuir a outro responsável, ou marcar como perdido.",
    },
    {
      number: 5,
      title: "Ative e monitore",
      description: "Salve a automação como ativa. Acompanhe o histórico de execuções para garantir que está funcionando como esperado.",
    },
  ],
  recipes: [
    {
      id: "r1",
      emoji: "⏰",
      title: "Reativar lead inativo",
      trigger: "Lead sem atividade por 14 dias",
      condition: "Etapa não é Ganho nem Perdido",
      action: "Mover para 'Renegociação' e notificar responsável",
      difficulty: "Fácil",
      difficultyColor: "#16A34A",
    },
    {
      id: "r2",
      emoji: "🔔",
      title: "Alerta de lead de alto valor",
      trigger: "Lead entra na etapa Proposta",
      condition: "Valor estimado acima de R$ 100.000",
      action: "Notificar Gerente imediatamente",
      difficulty: "Fácil",
      difficultyColor: "#16A34A",
    },
    {
      id: "r3",
      emoji: "📋",
      title: "Atribuição automática de leads",
      trigger: "Novo lead criado via Explorador ou Importação",
      condition: "Sem responsável definido",
      action: "Distribuir em rodízio entre vendedores da unidade",
      difficulty: "Médio",
      difficultyColor: "#E8920A",
    },
    {
      id: "r4",
      emoji: "📅",
      title: "Follow-up após proposta enviada",
      trigger: "Lead entra na etapa Proposta Enviada",
      condition: "Nenhuma atividade nos próximos 5 dias",
      action: "Notificar vendedor para fazer follow-up",
      difficulty: "Médio",
      difficultyColor: "#E8920A",
    },
    {
      id: "r5",
      emoji: "🏆",
      title: "Celebrar vitória",
      trigger: "Lead movido para Ganho",
      condition: "Qualquer lead",
      action: "Notificar toda a equipe da unidade com valor do negócio",
      difficulty: "Fácil",
      difficultyColor: "#16A34A",
    },
    {
      id: "r6",
      emoji: "🔁",
      title: "Reengajamento de perdidos",
      trigger: "Lead está em Perdido há 90 dias",
      condition: "Motivo não é 'Concorrente ganhou (definitivo)'",
      action: "Criar alerta para gerente revisar e considerar reabrir",
      difficulty: "Avançado",
      difficultyColor: "#C7212B",
    },
  ],
};

export const AI_PROMPTS = [
  {
    category: "Análise do pipeline",
    icon: "📊",
    color: "#6366F1",
    bgColor: "#EEF2FF",
    prompts: [
      "Quais leads estão parados há mais de 15 dias sem nenhuma atividade registrada?",
      "Qual vendedor fechou mais negócios este mês? Qual o valor total?",
      "Qual setor tem a maior taxa de conversão no pipeline atual?",
      "Quantos leads estão em cada etapa do funil agora? Mostre um resumo.",
      "Quais leads têm maior probabilidade de fechar nos próximos 30 dias?",
      "Qual é o valor total do pipeline em aberto neste momento?",
    ],
  },
  {
    category: "Estratégia comercial",
    icon: "🎯",
    color: "#C7212B",
    bgColor: "#FBE9EB",
    prompts: [
      "Como responder à objeção 'não temos orçamento agora' sem perder o lead?",
      "Qual a melhor estratégia para renegociar com um lead que entrou em Perdido?",
      "Que argumentos usar para acelerar a decisão de um lead que está há 3 meses em Proposta?",
      "Como priorizar meu pipeline quando tenho 30 leads ativos ao mesmo tempo?",
      "Sugira uma abordagem consultiva para empresas que nunca usaram um CRM antes.",
      "Qual o momento ideal para fazer o follow-up após enviar uma proposta?",
    ],
  },
  {
    category: "Prospecção e qualificação",
    icon: "🔍",
    color: "#0891B2",
    bgColor: "#E0F7FA",
    prompts: [
      "Sugira 5 perguntas de qualificação para leads do setor de logística e transporte.",
      "Qual o perfil ideal de cliente (ICP) para serviços de conformidade ambiental?",
      "Como identificar se um lead tem potencial real ou está apenas 'curioso'?",
      "Quais sinais indicam que um lead está pronto para receber uma proposta formal?",
      "Como abordar empresas do setor industrial que nunca contrataram consultoria?",
      "Que informações devo levantar sobre um lead antes da primeira reunião?",
    ],
  },
  {
    category: "Redigir e-mails",
    icon: "✉️",
    color: "#059669",
    bgColor: "#ECFDF5",
    prompts: [
      "Escreva um e-mail de follow-up para o lead [empresa] após 10 dias sem resposta.",
      "Monte um e-mail de apresentação inicial para uma empresa do setor de resíduos.",
      "Escreva um e-mail de proposta para o lead [empresa] com foco em redução de riscos regulatórios.",
      "Crie um e-mail de reengajamento para um lead que ficou frio há 2 meses.",
      "Como redigir um e-mail para marcar uma reunião de diagnóstico sem parecer invasivo?",
      "Escreva um e-mail de agradecimento pós-reunião que reforce os pontos discutidos.",
    ],
  },
  {
    category: "Relatórios e performance",
    icon: "📈",
    color: "#7C3AED",
    bgColor: "#F3E8FF",
    prompts: [
      "Resuma o pipeline atual: quantos leads, valor total e etapas mais críticas.",
      "Compare a performance de cada vendedor: leads abertos, fechados e ticket médio.",
      "Quais leads foram perdidos este mês? Qual o motivo mais comum?",
      "Mostre a evolução do pipeline nos últimos 30 dias — quantos leads avançaram de etapa.",
      "Qual é o tempo médio que um lead fica em cada etapa do funil?",
      "Identifique gargalos no funil: onde os leads estão travando com mais frequência.",
    ],
  },
  {
    category: "Automações e configurações",
    icon: "⚙️",
    color: "#B45309",
    bgColor: "#FEF3C7",
    prompts: [
      "Que automações devo criar para uma equipe de 5 vendedores com 100 leads ativos?",
      "Como configurar o pipeline para uma empresa do setor de transporte de cargas?",
      "Qual a diferença entre um lead 'Proposta' e 'Proposta Enviada' no funil?",
      "Como usar os Sinais de Mercado para gerar novos leads qualificados?",
      "Explique como funciona o sistema de pontuação (fit score) dos leads.",
      "Quais campos devo personalizar no formulário de leads para o setor de resíduos industriais?",
    ],
  },
];
