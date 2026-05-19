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
    let pipelineValue = 0, wonValue = 0, wonCount = 0, openCount = 0;
    let fitSum = 0, fitCount70 = 0, newCount = 0;
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
    <div className="space-y-7">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            {isGroupView ? (isManager ? "Visão consolidada" : "Dashboard") : companyData.name}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
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

      {/* Stat cards */}
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

      {/* Main content */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Hot leads */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold" style={{ fontSize: 15, color: NEUTRAL.graphite }}>Leads quentes</h2>
              <p className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>Fit score ≥ 80 · ordenado por qualidade</p>
            </div>
            <button
              onClick={() => onNavigate("crm")}
              className="text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all duration-150"
              style={{ color: accent, background: accent + "0D" }}
              onMouseEnter={e => { e.currentTarget.style.background = accent + "18"; }}
              onMouseLeave={e => { e.currentTarget.style.background = accent + "0D"; }}
            >
              Ver pipeline <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {hotLeads.length === 0 && (
              <div
                className="p-6 rounded-xl border text-center text-sm"
                style={{ background: "#FFFFFF", borderColor: "#E8E8E8", color: NEUTRAL.slate }}
              >
                Nenhum lead quente no momento
              </div>
            )}
            {hotLeads.map(lead => (
              <LeadCard key={lead.id} lead={lead} isGroupView={isGroupView} onClick={onLeadClick} />
            ))}
          </div>
        </div>

        {/* Market signals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold" style={{ fontSize: 15, color: NEUTRAL.graphite }}>Sinais de mercado</h2>
              <p className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>
                {isGroupView ? "Todas as empresas" : companyData?.short} · 14 dias
              </p>
            </div>
            <button
              onClick={() => onNavigate("signals")}
              className="text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all duration-150"
              style={{ color: accent, background: accent + "0D" }}
              onMouseEnter={e => { e.currentTarget.style.background = accent + "18"; }}
              onMouseLeave={e => { e.currentTarget.style.background = accent + "0D"; }}
            >
              Ver todos <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {scopedSignals.slice(0, 5).map(s => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl border transition-all duration-150 cursor-pointer"
                style={{ background: "#FFFFFF", borderColor: "#E8E8E8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = "#D0D0D0";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                  e.currentTarget.style.borderColor = "#E8E8E8";
                }}
              >
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <Badge variant="default" size="sm">{s.source}</Badge>
                  <div className="flex items-center gap-1.5">
                    {isGroupView && <CompanyTag companyId={s.company} />}
                    <UrgencyTag urgency={s.urgency} />
                  </div>
                </div>
                <div className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: NEUTRAL.graphite }}>
                  {s.title}
                </div>
                <div className="text-xs mt-2 flex items-center justify-between" style={{ color: NEUTRAL.slate }}>
                  <span>{s.affectedCount} afetad{s.affectedCount === 1 ? "a" : "as"}</span>
                  <span>{s.daysAgo === 0 ? "Hoje" : `${s.daysAgo}d atrás`}</span>
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
