// Conteúdo de "Ajuda & Tutoriais" (src/components/views/TutoriaisView.jsx).
//
// Cada item de VIDEO_TUTORIALS tem `routeId` — precisa ser uma chave real de
// `src/constants/routes.js`, é o que TutoriaisView usa pra montar o botão
// "Ir para X" (antes derivava do texto de `description` em português, que
// nunca batia com uma chave de rota — nenhum dos 30 botões funcionava).
//
// Regra de manutenção (CLAUDE.md): toda vez que uma tela for criada ou
// renomeada, atualize o guia correspondente aqui (ou crie um novo) e use o
// trailer `Changelog:` no commit — ver seção "Ajuda & Tutoriais" do CLAUDE.md.

import { ROUTES } from "../constants/routes";

// Guias compartilhados entre papéis que pousam nas mesmas telas — evita
// repetir o mesmo texto em cada bucket de VIDEO_TUTORIALS (regra 4 do
// CLAUDE.md: 3ª ocorrência da mesma coisa vira algo reaproveitável).

const MINHAS_TAREFAS_GUIDE = {
  id: "v-mt1", title: "Minhas Tarefas — sua fila do dia", description: "Minhas Tarefas", routeId: "dashboard", duration: null, url: null,
  quickStart: { icon: "📥", steps: [
    "É a tela que abre assim que você faz login — reúne numa fila só tudo que precisa da sua atenção, de qualquer módulo (leads parados, aprovações, tarefas de RH)",
    "Os itens vêm ordenados por urgência, não por data de criação — o mais atrasado ou mais crítico aparece primeiro",
    "Quando a lista passa de 5 itens, clique em '+X mais' para ver a fila completa",
  ] },
};

const ONBOARDING_COLABORADOR_GUIDE = {
  id: "v-ob1", title: "Seu checklist de Onboarding", description: "Onboarding", routeId: "rh-onboarding", duration: null, url: null,
  quickStart: { icon: "✅", steps: [
    "Assim que você entra na empresa, sua trilha de onboarding aparece aqui com a lista de tarefas atribuídas",
    "Marque cada tarefa como concluída conforme for cumprindo — o percentual no topo acompanha seu progresso",
    "Quando sua trilha chega à etapa final, o item some sozinho do menu 'Meu Desenvolvimento' — não precisa fazer nada",
  ] },
};

const TREINAMENTOS_COLABORADOR_GUIDE = {
  id: "v-tr1", title: "Seus treinamentos atribuídos", description: "Treinamentos", routeId: "rh-treinamentos", duration: null, url: null,
  quickStart: { icon: "🎓", steps: [
    "Aqui aparecem só os treinamentos atribuídos a você — marque o quadrado ao concluir cada um",
    "Treinamento vencido pede revalidação: clique para reabrir e refazer",
    "Para desmarcar um treinamento concluído por engano, fale com o RH — o colaborador só marca, nunca desmarca",
  ] },
};

const AVALIACAO_COLABORADOR_GUIDE = {
  id: "v-av1", title: "Sua autoavaliação de desempenho", description: "Avaliação de Desempenho", routeId: "rh-feedback", duration: null, url: null,
  quickStart: { icon: "🌟", steps: [
    "Quando um ciclo de avaliação abre pra você, aparece o botão 'Preencher autoavaliação'",
    "Dê sua nota de 0 a 10 e envie — ela fica registrada lado a lado com a nota do seu gestor",
    "Depois que o gestor também avalia, o ciclo fecha e o histórico completo fica disponível pra consulta",
  ] },
};

