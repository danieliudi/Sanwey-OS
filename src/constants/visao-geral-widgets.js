// Registro dos widgets toggleáveis das 3 telas "Visão Geral" (Comercial,
// Marketing, RH) — Grau 3 "Template Editorial de 3 Zonas"
// (docs/design-spec-visao-geral-grau3-zonas.md §4/§8). Cada entrada:
// `{ id, zone, label, roleGate? }`. `zone` é 1 (Resumo) | 2 (O que fazer) |
// 3 (Tendência) — mesma ordem fixa nas 3 telas. `roleGate` segue o mesmo
// espírito do `dept` de `EXECUTIVE_WIDGETS` (user-settings.js): quem não
// atende ao gate nem vê o widget na checklist de Personalizar.
export const VISAO_GERAL_WIDGETS = {
  comercial: [
    { id: "leads_count", zone: 1, label: "Total de leads" },
    { id: "pipeline_open", zone: 1, label: "Funil de Vendas aberto" },
    { id: "won_value", zone: 1, label: "Valor ganho" },
    { id: "avg_fit", zone: 1, label: "Fit score médio" },
    { id: "task_overdue", zone: 2, label: "Fechamento atrasado" },
    { id: "task_followups", zone: 2, label: "Follow-ups agendados" },
    { id: "task_closing", zone: 2, label: "Fecham nesta semana" },
    { id: "task_stale", zone: 2, label: "Leads parados" },
    { id: "stage_distribution", zone: 3, label: "Distribuição por etapa do funil" },
  ],
  marketing: [
    { id: "kpi_active", zone: 1, label: "Campanhas ativas" },
    { id: "kpi_live", zone: 1, label: "Ao vivo agora" },
    { id: "kpi_budget", zone: 1, label: "Orçamento comprometido" },
    { id: "kpi_deliverables", zone: 1, label: "Entregas concluídas" },
    { id: "kpi_score", zone: 1, label: "Performance médio" },
    { id: "kpi_agency_sla", zone: 1, label: "SLA cumprido", roleGate: "not_agencia" },
    { id: "kpi_agency_leadtime", zone: 1, label: "Lead time médio", roleGate: "not_agencia" },
    { id: "bucket_deliveries_late", zone: 2, label: "Entregas atrasadas" },
    { id: "bucket_agency_stuck", zone: 2, label: "Presas em revisão", roleGate: "not_agencia" },
    { id: "panel_monthly_activity", zone: 3, label: "Atividade mensal" },
    { id: "panel_channel", zone: 3, label: "Campanhas por canal" },
    { id: "panel_stage_pipeline", zone: 3, label: "Pipeline por etapa" },
    { id: "panel_burn_rate", zone: 3, label: "Burn rate", roleGate: "not_agencia" },
    { id: "panel_category_donut", zone: 3, label: "Por categoria", roleGate: "not_agencia" },
    { id: "panel_top_performance", zone: 3, label: "Top 5 · performance" },
  ],
  rh: [
    { id: "stat_total", zone: 1, label: "Total de Funcionários" },
    { id: "stat_ativos", zone: 1, label: "Ativos" },
    { id: "stat_ferias", zone: 1, label: "De Férias" },
    { id: "stat_afastados", zone: 1, label: "Afastados" },
    { id: "stat_desligamentos", zone: 1, label: "Desligamentos (12 meses)" },
    { id: "stat_turnover_rate", zone: 1, label: "Taxa de turnover aproximada" },
    { id: "bucket_ferias_pendentes", zone: 2, label: "Férias pendentes" },
    { id: "bucket_vagas_abertas", zone: 2, label: "Vagas em aberto" },
    { id: "bucket_desligamento_sem_entrevista", zone: 2, label: "Desligamentos sem entrevista" },
    { id: "panel_departamento", zone: 3, label: "Distribuição por departamento" },
    { id: "panel_desligamento_tipo", zone: 3, label: "Desligamentos por tipo" },
    { id: "panel_admissoes_recentes", zone: 3, label: "Admissões recentes" },
  ],
};

export const ZONE_LABELS = { 1: "Resumo", 2: "O que fazer", 3: "Tendência" };

// Widget não é visível pro papel do usuário atual — nem entra na checklist
// de Personalizar (mesma lógica de `dept` já usada em `EXECUTIVE_WIDGETS`).
export function widgetAllowedForRole(widget, { isAgencia = false } = {}) {
  if (widget.roleGate === "not_agencia") return !isAgencia;
  return true;
}
