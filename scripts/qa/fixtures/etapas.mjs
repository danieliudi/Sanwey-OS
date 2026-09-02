// Etapas de `rh_pipeline_stages` como fixture da varredura de QA.
//
// Por que existe: sem etapa cadastrada, TODO Kanban da plataforma renderiza
// vazio — e uma varredura que só vê tela vazia não prova quase nada. Estas
// são as 79 etapas reais lidas da produção em 02/09/2026, reduzidas às
// colunas que a interface usa. É configuração de processo (nome, cor, ordem),
// não dado de negócio: nenhum registro de cliente, colaborador ou valor.
//
// Se um domínio novo nascer, adicione aqui — senão o board dele entra na
// varredura como tela vazia e o achado passa batido.
//
// Formato compacto: [stage_key, nome, cor, terminal, won, lost].
const D = {
  comercial: [
    ["prospeccao", "Prospecção", "#B45309", 0, 0, 0],
    ["qualificacao", "Qualificação", "#DC2626", 0, 0, 0],
    ["visitas", "Visitas/Apresentação", "#EAB308", 0, 0, 0],
    ["amostras", "Amostras/Maturação", "#16A34A", 0, 0, 0],
    ["negociacao", "Negociação", "#3B82F6", 0, 0, 0],
    ["ganho", "Negócio Fechado", "#047857", 1, 1, 0],
    ["perdido", "Perdido", "#C7212B", 1, 0, 1],
  ],
  marketing: [
    ["briefing", "Briefing", "#1D4ED8", 0, 0, 0],
    ["aprovacao", "Aprovação", "#DB2777", 0, 0, 0],
    ["producao", "Produção", "#EA580C", 0, 0, 0],
    ["revisao", "Revisão", "#7C3AED", 0, 0, 0],
    ["ao_vivo", "Ao Vivo", "#16A34A", 0, 0, 0],
    ["encerrado", "Encerrado", "#9CA3AF", 1, 0, 0],
  ],
  marketing_deliverables: [
    ["solicitacao", "Solicitação", "#6366F1", 0, 0, 0],
    ["encaminhado_para_agencia", "Encaminhado à Agência", "#EAB308", 0, 0, 0],
    ["em_producao", "Em Produção", "#D97706", 0, 0, 0],
    ["revisao", "Revisão e Aprovação", "#7C3AED", 0, 0, 0],
    ["entregue", "Entregue", "#16A34A", 1, 0, 0],
    ["reprovados_arquivados", "Reprovados/Arquivados", "#64748B", 0, 0, 0],
  ],
  marketing_tasks: [
    ["a_fazer", "A Fazer", "#6366F1", 0, 0, 0],
    ["planejamento", "Planejamento", "#64748B", 0, 0, 0],
    ["em_andamento", "Em Execução", "#D97706", 0, 0, 0],
    ["planejamento_1", "Acompanhamento", "#B45309", 0, 0, 0],
    ["concluido", "Concluído", "#16A34A", 1, 0, 0],
    ["arquivado", "Arquivado", "#7C3AED", 0, 0, 0],
  ],
  vagas: [
    ["rascunho", "Rascunho", "#8A8680", 0, 0, 0],
    ["publicada", "Publicada", "#0EA5E9", 0, 0, 0],
    ["em_triagem", "Em Triagem", "#8B5CF6", 0, 0, 0],
    ["encerrada", "Encerrada", "#6B7280", 1, 0, 0],
  ],
  candidatos: [
    ["triagem", "Triagem", "#6366F1", 0, 0, 0],
    ["entrevista1", "Entrevista RH", "#0EA5E9", 0, 0, 0],
    ["entrevista2", "Entrevista Gestor", "#8B5CF6", 0, 0, 0],
    ["tecnico", "Teste Técnico", "#F59E0B", 0, 0, 0],
    ["proposta", "Proposta", "#0D9488", 0, 0, 0],
    ["aprovado", "Aprovado", "#16A34A", 1, 1, 0],
    ["reprovado", "Reprovado", "#6B7280", 1, 0, 1],
  ],
  onboarding: [
    ["pre_admissao", "Pré-admissão", "#7C3AED", 0, 0, 0],
    ["documentacao", "Documentação", "#8A8680", 0, 0, 0],
    ["integracao", "Integração", "#0EA5E9", 0, 0, 0],
    ["acompanhamento", "Acompanhamento", "#DB2777", 0, 0, 0],
    ["avaliacao", "Avaliação", "#D97706", 0, 0, 0],
    ["concluido", "Concluído", "#16A34A", 1, 0, 0],
    ["removido", "Removido", "#DC2626", 1, 0, 1],
  ],
  ferias: [
    ["pendente", "Pendente", "#B45309", 0, 0, 0],
    ["aprovado", "Aprovado", "#16A34A", 1, 1, 0],
    ["recusado", "Recusado", "#DC2626", 1, 0, 1],
  ],
  feedback: [
    ["rascunho", "Rascunho", "#B45309", 0, 0, 0],
    ["em_andamento", "Em Andamento", "#3B82F6", 0, 0, 0],
    ["concluido", "Concluído", "#16A34A", 1, 1, 0],
  ],
  treinamentos: [
    ["pendente", "Pendente", "#B45309", 0, 0, 0],
    ["concluido", "Concluído", "#16A34A", 0, 0, 0],
    ["vencido", "Vencido", "#DC2626", 0, 0, 0],
  ],
  posvenda: [
    ["onboarding_cliente", "Onboarding do cliente", "#3B82F6", 0, 0, 0],
    ["acompanhamento", "Acompanhamento", "#8B5CF6", 0, 0, 0],
    ["renovacao_upsell", "Renovação/Upsell", "#16A34A", 0, 0, 0],
    ["encerrado", "Encerrado", "#64748B", 1, 0, 0],
  ],
  comex_importacao: [
    ["sourcing", "Sourcing & Qualificação de Fornecedor", "#64748B", 0, 0, 0],
    ["cotacao_landed_cost", "Cotação & Landed Cost", "#2563EB", 0, 0, 0],
    ["po_fechamento", "PO & Fechamento Financeiro", "#7C3AED", 0, 0, 0],
    ["producao_embarque", "Produção & Prontidão para Embarque", "#D97706", 0, 0, 0],
    ["transito_aduana", "Em Trânsito & Parametrização Aduaneira", "#EA580C", 0, 0, 0],
    ["recebimento", "DTA, Transporte Nacional & Recebimento", "#16A34A", 1, 1, 0],
  ],
  comex_exportacao: [
    ["qualificacao_comprador", "Qualificação do Comprador Internacional", "#64748B", 0, 0, 0],
    ["analise_regulatoria", "Análise Regulatória & Precificação por Incoterm", "#2563EB", 0, 0, 0],
    ["proforma_negociacao", "Proforma Invoice & Negociação", "#7C3AED", 0, 0, 0],
    ["order_entry_producao", "Order Entry & Instrução de Produção", "#D97706", 0, 0, 0],
    ["embarque_despacho", "Gestão do Embarque & Despacho", "#EA580C", 0, 0, 0],
    ["liquidacao", "Documentos Originais & Liquidação Cambial", "#16A34A", 1, 1, 0],
  ],
  bugs: [
    ["reportado", "Reportado", "#64748B", 0, 0, 0],
    ["em_analise", "Em Análise", "#5B4FC4", 0, 0, 0],
    ["correcao_proposta", "Correção Proposta", "#B4790A", 0, 0, 0],
    ["corrigido", "Corrigido", "#1A6E35", 1, 1, 0],
  ],
};

// `comercial` é o único domínio com etapa POR EMPRESA (uma linha pra industria
// e outra pra resibag, mesmo stage_key) — o resto é company_id 'all'. A
// varredura precisa refletir isso: é o que faz o Funil montar as colunas.
const POR_EMPRESA = new Set(["comercial"]);

export function etapasFixture() {
  const linhas = [];
  let n = 0;
  for (const [domain, etapas] of Object.entries(D)) {
    const empresas = POR_EMPRESA.has(domain) ? ["industria", "resibag"] : ["all"];
    for (const empresa of empresas) {
      etapas.forEach(([stage_key, name, color, terminal, won, lost], i) => {
        linhas.push({
          id: `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}`,
          domain, stage_key, name, color,
          order_idx: i,
          probability: domain === "comercial" ? [10, 25, 40, 60, 80, 100, 0][i] ?? null : null,
          sla_days: null,
          terminal: Boolean(terminal), won: Boolean(won), lost: Boolean(lost),
          code: null, card_preview_fields: null, description: null,
          company_id: empresa,
          created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
          created_by: null,
        });
      });
    }
  }
  return linhas;
}
