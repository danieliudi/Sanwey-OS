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
    { id: "v-c5", title: "Usando o Chat interno", description: "Chat", duration: null, url: null,
      quickStart: { icon: "💬", steps: ["Clique em 'Chat' no menu lateral para ver canais da sua equipe e abrir conversas diretas — quem você pode chamar no privado segue a estrutura da empresa (seu setor, seu gestor ou quem responde a você)", "No campo de mensagem, use o ícone de carinha para abrir a paleta de emoji, ou o ícone de figurinha para mandar uma do pacote da empresa", "O ícone de clipe anexa um arquivo ou imagem — ele vira uma prévia antes de enviar, com um 'x' para remover se mudar de ideia", "Mensagens com linguagem imprópria não são enviadas — aparece um aviso na hora, visível só para quem escreveu", "Use os filtros no topo da lista (Todas/Não lidas/Canais/Diretas) para achar uma conversa mais rápido, e 'Arquivadas' para tirar uma conversa da lista sem apagar nada", "Segure o ícone de microfone para gravar um áudio, solte para enviar — arraste para o lado antes de soltar se quiser cancelar"] } },
    { id: "v-c6", title: "Lista Pessoal: sua lista privada", description: "Lista Pessoal", duration: null, url: null,
      quickStart: { icon: "✅", steps: ["Já vem ativada por padrão — se quiser desligar, é em Configurações → Preferências → Recursos", "Alterne entre Lista, Kanban e Agenda no topo da tela — Kanban aceita arrastar o card entre colunas, igual aos outros quadros da plataforma", "Ao criar uma tarefa, escrever o prazo direto no título (\"amanhã 15h\", \"sexta\", \"dia 15\") preenche data e hora sozinho — dá pra marcar como recorrente (diária/semanal/mensal) e adicionar etiquetas", "Clique numa tarefa para abrir o card completo: checklist, anexos e um espaço pra notas, além de título e descrição editáveis a qualquer momento", "Tarefa com prazo pra hoje avisa pelo sino de notificações", "É 100% privada: nem gerente, nem admin, ninguém além de você vê o que está aqui"] } },
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
    { id: "v-v6", title: "Usando o Chat interno", description: "Chat", duration: null, url: null,
      quickStart: { icon: "💬", steps: ["Clique em 'Chat' no menu lateral para ver canais da sua equipe e abrir conversas diretas — quem você pode chamar no privado segue a estrutura da empresa (seu setor, seu gestor ou quem responde a você)", "No campo de mensagem, use o ícone de carinha para abrir a paleta de emoji, ou o ícone de figurinha para mandar uma do pacote da empresa", "O ícone de clipe anexa um arquivo ou imagem — ele vira uma prévia antes de enviar, com um 'x' para remover se mudar de ideia", "Mensagens com linguagem imprópria não são enviadas — aparece um aviso na hora, visível só para quem escreveu", "Use os filtros no topo da lista (Todas/Não lidas/Canais/Diretas) para achar uma conversa mais rápido, e 'Arquivadas' para tirar uma conversa da lista sem apagar nada", "Segure o ícone de microfone para gravar um áudio, solte para enviar — arraste para o lado antes de soltar se quiser cancelar"] } },
    { id: "v-v7", title: "Lista Pessoal: sua lista privada", description: "Lista Pessoal", duration: null, url: null,
      quickStart: { icon: "✅", steps: ["Já vem ativada por padrão — se quiser desligar, é em Configurações → Preferências → Recursos", "Alterne entre Lista, Kanban e Agenda no topo da tela — Kanban aceita arrastar o card entre colunas, igual aos outros quadros da plataforma", "Ao criar uma tarefa, escrever o prazo direto no título (\"amanhã 15h\", \"sexta\", \"dia 15\") preenche data e hora sozinho — dá pra marcar como recorrente (diária/semanal/mensal) e adicionar etiquetas", "Clique numa tarefa para abrir o card completo: checklist, anexos e um espaço pra notas, além de título e descrição editáveis a qualquer momento", "Tarefa com prazo pra hoje avisa pelo sino de notificações", "É 100% privada: nem gerente, nem admin, ninguém além de você vê o que está aqui"] } },
  ],
  gerente: [
    { id: "v-g1", title: "Gestão de equipe e convites", description: "Usuários", duration: null, url: null,
      quickStart: { icon: "👥", steps: ["Acesse 'Usuários' → 'Convidar' para adicionar membros", "Defina o papel: Vendedor, Consultor, Gerente ou Admin", "Associe cada usuário à unidade Sanwey correta (Sanwey, Resibag…)"] } },
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
    { id: "v-g7", title: "Usando o Chat interno", description: "Chat", duration: null, url: null,
      quickStart: { icon: "💬", steps: ["Clique em 'Chat' no menu lateral para ver canais da sua equipe e abrir conversas diretas — quem você pode chamar no privado segue a estrutura da empresa (seu setor, seu gestor ou quem responde a você)", "No campo de mensagem, use o ícone de carinha para abrir a paleta de emoji, ou o ícone de figurinha para mandar uma do pacote da empresa", "O ícone de clipe anexa um arquivo ou imagem — ele vira uma prévia antes de enviar, com um 'x' para remover se mudar de ideia", "Mensagens com linguagem imprópria não são enviadas — aparece um aviso na hora, visível só para quem escreveu", "Use os filtros no topo da lista (Todas/Não lidas/Canais/Diretas) para achar uma conversa mais rápido, e 'Arquivadas' para tirar uma conversa da lista sem apagar nada", "Segure o ícone de microfone para gravar um áudio, solte para enviar — arraste para o lado antes de soltar se quiser cancelar"] } },
    { id: "v-g8", title: "Chat: criando canais e gerenciando figurinhas", description: "Chat", duration: null, url: null,
      quickStart: { icon: "🛠️", steps: ["Só gestores e admins criam canal novo — use o botão de criar canal no topo da lista de conversas do Chat", "Em Configurações → Geral → Chat, arraste um PNG/WEBP (quadrado, fundo transparente, até 512×512) para adicionar ao pacote que todo mundo vê no ícone de figurinha", "Na mesma tela dá para desativar uma figurinha (some do picker, mas fica guardada) ou excluir de vez"] } },
    { id: "v-g9", title: "Lista Pessoal: sua lista privada", description: "Lista Pessoal", duration: null, url: null,
      quickStart: { icon: "✅", steps: ["Já vem ativada por padrão — se quiser desligar, é em Configurações → Preferências → Recursos", "Alterne entre Lista, Kanban e Agenda no topo da tela — Kanban aceita arrastar o card entre colunas, igual aos outros quadros da plataforma", "Ao criar uma tarefa, escrever o prazo direto no título (\"amanhã 15h\", \"sexta\", \"dia 15\") preenche data e hora sozinho — dá pra marcar como recorrente (diária/semanal/mensal) e adicionar etiquetas", "Clique numa tarefa para abrir o card completo: checklist, anexos e um espaço pra notas, além de título e descrição editáveis a qualquer momento", "Tarefa com prazo pra hoje avisa pelo sino de notificações", "É 100% privada: nem gerente, nem admin, ninguém além de você vê o que está aqui"] } },
  ],
};
VIDEO_TUTORIALS.admin = VIDEO_TUTORIALS.gerente;

