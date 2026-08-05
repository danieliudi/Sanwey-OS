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
