import React, { useMemo, useState } from "react";
import { Building2, Users, Gauge } from "lucide-react";
import { PageHeader } from "../shared/PageHeader";
import { StatCard } from "../ui/StatCard";
import { StatCardGrid } from "../shared/StatCardGrid";
import { EmptyState } from "../ui/EmptyState";
import { FilterBar } from "../shared/FilterBar";
import { HelpTooltip } from "../ui/HelpTooltip";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { formatK } from "../../utils/currency";
import { DEFAULT_PIPELINE_STAGES, WON_STAGES } from "../../constants/pipelines";
import { getLeadOwnerIds } from "../../utils/pipeline-metrics";
import { useClientContactCounts } from "../../hooks/use-client-contact-counts";
import {
  collapseLeadsToAccounts,
  accountMetrics,
  contentOriginLeads,
} from "../../utils/abm-accounts";

const LOST_STAGES = ["perdido"];
const STAGE_LABELS = Object.fromEntries(DEFAULT_PIPELINE_STAGES.map(s => [s.id, s.name]));

const OUTCOME = {
  won: { label: "Ganha", bg: "var(--success-bg)", color: "var(--success)" },
  open: { label: "Aberta", bg: "var(--warning-bg)", color: "var(--warning)" },
  lost: { label: "Perdida", bg: "var(--danger-bg)", color: "var(--danger)" },
};

function pct(v) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function thStyle(i, last) {
  return {
    fontSize: 10,
    fontWeight: 650,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    borderBottom: "1px solid var(--border)",
    padding: "10px 12px 8px 0",
    paddingLeft: i === 0 ? 14 : 0,
    textAlign: last ? "right" : "left",
    whiteSpace: "nowrap",
  };
}

