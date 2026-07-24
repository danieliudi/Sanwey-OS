import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Package, DollarSign, Zap, Award, Clock, AlertTriangle } from "lucide-react";
import { ROUTES } from "../../constants/routes";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area,
} from "recharts";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { useMarketingExpenses } from "../../hooks/use-marketing-expenses";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { MARKETING_STAGES, EXPENSE_CATEGORIES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { formatBRL, formatK } from "../../utils/currency";
import { StatCard } from "../ui/StatCard";
import { Badge } from "../ui/Badge";
import { Eyebrow } from "../shared/PanelHeading";
import { PanelEmptyState } from "../shared/PanelEmptyState";

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

// ── Company tabs ────────────────────────────────────────────────────────────────

function CompanyTabs({ selected, onChange, companyIds }) {
  const tabs = [
    { id: "all", short: "Todas", primary: "var(--text)" },
    ...companyIds.map(id => COMPANIES[id]).filter(Boolean),
  ];
  return (
    <div
      className="flex overflow-x-auto lg:overflow-visible lg:flex-wrap"
      style={{ gap: 6, scrollbarWidth: "none" }}
    >
      {tabs.map(co => {
        const active = selected === co.id;
        return (
          <button
            key={co.id}
            onClick={() => onChange(co.id)}
            className="shrink-0 px-3.5 py-3 lg:py-[5px]"
            style={{
              borderRadius: 20,
              border: `1.5px solid ${active ? co.primary : "var(--border)"}`,
              background: active ? co.primary : "var(--surface)",
              color: active ? "#FFFFFF" : "var(--text-dim)",
              fontWeight: active ? 700 : 500, fontSize: 12,
              cursor: "pointer", transition: "all 0.15s",
              letterSpacing: "0.01em", fontFamily: "inherit",
              boxShadow: active ? `0 2px 8px ${co.primary}45` : "none",
            }}
          >
            {co.short || co.name}
          </button>
        );
      })}
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────────

function Panel({ title, subtitle, children }) {
  return (
    <div className="p-4 lg:p-5" style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      {(title || subtitle) && (
        <div style={{ marginBottom: 14 }}>
          {title && (
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
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

// ── Stage pipeline bar ──────────────────────────────────────────────────────────

function StagePipelineBar({ campaigns, stages: allStages }) {
  const total = campaigns.length;
  const stages = useMemo(() =>
    (allStages || MARKETING_STAGES)
      .map(s => ({ ...s, count: campaigns.filter(c => c.stage === s.id).length }))
      .filter(s => s.count > 0),
    [campaigns, allStages],
  );
  if (total === 0) return <PanelEmptyState>Sem campanhas</PanelEmptyState>;
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
  if (data.length === 0) return <PanelEmptyState>Sem campanhas com canal definido</PanelEmptyState>;

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
  if (!hasData) return <PanelEmptyState>Sem dados de atividade ainda</PanelEmptyState>;
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

  if (!data.some(m => m.total > 0)) return <PanelEmptyState>Sem despesas registradas</PanelEmptyState>;

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
  if (data.length === 0) return <PanelEmptyState>Sem despesas registradas</PanelEmptyState>;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 120, height: 120, minWidth: 72 }}>
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

function AgencyMetrics({ deliverables }) {
  const navigate = useNavigate();
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

  const goToStuck = () => navigate(ROUTES["marketing-entregas"], { state: { filterStage: "revisao", stuckOnly: true } });

  return (
    <div className="-mx-4 sm:-mx-6 lg:mx-0">
      <div
        className="flex gap-3 overflow-x-auto px-4 sm:px-6 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
          <StatCard icon={Award} value={m.sla != null ? `${m.sla}%` : "—"} label="SLA cumprido"
            sublabel={m.total > 0 ? `${m.total} entregas` : "sem entregas"} compact />
        </div>
        <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
          <StatCard icon={Clock} value={m.avgLead != null ? `${m.avgLead}d` : "—"} label="Lead time médio"
            sublabel="Pendente → Entregue" compact />
        </div>
        <div
          className="flex-none w-[132px] lg:w-auto"
          style={{ scrollSnapAlign: "start", cursor: m.stuck > 0 ? "pointer" : "default" }}
          onClick={m.stuck > 0 ? goToStuck : undefined}
        >
          <StatCard icon={AlertTriangle} value={m.stuck} label="Presas em revisão"
            sublabel={m.stuck > 0 ? "Mais de 3 dias · clique para ver" : "Mais de 3 dias"}
            accent={m.stuck > 0 ? "var(--warning)" : undefined} compact />
        </div>
      </div>
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

  if (top.length === 0) return <PanelEmptyState>Sem campanhas pontuadas ainda</PanelEmptyState>;

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
                {stage && <Badge customColor={stage.color}>{stage.name}</Badge>}
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

// ── Main view ──────────────────────────────────────────────────────────────────────

export function MarketingDashboardView({ user }) {
  const { campaigns,    loading: lC } = useMarketingCampaigns({ userId: user?.id, role: user?.role, roles: user?.roles });
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

  // roles[] cobre cargo adicional — user.role sozinho fica só de fallback.
  // Achado da 2ª auditoria (esta view ficou de fora do fix a28bfb5).
  const isAgencia = (user?.roles?.length ? user.roles : (user?.role ? [user.role] : [])).includes("agencia");
  const loading   = lC || lD || lE;

  // ── Company filter ──
  const accessibleCompanies = useMemo(() => {
    if (["admin", "gerente", "marketing", "gerente_marketing"].includes(user?.role)) return COMPANY_IDS;
    return user?.companies?.filter(id => COMPANY_IDS.includes(id)) || COMPANY_IDS;
  }, [user]);

  const [selectedCompany, setSelectedCompany] = useState("all");
  const co           = selectedCompany !== "all" ? (COMPANIES[selectedCompany] || null) : null;
  const primaryColor = co?.primary || "var(--color-industria)";

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

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text)",
                       letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0 }}>
            {greeting}, {user?.name?.split(" ")[0] || "—"}
          </h1>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-dim)", margin: "4px 0 0" }}>
            Dashboard de Marketing
            {co && <> · <strong style={{ color: co.primary }}>{co.name}</strong></>}
            {" "}· {fCampaigns.length} campanha{fCampaigns.length !== 1 ? "s" : ""}
            {loading && " · carregando…"}
          </p>
        </div>
        {kpi.live > 0 && (
          <div className="self-start">
            <Badge variant="success" size="md">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)",
                             boxShadow: "0 0 0 3px #16A34A33", display: "inline-block" }} />
              {kpi.live} ao vivo
            </Badge>
          </div>
        )}
      </div>
      <div className="mb-5">
        <CompanyTabs
          selected={selectedCompany}
          onChange={setSelectedCompany}
          companyIds={accessibleCompanies}
        />
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────── */}
      <div className="-mx-4 sm:-mx-6 lg:mx-0 mb-3.5">
        <div
          className="flex gap-3 overflow-x-auto px-4 sm:px-6 lg:px-0 lg:grid lg:overflow-visible"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
                    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}
        >
          <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
            <StatCard icon={Megaphone} value={kpi.active} label="Campanhas ativas"
              trend={mom.campaigns.d} compact />
          </div>
          <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
            <StatCard icon={Zap} value={kpi.live} label="Ao vivo agora"
              sublabel={kpi.live > 0 ? "em exibição" : "nenhuma ao vivo"}
              accent={kpi.live > 0 ? "var(--success)" : undefined} compact />
          </div>
          <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
            <StatCard icon={DollarSign} value={formatK(kpi.budget)} label="Orçamento comprometido"
              trend={-mom.expenses.d} compact />
          </div>
          <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
            <StatCard icon={Package} value={kpi.entregue} label="Entregas concluídas"
              trend={mom.deliverables.d} compact />
          </div>
          <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
            <StatCard icon={Award} value={kpi.avgScore != null ? kpi.avgScore : "—"} label="Performance médio"
              sublabel={kpi.avgScore != null ? (kpi.avgScore >= 80 ? "ótimo" : kpi.avgScore >= 60 ? "bom" : "atenção") : "sem dados"}
              compact />
          </div>
        </div>
      </div>

      {/* ── Activity + Channel ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2.5 mb-2.5">
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
        <div className="mt-5">
          <Eyebrow>Efetividade da agência</Eyebrow>
          <AgencyMetrics deliverables={fDeliverables} />
        </div>
      )}

      {/* ── Financial ──────────────────────────────────────────────── */}
      {!isAgencia && (
        <div className="mt-5">
          <Eyebrow>Análise financeira</Eyebrow>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr]" style={{ gap: 10, marginBottom: 10 }}>
            <Panel title="Burn rate" subtitle="Gasto mensal · últimos 6 meses">
              <BurnRateChart expenses={fExpenses} primaryColor={primaryColor} />
            </Panel>
            <Panel title="Por categoria">
              <CategoryDonut expenses={fExpenses} />
            </Panel>
          </div>
        </div>
      )}

      {/* ── Top 5 ──────────────────────────────────────────────────── */}
      <div className="mt-5">
        <Eyebrow>Top 5 · performance</Eyebrow>
        <Panel>
          <TopPerformanceList campaigns={fCampaigns} primaryColor={primaryColor} stages={campaignStages} />
        </Panel>
      </div>

    </div>
  );
}
