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
  // 5.19.0 — tabela multi-modelo e imagens do Pitch. NÃO ganham entrada
  // própria: as duas moram DENTRO do painel de Proposta, e alvo que só
  // existe depois de abrir um card se auto-marca como visto
  // (FeatureSpotlight.jsx) — a armadilha registrada nas entradas de 5.9,
  // 5.10, 5.11, 5.14 e 5.15. Em vez de uma segunda entrada condenada, sobe
  // a VERSÃO desta aqui, que é o caminho previsto no cabeçalho pra feature
  // que mudou de um jeito que invalida o aviso antigo: quem já viu a de
  // 5.18.0 vê de novo, com o texto atualizado.
  //
  // 5.18.0 — a aba "PDF" virou "Proposta", com o gerador de RFP. Ganha
  // spotlight (e não a decisão de pular das entradas abaixo) porque aqui o
  // alvo é a PRÓPRIA ABA na barra de abas, montada junto com o drawer — não
  // depende de abrir modal nem de já estar dentro de um painel. É a mesma
  // condição que fez 5.13.0 ganhar spotlight enquanto 5.9, 5.10 e 5.11
  // tiveram que pular.
  {
    id: "proposta-rfp",
    route: "crm",
    target: '[data-tour="lead-tab-pdf"]',
    text: "A aba PDF virou \"Proposta\": o gerador vem preenchido com o que o negócio sabe, aceita vários modelos com preço por linha e leva imagens da Biblioteca.",
    version: "5.19.0",
  },
  // 5.15.0 — bloco "A ata sugeriu N respostas" na aba Visita, e a aba abrindo
  // sozinha no celular. Decisão de PULAR o spotlight, registrada aqui (regra
  // 12) pelo MESMO motivo da entrada de 5.14.0 logo abaixo, que este bloco
  // não repete à toa: o alvo (`[data-tour="lead-tab-visita"]`) existe, mas só
  // depois de alguém abrir um card — o drawer não está na tela até lá. Alvo
  // ausente se auto-marca como visto (FeatureSpotlight.jsx), então o aviso
  // morreria na primeira visita à rota, exatamente como aconteceu com 5.9,
  // 5.10 e 5.11. Changelog (3 itens) e tutorial (`v-visita1`) cobrem.
  //
  // 5.14.0 — aba "Visita" no drawer do negócio. Decisão de PULAR o spotlight,
  // registrada aqui (regra 12): o alvo é uma aba DENTRO do drawer, e o drawer
  // não existe na tela até alguém abrir um card. Alvo ausente se auto-marca
  // como visto (FeatureSpotlight.jsx) — é a mesma armadilha das entradas de
  // 5.9, 5.10 e 5.11. Ancorar no card do Kanban também não serve: o card é
  // repetido e o seletor pegaria um qualquer. Changelog e tutorial cobrem, e
  // a aba fica visível assim que o drawer abre, que é onde ela serve.
  // 5.13.0 — o "?" que reabre a dica da tela. Ganha spotlight (e não a decisão
  // de pular, como as três entradas abaixo) por um motivo simples: é o único
  // caso recente em que o alvo está SEMPRE montado. O botão vive na barra
  // superior, aparece em toda tela que tem guia, e não depende de abrir modal,
  // card ou aba — que foi exatamente o que matou os spotlights de 5.9, 5.10 e
  // 5.11 (alvo ausente se auto-marca como visto).
  //
  // A rota é `dashboard` porque é o pouso pós-login de todo cargo interno: é
  // onde todo mundo passa, e o botão já está lá.
  {
    id: "dica-de-tela-reabrir",
    route: "dashboard",
    target: '[data-tour="dica-de-tela-reabrir"]',
    text: "A dica de cada tela agora cabe em 3 linhas — e este botão traz ela de volta quando você quiser, quantas vezes quiser.",
    version: "5.13.0",
  },
  // 5.12.0 — a pergunta "Onde foi" mora DENTRO do modal Nova Despesa, que não
  // existe na tela até alguém abrir. Mesmo raciocínio do "vaga-posicoes"
  // abaixo: ancora no botão que abre o modal, que é o caminho real até a
  // novidade, e que fica na aba padrão de quem lança despesa.
  //
  // A OUTRA metade desta entrega (classificação na linha do gestor e a seção
  // "Referências de gasto") NÃO ganha spotlight, e a decisão fica registrada
  // aqui pela regra 12: as duas moram na aba "Gestão", que não é a aba padrão
  // nem de gerente nem de admin (CRMViagensView monta "Minhas viagens"
  // primeiro pros dois). Alvo ausente se auto-marca como visto
  // (FeatureSpotlight.jsx), então o aviso morreria na primeira visita à tela,
  // antes de a pessoa chegar na aba onde a novidade está. Changelog cobre.
  {
    id: "despesa-contexto-capital-interior",
    route: "crm-viagens",
    target: '[data-tour="nova-despesa-contexto"]',
    text: "Ao lançar uma despesa agora tem uma pergunta a mais: Capital ou Interior. São dois toques, e é o que faz o almoço de estrada não ser comparado com o de centro urbano.",
    version: "5.12.0",
  },
  // 5.11.0 ("Minha equipe em onboarding") — decisão de PULAR o spotlight,
  // registrada aqui (regra 12). É UI nova e não-óbvia, então a pergunta é
  // legítima; o motivo de pular é que a seção só é montada pra quem é gestor
  // de alguém, e hoje o campo "Gestor" da ficha está vazio em 15 de 15 —
  // ou seja, o alvo não existe na tela de ninguém. Alvo ausente se
  // auto-marca como visto (FeatureSpotlight.jsx), então o aviso morreria
  // antes de existir um gestor pra quem ele importa, e quando o RH
  // preenchesse o campo ninguém veria nada. Mesma armadilha já registrada
  // abaixo. Changelog cobre; reavaliar quando gestor_id estiver preenchido.
  //
  // 5.10.0 (provisionamento na vaga, avaliação, prazo de documentos) —
  // decisão de PULAR o spotlight, registrada aqui (regra 12): os campos
  // novos moram DENTRO do painel de uma vaga em "Publicada" e do card de um
  // onboarding numa etapa específica. Nenhum deles existe na tela até a
  // pessoa abrir aquele registro exato, e alvo ausente se auto-marca como
  // visto. Changelog e tutorial cobrem; quem abre a vaga encontra o campo no
  // formulário, que é onde ele serve.
  //
  // 5.9.0 (desfazer contratação) — decisão de PULAR o spotlight, registrada
  // aqui pra não virar pergunta esquecida (regra 12): o botão "Desfazer" só
  // existe no card de um candidato JÁ contratado, e não há candidato
  // contratado na tela até haver um. Alvo ausente se auto-marca como visto,
  // então o aviso morreria antes de existir alguém pra quem ele importa.
  // Além disso é saída de exceção: quem precisa dela vai procurar no card da
  // pessoa exata, que é onde o botão está. Changelog e tutorial cobrem.
  //
  // ALVO: o campo "Posições" mora DENTRO do modal Nova Vaga, que não existe
  // até alguém abrir — alvo ausente se auto-marca como visto (ver
  // FeatureSpotlight.jsx). Ancora no botão que abre o modal, que é o
  // caminho real até a novidade. Ele depende de `canWrite` + view "vagas"
  // (o padrão da tela), ou seja: aparece justamente pra quem cadastra vaga,
  // que é quem precisa saber disso.
  {
    id: "vaga-posicoes",
    route: "rh-recrutamento",
    target: '[data-tour="vaga-posicoes"]',
    text: "Vaga para mais de uma pessoa: o formulário agora tem o campo \"Posições\". Preenchendo mais de 1, o card da vaga passa a mostrar quantas já foram contratadas — e avisa quando fecha.",
    version: "5.8.0",
  },
  // ALVO, decisão registrada (achado do QA desta entrega): o elemento que
  // REPRESENTA a novidade é a coluna "Concluído" — mas ela só existe na view
  // Kanban, e a faixa das arquivadas só existe quando há arquivada. Alvo que
  // não aparece se auto-marca como visto (ver FeatureSpotlight.jsx), ou seja,
  // ancorar num dos dois queimaria o aviso pra quem abrisse em Lista. Ancora
  // no botão "Kanban", que existe em toda abertura da tela, e o TEXTO manda
  // olhar pro lugar certo em vez de fingir que o botão é a novidade.
  {
    id: "todo-concluido-arquivar",
    route: "personal-tasks",
    target: '[data-tour="todo-concluido-arquivar"]',
    text: "Abra o Kanban: a coluna Concluído parou de nascer vazia. Concluir e arquivar deixaram de ser o mesmo gesto — a tarefa concluída fica à vista, e só sai do quadro quando você arquiva, na mão ou sozinha depois do prazo que escolher em Configurações.",
    version: "5.7.0",
  },
  {
    id: "importar-pessoas",
    route: "rh-funcionarios",
    target: '[data-tour="importar-pessoas"]',
    text: "Novo: dá pra cadastrar gente por planilha. Você vê o que vai ser criado e o que vai ser alterado antes de confirmar — nada é gravado às cegas.",
    version: "5.6.0",
  },
  // 5.6.0 (comunicado alcança ficha sem login) — decisão de PULAR o
  // spotlight: a mudança não tem elemento próprio na tela pra apontar. O que
  // muda é o NÚMERO da prévia de alcance, que a tela de Comunicação já mostra
  // por conta própria antes de enviar. Vai pelo changelog, com `roles` de RH.
  {
    // ALVO CONDICIONAL (registrado 14/09/2026, achado da varredura visual do
    // Cowork): o botão é `{canWrite && …}` em RHBemEstarView.jsx:491 — só
    // existe pra quem pode escrever. Pros demais, alvo ausente se auto-marca
    // como visto, que é o comportamento certo aqui.
    id: "programas-novo",
    route: "rh-bem-estar",
    target: '[data-tour="programas-novo"]',
    text: "Bem-estar virou Programas: um programa agora tem várias datas com um link só, vagas por horário e lista de espera. Dá pra gerar a série inteira de uma vez (toda segunda, a cada 15 dias).",
    version: "5.5.0",
  },
  // 5.5.0 (documentos de admissão no Onboarding) — decisão de PULAR o
  // spotlight, registrada aqui como a regra 12 pede, e pelo mesmo motivo do
  // campo Gestor logo abaixo: a seção nova vive DENTRO da aba "Form" do
  // drawer de um colaborador, que não existe na rota até alguém abrir um
  // card. Apontado pra um alvo ausente, o FeatureSpotlight se marca como
  // visto em silêncio (timer de órfão) pra todo mundo que abrir Onboarding —
  // inclusive pra quem precisava dele. Vai pelo toast do changelog, com
  // `roles` de RH e DP, e pelo tutorial de Onboarding.
  //
  // 5.5.0 (comunicado com leitura/imagem/modelos) — o spotlight de Comunicação
  // já existe na 5.3.0 apontando pro mesmo bloco de canais; um segundo aviso
  // na mesma tela, na mesma semana, vira ruído. Novidade vai pelo changelog.
  // 5.4.0 (nome de quem respondeu na pesquisa identificada) — decisão de
  // PULAR o spotlight, registrada aqui como a regra 12 pede. A novidade vive
  // DENTRO do modal de resultados, que só existe depois de clicar em "Ver
  // respostas" numa pesquisa identificada. O FeatureSpotlight tem timer de
  // órfão (FeatureSpotlight.jsx:110): apontado pra um alvo que não está na
  // rota, ele se marca como visto em silêncio pra todo mundo que abrir
  // Comunicação — inclusive pra quem precisava dele. Mesmo motivo do campo
  // Gestor, na 4.98.0. Vai pelo toast do changelog, com `roles` de RH.
  {
    // ALVO CONDICIONAL (registrado 14/09/2026, achado da varredura visual do
    // Cowork): vive DENTRO do formulário de novo comunicado
    // (RHComunicacaoView.jsx:160), não na tela em repouso — só existe depois
    // de abrir a composição.
    id: "comunicado-canais",
    route: "rh-comunicacao",
    target: '[data-tour="comunicado-canais"]',
    text: "Novo: escolha por onde o comunicado vai. E-mail alcança quem desligou o sino, e a prévia mostra quantas pessoas cada canal atinge antes de você enviar.",
    version: "5.3.0",
  },
  {
    id: "tarefas-arquivo",
    route: "marketing-tarefas",
    target: '[data-tour="tarefas-arquivo"]',
    text: "Novo: tarefa antiga pode ser arquivada. Ela sai do quadro e continua no CSV — o filtro \"Arquivamento\" traz de volta quando você precisar.",
    version: "4.99.0",
  },
  // 4.98.0 (campo Gestor na ficha) — decisão de PULAR o spotlight, registrada
  // aqui como a regra 12 pede. O elemento que representa a novidade é um
  // campo dentro do drawer, em modo de edição: não existe na rota quando a
  // pessoa chega. O FeatureSpotlight tem um timer de órfão que marca o aviso
  // como visto quando o alvo não aparece (FeatureSpotlight.jsx:110) — um
  // spotlight apontado pra lá seria consumido em silêncio por todo mundo que
  // abrisse Funcionários sem editar ninguém, inclusive por quem precisava
  // dele. Ancorar no botão "Minha equipe" tem o mesmo problema: ele só
  // renderiza pra quem já lidera alguém, e hoje ninguém lidera. A novidade
  // vai pelo toast do changelog (com `roles` de RH) e pelo passo novo no
  // tutorial "Gerenciando funcionários". Se um dia o mecanismo souber
  // esperar por alvo dentro de drawer, isto vira uma entrada de verdade.
  {
    id: "abm-tabela",
    route: "abm",
    target: '[data-tour="abm-tabela"]',
    text: "Novo: contas de conteúdo, uma por empresa. Fit e comitê vêm do Funil e de Clientes — clique na conta pra abrir o negócio.",
    version: "4.97.0",
  },
  {
    // ALVO CONDICIONAL (registrado 14/09/2026, achado da varredura visual do
    // Cowork): está no fundo de uma aba interna de Configurações
    // (SettingsView.jsx:2377) — a rota abre noutra aba, então o alvo não
    // existe na 1ª carga.
    id: "captura-utm-dica",
    route: "settings",
    target: '[data-tour="captura-utm-dica"]',
    text: "Novo: o link de captura de leads aceita UTM. Cole source/medium/campaign/content na URL — a origem fica escondida no formulário e liga o lead à campanha de Conteúdo.",
    version: "4.96.0",
  },
  {
    id: "marketing-conteudo-report",
    route: "marketing-conteudo",
    target: '[data-tour="marketing-conteudo-report"]',
    text: "Novo: relatório de Conteúdo com o motor das Feiras e conversão por conta — mesma empresa, dois toques, uma conversão. Campanhas no formato frente-aaaamm-tema.",
    version: "4.97.1",
  },
  {
    id: "entregas-busca-card",
    route: "marketing-entregas",
    // Alvo é o próprio campo de busca — aqui existe elemento estável pra
    // apontar (ao contrário do spotlight dos chips, que só aparecem na
    // exceção), então aponta direto pra coisa nova.
    target: '[data-tour="entregas-busca-card"]',
    text: "Novo: busque um card pelo título, número, quem pediu ou campanha. Vale nas quatro visões do board.",
    version: "4.86.0",
  },
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
  // 4.61.0 — "proposal-line-items" REMOVIDA em 15/09/2026. O alvo era o botão
  // "Adicionar item" do ProposalPanel, que deixou de existir quando a aba PDF
  // virou o gerador de proposta de RFP. Alvo ausente é dispensado em silêncio
  // pelo FeatureSpotlight (ORPHAN_TIMEOUT_MS), mas custava 4s de atraso ao
  // próximo spotlight da rota "crm" pra quem ainda não tinha visto este —
  // `use-feature-spotlight` devolve só o primeiro pendente.
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
  {
    id: "viagens-prestacoes-previsto",
    route: "crm-viagens",
    target: '[data-tour="viagens-prestacoes-previsto"]',
    text: "Agora a prestação de contas mostra o valor que o vendedor previu na calculadora, e o quanto o gasto ficou acima ou abaixo dele — não é limite, é só contexto pra decidir.",
    version: "4.87.0",
  },
  // Alvo é o CABEÇALHO da seção "Prestações a decidir", não uma linha da
  // fila: o cabeçalho existe sempre na tela do gestor (a fila vazia só troca
  // o conteúdo por um EmptyState), enquanto uma linha só existe em mês com
  // prestação pendente. Ancorar numa linha faria o gestor que abrisse a tela
  // num mês calmo consumir o spotlight em silêncio (o runtime marca órfão
  // como visto depois do timeout) e nunca mais vê-lo. Vendedor nesta mesma
  // rota também consome em silêncio — inevitável com âncora por rota, e sem
  // prejuízo: o aviso é sobre uma informação que só aparece pro gestor.
  //
  {
    id: "crm-busca-card",
    route: "crm",
    target: '[data-tour="crm-busca-card"]',
    text: "Novo: ache um negócio digitando o nome da empresa ou o responsável. Vale nas quatro visões — Kanban, Tabela, Calendário e Análise.",
    version: "4.90.1",
  },
  {
    id: "rh-busca-card",
    route: "rh-onboarding",
    // EM ABERTO (14/09/2026): a varredura visual do Cowork não achou este alvo
    // na 1ª carga de /rh/onboarding com usuário admin. Diferente dos três
    // acima, este NÃO é condicional — a busca é declarada fora do bloco de
    // `viewMode` (RHOnboardingView.jsx:1673-1679, seguindo a regra 11) e o
    // `FilterBar` repassa o atributo (FilterBar.jsx:35). Ou a medição
    // aconteceu antes de a view terminar de carregar, ou há algo que a leitura
    // de código não mostra. Precisa de navegador pra fechar — não inventar
    // explicação.
    target: '[data-tour="rh-onboarding-busca-card"]',
    text: "Novo: os boards de RH ganharam busca. Digite o nome do colaborador (ou cargo, departamento, vaga) e o quadro filtra na hora, em qualquer visão.",
    version: "4.90.1",
  },
  // As duas entradas acima cobrem a busca de card DENTRO do board — rollout
  // do padrão de Entregas (4.86.0) pros outros 11 boards, 01/09/2026.
  // DELIBERADAMENTE 2, não 11: o mecanismo dispara por ROTA, então 11
  // entradas seriam 11 avisos pra quem circula pela plataforma inteira, todos
  // dizendo a mesma coisa. Uma por família de departamento resolve — quem
  // entende a busca no board que usa todo dia entende nos outros. Marketing
  // não precisa de entrada nova: já recebeu `entregas-busca-card` na 4.86.0.
  // Os demais boards receberam a mesma busca sem spotlight próprio (esta
  // linha citava "9", e a spec do rollout citava 11 no título e listava 12 —
  // três contagens diferentes pro mesmo conjunto. O número exato não muda
  // nada aqui e envelhece a cada board novo, então some). Pós-venda, Comex e Central de Bugs já têm o `data-tour`
  // posto (`posvenda-busca-card`, `comex-busca-card`, `bugs-busca-card`) —
  // atributo sem entrada aqui é inerte, não quebra nada, e deixa o alvo
  // pronto se um dia alguém quiser destacar um deles.
  // Descrição editável de página (4.91.0). Rota "crm" e não "dashboard": o
  // alvo é o slot de descrição do PageTitle, que o Funil de Vendas renderiza
  // sempre — pro admin ele aparece como o botão "+ descrição" mesmo numa
  // página que ainda não tem texto nenhum, que é justamente o que precisa
  // ser descoberto. Quem não é admin não vê o alvo e o runtime pula em
  // silêncio, correto: a edição é admin-only pela RLS.
  {
    id: "descricao-pagina-editavel",
    route: "crm",
    target: '[data-tour="page-description"]',
    text: "Novo: a descrição ao lado do título da página virou texto seu. Clique no lápis (ou em \"+ descrição\") e escreva o que esta tela significa pro time — vale pra todo mundo, sem depender de atualização do sistema.",
    version: "4.91.0",
  },
  {
    id: "busca-global-escopo",
    route: "dashboard",
    target: '[data-tour="busca-global"]',
    text: "A busca do topo agora acha cliente e entrega, além de negócio — e o texto dela passou a citar só o que VOCÊ encontra, em vez de prometer categorias travadas pro seu cargo.",
    version: "4.89.1",
  },
  // Rota "dashboard" porque o gatilho vive na TopBar, presente em toda tela —
  // qualquer rota serviria, e o dashboard é onde a maioria entra. Só desktop
  // (o botão é `isDesktop`); no celular o spotlight não acha alvo e o runtime
  // pula em silêncio, que é o correto: no celular a busca não tem gatilho
  // visível pra apontar.
  {
    id: "crm-ia-na-analise",
    route: "crm",
    target: '[data-tour="crm-view-analise"]',
    text: "\"Perguntar à IA\" saiu do botão flutuante e agora fica dentro da Análise — clique aqui. Ela responde sobre os números do funil (total, por etapa, por responsável), não sobre um negócio específico.",
    version: "4.88.0",
  },
  // Alvo é o botão "Análise" do toggle de views, não o próprio "Perguntar à
  // IA": o botão novo só existe DENTRO da view Análise, que não é a view
  // padrão (Kanban é) — ancorar nele significaria não disparar pra quase
  // ninguém. O toggle existe sempre na rota. Este é um caso em que o
  // spotlight é mais necessário que o normal: o botão não é novo, ele SUMIU
  // de onde estava, e quem já usava não tem como adivinhar sozinho pra onde
  // foi (a regra 12 do CLAUDE.md cobre "novidade não-óbvia"; sumiço de algo
  // familiar é o mesmo problema, do avesso).
  //
  // O guardrail de escopo do prompt e o rodapé do painel NÃO ganharam
  // spotlight próprio: o texto do spotlight acima já diz sobre o que a IA
  // responde, e o rodapé é ambiente (se lê ao usar, não se descobre
  // clicando) — mesmo critério das colunas mais largas em 4.59.0.
  //
  // 4.87.0 — o fix de "Devolver para a agência" (Entregas) NÃO ganhou
  // spotlight: é correção de algo que já deveria funcionar, mesmo critério
  // de bug fix da regra 12 do CLAUDE.md. Coberto pelo changelog 4.87.0.
  {
    id: "reportar-problema-topbar",
    route: "dashboard",
    target: '[data-tour="reportar-problema"]',
    text: "Achou algo errado? Este botão reporta na hora, de qualquer tela — a plataforma anexa sozinha o navegador e o erro técnico, você não precisa tirar print.",
    version: "4.92.0",
  },
  // Ancorado no Início, não na tela onde o bug aparece: o ícone vive na
  // TopBar e existe em TODAS as rotas, mas o mecanismo mostra um spotlight
  // por rota — apontar na primeira tela que a pessoa abre é o que garante
  // que ela veja. O botão "Reportar isso" da tela de erro NÃO ganhou
  // spotlight próprio: ele só existe quando algo já quebrou, e um tooltip
  // por cima de uma tela de erro seria ruído — o texto do botão se explica.
  //
  // 4.93.0 — contador e aviso da fila da IA: DECIDIDO PULAR o spotlight, e o
  // motivo é concreto, não preguiça. O alvo seria o contador ao lado de
  // "Agentes", que só é renderizado quando há fila; hoje a fila está em ZERO,
  // então o elemento não existe na tela e o runtime marcaria o spotlight como
  // órfão — visto, sem nunca ter aparecido (mesma armadilha já registrada no
  // alvo de "Prestações a decidir"). Some-se a isso que o público são 3
  // pessoas (1 admin + 2 gerentes), que ouvem a novidade direto. Coberto pelo
  // changelog 4.93.0.
  //
  // 4.98.0 — lista completa em Configurações → Módulos: DECIDIDO PULAR o
  // spotlight. O painel só monta na aba Administração → Módulos, e o
  // mecanismo ancora na rota `settings` (qualquer aba). Apontar um
  // `data-tour` que não existe no Perfil (pouso da tela) marcaria o aviso
  // como visto sem nunca aparecer. Público = admin. Coberto pelo changelog.
];

export default FEATURE_SPOTLIGHTS;
