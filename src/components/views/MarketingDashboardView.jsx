import React, { useMemo } from "react";
import {
  Megaphone, Package, DollarSign, TrendingUp, Clock, Zap,
  Award, CalendarClock, Activity, PieChart as PieIcon, Timer, ArrowUp, ArrowDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingExpenses } from "../../hooks/use-marketing-expenses";
import { MARKETING_STAGES, EXPENSE_CATEGORIES } from "../../constants/marketing-pipelines";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { formatK, formatBRL } from "../../utils/currency";

// ── Date helpers ──────────────────────────────────────────────────────────────

function monthBounds(date) {
  const d = new Date(date);
  return [
    new Date(d.getFullYear(), d.getMonth(), 1),
    new Date(d.getFullYear(), d.getMonth() + 1, 1),
  ];
}

function within(date, start, end) {
  if (!date) return false;
  const d = new Date(date);
  return d >= start && d < end;
}

function pctChange(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

// ── Primitives ────────────────────────────────────────────────────────────────

function MoMBadge({ delta, invert }) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;
  const positive = invert ? delta < 0 : delta > 0;
  const negative = invert ? delta > 0 : delta < 0;
  const color = delta === 0 ? NEUTRAL.slate : positive ? "#16A34A" : negative ? "#DC2626" : NEUTRAL.slate;
  const bg    = delta === 0 ? "#F3F4F6" : positive ? "#DCFCE7" : negative ? "#FEE2E2" : "#F3F4F6";
  const Icon  = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "1px 6px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        background: bg,
        color,
        marginTop: 4,
      }}
    >
      {Icon && <Icon size={9} strokeWidth={3} />}
      {Math.abs(delta)}% MoM
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, iconBg, delta, invertDelta }) {
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
        <MoMBadge delta={delta} invert={invertDelta} />
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

function Panel({ title, children, action }) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ fontSize: 13, color: NEUTRAL.slate, textAlign: "center", padding: "24px 0", opacity: 0.6 }}>
      {children}
    </div>
  );
}