export const VIDEO_TUTORIALS = {
  consultor: [
    { id: "v-c1", title: "Visão geral do Funil de Vendas", description: "Funil de Vendas", routeId: "crm", duration: null, url: null,
      quickStart: { icon: "🗺️", steps: ["Acesse 'Funil de Vendas' no menu lateral para ver o pipeline", "Use o Kanban para acompanhar leads por etapa", "Clique em qualquer card para ver detalhes e histórico"] } },
    { id: "v-c2", title: "Visualizando e filtrando leads", description: "Funil de Vendas", routeId: "crm", duration: null, url: null,
      quickStart: { icon: "🔍", steps: ["No Kanban, use os filtros no topo para filtrar por vendedor", "Alterne entre Kanban e Calendário pelo seletor no topo direito", "Clique numa coluna para ver os leads de uma etapa específica"] } },
    { id: "v-c3", title: "Preenchendo um lead", description: "Funil de Vendas", routeId: "crm", duration: null, url: null,
      quickStart: { icon: "✏️", steps: ["Clique em qualquer card para abrir o painel de detalhes", "Edite campos diretamente: valor, setor, responsável, data de fechamento", "Use a seção 'Notas' para registrar interações e próximos passos"] } },
    { id: "v-c4", title: "Follow-up pelo calendário", description: "Funil de Vendas", routeId: "crm", duration: null, url: null,
      quickStart: { icon: "📅", steps: ["Alterne para a visão 'Calendário' no topo da tela do Funil de Vendas", "Cada card aparece na data de fechamento esperada", "Leads com data vencida aparecem em vermelho — priorize-os"] } },
    MINHAS_TAREFAS_GUIDE,
    ONBOARDING_COLABORADOR_GUIDE,
    TREINAMENTOS_COLABORADOR_GUIDE,
    AVALIACAO_COLABORADOR_GUIDE,
  ],
  vendedor: [
    { id: "v-v1", title: "Visão geral do pipeline", description: "Funil de Vendas", routeId: "crm", duration: null, url: null,
      quickStart: { icon: "🗂️", steps: ["Acesse 'Funil de Vendas' — cada coluna é uma etapa do funil de vendas", "Arraste cards entre colunas para avançar um negócio de etapa", "O número no topo de cada coluna mostra o total e o valor em aberto"] } },
    { id: "v-v2", title: "Criando e editando leads", description: "Funil de Vendas", routeId: "crm", duration: null, url: null,
      quickStart: { icon: "➕", steps: ["Clique no botão 'Nova oportunidade' (canto inferior esquerdo do Kanban) para abrir um card", "Preencha nome da empresa, setor, valor estimado e responsável", "Clique no card a qualquer momento para editar, adicionar notas e arquivos"] } },
    { id: "v-v3", title: "Movendo leads no Kanban", description: "Funil de Vendas", routeId: "crm", duration: null, url: null,
      quickStart: { icon: "↔️", steps: ["Arraste um card para outra coluna para mudar a etapa", "Ou use o menu ⋮ no card e escolha 'Mover para →'", "O histórico de movimentações fica registrado no painel do lead"] } },
    { id: "v-v4", title: "Calendário de follow-up", description: "Funil de Vendas", routeId: "crm", duration: null, url: null,
      quickStart: { icon: "📅", steps: ["Alterne para 'Calendário' no seletor de visão", "Leads aparecem na data de fechamento prevista", "Cards vermelhos indicam atraso — priorize esses contatos"] } },
    { id: "v-v5", title: "Transformando sinais em leads", description: "Sinais", routeId: "signals", duration: null, url: null,
      quickStart: { icon: "📡", steps: ["Acesse 'Sinais' no menu lateral para ver alertas regulatórios e de mercado", "Clique em 'Criar lead a partir deste sinal' em qualquer card de sinal", "Digite o nome da empresa afetada e confirme — o lead vai direto ao Kanban"] } },
    MINHAS_TAREFAS_GUIDE,
    ONBOARDING_COLABORADOR_GUIDE,
    TREINAMENTOS_COLABORADOR_GUIDE,
    AVALIACAO_COLABORADOR_GUIDE,
  ],
  // Conteúdo de gestão — não inclui os guias pessoais (Minhas Tarefas,
  // Onboarding etc.) porque `admin` também usa este array (ver alias logo
  // abaixo) e admin não vê o grupo "Meu Desenvolvimento" no menu (conta como
  // usuário de RH pra fins de navegação, App.jsx `isRHUser`). O snapshot pra
  // `admin` acontece ANTES de "Minhas Tarefas" ser adicionado só ao gerente
  // — ver comentário junto do alias.
  gerente: [
    { id: "v-g1", title: "Gestão de equipe e convites", description: "Configurações", routeId: "users", duration: null, url: null,
      quickStart: { icon: "👥", steps: ["A gestão de usuários mudou de lugar: acesse 'Configurações' → aba 'Usuários'", "Clique em 'Convidar', informe o e-mail e defina o papel (Vendedor, Consultor, Gerente, Admin, Marketing, RH…)", "Associe cada usuário à unidade correta (Sanwey, Resibag, Monte Mor)"] } },
    { id: "v-g2", title: "Editando as etapas do Funil de Vendas", description: "Funil de Vendas", routeId: "pipeline-builder", duration: null, url: null,
      quickStart: { icon: "⚙️", steps: ["O 'Construtor de pipeline' virou o botão 'Editar etapas', dentro do próprio Kanban do Funil de Vendas", "Arraste etapas para reordenar; clique para renomear, definir probabilidade e SLA", "Use a matriz de transições para controlar quais movimentos entre etapas são permitidos"] } },
    { id: "v-g3", title: "Criando automações", description: "Automações", routeId: "automations", duration: null, url: null,
      quickStart: { icon: "⚡", steps: ["Acesse 'Automações' → 'Nova automação' ou escolha um template pronto", "Defina o gatilho (ex: tempo parado numa etapa) e a ação (ex: notificar, mover, adicionar badge)", "Ative a automação e monitore o histórico de execuções"] } },
    { id: "v-g4", title: "Painel executivo", description: "Executivo", routeId: "executive", duration: null, url: null,
      quickStart: { icon: "📊", steps: ["Acesse 'Executivo' para ver KPIs consolidados do Grupo", "Use os filtros de período (30d, 90d, Este Ano) para comparar janelas", "A aba 'IA' gera análises e forecasts automáticos do pipeline"] } },
    { id: "v-g5", title: "Sinais de mercado para gestores", description: "Sinais", routeId: "signals", duration: null, url: null,
      quickStart: { icon: "📡", steps: ["Acesse 'Sinais' para monitorar alertas regulatórios e comerciais", "Filtre por urgência (Crítico, Alto, Médio) para priorizar atenção", "Use 'Criar lead' em sinais críticos para abrir oportunidades direto no pipeline"] } },
    { id: "v-g6", title: "Histórico do funil", description: "Executivo", routeId: "funnel-history", duration: null, url: null,
      quickStart: { icon: "📈", steps: ["O 'Histórico do funil' virou uma aba dentro do Executivo — acesse por lá", "Cada célula mostra quantos dias um cliente esteve naquela etapa", "Cores mais intensas = mais tempo parado — identifique gargalos do processo"] } },
  ],
};
// `admin` também acessa RH (App.jsx `isRHUser` inclui admin) — por isso não
// vê o grupo "Meu Desenvolvimento" e não deve herdar os guias pessoais que o
// `gerente` ganha logo abaixo. Snapshot ANTES dessa adição.
VIDEO_TUTORIALS.admin = [...VIDEO_TUTORIALS.gerente, MINHAS_TAREFAS_GUIDE];
// `gerente` (diferente de admin) não é usuário de RH — pousa em Minhas
// Tarefas e vê "Meu Desenvolvimento" no menu como qualquer colaborador.
VIDEO_TUTORIALS.gerente = [
  ...VIDEO_TUTORIALS.gerente,
  MINHAS_TAREFAS_GUIDE, ONBOARDING_COLABORADOR_GUIDE, TREINAMENTOS_COLABORADOR_GUIDE, AVALIACAO_COLABORADOR_GUIDE,
];

