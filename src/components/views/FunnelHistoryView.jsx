import React, { useMemo, useState } from "react";
import { History, Repeat2, RefreshCw } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES, WON_STAGES } from "../../constants/pipelines";
import { Select } from "../ui/Select";
import { useUsersById } from "../../hooks/use-users-by-id";
import { useLeadHistory, snapshotStagesAt } from "../../hooks/use-lead-history";

const STAGE_BY_ID = new Map(DEFAULT_PIPELINE_STAGES.map(s => [s.id, s]));

const MS_DAY = 86_400_000;
const MS_WEEK = 7 * MS_DAY;

// ── Helpers ────────────────────────────────────────────────────────────────
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function startOfMonth(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function buildSnapshotTimestamps(start, end, granularity) {
  const ts = [];
  if (granularity === "monthly") {
    let cur = startOfMonth(start);
    const last = startOfMonth(end);
    while (cur.getTime() <= last.getTime()) {
      ts.push(cur.getTime());
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  } else {
    let cur = startOfWeek(start);
    const last = startOfWeek(end);
    while (cur.getTime() <= last.getTime()) {
      ts.push(cur.getTime());
      cur = new Date(cur.getTime() + MS_WEEK);
    }
  }
  return ts;
}

function formatTimestampLabel(ts, granularity) {
  const d = new Date(ts);
  if (granularity === "monthly") {
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function countRecycles(history) {
  if (!history || history.length === 0) return 0;
  const order = new Map(DEFAULT_PIPELINE_STAGES.map((s, i) => [s.id, i]));
  let recycles = 0;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].toStage;
    const curr = history[i].toStage;
    const a = order.get(prev), b = order.get(curr);
    if (a == null || b == null) continue;
    if (curr === "perdido") continue;
    if (b < a) recycles++;
  }
  return recycles;
}

// ── Cell ───────────────────────────────────────────────────────────────────
function StageCell({ stageId, isFirst, isPrevSame }) {
  if (!stageId) {
    return (
      <td
        className="text-center align-middle font-mono text-[11px]"
        style={{ color: "var(--border-strong)", borderRight: "1px solid var(--border)", width: 38, padding: "6px 4px" }}
      >
        —
      </td>
    );
  }
  const s = STAGE_BY_ID.get(stageId);
  if (!s) return null;
  const newPhase = isFirst || !isPrevSame;
  return (
    <td
      className="text-center align-middle font-mono text-[11px] font-bold"
      style={{
        background: newPhase ? s.color : s.color + "30",
        color: newPhase ? "#FFFFFF" : s.color,
        borderRight: "1px solid var(--border)",
        width: 38,
        padding: "6px 4px",
      }}
      title={`${s.code ? s.code + " · " : ""}${s.name}`}
    >
      {s.code || s.name.slice(0, 1)}
    </td>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────
export function FunnelHistoryView({ user, activeCompany, leads, users }) {
  const isGroupView = activeCompany === "all";
  const isManager = user.role === "gerente" || user.role === "admin";
  const usersById = useUsersById(users);

  const [granularity, setGranularity] = useState("weekly");
  const [windowWeeks, setWindowWeeks] = useState(12);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  const { byLead, loading, error, refetch } = useLeadHistory({ enabled: true });

  const scopedLeads = useMemo(() => {
    let s = leads;
    if (!isGroupView) s = s.filter(l => l.companyId === activeCompany);
    if (!isManager) s = s.filter(l => l.owner === user.id);
    if (ownerFilter !== "all") s = s.filter(l => l.owner === ownerFilter);
    return s;
  }, [leads, activeCompany, isGroupView, isManager, user.id, ownerFilter]);

  const { snapshots, snapshotLabels } = useMemo(() => {
    const end = Date.now();
    const start = granularity === "monthly"
      ? new Date(end - windowWeeks * 7 * MS_DAY)
      : new Date(end - windowWeeks * MS_WEEK);
    const ts = buildSnapshotTimestamps(start, end, granularity);
    return {
      snapshots: ts,
      snapshotLabels: ts.map(t => formatTimestampLabel(t, granularity)),
    };
  }, [granularity, windowWeeks]);

  const rows = useMemo(() => {
    return scopedLeads
      .map(lead => {
        const hist = byLead.get(lead.id) || [];
        const series = snapshotStagesAt(hist, snapshots);
        const recycles = countRecycles(hist);
        const everWon = hist.some(h => WON_STAGES.has(h.toStage));
        const last = hist[hist.length - 1] || null;
        return { lead, hist, series, recycles, everWon, last };
      })
      .filter(r => {
        if (classFilter === "active") return r.lead.stage !== "perdido" && r.lead.stage !== "fechado";
        if (classFilter === "recycled") return r.recycles > 0;
        if (classFilter === "won") return r.everWon;
        if (classFilter === "lost") return r.lead.stage === "perdido";
        return true;
      })
      .sort((a, b) => {
        const ta = a.last ? new Date(a.last.changedAt).getTime() : 0;
        const tb = b.last ? new Date(b.last.changedAt).getTime() : 0;
        return tb - ta;
      });
  }, [scopedLeads, byLead, snapshots, classFilter]);

  const ownerOptions = useMemo(() => {
    const ids = Array.from(new Set(leads.map(l => l.owner).filter(Boolean)));
    return [
      { value: "all", label: "Todos os vendedores" },
      ...ids.map(id => ({ value: id, label: usersById.get(id)?.name || id })),
    ];
  }, [leads, usersById]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History size={22} style={{ color: "var(--text)" }} />
            <h1
              className="font-bold leading-tight"
              style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              Histórico do Funil
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            Movimentação dos clientes pelas etapas ao longo do tempo.
            Clientes que regressaram a uma etapa anterior aparecem marcados como{" "}
            <span style={{ color: NEUTRAL.amber, fontWeight: 600 }}>reciclados</span>.
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-opacity"
          style={{
            borderColor: "var(--border-strong)",
            color: "var(--text-dim)",
            background: "var(--surface)",
            opacity: loading ? 0.5 : 1,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={granularity}
          onChange={e => setGranularity(e.target.value)}
          options={[
            { value: "weekly", label: "Semanal" },
            { value: "monthly", label: "Mensal" },
          ]}
          className="w-32"
        />
        <Select
          value={String(windowWeeks)}
          onChange={e => setWindowWeeks(Number(e.target.value))}
          options={[
            { value: "8",  label: "Últimas 8 semanas" },
            { value: "12", label: "Últimas 12 semanas" },
            { value: "24", label: "Últimas 24 semanas" },
            { value: "52", label: "Último ano" },
          ]}
          className="w-44"
        />
        {isManager && (
          <Select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            options={ownerOptions}
            className="w-56"
          />
        )}
        <Select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          options={[
            { value: "all",      label: "Todos os clientes" },
            { value: "active",   label: "Apenas ativos" },
            { value: "recycled", label: "Apenas reciclados" },
            { value: "won",      label: "Ao menos 1 fechamento" },
            { value: "lost",     label: "Apenas perdidos" },
          ]}
          className="w-56"
        />
      </div>

      {/* Legenda */}
      <div
        className="flex items-center gap-3 flex-wrap p-3 rounded-xl border text-xs"
        style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-dim)" }}
      >
        {DEFAULT_PIPELINE_STAGES.map(s => (
          <div key={s.id} className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-lg text-[10px] font-bold"
              style={{ background: s.color, color: "#FFFFFF" }}
            >
              {s.code}
            </span>
            <span>{s.name}</span>
          </div>
        ))}
      </div>

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}
        >
          Erro ao carregar histórico: {error.message || String(error)}
        </div>
      )}

      {!error && (
        <div
          className="rounded-xl border overflow-x-auto"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <table className="text-xs" style={{ minWidth: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
                <th
                  className="text-left px-3 py-2.5 sticky left-0 z-10"
                  style={{
                    color: "var(--text-dim)",
                    background: "var(--surface-alt)",
                    fontWeight: 600,
                    minWidth: 240,
                  }}
                >
                  Cliente
                </th>
                {isGroupView && (
                  <th
                    className="text-left px-2 py-2.5"
                    style={{ color: "var(--text-dim)", fontWeight: 600, minWidth: 100 }}
                  >
                    Empresa
                  </th>
                )}
                <th
                  className="text-left px-2 py-2.5"
                  style={{ color: "var(--text-dim)", fontWeight: 600, minWidth: 120 }}
                >
                  Vendedor
                </th>
                <th
                  className="text-center px-2 py-2.5"
                  style={{ color: "var(--text-dim)", fontWeight: 600, width: 60 }}
                  title="Quantas vezes o cliente regrediu para uma etapa anterior do funil"
                >
                  Ciclos
                </th>
                {snapshotLabels.map((lbl, i) => (
                  <th
                    key={i}
                    className="text-center px-1 py-2.5 font-mono"
                    style={{
                      color: "var(--text-dim)",
                      fontWeight: 600,
                      width: 38,
                      borderLeft: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {lbl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4 + snapshotLabels.length + (isGroupView ? 1 : 0)}
                    className="text-center py-10 text-xs"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Nenhum cliente no escopo selecionado.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={4 + snapshotLabels.length + (isGroupView ? 1 : 0)}
                    className="text-center py-10 text-xs"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Carregando histórico…
                  </td>
                </tr>
              )}
              {rows.map(({ lead, series, recycles }) => {
                const ownerName = lead.owner
                  ? (usersById.get(lead.owner)?.name?.split(" ").slice(0, 2).join(" ") || "—")
                  : "—";
                const companyMeta = COMPANIES[lead.companyId];
                return (
                  <tr
                    key={lead.id}
                    className="border-b"
                    style={{ borderColor: "var(--border)", transition: "background 100ms" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#F9F9F8"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                  >
                    <td
                      className="px-3 py-2 sticky left-0"
                      style={{ background: "inherit", minWidth: 240 }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: "var(--text)" }}>
                          {lead.company}
                        </span>
                        {recycles > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "#FEF3EC", color: NEUTRAL.amber }}
                            title={`${recycles} reciclagem${recycles > 1 ? "s" : ""}`}
                          >
                            <Repeat2 size={10} />
                            ×{recycles}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                        {lead.city || "—"} · {lead.skuName || lead.sku || "—"}
                      </div>
                    </td>
                    {isGroupView && (
                      <td className="px-2 py-2" style={{ color: "var(--text)" }}>
                        {companyMeta ? (
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-1.5"
                            style={{ background: companyMeta.primary, verticalAlign: "middle" }}
                          />
                        ) : null}
                        {companyMeta?.short || lead.companyId}
                      </td>
                    )}
                    <td className="px-2 py-2" style={{ color: "var(--text-dim)" }}>
                      {ownerName}
                    </td>
                    <td
                      className="text-center px-2 py-2 font-mono font-bold"
                      style={{ color: recycles > 0 ? NEUTRAL.amber : "var(--border-strong)" }}
                    >
                      {recycles}
                    </td>
                    {series.map((stageId, i) => (
                      <StageCell
                        key={i}
                        stageId={stageId}
                        isFirst={i === 0}
                        isPrevSame={i > 0 && series[i - 1] === stageId}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="p-3 rounded-xl text-xs"
        style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}
      >
        <span className="font-semibold">Como ler:</span> a sigla mostra a etapa do cliente em cada{" "}
        {granularity === "monthly" ? "mês" : "semana"}.
        Células saturadas indicam o início de uma nova fase. Clientes com{" "}
        <Repeat2 size={10} className="inline" /> têm reciclagens — voltaram para uma etapa anterior do funil.
      </div>
    </div>
  );
}

export default FunnelHistoryView;
