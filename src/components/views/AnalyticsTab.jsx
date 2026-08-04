import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { formatK } from "../../utils/currency";
import { exportLeadsToCSV } from "../../utils/export-csv";

// ── Period helpers ────────────────────────────────────────────────────────────

function filterByPeriod(leads, period) {
  if (period === "all") return leads;
  const now = Date.now();
  let cutoff;
  if (period === "30d") cutoff = now - 30 * 86400000;
  else if (period === "60d") cutoff = now - 60 * 86400000;
  else if (period === "90d") cutoff = now - 90 * 86400000;
  else if (period === "ytd") cutoff = new Date(new Date().getFullYear(), 0, 1).getTime();
  return leads.filter(l => {
    const ts = new Date(l.stageChangedAt || l.createdAt).getTime();
    return !isNaN(ts) && ts >= cutoff;
  });
}

function getPreviousPeriodLeads(allLeads, period) {
  if (period === "all") return [];
  const now = Date.now();
  let start, end;
  if (period === "30d") {
    end = now - 30 * 86400000;
    start = end - 30 * 86400000;
  } else if (period === "60d") {
    end = now - 60 * 86400000;
    start = end - 60 * 86400000;
  } else if (period === "90d") {
    end = now - 90 * 86400000;
    start = end - 90 * 86400000;
  } else if (period === "ytd") {
    const y = new Date().getFullYear();
    start = new Date(y - 1, 0, 1).getTime();
    end = new Date(y, 0, 1).getTime();
  }
  return allLeads.filter(l => {
    const ts = new Date(l.stageChangedAt || l.createdAt).getTime();
    return !isNaN(ts) && ts >= start && ts < end;
  });
}

function computeKpis(leads) {
  let pipeline = 0, wonValue = 0, wonCount = 0, lostCount = 0;
  let totalDays = 0, daysCount = 0;
  for (const l of leads) {
    if (l.stage === "ganho") {
      wonValue += l.value || 0;
      wonCount++;
      if (l.createdAt && l.stageChangedAt) {
        const days = (new Date(l.stageChangedAt) - new Date(l.createdAt)) / 86400000;
        if (days >= 0 && days <= 730) { totalDays += days; daysCount++; }
      }
    } else if (l.stage === "perdido") {
      lostCount++;
    } else {
      pipeline += l.value || 0;
    }
  }
  const decided = wonCount + lostCount;
  const winRate = decided > 0 ? Math.round((wonCount / decided) * 100) : 0;
  const avgTicket = wonCount > 0 ? wonValue / wonCount : 0;
  const avgCycle = daysCount > 0 ? Math.round(totalDays / daysCount) : null;
  return { pipeline, wonValue, wonCount, lostCount, winRate, avgTicket, avgCycle };
}

