import React, { useMemo, useState } from "react";
import {
  Megaphone, Package, DollarSign, Zap, Award, ArrowUp, ArrowDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area,
} from "recharts";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingExpenses } from "../../hooks/use-marketing-expenses";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { MARKETING_STAGES, EXPENSE_CATEGORIES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatBRL, formatK } from "../../utils/currency";

// ── Date helpers ────────────────────────────────────────────────────────────────

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
function shortMonth(date) {
  return new Date(date).toLocaleString("pt-BR", { month: "short" });
}

// ── Sparkline SVG ───────────────────────────────────────────────────────────────

function Sparkline({ values = [], color = "var(--color-industria)", w = 70, h = 32 }) {
  if (values.length < 2) return <div style={{ width: w, height: h }} />;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = ((i / (values.length - 1)) * (w - 4) + 2).toFixed(1);
    const y = (h - 4 - ((v - min) / range) * (h - 8) + 2).toFixed(1);
    return `${x},${y}`;
  });
  const lineStr = pts.join(" ");
  const fillStr = `2,${h - 2} ${lineStr} ${w - 2},${h - 2}`;
  const gId = `sg${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={fillStr} fill={`url(#${gId})`} />
      <polyline points={lineStr} fill="none" stroke={color} strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── MoM badge ───────────────────────────────────────────────────────────────────

function MoMBadge({ delta, invert }) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;
  const up  = invert ? delta < 0 : delta > 0;
  const dn  = invert ? delta > 0 : delta < 0;
  const color = delta === 0 ? "var(--text-dim)" : up ? "#16A34A" : "#DC2626";
  const bg    = delta === 0 ? "var(--surface-alt)" : up ? "#DCFCE7" : "#FEE2E2";
  const Icon  = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2,
                   padding: "2px 6px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                   background: bg, color, whiteSpace: "nowrap" }}>
      {Icon && <Icon size={9} />}{Math.abs(delta)}%
    </span>
  );
}

// ── Company tabs ────────────────────────────────────────────────────────────────

function CompanyTabs({ selected, onChange, companyIds }) {
  const tabs = [
    { id: "all", short: "Todas", primary: "var(--text)" },
    ...companyIds.map(id => COMPANIES[id]).filter(Boolean),
  ];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {tabs.map(co => {
        const active = selected === co.id;
        return (
          <button key={co.id} onClick={() => onChange(co.id)} style={{
            padding: "5px 14px", borderRadius: 20,
            border: `1.5px solid ${active ? co.primary : "var(--border)"}`,
            background: active ? co.primary : "var(--surface)",
            color: active ? "#FFFFFF" : "var(--text-dim)",
            fontWeight: active ? 700 : 500, fontSize: 12,
            cursor: "pointer", transition: "all 0.15s",
            letterSpacing: "0.01em", fontFamily: "inherit",
            boxShadow: active ? `0 2px 8px ${co.primary}45` : "none",
          }}>
            {co.short || co.name}
          </button>
        );
      })}
    </div>
  );
}

// ── KPI card ────────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, delta, invertDelta, color, sparkline }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 2,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: color, borderRadius: "12px 12px 0 0",
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: color + "18",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {Icon && <Icon size={15} style={{ color }} strokeWidth={2.5} />}
        </div>
        {sparkline && <Sparkline values={sparkline} color={color} />}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "var(--text)", lineHeight: 1,
                    marginTop: 8, letterSpacing: "-0.03em" }}>
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>{label}</span>
        <MoMBadge delta={delta} invert={invertDelta} />
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────────

function Panel({ title, subtitle, children }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "18px 20px",
    }}>
      {(title || subtitle) && (
        <div style={{ marginBottom: 14 }}>
          {title && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)",
                          letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>{subtitle}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
      {children}
    </div>
  );
}

// ── Stage pipeline bar ──────────────────────────────────────────────────────────

