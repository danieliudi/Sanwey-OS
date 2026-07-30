// Normalmente escrito por scripts/extract-changelog.mjs (modo --apply), a
// partir de frases "Changelog: ..." nos commits — mas nenhum commit até aqui
// usou esse trailer, então esta primeira entrada (4.1.0) foi curada à mão a
// partir do histórico real. Script continua valendo pros próximos releases.
// Mais novo primeiro. A entrada "4.0.0" (itens vazios) existe só como piso:
// todo usuário que já usava a plataforma antes desta feature ir ao ar tem
// esse valor gravado em silêncio (ver use-changelog-notice.js) — sem ela,
// ninguém veria os itens da 4.1.0 abaixo.
export const CHANGELOG = [
  {
    version: "4.2.0",
    items: [
      "Painel Executivo: agora acompanha o Grupo inteiro — faixa de saúde por área (Comercial, Marketing, RH, Comex, Pós-venda) e uma aba de profundidade pra cada uma, não só Comercial.",
      "Título editável (lápis) direto no card de Campanhas, Entregas, Tarefas e Compras.",
      "Menu lateral: seções e itens podem ser reordenados por arrastar (segure o ícone de pontinhos que aparece ao passar o mouse).",
      "Formulário de \"Solicitar ao Marketing\": tipos de material trocados por itens mais comuns (Cartas, Comunicado Interno, Caderno, Panfleto, Calendário, entre outros) e novos campos de Orçamento e Aprovador.",
      "Entregas: campos de cada etapa (Encaminhado à Agência, Em Produção, Revisão e Aprovação, Entregue) revisados pra refletir o fluxo real de aprovação.",
      "Correção: \"Nova etapa\" voltava a dar erro de permissão pra quem tinha o cargo de marketing/RH/comex como cargo secundário — corrigido pra qualquer combinação de cargos.",
      "Correção: agência via etapa e responsável em branco no card de Entregas mesmo com os dados preenchidos.",
      "Correção: Compras não coloca mais quem está só revisando a solicitação como responsável pela execução — fica em aberto até alguém escolher de propósito.",
    ],
  },
  {
    version: "4.1.0",
    items: [
      "Novo: aba \"Agentes de IA\" (RH → Fornecedores) — crie um agente que acompanha contratos perto do vencimento e sugere o rascunho de e-mail ou aviso interno. Nada é enviado sozinho: toda sugestão espera aprovação de uma pessoa antes de sair.",
      "Novas notificações automáticas: negócio parado no funil, oportunidade de cross-sell, resumo semanal e novo candidato em Recrutamento.",
      "Navegação por lista completa das etapas (visual novo, estilo Pipefy) em todos os quadros Kanban da plataforma — não só avançar e voltar.",
      "Editor de campos e etapas com visual novo e unificado em todos os quadros (antes cada área tinha o seu).",
      "Fornecedores (RH e Marketing), Cargos e Salários, Gestão de Usuários, Sinais, Tutoriais e Relatórios de RH ganharam grade de cards com busca e filtro, no lugar da lista simples.",
      "Funcionários: a tabela ganhou filtros.",
      "Marketing: \"Análise das campanhas\" saiu de baixo do quadro Kanban e virou uma aba própria, sempre visível.",
      "Marketing: quem pediu uma entrega agora recebe e-mail automático quando ela é concluída.",
      "Correção: mudar a etapa de um negócio no CRM agora sempre respeita as transições permitidas, mesmo pelo drawer de detalhes.",
      "Correção: falhas reais (erro ao salvar, e-mail que não saiu) agora aparecem como aviso — antes alguns casos fechavam a tela como se tivesse dado certo.",
      "Correção: campo obrigatório oculto não trava mais a troca de etapa sem dar como corrigir o problema.",
      "Correção: formulários com informação não salva pedem confirmação antes de fechar, em vez de descartar direto.",
      "Ajuste visual: mais respiro à esquerda e contorno sutil nas colunas do Kanban; tooltip da sidebar recolhida não fica mais escondido atrás do conteúdo.",
      "Correção: o aviso de nova versão disponível volta a aparecer certinho a cada atualização (antes só funcionava uma vez por sessão).",
    ],
  },
  {
    version: "4.0.0",
    items: [],
  },
];