VIDEO_TUTORIALS.marketing = [
  { id: "v-mkt1", title: "Visão geral do módulo de Marketing", description: "Campanhas", duration: null, url: null,
    quickStart: { icon: "📣", steps: ["Acesse 'Campanhas' no menu lateral para ver o Kanban de marketing", "Cada coluna representa uma etapa: Briefing → Aprovação → Produção → Ao Vivo", "Clique em qualquer card para abrir os detalhes da campanha"] } },
  { id: "v-mkt2", title: "Criando uma campanha", description: "Campanhas", duration: null, url: null,
    quickStart: { icon: "➕", steps: ["Clique no '+' dentro de qualquer coluna para criar uma campanha na etapa", "Preencha nome, canal (Email/Social/Digital…), KPI e budget", "Defina a data de lançamento e o responsável — o card aparece no Kanban imediatamente"] } },
  { id: "v-mkt3", title: "Gerenciando entregas da campanha", description: "Entregas", duration: null, url: null,
    quickStart: { icon: "📦", steps: ["Acesse 'Entregas' no menu lateral para ver todas as demandas de produção", "Crie entregas vinculadas a uma campanha pela aba 'Entregas' no drawer da campanha", "Use prioridade (Baixa/Média/Alta) e prazo para organizar a fila de produção"] } },
  { id: "v-mkt4", title: "Controlando despesas de marketing", description: "Despesas", duration: null, url: null,
    quickStart: { icon: "💰", steps: ["Acesse 'Despesas' no menu lateral para registrar gastos por campanha", "Cada despesa tem categoria (Mídia Paga, Produção, Agência…) e valor", "O painel de totais mostra o budget consumido vs. disponível por campanha"] } },
  { id: "v-mkt5", title: "Aba Criativo e checklist de aprovação", description: "Campanhas", duration: null, url: null,
    quickStart: { icon: "✅", steps: ["Abra uma campanha e acesse a aba 'Criativo' no painel lateral", "Marque cada item do checklist de aprovação conforme for revisado", "A agência pode visualizar os itens marcados em tempo real"] } },
  { id: "v-mkt6", title: "Solicitações: Material ou Compra", description: "Solicitações", duration: null, url: null,
    quickStart: { icon: "📥", steps: ["Um só link público (/solicitar-marketing) agora cobre os dois tipos — quem pede escolhe 'Material de Marketing' ou 'Compra' logo no topo", "Ambos chegam em 'Solicitações' como pendentes, com uma etiqueta azul (Material) ou roxa (Compra) pra diferenciar", "Ao aprovar Material, você escolhe o destino (Entrega ou Tarefa); Compra vai direto pro Kanban de Compras, sem escolha"] } },
  { id: "v-mkt7", title: "Usando o Chat interno", description: "Chat", duration: null, url: null,
    quickStart: { icon: "💬", steps: ["Clique em 'Chat' no menu lateral para ver canais da sua equipe e abrir conversas diretas — quem você pode chamar no privado segue a estrutura da empresa (seu setor, seu gestor ou quem responde a você)", "No campo de mensagem, use o ícone de carinha para abrir a paleta de emoji, ou o ícone de figurinha para mandar uma do pacote da empresa", "O ícone de clipe anexa um arquivo ou imagem — ele vira uma prévia antes de enviar, com um 'x' para remover se mudar de ideia", "Mensagens com linguagem imprópria não são enviadas — aparece um aviso na hora, visível só para quem escreveu", "Use os filtros no topo da lista (Todas/Não lidas/Canais/Diretas) para achar uma conversa mais rápido, e 'Arquivadas' para tirar uma conversa da lista sem apagar nada", "Segure o ícone de microfone para gravar um áudio, solte para enviar — arraste para o lado antes de soltar se quiser cancelar"] } },
  { id: "v-mkt8", title: "Lista Pessoal: sua lista privada", description: "Lista Pessoal", duration: null, url: null,
    quickStart: { icon: "✅", steps: ["Já vem ativada por padrão — se quiser desligar, é em Configurações → Preferências → Recursos", "Alterne entre Lista, Kanban e Agenda no topo da tela — Kanban aceita arrastar o card entre colunas, igual aos outros quadros da plataforma", "Ao criar uma tarefa, escrever o prazo direto no título (\"amanhã 15h\", \"sexta\", \"dia 15\") preenche data e hora sozinho — dá pra marcar como recorrente (diária/semanal/mensal) e adicionar etiquetas", "Clique numa tarefa para abrir o card completo: checklist, anexos e um espaço pra notas, além de título e descrição editáveis a qualquer momento", "Tarefa com prazo pra hoje avisa pelo sino de notificações", "É 100% privada: nem gerente, nem admin, ninguém além de você vê o que está aqui"] } },
];

