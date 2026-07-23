import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HandCoins, CheckCircle2, AlertCircle, Shuffle, TrendingUp, Target, Printer, Bot, Sparkles, Loader2, RotateCcw, Megaphone, Briefcase, ArrowRight } from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { ROUTES } from "../../constants/routes";
import { useAI } from "../../hooks/use-ai";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHFeriasRequests } from "../../hooks/use-rh-ferias-requests";
import { forecastPrompt, funnelDiagnosisPrompt } from "../../constants/ai-prompts";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { StatCard } from "../ui/StatCard";
import { EmptyState } from "../ui/EmptyState";
import { formatK, formatM } from "../../utils/currency";
import { isStale, weightedValue } from "../../utils/pipeline-metrics";
import { ExecutiveCharts } from "./ExecutiveCharts";
import { AnalyticsTab } from "./AnalyticsTab";
import { FunnelHistoryView } from "./FunnelHistoryView";

// Painel Executivo — único ponto de visão consolidada do Grupo. Inclui
// o que era a tela "Presidência" como uma tab. Filtro de período é
// global da tela e afeta todas as agregações.

const PERIODS = [
  { id: "all", label: "Todo período" },
  { id: "30d", label: "30 dias" },
  { id: "60d", label: "60 dias" },
  { id: "90d", label: "90 dias" },
  { id: "ytd", label: "Este ano" },
];

const TABS = [
  { id: "overview",   label: "Visão geral",  hint: "KPIs e pipeline por empresa" },
  { id: "charts",     label: "Gráficos",     hint: "Evolução e distribuição visual" },
  { id: "analytics",  label: "Análise",      hint: "Diagnóstico detalhado por etapa" },
  { id: "ia",         label: "IA",           hint: "Análise e forecast com inteligência artificial" },
  { id: "historico",  label: "Histórico",    hint: "Evolução do funil ao longo do tempo" },
];

function filterByPeriod(leads, period) {
  if (period === "all") return leads;
  const now = Date.now();
  let cutoff;
  if (period === "30d") cutoff = now - 30 * 86400000;
  else if (period === "60d") cutoff = now - 60 * 86400000;
  else if (period === "90d") cutoff = now - 90 * 86400000;
  else if (period === "ytd") cutoff = new Date(new Date().getFullYear(), 0, 1).getTime();
  return leads.filter(l => {
    const ts = new Date(l.stageChangedAt || l.createdAt).getTime();
    return !Number.isNaN(ts) && ts >= cutoff;
  });
}

