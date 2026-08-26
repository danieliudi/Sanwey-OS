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
  // 4.60.1 — título editável (lápis) em Vaga e Candidato (RH Recrutamento):
  // DECIDIDO PULAR o spotlight. Mesmo componente `EditableTitle` já em uso
  // desde 29/07/2026 em Campanhas/Entregas/Tarefas/Compras (nunca ganhou
  // spotlight próprio, decidido antes desta regra existir) — aqui é
  // extensão de padrão já conhecido pra mais 2 boards, não um fluxo novo. O
  // lápis fica sempre visível ao lado do título (não escondido atrás de
  // hover/menu), então já se autoexplica ao abrir qualquer card de
  // Vaga/Candidato. Coberto pelo changelog 4.60.1.
];

export default FEATURE_SPOTLIGHTS;