// gerente_marketing herda este array inteiro (spread abaixo) — "Lista
// Pessoal" (v-mkt8) já vem junto, sem precisar duplicar aqui.
VIDEO_TUTORIALS.gerente_marketing = [
  ...VIDEO_TUTORIALS.marketing,
  { id: "v-gm1", title: "Dashboard de Marketing", description: "Visão Geral", duration: null, url: null,
    quickStart: { icon: "📊", steps: ["Acesse 'Visão Geral' em Marketing para ver KPIs consolidados", "Acompanhe campanhas ativas, orçamento total e performance média", "Use o calendário para visualizar campanhas por data de lançamento"] } },
  { id: "v-gm2", title: "Automações de Marketing", description: "Automações", duration: null, url: null,
    quickStart: { icon: "⚡", steps: ["Acesse 'Automações' para criar regras específicas do módulo de Marketing", "Ative templates prontos: 'Campanha ao vivo' notifica a equipe automaticamente", "Defina alertas de SLA para campanhas paradas em Produção por mais de 10 dias"] } },
  { id: "v-gm3", title: "Chat: criando canais e gerenciando figurinhas", description: "Chat", duration: null, url: null,
    quickStart: { icon: "🛠️", steps: ["Só gestores e admins criam canal novo — use o botão de criar canal no topo da lista de conversas do Chat", "Em Configurações → Geral → Chat, arraste um PNG/WEBP (quadrado, fundo transparente, até 512×512) para adicionar ao pacote que todo mundo vê no ícone de figurinha", "Na mesma tela dá para desativar uma figurinha (some do picker, mas fica guardada) ou excluir de vez"] } },
];