export function ExecutiveDashboard({
  leads, crossReferrals, pipelines, users, currentUser, activeCompany, visibleWidgets,
  isAdmin = false, isComercialManager = false, isMarketingManager = false, isRHManager = false,
}) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("all");
  const [tab, setTab] = useState("overview");
  const widgetVisible = (id) => !visibleWidgets || visibleWidgets.includes(id);

  // Cada gerente de departamento só vê o(s) recorte(s) do próprio setor —
  // admin continua vendo tudo. Um usuário com múltiplos cargos (ex: gerente
  // Comercial + gerente de Marketing) vê as duas seções, nunca a de RH.
  const showComercial = isAdmin || isComercialManager;
  const showMarketingCard = (isAdmin || isMarketingManager) && widgetVisible("outras_marketing");
  const showRHCard = (isAdmin || isRHManager) && widgetVisible("outras_rh");
  const showDepartmentsOverview = showMarketingCard || showRHCard;

  const visibleTabs = useMemo(
    () => TABS.filter(t => t.id === "overview" || widgetVisible(`tab_${t.id}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleWidgets]
  );
  // Se o usuário esconder a aba ativa nas configurações, volta pra "Visão geral".
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === tab)) setTab("overview");
  }, [visibleTabs, tab]);

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
    // Itera em ordem estável (COMPANY_IDS) — antes usava a ordem de
    // aparição nos leads, o que fazia nome/cor/posição da etapa no funil
    // dependerem de qual lead vinha primeiro (não-determinístico).
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

  return (
    <div className="space-y-5">
      {/* Header com filtros e ações */}
      <div className="flex items-start justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Painel Executivo
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {showComercial
              ? <>Visão consolidada do Grupo · {filteredLeads.length} leads · {PERIODS.find(p => p.id === period)?.label}</>
              : "Visão do seu departamento"}
          </p>
        </div>
        {showComercial && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className="px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
                  style={{
                    background: period === p.id ? "var(--accent)" : "var(--surface)",
                    color: period === p.id ? "#FFFFFF" : "var(--text-dim)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
              title="Imprimir / salvar como PDF"
            >
              <Printer size={11} />
              Exportar PDF
            </button>
          </div>
        )}
      </div>

      {/* Sem Comercial e sem nenhum cartão de departamento — geralmente um
          gerente de Marketing/RH que desligou o próprio widget em
          Configurações → Preferências, o que deixava a tela em branco
          (achado da auditoria de fricção de 18/07). */}
      {!showComercial && !showDepartmentsOverview && (
        <EmptyState
          icon={Briefcase}
          title="Nada para mostrar aqui"
          description="As seções deste painel foram ocultadas em Configurações → Preferências. Habilite ao menos uma para ver os dados do seu departamento."
          action={
            <button
              onClick={() => navigate(ROUTES.settings)}
              className="text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer"
              style={{ background: "var(--accent)", color: "#FFFFFF" }}
            >
              Ir para Configurações
            </button>
          }
        />
      )}

      {/* Outras áreas do Grupo — cada gerente de departamento só vê o
          cartão do próprio setor (admin vê os dois, conforme os toggles
          em Configurações → Preferências). */}
      {showDepartmentsOverview && (
        <div className="print:hidden">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>
            {showComercial ? "Outras áreas" : "Seu departamento"}
          </div>
          <DepartmentsOverview
            showMarketing={showMarketingCard}
            showRH={showRHCard}
          />
        </div>
      )}

      {showComercial && (
        <>
          {/* KPI strip — Comercial */}
          {widgetVisible("comercial_kpis") && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>
                Comercial
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard icon={HandCoins}    value={formatM(totals.pipeline)} label="Funil de Vendas aberto"     sublabel="Em aberto" accent={"var(--text)"} />
                <StatCard icon={TrendingUp}   value={formatM(totals.forecast)} label="Forecast"            sublabel="Ponderado por etapa" />
                <StatCard icon={CheckCircle2} value={formatK(totals.wonValue)} label="Receita realizada"   sublabel={`${totals.wonCount} ganhos`} />
                <StatCard icon={Target}       value={`${totals.conversion}%`}  label="Conversão"           sublabel="Leads → ganhos" />
                <StatCard icon={AlertCircle}  value={totals.stale}             label="Leads parados"       sublabel="SLA estourado" />
                <StatCard icon={Shuffle}      value={pendingCross}             label="Cross-sell pendente" sublabel="Aguardando" />
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b print:hidden overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            {visibleTabs.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  title={t.hint}
                  className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all cursor-pointer"
                  style={{
                    color: active ? "var(--text)" : "var(--text-dim)",
                    borderBottomColor: active ? "var(--accent)" : "transparent",
                    letterSpacing: "0.08em",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "overview" && (
            <OverviewTab
              metricsByCompany={metricsByCompany}
              maxPipeline={maxPipeline}
              funnelStages={funnelStages}
            />
          )}

          {tab === "charts" && (
            <ExecutiveCharts leads={filteredLeads} pipelines={pipelines} users={users} />
          )}

          {tab === "analytics" && (
            <AnalyticsTab allLeads={leads} period={period} users={users} />
          )}

          {tab === "ia" && (
            <AIExecutivePanel leads={filteredLeads} users={users} currentUser={currentUser} />
          )}

          {tab === "historico" && (
            <FunnelHistoryView user={currentUser} activeCompany={activeCompany} leads={leads} users={users} />
          )}
        </>
      )}
    </div>
  );
}

// ── Outras áreas do Grupo (Marketing / RH) ───────────────────────────────────

function DepartmentCard({ icon: Icon, iconColor, title, stats, ctaLabel, onNavigate }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: iconColor + "18" }}>
            <Icon size={16} style={{ color: iconColor }} />
          </div>
          <h3 className="font-semibold" style={{ fontSize: 14, color: "var(--text)" }}>{title}</h3>
        </div>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
          style={{ color: iconColor, background: "none", border: "none" }}
        >
          {ctaLabel} <ArrowRight size={11} />
        </button>
      </div>
      <div className="flex items-start gap-8 flex-wrap">
        {stats.map(s => (
          <div key={s.label}>
            <div className="font-bold" style={{ fontSize: 22, color: "var(--text)", lineHeight: 1 }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{s.label}</div>
          </div>
        ))}
      </div>
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

function DepartmentsOverview({ showMarketing = true, showRH = true }) {
  const navigate = useNavigate();
  const { campaigns, loading: loadingCampaigns } = useMarketingCampaigns({});
  const { vagas, candidatos, loading: loadingRecrutamento } = useRHRecrutamento({});
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({});
  const { requests: feriasRequests, loading: loadingFerias } = useRHFeriasRequests({});

  const dash = "—";
  const campanhasAtivas = loadingCampaigns ? dash : campaigns.filter(c => c.stage !== "encerrado").length;
  const totalCampanhas = loadingCampaigns ? dash : campaigns.length;
  const vagasPublicadas = loadingRecrutamento ? dash : vagas.filter(v => v.stage === "publicada").length;
  const candidatosEmProcesso = loadingRecrutamento ? dash : candidatos.filter(c => !["aprovado", "reprovado"].includes(c.stage)).length;
  const onboardingEmAndamento = loadingColaboradores ? dash : colaboradores.filter(c => c.onboardingStage && c.onboardingStage !== "concluido").length;
  const emFeriasProximos7d = loadingFerias ? dash : feriasRequests.filter(overlapsNext7Days).length;
  const feriasPendentes = loadingFerias ? dash : feriasRequests.filter(r => r.status === "pendente").length;

  return (
    <div className={showMarketing && showRH ? "grid md:grid-cols-2 gap-4" : "grid gap-4"}>
      {showMarketing && (
        <DepartmentCard
          icon={Megaphone}
          iconColor="#7C3AED"
          title="Marketing"
          stats={[
            { label: "Campanhas ativas", value: campanhasAtivas },
            { label: "Total de campanhas", value: totalCampanhas },
          ]}
          ctaLabel="Ver Marketing"
          onNavigate={() => navigate(ROUTES.marketing)}
        />
      )}
      {showRH && (
        <DepartmentCard
          icon={Briefcase}
          iconColor="#0EA5E9"
          title="RH"
          stats={[
            { label: "Vagas publicadas", value: vagasPublicadas },
            { label: "Candidatos em processo", value: candidatosEmProcesso },
            { label: "Onboarding em andamento", value: onboardingEmAndamento },
            { label: "Em férias (7 dias)", value: emFeriasProximos7d },
            { label: "Férias pendentes", value: feriasPendentes },
          ]}
          ctaLabel="Ver RH"
          onNavigate={() => navigate(ROUTES["rh-overview"])}
        />
      )}
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
          color: "#FFFFFF",
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
          style={{ background: "#FEF2F2", color: "var(--danger)", border: "1px solid #FECACA" }}
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
              Regenerar
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
              style={{
                background: copied ? "#F0FDF4" : "var(--surface)",
                color: copied ? "#16A34A" : "var(--text-dim)",
                borderColor: copied ? "#BBF7D0" : "var(--border)",
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
            style={{ background: "#FEF3C7", color: "#92400E" }}
          >
            Configure sua LLM nas Configurações → Integrações de IA
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

function OverviewTab({ metricsByCompany, maxPipeline, funnelStages }) {
  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Funil de Vendas por empresa */}
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
          <h3 className="font-semibold mb-4" style={{ fontSize: 15, color: "var(--text)" }}>
            Funil de Vendas por empresa
          </h3>
          <div className="space-y-4">
            {metricsByCompany.map(m => {
              const pct = (m.pipeline / maxPipeline) * 100;
              return (
                <div key={m.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.company.primary }} />
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                        {m.company.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold font-mono" style={{ color: "var(--text)" }}>
                      {formatK(m.pipeline)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#EFF2F5" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: m.company.primary }}
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

        {/* Funil de conversão */}
        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
          <h3 className="font-semibold mb-4" style={{ fontSize: 15, color: "var(--text)" }}>
            Funil de conversão (Grupo)
          </h3>
          <div className="space-y-2.5">
            {funnelStages.map(({ stage, count, pct }) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {stage.name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>{count} leads</span>
                </div>
                <div className="h-5 rounded-lg overflow-hidden" style={{ background: "#EFF2F5" }}>
                  <div
                    className="h-full rounded-lg transition-all flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(pct, 5)}%`, background: stage.color }}
                  >
                    <span className="text-[10px] font-bold text-white">{pct.toFixed(0)}%</span>
                  </div>
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
                <tr key={m.id} className="border-b" style={{ borderColor: "var(--border)" }}>
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
    </div>
  );
}

export default ExecutiveDashboard;
