import React, { useMemo, useState } from "react";
import { HandCoins, CheckCircle2, AlertCircle, Shuffle, TrendingUp, Target, Printer } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { StatCard } from "../ui/StatCard";
import { formatK, formatM } from "../../utils/currency";
import { isStale, weightedValue } from "../../utils/pipeline-metrics";
import { ExecutiveCharts } from "./ExecutiveCharts";
import { AnalyticsTab } from "./AnalyticsTab";

// Painel Executivo — único ponto de visão consolidada do Grupo. Inclui
// o que era a tela "Presidência" como uma tab. Filtro de período é
// global da tela e afeta todas as agregações.

const PERIODS = [
  { id: "all", label: "Todo período" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "ytd", label: "YTD" },
];

const TABS = [
  { id: "overview",   label: "Visão geral" },
  { id: "charts",     label: "Gráficos" },
  { id: "analytics",  label: "Análise" },
];

function filterByPeriod(leads, period) {
  if (period === "all") return leads;
  const now = Date.now();
  let cutoff;
  if (period === "30d") cutoff = now - 30 * 86400000;
  else if (period === "90d") cutoff = now - 90 * 86400000;
  else if (period === "ytd") cutoff = new Date(new Date().getFullYear(), 0, 1).getTime();
  return leads.filter(l => {
    const ts = new Date(l.stageChangedAt || l.createdAt).getTime();
    return !Number.isNaN(ts) && ts >= cutoff;
  });
}

export function ExecutiveDashboard({ leads, crossReferrals, pipelines, users }) {
  const [period, setPeriod] = useState("all");
  const [tab, setTab] = useState("overview");

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

  const funnelStages = useMemo(() => {
    const total = filteredLeads.length || 1;
    const counts = Object.create(null);
    for (const s of DEFAULT_PIPELINE_STAGES) counts[s.id] = 0;
    for (const l of filteredLeads) {
      if (counts[l.stage] != null) counts[l.stage]++;
    }
    return DEFAULT_PIPELINE_STAGES.map(stage => {
      const count = counts[stage.id];
      const pct = (count / total) * 100;
      return { stage, count, pct };
    });
  }, [filteredLeads]);

  return (
    <div className="space-y-5">
      {/* Header com filtros e ações */}
      <div className="flex items-start justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Painel Executivo
          </h1>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            Visão consolidada do Grupo · {filteredLeads.length} leads · {PERIODS.find(p => p.id === period)?.label}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "#D4D4D4", background: "#FFFFFF" }}>
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className="px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
                style={{
                  background: period === p.id ? "#1E4D8C" : "#FFFFFF",
                  color: period === p.id ? "#FFFFFF" : NEUTRAL.slate,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
            style={{ borderColor: "#D4D4D4", color: NEUTRAL.graphite, background: "#FFFFFF" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
            title="Imprimir / salvar como PDF"
          >
            <Printer size={11} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPI strip — sempre visível */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={HandCoins}    value={formatM(totals.pipeline)} label="Pipeline aberto"     sublabel="Em aberto" accent={NEUTRAL.graphite} />
        <StatCard icon={TrendingUp}   value={formatM(totals.forecast)} label="Forecast"            sublabel="Ponderado por etapa" />
        <StatCard icon={CheckCircle2} value={formatK(totals.wonValue)} label="Receita realizada"   sublabel={`${totals.wonCount} ganhos`} />
        <StatCard icon={Target}       value={`${totals.conversion}%`}  label="Conversão"           sublabel="Leads → ganhos" />
        <StatCard icon={AlertCircle}  value={totals.stale}             label="Leads parados"       sublabel="SLA estourado" />
        <StatCard icon={Shuffle}      value={pendingCross}             label="Cross-sell pendente" sublabel="Aguardando" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b print:hidden" style={{ borderColor: "#E5E7EB" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all cursor-pointer"
              style={{
                color: active ? NEUTRAL.graphite : NEUTRAL.slate,
                borderBottomColor: active ? "#1E4D8C" : "transparent",
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
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ metricsByCompany, maxPipeline, funnelStages }) {
  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Pipeline por empresa */}
        <div className="rounded-xl border p-5" style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 className="font-semibold mb-4" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
            Pipeline por empresa
          </h3>
          <div className="space-y-4">
            {metricsByCompany.map(m => {
              const pct = (m.pipeline / maxPipeline) * 100;
              return (
                <div key={m.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.company.primary }} />
                      <span className="text-sm font-medium" style={{ color: NEUTRAL.graphite }}>
                        {m.company.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold font-mono" style={{ color: NEUTRAL.graphite }}>
                      {formatK(m.pipeline)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#EFF2F5" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: m.company.primary }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1.5" style={{ color: NEUTRAL.slate }}>
                    <span>{m.open} ativo{m.open !== 1 ? "s" : ""}</span>
                    <span>{m.won} ganho · {m.lost} perdido</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Funil de conversão */}
        <div className="rounded-xl border p-5" style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 className="font-semibold mb-4" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
            Funil de conversão (Grupo)
          </h3>
          <div className="space-y-2.5">
            {funnelStages.map(({ stage, count, pct }) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: NEUTRAL.graphite }}>
                    {stage.name}
                  </span>
                  <span className="text-xs" style={{ color: NEUTRAL.slate }}>{count} leads</span>
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
      <div className="rounded-xl border p-5" style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 className="font-semibold mb-4" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
          Desempenho por empresa · matriz
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "#F0F0F0" }}>
                {["Empresa", "Leads", "Pipeline", "Forecast", "Ganho", "Ativação", "Parados"].map((h, i) => (
                  <th
                    key={h}
                    className={`py-2.5 text-xs font-semibold ${i === 0 ? "text-left pr-3" : "text-right px-3"}`}
                    style={{ color: NEUTRAL.slate }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricsByCompany.map(m => (
                <tr key={m.id} className="border-b" style={{ borderColor: "#F5F5F5" }}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.company.primary }} />
                      <span className="font-medium" style={{ color: NEUTRAL.graphite }}>
                        {m.company.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-3 font-mono" style={{ color: NEUTRAL.graphite }}>
                    {m.leadsCount}
                  </td>
                  <td className="text-right py-3 px-3 font-mono font-semibold" style={{ color: NEUTRAL.graphite }}>
                    {formatK(m.pipeline)}
                  </td>
                  <td className="text-right py-3 px-3 font-mono" style={{ color: "#0F766E" }}>
                    {formatK(m.forecast)}
                  </td>
                  <td className="text-right py-3 px-3 font-mono" style={{ color: NEUTRAL.success }}>
                    {formatK(m.wonValue)}
                  </td>
                  <td className="text-right py-3 px-3 font-mono" style={{ color: NEUTRAL.graphite }}>
                    {m.activationRate}%
                  </td>
                  <td
                    className="text-right py-3 pl-3 font-mono"
                    style={{ color: m.stale > 3 ? NEUTRAL.red : NEUTRAL.slate }}
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
