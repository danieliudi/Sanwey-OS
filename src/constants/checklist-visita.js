// Checklist Comercial de Vendas — Sanwey
//
// Transcrição fiel da folha impressa que o vendedor leva na visita (foto
// enviada pelo Daniel em 14/09/2026). Nenhum campo foi inventado, nenhum foi
// cortado: a ordem das 9 seções, os rótulos e os pesos do score são os do
// papel. Se o papel mudar, muda aqui — este arquivo é a fonte.
//
// Mockup aprovado em 14/09/2026 ("O checklist não é onde se digita"). A tese:
// durante a visita a ferramenta é GUIA, não coleta. Mostra o que ainda não foi
// perguntado; a ata de voz preenche o que foi falado; só o buraco se digita.
//
// ── ONDE CADA COISA MORA ──────────────────────────────────────────────────
// A maior parte das respostas vai em `leads.custom_fields` (jsonb que já
// existe) — é o caminho configurável da regra 5, sem tabela nova. Três coisas
// fogem disso e viram coluna de verdade, porque precisam ser ORDENADAS,
// FILTRADAS e SOMADAS por período, que é o que jsonb não faz:
//   volume_mensal_bags · volume_anual_bags · score_comercial
// Sem elas, a coleta funciona e o score de propensão e o gatilho de recompra
// continuam exatamente onde estão hoje: sem dado de onde partir.
//
// Dois campos caem em coluna que JÁ existe, e isso não é coincidência:
//   `leads.decision_maker` (jsonb) ← seção 7
//   `leads.next_follow_up`        ← seção 9, que é a regra do rodapé do papel

export const CAMPO = {
  TEXTO: "texto",
  NUMERO: "numero",
  DINHEIRO: "dinheiro",
  DATA: "data",
  ESCOLHA: "escolha",      // uma opção
  MULTI: "multi",          // várias opções
  SIM_NAO: "sim_nao",
};

// Onde a resposta é gravada. `custom` = leads.custom_fields[chave].
export const DESTINO = { COLUNA: "coluna", CUSTOM: "custom", CLIENTE: "cliente" };