VIDEO_TUTORIALS.marketing = [
  { id: "v-mkt1", title: "Visão geral do módulo de Marketing", description: "Campanhas", routeId: "marketing", duration: null, url: null,
    quickStart: { icon: "📣", steps: ["Acesse 'Campanhas' no menu lateral para ver o Kanban de marketing", "Cada coluna representa uma etapa: Briefing → Aprovação → Produção → Ao Vivo", "Clique em qualquer card para abrir os detalhes da campanha"] } },
  { id: "v-mkt2", title: "Criando uma campanha", description: "Campanhas", routeId: "marketing", duration: null, url: null,
    quickStart: { icon: "➕", steps: ["Clique no '+' dentro de qualquer coluna para criar uma campanha na etapa", "Preencha nome, canal (Email/Social/Digital…), KPI e budget", "Defina a data de lançamento e o responsável — o card aparece no Kanban imediatamente"] } },
  { id: "v-mkt3", title: "Gerenciando entregas da campanha", description: "Entregas", routeId: "marketing-entregas", duration: null, url: null,
    quickStart: { icon: "📦", steps: ["Acesse 'Entregas' no menu lateral para ver todas as demandas de produção", "Crie entregas vinculadas a uma campanha pela aba 'Entregas' no drawer da campanha", "Use prioridade (Baixa/Média/Alta) e prazo para organizar a fila de produção"] } },
  { id: "v-mkt4", title: "Controlando despesas de marketing", description: "Despesas", routeId: "marketing-despesas", duration: null, url: null,
    quickStart: { icon: "💰", steps: ["Acesse 'Despesas' no menu lateral para registrar gastos por campanha", "Cada despesa tem categoria (Mídia Paga, Produção, Agência…) e valor", "O painel de totais mostra o budget consumido vs. disponível por campanha"] } },
  { id: "v-mkt5", title: "Aba Criativo e checklist de aprovação", description: "Campanhas", routeId: "marketing", duration: null, url: null,
    quickStart: { icon: "✅", steps: ["Abra uma campanha e acesse a aba 'Criativo' no painel lateral", "Marque cada item do checklist de aprovação conforme for revisado", "A agência pode visualizar os itens marcados em tempo real"] } },
  MINHAS_TAREFAS_GUIDE, ONBOARDING_COLABORADOR_GUIDE, TREINAMENTOS_COLABORADOR_GUIDE, AVALIACAO_COLABORADOR_GUIDE,
];