VIDEO_TUTORIALS.agencia = [
  { id: "v-ag1", title: "Acesso da agência às campanhas", description: "Campanhas", duration: null, url: null,
    quickStart: { icon: "🏢", steps: ["Você vê apenas as campanhas em que a sua agência está envolvida", "Clique em qualquer campanha para abrir o painel de detalhes", "Seus dados são somente leitura — exceto o checklist de aprovação e uploads de arquivos"] } },
  { id: "v-ag2", title: "Enviando arquivos e comprovantes", description: "Campanhas", duration: null, url: null,
    quickStart: { icon: "📎", steps: ["Abra uma campanha e acesse a aba 'Arquivos' no painel lateral", "Arraste ou clique para fazer upload de criativos, relatórios e comprovantes", "Os arquivos ficam vinculados à campanha e visíveis para toda a equipe Sanwey"] } },
  { id: "v-ag3", title: "Checklist de aprovação", description: "Campanhas", duration: null, url: null,
    quickStart: { icon: "✅", steps: ["Na aba 'Criativo', você pode marcar itens do checklist como comprovados", "Use isso para indicar que a agência entregou cada requisito da campanha", "A equipe interna recebe notificação quando itens são marcados"] } },
  { id: "v-ag4", title: "Usando o Chat interno", description: "Chat", duration: null, url: null,
    quickStart: { icon: "💬", steps: ["Clique em 'Chat' no menu lateral para ver canais e abrir conversas diretas com a equipe Sanwey", "No campo de mensagem, use o ícone de carinha para abrir a paleta de emoji, ou o ícone de figurinha para mandar uma do pacote da empresa", "O ícone de clipe anexa um arquivo ou imagem — ele vira uma prévia antes de enviar, com um 'x' para remover se mudar de ideia", "Mensagens com linguagem imprópria não são enviadas — aparece um aviso na hora, visível só para quem escreveu", "Use os filtros no topo da lista (Todas/Não lidas/Canais/Diretas) para achar uma conversa mais rápido, e 'Arquivadas' para tirar uma conversa da lista sem apagar nada", "Segure o ícone de microfone para gravar um áudio, solte para enviar — arraste para o lado antes de soltar se quiser cancelar"] } },
];

