import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, TrendingUp, Printer, Bot, Sparkles, Loader2, RotateCcw, Megaphone, Briefcase, ArrowRight, Ship, Handshake, Leaf } from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { ROUTES } from "../../constants/routes";
import { useAI } from "../../hooks/use-ai";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingTasks } from "../../hooks/use-marketing-tasks";
import { useMarketingPurchaseRequests } from "../../hooks/use-marketing-purchase-requests";
import { useMarketingExpenses } from "../../hooks/use-marketing-expenses";
import { useMarketingBudgets } from "../../hooks/use-marketing-budgets";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHFeriasRequests } from "../../hooks/use-rh-ferias-requests";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";
import { useRHFeedback } from "../../hooks/use-rh-feedback";
import { useComexImportOperations } from "../../hooks/use-comex-import-operations";
import { useComexExportOperations } from "../../hooks/use-comex-export-operations";
import { usePosvenda } from "../../hooks/use-posvenda";
import { useCRMViagens } from "../../hooks/use-crm-viagens";
import { useCRMDespesas } from "../../hooks/use-crm-despesas";
import { useAllLeadSamples } from "../../hooks/use-lead-samples";
import { sumTravelExpenses, sumSampleCosts, calculateCAC, cacFormulaHint, periodCutoff } from "../../utils/cac";
import { useEsgEmissionRecords, useEsgEmissionFactors, useEsgReports } from "../../hooks/use-esg-carbon";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { forecastPrompt, funnelDiagnosisPrompt } from "../../constants/ai-prompts";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { EmptyState } from "../ui/EmptyState";
import { formatK } from "../../utils/currency";
import {
  computeBudgetUsage, computeBudgetTotals, expenseFiscalDate, purchaseFiscalDate,
  budgetRatioStatus, formatBudgetPct, BUDGET_STATUS_STYLE,
} from "../../utils/marketing-budget";
import { formatDateBR, parseDateInput } from "../../utils/date";
import { isStale, weightedValue } from "../../utils/pipeline-metrics";
import { ExecutiveCharts } from "./ExecutiveCharts";
import { AnalyticsTab } from "./AnalyticsTab";
import { FunnelHistoryView } from "./FunnelHistoryView";

// Painel Executivo — único ponto de visão consolidada do Grupo. Inclui
// o que era a tela "Presidência" como uma tab. Filtro de período é
// global da tela e afeta todas as agregações.
//
// Estrutura (regra 8 do CLAUDE.md, 29/07/2026): "Visão geral" é uma faixa
// de saúde (1 número + 1 alerta por área) que nunca deve deixar de crescer
// quando um departamento novo nasce na plataforma — cada área abre numa aba
// própria ao lado, Comercial mantém a profundidade que já tinha (Gráficos/
// Análise/IA/Histórico) dentro da própria aba "Comercial".

const PERIODS = [
  { id: "all", label: "Todo período" },
  { id: "30d", label: "30 dias" },
  { id: "60d", label: "60 dias" },
  { id: "90d", label: "90 dias" },
  { id: "ytd", label: "Este ano" },
];

// Sub-abas de profundidade da área Comercial — eram as únicas abas do painel
// antes da regra 8; agora vivem dentro da aba "Comercial".
const COMERCIAL_SUBTABS = [
  { id: "overview",   label: "Visão geral",  hint: "KPIs e pipeline por empresa" },
  { id: "charts",     label: "Gráficos",     hint: "Evolução e distribuição visual" },
  { id: "analytics",  label: "Análise",      hint: "Diagnóstico detalhado por etapa" },
  { id: "ia",         label: "IA",           hint: "Análise e forecast com inteligência artificial" },
  { id: "historico",  label: "Histórico",    hint: "Evolução do funil ao longo do tempo" },
];

const AREA_TABS = [
  { id: "overview",  label: "Visão geral" },
  { id: "comercial", label: "Comercial" },
  { id: "marketing", label: "Marketing" },
  { id: "rh",        label: "RH" },
  { id: "comex",     label: "Comex" },
  { id: "posvenda",  label: "Pós-venda" },
  { id: "esg",       label: "ESG & Carbono" },
];

function fmtT(kg) {
  return `${((kg || 0) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`;
}

// `periodCutoff` mora em src/utils/cac.js (fonte única) — o Funil de Vendas
// precisa do MESMO corte pros dois lados da divisão do CAC, então deixou de
// ser função local desta tela.
function filterByPeriod(leads, period) {
  const cutoff = periodCutoff(period);
  if (cutoff == null) return leads;
  return leads.filter(l => {
    const ts = new Date(l.stageChangedAt || l.createdAt).getTime();
    return !Number.isNaN(ts) && ts >= cutoff;
  });
}

