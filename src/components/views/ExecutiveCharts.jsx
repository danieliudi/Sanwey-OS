import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, LabelList,
} from "recharts";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { weightedValue } from "../../utils/pipeline-metrics";
import { formatK } from "../../utils/currency";

// Gráficos profissionais (recharts) que vivem dentro da tab "Gráficos"
// do Painel Executivo. Recebe leads já filtrados por período do parent.

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

export function ExecutiveCharts({ leads, pipelines, users }) {
  // ── Pipeline por empresa ─────────────────────────────────────────────────
  const pipelineByCompany = useMemo(() => {
    const m = {};
    for (const id of COMPANY_IDS) {
      m[id] = { id, name: COMPANIES[id]?.short || id, valor: 0, forecast: 0 };
    }
    for (const l of leads) {
      if (l.stage === "ganho" || l.stage === "perdido") continue;
      const row = m[l.companyId];
      if (!row) continue;
      row.valor += l.value || 0;
      row.forecast += weightedValue(l, pipelines?.[l.companyId]);
    }
    return COMPANY_IDS.map(id => m[id]);
  }, [leads, pipelines]);

  // ── Funil de conversão ───────────────────────────────────────────────────
  // Usa as etapas reais de cada empresa (pipelines[companyId]) em vez da
  // lista fixa de 7 etapas padrão — senão leads em etapas customizadas
  // (criadas via Construtor de pipeline) somem do gráfico e os percentuais
  // do funil não fecham em 100%.
  const funnelData = useMemo(() => {
    // Itera em ordem estável (COMPANY_IDS) — antes usava a ordem de
    // aparição nos leads, o que fazia nome/cor/posição da etapa no funil
    // dependerem de qual lead vinha primeiro (não-determinístico).
    const presentIds = new Set(leads.map(l => l.companyId));
    const extraIds = [...presentIds].filter(id => !COMPANY_IDS.includes(id));
    const sourceCompanies = presentIds.size > 0 ? [...COMPANY_IDS.filter(id => presentIds.has(id)), ...extraIds] : COMPANY_IDS;
    const stageMap = new Map();
    for (const cid of sourceCompanies) {
      const stages = (pipelines?.[cid] || []).filter(s => !s.lost);
      for (const s of stages) {
        if (!stageMap.has(s.id)) stageMap.set(s.id, s);
      }
    }
    if (stageMap.size === 0) {
      for (const id of ["prospeccao", "qualificacao", "visitas", "amostras", "negociacao", "ganho"]) {
        stageMap.set(id, { id, name: STAGE_NAMES[id], color: STAGE_COLORS[id] });
      }
    }
    const counts = Object.create(null);
    for (const s of stageMap.values()) counts[s.id] = 0;
    for (const l of leads) {
      if (counts[l.stage] != null) counts[l.stage]++;
    }
    return Array.from(stageMap.values()).map(s => ({
      stage: s.name || STAGE_NAMES[s.id] || s.id,
      count: counts[s.id] || 0,
      fill: s.color || STAGE_COLORS[s.id] || NEUTRAL.slate,
    }));
  }, [leads, pipelines]);

  // ── Top 10 leads em aberto ───────────────────────────────────────────────
  const topLeads = useMemo(() => {
    return leads
      .filter(l => l.stage !== "ganho" && l.stage !== "perdido")
      .filter(l => (l.value || 0) > 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 10)
      .map(l => ({
        company: (l.company || "—").slice(0, 28),
        valor: l.value || 0,
        empresa: COMPANIES[l.companyId]?.short || l.companyId,
        fill: COMPANIES[l.companyId]?.primary || "var(--text)",
      }));
  }, [leads]);

  // ── Performance por vendedor ─────────────────────────────────────────────
  const sellerPerf = useMemo(() => {
    const byOwner = new Map();
    for (const l of leads) {
      if (!l.owner) continue;
      const u = users?.find(u => u.id === l.owner);
      if (!u) continue;
      const key = u.id;
      if (!byOwner.has(key)) {
        byOwner.set(key, { name: (u.name || u.email || "—").split(" ")[0], aberto: 0, ganho: 0, ganhoValor: 0 });
      }
      const row = byOwner.get(key);
      if (l.stage === "ganho") { row.ganho++; row.ganhoValor += l.value || 0; }
      else if (l.stage !== "perdido") row.aberto++;
    }
    return Array.from(byOwner.values()).sort((a, b) => b.ganhoValor - a.ganhoValor).slice(0, 8);
  }, [leads, users]);

  // ── Receita por mês ──────────────────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const m = new Map();
    for (const l of leads) {
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
  }, [leads]);

  // ── Distribuição do pipeline ─────────────────────────────────────────────
  const pipelineDistribution = useMemo(() => {
    const counts = { aberto: 0, ganho: 0, perdido: 0 };
    for (const l of leads) {
      if (l.stage === "ganho") counts.ganho++;
      else if (l.stage === "perdido") counts.perdido++;
      else counts.aberto++;
    }
    return [
      { name: "Em aberto", value: counts.aberto, fill: "#3B82F6" },
      { name: "Ganhos",    value: counts.ganho,  fill: "#1A6E35" },
      { name: "Perdidos",  value: counts.perdido, fill: "#B91C1C" },
    ].filter(r => r.value > 0);
  }, [leads]);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Pipeline por empresa" subtitle="Valor total e forecast ponderado">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pipelineByCompany} margin={{ top: 16, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatK} />
              <Tooltip formatter={(v) => formatK(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="valor"    name="Pipeline" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="forecast" name="Forecast" fill="#10B981" radius={[6, 6, 0, 0]} />
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
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "var(--text)" }} />
                {funnelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

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
                <LabelList dataKey="valor" position="right" formatter={(v) => formatK(v)} style={{ fontSize: 10, fill: "var(--text)" }} />
                {topLeads.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

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
                <Bar dataKey="aberto" name="Em aberto" stackId="a" fill="#93C5FD" />
                <Bar dataKey="ganho"  name="Ganhos"    stackId="a" fill="#1A6E35" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Receita por mês" subtitle="Fechamentos mensais (últimos 12 meses)">
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

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-2">
        <div className="text-sm font-bold" style={{ color: "var(--text)" }}>{title}</div>
        {subtitle && (
          <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-12 text-xs italic" style={{ color: "var(--text-dim)" }}>
      Sem dados para esse período.
    </div>
  );
}

export default ExecutiveCharts;