VIDEO_TUTORIALS.rh = [
  { id: "v-rh1", title: "Visão geral do RH", description: "Visão Geral", duration: null, url: null,
    quickStart: { icon: "👥", steps: ["Acesse 'Visão Geral' para ver o painel com funcionários, férias pendentes e vagas em aberto", "Os cards de KPI mostram ativos, de férias e afastados em tempo real", "Clique em 'Ver todas' em cada seção para ir ao módulo correspondente"] } },
  { id: "v-rh2", title: "Gerenciando funcionários", description: "Funcionários", duration: null, url: null,
    quickStart: { icon: "🧑‍💼", steps: ["Acesse 'Funcionários' para ver o cadastro completo da equipe", "Clique num funcionário para editar dados: cargo, departamento, data de admissão", "Use os filtros (Departamento, Status, Tipo de contrato) para encontrar rapidamente", "Pra remover um registro de teste ou duplicado, use o ícone de lixeira no card do funcionário — a exclusão não pode ser desfeita"] } },
  { id: "v-rh3", title: "Processo de recrutamento", description: "Recrutamento", duration: null, url: null,
    quickStart: { icon: "💼", steps: ["Acesse 'Recrutamento' para ver vagas abertas e candidatos no Kanban", "Crie vagas com cargo, departamento e requisitos; candidatos entram em 'Triagem'", "Arraste candidatos pelo pipeline: Triagem → Entrevista RH → Aprovado"] } },
  { id: "v-rh4", title: "Solicitações de férias", description: "Férias", duration: null, url: null,
    quickStart: { icon: "🏖️", steps: ["Acesse 'Férias & Licenças' para ver as solicitações pendentes", "Aprovadores: clique em 'Aprovar' ou 'Rejeitar' — o funcionário recebe e-mail automaticamente", "Visualize o calendário de ausências para checar conflitos de equipe"] } },
  { id: "v-rh5", title: "Usando o Chat interno", description: "Chat", duration: null, url: null,
    quickStart: { icon: "💬", steps: ["Clique em 'Chat' no menu lateral para ver canais da sua equipe e abrir conversas diretas — quem você pode chamar no privado segue a estrutura da empresa (seu setor, seu gestor ou quem responde a você)", "No campo de mensagem, use o ícone de carinha para abrir a paleta de emoji, ou o ícone de figurinha para mandar uma do pacote da empresa", "O ícone de clipe anexa um arquivo ou imagem — ele vira uma prévia antes de enviar, com um 'x' para remover se mudar de ideia", "Mensagens com linguagem imprópria não são enviadas — aparece um aviso na hora, visível só para quem escreveu", "Use os filtros no topo da lista (Todas/Não lidas/Canais/Diretas) para achar uma conversa mais rápido, e 'Arquivadas' para tirar uma conversa da lista sem apagar nada", "Segure o ícone de microfone para gravar um áudio, solte para enviar — arraste para o lado antes de soltar se quiser cancelar"] } },
  { id: "v-rh6", title: "Lista Pessoal: sua lista privada", description: "Lista Pessoal", duration: null, url: null,
    quickStart: { icon: "✅", steps: ["Já vem ativada por padrão — se quiser desligar, é em Configurações → Preferências → Recursos", "Alterne entre Lista, Kanban e Agenda no topo da tela — Kanban aceita arrastar o card entre colunas, igual aos outros quadros da plataforma", "Ao criar uma tarefa, escrever o prazo direto no título (\"amanhã 15h\", \"sexta\", \"dia 15\") preenche data e hora sozinho — dá pra marcar como recorrente (diária/semanal/mensal) e adicionar etiquetas", "Clique numa tarefa para abrir o card completo: checklist, anexos e um espaço pra notas, além de título e descrição editáveis a qualquer momento", "Tarefa com prazo pra hoje avisa pelo sino de notificações", "É 100% privada: nem gerente, nem admin, ninguém além de você vê o que está aqui"] } },
];