export function AbmAccountsView({
  user,
  leads = [],
  campaigns = [],
  clients = [],
  users = [],
  activeCompany,
  onLeadClick,
  onOpenClient,
}) {
  const [search, setSearch] = useState("");
  const isGroupView = !activeCompany || activeCompany === "all";
  const userRoleList = user?.roles?.length ? user.roles : (user?.role ? [user.role] : []);
  const isManager = userRoleList.includes("gerente") || userRoleList.includes("admin") || userRoleList.includes("diretoria");

  const subordinateIds = useMemo(() => {
    if (user?.role !== "vendedor") return new Set();
    return new Set((users || []).filter(u => u.supervisorId === user.id).map(u => u.id));
  }, [users, user?.id, user?.role]);

  const scopedLeads = useMemo(() => {
    let list = contentOriginLeads(leads, campaigns);
    if (!isGroupView) list = list.filter(l => l.companyId === activeCompany);
    if (!isManager) {
      list = list.filter(l => getLeadOwnerIds(l).some(id => id === user.id || subordinateIds.has(id)));
    }
    return list;
  }, [leads, campaigns, activeCompany, isGroupView, isManager, user?.id, subordinateIds]);

  const accounts = useMemo(
    () => collapseLeadsToAccounts(scopedLeads, { wonStages: WON_STAGES, lostStages: LOST_STAGES }),
    [scopedLeads]
  );

  const clientIds = useMemo(() => accounts.map(a => a.clientId).filter(Boolean), [accounts]);
  const { counts: committeeCounts } = useClientContactCounts(clientIds);

  const clientsById = useMemo(() => {
    const m = new Map();
    for (const c of clients || []) m.set(c.id, c);
    return m;
  }, [clients]);

  const campaignsById = useMemo(() => {
    const m = new Map();
    for (const c of campaigns || []) m.set(c.id, c);
    return m;
  }, [campaigns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(a => {
      const clientName = a.clientId ? (clientsById.get(a.clientId)?.name || "") : "";
      const hay = `${a.name} ${clientName} ${a.cnpj || ""} ${a.sector || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, search, clientsById]);

  const totals = useMemo(() => accountMetrics(filtered), [filtered]);
  const withCommittee = filtered.filter(a => (committeeCounts[a.clientId]?.active || 0) > 0).length;

  const contentCampaigns = (campaigns || []).filter(c => c.channel === "Conteúdo" || c.channel === "Digital");

  return (
    <div className="space-y-5" data-tour="abm-tabela">
      <PageHeader
        icon={Building2}
        title="Contas · ABM"
        subtitle="Uma linha por empresa compradora — dois toques da mesma conta não contam como duas conversões"
      />

      {contentCampaigns.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma campanha de conteúdo"
          description="ABM lê leads ligados a campanha de canal Conteúdo ou Digital. Cadastre a campanha no formato frente-aaaamm-tema e vincule o lead na criação."
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma conta de conteúdo ainda"
          description="Quando um lead nascer com campanha de Conteúdo ou Digital, ele aparece aqui agrupado por cliente (ou CNPJ). Conversão zero é estado válido — a tela já está pronta."
        />
      ) : (
        <>
          <StatCardGrid desktopClassName="md:grid-cols-4">
            <StatCard icon={Building2} value={totals.accountCount} label="Contas" sublabel={`${totals.touchCount} toques`} />
            <StatCard icon={Users} value={pct(totals.accountConversion)} label="Conversão por conta" sublabel={`${totals.wonAccountCount} ganhas · ${totals.openAccountCount} abertas`} />
            <StatCard icon={Gauge} value={totals.avgFit} label="Fit médio" sublabel="fórmula do Funil de Vendas" tooltip="Pontuação determinística (segmento, valor, recência). Sem IA." />
            <StatCard icon={Users} value={withCommittee} label="Com comitê" sublabel="pelo menos 1 contato ativo" />
          </StatCardGrid>

          <FilterBar
            search={{
              value: search,
              onChange: e => setSearch(e.target.value),
              placeholder: "Buscar conta, CNPJ, setor…",
              dataTour: "abm-busca",
            }}
          />

          <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  {["Conta", "Fit", "Toques", "Comitê", "Etapa", "Origem", ""].map((h, i) => (
                    <th key={h + i} style={thStyle(i, i === 6)}>
                      {h === "Fit" ? (
                        <span className="inline-flex items-center gap-1">
                          Fit <HelpTooltip text="Mesma fórmula do card do Funil: segmento, valor e recência. Sem chamada de IA." />
                        </span>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs" style={{ color: "var(--text-dim)" }}>
                      Nenhuma conta no filtro atual.
                    </td>
                  </tr>
                ) : filtered.map(a => {
                  const client = a.clientId ? clientsById.get(a.clientId) : null;
                  const committee = a.clientId ? committeeCounts[a.clientId] : null;
                  const outcome = OUTCOME[a.outcome] || OUTCOME.open;
                  const originNames = a.campaignIds
                    .map(id => campaignsById.get(id)?.name)
                    .filter(Boolean);
                  return (
                    <tr key={a.key} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "11px 12px 11px 14px" }}>
                        <button
                          type="button"
                          onClick={() => a.representative && onLeadClick?.(a.representative)}
                          className="text-left"
                          style={{ background: "none", border: "none", padding: 0, cursor: onLeadClick ? "pointer" : "default" }}
                        >
                          <div className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>
                            {client?.name || a.name}
                          </div>
                          <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                            {a.sector || "sem setor"}
                            {a.cnpj ? ` · ${a.cnpj}` : ""}
                          </div>
                        </button>
                      </td>
                      <td style={{ padding: "11px 12px 11px 0" }}>
                        <FitScoreCircle score={a.fitScore} size={32} />
                      </td>
                      <td style={{ padding: "11px 12px 11px 0", fontSize: 13, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                        {a.touchCount}
                        {(a.valueOpen > 0 || a.valueWon > 0) && (
                          <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                            {a.valueWon > 0 ? formatK(a.valueWon) : formatK(a.valueOpen)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: "var(--text-dim)" }}>
                        {!a.clientId
                          ? "sem cliente vinculado"
                          : !committee
                            ? "—"
                            : committee.active > 0
                              ? `${committee.active} ativo${committee.active === 1 ? "" : "s"}`
                              : "sem contato ativo"}
                      </td>
                      <td style={{ padding: "11px 12px 11px 0" }}>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{ background: outcome.bg, color: outcome.color }}
                        >
                          {outcome.label}
                        </span>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                          {STAGE_LABELS[a.stage] || a.stage || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: "var(--text-dim)" }}>
                        {originNames.length ? originNames.join(" · ") : "—"}
                      </td>
                      <td style={{ padding: "11px 14px 11px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                        {a.clientId && onOpenClient && (
                          <button
                            type="button"
                            onClick={() => onOpenClient(a.clientId)}
                            className="text-[11px] font-bold px-2 py-1 rounded"
                            style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
                          >
                            Cliente
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default AbmAccountsView;
