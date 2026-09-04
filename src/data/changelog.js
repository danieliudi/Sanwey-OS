// Normalmente escrito por scripts/extract-changelog.mjs (modo --apply), a
// partir de frases "Changelog: ..." nos commits — mas nenhum commit até aqui
// usou esse trailer, então esta primeira entrada (4.1.0) foi curada à mão a
// partir do histórico real. Script continua valendo pros próximos releases.
// Mais novo primeiro. A entrada "4.0.0" (itens vazios) existe só como piso:
// todo usuário que já usava a plataforma antes desta feature ir ao ar tem
// esse valor gravado em silêncio (ver use-changelog-notice.js) — sem ela,
// ninguém veria os itens da 4.1.0 abaixo.
//
// Cada item é { kind, text, roles? } — `kind` é "novo" | "correcao" | "ajuste",
// usado pra colorir a etiqueta na aba "Novidades" (TutoriaisView) e no toast
// (App.jsx). Migrado de string solta pra objeto quando a aba "Novidades" foi
// criada (30/07/2026) — antes disso, o prefixo ("Novo:"/"Correção:") vivia
// dentro do próprio texto.
//
// `roles` (opcional, adicionado 30/07/2026 a pedido do Daniel): lista de
// cargos (mesmo vocabulário de `profiles.roles`) pra quem esse item é
// relevante — filtra só o TOAST (use-changelog-notice.js), nunca a aba
// "Novidades", que sempre mostra o histórico completo. Sem `roles` = item
// global, aparece pro toast de todo mundo — esse é o padrão seguro quando a
// mudança não é claramente de um departamento só (ex.: um campo novo num
// formulário que qualquer pessoa da empresa preenche). admin/diretoria
// sempre veem tudo, tenha `roles` ou não.

