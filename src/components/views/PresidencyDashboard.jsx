import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, LabelList,
} from "recharts";
import { Crown, Printer, Calendar } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { weightedValue } from "../../utils/pipeline-metrics";
import { formatK, formatM } from "../../utils/currency";

// Painel da Presidência — visão consolidada com gráficos profissionais.
// Foco em "abrir e mostrar" — gerente/diretor compartilha tela ou imprime
// pra reunião. Não substitui o Dashboard Executivo: complementa.

const PERIODS = [
  { id: "all",  label: "Todo período" },
  { id: "30d",  label: "Últimos 30 dias" },
  { id: "90d",  label: "Últimos 90 dias" },
  { id: "ytd",  label: "YTD" },
];

const STAGE_COLORS = {
  prospeccao:   "#B45309",
  qualificacao: "#DC2626",
  visitas:      "#EAB308",
  amostras:     "#16A34A",
  negociacao:   "#3B82F6",
  ganho:        "#1E3A8A",
  perdido:      "#9CA3AF",
};

const STAGE_NAMES = {
  prospeccao: "Prospecção",
  qualificacao: "Qualificação",
  visitas: "Visitas",
  amostras: "Amostras",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

export function PresidencyDashboard({ leads, pipelines, users }) {
  const [period, setPeriod] = useState("all");

  // Filtro temporal usa stageChangedAt como referência (movimentação
  // recente). Períodos curtos focam no que está acontecendo agora.
  const filtered = useMemo(() => {
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
  }, [leads, period]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let pipeline = 0, forecast = 0, wonValue = 0, wonCount = 0, totalCount = 0;
    for (const l of filtered) {
      totalCount++;
      if (l.stage === "ganho") { wonCount++; wonValue += l.value || 0; }
      else if (l.stage === "perdido") { /* skip */ }
      else {
        pipeline += l.value || 0;
        forecast += weightedValue(l, pipelines?.[l.companyId]);
      }
    }
    const conversion = totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : 0;
    return { pipeline, forecast, wonValue, wonCount, conversion };
  }, [filtered, pipelines]);

  // ── Pipeline por empresa ─────────────────────────────────────────────────
  const pipelineByCompany = useMemo(() => {
    const m = {};
    for (const id of COMPANY_IDS) m[id] = { id, name: COMPANIES[id]?.short || id, valor: 0, forecast: 0, color: COMPANIES[id]?.primary };
    for (const l of filtered) {
      if (l.stage === "ganho" || l.stage === "perdido") continue;
      const row = m[l.companyId];
      if (!row) continue;
      row.valor += l.value || 0;
      row.forecast += weightedValue(l, pipelines?.[l.companyId]);
    }
    return COMPANY_IDS.map(id => m[id]);
  }, [filtered, pipelines]);

  // ── Funil de conversão ───────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    const order = ["prospeccao", "qualificacao", "visitas", "amostras", "negociacao", "ganho"];
    const counts = Object.fromEntries(order.map(id => [id, 0]));
    for (const l of filtered) {
      if (counts[l.stage] != null) counts[l.stage]++;
    }
    return order.map(id => ({ stage: STAGE_NAMES[id], count: counts[id], fill: STAGE_COLORS[id] }));
  }, [filtered]);

  // ── Top 10 leads em aberto ───────────────────────────────────────────────
  const topLeads = useMemo(() => {
    return filtered
      .filter(l => l.stage !== "ganho" && l.stage !== "perdido")
      .filter(l => (l.value || 0) > 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 10)
      .map(l => ({
        company: (l.company || "—").slice(0, 28),
        valor: l.value || 0,
        empresa: COMPANIES[l.companyId]?.short || l.companyId,
        fill: COMPANIES[l.companyId]?.primary || NEUTRAL.graphite,
      }));
  }, [filtered]);

  // ── Performance por vendedor ─────────────────────────────────────────────
  const sellerPerf = useMemo(() => {
    const byOwner = new Map();
    for (const l of filtered) {
      if (!l.owner) continue;
      const u = users?.find(u => u.id === l.owner);
      if (!u) continue;
      const key = u.id;
      if (!byOwner.has(key)) byOwner.set(key, { name: (u.name || u.email || "—").split(" ")[0], aberto: 0, ganho: 0, ganhoValor: 0 });
      const row = byOwner.get(key);
      if (l.stage === "ganho") { row.ganho++; row.ganhoValor += l.value || 0; }
      else if (l.stage !== "perdido") row.aberto++;
    }
    return Array.from(byOwner.values()).sort((a, b) => b.ganhoValor - a.ganhoValor).slice(0, 8);
  }, [filtered, users]);

  // ── Receita por mês ──────────────────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const m = new Map();
    for (const l of filtered) {
      if (l.stage !== "ganho") continue;
      const ref = l.stageChangedAt || l.updatedAt || l.createdAt;
      if (!ref) continue;
      const d = new Date(ref);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(key, (m.get(key) || 0) + (l.value || 0));
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => {
        const [y, mo] = k.split("-");
        return { mes: `${mo}/${y.slice(2)}`, valor: v };
      });
  }, [filtered]);

  // ── Distribuição do pipeline ─────────────────────────────────────────────
  const pipelineDistribution = useMemo(() => {
    const counts = { aberto: 0, ganho: 0, perdido: 0 };
    for (const l of filtered) {
      if (l.stage === "ganho") counts.ganho++;
      else if (l.stage === "perdido") counts.perdido++;
      else counts.aberto++;
    }
    return [
      { name: "Em aberto", value: counts.aberto, fill: "#3B82F6" },
      { name: "Ganhos",    value: counts.ganho,  fill: "#1A6E35" },
      { name: "Perdidos",  value: counts.perdido, fill: "#B91C1C" },
    ].filter(r => r.value > 0);
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header com filtros */}
      <div className="flex items-start justify-between flex-wrap gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Crown size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
              Painel da Presidência
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            Visão executiva consolidada · {filtered.length} leads · {PERIODS.find(p => p.id === period)?.label}
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Pipeline aberto" value={formatM(kpis.pipeline)} sublabel="Valor total de leads ativos" tone="#1E3A8A" />
        <Kpi label="Forecast ponderado" value={formatM(kpis.forecast)} sublabel="Por probabilidade de etapa" tone="#0F766E" />
        <Kpi label="Receita realizada" value={formatM(kpis.wonValue)} sublabel={`${kpis.wonCount} ganhos`} tone="#1A6E35" />
        <Kpi label="Taxa de conversão" value={`${kpis.conversion}%`} sublabel="Leads → ganhos" tone="#C2410C" />
      </div>

      {/* Linha 1: pipeline por empresa + funil */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Pipeline por empresa" subtitle="Valor total e forecast ponderado">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pipelineByCompany} margin={{ top: 16, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatK} />
              <Tooltip formatter={(v) => formatK(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="valor"    name="Pipeline"  fill="#1E4D8C" radius={[6, 6, 0, 0]} />
              <Bar dataKey="forecast" name="Forecast"  fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Funil de conversão" subtitle="Quantidade de leads por etapa">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData} layout="vertical" margin={{ top: 8, right: 28, left: 12, bottom: 0 }}>
              <CartesianGrid stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: NEUTRAL.graphite }} />
                {funnelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top leads */}
      <ChartCard title="Top 10 leads em aberto" subtitle="Ordenado por valor">
        {topLeads.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, topLeads.length * 32 + 50)}>
            <BarChart data={topLeads} layout="vertical" margin={{ top: 8, right: 60, left: 12, bottom: 0 }}>
              <CartesianGrid stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatK} />
              <YAxis dataKey="company" type="category" tick={{ fontSize: 11 }} width={180} />
              <Tooltip formatter={(v) => formatK(v)} />
              <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="valor" position="right" formatter={(v) => formatK(v)} style={{ fontSize: 10, fill: NEUTRAL.graphite }} />
                {topLeads.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Linha 3: vendedores + receita mensal */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Performance por vendedor" subtitle="Top 8 · ganhos vs em aberto">
          {sellerPerf.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sellerPerf} margin={{ top: 16, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="aberto" name="Em aberto" stackId="a" fill="#93C5FD" radius={[0, 0, 0, 0]} />
                <Bar dataKey="ganho"  name="Ganhos"    stackId="a" fill="#1A6E35" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Receita por mês" subtitle="Valor de fechamentos mensais (últimos 12 meses)">
          {revenueByMonth.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueByMonth} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatK} />
                <Tooltip formatter={(v) => formatK(v)} />
                <Line type="monotone" dataKey="valor" stroke="#1A6E35" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Distribuição donut */}
      <ChartCard title="Distribuição do pipeline" subtitle="Em aberto · ganhos · perdidos">
        {pipelineDistribution.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pipelineDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                label={({ name, value }) => `${name}: ${value}`}
                style={{ fontSize: 11 }}
              >
                {pipelineDistribution.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, sublabel, tone }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#E8E8E8", background: "#FFFFFF" }}>
      <div className="text-[10px] font-bold uppercase mb-1" style={{ color: NEUTRAL.slate, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div className="text-xl font-bold leading-none" style={{ color: tone }}>
        {value}
      </div>
      <div className="text-[11px] mt-1.5" style={{ color: NEUTRAL.slate }}>
        {sublabel}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#E8E8E8", background: "#FFFFFF" }}>
      <div className="mb-2">
        <div className="text-sm font-bold" style={{ color: NEUTRAL.graphite }}>{title}</div>
        {subtitle && (
          <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-12 text-xs italic" style={{ color: NEUTRAL.slate }}>
      Sem dados para esse período.
    </div>
  );
}

export default PresidencyDashboard;