VIDEO_TUTORIALS.gerente_marketing = [
  ...VIDEO_TUTORIALS.marketing,
  { id: "v-gm1", title: "Dashboard de Marketing", description: "Visão Geral", routeId: "marketing-home", duration: null, url: null,
    quickStart: { icon: "📊", steps: ["Acesse 'Visão Geral' em Marketing para ver KPIs consolidados", "Acompanhe campanhas ativas, orçamento total e performance média", "Use o calendário para visualizar campanhas por data de lançamento"] } },
  { id: "v-gm2", title: "Automações de Marketing", description: "Automações", routeId: "automations", duration: null, url: null,
    quickStart: { icon: "⚡", steps: ["Acesse 'Automações' para criar regras específicas do módulo de Marketing", "Ative templates prontos: 'Campanha ao vivo' notifica a equipe automaticamente", "Defina alertas de SLA para campanhas paradas em Produção por mais de 10 dias"] } },
];

// Agência não pousa em Minhas Tarefas (vai direto pra Campanhas — nav
// própria, restrita a 2 itens) e não tem grupo "Meu Desenvolvimento" —
// por isso não ganha os guias pessoais.
VIDEO_TUTORIALS.agencia = [
  { id: "v-ag1", title: "Acesso da agência às campanhas", description: "Campanhas", routeId: "marketing", duration: null, url: null,
    quickStart: { icon: "🏢", steps: ["Você vê apenas as campanhas em que a sua agência está envolvida", "Clique em qualquer campanha para abrir o painel de detalhes", "Seus dados são somente leitura — exceto o checklist de aprovação e uploads de arquivos"] } },
  { id: "v-ag2", title: "Enviando arquivos e comprovantes", description: "Campanhas", routeId: "marketing", duration: null, url: null,
    quickStart: { icon: "📎", steps: ["Abra uma campanha e acesse a aba 'Arquivos' no painel lateral", "Arraste ou clique para fazer upload de criativos, relatórios e comprovantes", "Os arquivos ficam vinculados à campanha e visíveis para toda a equipe Sanwey"] } },
  { id: "v-ag3", title: "Checklist de aprovação", description: "Campanhas", routeId: "marketing", duration: null, url: null,
    quickStart: { icon: "✅", steps: ["Na aba 'Criativo', você pode marcar itens do checklist como comprovados", "Use isso para indicar que a agência entregou cada requisito da campanha", "A equipe interna recebe notificação quando itens são marcados"] } },
];