function pctDelta(curr, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const CLASS_COLORS = {
  "Classe A": "#16A34A",
  "Classe B": "#3B82F6",
  "Classe C": "#EAB308",
  "Classe D": "#9CA3AF",
  "Classe X": "#B91C1C",
  "Classe —": "var(--border)",
};

function winRateColor(rate) {
  if (rate >= 50) return "var(--color-resibag)";
  if (rate >= 25) return "var(--amber)";
  return "var(--color-industria)";
}

// ── AnalyticsTab ──────────────────────────────────────────────────────────────

export function AnalyticsTab({ allLeads, period, users }) {
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const usersById = useMemo(
    () => new Map((users || []).map(u => [u.id, u])),
    [users],
  );

  const currentLeads = useMemo(() => {
    let s = filterByPeriod(allLeads, period);
    if (companyFilter !== "all") s = s.filter(l => l.companyId === companyFilter);
    if (ownerFilter !== "all") s = s.filter(l => l.owner === ownerFilter);
    return s;
  }, [allLeads, period, ownerFilter, companyFilter]);

  const previousLeads = useMemo(() => {
    let s = getPreviousPeriodLeads(allLeads, period);
    if (companyFilter !== "all") s = s.filter(l => l.companyId === companyFilter);
    if (ownerFilter !== "all") s = s.filter(l => l.owner === ownerFilter);
    return s;
  }, [allLeads, period, ownerFilter, companyFilter]);

  const ownerOptions = useMemo(() => {
    const ids = [...new Set(allLeads.map(l => l.owner).filter(Boolean))];
    return ids
      .map(id => ({ value: id, label: usersById.get(id)?.name || id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allLeads, usersById]);

  // ── Comparative KPIs ──────────────────────────────────────────────────────
  const curr = useMemo(() => computeKpis(currentLeads), [currentLeads]);
  const prev = useMemo(() => computeKpis(previousLeads), [previousLeads]);
  const hasPrev = period !== "all" && previousLeads.length > 0;

  // ── Regional ──────────────────────────────────────────────────────────────
  const stateData = useMemo(() => {
    const m = new Map();
    for (const l of currentLeads) {
      const key = (l.state || "").trim().toUpperCase();
      if (!key) continue;
      const row = m.get(key) || { state: key, receita: 0, pipeline: 0 };
      if (l.stage === "ganho") row.receita += l.value || 0;
      else if (l.stage !== "perdido") row.pipeline += l.value || 0;
      m.set(key, row);
    }
    return Array.from(m.values())
      .sort((a, b) => (b.receita + b.pipeline) - (a.receita + a.pipeline))
      .slice(0, 12);
  }, [currentLeads]);

  const cityData = useMemo(() => {
    const m = new Map();
    for (const l of currentLeads) {
      const key = (l.city || "").trim();
      if (!key) continue;
      const row = m.get(key) || { city: key.slice(0, 22), pipeline: 0, receita: 0 };
      if (l.stage === "ganho") row.receita += l.value || 0;
      else if (l.stage !== "perdido") row.pipeline += l.value || 0;
      m.set(key, row);
    }
    return Array.from(m.values())
      .sort((a, b) => (b.receita + b.pipeline) - (a.receita + a.pipeline))
      .slice(0, 10);
  }, [currentLeads]);

  // ── Segment / Product ─────────────────────────────────────────────────────
  const sectorData = useMemo(() => {
    const m = new Map();
    for (const l of currentLeads) {
      const key = (l.sector || "Sem setor").slice(0, 32);
      const row = m.get(key) || { sector: key, receita: 0, pipeline: 0 };
      if (l.stage === "ganho") row.receita += l.value || 0;
      else if (l.stage !== "perdido") row.pipeline += l.value || 0;
      m.set(key, row);
    }
    return Array.from(m.values())
      .sort((a, b) => (b.receita + b.pipeline) - (a.receita + a.pipeline))
      .slice(0, 10);
  }, [currentLeads]);

  const skuData = useMemo(() => {
    const m = new Map();
    for (const l of currentLeads) {
      const key = (l.skuName || l.sku || "Sem produto").slice(0, 32);
      const row = m.get(key) || { sku: key, receita: 0, pipeline: 0 };
      if (l.stage === "ganho") row.receita += l.value || 0;
      else if (l.stage !== "perdido") row.pipeline += l.value || 0;
      m.set(key, row);
    }
    return Array.from(m.values())
      .sort((a, b) => (b.receita + b.pipeline) - (a.receita + a.pipeline))
      .slice(0, 10);
  }, [currentLeads]);

  const classData = useMemo(() => {
    const m = {};
    for (const l of currentLeads) {
      const k = `Classe ${l.clientClassification || "—"}`;
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [currentLeads]);

  const hasClassData = classData.some(d => d.label !== "Classe —");

  // ── Sellers ───────────────────────────────────────────────────────────────
  const sellerData = useMemo(() => {
    const m = new Map();
    for (const l of currentLeads) {
      if (!l.owner) continue;
      const u = usersById.get(l.owner);
      if (!m.has(l.owner)) {
        m.set(l.owner, {
          id: l.owner,
          name: u?.name || l.owner,
          total: 0, open: 0, won: 0, lost: 0,
          wonValue: 0, totalDays: 0, daysCount: 0,
        });
      }
      const row = m.get(l.owner);
      row.total++;
      if (l.stage === "ganho") {
        row.won++;
        row.wonValue += l.value || 0;
        if (l.createdAt && l.stageChangedAt) {
          const days = (new Date(l.stageChangedAt) - new Date(l.createdAt)) / 86400000;
          if (days >= 0 && days <= 730) { row.totalDays += days; row.daysCount++; }
        }
      } else if (l.stage === "perdido") {
        row.lost++;
      } else {
        row.open++;
      }
    }
    return Array.from(m.values())
      .map(r => ({
        ...r,
        firstName: r.name.split(" ")[0],
        winRate: (r.won + r.lost) > 0 ? Math.round((r.won / (r.won + r.lost)) * 100) : 0,
        avgTicket: r.won > 0 ? r.wonValue / r.won : 0,
        avgCycle: r.daysCount > 0 ? Math.round(r.totalDays / r.daysCount) : null,
      }))
      .sort((a, b) => b.wonValue - a.wonValue);
  }, [currentLeads, usersById]);

  // ─────────────────────────────────────────────────────────────────────────

  const selFilter = {
    borderColor: "var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 3,
    border: `1px solid var(--border)`,
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div className="space-y-5">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={selFilter}>
          <option value="all">Todas as empresas</option>
          {COMPANY_IDS.map(id => (
            <option key={id} value={id}>{COMPANIES[id]?.name || id}</option>
          ))}
        </select>

        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={selFilter}>
          <option value="all">Todos os vendedores</option>
          {ownerOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="flex-1 min-w-0" />

        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
          {currentLeads.length} lead{currentLeads.length !== 1 ? "s" : ""}
        </span>

        <button
          onClick={() => exportLeadsToCSV(currentLeads, { usersById, filename: `sanwey-relatorio-${new Date().toISOString().slice(0, 10)}.csv` })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border cursor-pointer transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
          title="Baixar todos os leads filtrados em CSV (abre no Excel)"
        >
          <Download size={12} />
          Exportar CSV
        </button>
      </div>

      {/* ── Comparativo de período ── */}
      {hasPrev && (
        <section>
          <SectionTitle>Comparativo de período</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <CompareCard label="Funil de Vendas" curr={curr.pipeline} prev={prev.pipeline} fmt={formatK} />
            <CompareCard label="Receita realizada" curr={curr.wonValue} prev={prev.wonValue} fmt={formatK} />
            <CompareCard label="Win rate" curr={curr.winRate} prev={prev.winRate} fmt={v => `${v}%`} />
            <CompareCard label="Ticket médio" curr={curr.avgTicket} prev={prev.avgTicket} fmt={formatK} />
          </div>
        </section>
      )}

      {/* ── Regional ── */}
      <section>
        <SectionTitle>Regional</SectionTitle>
        <div className="grid lg:grid-cols-2 gap-4 mt-3">
          <ChartCard
            title="Receita + funil de vendas por estado"
            subtitle="Valor acumulado por UF (top 12)"
          >
            {stateData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={Math.max(180, stateData.length * 28 + 50)}>
                <BarChart data={stateData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatK} />
                  <YAxis dataKey="state" type="category" tick={{ fontSize: 11 }} width={28} />
                  <Tooltip formatter={v => formatK(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receita" name="Receita" stackId="a" fill="var(--color-resibag)" />
                  <Bar dataKey="pipeline" name="Funil de Vendas" stackId="a" fill="#3B82F6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Receita + funil de vendas por cidade"
            subtitle="Top 10 cidades"
          >
            {cityData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={Math.max(180, cityData.length * 28 + 50)}>
                <BarChart data={cityData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatK} />
                  <YAxis dataKey="city" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={v => formatK(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receita" name="Receita" stackId="a" fill="var(--color-resibag)" />
                  <Bar dataKey="pipeline" name="Funil de Vendas" stackId="a" fill="#6366F1" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </section>

      {/* ── Segmento e produto ── */}
      <section>
        <SectionTitle>Segmento e produto</SectionTitle>
        <div className="grid lg:grid-cols-2 gap-4 mt-3">
          <ChartCard
            title="Receita por setor"
            subtitle="Top 10 setores · receita realizada + funil de vendas em aberto"
          >
            {sectorData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={Math.max(180, sectorData.length * 28 + 50)}>
                <BarChart data={sectorData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatK} />
                  <YAxis dataKey="sector" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={v => formatK(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receita" name="Receita" stackId="a" fill="var(--color-resibag)" />
                  <Bar dataKey="pipeline" name="Funil de Vendas" stackId="a" fill="#93C5FD" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Receita por produto (SKU)"
            subtitle="Top 10 produtos"
          >
            {skuData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={Math.max(180, skuData.length * 28 + 50)}>
                <BarChart data={skuData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatK} />
                  <YAxis dataKey="sku" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={v => formatK(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receita" name="Receita" stackId="a" fill="#8B5CF6" />
                  <Bar dataKey="pipeline" name="Funil de Vendas" stackId="a" fill="#C4B5FD" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {hasClassData && (
          <div className="mt-4">
            <ChartCard
              title="Classificação de clientes na carteira"
              subtitle="Distribuição A/B/C/D/X nos leads do período"
            >
              <div className="flex flex-wrap gap-4 py-2">
                {classData.map(d => (
                  <div key={d.label} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded shrink-0"
                      style={{ background: CLASS_COLORS[d.label] || "var(--text-dim)" }}
                    />
                    <span className="text-sm" style={{ color: "var(--text)" }}>{d.label}</span>
                    <span
                      className="text-sm font-bold"
                      style={{
                        fontFamily: "'Barlow Condensed', Inter, sans-serif",
                        color: CLASS_COLORS[d.label] || "var(--text)",
                      }}
                    >
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        )}
      </section>

      {/* ── Vendedores ── */}
      <section>
        <SectionTitle>Vendedores</SectionTitle>

        {sellerData.length === 0 ? (
          <div
            className="mt-3 rounded-xl border p-8 text-center text-xs italic"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-dim)" }}
          >
            Sem dados de vendedores para esse período.
          </div>
        ) : (
          <div className="space-y-4 mt-3">
            <ChartCard title="Win rate por vendedor" subtitle="Taxa de conversão: ganhos ÷ (ganhos + perdidos)">
              <ResponsiveContainer width="100%" height={Math.max(160, sellerData.length * 32 + 50)}>
                <BarChart
                  data={sellerData}
                  layout="vertical"
                  margin={{ top: 4, right: 52, left: 4, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <YAxis dataKey="firstName" type="category" tick={{ fontSize: 11 }} width={72} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Bar dataKey="winRate" name="Win rate" radius={[0, 3, 3, 0]}>
                    <LabelList
                      dataKey="winRate"
                      position="right"
                      formatter={v => `${v}%`}
                      style={{ fontSize: 10, fill: "var(--text-dim)" }}
                    />
                    {sellerData.map((d, i) => (
                      <Cell key={i} fill={winRateColor(d.winRate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="text-sm font-bold" style={{ color: "var(--text)" }}>
                  Desempenho completo por vendedor
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                  Ciclo médio calculado sobre leads ganhos com data de fechamento registrada
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ fontSize: 12 }}>
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      {[
                        ["Vendedor", "left", "pl-5 pr-3"],
                        ["Leads", "right", "px-3"],
                        ["Aberto", "right", "px-3"],
                        ["Ganhos", "right", "px-3"],
                        ["Perdidos", "right", "px-3"],
                        ["Win rate", "right", "px-3"],
                        ["Receita", "right", "px-3"],
                        ["Ticket médio", "right", "px-3"],
                        ["Ciclo médio", "right", "pl-3 pr-5"],
                      ].map(([h, align, cls]) => (
                        <th
                          key={h}
                          className={`py-2.5 font-semibold text-${align} ${cls} whitespace-nowrap`}
                          style={{ color: "var(--text-dim)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sellerData.map(r => (
                      <tr
                        key={r.id}
                        className="border-b transition-colors"
                        style={{ borderColor: "var(--border)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <td className="py-3 pl-5 pr-3 font-medium" style={{ color: "var(--text)" }}>
                          {r.name.split(" ").slice(0, 2).join(" ")}
                        </td>
                        <td className="py-3 px-3 text-right font-mono" style={{ color: "var(--text)" }}>{r.total}</td>
                        <td className="py-3 px-3 text-right font-mono" style={{ color: "#3B82F6" }}>{r.open}</td>
                        <td className="py-3 px-3 text-right font-mono" style={{ color: "var(--color-resibag)" }}>{r.won}</td>
                        <td className="py-3 px-3 text-right font-mono" style={{ color: "var(--color-industria)" }}>{r.lost}</td>
                        <td
                          className="py-3 px-3 text-right font-mono font-semibold"
                          style={{ color: winRateColor(r.winRate) }}
                        >
                          {r.winRate}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono" style={{ color: "var(--text)" }}>
                          {formatK(r.wonValue)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono" style={{ color: "var(--text)" }}>
                          {r.avgTicket > 0 ? formatK(r.avgTicket) : "—"}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right font-mono" style={{ color: "var(--text-dim)" }}>
                          {r.avgCycle !== null ? `${r.avgCycle}d` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CompareCard({ label, curr, prev, fmt }) {
  const d = pctDelta(curr, prev);
  const Icon = d === null ? Minus : d > 0 ? TrendingUp : TrendingDown;
  const color = d === null ? "var(--text-dim)" : d > 0 ? "var(--color-resibag)" : "var(--color-industria)";
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
      <div
        className="leading-none mb-2"
        style={{
          fontFamily: "'Barlow Condensed', Inter, sans-serif",
          fontWeight: 900,
          fontSize: 28,
          color: "var(--text)",
        }}
      >
        {fmt(curr)}
      </div>
      <div className="flex items-center gap-1 text-xs">
        <Icon size={12} style={{ color, flexShrink: 0 }} />
        {d !== null ? (
          <span style={{ color }}>
            {d > 0 ? "+" : ""}{d}% vs período anterior
          </span>
        ) : (
          <span style={{ color: "var(--text-dim)" }}>
            {fmt(prev)} período anterior
          </span>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs font-bold uppercase shrink-0"
        style={{ color: "var(--text-dim)", letterSpacing: "0.1em" }}
      >
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-3">
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
    <div
      className="flex items-center justify-center py-10 text-xs italic"
      style={{ color: "var(--text-dim)" }}
    >
      Sem dados para esse período e filtros.
    </div>
  );
}

export default AnalyticsTab;