function StageBar({ stages, items }) {
  const total = items.length || 1;
  return (
    <Panel title="Distribuição por etapa">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stages.map(stage => {
          const count = items.filter(i => i.stage === stage.id).length;
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
    </Panel>
  );
}

// ── Phase 1 — new widgets ─────────────────────────────────────────────────────

function BurnRateChart({ expenses }) {
  const data = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const [s, e] = monthBounds(d);
      const total = expenses
        .filter(x => within(x.createdAt, s, e))
        .reduce((sum, x) => sum + (x.amount || 0), 0);
      months.push({
        month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        total,
        isCurrent: i === 0,
      });
    }
    return months;
  }, [expenses]);

  const hasData = data.some(m => m.total > 0);

  return (
    <Panel title="Burn rate · últimos 6 meses">
      {!hasData ? (
        <EmptyState>Sem despesas registradas</EmptyState>
      ) : (
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <XAxis dataKey="month" stroke={NEUTRAL.slate} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={NEUTRAL.slate} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatK(v)} />
            <Tooltip
              cursor={{ fill: "#F9FAFB" }}
              contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [formatBRL(v), "Gasto"]}
              labelStyle={{ color: NEUTRAL.graphite, fontWeight: 600 }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.isCurrent ? "#7C3AED" : "#E9D5FF"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

const CATEGORY_COLORS = {
  "Mídia Paga":  "#7C3AED",
  "Produção":    "#1E4D8C",
  "Agência":     "#D97706",
  "Ferramentas": "#16A34A",
  "Eventos":     "#DC2626",
  "Outros":      "#9CA3AF",
};

function CategoryDonut({ expenses }) {
  const data = useMemo(() => {
    const sums = {};
    expenses.forEach(e => {
      sums[e.category] = (sums[e.category] || 0) + (e.amount || 0);
    });
    return EXPENSE_CATEGORIES
      .map(c => ({ name: c, value: sums[c] || 0 }))
      .filter(d => d.value > 0);
  }, [expenses]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Panel title="Despesas por categoria">
      {data.length === 0 ? (
        <EmptyState>Sem despesas registradas</EmptyState>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 130, height: 130, flexShrink: 0 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={38}
                  outerRadius={62}
                  paddingAngle={2}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[entry.name] || "#9CA3AF"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => formatBRL(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {data.map(d => {
              const pct = Math.round((d.value / total) * 100);
              return (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLORS[d.name] || "#9CA3AF", flexShrink: 0 }} />
                  <span style={{ color: NEUTRAL.graphite, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <span style={{ color: NEUTRAL.slate, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

function GanttTimeline({ campaigns }) {
  const data = useMemo(() => {
    const active = campaigns
      .filter(c => c.launchDate && c.endDate && c.stage !== "encerrado")
      .map(c => ({
        ...c,
        start: new Date(c.launchDate).getTime(),
        end:   new Date(c.endDate).getTime(),
      }))
      .filter(c => c.end > c.start)
      .sort((a, b) => a.start - b.start);

    if (active.length === 0) return null;

    const now = Date.now();
    const minStart = Math.min(...active.map(c => c.start), now - 14 * 86400000);
    const maxEnd   = Math.max(...active.map(c => c.end),   now + 14 * 86400000);
    const span     = maxEnd - minStart;

    return active.map(c => ({
      ...c,
      leftPct:  ((c.start - minStart) / span) * 100,
      widthPct: ((c.end - c.start) / span) * 100,
      nowPct:   ((now - minStart) / span) * 100,
      _min: minStart, _max: maxEnd, _span: span,
    }));
  }, [campaigns]);

  return (
    <Panel title="Timeline de campanhas ativas">
      {!data || data.length === 0 ? (
        <EmptyState>Nenhuma campanha com lançamento agendado</EmptyState>
      ) : (
        <div>
          {/* Date scale (3 markers) */}
          {(() => {
            const ref = data[0];
            const span = ref._span;
            const mks = [0, 0.5, 1].map(p => {
              const t = ref._min + span * p;
              return new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
            });
            return (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: NEUTRAL.slate, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {mks.map((m, i) => <span key={i}>{m}</span>)}
              </div>
            );
          })()}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
            {data.map(c => {
              const stage = MARKETING_STAGES.find(s => s.id === c.stage);
              const color = stage?.color || "#9CA3AF";
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: NEUTRAL.graphite, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                  <div style={{ position: "relative", flex: 1, height: 18, background: "#F8F9FA", borderRadius: 4 }}>
                    {/* "today" line */}
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        bottom: -2,
                        left: `${c.nowPct}%`,
                        width: 1.5,
                        background: "#DC2626",
                        zIndex: 2,
                      }}
                    />
                    {/* bar */}
                    <div
                      title={`${stage?.name} · ${new Date(c.launchDate).toLocaleDateString("pt-BR")} → ${new Date(c.endDate).toLocaleDateString("pt-BR")}`}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${c.leftPct}%`,
                        width: `${c.widthPct}%`,
                        minWidth: 4,
                        background: color,
                        borderRadius: 3,
                        opacity: 0.85,
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#FFFFFF",
                        overflow: "hidden",
                      }}
                    >
                      {c.widthPct > 8 && (stage?.name || "")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: NEUTRAL.slate, marginTop: 10 }}>
            <span style={{ width: 8, height: 1.5, background: "#DC2626", display: "inline-block" }} />
            <span>Hoje</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function TopPerformanceList({ campaigns }) {
  const top = useMemo(() =>
    [...campaigns]
      .filter(c => (c.performanceScore || 0) > 0)
      .sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0))
      .slice(0, 5),
    [campaigns],
  );

  return (
    <Panel title="Top 5 · performance score">
      {top.length === 0 ? (
        <EmptyState>Sem campanhas pontuadas ainda</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {top.map((c, i) => {
            const score = Math.min(100, Math.max(0, c.performanceScore || 0));
            const color = score >= 80 ? "#16A34A" : score >= 60 ? "#D97706" : "#DC2626";
            return (
              <div key={c.id}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, width: 16, fontVariantNumeric: "tabular-nums" }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: NEUTRAL.graphite, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                    {score}
                  </span>
                </div>
                <div style={{ height: 4, background: "#F1F3F5", borderRadius: 2, overflow: "hidden", marginLeft: 24 }}>
                  <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function MarketingDashboardView({ user }) {
  const { campaigns,    loading: loadingC } = useMarketingCampaigns({ userId: user?.id, role: user?.role });
  const { deliverables, loading: loadingD } = useMarketingDeliverables({ userId: user?.id, role: user?.role });
  const { expenses,     loading: loadingE } = useMarketingExpenses({ userId: user?.id, role: user?.role });

  const isAgencia = user?.role === "agencia";

  // ── Snapshot KPIs ──
  const campaignKpis = useMemo(() => {
    const active = campaigns.filter(c => c.stage !== "encerrado").length;
    const budget = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
    const live   = campaigns.filter(c => c.stage === "ao_vivo").length;
    const urgent = campaigns.filter(c => {
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

  // ── Agency effectiveness ──
  const agencyKpis = useMemo(() => {
    const entregues = deliverables.filter(d => d.stage === "entregue");

    const onTime = entregues.filter(d => {
      if (!d.deadline || !d.stageChangedAt) return false;
      return new Date(d.stageChangedAt) <= new Date(d.deadline);
    });

    const sla = entregues.length > 0 ? Math.round((onTime.length / entregues.length) * 100) : null;

    const leadTimes = entregues
      .map(d => {
        if (!d.createdAt || !d.stageChangedAt) return null;
        return (new Date(d.stageChangedAt) - new Date(d.createdAt)) / 86400000;
      })
      .filter(x => x != null && x >= 0);
    const avgLeadTime = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
      : null;

    const stuckInReview = deliverables.filter(d => {
      if (d.stage !== "revisao" || !d.stageChangedAt) return false;
      const days = (Date.now() - new Date(d.stageChangedAt).getTime()) / 86400000;
      return days > 3;
    }).length;

    return { sla, avgLeadTime, stuckInReview, sampleSize: entregues.length };
  }, [deliverables]);

  // ── Month-over-month activity ──
  const momKpis = useMemo(() => {
    const now = new Date();
    const [curStart, curEnd]   = monthBounds(now);
    const prev = new Date(now); prev.setMonth(prev.getMonth() - 1);
    const [prevStart, prevEnd] = monthBounds(prev);

    const campsCur  = campaigns.filter(c => within(c.createdAt, curStart, curEnd)).length;
    const campsPrev = campaigns.filter(c => within(c.createdAt, prevStart, prevEnd)).length;

    const delivCur  = deliverables.filter(d => d.stage === "entregue" && within(d.stageChangedAt, curStart, curEnd)).length;
    const delivPrev = deliverables.filter(d => d.stage === "entregue" && within(d.stageChangedAt, prevStart, prevEnd)).length;

    const expCur  = expenses.filter(e => within(e.createdAt, curStart, curEnd)).reduce((s, e) => s + (e.amount || 0), 0);
    const expPrev = expenses.filter(e => within(e.createdAt, prevStart, prevEnd)).reduce((s, e) => s + (e.amount || 0), 0);

    return {
      campaigns:    { value: campsCur, delta: pctChange(campsCur, campsPrev) },
      deliverables: { value: delivCur, delta: pctChange(delivCur, delivPrev) },
      expenses:     { value: expCur,   delta: pctChange(expCur, expPrev) },
    };
  }, [campaigns, deliverables, expenses]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const loading = loadingC || loadingD || loadingE;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
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
          {/* Atividade do mês */}
          <SectionTitle icon={CalendarClock} title="Atividade do mês" color="#1E4D8C" />
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <KpiCard
              icon={Megaphone}
              label="Campanhas criadas"
              value={String(momKpis.campaigns.value)}
              sub="este mês"
              color="#1E4D8C"
              iconBg="#EFF6FF"
              delta={momKpis.campaigns.delta}
            />
            <KpiCard
              icon={Package}
              label="Entregas concluídas"
              value={String(momKpis.deliverables.value)}
              sub="este mês"
              color="#16A34A"
              iconBg="#DCFCE7"
              delta={momKpis.deliverables.delta}
            />
            {!isAgencia && (
              <KpiCard
                icon={DollarSign}
                label="Gasto"
                value={formatK(momKpis.expenses.value)}
                sub="este mês"
                color="#7C3AED"
                iconBg="#F5F3FF"
                delta={momKpis.expenses.delta}
                invertDelta
              />
            )}
          </div>

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

          {/* Efetividade da agência */}
          <SectionTitle icon={Activity} title="Efetividade da agência" color="#D97706" />
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <KpiCard
              icon={Award}
              label="SLA cumprido"
              value={agencyKpis.sla === null ? "—" : `${agencyKpis.sla}%`}
              sub={agencyKpis.sampleSize > 0 ? `${agencyKpis.sampleSize} entrega${agencyKpis.sampleSize !== 1 ? "s" : ""}` : "Sem entregas concluídas"}
              color={agencyKpis.sla === null ? NEUTRAL.slate : agencyKpis.sla >= 80 ? "#16A34A" : agencyKpis.sla >= 60 ? "#D97706" : "#DC2626"}
              iconBg={agencyKpis.sla === null ? "#F3F4F6" : agencyKpis.sla >= 80 ? "#DCFCE7" : agencyKpis.sla >= 60 ? "#FEF3C7" : "#FEE2E2"}
            />
            <KpiCard
              icon={Timer}
              label="Lead time médio"
              value={agencyKpis.avgLeadTime === null ? "—" : `${agencyKpis.avgLeadTime} d`}
              sub="Pendente → Entregue"
              color={NEUTRAL.graphite}
              iconBg="#F3F4F6"
            />
            <KpiCard
              icon={Clock}
              label="Em revisão > 3d"
              value={String(agencyKpis.stuckInReview)}
              sub="possível retrabalho"
              color={agencyKpis.stuckInReview > 0 ? "#DC2626" : NEUTRAL.graphite}
              iconBg={agencyKpis.stuckInReview > 0 ? "#FEE2E2" : "#F3F4F6"}
            />
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

              {/* Análise financeira: burn rate + categoria */}
              <SectionTitle icon={PieIcon} title="Análise financeira" color="#7C3AED" />
              <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
                <BurnRateChart expenses={expenses} />
                <CategoryDonut expenses={expenses} />
              </div>
            </>
          )}

          {/* Timeline de campanhas */}
          <SectionTitle icon={CalendarClock} title="Timeline de campanhas" color="#1E4D8C" />
          <GanttTimeline campaigns={campaigns} />

          {/* Distribuição + Top 5 */}
          <SectionTitle icon={Award} title="Visão das campanhas" color="#16A34A" />
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <StageBar stages={MARKETING_STAGES.filter(s => !s.terminal)} items={campaigns} />
            <TopPerformanceList campaigns={campaigns} />
          </div>
        </>
      )}
    </div>
  );
}

export default MarketingDashboardView;