export const CHANGELOG = [
  {
    version: "4.97.3",
    items: [
      {
        kind: "correcao",
        text: "Quando a esteira aprova um pacote de conteúdo, a entrega de marketing chega pra agência com instruções (peças a produzir), imagens anexadas quando a URL é pública, e o responsável preenchido com quem aprovou — antes ia só título e descrição, sem dono no card. Se a entrega for apagada, em Aprovados aparece \"Gerar entrega de novo\".",
        roles: ["admin", "marketing", "gerente_marketing", "agencia", "diretoria"],
      },
    ],
  },
  {
    version: "4.97.2",
    items: [
      { kind: "correcao", text: "Em Contas · ABM, a conversão por conta agora mostra de quantas contas ela saiu. Com poucas contas decididas ela aparece como fração (2/3) em vez de porcentagem — uma conta ganha e nenhuma perdida exibia \"100%\", que era verdade e enganava ao mesmo tempo." },
    ],
  },
  {
    version: "4.97.1",
    items: [
      {
        kind: "ajuste",
        text: "No Relatório de Conteúdo, duas pessoas da mesma empresa deixam de contar como duas conversões: o motor das Feiras continua no lead (custo, CAC, idade); por cima entra a conta (cliente ou CNPJ).",
        roles: ["admin", "gerente", "marketing", "gerente_marketing", "diretoria"],
      },
    ],
  },
  {
    version: "4.97.0",
    items: [
      {
        kind: "novo",
        text: "Contas · ABM no menu Comercial: leads de conteúdo aparecem agrupados por empresa (cliente ou CNPJ), com fit score e comitê de compra — dois contatos da mesma conta não contam como duas conversões.",
        roles: ["admin", "gerente", "vendedor", "diretoria"],
      },
      {
        kind: "ajuste",
        text: "O fit score do Funil deixa de nascer zerado: na criação do negócio (e na importação de feira) já grava a pontuação de segmento, valor e recência. No celular, o Kanban também ordena por Fit.",
        roles: ["admin", "gerente", "vendedor"],
      },
    ],
  },
  {
    version: "4.96.0",
    items: [
      {
        kind: "novo",
        text: "Link de captura pública aceita UTM (source, medium, campaign, content). A origem fica escondida no formulário e, com a migration liberada, o lead já nasce ligado à campanha de Conteúdo.",
        roles: ["admin", "gerente", "marketing", "gerente_marketing", "vendedor"],
      },
      {
        kind: "ajuste",
        text: "Em Configurações → Captura pública, a dica do link de leads mostra o exemplo completo de UTM (não só ?src=).",
        roles: ["admin", "gerente", "marketing", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.95.0",
    items: [
      {
        kind: "novo",
        text: "Relatório de Conteúdo em Marketing — mesmo motor das Feiras (custo, leads, CAC e retorno na mesma idade), filtrando campanhas Conteúdo e Digital. Testes (is_demo) ficam de fora.",
        roles: ["admin", "gerente", "marketing", "gerente_marketing", "diretoria"],
      },
      {
        kind: "ajuste",
        text: "Campanha de canal Conteúdo ou Digital exige o nome no formato frente-aaaamm-tema (ex.: resibag-202609-rapp). Fora disso, o relatório agrega errado.",
        roles: ["admin", "gerente", "marketing", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.94.0",
    items: [
      {
        kind: "novo",
        text: "Ao criar um negócio, dá pra marcar a campanha de origem (feira ou conteúdo) e se o registro é teste. Sem campanha, o lead fica como origem não registrada — não inventamos distribuição. No drawer, o seletor de origem agora inclui campanhas de Conteúdo e Digital, além de Evento.",
        roles: ["admin", "gerente", "vendedor", "marketing", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.93.0",
    items: [
      {
        kind: "novo",
        text: "A fila de sugestões da IA passou a avisar. Aparece um contador ao lado de \"Agentes\" no menu assim que algo chega, e um aviso no sino quando passa de um dia sem decisão — um aviso por dia somando tudo, nunca um por sugestão. A partir de três dias o aviso fica âmbar e diz há quanto tempo está parado.",
        roles: ["admin", "gerente", "gerente_rh", "diretoria"],
      },
    ],
  },
  {
    version: "4.92.0",
    items: [
      {
        kind: "novo",
        text: "Reportar um problema ficou de 1 clique. Quando uma tela dá erro, agora aparece o botão \"Reportar isso\" ali mesmo — sem sair de onde você está e sem digitar nada. E existe um ícone fixo de inseto na barra do topo para quando algo sai errado sem dar erro na tela (o comentário que sumiu, o filtro que veio vazio).",
      },
      {
        kind: "ajuste",
        text: "O formulário de reportar bug pede uma frase, não mais quatro campos. A tela em que você está já vem preenchida, e a plataforma anexa sozinha o navegador e o erro técnico — você não precisa mais tirar print para provar o que viu.",
      },
    ],
  },
  {
    version: "4.91.3",
    items: [
      {
        kind: "correcao",
        text: "O botão vermelho \"Novo card\" que flutua no canto inferior esquerdo deixou de ficar em cima do quadro. Ele cobria o último card da primeira coluna e a barra de rolagem horizontal do board — agora o quadro termina acima dele. Vale para os 13 quadros da plataforma de uma vez.",
      },
    ],
  },
  {
    version: "4.91.2",
    items: [
      {
        kind: "correcao",
        text: "A Central de Bugs deixou de ser alcançável por quem tem acesso de Agência. O item nunca apareceu no menu desse perfil, mas digitar o endereço direto no navegador abria a tela — agora a rota redireciona para Campanhas, igual às outras que já eram bloqueadas.",
        roles: ["admin", "diretoria"],
      },
      {
        kind: "correcao",
        text: "Duas bordas usavam a cor errada. No formulário de novo card do Funil, o campo Setor nascia com a borda na cor da marca — que muda por frente, então na Resibag \"falta preencher\" aparecia em verde, e um campo vazio ficava igual a um campo em foco. E o seletor de empresa do Funil e do Chat tinha uma borda cinza-clara fixa, que não escurecia no modo escuro.",
      },
      {
        kind: "correcao",
        text: "O filtro de Empresa em Pedidos e no Catálogo mostrava duas opções que faziam a mesma coisa — \"Todas as empresas\" e \"Visão Grupo\" eram o mesmo filtro, listado duas vezes. Aparecia para quem tem acesso a mais de uma frente.",
        roles: ["vendedor", "gerente", "admin", "diretoria"],
      },
      {
        kind: "correcao",
        text: "No celular, o cabeçalho de cada etapa do quadro voltou a ser navegável pelo teclado. O botão de ordenar ficava dentro do botão que abre e fecha a etapa — quem usa teclado ou leitor de tela não alcançava o de dentro. Para quem usa o dedo ou o mouse nada muda.",
      },
      {
        kind: "correcao",
        text: "Abrir uma solicitação em Compras voltou a funcionar. Desde 18/08 o painel de detalhe quebrava assim que o card era aberto — sobrava a tela de erro e não havia como chegar em cotações, aprovação ou nota fiscal. Efeito colateral do ajuste que corrigiu o erro ao aprovar; a tela de aprovação em si continuou certa.",
        roles: ["marketing", "gerente_marketing", "admin", "diretoria"],
      },
      {
        kind: "correcao",
        text: "Anotação feita sem internet deixou de sumir. Se você registrava uma atividade num lead offline e, ao voltar a conexão, a tela ainda não tinha terminado de carregar a lista de leads, a anotação era descartada em silêncio — parecia salva e não estava. Agora ela espera o lead chegar e só é descartada se o lead tiver sido mesmo excluído.",
        roles: ["vendedor", "gerente", "admin"],
      },
      {
        kind: "correcao",
        text: "Taxa de turnover passou a ser calculada sobre a base certa. A conta dividia os desligamentos só pelo número de quem está ativo hoje, o que inflava o percentual — quem saiu não entrava no total. Agora o total inclui ativos + desligados do período, e uma base vazia mostra \"—\" em vez de um número inventado.",
        roles: ["rh", "gerente_rh", "diretoria", "admin"],
      },
      {
        kind: "correcao",
        text: "A planilha de movimentações do RH deixou de exportar variação de salário como \"infinito\". Promoção lançada sem salário anterior preenchido gerava uma célula quebrada no CSV; agora essas linhas ficam de fora do cálculo da variação média.",
        roles: ["rh", "gerente_rh"],
      },
    ],
  },
  {
    version: "4.91.1",
    items: [
      {
        kind: "novo",
        text: "A descrição ao lado do título de cada página agora é editável. Onde antes havia um texto fixo (\"Kanban de entregas de campanha\"), o administrador clica no lápis — ou em \"+ descrição\", numa página que ainda não tem uma — e escreve o que aquela tela significa pro time. Vale pra todo mundo na hora, sem depender de atualização do sistema.",
        roles: ["admin"],
      },
      {
        kind: "correcao",
        text: "Suporte comercial passou a enxergar de verdade a página Clientes. O item já aparecia no menu para esse cargo, mas a lista vinha vazia — agora traz os clientes das frentes da pessoa. Continua sendo só consulta: editar cadastro segue com vendedor e gerência.",
        roles: ["admin", "suporte"],
      },
      {
        kind: "novo",
        text: "Cada etapa de quadro pode ganhar uma descrição própria — \"o que precisa acontecer nesta fase\". Escreva em Editar fase → Descrição; ela aparece ao passar o mouse sobre o nome da etapa, tanto no cabeçalho da coluna quanto no menu \"Mover para\", que é onde ela mais ajuda: na hora de decidir pra onde mandar o card.",
        roles: ["admin", "gerente", "gerente_rh", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.90.4",
    items: [
      {
        kind: "correcao",
        text: "Aviso de erro deixou de nascer atrás do painel de detalhe. Em Comex, Pós-venda, Férias, Campanhas e Tarefas, quando uma gravação era recusada, o aviso vermelho aparecia por baixo da tela escurecida — você clicava, nada acontecia e não havia como saber por quê. Agora ele aparece por cima de qualquer painel ou janela aberta.",
      },
      {
        kind: "correcao",
        text: "Envio em massa no Onboarding passou a respeitar a busca. Se você selecionava vários colaboradores e depois digitava algo no campo de busca, o envio de convite valia também para quem a busca tinha escondido. Mesma correção já feita em Recrutamento; agora vale também para a seleção em massa de Funcionários.",
        roles: ["rh", "gerente_rh"],
      },
      {
        kind: "correcao",
        text: "Datas gravadas depois das 21h deixaram de cair no dia seguinte. Data de desligamento, prazo de checklist de onboarding, data de evento de contrato de fornecedor, ata de visita e mais uma dezena de campos gravavam a data no fuso de Londres — quem lançava à noite via o dia errado no cadastro. O lembrete de \"vence hoje\" pelo sino, pelo mesmo motivo, tocava um dia antes.",
      },
      {
        kind: "correcao",
        text: "Em Entregas, \"atrasada\" quer dizer a mesma coisa em toda a tela. O filtro \"Atrasadas\" contava certo, mas a coluna Prazo, o chip da Lista, o número da aba Análise e o Painel de Marketing usavam outra conta e pintavam de vermelho, a partir das 21h, entregas que vencem hoje. O \"SLA cumprido\" do Painel de Marketing também subestimava: entrega concluída no próprio dia do prazo contava como fora do prazo.",
        roles: ["marketing", "gerente_marketing", "agencia"],
      },
      {
        kind: "correcao",
        text: "Filtros de board pararam de empurrar os botões para fora da linha. Um nome de responsável ou de campanha muito longo esticava o campo de filtro sem limite — visível em Entregas, Tarefas de Marketing, Treinamentos e Pedidos.",
      },
      {
        kind: "correcao",
        text: "Esc fecha uma janela por vez. No cadastro de colaborador e na captura de documento, apertar Esc fechava a janela e o painel por trás dela de uma vez só.",
        roles: ["rh", "gerente_rh"],
      },
      {
        kind: "correcao",
        text: "No Histórico do funil, a primeira coluna (cliente) deixou de ficar transparente ao rolar para o lado — as colunas de data passavam por baixo dela.",
        roles: ["vendedor", "gerente", "admin", "diretoria"],
      },
      {
        kind: "ajuste",
        text: "Textos que prometiam mais do que a tela faz foram corrigidos: a busca do Funil acha por empresa e responsável (não por setor), a busca do catálogo de Treinamentos é por título do treinamento, e o chat de IA do funil também responde sobre prática de vendas, não só sobre os números. A contagem de cards do Meu To-do ficou igual no computador e no celular.",
      },
    ],
  },
  {
    version: "4.90.3",
    items: [
      {
        kind: "correcao",
        text: "Recrutamento voltou a abrir. A tela estava caindo em \"Erro ao carregar\" desde a vers\u00e3o anterior \u2014 efeito colateral da pr\u00f3pria corre\u00e7\u00e3o que impediu a reprova\u00e7\u00e3o em massa de atingir candidatos escondidos pela busca. A prote\u00e7\u00e3o continua valendo; s\u00f3 a ordem do c\u00f3digo estava errada.",
        roles: ["rh", "gerente_rh"],
      },
    ],
  },
  {
    version: "4.90.2",
    items: [
      {
        kind: "correcao",
        text: "A busca do topo quebrava em duas linhas e esticava a barra inteira pra baixo. Foi efeito do pr\u00f3prio ajuste que fez o texto citar as categorias do seu cargo: quem enxerga todas as cinco ficava com uma frase longa demais pro espa\u00e7o. O texto encurtou (cita as duas primeiras e reticências) e o campo passou a cortar em vez de quebrar.",
      },
      {
        kind: "correcao",
        text: "O bot\u00e3o flutuante de criar card (\"+ Nova oportunidade\" e equivalentes) aparecia POR CIMA da tela escurecida quando um formul\u00e1rio ou card estava aberto \u2014 vis\u00edvel e clic\u00e1vel, dando pra come\u00e7ar um card novo por baixo do que voc\u00ea j\u00e1 estava preenchendo. Agora ele fica atr\u00e1s de qualquer janela aberta, em todos os boards.",
      },
      {
        kind: "correcao",
        text: "Ao carregar a p\u00e1gina, o conte\u00fado e o bot\u00e3o flutuante nasciam 48 pixels mais \u00e0 direita e saltavam para o lugar um instante depois. Sobra do menu lateral que encolheu de 288 para 240 pixels.",
      },
    ],
  },
  {
    version: "4.90.1",
    items: [
      {
        kind: "correcao",
        text: "Em Recrutamento, sele\u00e7\u00e3o em massa de candidatos agora acompanha a busca. Se voc\u00ea selecionava v\u00e1rios, digitava algo no campo de busca e clicava em \"Reprovar e enviar retorno\", a a\u00e7\u00e3o valia tamb\u00e9m para os candidatos que a busca tinha escondido \u2014 e o e-mail de recusa ia para todos eles. Agora a sele\u00e7\u00e3o \u00e9 podada para o que est\u00e1 vis\u00edvel.",
        roles: ["rh", "gerente_rh"],
      },
      {
        kind: "correcao",
        text: "Em Campanhas, o filtro \"Respons\u00e1vel\" listava apenas quem sobrou do pr\u00f3prio filtro \u2014 escolhido algu\u00e9m, n\u00e3o dava para trocar direto para outra pessoa sem voltar em \"Todos\". Agora ele lista todo mundo que tem campanha.",
        roles: ["marketing", "gerente_marketing"],
      },
      {
        kind: "novo",
        text: "Todos os boards ganharam BUSCA. Digite no campo ao lado do t\u00edtulo e o quadro filtra na hora \u2014 e vale nas quatro vis\u00f5es (Kanban, Tabela, Calend\u00e1rio e An\u00e1lise), n\u00e3o s\u00f3 no Kanban. Cada board busca pelo que o card mostra: neg\u00f3cio por empresa ou respons\u00e1vel; caso de p\u00f3s-venda por cliente; solicita\u00e7\u00e3o de compra por item, n\u00famero ou fornecedor; colaborador por nome, cargo ou departamento; e assim por diante.",
      },
      {
        kind: "ajuste",
        text: "O cabe\u00e7alho de todas as p\u00e1ginas de board encolheu: o t\u00edtulo passou de 26 para 19 pixels e a descri\u00e7\u00e3o foi para o lado dele, em vez de ocupar uma linha pr\u00f3pria. O espa\u00e7o foi todo para os cards. Onde o subt\u00edtulo era um resumo que muda com o filtro (Funil de Vendas, P\u00f3s-venda, Onboarding), ele continua embaixo \u2014 \u00e9 informa\u00e7\u00e3o viva, n\u00e3o r\u00f3tulo.",
      },
      {
        kind: "ajuste",
        text: "Os filtros de sele\u00e7\u00e3o dos boards (respons\u00e1vel, empresa, canal, prazo, departamento, frente) passaram todos a usar o mesmo componente. Antes cada tela desenhava o seu, com pequenas diferen\u00e7as de altura e espa\u00e7amento que apareciam ao trocar de p\u00e1gina.",
      },
      {
        kind: "ajuste",
        text: "Em Treinamentos, a busca do cat\u00e1logo passou a ignorar acento: procurar por \"seguranca\" agora acha \"Seguran\u00e7a\". Antes n\u00e3o achava, e parecia que o treinamento n\u00e3o existia.",
      },
    ],
  },
  {
    version: "4.89.1",
    items: [
      {
        kind: "novo",
        text: "A busca do topo (Ctrl+K) agora encontra tamb\u00e9m CLIENTES e ENTREGAS, al\u00e9m de neg\u00f3cios, campanhas e funcion\u00e1rios. Cliente d\u00e1 pra achar por nome, raz\u00e3o social, categoria, cidade ou CNPJ; entrega, por t\u00edtulo, n\u00famero de protocolo, quem pediu ou departamento. O resultado abre a mesma tela de sempre.",
      },
      {
        kind: "ajuste",
        text: "O texto da busca deixou de prometer o que voc\u00ea n\u00e3o pode achar. Antes dizia sempre \u201cBuscar lead, campanha, funcion\u00e1rio\u2026\u201d, mas campanhas e funcion\u00e1rios s\u00f3 abrem para quem \u00e9 de Marketing e de RH \u2014 agora ele cita s\u00f3 as categorias do seu perfil. E um rodap\u00e9 fixo lembra que a busca cobre apenas o que voc\u00ea j\u00e1 tem acesso, pra n\u00e3o confundir permiss\u00e3o com falha.",
      },
      {
        kind: "ajuste",
        text: "Sumiu a faixa \u201cArraste para mover \u00b7 \u2018+\u2019 para criar \u00b7 Clique para ver detalhes\u201d do rodap\u00e9 dos boards. As tr\u00eas a\u00e7\u00f5es se aprendem no primeiro uso, e o texto custava altura em toda sess\u00e3o \u2014 o espa\u00e7o foi para os cards.",
      },
      {
        kind: "correcao",
        text: "A busca do topo tamb\u00e9m respeita agora o acesso por m\u00f3dulo: se \"Clientes\" (ou qualquer outra p\u00e1gina) estiver desligada para voc\u00ea, ela deixa de aparecer nos resultados \u2014 antes s\u00f3 sumia do menu.",
      },
      {
        kind: "correcao",
        text: "Em Ajuda & Tutoriais, o assistente de IA do funil estava descrito pelo bot\u00e3o antigo e oferecia perguntas prontas que ele nunca teve como responder (neg\u00f3cio a neg\u00f3cio, motivo de perda, tempo m\u00e9dio por etapa). O texto e as perguntas passaram a refletir o que ele realmente recebe: o resumo do funil.",
        roles: ["gerente", "vendedor", "consultor"],
      },
    ],
  },
  {
    version: "4.88.0",
    items: [
      {
        kind: "ajuste",
        text: "\"Perguntar \u00e0 IA\" saiu do bot\u00e3o flutuante do Funil de Vendas e passou a viver dentro da vis\u00e3o An\u00e1lise. Ela responde sobre os n\u00fameros do funil \u2014 total, por etapa, por respons\u00e1vel \u2014 que \u00e9 exatamente o que a An\u00e1lise j\u00e1 mostra em gr\u00e1fico; flutuando sobre o Kanban, competia com o bot\u00e3o de criar neg\u00f3cio e n\u00e3o dizia sobre o que respondia.",
        roles: ["gerente", "vendedor", "consultor"],
      },
      {
        kind: "ajuste",
        text: "O chat do funil agora avisa, no rodap\u00e9, que responde s\u00f3 sobre os n\u00fameros daquele funil e que a resposta \u00e9 gerada por IA. Perguntas fora desse assunto passam a ser recusadas com uma frase, em vez de respondidas.",
        roles: ["gerente", "vendedor", "consultor"],
      },
      {
        kind: "correcao",
        text: "No chat do funil, as etapas aparecem pelo nome que voc\u00ea deu a elas, n\u00e3o mais pelo c\u00f3digo interno. E os exemplos de pergunta deixaram de sugerir algo que a IA n\u00e3o consegue responder: ela recebe o resumo do funil, nunca a lista de neg\u00f3cios um a um.",
        roles: ["gerente", "vendedor", "consultor"],
      },
    ],
  },
  {
    version: "4.87.1",
    items: [
      {
        kind: "correcao",
        text: "No menu lateral, um departamento que voc\u00ea fecha continua fechado ao recolher o menu. Antes ele reabria sozinho no modo estreito, deixando a lista comprida justamente onde ela mais incomoda. Para ver de novo, basta expandir o menu.",
      },
      {
        kind: "ajuste",
        text: "O bot\u00e3o flutuante de criar card ficou menor e deixou de encostar na borda do menu lateral.",
      },
    ],
  },
  {
    version: "4.87.0",
    items: [
      {
        kind: "ajuste",
        text: "Os boards ficaram com mais espaço para os cards. O cabeçalho da coluna passou a caber numa linha só (nome, contagem e SLA juntos), o título da página encolheu e a descrição foi para o lado dele, e o menu lateral estreitou de 288 para 240 pixels. Nada de informação saiu — só parou de ocupar duas linhas o que cabia em uma.",
      },
      {
        kind: "ajuste",
        text: "Ao abrir um card em Entregas, Tarefas de Marketing ou Meu To-Do, as caixinhas de Prazo, Etapa e Departamento no topo saíram. Elas repetiam o que o formulário logo abaixo já mostrava — e, em dois casos, o formulário ainda deixava editar o mesmo valor. Agora a descrição do pedido aparece sem precisar rolar.",
      },
      {
        kind: "novo",
        text: "Criar lead a partir de um sinal agora sugere as empresas já cadastradas em vez de pedir o nome digitado. Escolhendo uma, o lead nasce com CNPJ, setor e cidade preenchidos e vinculado ao cliente — sem virar um segundo cadastro da mesma empresa. Empresa que ainda não está na base continua podendo ser criada pelo nome.",
        roles: ["vendedor", "gerente", "admin", "diretoria"],
      },
      {
        kind: "correcao",
        text: "Em Sinais, o botão \u201cCancelar\u201d ao criar um lead saía para fora da borda do card.",
        roles: ["vendedor", "gerente", "admin", "diretoria"],
      },
    ],
  },
  {
    version: "4.86.0",
    items: [
      {
        kind: "novo",
        text: "Busca de card em Entregas e Tarefas de Marketing. Digite parte do título, do número do card, do nome de quem pediu ou da campanha, e o board mostra só o que bate — em qualquer uma das quatro visões (Kanban, Tabela, Calendário e Análise). Não precisa acertar acento nem maiúscula.",
        roles: ["marketing", "gerente_marketing", "agencia"],
      },
      {
        kind: "ajuste",
        text: "Os filtros desses dois boards passaram a usar o mesmo componente das telas de tabela da plataforma — mesma altura, mesmo espaçamento e mesmo comportamento de foco que você já vê em Funcionários, Cargos e Fornecedores.",
        roles: ["marketing", "gerente_marketing", "agencia"],
      },
    ],
  },
  {
    version: "4.85.1",
    items: [
      {
        kind: "correcao",
        text: "O selo de prazo nos cards de Entregas e Tarefas de Marketing ultrapassava a borda do card em colunas estreitas. A data agora aparece como dia/mês (o ano só quando o prazo cai em outro ano), que era como estava desenhado.",
        roles: ["marketing", "gerente_marketing", "agencia"],
      },
    ],
  },
  {
    version: "4.85.0",
    items: [
      {
        kind: "ajuste",
        text: "Os cards de Entregas e Tarefas de Marketing ficaram mais limpos. Antes todo card vinha colorido mesmo sem nada de errado, e não dava pra saber de longe qual precisava de atenção. Agora um selo só aparece quando pede ação: prazo estourado (o único em vermelho cheio), SLA vencendo, campo obrigatório faltando ou prioridade alta. Card sem selo é card em dia — o “2/2” de campos completos, por exemplo, deixou de aparecer justamente por não pedir nada de ninguém. Comentário novo virou um ponto na foto do responsável.",
        roles: ["marketing", "gerente_marketing", "agencia"],
      },
      {
        kind: "correcao",
        text: "O número do card (P00112 e afins) não corre mais por baixo dos selos quando a coluna está estreita.",
        roles: ["marketing", "gerente_marketing", "agencia"],
      },
      {
        kind: "correcao",
        text: "Entrega ou tarefa que vence hoje não é mais marcada como atrasada. Por causa do fuso, ela passava a contar como vencida às 21h do dia anterior — no card, no filtro “Vencidas” e no contador do resumo.",
        roles: ["marketing", "gerente_marketing", "agencia"],
      },
    ],
  },
  {
    version: "4.84.0",
    items: [
      {
        kind: "novo",
        text: "A calculadora de viagem agora compara o custo da viagem inteira, não só do transporte: entra a hospedagem (mesma diária, mudando só o número de noites) e, pra quem vai de avião, o carro alugado no destino. Quando você informa os locais que vai visitar, ela calcula sozinha se compensa mais alugar ou usar Uber por lá, e usa o mais barato na conta.",
        roles: ["vendedor", "gerente", "admin", "diretoria"],
      },
      {
        kind: "novo",
        text: "Em Viagens & Despesas, depois de montar sua agenda do mês aparece um atalho \"Quer saber o meio mais barato pra essa viagem?\" — ele abre a calculadora já com os endereços das suas saídas planejadas preenchidos, sem precisar digitar nada de novo.",
        roles: ["vendedor", "gerente", "admin", "diretoria"],
      },
      {
        kind: "ajuste",
        text: "Os valores de referência da calculadora (diária de hotel, categoria de carro, R$/km) saíram da frente: ficam recolhidos em \"Ajustar valores\", com faixas prontas pra escolher em vez de número pra digitar. A tela pede cinco coisas, o resto já vem sugerido.",
        roles: ["vendedor", "gerente", "admin", "diretoria"],
      },
    ],
  },
  {
    version: "4.83.0",
    items: [
      {
        kind: "correcao",
        text: "Uma edição que você não tem permissão pra fazer deixa de parecer salva. Antes, em várias telas, o registro aparecia como gravado e só voltava atrás ao recarregar a página. Agora a tela avisa na hora — e, nos casos em que não cabe um aviso (um botão de ligar/desligar, por exemplo), ela volta sozinha pro que está no banco em vez de mostrar a mudança que não foi aceita.",
      },
    ],
  },
  {
    version: "4.82.0",
    items: [
      {
        kind: "correcao",
        text: "Consulta de CNPJ: quando a checagem fiscal falhava, o resultado \"Fiscal não verificado\" ficava preso no cliente por uma semana. Agora é tentado de novo em algumas horas.",
        roles: ["vendedor", "gerente", "consultor"],
      },
      {
        kind: "ajuste",
        text: "Consulta de CNPJ: CNPJ inexistente passa a ser lembrado por algumas horas, em vez de reconsultar a Receita a cada tentativa.",
        roles: ["vendedor", "gerente", "consultor"],
      },
      {
        kind: "ajuste",
        text: "Passa a existir um limite diário de consultas de CNPJ e de uso da IA da empresa nas atas por voz — folgado pro uso normal, protege a cota compartilhada. Quem usa chave de IA própria continua sem limite.",
      },
    ],
  },
  {
    version: "4.81.0",
    items: [
      {
        kind: "ajuste",
        text: "Entregas: o acesso de edição da agência agora fica restrito às etapas \"Encaminhado à Agência\" e \"Em Produção\" — o resto do fluxo é só do time interno.",
      },
    ],
  },
  {
    version: "4.80.0",
    items: [
      {
        kind: "correcao",
        text: "Chat: trocar de conversa rápido podia deixar as mensagens da conversa anterior grudadas na conversa nova — corrigido.",
      },
      {
        kind: "correcao",
        text: "Usuários/Funcionários: uma edição de cargo, empresa ou status sem permissão suficiente parecia salva mesmo sem gravar nada no banco — agora aparece um aviso de erro real.",
      },
    ],
  },
  {
    version: "4.79.0",
    items: [
      {
        kind: "correcao",
        text: "Ajuda & Tutoriais: o botão \"Ir para X\" em 148 dos 173 guias não levava a lugar nenhum — corrigido em todos.",
      },
      {
        kind: "correcao",
        text: "Painel Visão Geral do RH: o bucket \"Férias pendentes\" nunca mostrava as solicitações reais — corrigido.",
      },
      {
        kind: "correcao",
        text: "Configurações → \"Carregar dados de Marketing e RH\" (ambiente de demonstração) sempre falhava na primeira tabela — corrigido.",
      },
    ],
  },
  {
    version: "4.78.0",
    items: [
      {
        kind: "correcao",
        text: "Modo escuro: botão de aprovação de Solicitação de Marketing, painel de \"Overlap detectado\" no Funil de Vendas e chips de setor/\"Você\" em Usuários ficavam praticamente ilegíveis — corrigido.",
      },
      {
        kind: "correcao",
        text: "Onboarding: checklist do colaborador sem tarefas ainda mostrava uma caixa vazia, sem explicação — agora mostra uma mensagem.",
      },
      {
        kind: "correcao",
        text: "Asterisco de campo obrigatório em 8 telas (Férias, Comex, Onboarding, Feedback, Treinamentos, Campanhas, Funil de Vendas) mudava de cor por frente comercial, inclusive ficando verde na Resibag — agora é sempre vermelho.",
      },
    ],
  },
  {
    version: "4.77.0",
    items: [
      {
        kind: "ajuste",
        text: "Pendências: a tela não espera mais TODOS os módulos carregarem pra mostrar alguma coisa — o conteúdo aparece assim que a primeira tarefa chega, com um aviso discreto de 'carregando mais…' enquanto o resto termina.",
      },
    ],
  },
  {
    version: "4.76.0",
    items: [
      {
        kind: "novo",
        text: "Onboarding: agora dá pra atribuir um ou mais responsáveis a cada tarefa criada — aparece como avatar na lista, inclusive pro colaborador ver no próprio checklist.",
      },
    ],
  },
  {
    version: "4.75.0",
    items: [
      {
        kind: "novo",
        text: "Pendências: Tarefas de Marketing, Comex (Exportação e Importação) e Meu To-do agora entram na sua fila — tarefa de marketing atribuída a você, operação de Comex parada há tempo demais na etapa, e tarefa pessoal atrasada.",
      },
    ],
  },
  {
    version: "4.74.0",
    items: [
      {
        kind: "novo",
        text: "Pendências: leads sob sua responsabilidade e leads parados agora têm um botão de IA direto no card — 'Rascunho de e-mail' ou 'Próximo passo' — sem precisar abrir o Funil de Vendas primeiro.",
      },
    ],
  },
  {
    version: "4.73.0",
    items: [
      {
        kind: "novo",
        text: "Pendências: 4 tipos de tarefa agora resolvem direto na fila, sem precisar abrir o card — reciclar um treinamento vencido, recusar uma solicitação de marketing ou uma compra, e reenviar o lembrete de avaliação de desempenho atrasada pro RH.",
        roles: ["admin", "gerente_rh", "marketing", "gerente_marketing"],
      },
      {
        kind: "correcao",
        text: "Recusar uma solicitação de marketing agora avisa se ela já tinha sido decidida por outra pessoa, em vez de sobrescrever em silêncio.",
        roles: ["admin", "marketing", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.72.0",
    items: [
      {
        kind: "novo",
        text: "Funil de Vendas: o card novo agora tem campo de CNPJ com busca automática (preenche razão social, cidade e estado), e avisa quando o nome digitado parece muito com um cliente já cadastrado, pra evitar duplicidade.",
        roles: ["admin", "gerente", "vendedor", "consultor"],
      },
      {
        kind: "novo",
        // Bloco "Pessoa de contato" só aparece pra quem já podia editar o
        // cadastro do cliente (canAddContact em CRMView.jsx) — consultor não
        // vê esse campo, então não entra no roles daqui (achado de QA
        // 27/08/2026: o item anterior incluía consultor por engano).
        text: "Funil de Vendas: já dá pra registrar a pessoa de contato — nome, cargo, e-mail e telefone — direto na criação do card, sem precisar abrir o cadastro do cliente depois.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "ajuste",
        text: "Funil de Vendas: os 4 ícones de 'Pesquisar empresa' no card viraram um único botão 'Pesquisar', e 'Amostras enviadas' agora é um bloco recolhido por padrão (abre sozinho quando já tem amostra registrada) — coluna esquerda do card menos poluída.",
        roles: ["admin", "gerente", "vendedor", "consultor"],
      },
    ],
  },
  {
    version: "4.71.0",
    items: [
      {
        kind: "novo",
        text: "Cadastro de cliente: a busca por CNPJ agora também preenche a Razão Social (com selo de situação cadastral na Receita), e dá pra já cadastrar o contato principal — nome, cargo, e-mail e telefone — direto na criação, sem precisar salvar e reabrir.",
      },
      {
        kind: "correcao",
        text: "Férias & Licenças: quando outro gestor já decidiu o pedido, o card mostra quem aprovou ou recusou e quando, em vez dos botões simplesmente sumirem sem explicação.",
        roles: ["admin", "gerente_rh"],
      },
      {
        kind: "correcao",
        text: "Pendências: o nome do colaborador voltou a aparecer certo nos pedidos de férias aguardando aprovação (antes mostrava só 'Colaborador'), e o alerta de treinamento vencido parou de sumir sozinho quando o sistema atualiza o status pra 'vencido'.",
        roles: ["admin", "gerente_rh"],
      },
    ],
  },
  {
    version: "4.70.0",
    items: [
      {
        kind: "correcao",
        text: "Busca de CNPJ: quando a Receita não encontra a empresa ou a consulta falha, a mensagem agora explica o motivo em português (antes aparecia um erro técnico em inglês, igual pra qualquer causa).",
      },
      {
        kind: "correcao",
        text: "Funil de Vendas: a automação que preenche dados do CNPJ (setor, cidade, UF, CNAE) agora também preenche a razão social do lead, que já era buscada e ficava sem uso.",
      },
    ],
  },
  {
    version: "4.69.0",
    items: [
      {
        kind: "ajuste",
        text: "Meu To-do: campo marcado como obrigatório agora trava mesmo — a tarefa só avança de etapa com os obrigatórios da etapa atual preenchidos, igual já acontece no Funil de Vendas, Entregas e RH. Voltar uma etapa continua livre, e a trava respeita os campos que só aparecem pra certas etiquetas.",
      },
    ],
  },
  {
    version: "4.68.0",
    items: [
      {
        kind: "novo",
        text: "Meu To-do: o formulário da etapa agora pode mudar conforme o tipo da tarefa. Marque a tarefa com uma etiqueta de tipo (Compra, Reunião, Cobrança…) e configure em 'Editar etapas' quais campos aparecem pra cada uma — uma Compra pede fornecedor e valor, uma Reunião pede pauta. Use \"Tipos sugeridos\" dentro do card pra já ter as etiquetas prontas.",
      },
      {
        kind: "correcao",
        text: "Painel de notificações: os filtros (Tudo/Menções/Sistema) não ficam mais espremidos entre o cabeçalho e os cards, e rolar a lista deixou de fechar o painel sozinho.",
      },
    ],
  },
  {
    version: "4.67.3",
    items: [
      {
        kind: "correcao",
        text: "Corrigida a aba selecionada (Detalhes/Checklist/Anexos e equivalentes) ficar ilegível no modo escuro dentro do card aberto — em Campanhas, Entregas, Compras, RH e Meu To-Do.",
      },
    ],
  },
  {
    version: "4.67.2",
    items: [
      {
        kind: "correcao",
        text: "Corrigido contraste ruim das etiquetas do Meu To-Do no modo escuro (card do Kanban e drawer de detalhe) — quase ilegíveis dependendo da frente ativa.",
      },
    ],
  },
  {
    version: "4.67.1",
    items: [
      {
        kind: "correcao",
        text: "Corrigido erro que travava a tela de Configurações → Módulos (\"Erro ao carregar esta tela\") — dois lugares da plataforma disputavam o mesmo canal de atualização em tempo real.",
      },
    ],
  },
  {
    version: "4.67.0",
    items: [
      {
        kind: "novo",
        text: "Configurações → Integrações → \"Secretária de IA\": gere sua própria chave de conexão pra criar tarefas no seu Meu To-Do direto pelo WhatsApp/Telegram da Mia. Cada chave é sua — gere uma pra conta do trabalho e outra pra pessoal, e troque qual está conectada a qualquer momento, sem precisar de suporte.",
      },
    ],
  },
  {
    version: "4.66.0",
    items: [
      {
        kind: "novo",
        text: "Meu To-Do ganhou filtro por prioridade e por prazo, ao lado do filtro de etiqueta que já existia — dá pra ver só as tarefas de Alta prioridade, ou só as de hoje, por exemplo.",
      },
    ],
  },
  {
    version: "4.65.1",
    items: [
      {
        kind: "correcao",
        text: "Meu To-Do: mover uma tarefa para \"Concluído\" agora marca a data de conclusão e cria a próxima ocorrência na hora certa (recorrência); mover para \"Arquivar\" não zera mais essa data. O checkbox da Lista, o calendário e o lembrete de prazo também passam a reconhecer \"Concluído\" como tarefa terminada, não só \"Arquivar\".",
      },
    ],
  },
  {
    version: "4.65.0",
    items: [
      {
        kind: "novo",
        text: "Nova forma de registrar um caso de prospecção (ganhamos/perdemos/andamento): botão \"Registrar aprendizado\" na página do cliente e no Funil de Vendas — fale o que aconteceu, confira o resumo que a IA organizou e salve. Vira base pro playbook de vendas do time.",
        roles: ["admin", "gerente", "vendedor"],
      },
    ],
  },
  {
    version: "4.64.0",
    items: [
      {
        kind: "novo",
        text: "O link de assinatura do calendário (Marketing → Calendário → Sincronizar) agora pode ser trocado a qualquer momento — útil se você compartilhou ou colou o link em algum lugar por engano.",
        roles: ["admin", "marketing", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.63.0",
    items: [
      {
        kind: "correcao",
        text: "Um endereço digitado errado ou uma tela renomeada caía em silêncio no Painel, sem explicar nada — agora mostra um aviso claro com botão pra voltar.",
      },
      {
        kind: "correcao",
        text: "Algumas pessoas apareciam duplicadas em RH → Funcionários (um cadastro vinculado ao login, outro solto) — mesclados; não deve mais acontecer.",
        roles: ["admin", "rh", "gerente_rh"],
      },
    ],
  },
  {
    version: "4.62.0",
    items: [
      {
        kind: "novo",
        text: "Novo menu Inteligência → Mercado: dados do setor (atualizados automaticamente), o antigo painel de Insights (agora numa aba própria) e um cruzamento entre os dois — quais setores em alta já têm negócio aberto no seu funil.",
        roles: ["admin", "gerente", "marketing", "gerente_marketing", "vendedor", "rh", "gerente_rh"],
      },
      {
        kind: "correcao",
        text: "Campos de texto, número, moeda e data continuavam claros no modo escuro (ex.: \"Descrição\" e \"Vencimento\" do modal de Nova despesa) — corrigido em toda a plataforma.",
      },
      {
        kind: "correcao",
        text: "Painel Executivo parava de carregar com \"Erro ao carregar esta tela\" — corrigido.",
        roles: ["admin", "gerente", "gerente_marketing", "gerente_rh", "comex"],
      },
    ],
  },
  {
    version: "4.61.0",
    items: [
      {
        kind: "novo",
        text: "O campo único de \"Decisor\" no Funil de Vendas virou Comitê de Compra: cadastre quantos contatos o cliente tiver (compras, técnico, financeiro...) em Clientes → aba Contatos, em vez de um nome só.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "Etapas do funil agora podem exigir uma condição de campo pra liberar o avanço (ex.: só permite mover se o valor for maior que X) — configure em Funil de Vendas → Editar etapas, no ícone de filtro ao lado de cada etapa de destino.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "Nova tela \"Biblioteca de Documentos\" (menu Comercial): cadastre certificado, datasheet e ficha técnica uma vez e anexe em quantos negócios precisar — acesse também de dentro de um negócio, na aba Anexos → \"Anexar da biblioteca\".",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "A aba \"PDF\" de cada negócio ganhou uma tabela de itens: adicione modelo, quantidade e preço unitário — a proposta gerada por IA e o PDF já usam os valores reais em vez de \"[a definir]\".",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "Negócio com menção a concorrente numa atividade recente (últimos 60 dias) mostra um aviso no card e no topo do detalhe, pra não passar batido.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "O indicador de prioridade (Fit Score) no Funil de Vendas voltou a calcular de verdade — combina aderência de segmento, valor do negócio e tempo parado — e já dá pra ordenar o quadro por ele.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "ajuste",
        text: "Uma aba \"WhatsApp\" apareceu nos negócios do Funil de Vendas — ainda em teste, sem envio nem recebimento ativo (depende de aprovação de número no Meta Business Manager). Por enquanto só mostra \"Nenhuma conversa ainda\".",
        roles: ["admin", "gerente", "vendedor"],
      },
    ],
  },
  {
    version: "4.60.3",
    items: [
      {
        kind: "ajuste",
        text: "Quando a empresa configura uma chave de IA própria, a seção \"Minha chave pessoal\" em Configurações trava sozinha pra quem não é admin/gerente — evita cada pessoa conectando a própria conta de IA por conta própria, sem passar pelo mesmo provedor confiável da empresa.",
      },
    ],
  },
  {
    version: "4.60.2",
    items: [
      {
        kind: "ajuste",
        text: "Removido o Google Gemini das opções de IA (assistente, Gravar ata e agentes) — o plano gratuito da API dele pode usar seus dados pra treinar modelo do Google, diferente de Anthropic e OpenAI, que nunca treinam com dado de API. Quem tinha chave pessoal do Gemini precisa reconectar com outro provedor em Configurações → Integrações de IA.",
      },
    ],
  },
  {
    version: "4.60.1",
    items: [
      {
        kind: "novo",
        text: "Título de Vaga e de Candidato agora é editável direto no card, igual a Campanhas/Entregas/Tarefas/Compras — sem precisar abrir o formulário completo só pra corrigir um nome.",
        roles: ["admin", "gerente", "gerente_rh"],
      },
    ],
  },
  {
    version: "4.60.0",
    items: [
      {
        kind: "novo",
        text: "Tarefas de Marketing ganhou o botão \"Exportar CSV\", igual aos outros 16 boards que já têm.",
        roles: ["admin", "gerente_marketing", "marketing"],
      },
      {
        kind: "ajuste",
        text: "Pós-venda agora mostra o indicador de comentário não lido no card, igual aos outros boards com comentários.",
        roles: ["admin", "gerente", "vendedor", "suporte"],
      },
    ],
  },
  {
    version: "4.59.3",
    items: [
      {
        kind: "correcao",
        text: "No Funil de Vendas, abrir \"Perguntar à IA\" não esmaecia o botão \"+ Nova oportunidade\" ao fundo — mesma causa do fix do card de detalhe, agora corrigida também aqui.",
      },
    ],
  },
  {
    version: "4.59.2",
    items: [
      {
        kind: "correcao",
        text: "O botão flutuante \"+ Nova oportunidade\" (e equivalentes de outros boards) ficava sobreposto ao card de detalhe aberto, tampando parte do formulário — corrigido.",
      },
    ],
  },
  {
    version: "4.59.1",
    items: [
      {
        kind: "correcao",
        text: "No modo escuro, os campos do formulário \"Nova despesa\" (e do teto de orçamento, em Despesas) ficavam com texto quase invisível — corrigido.",
      },
      {
        kind: "correcao",
        text: "Aprovar uma cotação em Compras podia falhar com um erro técnico quando o mesmo fornecedor tinha mais de uma proposta registrada — corrigido.",
      },
    ],
  },
  {
    version: "4.59.0",
    items: [
      {
        kind: "novo",
        text: "\"Gravar ata\" ganhou um botão fixo no topo do card do Funil de Vendas — abre por cima de qualquer aba, sem precisar rolar até Atividades pra achar.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "ajuste",
        text: "Cards/modais de detalhe (Funil de Vendas, Pós-venda, Entregas, Campanhas, Compras, Tarefas de Marketing, Lista Pessoal, Comex e RH) ficaram mais largos, com menos rolagem pra ver a mesma informação.",
      },
      {
        kind: "correcao",
        text: "E-mail de contato muito longo no Funil de Vendas estourava a largura da lateral em vez de cortar com reticências — corrigido.",
      },
    ],
  },
  {
    version: "4.58.1",
    items: [
      {
        kind: "correcao",
        text: "O aviso guiado que aponta pra um item novo do menu podia escurecer a tela inteira sem mostrar nada, quando esse item estava fora da área visível do menu (precisando rolar) — corrigido pra rolar até o item antes de destacá-lo.",
      },
    ],
  },
  {
    version: "4.58.0",
    items: [
      {
        kind: "novo",
        text: "Ata de Visita agora sempre anexa sua localização (endereço legível, não só a coordenada) — sem opção de tirar depois. Se o navegador negar a permissão, a ata salva normalmente mesmo assim.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "Se você já tinha uma visita planejada em Viagens pra esse cliente, a Ata de Visita reconhece e oferece vincular — ao salvar, a visita já é marcada como realizada, sem precisar repetir isso lá.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "Cadastro de Cliente ganhou o campo Endereço, com um botão \"Buscar\" que preenche Endereço/Cidade/UF a partir do CNPJ (mesma busca que já existia em Explorador) quando esses campos estiverem vazios.",
        roles: ["admin", "gerente", "vendedor"],
      },
    ],
  },
  {
    version: "4.57.0",
    items: [
      {
        kind: "novo",
        text: "Menu lateral agora sinaliza com um ícone de frasco as páginas que estão em teste — só quem já enxerga essas páginas (admin ou testador marcado) vê o sinal, ninguém mais.",
        roles: ["admin"],
      },
    ],
  },
  {
    version: "4.56.2",
    items: [
      {
        kind: "correcao",
        text: "Modais com formulário mais longo (ex.: Novo produto do Catálogo) podiam cortar o fim do conteúdo em vez de rolar — corrigido no componente compartilhado, então vale pra qualquer modal da plataforma que passe por isso.",
      },
    ],
  },
  {
    version: "4.56.1",
    items: [
      {
        kind: "correcao",
        text: "Time de Agentes: aprovar uma sugestão de Sinal de Mercado, Prospecção ou Sourcing interno podia travar com um erro — a sugestão ficava marcada como aprovada, mas o sinal/prospect nunca era publicado de verdade. Corrigido; as aprovações que já tinham ficado nesse limbo foram republicadas.",
        roles: ["admin", "gerente"],
      },
    ],
  },
  {
    version: "4.56.0",
    items: [
      {
        kind: "novo",
        text: "Chegou a Central de Bugs: encontrou algo que não devia acontecer? Reporte pelo item \"Central de Bugs\" no menu — qualquer pessoa pode. Quem administra acompanha em um Kanban (Reportado → Em Análise → Correção Proposta → Corrigido) e aprova ou devolve cada correção proposta antes de ir pro ar.",
      },
    ],
  },
  {
    version: "4.55.1",
    items: [
      {
        kind: "correcao",
        text: "Campanhas: comentário digitado pela Agência não estava sendo salvo — a caixa de comentário aparecia ativa mas a permissão de escrita não cobre esse papel no card de Campanha. Agora a caixa fica corretamente desabilitada, em vez de fingir que aceitou o comentário.",
        roles: ["agencia", "marketing", "gerente_marketing"],
      },
      {
        kind: "correcao",
        text: "Correção de fundo em vários quadros (Funil de Vendas, RH, Comex, Compras, Marketing): uma edição sem permissão podia ser tratada como salva mesmo sem ter gravado nada no banco. Agora qualquer edição bloqueada mostra um erro claro, em vez de aparentar sucesso.",
      },
    ],
  },
  {
    version: "4.55.0",
    items: [
      {
        kind: "novo",
        text: "Ata de visita por voz chegou também no Cliente: abra o card do cliente, aba Histórico, e grave uma conversa mesmo sem negócio aberto — visita, ligação, o que for. A tela pergunta se é sobre um negócio já aberto ou algo novo; escolhendo \"Abrir oportunidade\", um negócio nasce sozinho na 1ª etapa, já com o resumo e o próximo passo preenchidos, atribuído a quem gravou.",
        roles: ["admin", "gerente", "vendedor"],
      },
    ],
  },
  {
    version: "4.54.0",
    items: [
      {
        kind: "novo",
        text: "Ata de visita por voz no Funil de Vendas: abra o card do cliente, vá em Atividades e grave um áudio contando como foi a reunião. A IA transcreve, separa o resumo, o próximo passo, a dor, a objeção e o concorrente citado — e mostra tudo para você conferir e corrigir antes de salvar. Nada é gravado sem o seu aceite.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "Quando a ata tem um prazo combinado (\"mando a cotação semana que vem\"), o follow-up do card é atualizado sozinho para a data certa. A etapa do funil nunca muda sozinha — mover continua sendo decisão sua.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "O áudio original fica guardado na aba Anexos do card. Se a transcrição entender algo errado, dá para ouvir de novo e corrigir. Sem microfone ou sem sinal? O botão \"escrever à mão\" organiza do mesmo jeito a partir de texto.",
        roles: ["admin", "gerente", "vendedor"],
      },
    ],
  },
  {
    version: "4.53.1",
    items: [
      {
        kind: "correcao",
        text: "Time de Agentes: sugestões vindas de rotina externa apareciam todas debaixo de um título dizendo \"Agente removido\", como se fossem sobra de um agente apagado. Eram legítimas — 19 delas, de pesquisa de mercado, ficaram meses paradas por isso. Agora aparecem como \"Pesquisa de Mercado\", e \"Agente removido\" só aparece quando a automação realmente foi excluída.",
        roles: ["admin", "gerente", "gerente_rh"],
      },
      {
        kind: "novo",
        text: "Comercial → Sinais deixou de estar vazia: entraram cinco sinais regulatórios que afetam venda — prazo da Anvisa para embalagem de alimento (01/09), transição da NBR 10.004 para resíduo perigoso (31/12), revisão da norma da ANTT, julgamento da Lei de Licenciamento no STF e a nova certificação ABNT de big bags.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "novo",
        text: "Explorador ganhou dez empresas novas para prospectar — e, diferente das que já estavam lá, cada uma tem um motivo datado por trás: fábrica inaugurada, expansão anunciada, licença saindo. O motivo aparece no próprio card.",
        roles: ["admin", "gerente", "vendedor"],
      },
    ],
  },
  {
    version: "4.53.0",
    items: [
      {
        kind: "novo",
        text: "Comercial \u2192 Pedidos: o quadro onde o pedido chega, \u00e9 conferido e vira n\u00famero no Kronosys. J\u00e1 serve hoje, sem depender do portal \u2014 o bot\u00e3o \"Novo pedido\" registra o que chega por WhatsApp, e-mail ou telefone, oferecendo s\u00f3 os produtos liberados para aquele cliente, ao pre\u00e7o dele. O total \u00e9 somado pelo sistema, nunca digitado.",
        roles: ["admin", "gerente", "vendedor", "suporte"],
      },
      {
        kind: "novo",
        text: "Para confirmar um pedido \u00e9 obrigat\u00f3rio informar o n\u00famero dele no Kronosys. Sem isso o cliente veria \"confirmado\" no portal sem nada por tr\u00e1s no ERP. Voltar um pedido de etapa continua liberado, e cada movimenta\u00e7\u00e3o fica registrada com quem moveu e quando.",
        roles: ["admin", "gerente", "vendedor", "suporte"],
      },
    ],
  },
  {
    version: "4.52.2",
    items: [
      {
        kind: "correcao",
        text: "O Meu To-do voltou a ter quatro etapas: A Fazer, Fazendo, Conclu\u00eddo e Arquivar. O ajuste anterior tinha RENOMEADO a etapa final para \"Arquivar\" em vez de acrescent\u00e1-la como quarta, ent\u00e3o a mesma coluna fazia dois pap\u00e9is \u2014 terminar a tarefa e tir\u00e1-la da frente, que s\u00e3o momentos diferentes. Quem j\u00e1 tinha personalizado as pr\u00f3prias etapas n\u00e3o \u00e9 afetado.",
      },
      {
        kind: "correcao",
        text: "Tarefa que chega em \"Conclu\u00eddo\" j\u00e1 destrava quem dependia dela, sem precisar esperar o arquivamento.",
      },
    ],
  },
  {
    version: "4.52.1",
    items: [
      {
        kind: "correcao",
        text: "A tela que aparece por um instante ao abrir o aplicativo no celular mostrava um quadrado preto com listras cortando o s\u00edmbolo da Sanwey. Os \u00edcones tinham fundo transparente, e o celular pinta transparente como preto. Agora o s\u00edmbolo aparece limpo, sobre o mesmo fundo claro do restante da abertura.",
      },
    ],
  },
  {
    version: "4.52.0",
    items: [
      {
        kind: "novo",
        text: "Cliente agora tem vendedor respons\u00e1vel. \u00c9 quem pode liberar produto e definir o pre\u00e7o daquela conta \u2014 outro vendedor n\u00e3o mexe. Cliente sem respons\u00e1vel definido continua aberto pra qualquer vendedor da empresa, ent\u00e3o nada trava enquanto voc\u00eas preenchem; quem veio de um neg\u00f3cio do funil j\u00e1 nasceu com o dono daquele neg\u00f3cio. Ger\u00eancia opera qualquer conta.",
        roles: ["admin", "gerente", "vendedor"],
      },
      {
        kind: "ajuste",
        text: "Quem tem s\u00f3 o cargo de suporte comercial passa a ver no menu Comercial apenas Clientes e Cat\u00e1logo, em vez do m\u00f3dulo inteiro com funil, sinais e prospec\u00e7\u00e3o. O acesso aos dados j\u00e1 era o mesmo \u2014 mudou o menu, que agora reflete a fun\u00e7\u00e3o.",
        roles: ["admin", "gerente", "suporte"],
      },
    ],
  },
  {
    version: "4.51.0",
    items: [
      {
        kind: "novo",
        text: "Clientes ganharam a aba \"Produtos & Pre\u00e7os\": \u00e9 onde o vendedor libera o que aquele cliente pode comprar e por quanto. A tela mostra o pre\u00e7o de tabela que o suporte manteve e voc\u00ea p\u00f5e a margem em cima \u2014 d\u00e1 pra digitar dos dois lados, a margem ou o pre\u00e7o final, e o outro se ajusta. Cliente aprovado come\u00e7a sem nada liberado: n\u00e3o existe pre\u00e7o padr\u00e3o, cada produto entra com o pre\u00e7o negociado dele.",
        roles: ["admin", "gerente", "vendedor", "suporte"],
      },
      {
        kind: "novo",
        text: "O guarda-corpo de margem come\u00e7a a valer na hora de liberar: se a margem ficar abaixo do patamar de aviso da ger\u00eancia, a tela avisa e deixa salvar; abaixo do m\u00ednimo, o bot\u00e3o desliga e o banco recusa. Pausar um produto guarda o pre\u00e7o negociado \u2014 retomar \u00e9 um clique, sem renegociar.",
        roles: ["admin", "gerente", "vendedor"],
      },
    ],
  },
  {
    version: "4.50.0",
    items: [
      {
        kind: "novo",
        text: "O produto no Cat\u00e1logo agora tem duas metades, com donos diferentes. A aba Comercial \u00e9 do suporte: c\u00f3digo, unidade, pedido m\u00ednimo, pre\u00e7o de tabela e certifica\u00e7\u00f5es. A aba Vitrine \u00e9 do Marketing: chamada, descri\u00e7\u00e3o, destaques, especifica\u00e7\u00f5es, aplica\u00e7\u00f5es e categoria \u2014 \u00e9 o que o cliente v\u00ea no portal de compras. Cada um enxerga a metade do outro, mas s\u00f3 escreve na sua.",
        roles: ["admin", "gerente", "suporte", "marketing", "gerente_marketing"],
      },
      {
        kind: "novo",
        text: "Trava de compliance nas certifica\u00e7\u00f5es: INMETRO, ANTT 5998 e NORMAM-05 s\u00f3 podem ser atribu\u00eddas a produto marcado como homologado. Antes era disciplina de quem preenchia; agora o sistema recusa \u2014 certifica\u00e7\u00e3o errada numa vitrine que o cliente l\u00ea n\u00e3o \u00e9 erro de digita\u00e7\u00e3o.",
        roles: ["admin", "gerente", "suporte", "marketing", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.49.0",
    items: [
      {
        kind: "novo",
        text: "Comercial \u2192 Cat\u00e1logo: onde os produtos passam a viver, com c\u00f3digo, unidade, pedido m\u00ednimo, certifica\u00e7\u00f5es e o pre\u00e7o de tabela. O pre\u00e7o de tabela \u00e9 mantido pelo suporte comercial e serve de base pro vendedor calcular a margem de cada cliente \u2014 ele n\u00e3o \u00e9 o pre\u00e7o que o cliente paga. Produto sem pre\u00e7o de tabela aparece marcado como incompleto em vez de sumir.",
        roles: ["admin", "gerente", "suporte", "vendedor"],
      },
      {
        kind: "novo",
        text: "Cat\u00e1logo \u2192 Regras de margem: a ger\u00eancia define, por empresa, a partir de que margem a tela avisa o vendedor e a partir de qual o sistema recusa. D\u00e1 pra abrir exce\u00e7\u00e3o para um produto espec\u00edfico. O n\u00famero \u00e9 a varia\u00e7\u00e3o sobre o pre\u00e7o de tabela: +20 vende 20% acima, \u221210 concede 10% de desconto.",
        roles: ["admin", "gerente"],
      },
    ],
  },
  {
    version: "4.48.0",
    items: [
      {
        kind: "novo",
        text: "Configurações \u2192 M\u00f3dulos: liga e desliga p\u00e1ginas inteiras da plataforma para toda a empresa, sem depender de atualiza\u00e7\u00e3o. Cada p\u00e1gina tem tr\u00eas estados \u2014 Desligada (ningu\u00e9m v\u00ea), Em testes (s\u00f3 admin e quem estiver marcado como exce\u00e7\u00e3o em Usu\u00e1rios) e Liberada (vale a regra de cargo de sempre). Serve pra amadurecer uma tela com dado real antes de treinar a equipe nela. A chave nunca amplia acesso: liberar uma p\u00e1gina n\u00e3o mostra ela pra quem o cargo j\u00e1 n\u00e3o mostrava.",
        roles: ["admin"],
      },
      {
        kind: "ajuste",
        text: "Sete p\u00e1ginas que n\u00e3o tinham controle de acesso nenhum entraram no registro de m\u00f3dulos: ESG & Carbono, Automa\u00e7\u00f5es, Feiras (Marketing), Chat, Meu To-do, Meu RH e Ajuda & Tutoriais. Todas entraram liberadas, exatamente como estavam \u2014 ningu\u00e9m perdeu acesso a nada.",
        roles: ["admin", "gerente"],
      },
    ],
  },
  {
    version: "4.47.0",
    items: [
      {
        kind: "ajuste",
        text: "O papel \"Consultor\" saiu da plataforma — quem tinha esse papel virou Vendedor. Na prática nada muda no acesso de ninguém: Consultor sempre foi um Vendedor sem equipe embaixo, e quem já era Consultor também já tinha outro papel. Agora, ao cadastrar um Vendedor, o campo \"Supervisor\" (opcional) define quem também enxerga os negócios dele — antes esse campo só aparecia pra Consultor.",
        roles: ["gerente", "admin"],
      },
    ],
  },
  {
    version: "4.46.1",
    items: [
      {
        kind: "correcao",
        text: "Várias telas (Meu To-do, Funil de Vendas, ESG & Carbono, Funcionários, Comunicação e Cargos & Salários) escondiam cabeçalhos de coluna e filtros inteiros quando a lista estava vazia — parecia página quebrada. Agora a estrutura sempre aparece, só o conteúdo vazio mostra uma mensagem no lugar certo.",
      },
    ],
  },
  {
    version: "4.46.0",
    items: [
      {
        kind: "novo",
        text: "No Chat, \"Canal\" virou dois conceitos: Grupo (qualquer membro posta) e Canal (só gestor/admin posta, resto só lê). E agora dá pra gerenciar cada grupo/canal direto pelo ícone de engrenagem no cabeçalho da conversa — mudar nome e tipo, adicionar e remover pessoas, tornar alguém admin, e sair.",
      },
    ],
  },
  {
    version: "4.45.1",
    items: [
      {
        kind: "ajuste",
        text: "No \"Meu To-do\", a última etapa (a de tarefa concluída) agora sempre existe e não pode mais ser excluída no editor de etapas — garante que todo mundo tenha um lugar final pras tarefas, mesmo customizando o board. Nasce com o nome \"Arquivar\" pra quem nunca mexeu nas etapas.",
      },
    ],
  },
  {
    version: "4.45.0",
    items: [
      {
        kind: "novo",
        text: "O Funil de Vendas ganhou uma aba \"Email\" no card do lead: envie um e-mail de verdade pro cliente (com confirmação real de entrega, não só o \"e-mail iniciado\" de antes), usando um template pronto ou escrevendo na hora.",
        roles: ["vendedor", "gerente", "admin"],
      },
      {
        kind: "novo",
        text: "Templates de e-mail reutilizáveis: crie o seu (compartilhado com o time ou só seu) com variáveis como {{empresa}} e {{vendedor}}, preenchidas sozinhas ao enviar.",
        roles: ["vendedor", "gerente", "admin"],
      },
      {
        kind: "novo",
        text: "Marque \"Repetir a cada N dias\" ao enviar um e-mail e a plataforma cria um lembrete recorrente no seu Meu To-do, vinculado ao lead — nunca mais esquecer um follow-up.",
        roles: ["vendedor", "gerente", "admin"],
      },
    ],
  },
  {
    version: "4.44.0",
    items: [
      {
        kind: "novo",
        text: "\"Meu To-do\" ganhou dependência entre tarefas: marque que uma tarefa depende de outra e o card mostra um aviso \"Bloqueada\" até a pendência ser concluída — não dá mais pra marcar como feita antes da hora.",
      },
      {
        kind: "novo",
        text: "\"Meu To-do\" ganhou automações pessoais (aba \"Automações\"): crie regras simples do tipo \"quando eu mover pra tal etapa, avisar/criar tarefa/mudar prioridade\" — só você vê e edita as suas.",
      },
    ],
  },
  {
    version: "4.43.2",
    items: [
      {
        kind: "correcao",
        text: "No \"Meu To-do\", mover um card pra uma etapa que você criou (não uma das 3 originais) não fazia nada — o card voltava pro lugar sem aviso. Corrigido; qualquer falha de movimentação agora também mostra um aviso na tela em vez de falhar em silêncio.",
      },
    ],
  },
  {
    version: "4.43.1",
    items: [
      {
        kind: "correcao",
        text: "Um link de convite ou de \"Esqueci minha senha\" expirado (ou já usado) caía numa tela de login em branco, sem explicação nenhuma. Agora aparece um aviso claro dizendo o que houve e o que fazer.",
      },
    ],
  },
  {
    version: "4.43.0",
    items: [
      {
        kind: "novo",
        text: "Viagens & Despesas: agora dá pra registrar \"Evento ou feira\" e \"Outra saída\" além de \"Visita a cliente\" — cliente deixa de ser obrigatório pros dois tipos novos, e \"Evento ou feira\" pode ser vinculado a uma campanha do Relatório de Feiras.",
        roles: ["vendedor", "gerente", "admin"],
      },
      {
        kind: "novo",
        text: "Viagens & Despesas: calendário mensal das suas saídas planejadas, ao lado da lista de sempre.",
        roles: ["vendedor", "gerente", "admin"],
      },
      {
        kind: "novo",
        text: "Viagens & Despesas (Gestão): calendário semanal com uma linha por vendedor, mostrando quem está fora nos próximos dias.",
        roles: ["gerente", "admin"],
      },
    ],
  },
  {
    version: "4.42.0",
    items: [
      {
        kind: "ajuste",
        text: "Campo obrigatório agora trava só para AVANÇAR de etapa. Arrastar um card para uma etapa anterior passa direto, sem precisar preencher o formulário da etapa atual — voltar não conclui a etapa, então não faz sentido cobrar a ficha dela. Vale em todos os quadros: Funil de Vendas, Entregas, Campanhas, Pós-venda, Comex, Onboarding, Férias, Feedback e Recrutamento.",
      },
      {
        kind: "novo",
        text: "Entregas: botão \"Devolver para a agência\" no detalhe da entrega, com motivo opcional que fica registrado no histórico — atalho para o caminho mais comum de uma arte em revisão.",
        roles: ["marketing", "gerente_marketing"],
      },
      {
        kind: "ajuste",
        text: "Entregas: a \"Decisão de aprovação\" ganhou a opção \"Ajustes solicitados\", que antes não existia — só dava para marcar Aprovado, Reprovado ou Pendente, mesmo quando a arte estava indo e voltando da agência.",
        roles: ["marketing", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.41.3",
    items: [
      {
        kind: "correcao",
        text: "Compras: uma cotação com valor preenchido mas sem fornecedor escolhido era descartada em silêncio ao salvar — o valor sumia sem aviso. Agora o sistema avisa qual linha está pela metade, e mostra \"✓ Cotações salvas\" quando dá certo (antes o botão não dava retorno nenhum e parecia não ter salvado).",
        roles: ["marketing", "gerente_marketing"],
      },
    ],
  },
  {
    version: "4.41.2",
    items: [
      {
        kind: "correcao",
        text: 'Cadastrar fornecedor de marketing sem marcar nenhuma empresa dava "erro ao salvar" sem explicação. Agora "Empresas atendidas" é obrigatório e o aviso diz o que falta.',
        roles: ["marketing", "gerente_marketing"],
      },
      {
        kind: "correcao",
        text: "Mesma correção no cadastro de clientes e na solicitação de compra de marketing: sem empresa selecionada, o sistema avisa em vez de falhar sem motivo aparente.",
      },
    ],
  },
  {
    version: "4.41.1",
    items: [
      { kind: "correcao", text: "Solicitação ao Marketing: o formulário não gravava nada para quem abria o link sem estar logado — a permissão pública existia, mas era anulada por uma regra interna antes de valer. Corrigido; pedidos de Material e de Compra voltam a ser enviados normalmente." },
      { kind: "correcao", text: "Solicitação ao Marketing: o botão de enviar ficava cinza sem dizer o que faltava, o que dava a impressão de que só a opção Compra funcionava (Material pede três campos a mais). Agora a tela lista os campos pendentes." },
    ],
  },
  {
    version: "4.41.0",
    items: [
      { kind: "novo", text: "O setor do vendedor passou a valer de verdade: negócio sem responsável agora aparece só para quem atende aquele setor, e o histórico do cliente mostra o que foi feito dentro do seu setor — incluindo por colegas do mesmo time. Gerência e diretoria continuam vendo tudo.", roles: ["vendedor", "gerente", "diretoria", "admin"] },
      { kind: "correcao", text: "O filtro por setor funcionava só na tela: o servidor mandava os negócios dos outros setores junto, e a tela apenas escondia. Agora o limite é aplicado no servidor.", roles: ["admin", "diretoria"] },
      { kind: "ajuste", text: "Negócio sem setor preenchido continua visível para quem é o responsável e para a gerência — só não aparece para vendedores de outros setores.", roles: ["vendedor", "gerente"] },
    ],
  },
  {
    version: "4.40.0",
    items: [
      { kind: "novo", text: "Clientes: a aba Conexões virou Histórico — uma linha do tempo única com tudo que já aconteceu com aquele cliente, atravessando todos os negócios dele: visitas, comentários, amostras, e-mails de abordagem, propostas e casos de pós-venda. Mudanças de etapa e anexos aparecem como pano de fundo, e dá pra filtrar só as interações.", roles: ["vendedor", "gerente", "diretoria", "admin"] },
      { kind: "novo", text: "Funil de Vendas: iniciar uma abordagem por e-mail e gerar uma proposta agora ficam registrados no negócio e no histórico do cliente. Antes não sobrava nenhum rastro dessas duas ações.", roles: ["vendedor", "gerente"] },
      { kind: "novo", text: "Pós-venda: o caso agora pode ser vinculado direto ao cliente, sem depender de um negócio. Antes o nome do cliente era texto solto e o caso sumia do histórico dele.", roles: ["vendedor", "gerente"] },
      { kind: "ajuste", text: "Importação de feira: quando o CNPJ da linha bate com um cliente já cadastrado, o negócio nasce vinculado a ele — sem criar cadastro duplicado.", roles: ["gerente"] },
      { kind: "correcao", text: "Corrigido: dados de clientes de uma frente comercial podiam ser consultados por quem não trabalha nela. Agora as duas consultas envolvidas respeitam a mesma regra de empresa do resto da plataforma.", roles: ["admin"] },
    ],
  },
  {
    version: "4.39.0",
    items: [
      { kind: "novo", text: "Marketing: nova aba Orçamento dentro de Despesas. Gerente e admin definem um teto por categoria e ano, e cada categoria ganha uma barra mostrando o que já foi pago, o que está a pagar e o que está comprometido em compras aprovadas — com aviso quando passa de 80% e destaque quando estoura.", roles: ["marketing", "gerente_marketing", "admin"] },
      { kind: "novo", text: "Painel Executivo: a área de Marketing passa a mostrar o orçamento do ano e quanto já foi consumido, e a faixa de saúde acende quando o consumo passa de 80% do teto.", roles: ["diretoria", "admin"] },
      { kind: "correcao", text: "Marketing: o indicador \"Orçamento comprometido\" mostrava a soma dos tetos das campanhas, não o gasto — e a variação ao lado era de despesas. Agora mostra o consumo real.", roles: ["marketing", "gerente_marketing", "admin"] },
      { kind: "correcao", text: "Despesas de Marketing: telas diferentes usavam datas diferentes pra decidir em que mês e ano uma despesa entrava, então os totais não batiam entre elas. Agora vale a mesma regra em todo lugar — data da nota, ou vencimento quando não há nota.", roles: ["marketing", "gerente_marketing", "admin", "diretoria"] },
      { kind: "ajuste", text: "Despesas de Marketing: lançar uma despesa agora exige vencimento ou data da nota. Sem uma das duas, o valor não entrava em nenhum ano e sumia dos totais sem avisar.", roles: ["marketing", "gerente_marketing", "admin"] },
    ],
  },
  {
    version: "4.38.0",
    items: [
      { kind: "novo", text: "Funil de Vendas e Pós-venda: ao cadastrar um negócio que já vinha sendo negociado fora da plataforma, agora dá pra informar quando a conversa realmente começou. O card para de aparecer como recém-criado nas contagens e na ordenação — deixe em branco e nada muda em relação a antes.", roles: ["vendedor", "gerente"] },
      { kind: "novo", text: "Funil de Vendas: novo bloco de amostras dentro do negócio, pra registrar cada amostra de produto levada ao cliente com o custo dela. O painel soma o total gasto por negócio.", roles: ["vendedor", "gerente"] },
      { kind: "novo", text: "CAC médio (custo pra conquistar cada cliente) no Funil de Vendas e no Painel Executivo, somando despesas de viagem e custo de amostras dividido pelos negócios ganhos no período.", roles: ["gerente"] },
      { kind: "novo", text: "Viagens & Despesas: a calculadora agora monta uma rota com várias paradas e busca a distância sozinha a partir dos endereços — não precisa mais digitar o total de quilômetros. A comparação entre carro, aplicativo e avião continua igual.", roles: ["vendedor", "gerente"] },
      { kind: "ajuste", text: "Dashboards no celular: os cards de indicadores ficaram bem menores e param de exigir rolagem lateral pra ver os que sobravam fora da tela. Vale para Pendências, Marketing, RH, Visão Geral e Painel Executivo. Onde há muitos indicadores, aparecem os principais e o resto abre num toque." },
      { kind: "ajuste", text: "Funil de Vendas: painel do negócio mais enxuto. Saíram o bloco de unidades (que repetia o de produto logo abaixo) e o de e-mails vinculados (que prometia uma integração com Outlook que nunca existiu); o follow-up virou um botão compacto, sem perder nada do que fazia.", roles: ["vendedor", "gerente"] },
      { kind: "ajuste", text: "Chat: o seletor de ícone do canal passou de 6 para 18 opções, cada uma com uma dica explicando pra que serve." },
      { kind: "correcao", text: "Chat no celular: só dava pra abrir conversa direta — a opção de criar canal não aparecia no botão flutuante. Corrigido." },
      { kind: "correcao", text: "Datas com ano de um ou dois dígitos eram gravadas no século passado sem avisar (digitar \"26\" virava 1926). Corrigido em todos os campos de data da plataforma." },
    ],
  },
  {
    version: "4.37.2",
    items: [
      { kind: "correcao", text: "Viagens & Despesas: lançar (ou editar/apagar) uma despesa estava falhando com erro de permissão pra todo mundo — corrigido." },
    ],
  },
  {
    version: "4.37.1",
    items: [
      { kind: "correcao", text: "Ajuda & Tutoriais: passo a passo do Comercial (Funil de Vendas, Pós-venda, Clientes, Cross-sell, Explorador, Sinais, Viagens & Despesas) reescrito com muito mais detalhe e revisado tela por tela contra o comportamento real do sistema — inclusive uma instrução de prestação de contas que estava invertida (dizia pra desmarcar despesas, na verdade é preciso marcar as que quer enviar).", roles: ["vendedor", "gerente"] },
    ],
  },
  {
    version: "4.37.0",
    items: [
      { kind: "novo", text: "Chat: gestores e admin agora podem criar canais por grupo — escolha departamento(s) e/ou empresa(s) do Grupo e o canal já nasce com todo mundo que bate com o filtro, e continua se ajustando sozinho conforme pessoas mudam de departamento/empresa ou são contratadas. Também dá pra criar um canal \"somente avisos\" (só quem administra posta, o resto só lê).", roles: ["gerente", "gerente_marketing", "gerente_rh", "diretoria", "admin"] },
      { kind: "ajuste", text: "Ajuda & Tutoriais: os cards de passo a passo tinham tamanhos bem diferentes entre si — agora todos têm o mesmo tamanho, e clicar abre um modal com o passo a passo completo." },
    ],
  },
  {
    version: "4.36.0",
    items: [
      { kind: "novo", text: "Tour guiado pela plataforma inteira: passa por cada item do menu que você usa, um de cada vez, explicando pra que serve. Disponível pra todo mundo (não só quem está entrando agora) — dá pra pular a qualquer momento, e não volta a aparecer depois de pulado ou concluído." },
      { kind: "novo", text: "Ajuda & Tutoriais ganhou guias novos pra quase 30 telas que ainda não tinham nenhum — Pendências, Pós-venda, Clientes, Cross-sell, Explorador, Comex, Onboarding, Treinamentos, Avaliação de Desempenho, ESG & Carbono, Configurações, entre outras." },
      { kind: "correcao", text: "Vários guias em Ajuda & Tutoriais estavam desatualizados (nome antigo de tela, passo descrevendo algo que não existe mais) — revisados e corrigidos." },
      { kind: "novo", text: "Admin agora pode liberar ou bloquear o Chat por usuário, na tela de Usuários.", roles: ["admin"] },
      { kind: "correcao", text: "4 telas de RH (Cargos & Salários, Comunicação, Bem-estar, Relatórios) apareciam no menu pra qualquer pessoa do RH, mas só abriam de fato pra gerente — agora o menu só mostra pra quem pode abrir." },
      { kind: "ajuste", text: "Página \"Meu RH\": tiradas as abas de Onboarding/Treinamentos/Avaliação, que duplicavam os mesmos itens já soltos no menu lateral." },
    ],
  },
  {
    version: "4.35.0",
    items: [
      { kind: "novo", text: "Ajuda & Tutoriais ganhou guias rápidos de Viagens & Despesas: planejar uma visita, lançar despesa e enviar prestação de contas em lote (gestor tem um guia próprio de aprovação)." },
      { kind: "novo", text: "Painel Executivo: dica contextual mostrando a nova aba de ESG & Carbono pra quem ainda não passou por lá.", roles: ["gerente", "admin"] },
      { kind: "novo", text: "Viagens & Despesas: dica contextual mostrando a \"Prestação de contas\" na primeira visita à tela depois do lançamento." },
    ],
  },
  {
    version: "4.34.0",
    items: [
      { kind: "novo", text: "Viagens & Despesas ganhou \"Prestação de contas\": agrupe várias despesas soltas num lote e envie pra aprovação de uma vez, em vez de mandar despesa por despesa. Dá pra fazer uma prestação geral do mês ou uma por viagem específica. Despesa avulsa continua podendo ser aprovada direto, sem passar por prestação nenhuma." },
      { kind: "novo", text: "Gestor agora decide uma prestação de contas inteira de uma vez (aprovar tudo/rejeitar tudo) ou despesa por despesa dentro dela — e marca a prestação inteira como paga com um clique, depois de aprovada.", roles: ["gerente", "admin"] },
    ],
  },
  {
    version: "4.33.4",
    items: [
      { kind: "ajuste", text: "No menu \"Meu Espaço\", \"Minhas Tarefas\" virou \"Pendências\" e \"Lista Pessoal\" virou \"Meu To-do\" — nomes mais claros pro que cada item realmente é (o feed de pendências entre módulos vs. a sua lista de tarefas privada)." },
    ],
  },
  {
    version: "4.33.3",
    items: [
      { kind: "correcao", text: "Em Viagens & Despesas, uma despesa lançada agora pode ser clicada pra abrir o detalhe completo (valor, descrição, motivo de rejeição, comprovante) — antes só dava pra ver o comprovante, e só quando havia um anexado." },
    ],
  },
  {
    version: "4.33.2",
    items: [
      { kind: "correcao", text: "Notificações que apontavam para um registro já excluído (ex.: solicitação de compra ou vaga removida), ou que sobraram depois de uma mudança de cargo, não desapareciam mais sozinhas — corrigido, e agora são limpas automaticamente." },
    ],
  },
  {
    version: "4.33.1",
    items: [
      { kind: "correcao", text: "No modo escuro, o vermelho de erro/urgência (card \"Urgentes agora\", botões de excluir/recusar) estava clareado demais e lia como rosa-salmão. Trocado por um vermelho mais intenso — o claro não muda." },
    ],
  },
  {
    version: "4.33.0",
    items: [
      { kind: "novo", text: "ESG & Carbono ganhou uma aba própria no Painel Executivo (Total de CO2e, fatores vigentes, último relatório).", roles: ["admin", "gerente", "diretoria"] },
      { kind: "novo", text: "ESG & Carbono: gráfico de tendência mensal por escopo, período do relatório agora escolhível (mês atual, mês anterior, últimos 3 meses ou datas personalizadas), e um novo botão \"Dossiê ESG (PDF)\" exporta o relatório mais recente formatado pra imprimir/anexar.", roles: ["admin", "gerente", "diretoria"] },
      { kind: "novo", text: "Proposta comercial (Funil de Vendas): quando a empresa vendedora já tem um relatório ESG gerado, um \"Selo ESG Sanwey\" com o total de CO2e apurado entra automaticamente na proposta, como diferencial pra clientes B2B." },
    ],
  },
  {
    version: "4.32.0",
    items: [
      { kind: "correcao", text: "Datas em Férias, Feedback, Onboarding, Recrutamento, Visão Geral de RH, Bem-Estar, Comunicação, Cargos e Treinamentos apareciam um dia antes do real — corrigido." },
      { kind: "correcao", text: "Botões de excluir em Despesas, Fornecedores e no menu \"...\" do Kanban agora avisam quando a exclusão falha, em vez de simplesmente não acontecer nada." },
      { kind: "correcao", text: "Exportar CSV de Entregas corrigido — o arquivo abria com as colunas embaralhadas no Excel." },
      { kind: "correcao", text: "ESG & Carbono: o relatório gerado agora usa só os lançamentos do período selecionado, e o cálculo automático de Escopo 3 a partir de Compras não duplica mais registro em cliques repetidos.", roles: ["admin", "gerente", "diretoria"] },
      { kind: "correcao", text: "Corrigido um caso em que editar dois campos rapidamente no Funil de Vendas ou em Entregas podia perder a primeira edição." },
      { kind: "ajuste", text: "Isolamento por empresa reforçado em Marketing e em outros pontos da plataforma — cada empresa do grupo só enxerga o próprio dado." },
    ],
  },
  {
    version: "4.31.0",
    items: [
      { kind: "novo", text: "Novo módulo ESG & Carbono (menu Inteligência): calcula a pegada de carbono (Escopos 1, 2 e 3) a partir de dados já cadastrados na plataforma, com fatores de emissão versionados e relatório exportável — primeira fase, foco em rastreabilidade auditável.", roles: ["admin", "gerente", "diretoria"] },
    ],
  },
  {
    version: "4.30.0",
    items: [
      { kind: "novo", text: "Botão \"Exportar CSV\" adicionado em Compras, Comex, Pós-venda, Onboarding, Férias, Avaliação de Desempenho, Treinamentos, Recrutamento (Vagas e Candidatos) e Lista Pessoal — os quadros que ainda não tinham essa opção, seguindo o mesmo padrão já usado em Funil de Vendas, Entregas e Campanhas." },
    ],
  },
  {
    version: "4.29.4",
    items: [
      { kind: "correcao", text: "Corrigido um deslocamento de layout que acontecia em qualquer página da plataforma: ao navegar pra uma tela com mais conteúdo (que precisa de barra de rolagem), tudo — inclusive botões do cabeçalho — pulava alguns pixels pra esquerda; ao voltar pra uma tela mais curta, pulava de volta. O espaço da barra de rolagem agora fica sempre reservado, então nada se move." },
    ],
  },
  {
    version: "4.29.3",
    items: [
      { kind: "correcao", text: "Minhas Tarefas: quando não há nada pendente, a página não fica mais em branco — continua mostrando os cartões de resumo e as abas (tudo zerado), só a lista fica vazia, como já acontecia em Viagens & Despesas." },
    ],
  },
  {
    version: "4.29.2",
    items: [
      { kind: "correcao", text: "Na Lista Pessoal, o seletor de ordenação (\"Mais recente\") não empurra mais o resto do cabeçalho ao trocar entre Kanban/Lista/Agenda — agora tem lugar fixo, só na view Lista." },
      { kind: "correcao", text: "No Funil de Vendas, a Calendário respeitava o filtro de \"Só favoritos\" mas ignorava o filtro de vendedor e de setor — agora mostra exatamente os mesmos negócios que o Kanban filtrado." },
    ],
  },
  {
    version: "4.29.1",
    items: [
      { kind: "correcao", text: "Na Lista Pessoal, a ordem dos botões Kanban/Lista/Agenda agora segue o mesmo padrão do resto da plataforma (Kanban primeiro)." },
    ],
  },
  {
    version: "4.29.0",
    items: [
      { kind: "novo", text: "Ao mover um card de etapa, as próximas etapas agora aparecem em destaque (preenchidas, com seta pra frente) e as etapas já passadas ficam discretas, separadas por \"Etapas anteriores\" — em todos os quadros da plataforma, facilitando entender o que é avançar e o que é voltar." },
      { kind: "ajuste", text: "O Funil de Vendas agora segue o mesmo padrão de card dos demais quadros (coluna da esquerda com dados do lead, centro com os campos daquela etapa); o campo \"Etapa do funil\" separado foi removido por duplicar o \"Mover para\"." },
    ],
  },
  {
    version: "4.28.0",
    items: [
      { kind: "novo", text: "Nos cards de Entregas, Campanhas, Compras e todos os boards de RH (Onboarding, Férias, Feedback, Vagas, Candidatos, Comex), a coluna da esquerda agora reúne prazo/etapa/departamento seguidos das abas (Form, Atividades, Histórico, IA, Anexos, Checklist) — o centro do card ficou só com os campos daquela etapa, sempre visíveis." },
      { kind: "novo", text: "O histórico de etapas agora mostra, em cada passagem (\"Mostrar mais\"), os campos preenchidos NAQUELA passagem — inclusive se o card voltou pra mesma etapa mais de uma vez, cada visita guarda o próprio valor." },
      { kind: "correcao", text: "@ nos comentários de Entregas e Campanhas volta a mostrar usuários de agência (ex.: Beehave) na lista de marcação." },
    ],
  },
  {
    version: "4.27.0",
    items: [
      { kind: "correcao", text: "O botão de criar card (no topo e o flutuante) não sumia mais ao trocar do Kanban para Tabela/Calendário/Análise, em todos os quadros da plataforma." },
      { kind: "ajuste", text: "Em Entregas e Tarefas de Marketing, quem cria o card agora já entra como responsável — só muda se for outra pessoa." },
    ],
  },
  {
    version: "4.26.0",
    items: [
      { kind: "ajuste", text: "Título das colunas do Kanban (Funil de Vendas, RH, Entregas, Compras, Lista Pessoal etc.) agora usa sempre a mesma cor de texto da página, em vez da cor da etapa — padrão novo em todos os quadros da plataforma." },
      { kind: "ajuste", text: "No card da Lista Pessoal: Detalhes/Checklist/Anexos foram pra esquerda, e o meio do card ficou só com os campos configurados pra etapa atual." },
    ],
  },
  {
    version: "4.25.0",
    items: [
      { kind: "novo", text: "A plataforma ganhou um tour guiado contextual: quando você visita uma tela com uma novidade recente, um tooltip aponta direto pro que mudou — sem precisar procurar na aba \"Novidades\"." },
    ],
  },
  {
    version: "4.24.0",
    items: [
      { kind: "novo", text: "Lista Pessoal ganhou etapas configuráveis — clique em \"Editar etapas\" pra renomear, recolorir, reordenar ou criar colunas novas além de A Fazer/Fazendo/Feito." },
      { kind: "novo", text: "Cada etapa da Lista Pessoal agora aceita campos extras configuráveis (aba \"Campos\" no card, ícone de engrenagem no cabeçalho da coluna) — o mesmo editor usado no Funil de Vendas e nos quadros de RH." },
      { kind: "novo", text: "Lista Pessoal ganhou ordenação por coluna (Prazo, Prioridade, Alfabética) no Kanban, igual aos outros quadros da plataforma, e um controle de ordenação na visão Lista." },
      { kind: "novo", text: "Etiquetas da Lista Pessoal deixaram de ser texto livre: agora é um catálogo com múltipla escolha, já sugerido com termos de fábrica/indústria e de uso pessoal — dá pra criar as suas." },
      { kind: "novo", text: "Recorrência da Lista Pessoal ficou mais precisa: \"Toda semana\" aceita escolher os dias exatos, e \"Todo mês\" aceita escolher o dia do mês." },
    ],
  },
  {
    version: "4.23.0",
    items: [
      { kind: "novo", text: "Lista Pessoal ganhou o mesmo nível dos outros quadros da plataforma: clicar numa tarefa abre um card completo, com checklist, anexos e um espaço pra notas — título e descrição dá pra editar a qualquer momento." },
      { kind: "novo", text: "Lista Pessoal agora aceita arrastar o card entre colunas (igual aos outros Kanban), etiquetas pra organizar por assunto, tarefas recorrentes (diária, semanal ou mensal) e uma 3ª visualização em Agenda, além de Lista e Kanban." },
      { kind: "novo", text: "Ao criar uma tarefa pessoal, escrever o prazo direto no título (\"amanhã 15h\", \"sexta\", \"dia 15\") preenche a data e a hora sozinho." },
      { kind: "novo", text: "Tarefa pessoal com prazo pra hoje agora avisa pelo sino de notificações — dá pra desligar em Configurações → Notificações." },
      { kind: "correcao", text: "O painel de notificações (sino) ficava escondido atrás do cabeçalho ou cortado embaixo em telas menores. Corrigido." },
      { kind: "ajuste", text: "O aviso de mensagem não lida ao lado de \"Chat\" no menu lateral ganhou a cor vermelha da marca — o amarelo claro anterior quase não chamava atenção." },
    ],
  },
  {
    version: "4.22.0",
    items: [
      { kind: "novo", text: "Em Comercial → Viagens & Reembolsos, ao planejar uma visita agora dá pra declarar \"Valor previsto\" — quanto você estima gastar. Gestor e Relatórios passam a cruzar automaticamente esse valor com o que foi de fato lançado como despesa." },
      { kind: "novo", text: "Aba Gestão de Viagens & Reembolsos ganhou uma seção \"Divergências\": aponta despesa lançada sem visita planejada correspondente, visita planejada que nunca teve desfecho registrado, e despesas que estouraram o valor previsto em mais de 20%." },
      { kind: "ajuste", text: "Relatórios de Viagens & Reembolsos agora mostra essas mesmas divergências resumidas, prontas pra levar à diretoria." },
      { kind: "ajuste", text: "Marketing → Despesas: anexar nota fiscal deixou de ser obrigatório pra marcar uma despesa como paga." },
    ],
  },
  {
    version: "4.21.0",
    items: [
      { kind: "ajuste", text: "Configurações foi reorganizada: o menu agora tem três grupos (Minha conta, Plataforma e Administração) em vez de uma lista longa, e cada página usa abas no topo — nada mais exige rolar a tela até o fim para achar um ajuste." },
      { kind: "novo", text: "\"Aparência\" agora aparece para todo mundo. Quem tem cargo de gestão simplesmente não conseguia abrir essa tela e, por isso, não conseguia trocar a cor de destaque da plataforma." },
      { kind: "correcao", text: "Criar uma etapa nova no Funil de Vendas fazia ela sumir do quadro. A configuração antiga de \"Etapas visíveis no Kanban\" só conhecia as 7 etapas originais e escondia qualquer outra — foi removida, e quem controla o que aparece agora é só o editor de etapas dentro do próprio Kanban." },
      { kind: "correcao", text: "Em Notificações, 12 opções podiam ser desligadas mas o aviso continuava chegando. Agora elas aparecem desabilitadas, com o motivo, em vez de dar a impressão de funcionar." },
      { kind: "ajuste", text: "\"Integrações IA\" virou \"Integrações\" — a tela também guarda a assinatura eletrônica, que não tem relação com IA. E a antiga aba \"Dados\" virou \"Segurança & dados\", com os dados de exemplo separados das ações que apagam registros de verdade." },
      { kind: "ajuste", text: "O interruptor da Lista Pessoal agora fica em Configurações → Preferências → Recursos." },
    ],
  },
  {
    version: "4.20.1",
    items: [
      { kind: "correcao", text: "Corrigido um erro que travava a tela ao abrir \"Lista Pessoal\" (antes \"Tarefas Pessoais\")." },
      { kind: "ajuste", text: "\"Tarefas Pessoais\" virou \"Lista Pessoal\" pra não confundir com \"Minhas Tarefas\" — agora vem ativada por padrão e mudou de Perfil pra Preferências, em Configurações." },
      { kind: "ajuste", text: "Os interruptores (liga/desliga) de Configurações agora ficam colados no texto do que controlam, em vez de jogados no canto direito." },
      { kind: "ajuste", text: "Mais respiro entre os balões do Chat e a borda da janela de conversa." },
    ],
  },
  {
    version: "4.20.0",
    items: [
      { kind: "novo", text: "Automações agora funcionam em Entregas, não só em Campanhas: escolha o quadro (\"Campanhas\" ou \"Entregas\") ao criar a regra, e as etapas mostradas passam a ser as daquele quadro específico." },
      { kind: "novo", text: "Nova ação de automação \"Atribuir responsável\" — define automaticamente quem fica responsável por um card (substituindo ou somando aos responsáveis atuais) quando a regra dispara." },
    ],
  },
  {
    version: "4.19.0",
    items: [
      { kind: "novo", text: "Nova aba \"Tarefas Pessoais\" no menu Meu Espaço: uma lista de tarefas privada, só sua — nem gerente, nem admin, ninguém mais vê o que você anota lá. Tem visão em Lista (agrupada por Hoje/Esta semana/Sem data) e em Kanban (A Fazer/Fazendo/Feito)." },
      { kind: "ajuste", text: "O menu lateral agora tem um único grupo \"Meu Espaço\" no topo, reunindo Minhas Tarefas, Chat e (pra quem tem ficha de colaborador) Meu RH — antes Meu RH ficava num grupo separado, mais abaixo." },
    ],
  },
  {
    version: "4.18.2",
    items: [
      { kind: "correcao", text: "O anel de campos obrigatórios preenchidos no card de Entregas estava menor que o mesmo indicador em Funil de Vendas, Campanhas e RH — agora do mesmo tamanho em todos os Kanbans." },
    ],
  },
  {
    version: "4.18.1",
    items: [
      { kind: "correcao", text: "Notificações: os botões de filtro (Tudo/Menções/Sistema) não ficam mais parcialmente cobertos pela barra superior em janelas mais estreitas." },
      { kind: "ajuste", text: "Notificações: o aviso \"Ativar notificações do navegador?\" agora pode ser dispensado com um X — volta a aparecer só num próximo acesso." },
    ],
  },
  {
    version: "4.18.0",
    items: [
      { kind: "novo", text: "Notificações: clicar em uma notificação agora leva direto até o card ou registro relacionado, em vez de só marcar como lida." },
      { kind: "correcao", text: "Notificações: corrigido um problema visual que deixava os botões de filtro (Tudo/Menções/Sistema) quase invisíveis." },
    ],
  },
  {
    version: "4.17.0",
    items: [
      { kind: "ajuste", text: "Ajustes visuais em toda a plataforma: cards com sombra só ao passar o mouse (mais planos em repouso), badges/etiquetas viraram pílula e botões ficaram um pouco mais altos e arredondados." },
      { kind: "ajuste", text: "Painel comercial: a faixa de indicadores no topo (leads, funil, valor ganho, fit score) ganhou um visual mais limpo, sem caixinha de ícone." },
      { kind: "ajuste", text: "Kanban: a linha entre as colunas ficou mais discreta em todos os boards." },
      { kind: "novo", text: "Funcionários: nova opção para alternar a tabela entre densidade Confortável e Compacta.", roles: ["rh", "gerente_rh"] },
    ],
  },
  {
    version: "4.16.0",
    items: [
      { kind: "ajuste", text: "Tela de login redesenhada: agora é um único card centralizado, com um traço sutil e animado no fundo em vez do painel dividido de antes." },
    ],
  },
  {
    version: "4.15.0",
    items: [
      { kind: "correcao", text: "Despesas: o campo \"Campanha relacionada\" voltou a mostrar as campanhas cadastradas — ficava vazio porque a lista não recarregava depois do login." },
      { kind: "novo", text: "Despesas agora também pode se vincular a várias Entregas e várias Tarefas de Marketing, além da Campanha.", roles: ["marketing", "gerente_marketing", "agencia"] },
    ],
  },
  {
    version: "4.14.0",
    items: [
      { kind: "novo", text: "A cor de destaque da plataforma (botões, item ativo do menu, ícones em foco) agora é o vermelho oficial da Sanwey em toda tela — inclusive no modo escuro, que antes voltava pro neutro." },
      { kind: "correcao", text: "Configurações > Aparência: uma cor de destaque personalizada agora se mantém ao alternar entre claro e escuro, em vez de sumir no escuro." },
    ],
  },
  {
    version: "4.13.2",
    items: [
      { kind: "ajuste", text: "Chat: os 4 filtros da lista de conversas (Todas/Não lidas/Canais/Diretas) viraram um único seletor — acabou o scroll horizontal feio na barra lateral." },
    ],
  },
  {
    version: "4.13.1",
    items: [
      { kind: "ajuste", text: "\"Viagens & Reembolsos\" agora se chama \"Viagens & Despesas\" em toda a plataforma." },
      { kind: "correcao", text: "Celular: os botões da barra inferior voltaram a ficar com larguras iguais — um atalho de nome longo não empurra mais os vizinhos." },
    ],
  },
  {
    version: "4.13.0",
    items: [
      { kind: "ajuste", text: "Nomes e valores coloridos por etapa (chips \"Mover para\", cabeçalhos de coluna, etiquetas de tabela e calendário) agora são sempre legíveis — o fundo colorido continua igual, só o texto ganhou mais contraste. Vale também no modo escuro." },
    ],
  },
  {
    version: "4.12.0",
    items: [
      { kind: "novo", text: "Celular: a visão Tabela de todos os quadros agora mostra cards fáceis de ler (título, etapa, valor e responsáveis) em vez de uma tabela cortada — nenhuma informação fica mais escondida fora da tela. No computador, nada muda." },
    ],
  },
  {
    version: "4.11.0",
    items: [
      { kind: "novo", text: "Celular: ao abrir um card (RH, Marketing, Compras, Comex, Pós-venda), o botão \"Mover para →\" agora fica fixo no rodapé — sem precisar rolar até o fim pra mudar de etapa. Os detalhes do cabeçalho ficam atrás de \"+ detalhes\"." },
      { kind: "ajuste", text: "Celular: a barra inferior mostra só os atalhos que cabem na tela (4 ou 5 + Menu) — nada mais fica cortado; os demais seguem no Menu." },
      { kind: "ajuste", text: "Calendários unificados na plataforma toda: semana começa no domingo, e o dia de hoje aparece com um círculo na cor da sua frente." },
    ],
  },
  {
    version: "4.10.4",
    items: [
      { kind: "correcao", text: "Modo escuro: o card de Cliente vinculado no Funil de Vendas não aparece mais como caixa branca com texto invisível." },
      { kind: "correcao", text: "Modo escuro: caixas de seleção e botões de opção agora acompanham o tema (antes ficavam brancos)." },
      { kind: "correcao", text: "Modo escuro: botões Aprovar/Recusar e avisos coloridos legíveis de verdade — texto ajustado em ~30 pontos da plataforma." },
      { kind: "correcao", text: "Modo escuro: faixas e etiquetas em tom pastel claro (Compras, editor de etapas, calendário do Funil, Novidades e outros) agora escurecem junto com o tema." },
      { kind: "correcao", text: "Modo escuro: linhas de grade dos gráficos de Análise não ficam mais berrantes." },
    ],
  },
  {
    version: "4.10.3",
    items: [
      { kind: "correcao", text: "Comex: a aba Exportação agora carrega as operações ao trocar de Importação — antes ficava sempre vazia.", roles: ["comex", "diretoria"] },
      { kind: "correcao", text: "Editor de etapas: o botão de fechar não some mais da tela em celulares pequenos." },
      { kind: "correcao", text: "Mobile: menu \"Mover para etapa\" não fica mais parcialmente escondido atrás do menu inferior." },
      { kind: "correcao", text: "Mobile: vários ajustes de texto cortado ou sobreposto — cards de Treinamentos e Bem-estar, etiquetas de etapa nas tabelas, campos de data em \"Nova campanha\" e formulários de Comunicação." },
      { kind: "correcao", text: "Compras (celular): as etapas do quadro agora mostram a setinha de abrir/fechar, como os outros quadros." },
      { kind: "correcao", text: "Textos corrigidos: \"sugestãoões\"/\"avaliaçãoões\" viraram \"sugestões\"/\"avaliações\", e etiquetas internas (ex.: \"industria\", \"negociacao\") agora aparecem com o nome certo." },
    ],
  },
  {
    version: "4.10.2",
    items: [
      { kind: "correcao", text: "Mobile: ícone do app não fica mais cortado com fundo preto ao abrir — agora tem fundo branco." },
      { kind: "correcao", text: "Mobile: botões de cabeçalho (ex.: 'Novo Funcionário', 'Exportar CSV') não ficam mais cortados na borda da tela." },
      { kind: "correcao", text: "Mobile: avisos e dicas de tela não ficam mais escondidos atrás do menu inferior." },
      { kind: "correcao", text: "Mobile: abas 'Kanban/Tabela/Calendário/Análise' não ficam mais cortadas em telas pequenas — Pós-venda, Comex, Tarefas, Compras, Férias, Treinamentos, Recrutamento, Onboarding e Avaliação de Desempenho." },
      { kind: "correcao", text: "Fornecedores (RH): texto de descrição não fica mais em cima do botão 'Novo fornecedor'." },
    ],
  },
  {
    version: "4.10.1",
    items: [
      { kind: "correcao", text: "Chat: conversa arquivada não conta mais no aviso de mensagens não lidas do menu — arquivar agora silencia de verdade." },
    ],
  },
  {
    version: "4.10.0",
    items: [
      { kind: "novo", text: "Chat: filtros rápidos (Todas, Não lidas, Canais, Diretas), conversa arquivada some da lista sem apagar nada, e no celular um botão flutuante abre uma conversa nova sem precisar rolar até o topo." },
      { kind: "novo", text: "Chat: agora dá pra mandar mensagem de voz — segure o microfone pra gravar, solte pra enviar." },
      { kind: "ajuste", text: "Chat: chegou mensagem nova enquanto você está em outra tela? Aparece um aviso rápido com o remetente, com atalho pra abrir a conversa direto." },
    ],
  },
  {
    version: "4.9.0",
    items: [
      { kind: "novo", text: "Barra de navegação do celular agora é personalizável — em Configurações → Barra inferior, escolha até 4 atalhos entre tudo que você já acessa na plataforma." },
    ],
  },
  {
    version: "4.8.0",
    items: [
      { kind: "novo", text: "Funil de Vendas: seus negócios continuam visíveis mesmo sem internet (mostrando os últimos dados salvos), e dá pra registrar uma nota mesmo assim — ela fica marcada como \"vai enviar quando voltar o sinal\" e sincroniza sozinha ao reconectar." },
    ],
  },
  {
    version: "4.7.0",
    items: [
      { kind: "novo", text: "Chat interno: agora dá pra mandar emoji (paleta com 32 opções), anexar arquivo/imagem e enviar figurinhas — tudo pelos novos ícones ao lado da caixa de mensagem." },
      { kind: "ajuste", text: "Chat interno: mensagens com palavras impróprias não são enviadas — aparece um aviso na hora, só pra quem escreveu." },
      { kind: "correcao", text: "Modo escuro: mais uma leva de selos e faixas de erro/sucesso/atenção que ainda ficavam com fundo claro e destoavam no tema escuro." },
    ],
  },
  {
    version: "4.6.0",
    items: [
      { kind: "novo", text: "Chat interno: novo item no topo do menu, com canais por equipe e conversas diretas em tempo real. Quem você pode chamar no privado segue a estrutura da empresa — mesmo setor/departamento, seu gestor direto ou quem responde a você." },
      { kind: "correcao", text: "Modo escuro: em várias telas o texto e os ícones sumiam sobre fundos claros (selos de status, chips e faixas). Corrigido em toda a plataforma." },
    ],
  },
  {
    version: "4.5.0",
    items: [
      { kind: "novo", text: "Clientes: novo assistente de importação de planilha, dedicado ao cadastro de clientes — importa CNPJ, categoria, código externo por empresa, status e faturamento por ano, sem criar negócio nenhum no Funil de Vendas.", roles: ["admin", "gerente"] },
      { kind: "ajuste", text: "Notificações: o sino agora separa \"Novas\" de \"Antes de hoje\" e tem filtro por tipo (Tudo/Menções/Sistema), pra achar mais rápido o que importa." },
    ],
  },
  {
    version: "4.4.5",
    items: [
      { kind: "correcao", text: "Busca global (Ctrl K): clicar na barra de busca deixava a tela em branco pra alguns usuários. Corrigido." },
    ],
  },
  {
    version: "4.4.4",
    items: [
      { kind: "ajuste", text: "Funcionários: o campo \"Cargo\" agora é um select ligado ao catálogo de Cargos & Salários (antes era texto livre, sem nenhuma relação com o catálogo) — cargos já cadastrados aparecem prontos pra escolher.", roles: ["gerente_rh", "rh"] },
    ],
  },
  {
    version: "4.4.3",
    items: [
      { kind: "correcao", text: "Férias & Licenças: \"+Solicitar\" falhava com erro técnico ao enviar — corrigido.", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Férias & Licenças: excluir um pedido às vezes não persistia de verdade (reaparecia ao atualizar a página) — corrigido.", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Férias & Licenças: recusar um pedido pelo atalho \"Mover para\" não pedia motivo nem avisava o colaborador por e-mail — agora sempre passa pelo mesmo fluxo do botão \"Recusar\".", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Meu RH: a tela podia quebrar ao abrir, com um erro diferente a cada tentativa — corrigido." },
      { kind: "correcao", text: "Onboarding: mover um card pra etapa seguinte quando falta um campo obrigatório agora sempre avisa por quê, mesmo movendo pelo menu do card (antes só avisava com o card aberto).", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Onboarding: o contador do topo não conta mais quem já está na etapa \"Removido\".", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Avaliação de Desempenho: \"+Novo feedback\" exige uma nota geral antes de salvar — evita registro vazio já em \"Concluído\".", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Cargos & Salários: excluir um cargo agora mostra feedback visual na hora — antes parecia travado até a lista atualizar sozinha.", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Fornecedores (RH): o filtro \"Vencido\" agora identifica corretamente contratos que já passaram da vigência.", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Mensagem de erro de IA mais clara quando a chave configurada está sem cota/crédito no provedor." },
    ],
  },
  {
    version: "4.4.2",
    items: [
      { kind: "correcao", text: "Treinamentos: a tela travava inteira (\"Erro ao carregar esta tela\") ao clicar no menu — corrigido.", roles: ["gerente_rh", "rh"] },
    ],
  },
  {
    version: "4.4.1",
    items: [
      { kind: "correcao", text: "Despesas: o campo pra vincular uma campanha (opcional) não tinha rótulo e sumia da tela quando nenhuma campanha estava cadastrada ainda — agora sempre aparece, com rótulo claro.", roles: ["marketing", "gerente_marketing"] },
    ],
  },
  {
    version: "4.4.0",
    items: [
      { kind: "novo", text: "Cada etapa de todos os Kanbans da plataforma agora tem seu próprio ícone de ordenação (por prioridade, prazo, mais recente ou ordem alfabética) — antes só 4 boards tinham um filtro, e era um só pro board inteiro." },
    ],
  },
  {
    version: "4.3.1",
    items: [
      { kind: "correcao", text: "Baixar um anexo em Entregas ou Campanhas navegava pra fora da plataforma, sem nenhum jeito de voltar — agora abre em outra aba, como já funcionava no Funil de Vendas." },
    ],
  },
  {
    version: "4.3.0",
    items: [
      { kind: "novo", text: "Solicitar ao Marketing agora é um formulário só: escolha \"Material de Marketing\" ou \"Compra\" logo no topo, e os campos se ajustam sozinhos — antes eram dois links/formulários separados.", roles: ["marketing", "gerente_marketing"] },
      { kind: "novo", text: "Solicitações de Compra agora passam por aprovação (\"Solicitações\") antes de entrar em Compras — antes iam direto pro Kanban sem ninguém revisar.", roles: ["marketing", "gerente_marketing"] },
      { kind: "ajuste", text: "Solicitações: etiqueta \"Material\"/\"Compra\" pra diferenciar de relance; aprovar uma Compra não pede mais destino (Entrega/Tarefa é só de Material) — vai automaticamente pro Kanban de Compras.", roles: ["marketing", "gerente_marketing"] },
    ],
  },
  {
    version: "4.2.5",
    items: [
      { kind: "novo", text: "Funcionários: agora dá pra excluir um registro (dentro do próprio card, botão de lixeira) — resolve os registros de teste/duplicados que ficavam presos na lista sem nenhum jeito de sair.", roles: ["gerente_rh", "rh"] },
      { kind: "correcao", text: "Editar ou excluir um funcionário falhava silenciosamente pra quem tinha o cargo de RH como cargo secundário — corrigido pra qualquer combinação de cargos, mesma classe de bug já corrigida em outras telas.", roles: ["gerente_rh", "rh"] },
    ],
  },
  {
    version: "4.2.4",
    items: [
      { kind: "correcao", text: "Agência agora consegue preencher os campos das etapas em Entregas (responsáveis, campanha, checklist, anexos, título) e mover o card — antes tudo aparecia travado, só dava pra ver.", roles: ["agencia", "marketing", "gerente_marketing"] },
    ],
  },
  {
    version: "4.2.3",
    items: [
      { kind: "ajuste", text: "Toast de \"Novidades\" com visual novo: mais espaço pra ler, etiqueta colorida por item e um link direto pra ver a lista completa — em vez de uma lista apertada com tudo de uma vez, mostra só as 3 novidades mais importantes." },
    ],
  },
  {
    version: "4.2.2",
    items: [
      { kind: "novo", text: "Comex: Iene (JPY) agora é uma opção de moeda nas operações de Importação e Exportação.", roles: ["comex"] },
    ],
  },
  {
    version: "4.2.1",
    items: [
      { kind: "ajuste", text: "O toast de \"Novidades\" agora mostra só o que tem a ver com o seu cargo — menos itens de outras áreas aparecendo pra você. A aba \"Novidades\" em Ajuda & Tutoriais continua com a lista completa, de todas as áreas." },
    ],
  },
  {
    version: "4.2.0",
    items: [
      { kind: "novo",     text: "Painel Executivo: agora acompanha o Grupo inteiro — faixa de saúde por área (Comercial, Marketing, RH, Comex, Pós-venda) e uma aba de profundidade pra cada uma, não só Comercial.", roles: ["gerente", "gerente_marketing", "gerente_rh"] },
      { kind: "novo",     text: "Título editável (lápis) direto no card de Campanhas, Entregas, Tarefas e Compras." },
      { kind: "novo",     text: "Menu lateral: administradores já podem reordenar seções inteiras por arrastar (segure o ícone de pontinhos que aparece ao passar o mouse) — reordenar itens dentro de uma seção continua disponível pra todo mundo, como já era.", roles: ["admin"] },
      { kind: "ajuste",   text: "Formulário de \"Solicitar ao Marketing\": tipos de material trocados por itens mais comuns (Cartas, Comunicado Interno, Caderno, Panfleto, Calendário, entre outros) e novos campos de Orçamento e Aprovador." },
      { kind: "ajuste",   text: "Entregas: campos de cada etapa (Encaminhado à Agência, Em Produção, Revisão e Aprovação, Entregue) revisados pra refletir o fluxo real de aprovação.", roles: ["marketing", "gerente_marketing", "agencia"] },
      { kind: "correcao", text: "\"Nova etapa\" voltava a dar erro de permissão pra quem tinha o cargo de marketing/RH/comex como cargo secundário — corrigido pra qualquer combinação de cargos.", roles: ["marketing", "gerente_marketing", "rh", "gerente_rh", "comex"] },
      { kind: "correcao", text: "Agência via etapa e responsável em branco no card de Entregas mesmo com os dados preenchidos.", roles: ["agencia", "marketing", "gerente_marketing"] },
      { kind: "correcao", text: "Compras não coloca mais quem está só revisando a solicitação como responsável pela execução — fica em aberto até alguém escolher de propósito.", roles: ["marketing", "gerente_marketing"] },
    ],
  },
  {
    version: "4.1.0",
    items: [
      { kind: "novo",     text: "Aba \"Agentes de IA\" (RH → Fornecedores) — crie um agente que acompanha contratos perto do vencimento e sugere o rascunho de e-mail ou aviso interno. Nada é enviado sozinho: toda sugestão espera aprovação de uma pessoa antes de sair.", roles: ["gerente_rh", "rh", "gerente"] },
      { kind: "novo",     text: "Novas notificações automáticas: negócio parado no funil, oportunidade de cross-sell, resumo semanal e novo candidato em Recrutamento." },
      { kind: "novo",     text: "Navegação por lista completa das etapas (visual novo, estilo Pipefy) em todos os quadros Kanban da plataforma — não só avançar e voltar." },
      { kind: "ajuste",   text: "Editor de campos e etapas com visual novo e unificado em todos os quadros (antes cada área tinha o seu)." },
      { kind: "ajuste",   text: "Fornecedores (RH e Marketing), Cargos e Salários, Gestão de Usuários, Sinais, Tutoriais e Relatórios de RH ganharam grade de cards com busca e filtro, no lugar da lista simples." },
      { kind: "ajuste",   text: "Funcionários: a tabela ganhou filtros.", roles: ["gerente_rh", "rh"] },
      { kind: "ajuste",   text: "Marketing: \"Análise das campanhas\" saiu de baixo do quadro Kanban e virou uma aba própria, sempre visível.", roles: ["marketing", "gerente_marketing"] },
      { kind: "novo",     text: "Marketing: quem pediu uma entrega agora recebe e-mail automático quando ela é concluída." },
      { kind: "correcao", text: "Mudar a etapa de um negócio no CRM agora sempre respeita as transições permitidas, mesmo pelo drawer de detalhes." },
      { kind: "correcao", text: "Falhas reais (erro ao salvar, e-mail que não saiu) agora aparecem como aviso — antes alguns casos fechavam a tela como se tivesse dado certo." },
      { kind: "correcao", text: "Campo obrigatório oculto não trava mais a troca de etapa sem dar como corrigir o problema." },
      { kind: "correcao", text: "Formulários com informação não salva pedem confirmação antes de fechar, em vez de descartar direto." },
      { kind: "ajuste",   text: "Mais respiro à esquerda e contorno sutil nas colunas do Kanban; tooltip da sidebar recolhida não fica mais escondido atrás do conteúdo." },
      { kind: "correcao", text: "O aviso de nova versão disponível volta a aparecer certinho a cada atualização (antes só funcionava uma vez por sessão)." },
    ],
  },
  {
    version: "4.0.0",
    items: [],
  },
];
