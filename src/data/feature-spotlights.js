// Tour guiado contextual (spotlight) — proposta "B" aprovada com o Daniel
// (07/08/2026, artifact "Tour guiado — proposta de spotlight contextual"):
// em vez de forçar um tour tela-por-tela, o aviso só aparece quando a
// pessoa naturalmente visita a tela onde a novidade mora.
//
// Separado do CHANGELOG de propósito — nem toda entrada de changelog aponta
// pra um elemento real de UI (a maioria são fixes/ajustes sem "onde
// apontar"); isto é só o subconjunto que vale destacar com um tooltip.
//
// Cada entrada:
//   id      — identificador estável, único pra sempre (nunca reaproveitar
//             depois de remover uma feature — ver nota de "sumiço" abaixo).
//   route   — mesmo valor de `section` em App.jsx (ex.: "personal-tasks").
//   target  — seletor CSS do elemento marcado com o atributo `data-tour`
//             correspondente (ex.: ViewToggleButton `dataTour="..."`).
//   text    — frase curta, mesmo tom do CHANGELOG.
//   version — versão em que a feature foi ao ar. Ao MUDAR a feature de um
//             jeito que invalida o spotlight antigo, sobe esta versão — quem
//             já viu a anterior vê de novo automaticamente (ver
//             use-feature-spotlight.js, que compara contra a versão vista).
//
// Quando uma feature SOME da plataforma: apague a entrada correspondente
// aqui (nunca deixe órfã) — o runtime já pula em silêncio se o elemento não
// existir (decisão registrada no mockup), mas isso não substitui a limpeza:
// entrada morta aqui é dívida, não é inofensiva só porque não quebra nada.
export const FEATURE_SPOTLIGHTS = [
  {
    id: "entregas-cards-sinais",
    route: "marketing-entregas",
    // Alvo é o botão da view Kanban, não um card: os chips que mudaram só
    // aparecem em cards que TÊM exceção, então não existe elemento estável
    // pra apontar — num board saudável não haveria nenhum na tela.
    target: '[data-tour="entregas-cards-sinais"]',
    text: "Os cards mudaram: agora um selo só aparece quando pede ação sua — prazo estourado, SLA vencendo ou campo faltando. Card sem selo é card em dia, não card sem informação.",
    version: "4.85.0",
  },
  {
    id: "clientes-novo-cliente",
    route: "clients",
    // Alvo é o botão da rota, não o campo novo em si — o formulário só
    // existe dentro do modal de criação, que não está montado ao entrar na
    // tela. Mesmo ajuste que o comitê de compra devia ter tido (registrado
    // no CLAUDE.md como lição da 4.61.0, onde o spotlight foi pulado por
    // viver dentro de um modal e a feature não pegou tração nenhuma).
    target: '[data-tour="clientes-novo-cliente"]',
    text: "Novo: ao buscar o CNPJ aqui, a Razão Social também é preenchida (com o selo de situação na Receita), e dá pra já cadastrar o contato principal — sem precisar salvar e reabrir.",
    version: "4.71.0",
  },
  {
    id: "registrar-caso-header",
    route: "crm",
    target: '[data-tour="registrar-caso-header"]',
    text: "Novo: registre um caso de prospecção (ganhamos/perdemos/andamento) falando o que aconteceu — vira base pro playbook de vendas.",
    version: "4.65.0",
  },
  {
    id: "registrar-caso-cliente",
    route: "clients",
    target: '[data-tour="registrar-caso-cliente"]',
    text: "Novo: registre um caso de prospecção sobre este cliente — fale o que aconteceu, a IA organiza e você confere antes de salvar.",
    version: "4.65.0",
  },
  {
    id: "inteligencia-mercado-hub",
    route: "market-intel",
    target: '[data-tour="inteligencia-mercado-hub"]',
    text: "Novo: dados do setor atualizados automaticamente, o antigo painel de Insights (agora numa aba própria) e um cruzamento dos dois num lugar só.",
    version: "4.62.0",
  },
  {
    id: "ata-voz-gravar",
    route: "crm",
    // Alvo trocado em 18/08/2026 (redesenho do drawer): "Gravar ata" saiu de
    // dentro da aba Atividades (onde só existia depois de rolar + trocar de
    // aba) e virou um botão fixo no header do card, que abre a gravação como
    // painel flutuante — o `data-tour="ata-voz-gravar"` antigo só existe hoje
    // se esse painel já estiver aberto, então deixou de ser um alvo válido
    // pro spotlight (nunca dispararia sozinho). Versão subida porque é
    // mudança de comportamento de um botão que quem já usa a plataforma não
    // ia necessariamente notar sozinho — mesmo critério da atualização
    // anterior desta entrada (check-in de visita, 17/08/2026).
    target: '[data-tour="ata-voz-gravar-header"]',
    text: "Novo: \"Gravar ata\" agora fica fixo aqui no topo do card — clique pra registrar por voz de qualquer aba, sem precisar rolar até Atividades.",
    version: "4.59.0",
  },
  // Mesmo componente (AtaVozPanel), mesmo data-tour, rota diferente — a ata
  // por voz chegou também na aba Histórico do Cliente (4.55.0), pra registrar
  // conversa mesmo sem negócio aberto. Entrada própria porque o mecanismo
  // dispara por rota (`route`), não por elemento — só existir um `[data-tour]`
  // igual na rota "crm" não cobre quem visita "clients" primeiro.
  {
    id: "ata-voz-gravar-cliente",
    route: "clients",
    target: '[data-tour="ata-voz-gravar"]',
    text: "Novo: registre uma conversa com este cliente mesmo sem negócio aberto — sua localização é sempre anexada, e a ata reconhece visitas já planejadas em Viagens pra vincular.",
    version: "4.58.0",
  },
  {
    id: "lista-pessoal-agenda",
    route: "personal-tasks",
    target: '[data-tour="lista-pessoal-agenda"]',
    text: "Novo: agora dá pra ver suas tarefas num calendário mensal — clique aqui pra experimentar.",
    version: "4.23.0",
  },
  // Achado do Daniel 10/08/2026: esta lista ficou parada em 1 entrada só
  // desde 4.23.0 — várias features grandes (reestruturação de drawer,
  // ESG, StageNavigator) saíram sem spotlight nenhum. As duas abaixo
  // reabrem a prática; ver CLAUDE.md regra 12 pra isso não voltar a
  // travar silenciosamente.
  {
    id: "executive-esg-tab",
    route: "executive",
    target: '[data-tour="executive-esg-tab"]',
    text: "Novo: o Painel Executivo ganhou uma aba de ESG & Carbono — clique aqui pra ver o total de CO2e do Grupo.",
    version: "4.33.0",
  },
  {
    id: "prestacao-de-contas",
    route: "crm-viagens",
    target: '[data-tour="prestacao-de-contas"]',
    text: "Novo: agrupe várias despesas soltas numa prestação de contas e envie de uma vez, em vez de despesa por despesa.",
    version: "4.34.0",
  },
  // Achado do Daniel 11/08/2026 (print do app + "o texto está muito
  // confuso"): esta entrada dizia "clique aqui" tanto pra criar automações
  // quanto pra "marcar que uma tarefa depende de outra" — mas o alvo é só a
  // aba Automações; dependência entre tarefas se marca dentro do card
  // (campo "Depende de" no drawer), não tem elemento estável na Kanban pra
  // apontar (mesmo motivo de outras entradas puladas nesta lista — ver
  // "4.40.0"/"4.42.0" abaixo). Corrigido pra descrever só o que o botão
  // realmente faz, e trocado o exemplo de "Feito" (nome que só existia
  // porque era o padrão antigo — hoje a etapa final nasce "Arquivar", e
  // etapas são renomeáveis) por uma frase que não trava num nome de etapa
  // específico.
  {
    id: "lista-pessoal-automacoes",
    route: "personal-tasks",
    target: '[data-tour="lista-pessoal-automacoes"]',
    text: "Novo: crie automações no seu Meu To-do — por exemplo, \"quando eu mover uma tarefa pra etapa final, me avisar\" — clique aqui.",
    version: "4.44.1",
  },
  // Achado da revisão de QA (11/08/2026): esta entrada quase ficou de fora
  // (regra 12) — target vive dentro do drawer de detalhe do lead (só
  // aparece com um lead aberto), mesma situação de "lista-pessoal-
  // automacoes" acima; o runtime já pula em silêncio se o elemento não
  // existir na hora, então registrar mesmo assim é estritamente melhor que
  // não registrar (dispara pra quem já tem um lead aberto na 1ª visita
  // depois do release).
  {
    id: "lead-email-tab",
    route: "crm",
    target: '[data-tour="lead-tab-email"]',
    text: "Novo: envie e-mail de verdade pro cliente direto daqui, com templates reutilizáveis e lembrete recorrente — clique na aba \"Email\".",
    version: "4.45.0",
  },
  // 4.46.0 — igual a "lista-pessoal-automacoes"/"lead-email-tab" acima: o
  // alvo só existe com um grupo/canal aberto (dentro do cabeçalho da
  // conversa), não direto na rota "chat". Registrado mesmo assim — o
  // runtime pula em silêncio se o elemento não estiver montado ainda, e
  // dispara pra quem já tem uma conversa aberta na 1ª visita depois do
  // release.
  {
    id: "chat-manage-channel",
    route: "chat",
    target: '[data-tour="chat-manage-channel"]',
    text: "Novo: \"Canal\" virou Grupo (todo mundo posta) e Canal (só avisos). Clique na engrenagem pra renomear, trocar o tipo, adicionar/remover pessoas ou sair.",
    version: "4.46.0",
  },
  {
    id: "central-bugs",
    route: "dashboard",
    target: '[data-tour="sidebar-nav-central-bugs"]',
    text: "Novo: encontrou algo que não devia acontecer? Clique aqui pra reportar um bug — qualquer pessoa pode.",
    version: "4.56.0",
  },
  {
    id: "marketing-orcamento",
    route: "marketing-despesas",
    target: '[data-tour="despesas-abas"]',
    text: "Novo: a aba Orçamento mostra quanto do teto de cada categoria já foi gasto no ano — incluindo o que está comprometido em compras aprovadas.",
    version: "4.39.0",
  },
  // 4.40.0 — aba "Histórico" do cliente (ex-"Conexões"): DECIDIDO PULAR o
  // spotlight, com motivo (regra 12 do CLAUDE.md manda registrar a decisão de
  // pular, não pular a pergunta). O mecanismo ancora num elemento visível ao
  // entrar numa ROTA; essa aba só existe dentro do modal do cliente, depois de
  // clicar num cliente da lista. Não há alvo estável na rota `clients`, e
  // apontar pra lista com um texto sobre uma aba que a pessoa ainda não vê
  // seria pior que não avisar. Coberto pelo changelog 4.40.0.
  //
  // 4.42.0 — "Devolver para a agência" (Entregas): mesmo caso da 4.40.0, o
  // botão vive dentro do drawer de uma entrega, não numa rota. DECIDIDO PULAR
  // o spotlight ancorado nele (o `data-tour="entregas-devolver-agencia"` fica
  // no elemento pra quando houver um mecanismo de spotlight dentro de drawer).
  // A metade que ancora numa rota — o arrastar pra trás sem preencher — não
  // tem elemento nenhum: é a ausência de um bloqueio. Coberto pelo changelog.
  {
    id: "viagens-calendario-pessoal",
    route: "crm-viagens",
    target: '[data-tour="viagens-calendario-pessoal"]',
    text: "Novo: veja suas saídas planejadas num calendário, e registre eventos/feiras além de visita a cliente.",
    version: "4.43.0",
  },
  // 4.43.0 — calendário do time (visão do gestor): mesmo caso do "Devolver
  // pra agência" — o toggle só existe dentro da aba "Gestão", que não é a
  // aba padrão de quem também tem "Minhas viagens" (comercial + gestor).
  // DECIDIDO PULAR o spotlight aqui; quem só tem papel gerente/admin (sem
  // "Minhas viagens") já cai direto na aba onde o toggle está, mas mesmo
  // assim não há garantia de que "Gestão" seja a rota visitada primeiro no
  // sentido do mecanismo (que dispara ao entrar na ROTA, não na aba). Coberto
  // pelo changelog.
  //
  // 4.58.0 — botão "Buscar" (CNPJ) + campo Endereço no cadastro de Cliente:
  // DECIDIDO PULAR o spotlight. Diferente do check-in de visita (que muda
  // comportamento por trás de um botão já familiar, "Gravar ata" — por isso
  // esse sim ganhou spotlight acima), aqui o campo "Endereço" e o botão
  // "Buscar" ao lado do CNPJ são visíveis e autoexplicativos assim que a
  // pessoa abre a tela de editar/criar Cliente — não há nada "escondido"
  // que só um aviso resolveria. Coberto pelo changelog 4.58.0.
  //
  // 4.57.0 — ícone de "página em teste" no menu lateral: DECIDIDO PULAR o
  // spotlight. Dois motivos, não só um: (1) é admin-only por natureza (o
  // ícone só existe pra quem já vê itens em `moduleStates === "test"` —
  // hoje só admin/testador marcado), não é uma feature que a base geral de
  // usuários precise ser avisada; (2) o alvo é condicional a QUAL item está
  // em teste num dado momento — pode não haver nenhum (mecanismo ancora num
  // elemento fixo por rota, não serve bem pra "o item X, quando X varia").
  // Coberto pelo changelog 4.57.0 (com `roles: ["admin"]`, já restrito a
  // quem o ícone realmente afeta).
  //
  // 4.59.0 — colunas mais largas nos cards/modais de detalhe (Vendas,
  // Pós-venda, Entregas, Campanhas, Compras, Tarefas de Marketing, Lista
  // Pessoal, Comex, RH): DECIDIDO PULAR o spotlight. Não é uma capacidade
  // nova que alguém precise "descobrir" clicando em algo — é layout ambiente
  // (menos scroll pra ver a mesma informação), notado passivamente ao abrir
  // qualquer card, sem elemento único e clicável pra apontar. Coberto pelo
  // changelog 4.59.0.
  //
  {
    id: "document-library-nav",
    route: "dashboard",
    target: '[data-tour="sidebar-nav-document-library"]',
    text: "Novo: a Biblioteca de Documentos guarda certificado, datasheet e ficha técnica reutilizáveis — clique aqui pra ver.",
    version: "4.61.0",
  },
  {
    id: "proposal-line-items",
    route: "crm",
    target: '[data-tour="proposal-line-items"]',
    text: "Novo: monte a lista de itens (modelo, quantidade, preço) antes de gerar a proposta — clique em \"Adicionar item\".",
    version: "4.61.0",
  },
  // 4.61.0 — leva de 7 features do Funil de Vendas (comitê de compra, gate
  // de etapa por valor, alerta de concorrente, fit_score, WhatsApp fase 1):
  // DECIDIDO PULAR spotlight nas 5, cada uma por motivo próprio, coberto
  // pelo changelog 4.61.0 em todos os casos:
  //   - Comitê de compra: a leitura (o que aparece no negócio) é passiva,
  //     sem elemento clicável; a edição de verdade vive na aba "Contatos"
  //     dentro do MODAL do cliente — mesma situação já registrada pra
  //     "Histórico"/"Conexões" em 4.40.0 acima (sem alvo estável na rota).
  //   - Gate de etapa por valor: o ícone de filtro que abre o editor de
  //     condição vive dentro do modal "Editar etapas do pipeline", não numa
  //     rota — mesmo caso do calendário de time em 4.43.0 acima.
  //   - Alerta de concorrente: badge ambiente (aparece sozinho quando há
  //     menção recente), nada pra "clicar aqui e descobrir" — mesmo
  //     critério das colunas mais largas em 4.59.0 acima.
  //   - fit_score: o número/badge é passivo; a única ação nova (ordenar por
  //     Fit) é uma opção a mais dentro de um menu de ordenação que já
  //     existia antes desta leva, não um elemento novo pra apontar.
  //   - WhatsApp fase 1: propositalmente dormente ("cria, mas deixa em
  //     teste ainda") — nada funciona ainda (sem envio/recebimento);
  //     anunciar com spotlight uma aba que não faz nada seria pior que só
  //     deixar quem abrir um negócio notar sozinho.
  //
  // 4.67.0 — conexão da Secretária de IA (chave de API pessoal, Configurações
  // → Integrações → Secretária de IA): DECIDIDO PULAR o spotlight. Mesmo
  // motivo já registrado pra "Gestão" (4.43.0) e "Histórico"/"Conexões"
  // (4.40.0) — o mecanismo ancora num elemento visível ao ENTRAR na rota
  // ("settings"), mas este alvo fica atrás de dois cliques a mais (aba
  // "Integrações", depois sub-aba "Secretária de IA"), nenhum dos dois é o
  // padrão de quem abre Configurações. Coberto pelo changelog 4.67.0.
  //
  // 4.60.1 — título editável (lápis) em Vaga e Candidato (RH Recrutamento):
  // DECIDIDO PULAR o spotlight. Mesmo componente `EditableTitle` já em uso
  // desde 29/07/2026 em Campanhas/Entregas/Tarefas/Compras (nunca ganhou
  // spotlight próprio, decidido antes desta regra existir) — aqui é
  // extensão de padrão já conhecido pra mais 2 boards, não um fluxo novo. O
  // lápis fica sempre visível ao lado do título (não escondido atrás de
  // hover/menu), então já se autoexplica ao abrir qualquer card de
  // Vaga/Candidato. Coberto pelo changelog 4.60.1.
  {
    id: "lista-pessoal-filtros",
    route: "personal-tasks",
    target: '[data-tour="lista-pessoal-filtros"]',
    text: "Novo: dá pra filtrar o Meu To-do por prioridade e por prazo, além de etiqueta — clique aqui.",
    version: "4.66.0",
  },
  // 4.68.0 — campo condicional por etiqueta. Mesmo caso já registrado pra
  // "lista-pessoal-automacoes"/"lead-email-tab" acima: o alvo real (as
  // etiquetas dentro do card, e o editor de condicionais dentro de "Editar
  // etapas") só existe com um card aberto / modal aberto, não direto na
  // rota. Aponta pro botão "Editar etapas", que é o caminho de entrada da
  // configuração e SEMPRE existe na rota — o texto explica o resto. O
  // runtime pula em silêncio se o elemento não estiver montado.
  {
    id: "lista-pessoal-campos-por-etiqueta",
    route: "personal-tasks",
    target: '[data-tour="lista-pessoal-editar-etapas"]',
    text: "Novo: o formulário da etapa pode mudar conforme o tipo da tarefa. Marque a etiqueta (Compra, Reunião…) no card e configure aqui, em Condicionais de campo, o que cada tipo pede.",
    version: "4.68.0",
  },
  // Igual a "clientes-novo-cliente": o alvo é o botão da rota que abre o
  // modal, não o campo em si — o CNPJ/aviso de duplicidade/contato só
  // existem dentro do LeadCreateModal, que não está montado ao entrar na
  // tela. Achado real que motivou (caso Casa Granado, 27/08/2026): sem CNPJ
  // visível e sem aviso de nome parecido, um vendedor criou um cliente
  // duplicado sem perceber.
  {
    id: "crm-nova-oportunidade-cnpj",
    route: "crm",
    target: '[data-tour="crm-nova-oportunidade"]',
    text: "Novo: ao criar uma oportunidade, dá pra buscar o CNPJ (preenche a Razão Social), o sistema avisa se o nome digitado parece muito com um cliente já cadastrado, e já dá pra registrar quem te atendeu (nome, cargo, e-mail, telefone) — clique aqui.",
    version: "4.72.0",
  },
  //
  // 4.72.0 — dropdown "Pesquisar" (ex-4 ícones) e acordeão "Amostras
  // enviadas" no card do Funil de Vendas: DECIDIDO PULAR o spotlight. Mesmo
  // critério das colunas mais largas em 4.59.0 — decluttering passivo, não
  // uma capacidade nova pra "descobrir": os links de pesquisa continuam
  // fazendo a mesma coisa de antes, só atrás de um clique a mais; o
  // acordeão de amostras já abre sozinho quando tem dado, então quem tinha
  // amostra registrada nem percebe a mudança de comportamento. Coberto pelo
  // changelog 4.72.0.
  //
  // 4.73.0 — botões de ação de 1 clique na fila de Pendências (Copiloto
  // Fase 2): DECIDIDO PULAR o spotlight. O alvo real (o botão "Reciclar"/
  // "Recusar"/"Enviar lembrete") só existe em CIMA de um card de um dos 4
  // tipos específicos — pode não haver nenhum pendente no momento em que a
  // pessoa entra na rota "dashboard" (mecanismo ancora num elemento fixo por
  // rota, não serve bem pra "o card X, quando X existir", mesmo motivo já
  // registrado pro ícone de "em teste" em 4.57.0). Além disso é um atalho
  // pra uma ação que já existia (abrir o card e agir de lá) — não uma
  // capacidade nova, mesmo critério das colunas mais largas em 4.59.0.
  // Coberto pelo changelog 4.73.0.
  //
  // 4.74.0 — botão de IA ("Rascunho de e-mail"/"Próximo passo") na fila de
  // Pendências pros 2 tipos de pendência de Leads (Copiloto Fase 3):
  // DECIDIDO PULAR o spotlight — mesmo motivo exato da 4.73.0 acima, o alvo
  // só existe em cima de um card de lead responsável/parado, que pode não
  // haver nenhum no momento em que a pessoa entra na rota "dashboard".
  // Coberto pelo changelog 4.74.0.
  //
  // 4.75.0 — Tarefas de Marketing/Comex/Meu To-do entrando na fila de
  // Pendências (Copiloto Fase 4): DECIDIDO PULAR o spotlight. É cobertura de
  // dado numa lista que já existe (mais tipos de item aparecendo na mesma
  // fila, mesmo mecanismo de clique-pra-abrir de sempre) — não um elemento
  // de UI novo pra apontar; mesmo critério das colunas mais largas em
  // 4.59.0. Coberto pelo changelog 4.75.0.
  //
  // 4.76.0 — responsável(is) em tarefa de Onboarding (avatar na lista +
  // picker ao criar tarefa ad-hoc): DECIDIDO PULAR o spotlight. O alvo real
  // (o picker de responsável) só existe DENTRO do drawer de um colaborador
  // específico em `OnboardingDrawer` — não é um elemento fixo de rota que
  // o mecanismo (ancorado por `route`+`target` na primeira visita à tela)
  // consegue apontar de forma confiável, mesmo motivo já registrado pro
  // botão de ação de 1 clique em 4.73.0/4.74.0. Coberto pelo changelog
  // 4.76.0.
  //
  // 4.77.0 — loading incremental na fila de Pendências (Copiloto Fase 5):
  // DECIDIDO PULAR o spotlight. É melhoria de performance percebida (o
  // conteúdo aparece mais cedo, sem esperar as ~16 assinaturas todas
  // resolverem) — não introduz elemento de UI novo pra apontar, mesmo
  // critério do fix de `scrollbar-gutter: stable` registrado na regra 11 do
  // CLAUDE.md. Coberto pelo changelog 4.77.0.
  {
    id: "viagens-calcular-atalho",
    route: "crm-viagens",
    target: '[data-tour="viagens-calcular-atalho"]',
    text: "Montou a agenda? Este atalho abre a calculadora já com os endereços das suas saídas — e agora ela compara a viagem inteira, com hotel e carro alugado no destino.",
    version: "4.84.0",
  },
  // Nota sobre o alvo acima: o banner só existe quando há saída planejada
  // futura no mês. Sem nenhuma, o elemento não está na tela e o runtime pula
  // em silêncio (comportamento já documentado no topo deste arquivo) — o que
  // é o certo aqui: apontar um atalho de agenda pra quem não tem agenda
  // montada não ensina nada. Quem cadastrar a primeira saída vê o spotlight
  // na visita seguinte à tela.
  //
  // A calculadora em si (hospedagem, aluguel no destino, "Ajustar valores")
  // NÃO ganhou spotlight próprio: são campos dentro de uma aba que a pessoa
  // só abre quando já quer calcular algo, e o atalho acima já leva até lá
  // contando o que mudou. Dois spotlights pro mesmo assunto na mesma rota
  // viraria ruído. Coberto pelo changelog 4.84.0.
];

export default FEATURE_SPOTLIGHTS;