// parseDateInput, não `new Date(iso)` cru: quem chama aqui passa data fiscal
// (vencimento/nota), que chega como "AAAA-MM-DD" — lida como instante UTC, ela
// volta um dia em BRT e o dia 1 de qualquer mês cairia no mês anterior.
function isThisMonth(iso) {
  if (!iso) return false;
  const d = parseDateInput(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// Etapa não-terminal de um domain de rh_pipeline_stages — mesmo critério
// usado pelos próprios boards (Comex, Pós-venda, Entregas, Tarefas), em vez
// de adivinhar qual stage_key é o final de cada um. Sem stages carregadas
// ainda, assume aberto (não superestima "fechado" antes do fetch resolver).
function isOpenStage(item, stages, stageKey = "stage") {
  if (!stages?.length) return true;
  const s = stages.find(s => s.stageKey === item[stageKey]);
  return !s?.terminal;
}
function countOpen(items, stages, stageKey = "stage") {
  return items.filter(i => isOpenStage(i, stages, stageKey)).length;
}

export function ExecutiveDashboard({
  leads, crossReferrals, pipelines, users, currentUser, activeCompany, visibleWidgets,
  isAdmin = false, isComercialManager = false, isMarketingManager = false, isRHManager = false,
  isComexManager = false, isEsgViewer = false,
}) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("all");
  const [areaTab, setAreaTab] = useState("overview");
  const [comercialSubTab, setComercialSubTab] = useState("overview");
  const widgetVisible = (id) => !visibleWidgets || visibleWidgets.includes(id);

  // Cada gerente de departamento só vê o(s) recorte(s) do próprio setor —
  // admin/diretoria continuam vendo tudo.
  const showComercialArea = isAdmin || isComercialManager;
  const showMarketingArea = (isAdmin || isMarketingManager) && widgetVisible("outras_marketing");
  const showRHArea        = (isAdmin || isRHManager) && widgetVisible("outras_rh");
  const showComexArea     = (isAdmin || isComexManager) && widgetVisible("tab_comex");
  // Pós-venda navega junto de Comercial na plataforma toda (mesmo escopo de
  // gerente) — não é um departamento à parte com gerente próprio.
  const showPosVendaArea  = (isAdmin || isComercialManager) && widgetVisible("tab_posvenda");
  // ESG & Carbono: gate igual ao da própria tela (isManager || isDiretoria,
  // passado de App.jsx como isEsgViewer) — não isAdmin isolado, porque admin
  // já cai em isComercialManager/isEsgViewer via essa mesma prop no chamador.
  const showEsgArea = isEsgViewer && widgetVisible("tab_esg");
  const anyAreaVisible = showComercialArea || showMarketingArea || showRHArea || showComexArea || showPosVendaArea || showEsgArea;

  const visibleAreaTabs = useMemo(() => AREA_TABS.filter(t => {
    if (t.id === "overview")  return true;
    if (t.id === "comercial") return showComercialArea;
    if (t.id === "marketing") return showMarketingArea;
    if (t.id === "rh")        return showRHArea;
    if (t.id === "comex")     return showComexArea;
    if (t.id === "posvenda")  return showPosVendaArea;
    if (t.id === "esg")       return showEsgArea;
    return false;
  }), [showComercialArea, showMarketingArea, showRHArea, showComexArea, showPosVendaArea, showEsgArea]);

  const visibleComercialSubtabs = useMemo(
    () => COMERCIAL_SUBTABS.filter(t => t.id === "overview" || widgetVisible(`tab_${t.id}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleWidgets]
  );

  // Se o usuário esconder a aba ativa em Configurações, volta pro fallback.
  useEffect(() => {
    if (!visibleAreaTabs.some(t => t.id === areaTab)) setAreaTab("overview");
  }, [visibleAreaTabs, areaTab]);
  useEffect(() => {
    if (!visibleComercialSubtabs.some(t => t.id === comercialSubTab)) setComercialSubTab("overview");
  }, [visibleComercialSubtabs, comercialSubTab]);

  const filteredLeads = useMemo(() => filterByPeriod(leads, period), [leads, period]);

  const metricsByCompany = useMemo(() => {
    const byId = Object.create(null);
    for (const id of COMPANY_IDS) {
      byId[id] = {
        id,
        company: COMPANIES[id],
        leadsCount: 0,
        open: 0, won: 0, lost: 0,
        pipeline: 0, forecast: 0,
        wonValue: 0, lostValue: 0,
        activated: 0, stale: 0,
      };
    }
    for (const l of filteredLeads) {
      const m = byId[l.companyId];
      if (!m) continue;
      const companyStages = pipelines?.[l.companyId];
      m.leadsCount++;
      if (l.stage === "ganho") { m.won++; m.wonValue += l.value; }
      else if (l.stage === "perdido") { m.lost++; m.lostValue += l.value; }
      else {
        m.open++;
        m.pipeline += l.value;
        m.forecast += weightedValue(l, companyStages);
        if (isStale(l, companyStages)) m.stale++;
      }
      if (l.stage !== "prospeccao") m.activated++;
    }
    return COMPANY_IDS.map(id => {
      const m = byId[id];
      m.activationRate = m.leadsCount > 0 ? Math.round((m.activated / m.leadsCount) * 100) : 0;
      return m;
    });
  }, [filteredLeads, pipelines]);

  const totals = useMemo(() => {
    let pipeline = 0, forecast = 0, wonValue = 0, wonCount = 0, totalCount = 0, stale = 0;
    for (const m of metricsByCompany) {
      pipeline += m.pipeline;
      forecast += m.forecast;
      wonValue += m.wonValue;
      wonCount += m.won;
      stale += m.stale;
      totalCount += m.leadsCount;
    }
    const conversion = totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : 0;
    return { pipeline, forecast, wonValue, wonCount, stale, conversion };
  }, [metricsByCompany]);

  // CAC agregado do Grupo inteiro no período selecionado — sem filtro de
  // vendedor aqui (diferente do Funil de Vendas): soma tudo que a RLS já
  // deixou visível pro usuário atual, mesmo espírito de `totals` acima (que
  // também não filtra por vendedor). Ver src/utils/cac.js.
  //
  // Achado 20/08/2026: os dois hooks abaixo (despesas/amostras) viviam mais
  // adiante no arquivo, depois deste useMemo — como são const/let, ficam em
  // "temporal dead zone" até a linha da declaração rodar, e o useMemo já
  // tenta ler viagemDespesas/leadSamplesAll na primeira renderização, antes
  // de chegar lá. Resultado: "Cannot access ... before initialization",
  // painel inteiro quebrado. Só busca despesas/amostras quando a área
  // Comercial está visível pro usuário atual.
  const { despesas: viagemDespesas } = useCRMDespesas({ enabled: showComercialArea });
  const { samples: leadSamplesAll } = useAllLeadSamples({ enabled: showComercialArea });
  const cac = useMemo(() => {
    if (!showComercialArea) return null;
    const cutoff = periodCutoff(period);
    const travelExpensesTotal = sumTravelExpenses(viagemDespesas, { periodStart: cutoff });
    const sampleCostsTotal = sumSampleCosts(leadSamplesAll, { periodStart: cutoff });
    return calculateCAC({ travelExpensesTotal, sampleCostsTotal, wonCount: totals.wonCount });
  }, [showComercialArea, viagemDespesas, leadSamplesAll, period, totals.wonCount]);

  const maxPipeline = useMemo(
    () => Math.max(1, ...metricsByCompany.map(m => m.pipeline)),
    [metricsByCompany],
  );

  const pendingCross = useMemo(
    () => crossReferrals.filter(r => r.status === "pending" || r.type === "overlap").length,
    [crossReferrals],
  );

  // Usa as etapas reais de cada empresa (pipelines[companyId], já vem do
  // banco via usePipelines) em vez da lista fixa DEFAULT_PIPELINE_STAGES —
  // senão o funil (e os gráficos em ExecutiveCharts) somem leads e ficam
  // com percentuais errados assim que uma empresa customiza o pipeline via
  // Construtor de pipeline.
  const funnelStages = useMemo(() => {
    const total = filteredLeads.length || 1;
    const presentIds = new Set(filteredLeads.map(l => l.companyId));
    const extraIds = [...presentIds].filter(id => !COMPANY_IDS.includes(id));
    const sourceCompanies = presentIds.size > 0 ? [...COMPANY_IDS.filter(id => presentIds.has(id)), ...extraIds] : COMPANY_IDS;
    const stageMap = new Map();
    for (const cid of sourceCompanies) {
      const stages = (pipelines?.[cid] || DEFAULT_PIPELINE_STAGES).filter(s => !s.lost);
      for (const s of stages) {
        if (!stageMap.has(s.id)) stageMap.set(s.id, s);
      }
    }
    const counts = Object.create(null);
    for (const s of stageMap.values()) counts[s.id] = 0;
    for (const l of filteredLeads) {
      if (counts[l.stage] != null) counts[l.stage]++;
    }
    return Array.from(stageMap.values()).map(stage => {
      const count = counts[stage.id] || 0;
      const pct = (count / total) * 100;
      return { stage, count, pct };
    });
  }, [filteredLeads, pipelines]);

  // ── Dados das outras áreas — um hook por domínio, mesmo padrão que já
  // existia (DepartmentsOverview chamava 4 hooks incondicionalmente; agora
  // são mais, mas o critério não muda: React não permite chamar hooks
  // condicionalmente, então todos disparam, e cada área decide se mostra o
  // resultado via showXArea). ──
  const { campaigns,    loading: loadingCampaigns }    = useMarketingCampaigns({});
  const { deliverables, loading: loadingDeliverables } = useMarketingDeliverables({});
  const { tasks,        loading: loadingTasks }        = useMarketingTasks({});
  const { purchases,    loading: loadingPurchases }    = useMarketingPurchaseRequests({});
  const { expenses,     loading: loadingExpenses }     = useMarketingExpenses({});
  const { budgets: marketingBudgets, loading: loadingBudgets } = useMarketingBudgets({ enabled: showMarketingArea });
  const { vagas, candidatos, loading: loadingRecrutamento } = useRHRecrutamento({});
  const { colaboradores,     loading: loadingColaboradores } = useRHColaboradores({});
  const { requests: feriasRequests, loading: loadingFerias } = useRHFeriasRequests({});
  const { atribuicoes: treinamentoAtribuicoes, loading: loadingTreinamentos } = useRHTreinamentos({});
  const { feedbacks,    loading: loadingFeedbacks }    = useRHFeedback({ enabled: showRHArea });
  const { operations: comexImports, loading: loadingComexImports } = useComexImportOperations({});
  const { operations: comexExports, loading: loadingComexExports } = useComexExportOperations({});
  const { cases: posvendaCases, loading: loadingPosvenda } = usePosvenda({});
  const { registros: viagens, loading: loadingViagens } = useCRMViagens({});
  const { records: esgRecords, loading: loadingEsgRecords } = useEsgEmissionRecords({});
  const { factors: esgFactors, loading: loadingEsgFactors } = useEsgEmissionFactors();
  const { reports: esgReports, loading: loadingEsgReports } = useEsgReports({});

  const { stages: deliverableStages } = useRHPipelineStages("marketing_deliverables");
  const { stages: taskStages }        = useRHPipelineStages("marketing_tasks");
  const { stages: posvendaStages }    = useRHPipelineStages("posvenda");
  const { stages: comexImportStages } = useRHPipelineStages("comex_importacao");
  const { stages: comexExportStages } = useRHPipelineStages("comex_exportacao");

  const dash = "—";

  // Marketing
  const campanhasAtivas   = loadingCampaigns ? dash : campaigns.filter(c => c.stage !== "encerrado").length;
  const entregasAbertas   = loadingDeliverables ? dash : countOpen(deliverables, deliverableStages);
  const tarefasAtrasadas  = loadingTasks ? dash : tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && isOpenStage(t, taskStages)).length;
  // Mês de uma despesa/compra = data fiscal (nota → vencimento → criação, o
  // helper único de src/utils/marketing-budget.js), NUNCA createdAt: com a data
  // de digitação, uma nota de dezembro lançada em janeiro entrava em "Despesas
  // no mês" de janeiro enquanto o tile vizinho ("% consumido") a jogava em
  // dezembro — dois números lado a lado com regras de data diferentes.
  const comprasNoMes      = loadingPurchases ? dash : purchases.filter(p => isThisMonth(purchaseFiscalDate(p))).reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const despesasNoMes     = loadingExpenses ? dash : expenses.filter(e => isThisMonth(expenseFiscalDate(e))).reduce((sum, e) => sum + (e.amount || 0), 0);

  // Orçamento de Marketing — teto do ano corrente x consumido (pago + a pagar),
  // pelo motor único de src/utils/marketing-budget.js. Escopo do Grupo inteiro
  // (sem filtro de empresa), igual às outras métricas de Marketing desta tela;
  // o filtro de período do topo é do Comercial e não vale aqui — teto é anual.
  // `purchases` entra pra que o comprometido seja calculado corretamente caso
  // a faixa passe a ser exibida; o "% consumido" abaixo usa `consumed`
  // (pago + a pagar), que é literalmente o que o rótulo diz.
  const currentYear = new Date().getFullYear();
  const marketingBudget = useMemo(
    () => computeBudgetTotals(computeBudgetUsage({
      budgets: marketingBudgets, expenses, purchases, year: currentYear,
    })),
    [marketingBudgets, expenses, purchases, currentYear],
  );
  // Teto 0 conta como "sem teto": não existe percentual honesto contra zero.
  const temTetoMarketing = !loadingBudgets && marketingBudget.count > 0 && marketingBudget.budgetAmount > 0;
  // Mesmos limiares do resto da feature (budgetRatioStatus, 80%): abaixo disso
  // o número fica neutro — cor só quando há sinal a dar. Nunca --accent pra
  // alerta (muda por frente comercial em runtime). Rótulo e cor saem do MESMO
  // número (formatBudgetPct): com Math.round, 79,6% imprimia "80%" sem cor de
  // atenção e 100,4% imprimia "100%" já em vermelho.
  const marketingBudgetRatio = temTetoMarketing ? marketingBudget.consumed / marketingBudget.budgetAmount : null;
  const marketingBudgetStatus = budgetRatioStatus(marketingBudgetRatio);
  const marketingPctConsumido = temTetoMarketing
    ? formatBudgetPct(marketingBudgetRatio, marketingBudgetStatus)
    : null;
  const marketingBudgetColor = marketingBudgetStatus && marketingBudgetStatus !== "ok"
    ? BUDGET_STATUS_STYLE[marketingBudgetStatus].color
    : null;

  // RH
  const vagasPublicadas       = loadingRecrutamento ? dash : vagas.filter(v => v.stage === "publicada").length;
  const candidatosEmProcesso  = loadingRecrutamento ? dash : candidatos.filter(c => !["aprovado", "reprovado"].includes(c.stage)).length;
  const onboardingEmAndamento = loadingColaboradores ? dash : colaboradores.filter(c => c.onboardingStage && c.onboardingStage !== "concluido").length;
  const emFeriasProximos7d    = loadingFerias ? dash : feriasRequests.filter(overlapsNext7Days).length;
  const feriasPendentes       = loadingFerias ? dash : feriasRequests.filter(r => r.status === "pendente").length;
  const treinamentosAtivos    = loadingTreinamentos ? dash : treinamentoAtribuicoes.filter(a => a.status !== "concluido").length;
  const avaliacoesPendentes   = loadingFeedbacks ? dash : feedbacks.filter(f => f.status !== "concluido").length;

  // Comex
  const comexImportAbertas = loadingComexImports ? dash : countOpen(comexImports, comexImportStages);
  const comexExportAbertas = loadingComexExports ? dash : countOpen(comexExports, comexExportStages);
  const comexTotalAbertas  = (loadingComexImports || loadingComexExports) ? dash : comexImportAbertas + comexExportAbertas;

  // Pós-venda
  const posvendaAbertos = loadingPosvenda ? dash : countOpen(posvendaCases, posvendaStages);
  const posvendaValor   = loadingPosvenda ? dash : formatK(posvendaCases.reduce((sum, c) => sum + (c.value || 0), 0));

  // Viagens (rolla dentro de Comercial, pedido do Daniel — quem viaja é
  // vendedor/gerente, não um departamento à parte)
  const viagensEmAndamento = loadingViagens ? dash : viagens.filter(v => v.status !== "realizado" && v.status !== "cancelado").length;

  // ESG & Carbono
  const esgTotalKg = loadingEsgRecords ? 0 : esgRecords.reduce((sum, r) => sum + (r.co2eCalculated || 0), 0);
  const esgTotalLabel = loadingEsgRecords ? dash : fmtT(esgTotalKg);
  const esgFatoresVigentes = loadingEsgFactors ? dash : esgFactors.filter(f => !f.validTo).length;
  const esgUltimoRelatorio = loadingEsgReports ? dash : (esgReports[0] ? formatDateBR(esgReports[0].generatedAt) : "—");

  const healthCards = [
    showComercialArea && {
      id: "comercial", label: "Comercial",
      value: formatK(totals.pipeline),
      sub: `${totals.stale} parado${totals.stale !== 1 ? "s" : ""}`,
      warn: totals.stale > 0,
    },
    showMarketingArea && {
      id: "marketing", label: "Marketing",
      value: campanhasAtivas,
      // 1 número + 1 sinal; orçamento >= 80% tem precedência sobre tarefas.
      sub: marketingBudgetColor
        ? `Orçamento ${marketingPctConsumido} consumido`
        : `${tarefasAtrasadas} tarefa${tarefasAtrasadas !== 1 ? "s" : ""} atrasada${tarefasAtrasadas !== 1 ? "s" : ""}`,
      warn: Boolean(marketingBudgetColor) || tarefasAtrasadas > 0,
    },
    showRHArea && {
      id: "rh", label: "RH",
      value: vagasPublicadas,
      sub: `${avaliacoesPendentes} avaliaç${avaliacoesPendentes !== 1 ? "ões" : "ão"} pendente${avaliacoesPendentes !== 1 ? "s" : ""}`,
      warn: avaliacoesPendentes > 0,
    },
    showComexArea && {
      id: "comex", label: "Comex",
      value: comexTotalAbertas, sub: "operações em curso",
      warn: false,
    },
    showPosVendaArea && {
      id: "posvenda", label: "Pós-venda",
      value: posvendaAbertos, sub: "casos abertos",
      warn: posvendaAbertos > 0,
    },
    showEsgArea && {
      id: "esg", label: "ESG & Carbono",
      value: esgTotalLabel, sub: "CO2e no período",
      warn: false,
    },
  ].filter(Boolean);

  // Trilho "Atenção agora" — só entra item com evidência real no período.
  const attentionItems = [
    showComercialArea && totals.stale > 0 && {
      id: "stale",
      title: "Leads com SLA estourado",
      detail: `Comercial · ${totals.stale} parado${totals.stale !== 1 ? "s" : ""}`,
      go: () => { setAreaTab("comercial"); setComercialSubTab("overview"); },
    },
    showMarketingArea && marketingBudgetColor && {
      id: "budget",
      title: "Orçamento de marketing no limiar",
      detail: `Marketing · ${marketingPctConsumido} consumido`,
      go: () => setAreaTab("marketing"),
    },
    showMarketingArea && !marketingBudgetColor && tarefasAtrasadas > 0 && {
      id: "tasks",
      title: "Tarefas de marketing atrasadas",
      detail: `Marketing · ${tarefasAtrasadas} atrasada${tarefasAtrasadas !== 1 ? "s" : ""}`,
      go: () => setAreaTab("marketing"),
    },
    showRHArea && avaliacoesPendentes > 0 && {
      id: "reviews",
      title: "Avaliações de desempenho pendentes",
      detail: `RH · ${avaliacoesPendentes} pendente${avaliacoesPendentes !== 1 ? "s" : ""}`,
      go: () => setAreaTab("rh"),
    },
    showPosVendaArea && posvendaAbertos > 0 && {
      id: "posvenda",
      title: "Casos de pós-venda abertos",
      detail: `Pós-venda · ${posvendaAbertos} aberto${posvendaAbertos !== 1 ? "s" : ""}`,
      go: () => setAreaTab("posvenda"),
    },
  ].filter(Boolean);

  const situationLine = (() => {
    const alerts = attentionItems.length;
    const areas = healthCards.length;
    const periodLabel = PERIODS.find(p => p.id === period)?.label || "período";
    if (alerts === 0) {
      return `${areas} área${areas !== 1 ? "s" : ""} no recorte “${periodLabel}”. Nenhum sinal de atenção na fila agora.`;
    }
    return `${areas} área${areas !== 1 ? "s" : ""} no recorte “${periodLabel}”. ${alerts} item${alerts !== 1 ? "s" : ""} pedindo atenção — lista à direita.`;
  })();

  return (
    <div className="exec-aperture space-y-5">
      {/* Header — período global sempre visível (antes só na aba Comercial). */}
      <div className="flex items-start justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="exec-ap-title">Painel Executivo</h1>
          <p className="exec-ap-sub">
            Grupo Sanwey · o que precisa da sua atenção agora
            {showComercialArea && areaTab === "comercial" ? ` · ${filteredLeads.length} leads` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="exec-ap-period" role="group" aria-label="Período">
            {PERIODS.map(p => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="exec-ap-btn"
            title="Imprimir / salvar como PDF"
          >
            <Printer size={12} />
            Exportar PDF
          </button>
        </div>
      </div>

      {!anyAreaVisible && (
        <EmptyState
          icon={Briefcase}
          title="Nada para mostrar aqui"
          description="As áreas deste painel foram ocultadas em Configurações → Geral → Painel Executivo. Habilite ao menos uma para ver os dados do seu departamento."
          action={
            <button
              type="button"
              onClick={() => navigate(ROUTES.settings)}
              className="exec-ap-btn exec-ap-btn-primary"
            >
              Ir para Configurações
            </button>
          }
        />
      )}

      {anyAreaVisible && (
        <>
          {/* Faixa de saúde — 1 número + 1 sinal por área. */}
          <div className="print:hidden">
            <div
              className="exec-health-band polish-stagger grid"
              style={{ "--exec-health-cols": `repeat(${Math.min(healthCards.length, 6) || 1}, 1fr)` }}
            >
              {healthCards.map(h => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setAreaTab(h.id)}
                  className="exec-ap-pulse"
                  aria-pressed={areaTab === h.id}
                >
                  <div className="exec-ap-pulse-label">{h.label}</div>
                  <div className="exec-ap-pulse-value">{h.value}</div>
                  <div className={`exec-ap-pulse-signal${h.warn ? " warn" : ""}`}>{h.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="exec-ap-tabs print:hidden" role="tablist" aria-label="Áreas">
            {visibleAreaTabs.map(t => {
              const active = areaTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  data-tour={t.id === "esg" ? "executive-esg-tab" : undefined}
                  aria-selected={active}
                  onClick={() => setAreaTab(t.id)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {areaTab === "overview" && (
            <div className="space-y-5">
              <div className="grid lg:grid-cols-[1.35fr_1fr] gap-4">
                <div className="exec-ap-glass exec-ap-sit">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="m-0 text-[18px] font-bold" style={{ color: "var(--ap-ink)" }}>Situação do Grupo</h2>
                    <span className="exec-ap-chip">{attentionItems.length === 0 ? "Sinal limpo" : `${attentionItems.length} atenção`}</span>
                  </div>
                  <p className="mt-3 mb-0 text-sm leading-relaxed" style={{ color: "var(--ap-ink-dim)" }}>
                    {situationLine}
                  </p>
                </div>
                <div className="exec-ap-glass">
                  <h2 className="m-0 text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ap-ink-dim)" }}>
                    Atenção agora
                  </h2>
                  {attentionItems.length === 0 ? (
                    <p className="mt-3 mb-0 text-sm" style={{ color: "var(--ap-ink-dim)" }}>
                      Nada na fila neste período.
                    </p>
                  ) : (
                    attentionItems.map(item => (
                      <div key={item.id} className="exec-ap-attn-row">
                        <div>
                          <div className="text-sm font-bold" style={{ color: "var(--ap-ink)" }}>{item.title}</div>
                          <div className="text-xs mt-1" style={{ color: "var(--ap-ink-dim)" }}>{item.detail}</div>
                        </div>
                        <button type="button" onClick={item.go}>Ir</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <OverviewTab metricsByCompany={showComercialArea ? metricsByCompany : []} maxPipeline={maxPipeline} funnelStages={funnelStages} showComercial={showComercialArea} />
            </div>
          )}

          {areaTab === "comercial" && showComercialArea && (
            <>
              <div>
                <div className="exec-ap-kpi-grid polish-stagger">
                  <div className="exec-ap-kpi">
                    <div className="label">Funil aberto</div>
                    <div className="value">{formatK(totals.pipeline)}</div>
                    <div className="hint">Em aberto</div>
                  </div>
                  <div className="exec-ap-kpi">
                    <div className="label">Forecast</div>
                    <div className="value">{formatK(totals.forecast)}</div>
                    <div className="hint">Ponderado por etapa</div>
                  </div>
                  <div className="exec-ap-kpi">
                    <div className="label">Receita realizada</div>
                    <div className="value">{formatK(totals.wonValue)}</div>
                    <div className="hint">{totals.wonCount} ganhos</div>
                  </div>
                  <div className="exec-ap-kpi">
                    <div className="label">Conversão</div>
                    <div className="value">{totals.conversion}%</div>
                    <div className="hint">Leads → ganhos · n={filteredLeads.length}</div>
                  </div>
                  <div className="exec-ap-kpi">
                    <div className="label">CAC médio</div>
                    <div className="value">{cac != null ? formatK(cac) : "—"}</div>
                    <div className="hint" title={cacFormulaHint(period)}>Aquisição por negócio ganho</div>
                  </div>
                  <div className="exec-ap-kpi">
                    <div className="label">Leads parados</div>
                    <div className="value">{totals.stale}</div>
                    <div className="hint">SLA estourado</div>
                  </div>
                  <div className="exec-ap-kpi">
                    <div className="label">Cross-sell pendente</div>
                    <div className="value">{pendingCross}</div>
                    <div className="hint">Aguardando</div>
                  </div>
                  <div className="exec-ap-kpi flex items-center justify-center">
                    <button
                      type="button"
                      className="exec-ap-btn exec-ap-btn-primary"
                      onClick={() => navigate(ROUTES.crm)}
                    >
                      Abrir Funil de Vendas
                    </button>
                  </div>
                </div>
              </div>

              <div className="exec-ap-tabs print:hidden mt-2" role="tablist" aria-label="Profundidade Comercial">
                {visibleComercialSubtabs.map(t => {
                  const active = comercialSubTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      title={t.hint}
                      aria-selected={active}
                      onClick={() => setComercialSubTab(t.id)}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {comercialSubTab === "overview" && (
                <OverviewTab metricsByCompany={metricsByCompany} maxPipeline={maxPipeline} funnelStages={funnelStages} showComercial extra={
                  <DeptStatRow stats={[{ v: viagensEmAndamento, l: "Viagens em andamento" }]} />
                } />
              )}
              {comercialSubTab === "charts"    && <ExecutiveCharts leads={filteredLeads} pipelines={pipelines} users={users} />}
              {comercialSubTab === "analytics" && <AnalyticsTab allLeads={leads} period={period} users={users} />}
              {comercialSubTab === "ia"        && <AIExecutivePanel leads={filteredLeads} users={users} currentUser={currentUser} />}
              {comercialSubTab === "historico" && <FunnelHistoryView user={currentUser} activeCompany={activeCompany} leads={leads} users={users} />}
            </>
          )}

          {areaTab === "marketing" && showMarketingArea && (
            <AreaDetail
              title="Marketing"
              color="#7C3AED"
              ctaLabel="Ver Marketing"
              onNavigate={() => navigate(ROUTES.marketing)}
              stats={[
                { v: campanhasAtivas,               l: "Campanhas ativas" },
                { v: entregasAbertas,                l: "Entregas em aberto" },
                { v: tarefasAtrasadas,               l: "Tarefas atrasadas" },
                { v: loadingPurchases ? dash : formatK(comprasNoMes), l: "Compras no mês" },
                { v: loadingExpenses ? dash : formatK(despesasNoMes), l: "Despesas no mês" },
                // Sem teto cadastrado, "—" — nunca 0% (que leria como "nada
                // consumido") nem divisão por zero.
                { v: temTetoMarketing ? formatK(marketingBudget.budgetAmount) : dash, l: `Orçamento ${currentYear}` },
                {
                  v: temTetoMarketing
                    ? <span style={marketingBudgetColor ? { color: marketingBudgetColor } : undefined}>{marketingPctConsumido}</span>
                    : dash,
                  l: (temTetoMarketing || loadingBudgets) ? "% consumido" : "% consumido · sem teto definido",
                },
              ]}
            />
          )}

          {areaTab === "rh" && showRHArea && (
            <AreaDetail
              title="RH"
              color="#0EA5E9"
              ctaLabel="Ver RH"
              onNavigate={() => navigate(ROUTES["rh-overview"])}
              stats={[
                { v: vagasPublicadas,        l: "Vagas publicadas" },
                { v: candidatosEmProcesso,   l: "Candidatos em processo" },
                { v: onboardingEmAndamento,  l: "Onboarding em andamento" },
                { v: emFeriasProximos7d,     l: "Em férias (7 dias)" },
                { v: feriasPendentes,        l: "Férias pendentes" },
                { v: treinamentosAtivos,     l: "Treinamentos ativos" },
                { v: avaliacoesPendentes,    l: "Avaliações pendentes" },
              ]}
            />
          )}

          {areaTab === "comex" && showComexArea && (
            <AreaDetail
              title="Comex"
              color="#0D9488"
              icon={Ship}
              ctaLabel="Ver Comex"
              onNavigate={() => navigate(ROUTES.comex)}
              stats={[
                { v: comexImportAbertas, l: "Importações em curso" },
                { v: comexExportAbertas, l: "Exportações em curso" },
              ]}
            />
          )}

          {areaTab === "posvenda" && showPosVendaArea && (
            <AreaDetail
              title="Pós-venda"
              color="#DB2777"
              icon={Handshake}
              ctaLabel="Ver Pós-venda"
              onNavigate={() => navigate(ROUTES.posvenda)}
              stats={[
                { v: posvendaAbertos, l: "Casos abertos" },
                { v: posvendaValor,   l: "Valor em carteira" },
              ]}
            />
          )}

          {areaTab === "esg" && showEsgArea && (
            <AreaDetail
              title="ESG & Carbono"
              color="#16A34A"
              icon={Leaf}
              ctaLabel="Ver ESG & Carbono"
              onNavigate={() => navigate(ROUTES["esg-carbono"])}
              stats={[
                { v: esgTotalLabel,       l: "CO2e no período" },
                { v: esgFatoresVigentes,  l: "Fatores vigentes" },
                { v: esgUltimoRelatorio,  l: "Último relatório" },
              ]}
            />
          )}
        </>
      )}
    </div>
  );
}

// Sobrepõe a janela rolante de 7 dias a partir de agora — mesmo espírito das
// outras janelas de alerta do RH (ASO/contrato/aniversário), não é semana de
// calendário. Só conta solicitação aprovada — pendente entra na outra métrica.
function overlapsNext7Days(req) {
  if (req.status !== "aprovado") return false;
  const now = Date.now();
  const in7d = now + 7 * 86400000;
  const start = new Date(req.start_date).getTime();
  const end = new Date(req.end_date).getTime();
  return start <= in7d && end >= now;
}

// ── Detalhe de área (Marketing / RH / Comex / Pós-venda) ────────────────────

function DeptStatRow({ stats }) {
  return (
    <div className="flex items-start gap-8 flex-wrap mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
      {stats.map(s => (
        <div key={s.l}>
          <div className="font-bold" style={{ fontSize: 20, color: "var(--text)", lineHeight: 1 }}>{s.v}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

function AreaDetail({ title, color, icon: Icon = Briefcase, stats, ctaLabel, onNavigate }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
            <Icon size={16} style={{ color }} />
          </div>
          <h3 className="font-semibold" style={{ fontSize: 14, color: "var(--text)" }}>{title}</h3>
        </div>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
          style={{ color, background: "none", border: "none" }}
        >
          {ctaLabel} <ArrowRight size={11} />
        </button>
      </div>
      <div className="flex items-start gap-8 flex-wrap">
        {stats.map(s => (
          <div key={s.l}>
            <div className="font-bold" style={{ fontSize: 22, color: "var(--text)", lineHeight: 1 }}>{s.v}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Executive Panel ───────────────────────────────────────────────────────

function AISection({ icon: Icon, title, description, onGenerate, loading, result, error, iconColor }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!result || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconColor + "18" }}
        >
          <Icon size={17} style={{ color: iconColor }} />
        </div>
        <div>
          <h3 className="font-semibold" style={{ fontSize: 14, color: "var(--text)" }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{description}</p>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-95"
        style={{
          background: "var(--accent)",
          color: "var(--on-accent)",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.8 : 1,
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.filter = "brightness(0.9)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {loading ? "Gerando..." : "Gerar"}
      </button>

      {error && (
        <div
          className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg"
          style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div
            className="text-sm leading-relaxed whitespace-pre-line p-3 rounded-lg border"
            style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            {result}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onGenerate}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
              style={{ background: "var(--surface)", color: "var(--text-dim)", borderColor: "var(--border)", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--text)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              <RotateCcw size={11} />
              Gerar novamente
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
              style={{
                background: copied ? "var(--success-bg)" : "var(--surface)",
                color: copied ? "var(--success)" : "var(--text-dim)",
                borderColor: copied ? "color-mix(in srgb, var(--success) 35%, transparent)" : "var(--border)",
                cursor: "pointer",
              }}
              onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--text)"; e.currentTarget.style.color = "var(--text)"; } }}
              onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; } }}
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AIExecutivePanel({ leads, users, currentUser }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastResult, setForecastResult] = useState(null);
  const [forecastError, setForecastError] = useState(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [funnelResult, setFunnelResult] = useState(null);
  const [funnelError, setFunnelError] = useState(null);

  const handleForecast = async () => {
    if (!isConfigured) return;
    setForecastLoading(true);
    setForecastResult(null);
    setForecastError(null);
    try {
      const text = await complete(forecastPrompt(leads));
      setForecastResult(text);
    } catch (err) {
      setForecastError(err.message || "Erro ao gerar forecast.");
    } finally {
      setForecastLoading(false);
    }
  };

  const handleFunnel = async () => {
    if (!isConfigured) return;
    setFunnelLoading(true);
    setFunnelResult(null);
    setFunnelError(null);
    try {
      const text = await complete(funnelDiagnosisPrompt(leads));
      setFunnelResult(text);
    } catch (err) {
      setFunnelError(err.message || "Erro ao gerar diagnóstico.");
    } finally {
      setFunnelLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>
            Inteligência Artificial Executiva
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Análises geradas pela IA com base nos dados do pipeline filtrado
          </p>
        </div>
        {!isConfigured && (
          <span
            className="text-xs font-medium px-3 py-1.5 rounded-full"
            style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
          >
            Configure sua LLM nas Configurações → Integrações
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <AISection
          icon={TrendingUp}
          iconColor="var(--accent)"
          title="Forecast Executivo"
          description="Previsão de receita realizável e principais riscos do pipeline atual"
          onGenerate={isConfigured ? handleForecast : undefined}
          loading={forecastLoading}
          result={forecastResult}
          error={forecastError}
        />
        <AISection
          icon={Bot}
          iconColor="var(--accent)"
          title="Diagnóstico de Funil"
          description="Identifica gargalos, hipóteses de causa e ações corretivas priorizadas"
          onGenerate={isConfigured ? handleFunnel : undefined}
          loading={funnelLoading}
          result={funnelResult}
          error={funnelError}
        />
      </div>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ metricsByCompany, maxPipeline, funnelStages, showComercial = true, extra = null }) {
  if (!showComercial || metricsByCompany.length === 0) {
    return extra;
  }
  return (
    <div className="space-y-5 polish-stagger">
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Funil de Vendas por empresa */}
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
          <h3 className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>
            Funil de Vendas por empresa
          </h3>
          <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--text-faint)" }}>
            Valor em aberto · barra cresce na entrada
          </p>
          <div className="space-y-4">
            {metricsByCompany.map((m, i) => {
              const pct = maxPipeline > 0 ? (m.pipeline / maxPipeline) * 100 : 0;
              return (
                <div key={m.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.company.primary }} />
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {m.company.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold font-mono shrink-0 ml-2" style={{ color: "var(--text)" }}>
                      {formatK(m.pipeline)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full polish-bar-track">
                    <div
                      className="h-full rounded-full polish-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: m.company.primary,
                        animationDelay: `${80 + i * 60}ms`,
                      }}
                      title={`${m.company.name}: ${formatK(m.pipeline)} · ${m.open} ativos`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1.5" style={{ color: "var(--text-dim)" }}>
                    <span>{m.open} ativo{m.open !== 1 ? "s" : ""}</span>
                    <span>{m.won} ganho · {m.lost} perdido</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Funil de conversão — % fora da barra (não vira “pílula achatada”) */}
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
          <h3 className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>
            Funil de conversão (Grupo)
          </h3>
          <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--text-faint)" }}>
            Share por etapa · badge circular ao lado da barra
          </p>
          <div className="space-y-3">
            {funnelStages.map(({ stage, count, pct }, i) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                    {stage.name}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "var(--text-dim)" }}>{count} lead{count !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-2.5 rounded-full polish-bar-track min-w-0">
                    <div
                      className="h-full rounded-full polish-bar-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, pct))}%`,
                        background: stage.color,
                        animationDelay: `${100 + i * 50}ms`,
                      }}
                      title={`${stage.name}: ${pct.toFixed(0)}% · ${count} leads`}
                    />
                  </div>
                  <span
                    className="shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      minWidth: 40,
                      height: 22,
                      padding: "0 8px",
                      background: `color-mix(in srgb, ${stage.color} 16%, transparent)`,
                      color: stage.color,
                    }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Matriz por empresa */}
      <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <h3 className="font-semibold mb-4" style={{ fontSize: 15, color: "var(--text)" }}>
          Desempenho por empresa · matriz
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Empresa", "Leads", "Funil de Vendas", "Forecast", "Ganho", "Ativação", "Parados"].map((h, i) => (
                  <th
                    key={h}
                    className={`py-2.5 text-xs font-semibold ${i === 0 ? "text-left pr-3" : "text-right px-3"}`}
                    style={{ color: "var(--text-dim)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricsByCompany.map(m => (
                <tr key={m.id} className="border-b polish-matrix-row" style={{ borderColor: "var(--border)" }}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.company.primary }} />
                      <span className="font-medium" style={{ color: "var(--text)" }}>
                        {m.company.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-3 font-mono" style={{ color: "var(--text)" }}>
                    {m.leadsCount}
                  </td>
                  <td className="text-right py-3 px-3 font-mono font-semibold" style={{ color: "var(--text)" }}>
                    {formatK(m.pipeline)}
                  </td>
                  <td className="text-right py-3 px-3 font-mono" style={{ color: "#0F766E" }}>
                    {formatK(m.forecast)}
                  </td>
                  <td className="text-right py-3 px-3 font-mono" style={{ color: "var(--color-resibag)" }}>
                    {formatK(m.wonValue)}
                  </td>
                  <td className="text-right py-3 px-3 font-mono" style={{ color: "var(--text)" }}>
                    {m.activationRate}%
                  </td>
                  <td
                    className="text-right py-3 pl-3 font-mono"
                    style={{ color: m.stale > 3 ? "var(--color-industria)" : "var(--text-dim)" }}
                  >
                    {m.stale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {extra}
    </div>
  );
}

export default ExecutiveDashboard;
