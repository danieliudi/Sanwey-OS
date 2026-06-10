import React, { useMemo } from "react";
import { Megaphone, Package, DollarSign, TrendingUp, Clock, Zap } from "lucide-react";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingExpenses } from "../../hooks/use-marketing-expenses";
import { MARKETING_STAGES, DELIVERABLE_STAGES } from "../../constants/marketing-pipelines";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { formatK } from "../../utils/currency";

// ── Primitives ────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, iconBg }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: iconBg || "#F3F4F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} style={{ color: color || NEUTRAL.slate }} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: color || NEUTRAL.graphite, letterSpacing: "-0.02em", lineHeight: 1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 28 }}>
      <Icon size={15} style={{ color: color || NEUTRAL.slate }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {title}
      </span>
    </div>
  );
}

function StageBar({ stages, items, valueKey }) {
  const total = items.length || 1;
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        padding: "16px 20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: NEUTRAL.slate, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Distribuição por etapa
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stages.map(stage => {
          const stageItems = items.filter(i => i.stage === stage.id);
          const count = stageItems.length;
          const pct   = Math.round((count / total) * 100);
          return (
            <div key={stage.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: NEUTRAL.graphite, fontWeight: 500 }}>{stage.name}</span>
                </div>
                <span style={{ fontSize: 12, color: NEUTRAL.slate, fontWeight: 600 }}>{count}</span>
              </div>
              <div style={{ height: 5, background: "#F1F3F5", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: stage.color, borderRadius: 3, transition: "width 0.4s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentCampaignRow({ campaign }) {
  const stage = MARKETING_STAGES.find(s => s.id === campaign.stage);
  const companyNames = (campaign.companyIds || [])
    .map(id => COMPANIES[id]?.short)
    .filter(Boolean)
    .join(", ");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #F3F4F6",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: stage?.color || "#9CA3AF",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NEUTRAL.graphite, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {campaign.name}
        </div>
        <div style={{ fontSize: 11, color: NEUTRAL.slate }}>
          {companyNames}
          {campaign.channel ? ` · ${campaign.channel}` : ""}
          {campaign.budget > 0 ? ` · ${formatK(campaign.budget)}` : ""}
        </div>
      </div>
      <span
        style={{
          padding: "2px 8px",
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 700,
          background: (stage?.color || "#9CA3AF") + "22",
          color: stage?.color || "#9CA3AF",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {stage?.name || campaign.stage}
      </span>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function MarketingDashboardView({ user }) {
  const { campaigns, loading: loadingC } = useMarketingCampaigns({ userId: user?.id, role: user?.role });
  const { deliverables, loading: loadingD } = useMarketingDeliverables({ userId: user?.id, role: user?.role });
  const { expenses, loading: loadingE } = useMarketingExpenses({ userId: user?.id, role: user?.role });

  const isAgencia = user?.role === "agencia";

  const campaignKpis = useMemo(() => {
    const active  = campaigns.filter(c => c.stage !== "encerrado").length;
    const budget  = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
    const live    = campaigns.filter(c => c.stage === "ao_vivo").length;
    const urgent  = campaigns.filter(c => {
      if (!c.launchDate) return false;
      const d = Math.floor((new Date(c.launchDate).getTime() - Date.now()) / 86400000);
      return d <= 7 && d >= 0 && !["ao_vivo", "encerrado", "analise"].includes(c.stage);
    }).length;
    return { active, budget, live, urgent };
  }, [campaigns]);

  const deliverableKpis = useMemo(() => ({
    total:      deliverables.length,
    pendente:   deliverables.filter(d => d.stage === "pendente").length,
    produzindo: deliverables.filter(d => d.stage === "produzindo").length,
    entregue:   deliverables.filter(d => d.stage === "entregue").length,
  }), [deliverables]);

  const expenseKpis = useMemo(() => ({
    total:    expenses.reduce((s, e) => s + (e.amount || 0), 0),
    pendente: expenses.filter(e => e.status === "pendente").reduce((s, e) => s + (e.amount || 0), 0),
    pago:     expenses.filter(e => e.status === "pago").reduce((s, e) => s + (e.amount || 0), 0),
  }), [expenses]);

  const recentCampaigns = useMemo(() =>
    [...campaigns]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6),
    [campaigns]
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const loading = loadingC || loadingD || loadingE;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
          {greeting}, {user?.name?.split(" ")[0] || "—"}
        </h1>
        <p style={{ fontSize: 14, color: NEUTRAL.slate, marginTop: 2 }}>
          Visão geral do Marketing · {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""} no total
        </p>
      </div>

      {loading && (
        <div className="text-sm text-center py-12" style={{ color: NEUTRAL.slate }}>Carregando…</div>
      )}

      {!loading && (
        <>
          {/* Campanhas */}
          <SectionTitle icon={Megaphone} title="Campanhas" color="#b5000b" />
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <KpiCard icon={Megaphone}   label="Campanhas ativas" value={String(campaignKpis.active)}  color="#1E4D8C" iconBg="#EFF6FF" />
            <KpiCard icon={TrendingUp}  label="Budget total"     value={formatK(campaignKpis.budget)} color={NEUTRAL.graphite} iconBg="#F3F4F6" />
            <KpiCard icon={Zap}         label="Ao Vivo"          value={String(campaignKpis.live)}    color="#16A34A" iconBg="#DCFCE7" />
            <KpiCard
              icon={Clock}
              label="Urgente (< 7d)"
              value={String(campaignKpis.urgent)}
              color={campaignKpis.urgent > 0 ? "#DC2626" : NEUTRAL.graphite}
              iconBg={campaignKpis.urgent > 0 ? "#FEE2E2" : "#F3F4F6"}
            />
          </div>

          {/* Entregas */}
          <SectionTitle icon={Package} title="Entregas" color="#1E4D8C" />
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <KpiCard icon={Package} label="Total"      value={String(deliverableKpis.total)}      color={NEUTRAL.graphite} iconBg="#F3F4F6" />
            <KpiCard icon={Package} label="Pendente"   value={String(deliverableKpis.pendente)}   color={NEUTRAL.slate}    iconBg="#F3F4F6" />
            <KpiCard icon={Package} label="Produzindo" value={String(deliverableKpis.produzindo)} color="#D97706" iconBg="#FEF3C7" />
            <KpiCard icon={Package} label="Entregue"   value={String(deliverableKpis.entregue)}   color="#16A34A" iconBg="#DCFCE7" />
          </div>

          {/* Despesas — hidden for agência */}
          {!isAgencia && (
            <>
              <SectionTitle icon={DollarSign} title="Despesas" color="#7C3AED" />
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <KpiCard icon={DollarSign} label="Total comprometido" value={formatK(expenseKpis.total)}    color={NEUTRAL.graphite} iconBg="#F3F4F6" />
                <KpiCard icon={DollarSign} label="A pagar"            value={formatK(expenseKpis.pendente)} color="#D97706" iconBg="#FEF3C7" />
                <KpiCard icon={DollarSign} label="Pago"               value={formatK(expenseKpis.pago)}     color="#16A34A" iconBg="#DCFCE7" />
              </div>
            </>
          )}

          {/* Bottom row: stage distribution + recent campaigns */}
          <div className="grid gap-5 mt-8" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {/* Stage distribution */}
            <StageBar stages={MARKETING_STAGES.filter(s => !s.terminal)} items={campaigns} />

            {/* Recent campaigns */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 14,
                padding: "16px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: NEUTRAL.slate, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Campanhas recentes
              </div>
              {recentCampaigns.length === 0 ? (
                <div style={{ fontSize: 13, color: NEUTRAL.slate, textAlign: "center", padding: "24px 0", opacity: 0.6 }}>
                  Nenhuma campanha ainda
                </div>
              ) : (
                recentCampaigns.map(c => <RecentCampaignRow key={c.id} campaign={c} />)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default MarketingDashboardView;