// RH/gerente_rh são isRHUser (App.jsx) — não veem "Meu Desenvolvimento" (têm
// o Kanban completo de Onboarding/Treinamentos/Avaliação como gestores, não
// o checklist pessoal), mas pousam em Minhas Tarefas como qualquer papel
// interno — por isso ganham só esse guia compartilhado, não os 3 pessoais.
VIDEO_TUTORIALS.rh = [
  { id: "v-rh1", title: "Visão geral do RH", description: "Visão Geral", routeId: "rh-overview", duration: null, url: null,
    quickStart: { icon: "👥", steps: ["Acesse 'Visão Geral' para ver o painel com funcionários, férias pendentes e vagas em aberto", "Os cards de KPI mostram ativos, de férias e afastados em tempo real", "Clique em 'Ver todas' em cada seção para ir ao módulo correspondente"] } },
  { id: "v-rh2", title: "Gerenciando funcionários", description: "Funcionários", routeId: "rh-funcionarios", duration: null, url: null,
    quickStart: { icon: "🧑‍💼", steps: ["Acesse 'Funcionários' para ver o cadastro completo da equipe", "Clique num funcionário para editar dados: cargo, departamento, data de admissão", "Use os filtros (Departamento, Status, Tipo de contrato) para encontrar rapidamente"] } },
  { id: "v-rh3", title: "Processo de recrutamento", description: "Recrutamento", routeId: "rh-recrutamento", duration: null, url: null,
    quickStart: { icon: "💼", steps: ["Acesse 'Recrutamento' para ver vagas abertas e candidatos no Kanban", "Crie vagas com cargo, departamento e requisitos; candidatos entram em 'Triagem'", "Arraste candidatos pelo pipeline: Triagem → Entrevista RH → Aprovado"] } },
  { id: "v-rh4", title: "Solicitações de férias", description: "Férias & Licenças", routeId: "rh-ferias", duration: null, url: null,
    quickStart: { icon: "🏖️", steps: ["Acesse 'Férias & Licenças' para ver as solicitações pendentes", "Aprovadores: clique em 'Aprovar' ou 'Rejeitar' — o funcionário recebe e-mail automaticamente", "Visualize o calendário de ausências para checar conflitos de equipe"] } },
  MINHAS_TAREFAS_GUIDE,
];

