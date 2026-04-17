import React, { useMemo } from "react";
import { HandCoins, CheckCircle2, AlertCircle, Shuffle } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { StatCard } from "../ui/StatCard";
import { formatK, formatM } from "../../utils/currency";

const TERMINAL = new Set(["ganho", "perdido"]);
const STALE_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// FIX P1/P4: single-pass aggregation per company. Also memoizes maxPipeline
// OUTSIDE the bar map instead of recomputing once per bar.
export function ExecutiveDashboard({ leads, crossReferrals }) {
  const metricsByCompany = useMemo(() => {
    const now = Date.now();
    const byId = Object.create(null);
    for (const id of COMPANY_IDS) {
      byId[id] = {
        id,
        company: COMPANIES[id],
        leadsCount: 0,
        open: 0,
        won: 0,
        lost: 0,
        pipeline: 0,
        wonValue: 0,
        lostValue: 0,
        activated: 0,
        stale: 0,
      };
    }
    for (const l of leads) {
      const m = byId[l.companyId];
      if (!m) continue;
      m.leadsCount++;
      if (l.stage === "ganho") { m.won++; m.wonValue += l.value; }
      else if (l.stage === "perdido") { m.lost++; m.lostValue += l.value; }
      else {
        m.open++;
        m.pipeline += l.value;
        const ts = new Date(l.stageChangedAt || l.createdAt).getTime();
        if (!Number.isNaN(ts) && (now - ts) / MS_PER_DAY > STALE_DAYS) m.stale++;
      }
      if (l.stage !== "prospeccao") m.activated++;
    }
    return COMPANY_IDS.map(id => {
      const m = byId[id];
      m.activationRate = m.leadsCount > 0 ? Math.round((m.activated / m.leadsCount) * 100) : 0;
      return m;
    });
  }, [leads]);

  const totals = useMemo(() => {
    let pipeline = 0, wonValue = 0, wonCount = 0, stale = 0;
    for (const m of metricsByCompany) {
      pipeline += m.pipeline;
      wonValue += m.wonValue;
      wonCount += m.won;
      stale += m.stale;
    }
    return { pipeline, wonValue, wonCount, stale };
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
    const total = leads.length || 1;
    const counts = Object.create(null);
    for (const s of DEFAULT_PIPELINE_STAGES) counts[s.id] = 0;
    for (const l of leads) {
      if (counts[l.stage] != null) counts[l.stage]++;
    }
    return DEFAULT_PIPELINE_STAGES.map(stage => {
      const count = counts[stage.id];
      const pct = (count / total) * 100;
      return { stage, count, pct };
    });
  }, [leads]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
          Dashboard Executivo
        </h1>
        <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
          Visão consolidada do Grupo · performance por empresa · alertas gerenciais
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={HandCoins} value={formatM(totals.pipeline)}
          label="Pipeline do Grupo" sublabel="Todas empresas · aberto" accent={NEUTRAL.graphite} />
        <StatCard icon={CheckCircle2} value={formatK(totals.wonValue)}
          label="Fechado no período" sublabel={`${totals.wonCount} ganhos`} />
        <StatCard icon={AlertCircle} value={totals.stale} label="Leads parados"
          sublabel={`Sem movimento > ${STALE_DAYS} dias`} />
        <StatCard icon={Shuffle} value={pendingCross} label="Cross-sell pendente"
          sublabel="Indicações aguardando" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-sm border p-5" style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}>
          <h3 className="font-bold mb-4" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
            Pipeline por empresa
          </h3>
          <div className="space-y-3">
            {metricsByCompany.map(m => {
              const pct = (m.pipeline / maxPipeline) * 100;
              return (
                <div key={m.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ background: m.company.primary }} />
                      <span className="text-sm font-semibold" style={{ color: NEUTRAL.graphite }}>
                        {m.company.name}
                      </span>
                    </div>
                    <span className="text-sm font-mono font-semibold" style={{ color: NEUTRAL.graphite }}>
                      {formatK(m.pipeline)}
                    </span>
                  </div>
                  <div className="h-2 rounded-sm overflow-hidden" style={{ background: "#F5F5F3" }}>
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, background: m.company.primary }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1" style={{ color: NEUTRAL.slate }}>
                    <span>{m.open} ativo{m.open !== 1 ? "s" : ""}</span>
                    <span>{m.won} ganho · {m.lost} perdido</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-sm border p-5" style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}>
          <h3 className="font-bold mb-4" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
            Funil de conversão (Grupo)
          </h3>
          <div className="space-y-2">
            {funnelStages.map(({ stage, count, pct }) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold" style={{ color: NEUTRAL.graphite }}>
                    {stage.name}
                  </span>
                  <span className="text-xs" style={{ color: NEUTRAL.slate }}>{count} leads</span>
                </div>
                <div className="h-5 rounded-sm overflow-hidden" style={{ background: "#F5F5F3" }}>
                  <div
                    className="h-full transition-all flex items-center justify-end pr-2"
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

      <div className="rounded-sm border p-5" style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}>
        <h3 className="font-bold mb-4" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
          Desempenho por empresa · matriz
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "#EFEFEF" }}>
                <th className="text-left py-2 pr-3 text-xs uppercase font-semibold tracking-wider"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.1em" }}>Empresa</th>
                <th className="text-right py-2 px-3 text-xs uppercase font-semibold tracking-wider"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.1em" }}>Leads</th>
                <th className="text-right py-2 px-3 text-xs uppercase font-semibold tracking-wider"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.1em" }}>Pipeline</th>
                <th className="text-right py-2 px-3 text-xs uppercase font-semibold tracking-wider"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.1em" }}>Ganho</th>
                <th className="text-right py-2 px-3 text-xs uppercase font-semibold tracking-wider"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.1em" }}>Ativação</th>
                <th className="text-right py-2 pl-3 text-xs uppercase font-semibold tracking-wider"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.1em" }}>Parados</th>
              </tr>
            </thead>
            <tbody>
              {metricsByCompany.map(m => (
                <tr key={m.id} className="border-b" style={{ borderColor: "#EFEFEF" }}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: m.company.primary }} />
                      <span className="font-semibold" style={{ color: NEUTRAL.graphite }}>
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