// gerente_rh herda este array inteiro (spread abaixo) — "Lista Pessoal"
// (v-rh6) já vem junto, sem precisar duplicar aqui.
VIDEO_TUTORIALS.gerente_rh = [
  ...VIDEO_TUTORIALS.rh,
  { id: "v-grh1", title: "Conversão candidato → funcionário", description: "Recrutamento", duration: null, url: null,
    quickStart: { icon: "🎉", steps: ["Quando um candidato chega em 'Aprovado', aparece o botão 'Converter'", "Clique em 'Converter' — você é levado para Funcionários com um banner de boas-vindas", "Use 'Enviar convite' para criar o acesso ao sistema para o novo funcionário"] } },
  { id: "v-grh2", title: "Aprovação de férias em lote", description: "Férias", duration: null, url: null,
    quickStart: { icon: "✅", steps: ["Acesse 'Férias & Licenças' e filtre por 'Pendente' para ver as aprovações em aberto", "Clique em cada solicitação para ver o período e checar o calendário de ausências", "Após aprovar/rejeitar, o sistema envia e-mail automático ao funcionário"] } },
  { id: "v-grh3", title: "Chat: criando canais e gerenciando figurinhas", description: "Chat", duration: null, url: null,
    quickStart: { icon: "🛠️", steps: ["Só gestores e admins criam canal novo — use o botão de criar canal no topo da lista de conversas do Chat", "Em Configurações → Geral → Chat, arraste um PNG/WEBP (quadrado, fundo transparente, até 512×512) para adicionar ao pacote que todo mundo vê no ícone de figurinha", "Na mesma tela dá para desativar uma figurinha (some do picker, mas fica guardada) ou excluir de vez"] } },
];

export const FAQ_ITEMS = [
  {
    question: "Como faço para redefinir minha senha?",
    answer: "Acesse Configurações → Perfil → aba Senha. Em modo Supabase, você também pode usar o e-mail de recuperação na tela de login.",
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
    question: "Como configuro as etapas do Funil de Vendas?",
    answer: "Dentro do Kanban do Funil de Vendas, clique em Editar etapas (disponível para gerentes e admins). Lá você cria, edita e reordena as etapas de cada unidade.",
  },
  {
    question: "Os dados ficam salvos se eu fechar o navegador?",
    answer: "Sim. Com Supabase configurado, tudo é salvo em nuvem em tempo real. Em modo offline, os dados ficam em localStorage do navegador.",
  },
  {
    question: "O que acontece se eu perder a internet no meio de uma visita a cliente?",
    answer: "No Funil de Vendas, seus negócios continuam aparecendo na tela com os últimos dados salvos (uma faixa amarela avisa que você está offline). Dá pra registrar uma nota normalmente — ela fica marcada como \"vai enviar quando voltar o sinal\" e sincroniza sozinha assim que a conexão voltar, sem precisar reabrir nada.",
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
      difficultyColor: "var(--success)",
    },
    {
      id: "r2",
      emoji: "🔔",
      title: "Alerta de lead de alto valor",
      trigger: "Lead entra na etapa Proposta",
      condition: "Valor estimado acima de R$ 100.000",
      action: "Notificar Gerente imediatamente",
      difficulty: "Fácil",
      difficultyColor: "var(--success)",
    },
    {
      id: "r3",
      emoji: "📋",
      title: "Atribuição automática de leads",
      trigger: "Novo lead criado via Explorador ou Importação",
      condition: "Sem responsável definido",
      action: "Distribuir em rodízio entre vendedores da unidade",
      difficulty: "Médio",
      difficultyColor: "var(--amber)",
    },
    {
      id: "r4",
      emoji: "📅",
      title: "Follow-up após proposta enviada",
      trigger: "Lead entra na etapa Proposta Enviada",
      condition: "Nenhuma atividade nos próximos 5 dias",
      action: "Notificar vendedor para fazer follow-up",
      difficulty: "Médio",
      difficultyColor: "var(--amber)",
    },
    {
      id: "r5",
      emoji: "🏆",
      title: "Celebrar vitória",
      trigger: "Lead movido para Ganho",
      condition: "Qualquer lead",
      action: "Notificar toda a equipe da unidade com valor do negócio",
      difficulty: "Fácil",
      difficultyColor: "var(--success)",
    },
    {
      id: "r6",
      emoji: "🔁",
      title: "Reengajamento de perdidos",
      trigger: "Lead está em Perdido há 90 dias",
      condition: "Motivo não é 'Concorrente ganhou (definitivo)'",
      action: "Criar alerta para gerente revisar e considerar reabrir",
      difficulty: "Avançado",
      difficultyColor: "var(--danger)",
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
    color: "#CC2936",
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