VIDEO_TUTORIALS.gerente_rh = [
  ...VIDEO_TUTORIALS.rh,
  { id: "v-grh1", title: "Conversão candidato → funcionário", description: "Recrutamento", routeId: "rh-recrutamento", duration: null, url: null,
    quickStart: { icon: "🎉", steps: ["Quando um candidato chega em 'Aprovado', aparece o botão 'Converter'", "Clique em 'Converter' — você é levado para Funcionários com um banner de boas-vindas", "Use 'Enviar convite' para criar o acesso ao sistema para o novo funcionário"] } },
  { id: "v-grh2", title: "Aprovação de férias em lote", description: "Férias & Licenças", routeId: "rh-ferias", duration: null, url: null,
    quickStart: { icon: "✅", steps: ["Acesse 'Férias & Licenças' e filtre por 'Pendente' para ver as aprovações em aberto", "Clique em cada solicitação para ver o período e checar o calendário de ausências", "Após aprovar/rejeitar, o sistema envia e-mail automático ao funcionário"] } },
  { id: "v-grh3", title: "Agentes de IA — sugestões com aprovação humana", description: "Automações", routeId: "automations", duration: null, url: null,
    quickStart: { icon: "🤖", steps: ["Em 'Automações', a aba 'Agentes de IA' mostra os agentes ativos — o piloto hoje cobre Fornecedores de RH", "Um agente observa um gatilho (ex: contrato perto de vencer) e prepara um rascunho — nunca envia nada sozinho", "Toda sugestão vira um card 'pendente' em 'Agentes de IA' (menu), pra aprovar, editar ou rejeitar"] } },
];

// Comex é o módulo mais novo sem tutorial nenhum — e, sem bucket próprio, o
// papel `comex` caía no fallback de vendedor (removido — ver
// TutoriaisView.jsx), recebendo instrução pra telas que nem tem no menu
// ("Negócios", "Sinais"). Comex pousa em Minhas Tarefas e vê "Meu
// Desenvolvimento" como qualquer papel interno não-RH — por isso ganha os 4
// guias compartilhados também, não só o específico do módulo.
VIDEO_TUTORIALS.comex = [
  { id: "v-cx1", title: "Operações de Importação e Exportação", description: "Comex", routeId: "comex", duration: null, url: null,
    quickStart: { icon: "🚢", steps: ["Acesse 'Comex' e alterne entre os quadros de Importação e Exportação no topo", "Importação tem calculadora de Landed Cost total; Exportação registra os dados de venda em FOB", "Arraste o card entre as etapas conforme a operação avança, igual aos outros quadros da plataforma"] } },
  MINHAS_TAREFAS_GUIDE, ONBOARDING_COLABORADOR_GUIDE, TREINAMENTOS_COLABORADOR_GUIDE, AVALIACAO_COLABORADOR_GUIDE,
];

export const FAQ_ITEMS = [
  {
    question: "Como faço para redefinir minha senha?",
    answer: "Acesse Configurações → aba Perfil → seção Alterar senha. Em modo Supabase, você também pode usar o e-mail de recuperação na tela de login.",
  },
  {
    question: "Posso ver leads de outros vendedores?",
    answer: "Gerentes e administradores visualizam todos os leads. Vendedores veem os próprios leads e de seus subordinados. Consultores veem apenas os leads atribuídos a eles.",
  },
  {
    question: "Como adiciono um novo membro à equipe?",
    answer: "Acesse Configurações → aba Usuários → clique em Convidar → informe o e-mail e defina o papel. O convite chega por e-mail com link de acesso.",
  },
  {
    question: "O que são os Sinais de Mercado?",
    answer: "São alertas automáticos sobre publicações regulatórias (IBAMA, ANTT, Inmetro), licitações, mudanças de norma e oportunidades de mercado relevantes para cada unidade do grupo.",
  },
  {
    question: "Como configuro as etapas do Funil de Vendas?",
    answer: "Dentro do Kanban do Funil de Vendas, clique em Editar etapas (disponível para gerentes e admins). Lá você cria, edita e reordena as etapas de cada unidade.",
  },
  {
    question: "Os dados ficam salvos se eu fechar o navegador?",
    answer: "Sim. Com Supabase configurado, tudo é salvo em nuvem em tempo real. Em modo offline, os dados ficam em localStorage do navegador.",
  },
  {
    question: "O que são automações e quem pode criar?",
    answer: "Automações são regras que executam ações sem intervenção manual — mover um card de etapa, alterar um campo, notificar, adicionar badge. Gerentes, Administradores e Gerentes de RH (no módulo de RH) podem criar e editar automações.",
  },
  {
    question: "Como a IA do CRM funciona?",
    answer: "O CRM tem um assistente de IA integrado acessível pelo botão 'Perguntar à IA' na tela do Funil de Vendas. Ele lê o pipeline em tempo real e responde perguntas em linguagem natural sobre leads, etapas, desempenho e estratégias comerciais.",
  },
  {
    question: "Posso importar minha planilha de leads?",
    answer: "Sim. No Explorador de leads, clique em 'Importar planilha'. São aceitos arquivos CSV e Excel (.xlsx). O sistema mapeia as colunas automaticamente e deduplica por CNPJ.",
  },
];