function StagePipelineBar({ campaigns, stages: allStages }) {
  const total = campaigns.length;
  const stages = useMemo(() =>
    (allStages || MARKETING_STAGES)
      .map(s => ({ ...s, count: campaigns.filter(c => c.stage === s.id).length }))
      .filter(s => s.count > 0),
    [campaigns, allStages],
  );
  if (total === 0) return <EmptyState>Sem campanhas</EmptyState>;
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden",
                    marginBottom: 14, gap: 1.5 }}>
        {stages.map(s => (
          <div key={s.id} style={{
            width: `${(s.count / total) * 100}%`,
            background: s.color, minWidth: s.count > 0 ? 4 : 0,
            transition: "width 0.4s ease",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
        {stages.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--text-dim)" }}>{s.name}</span>
            <span style={{ fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Channel chart ───────────────────────────────────────────────────────────────

const CH_COLORS = ["#7C3AED", "#1D4ED8", "#D97706", "#16A34A", "#DC2626", "#9CA3AF"];

function ChannelChart({ campaigns, primaryColor }) {
  const data = useMemo(() => {
    const map = {};
    campaigns.forEach(c => {
      const k = c.channel || "Sem canal";
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count], i) => ({ name, count, color: CH_COLORS[i % CH_COLORS.length] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [campaigns]);

  const max = Math.max(...data.map(d => d.count), 1);
  if (data.length === 0) return <EmptyState>Sem campanhas com canal definido</EmptyState>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d, i) => (
        <div key={d.name}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: primaryColor || d.color, flexShrink: 0 }} />
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{d.name}</span>
            </div>
            <span style={{ color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>{d.count}</span>
          </div>
          <div style={{ height: 7, background: "var(--surface-alt)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${(d.count / max) * 100}%`,
              background: `linear-gradient(90deg, ${primaryColor || d.color}, ${(primaryColor || d.color)}bb)`,
              borderRadius: 4, transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Monthly trend chart ─────────────────────────────────────────────────────────

function MonthlyTrendChart({ data, primaryColor }) {
  const hasData = data.some(m => m.campanhas > 0 || m.entregas > 0);
  if (!hasData) return <EmptyState>Sem dados de atividade ainda</EmptyState>;
  const sec = primaryColor + "88";
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={primaryColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={sec} stopOpacity={0.25} />
            <stop offset="95%" stopColor={sec} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" stroke={"var(--text-dim)"} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke={"var(--text-dim)"} fontSize={10} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--text)", fontWeight: 600 }}
        />
        <Area type="monotone" dataKey="campanhas" name="Campanhas" stroke={primaryColor} strokeWidth={2}
              fill="url(#gc)" dot={{ r: 3, fill: primaryColor }} activeDot={{ r: 5 }} />
        <Area type="monotone" dataKey="entregas" name="Entregas" stroke={sec} strokeWidth={2}
              fill="url(#ge)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Burn rate ───────────────────────────────────────────────────────────────────

function BurnRateChart({ expenses, primaryColor }) {
  const data = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const ref = new Date(now); ref.setMonth(ref.getMonth() - (5 - i));
      const [start, end] = monthBounds(ref);
      return {
        month: shortMonth(ref),
        total: expenses.filter(e => within(e.createdAt, start, end)).reduce((s, e) => s + (e.amount || 0), 0),
        isCurrent: i === 5,
      };
    });
  }, [expenses]);

  if (!data.some(m => m.total > 0)) return <EmptyState>Sem despesas registradas</EmptyState>;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <XAxis dataKey="month" stroke={"var(--text-dim)"} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke={"var(--text-dim)"} fontSize={10} tickLine={false} axisLine={false}
               tickFormatter={v => formatK(v)} />
        <Tooltip
          cursor={{ fill: "var(--surface-alt)" }}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={v => [formatBRL(v), "Gasto"]}
          labelStyle={{ color: "var(--text)", fontWeight: 600 }}
        />
        <Bar dataKey="total" radius={[5, 5, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.isCurrent ? primaryColor : primaryColor + "40"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Category donut ───────────────────────────────────────────────────────────────

const CAT_COLORS = {
  "Mídia Paga":  "#7C3AED",
  "Produção":    "#1D4ED8",
  "Agência":     "#D97706",
  "Ferramentas": "#16A34A",
  "Eventos":     "#DC2626",
  "Outros":      "#9CA3AF",
};

function CategoryDonut({ expenses }) {
  const data = useMemo(() => {
    const sums = {};
    expenses.forEach(e => { sums[e.category] = (sums[e.category] || 0) + (e.amount || 0); });
    return EXPENSE_CATEGORIES.map(c => ({ name: c, value: sums[c] || 0 })).filter(d => d.value > 0);
  }, [expenses]);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0) return <EmptyState>Sem despesas registradas</EmptyState>;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 120, height: 120, flexShrink: 0 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={36} outerRadius={57}
                 paddingAngle={2} stroke="#FFFFFF" strokeWidth={2}>
              {data.map((d, i) => <Cell key={i} fill={CAT_COLORS[d.name] || "#9CA3AF"} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={v => [formatBRL(v)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[d.name] || "#9CA3AF", flexShrink: 0 }} />
            <span style={{ color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.name}
            </span>
            <span style={{ color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agency metrics ───────────────────────────────────────────────────────────────

function AgencyMetrics({ deliverables, primaryColor }) {
  const m = useMemo(() => {
    const done = deliverables.filter(d => d.stage === "entregue");
    const onTime = done.filter(d => d.deadline && d.stageChangedAt &&
      new Date(d.stageChangedAt) <= new Date(d.deadline));
    const sla = done.length > 0 ? Math.round((onTime.length / done.length) * 100) : null;
    const times = done.map(d => d.createdAt && d.stageChangedAt
      ? (new Date(d.stageChangedAt) - new Date(d.createdAt)) / 86400000 : null)
      .filter(x => x != null && x >= 0);
    const avgLead = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
    const stuck = deliverables.filter(d => d.stage === "revisao" && d.stageChangedAt &&
      (Date.now() - new Date(d.stageChangedAt).getTime()) / 86400000 > 3).length;
    return { sla, avgLead, stuck, total: done.length };
  }, [deliverables]);

  const slaColor = m.sla == null ? "var(--text-dim)" : m.sla >= 80 ? "#16A34A" : m.sla >= 60 ? "#D97706" : "#DC2626";

  const card = (value, label, sub, color, warn) => (
    <div style={{
      background: warn ? "#FFF7ED" : "var(--surface)",
      border: `1px solid ${warn ? "#FED7AA" : "var(--border)"}`,
      borderRadius: 12, padding: "16px 18px", textAlign: "center", flex: 1,
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 5, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {card(m.sla != null ? `${m.sla}%` : "—", "SLA cumprido",
            m.total > 0 ? `${m.total} entregas` : "sem entregas", slaColor, false)}
      {card(m.avgLead != null ? `${m.avgLead}d` : "—", "Lead time médio",
            "Pendente → Entregue", primaryColor || "var(--text)", false)}
      {card(m.stuck, "Presas em revisão",
            "Mais de 3 dias", m.stuck > 0 ? "#D97706" : "#16A34A", m.stuck > 0)}
    </div>
  );
}

// ── Top 5 performance ────────────────────────────────────────────────────────────

function TopPerformanceList({ campaigns, primaryColor, stages }) {
  const top = useMemo(() =>
    [...campaigns]
      .filter(c => (c.performanceScore || 0) > 0)
      .sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0))
      .slice(0, 5),
    [campaigns],
  );

  if (top.length === 0) return <EmptyState>Sem campanhas pontuadas ainda</EmptyState>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {top.map((c, i) => {
        const score = Math.min(100, Math.max(0, c.performanceScore || 0));
        const col = score >= 80 ? "#16A34A" : score >= 60 ? "#D97706" : "#DC2626";
        const stage = (stages || MARKETING_STAGES).find(s => s.id === c.stage);
        return (
          <div key={c.id}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", width: 16,
                               fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)",
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </span>
                {stage && (
                  <span style={{ padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                                 background: stage.color + "22", color: stage.color, flexShrink: 0 }}>
                    {stage.name}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: col,
                             fontVariantNumeric: "tabular-nums", flexShrink: 0, marginLeft: 8 }}>
                {score}
              </span>
            </div>
            <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden", marginLeft: 24 }}>
              <div style={{
                height: "100%", width: `${score}%`,
                background: `linear-gradient(90deg, ${col}, ${col}cc)`,
                borderRadius: 3, transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section label ────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: 10, marginTop: 20 }}>
      {children}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────────

export function MarketingDashboardView({ user }) {
  const { campaigns,    loading: lC } = useMarketingCampaigns({ userId: user?.id, role: user?.role });
  const { deliverables, loading: lD } = useMarketingDeliverables({ userId: user?.id, role: user?.role });
  const { expenses,     loading: lE } = useMarketingExpenses({ userId: user?.id, role: user?.role });

  // Etapas vivas (DB, editáveis via "Editar etapas" no Kanban) — MARKETING_STAGES
  // é só o fallback estático de antes da customização por etapa existir. Sem
  // isso, renomear/criar/excluir uma etapa deixava o Dashboard mostrando o
  // conjunto antigo de etapas, com dado errado.
  const { stages: dbCampaignStages } = useRHPipelineStages("marketing");
  const campaignStages = useMemo(
    () => dbCampaignStages.length > 0
      ? dbCampaignStages.map(s => ({ id: s.stageKey, name: s.name, color: s.color, sla: s.slaDays, terminal: s.terminal }))
      : MARKETING_STAGES,
    [dbCampaignStages]
  );

  const isAgencia = user?.role === "agencia";
  const loading   = lC || lD || lE;

  // ── Company filter ──
  const accessibleCompanies = useMemo(() => {
    if (["admin", "gerente", "marketing", "gerente_marketing"].includes(user?.role)) return COMPANY_IDS;
    return user?.companies?.filter(id => COMPANY_IDS.includes(id)) || COMPANY_IDS;
  }, [user]);

  const [selectedCompany, setSelectedCompany] = useState("all");
  const co           = selectedCompany !== "all" ? (COMPANIES[selectedCompany] || null) : null;
  const primaryColor = co?.primary || "var(--color-industria)";
  const accentColor  = co?.active  || "var(--color-industria)";

  // ── Filtered slices ──
  const fCampaigns = useMemo(() =>
    selectedCompany === "all" ? campaigns
      : campaigns.filter(c => Array.isArray(c.companyIds) && c.companyIds.includes(selectedCompany)),
    [campaigns, selectedCompany],
  );
  const fDeliverables = useMemo(() =>
    selectedCompany === "all" ? deliverables
      : deliverables.filter(d => Array.isArray(d.companyIds) && d.companyIds.includes(selectedCompany)),
    [deliverables, selectedCompany],
  );
  const fExpenses = useMemo(() =>
    selectedCompany === "all" ? expenses
      : expenses.filter(e => Array.isArray(e.companyIds) && e.companyIds.includes(selectedCompany)),
    [expenses, selectedCompany],
  );

  // ── KPIs ──
  const kpi = useMemo(() => {
    const active = fCampaigns.filter(c => c.stage !== "encerrado").length;
    const live   = fCampaigns.filter(c => c.stage === "ao_vivo").length;
    const budget = fCampaigns.reduce((s, c) => s + (c.budget || 0), 0);
    const scored = fCampaigns.filter(c => c.performanceScore > 0);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, c) => s + (c.performanceScore || 0), 0) / scored.length)
      : null;
    const entregue = fDeliverables.filter(d => d.stage === "entregue").length;
    return { active, live, budget, avgScore, entregue };
  }, [fCampaigns, fDeliverables]);

  // ── MoM ──
  const mom = useMemo(() => {
    const now = new Date();
    const [cs, ce] = monthBounds(now);
    const prev = new Date(now); prev.setMonth(prev.getMonth() - 1);
    const [ps, pe] = monthBounds(prev);
    const cc = fCampaigns.filter(c => within(c.createdAt, cs, ce)).length;
    const cp = fCampaigns.filter(c => within(c.createdAt, ps, pe)).length;
    const dc = fDeliverables.filter(d => d.stage === "entregue" && within(d.stageChangedAt, cs, ce)).length;
    const dp = fDeliverables.filter(d => d.stage === "entregue" && within(d.stageChangedAt, ps, pe)).length;
    const ec = fExpenses.filter(e => within(e.createdAt, cs, ce)).reduce((s, e) => s + (e.amount || 0), 0);
    const ep = fExpenses.filter(e => within(e.createdAt, ps, pe)).reduce((s, e) => s + (e.amount || 0), 0);
    return {
      campaigns:    { v: cc, d: pctChange(cc, cp) },
      deliverables: { v: dc, d: pctChange(dc, dp) },
      expenses:     { v: ec, d: pctChange(ec, ep) },
    };
  }, [fCampaigns, fDeliverables, fExpenses]);

  // ── Monthly trend (6 months) ──
  const trendData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const ref = new Date(now); ref.setMonth(ref.getMonth() - (5 - i));
      const [s, e] = monthBounds(ref);
      return {
        month:     shortMonth(ref),
        campanhas: fCampaigns.filter(c => within(c.createdAt, s, e)).length,
        entregas:  fDeliverables.filter(d => d.stage === "entregue" && within(d.stageChangedAt, s, e)).length,
      };
    });
  }, [fCampaigns, fDeliverables]);

  const sparkCampaigns = trendData.map(m => m.campanhas);
  const sparkDelivs    = trendData.map(m => m.entregas);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // ── Hero strip accent ──
  // When a company is selected, the top of the page gets a subtle tinted background.
  const heroBg = co
    ? `linear-gradient(135deg, ${co.light} 0%, #FFFFFF 70%)`
    : "transparent";

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 14, padding: "20px 24px", marginBottom: 20,
        background: heroBg,
        border: co ? `1px solid ${co.primary}22` : "none",
        transition: "background 0.4s ease, border-color 0.4s ease",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                      flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: co ? co.primary : "var(--text)",
                         letterSpacing: "-0.02em", lineHeight: 1, margin: 0,
                         transition: "color 0.3s ease" }}>
              {greeting}, {user?.name?.split(" ")[0] || "—"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "5px 0 0" }}>
              Dashboard de Marketing
              {co && <> · <strong style={{ color: co.primary }}>{co.name}</strong></>}
              {" "}· {fCampaigns.length} campanha{fCampaigns.length !== 1 ? "s" : ""}
              {loading && " · carregando…"}
            </p>
          </div>
          {/* Live badge */}
          {kpi.live > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                          borderRadius: 20, background: "#DCFCE7", border: "1px solid #86EFAC" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)",
                             boxShadow: "0 0 0 3px #16A34A33" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}>
                {kpi.live} ao vivo
              </span>
            </div>
          )}
        </div>
        <CompanyTabs
          selected={selectedCompany}
          onChange={setSelectedCompany}
          companyIds={accessibleCompanies}
        />
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                    gap: 10, marginBottom: 14 }}>
        <KpiCard
          icon={Megaphone} label="Campanhas ativas" value={kpi.active}
          delta={mom.campaigns.d} color={primaryColor} sparkline={sparkCampaigns}
        />
        <KpiCard
          icon={Zap} label="Ao vivo agora" value={kpi.live}
          color={kpi.live > 0 ? "#16A34A" : "var(--text-dim)"}
          sub={kpi.live > 0 ? "em exibição" : "nenhuma ao vivo"}
        />
        <KpiCard
          icon={DollarSign} label="Budget comprometido"
          value={kpi.budget > 0 ? formatBRL(kpi.budget) : "R$ 0"}
          delta={mom.expenses.d} invertDelta color={accentColor}
        />
        <KpiCard
          icon={Package} label="Entregas concluídas" value={kpi.entregue}
          delta={mom.deliverables.d} color={accentColor} sparkline={sparkDelivs}
        />
        <KpiCard
          icon={Award} label="Performance médio"
          value={kpi.avgScore != null ? kpi.avgScore : "—"}
          sub={kpi.avgScore != null ? (kpi.avgScore >= 80 ? "ótimo" : kpi.avgScore >= 60 ? "bom" : "atenção") : "sem dados"}
          color={kpi.avgScore != null ? (kpi.avgScore >= 80 ? "#16A34A" : kpi.avgScore >= 60 ? "#D97706" : "#DC2626") : "var(--text-dim)"}
        />
      </div>

      {/* ── Activity + Channel ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)",
                    gap: 10, marginBottom: 10 }}>
        <Panel title="Atividade mensal" subtitle="Campanhas criadas vs. entregas concluídas (últimos 6 meses)">
          <MonthlyTrendChart data={trendData} primaryColor={primaryColor} />
        </Panel>
        <Panel title="Campanhas por canal">
          <ChannelChart campaigns={fCampaigns} primaryColor={primaryColor} />
        </Panel>
      </div>

      {/* ── Stage pipeline ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 10 }}>
        <Panel
          title="Pipeline · distribuição por etapa"
          subtitle={`${fCampaigns.length} campanha${fCampaigns.length !== 1 ? "s" : ""} no total`}
        >
          <StagePipelineBar campaigns={fCampaigns} stages={campaignStages} />
        </Panel>
      </div>

      {/* ── Agency effectiveness ───────────────────────────────────── */}
      {!isAgencia && (
        <>
          <SectionLabel>Efetividade da agência</SectionLabel>
          <AgencyMetrics deliverables={fDeliverables} primaryColor={primaryColor} />
        </>
      )}

      {/* ── Financial ──────────────────────────────────────────────── */}
      {!isAgencia && (
        <>
          <SectionLabel>Análise financeira</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)",
                        gap: 10, marginBottom: 10 }}>
            <Panel title="Burn rate" subtitle="Gasto mensal · últimos 6 meses">
              <BurnRateChart expenses={fExpenses} primaryColor={primaryColor} />
            </Panel>
            <Panel title="Por categoria">
              <CategoryDonut expenses={fExpenses} />
            </Panel>
          </div>
        </>
      )}

      {/* ── Top 5 ──────────────────────────────────────────────────── */}
      <SectionLabel>Top 5 · performance</SectionLabel>
      <Panel>
        <TopPerformanceList campaigns={fCampaigns} primaryColor={primaryColor} stages={campaignStages} />
      </Panel>

    </div>
  );
}
