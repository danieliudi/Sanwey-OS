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