export const AUTOMATION_GUIDE = {
  intro: "Automações permitem que a plataforma execute ações repetitivas automaticamente — sem que ninguém precise lembrar de fazer isso manualmente. São configuradas em Menu → Automações.",
  steps: [
    {
      number: 1,
      title: "Acesse Automações",
      description: "No menu lateral, clique em Automações. Você verá as regras ativas e poderá criar novas.",
    },
    {
      number: 2,
      title: "Escolha um gatilho (Trigger)",
      description: "O gatilho define quando a automação dispara. Tipos disponíveis: mudança de etapa, valor de campo, tempo parado numa etapa, campo obrigatório pendente há X dias, ou card recém-criado.",
    },
    {
      number: 3,
      title: "Defina condições (filtros opcionais)",
      description: "Refine quando a regra se aplica. Exemplo: só para leads da unidade Resibag, ou apenas leads com valor acima de R$ 50.000, ou de um setor específico.",
    },
    {
      number: 4,
      title: "Configure a ação",
      description: "O que acontece quando o gatilho dispara: mover para outra etapa, alterar um campo, adicionar uma badge visual, notificar, criar uma entrega em Marketing, ou enriquecer automaticamente com dados de CNPJ.",
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
      emoji: "🚨",
      title: "Lead parado em Negociação",
      trigger: "Card fica mais de 7 dias em Negociação sem avançar",
      condition: "Etapa não é Ganho nem Perdido",
      action: "Notificar o responsável",
      difficulty: "Fácil",
      difficultyColor: "#16A34A",
    },
    {
      id: "r2",
      emoji: "📈",
      title: "Sobe prioridade ao entrar em Negociação",
      trigger: "Card muda para a etapa Negociação",
      condition: null,
      action: "Altera o campo Urgência para 'Alto'",
      difficulty: "Fácil",
      difficultyColor: "#16A34A",
    },
    {
      id: "r3",
      emoji: "💰",
      title: "Badge VIP em lead de alto valor",
      trigger: "Valor do card passa de R$ 50.000",
      condition: null,
      action: "Adiciona a badge 'VIP'",
      difficulty: "Fácil",
      difficultyColor: "#16A34A",
    },
    {
      id: "r4",
      emoji: "🤝",
      title: "Onboarding automático ao ganhar negócio",
      trigger: "Card é movido para Ganho",
      condition: null,
      action: "Cria automaticamente uma entrega de onboarding em Marketing",
      difficulty: "Médio",
      difficultyColor: "#E8920A",
    },
    {
      id: "r5",
      emoji: "📋",
      title: "Cobrar campo obrigatório pendente",
      trigger: "Card fica 3 dias na etapa com um campo obrigatório vazio",
      condition: null,
      action: "Notifica pra completar antes de seguir",
      difficulty: "Médio",
      difficultyColor: "#E8920A",
    },
    {
      id: "r6",
      emoji: "🏢",
      title: "Enriquecer lead novo com CNPJ",
      trigger: "Card é criado",
      condition: null,
      action: "Busca automaticamente setor, cidade e estado pelo CNPJ",
      difficulty: "Fácil",
      difficultyColor: "#16A34A",
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
