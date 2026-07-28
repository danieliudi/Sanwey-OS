// Template padrão de checklist de evento (lista fornecida pelo Daniel em
// 28/07/2026, substitui a versão anterior de 5 segmentos), aplicado via
// botão manual no drawer da campanha. Hardcoded de propósito (mesmo
// precedente de PURCHASE_STAGES em use-marketing-purchase-requests.js): não
// foi pedido um editor de template configurável; editar isto é código, não
// UI. Cada item desta lista vira 1 tarefa (marketing_tasks) ao aplicar; os
// sub-passos de cada item viram o checklist (rh_checklists) daquela tarefa
// — item sem sub-passo na lista original usa o próprio título como único
// item do checklist, pra nunca gerar um checklist vazio.
export const EVENT_CHECKLIST_TEMPLATE = [
  { segment: "Alinhamento", items: ["Preparar apresentação", "agendar reunião"] },
  { segment: "Contrato", items: ["Contrato"] },
  { segment: "Planta", items: ["Planta"] },
  { segment: "Manual", items: ["Manual"] },
  { segment: "Extintor", items: ["Verificar contrato", "Se necessário contratar", "CP", "NF"] },
  { segment: "Coletor de dados", items: ["Ver manual", "Contratar", "CP", "NF", "Baixar leads", "compartilhar"] },
  { segment: "Energia Elétrica", items: ["Contatado Verificar adicional necessário", "Contratar", "CP", "NF"] },
  { segment: "Credenciais", items: ["Verificar quantidade e definir escala"] },
  { segment: "Convite VIP", items: ["Verificar", "Definir convidados", "Envio do convite"] },
  { segment: "Seguro", items: ["Verificar no manual se é necessário", "contratar"] },
  { segment: "Autorização da Montadora", items: ["Autorização da Montadora"] },
  { segment: "Segurança", items: ["Verificar Manual", "cotar", "aprovar", "NF", "CP"] },
  { segment: "Limpeza", items: ["Ver manual", "Cotação", "confirmação de serviço", "NF", "CP"] },
  { segment: "Banner Stand", items: ["Definir", "solicitar à agência", "Analisar/aprovar", "Enviar à montadora"] },
  { segment: "Totem", items: ["Totem"] },
  { segment: "Tela de Led", items: ["Verificar, Cotar, contratar, NF, CP"] },
  { segment: "Alinhamento", items: ["Alinhamento"] },
  { segment: "Vídeos", items: ["Verificar necessidade de atualizações", "Definir vídeos", "salvar em pen drive"] },
  { segment: "Amostras de Produtos", items: ["Definir modelos e quantidades", "Solicitação em sistema", "Conferência física", "emissão de nota fiscal saída", "NF Retorno"] },
  { segment: "Material impresso", items: ["Verificar necessidade de criação", "Verificar Estoque", "Cotação", "Pedido", "Entrega NF", "CP"] },
  { segment: "Cartão de Visitas", items: ["Levantar necessidade", "Cotar", "confirmar pedido", "NF", "CP"] },
  { segment: "Kit mídia convite", items: ["Kit mídia convite"] },
  { segment: "Chopeira", items: ["Definir, Cotar, Contratar, Entrega NF, CP"] },
  { segment: "Máquina de Café", items: ["Definir", "Cotar", "Contratar", "NF", "CP"] },
  { segment: "Brindes", items: ["Verificar Estoque", "Pedido", "entrega"] },
  { segment: "Buffet", items: ["Definir", "cotar", "Pedido", "entrega NF", "CP"] },
  { segment: "Descartáveis", items: ["Verificar estoque", "levantar necessidade", "compra", "preparar embalagens"] },
  { segment: "Fechamento", items: ["preparar relatório"] },
];
