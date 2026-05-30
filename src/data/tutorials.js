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
    { id: "v-c1", title: "Visão geral do CRM", description: "Tour pela plataforma e principais telas disponíveis para consultores.", duration: null, url: null },
    { id: "v-c2", title: "Visualizando e filtrando leads", description: "Como usar o Kanban, filtros de etapa e visão de calendário.", duration: null, url: null },
    { id: "v-c3", title: "Preenchendo um lead", description: "Campos, arquivos, comentários e histórico de interações.", duration: null, url: null },
    { id: "v-c4", title: "Follow-up pelo calendário", description: "Planejando acompanhamentos com a visão de datas.", duration: null, url: null },
  ],
  vendedor: [
    { id: "v-v1", title: "Visão geral do pipeline", description: "Como o funil de vendas está organizado e como navegar por ele.", duration: null, url: null },
    { id: "v-v2", title: "Criando e editando leads", description: "Passo a passo para abrir um novo negócio e preencher todas as informações.", duration: null, url: null },
    { id: "v-v3", title: "Movendo leads no Kanban", description: "Arrastar cards, alterar etapas e registrar progressos.", duration: null, url: null },
    { id: "v-v4", title: "Calendário de follow-up", description: "Organizando seus acompanhamentos por data e vencimento.", duration: null, url: null },
    { id: "v-v5", title: "Transformando sinais em leads", description: "Como usar alertas de mercado para abrir novas oportunidades.", duration: null, url: null },
  ],
  gerente: [
    { id: "v-g1", title: "Gestão de equipe e convites", description: "Convidar usuários, definir papéis e associar às unidades.", duration: null, url: null },
    { id: "v-g2", title: "Configurando o pipeline", description: "Criar etapas, definir probabilidades e personalizar o funil.", duration: null, url: null },
    { id: "v-g3", title: "Criando automações", description: "Regras de movimentação automática, alertas e atribuições.", duration: null, url: null },
    { id: "v-g4", title: "Painel executivo", description: "Lendo KPIs, funil de conversão e performance por vendedor.", duration: null, url: null },
    { id: "v-g5", title: "Sinais de mercado para gestores", description: "Usando sinais para direcionar a equipe a novas oportunidades.", duration: null, url: null },
    { id: "v-g6", title: "Relatório histórico do funil", description: "Analisando evolução do pipeline ao longo do tempo.", duration: null, url: null },
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
];
