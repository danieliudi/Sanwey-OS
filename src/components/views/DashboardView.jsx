import React, { useMemo } from "react";
import {
  Target, HandCoins, CheckCircle2, Gauge, ArrowRight, RefreshCcw, Download,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { StatCard } from "../ui/StatCard";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { LeadCard } from "../lead/LeadCard";
import { formatK } from "../../utils/currency";

const TERMINAL = new Set(["ganho", "perdido"]);

export function DashboardView({ user, activeCompany, leads, signals, onNavigate, onLeadClick, visibleWidgets }) {
  const widgetVisible = (id) => !visibleWidgets || visibleWidgets.includes(id);
  const isGroupView = activeCompany === "all";
  const isManager = user.role === "gerente";
  const companyData = isGroupView ? null : COMPANIES[activeCompany];
  const accent = companyData?.primary || NEUTRAL.graphite;

  const scopedLeads = useMemo(() => {
    let s = leads;
    if (!isGroupView) s = s.filter(l => l.companyId === activeCompany);
    if (!isManager) s = s.filter(l => l.owner === user.id);
    return s;
  }, [leads, activeCompany, user.id, isGroupView, isManager]);

  const scopedSignals = useMemo(
    () => (isGroupView ? signals : signals.filter(s => s.company === activeCompany)),
    [signals, activeCompany, isGroupView],
  );

  const stats = useMemo(() => {
    let pipelineValue = 0;
    let wonValue = 0;
    let wonCount = 0;
    let openCount = 0;
    let fitSum = 0;
    let fitCount70 = 0;
    let newCount = 0;
    for (const l of scopedLeads) {
      fitSum += l.fitScore;
      if (l.fitScore >= 70) fitCount70++;
      if (l.daysAgo <= 2) newCount++;
      if (l.stage === "ganho") { wonValue += l.value; wonCount++; }
      if (!TERMINAL.has(l.stage)) { pipelineValue += l.value; openCount++; }
    }
    const avgFit = scopedLeads.length > 0 ? Math.round(fitSum / scopedLeads.length) : 0;
    return { pipelineValue, wonValue, wonCount, openCount, avgFit, fitCount70, newCount };
  }, [scopedLeads]);

  const hotLeads = useMemo(() => (
    scopedLeads
      .filter(l => l.fitScore >= 80 && !TERMINAL.has(l.stage))
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 6)
  ), [scopedLeads]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            {isGroupView ? (isManager ? "Visão consolidada do Grupo" : "Dashboard") : companyData.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            {isGroupView
              ? `${scopedLeads.length} leads em 4 empresas · ${scopedSignals.length} sinais ativos`
              : `${companyData.focus} · ${scopedLeads.length} leads · ${scopedSignals.length} sinais`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={RefreshCcw} size="sm">Atualizar</Button>
          {isManager && <Button variant="primary" accent={accent} icon={Download} size="sm">Exportar</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {widgetVisible("leads_count") && (
          <StatCard icon={Target} value={scopedLeads.length}
            label={isManager ? (isGroupView ? "Leads no grupo" : "Leads da empresa") : "Meus leads"}
            sublabel={`${stats.fitCount70} com fit ≥ 70`} compact />
        )}
        {widgetVisible("pipeline_open") && (
          <StatCard icon={HandCoins} value={formatK(stats.pipelineValue)}
            label="Pipeline aberto"
            sublabel={`${stats.openCount} oportunidades`} compact />
        )}
        {widgetVisible("won_value") && (
          <StatCard icon={CheckCircle2} value={formatK(stats.wonValue)}
            label="Valor ganho" sublabel={`${stats.wonCount} fechados`} accent={accent} compact />
        )}
        {widgetVisible("avg_fit") && (
          <StatCard icon={Gauge} value={stats.avgFit} label="Fit score médio"
            sublabel={`${stats.newCount} novos em 48h`} compact />
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>Leads quentes</h2>
              <p className="text-xs" style={{ color: NEUTRAL.slate }}>Fit score ≥ 80 · ordenado por qualidade</p>
            </div>
            <button
              onClick={() => onNavigate("crm")}
              className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1"
              style={{ color: accent, letterSpacing: "0.1em" }}
            >
              Ver CRM <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {hotLeads.length === 0 && (
              <div
                className="p-6 rounded-sm border text-center text-sm"
                style={{ background: "#FFFFFF", borderColor: "#EFEFEF", color: NEUTRAL.slate }}
              >
                Nenhum lead quente no momento
              </div>
            )}
            {hotLeads.map(lead => (
              <LeadCard key={lead.id} lead={lead} isGroupView={isGroupView} onClick={onLeadClick} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>Sinais de mercado</h2>
              <p className="text-xs" style={{ color: NEUTRAL.slate }}>
                {isGroupView ? "Todas empresas · últimos 14 dias" : `${companyData?.short} · últimos 14 dias`}
              </p>
            </div>
            <button
              onClick={() => onNavigate("signals")}
              className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1"
              style={{ color: accent, letterSpacing: "0.1em" }}
            >
              Todos <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {scopedSignals.slice(0, 5).map(s => (
              <div
                key={s.id}
                className="p-4 rounded-sm border transition-all hover:shadow-sm cursor-pointer"
                style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}
              >
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <Badge variant="default" size="sm">{s.source}</Badge>
                  <div className="flex items-center gap-1">
                    {isGroupView && <CompanyTag companyId={s.company} />}
                    <UrgencyTag urgency={s.urgency} />
                  </div>
                </div>
                <div
                  className="text-xs font-semibold leading-snug line-clamp-2"
                  style={{ color: NEUTRAL.graphite }}
                >
                  {s.title}
                </div>
                <div
                  className="text-xs mt-2 flex items-center justify-between"
                  style={{ color: NEUTRAL.slate }}
                >
                  <span>{s.affectedCount} afetad{s.affectedCount === 1 ? "a" : "as"}</span>
                  <span>{s.daysAgo === 0 ? "Hoje" : `${s.daysAgo}d`}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