export const SECOES = [
  {
    id: "qualificacao",
    numero: 1,
    nome: "Qualificação do cliente",
    // Vem pronta pra cliente que já existe na base — não se pergunta de novo
    // o que a plataforma já sabe.
    campos: [
      { chave: "empresa",    rotulo: "Empresa",           tipo: CAMPO.TEXTO, destino: DESTINO.CLIENTE, de: "company" },
      { chave: "cnpj",       rotulo: "CNPJ",              tipo: CAMPO.TEXTO, destino: DESTINO.CLIENTE, de: "cnpj" },
      { chave: "cidade_uf",  rotulo: "Cidade/UF",         tipo: CAMPO.TEXTO, destino: DESTINO.CLIENTE, de: ["city", "state"] },
      { chave: "segmento",   rotulo: "Segmento",          tipo: CAMPO.TEXTO, destino: DESTINO.CLIENTE, de: "sector" },
      { chave: "contato",    rotulo: "Contato",           tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "cargo",      rotulo: "Cargo",             tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "telefone",   rotulo: "Telefone/WhatsApp", tipo: CAMPO.TEXTO, destino: DESTINO.CLIENTE, de: "phone" },
      { chave: "email",      rotulo: "E-mail",            tipo: CAMPO.TEXTO, destino: DESTINO.CLIENTE, de: "contactEmail" },
      // QA 14/09/2026: era CAMPO.TEXTO livre apontando pra `leads.canal_origem`,
      // que tem CHECK em produção com 5 valores. Texto livre devolveria 23514 e
      // derrubaria o salvamento inteiro. As opções são exatamente as do CHECK.
      { chave: "origem_lead", rotulo: "Origem do lead", tipo: CAMPO.ESCOLHA, destino: DESTINO.COLUNA, coluna: "canal_origem",
        opcoes: ["site_widget", "manual", "import", "referral", "whatsapp"],
        rotulosOpcoes: { site_widget: "Site", manual: "Manual", import: "Importação", referral: "Indicação", whatsapp: "WhatsApp" } },
      { chave: "relacao",        rotulo: "Relação",           tipo: CAMPO.ESCOLHA, destino: DESTINO.CUSTOM,
        opcoes: ["Prospect", "Cliente atual", "Reativação"] },
    ],
  },
  {
    id: "necessidade",
    numero: 2,
    nome: "Necessidade e oportunidade",
    campos: [
      { chave: "necessidade_principal", rotulo: "Qual é a necessidade principal do cliente?", tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM, longo: true },
      { chave: "dor_principal",         rotulo: "Principal dor/problema",                     tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM, longo: true },
      { chave: "motivo_novo_fornecedor", rotulo: "Motivo para buscar novo fornecedor", tipo: CAMPO.MULTI, destino: DESTINO.CUSTOM,
        opcoes: ["Redução de custo", "Qualidade", "Prazo", "Capacidade", "Problema com fornecedor", "Aumento de volume", "Novo projeto", "Outro"] },
    ],
  },
  {
    id: "produto",
    numero: 3,
    nome: "Produto e aplicação",
    campos: [
      { chave: "produto",            rotulo: "Produto",              tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "aplicacao",          rotulo: "Aplicação",            tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "uso_destino",        rotulo: "Uso",                  tipo: CAMPO.ESCOLHA, destino: DESTINO.CUSTOM,
        opcoes: ["Industrialização", "Uso e consumo"] },
      { chave: "especificacao",      rotulo: "Especificação técnica", tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "liner",              rotulo: "Liner",                tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "dimensao",           rotulo: "Dimensão/capacidade",  tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "amostra_necessaria", rotulo: "Amostra necessária",   tipo: CAMPO.SIM_NAO, destino: DESTINO.CUSTOM },
      { chave: "homologacao_necessaria", rotulo: "Teste/homologação necessária", tipo: CAMPO.SIM_NAO, destino: DESTINO.CUSTOM },
    ],
  },
  {
    id: "operacao",
    numero: 4,
    nome: "Operação e potencial",
    campos: [
      { chave: "volume_mensal_bags",  rotulo: "Volume mensal (bags)", tipo: CAMPO.NUMERO, destino: DESTINO.COLUNA, coluna: "volume_mensal_bags" },
      { chave: "volume_anual_bags",   rotulo: "Volume anual (bags)",  tipo: CAMPO.NUMERO, destino: DESTINO.COLUNA, coluna: "volume_anual_bags" },
      { chave: "frequencia_compra",   rotulo: "Frequência de compra", tipo: CAMPO.TEXTO,  destino: DESTINO.CUSTOM },
      // Os dois campos da Classe do Cliente (documento interno de 15/09/2026,
      // transcrito em constants/classe-cliente.js). NÃO vêm da folha impressa
      // do checklist — vêm de outro documento, e é por isso que estão
      // marcados. Unidades diferentes das linhas de volume acima, de
      // propósito: aquelas são bags/mês, estas são pedidos/ano e peças/pedido.
      { chave: "pedidos_ano",         rotulo: "Frequência (pedidos/ano)",     tipo: CAMPO.NUMERO, destino: DESTINO.CUSTOM },
      { chave: "pecas_por_pedido",    rotulo: "Volume médio (peças/pedido)",  tipo: CAMPO.NUMERO, destino: DESTINO.CUSTOM },
      { chave: "sazonalidade",        rotulo: "Sazonalidade",         tipo: CAMPO.TEXTO,  destino: DESTINO.CUSTOM },
      { chave: "potencial_crescimento", rotulo: "Potencial de crescimento", tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "tipo_bag",            rotulo: "Tipo de bag",          tipo: CAMPO.ESCOLHA, destino: DESTINO.CUSTOM,
        opcoes: ["One-way", "Reutilizável", "Logística reversa"] },
      { chave: "faturamento_mensal_potencial", rotulo: "Faturamento mensal potencial", tipo: CAMPO.DINHEIRO, destino: DESTINO.CUSTOM },
      { chave: "faturamento_anual_potencial",  rotulo: "Faturamento anual potencial",  tipo: CAMPO.DINHEIRO, destino: DESTINO.CUSTOM },
    ],
  },
  {
    id: "logistica",
    numero: 5,
    nome: "Carga e logística",
    campos: [
      { chave: "tipo_carga",     rotulo: "Carga",                tipo: CAMPO.ESCOLHA, destino: DESTINO.CUSTOM, opcoes: ["Perigosa", "Não perigosa"] },
      { chave: "codigo_un",      rotulo: "Código UN",            tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "classe_risco",   rotulo: "Classe de risco",      tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "origem_carga",   rotulo: "Origem",               tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "destino_carga",  rotulo: "Destino",              tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "modal",          rotulo: "Transporte",           tipo: CAMPO.ESCOLHA, destino: DESTINO.CUSTOM, opcoes: ["Terrestre", "Marítimo"] },
      { chave: "condicao_logistica", rotulo: "Prazo desejado / condição logística", tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
    ],
  },
  {
    id: "concorrencia",
    numero: 6,
    nome: "Concorrência e target",
    campos: [
      { chave: "fornecedor_atual",      rotulo: "Fornecedor atual",        tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "concorrente_principal", rotulo: "Concorrente principal",   tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "outros_concorrentes",   rotulo: "Outros concorrentes",     tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "preco_atual_bag",       rotulo: "Preço atual (R$/bag)",    tipo: CAMPO.DINHEIRO, destino: DESTINO.CUSTOM },
      { chave: "target_cliente_bag",    rotulo: "Target do cliente (R$/bag)", tipo: CAMPO.DINHEIRO, destino: DESTINO.CUSTOM },
      { chave: "diferencial_concorrente", rotulo: "Diferencial do concorrente", tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "postura_troca",         rotulo: "Postura",                 tipo: CAMPO.ESCOLHA, destino: DESTINO.CUSTOM,
        opcoes: ["Aberto à troca", "Cliente satisfeito", "Em negociação com concorrentes"] },
      { chave: "fator_decisao",         rotulo: "Principal fator de decisão", tipo: CAMPO.ESCOLHA, destino: DESTINO.CUSTOM,
        opcoes: ["Preço", "Qualidade", "Prazo", "Serviço", "Logística", "Outro"] },
    ],
  },
  {
    id: "decisao",
    numero: 7,
    nome: "Processo de decisão",
    campos: [
      { chave: "usuario",             rotulo: "Usuário",                tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "area_tecnica",        rotulo: "Área técnica",           tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "comprador",           rotulo: "Comprador",              tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      // `leads.decision_maker` é jsonb {name, role} e o hook o preenche com um
      // placeholder {name:"—"} quando vazio — então ler a coluna crua punha
      // "[object Object]" no input e tornava os +10 de "Decisor identificado"
      // inalcançáveis. Lê e grava só o `name` (QA 14/09/2026).
      { chave: "decisor", rotulo: "Decisor", tipo: CAMPO.TEXTO, destino: DESTINO.COLUNA, coluna: "decision_maker", subcampo: "name" },
      { chave: "processo_homologacao", rotulo: "Processo de homologação", tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "prazo_decisao",       rotulo: "Prazo previsto para decisão", tipo: CAMPO.DATA, destino: DESTINO.CUSTOM },
      { chave: "primeira_compra",     rotulo: "Primeira compra prevista", tipo: CAMPO.DATA, destino: DESTINO.CUSTOM },
    ],
  },
  {
    id: "score",
    numero: 8,
    nome: "Qualificação comercial",
    calculada: true,   // não tem campo: é soma. Ver PESOS abaixo.
    campos: [],
  },
  {
    id: "plano",
    numero: 9,
    nome: "Plano de ação / Follow-up",
    campos: [
      { chave: "proxima_acao", rotulo: "Próxima ação", tipo: CAMPO.ESCOLHA, destino: DESTINO.CUSTOM,
        opcoes: ["Follow-up", "Apresentação", "Visita", "Reunião técnica", "Homologação", "Ficha técnica", "Amostra", "Cotação", "Proposta", "Negociação"] },
      { chave: "data_proximo_contato", rotulo: "Data do próximo contato", tipo: CAMPO.DATA, destino: DESTINO.COLUNA, coluna: "next_follow_up" },
      { chave: "responsavel_proximo",  rotulo: "Responsável",             tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM },
      { chave: "objetivo_proximo",     rotulo: "Objetivo do próximo contato", tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM, longo: true },
      { chave: "pendencias",           rotulo: "Pendências",              tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM, longo: true },
      { chave: "observacoes",          rotulo: "Observações",             tipo: CAMPO.TEXTO, destino: DESTINO.CUSTOM, longo: true },
    ],
  },
];

// ── Seção 8 · o score ──────────────────────────────────────────────────────
//
// Pesos e faixas são os da folha impressa, sem ajuste. A diferença é que aqui
// ele é CALCULADO a partir do que foi coletado, nunca marcado à mão — marcar
// "decisor identificado" sem ter o nome do decisor é a forma mais fácil de o
// score virar ficção, e num score que prioriza carteira isso custa caro.
//
// `pergunta` é o que o vendedor vê quando o item está faltando, redigido do
// jeito que se fala em visita. É esse texto que aparece no topo da tela.
export const PESOS = [
  { id: "alto_volume",       peso: 20, rotulo: "Alto volume",              pergunta: "Quantos bags por mês ele usa hoje?" },
  { id: "necessidade",       peso: 15, rotulo: "Necessidade medida",       pergunta: "Qual é a necessidade principal, na fala dele?" },
  { id: "target",            peso: 10, rotulo: "Target conhecido",         pergunta: "Quanto ele paga hoje por bag — e quanto queria pagar?" },
  { id: "decisor",           peso: 10, rotulo: "Decisor identificado",     pergunta: "Quem assina a compra?" },
  { id: "concorrente",       peso: 10, rotulo: "Concorrente identificado", pergunta: "Quem fornece hoje?" },
  { id: "abertura",          peso: 10, rotulo: "Abertura para troca",      pergunta: "Ele está aberto a trocar de fornecedor?" },
  { id: "produto_adequado",  peso: 10, rotulo: "Produto adequado",         pergunta: "Qual produto atende essa aplicação?" },
  { id: "prazo",             peso: 10, rotulo: "Prazo de compra definido", pergunta: "Quando isso precisa estar resolvido?" },
  { id: "proxima_acao",      peso:  5, rotulo: "Próxima ação agendada",    pergunta: "Fica combinado o quê, e pra quando?" },
];

export const FAIXAS = [
  { id: "A", min: 80, max: 100, rotulo: "Prioridade alta" },
  { id: "B", min: 50, max: 79,  rotulo: "Desenvolver" },
  { id: "C", min: 0,  max: 49,  rotulo: "Baixa prioridade" },
];

// A partir de quantos bags/mês a conta conta como "alto volume" (+20).
//
// NULO DE PROPÓSITO, e não é lacuna de implementação: o número não está na
// folha impressa nem em nenhuma fonte canônica, e chutá-lo faria o item de
// maior peso do score (20 de 100) mentir em toda a carteira. Enquanto for
// nulo, "alto volume" sai do NUMERADOR e do DENOMINADOR — o score vira "45 de
// 80 possíveis", com a tela dizendo por quê (regra 14: razão sem denominador
// honesto não sustenta decisão).
//
// Preencher com o número que o comercial usa, e a partir daí o score fecha em
// 100. É um valor por frente: o que é alto volume pra Resibag não é o mesmo
// que pra Sanbag.
export const LIMIAR_ALTO_VOLUME_BAGS = null;

export default SECOES;
