import React, { useMemo, useState } from "react";
import { Tent, TrendingUp, TrendingDown, Info, Newspaper } from "lucide-react";
import { PageHeader } from "../shared/PageHeader";
import { StatCard } from "../ui/StatCard";
import { StatCardGrid } from "../shared/StatCardGrid";
import { EmptyState } from "../ui/EmptyState";
import { formatBRL, formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";
import { WON_STAGES } from "../../constants/pipelines";
import { useMarketingExpenses } from "../../hooks/use-marketing-expenses";
import {
  computeAllFairMetrics,
  compareAtSameAge,
  deltaPct,
  fairStartTime,
} from "../../utils/fair-report";
import { contentCampaignPairKey } from "../../utils/campaign-name";

// Relatório de origem por campanha — motor = computeFairMetrics (fair-report.js).
// Feiras (canal Evento) e Conteúdo/Digital compartilham esta tela; o filtro de
// canal e a chave de pareamento mudam, o cálculo não. Ver PRD rastreio Fase 2.

const LOST_STAGES = ["perdido"];

function pct(v) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function DeltaBadge({ value, invert = false }) {
  if (value == null) return null;
  // `invert` para métricas em que menor é melhor (CAC, custo por lead).
  const good = invert ? value < 0 : value > 0;
  const neutral = Math.abs(value) < 0.005;
  const color = neutral ? "var(--text-faint)" : good ? "var(--success)" : "var(--danger)";
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1" style={{ color, fontSize: 11, fontWeight: 700 }}>
      {!neutral && <Icon size={12} />}
      {value > 0 ? "+" : ""}{Math.round(value * 100)}%
    </span>
  );
}

function MetricCell({ label, value, delta, invertDelta }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-faint)" }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5" style={{ marginTop: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
        <DeltaBadge value={delta} invert={invertDelta} />
      </div>
    </div>
  );
}

function FairCard({ metrics, comparison, onSelect, selected, showChannelBadge }) {
  const { campaign: c } = metrics;
  const start = fairStartTime(c);
  const cmp = comparison;

  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      className="w-full text-left rounded-xl border p-4 transition-all"
      style={{
        borderColor: selected ? "var(--accent)" : "var(--border)",
        background: selected ? "color-mix(in srgb, var(--accent) 6%, var(--surface))" : "var(--surface)",
        cursor: "pointer",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              {c.name}
            </div>
            {showChannelBadge && c.channel && (
              <span
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
              >
                {c.channel}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            {start ? formatDateBR(new Date(start).toISOString()) : "sem data"}
            {metrics.ageDays != null && ` · há ${metrics.ageDays} dias`}
          </div>
        </div>
        {metrics.cost > 0 && (
          <div className="text-right shrink-0">
            <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Custo</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{formatK(metrics.cost)}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCell label="Leads" value={metrics.leadCount} delta={cmp && deltaPct(cmp.current.leadCount, cmp.previous.leadCount)} />
        <MetricCell label="Ganhos" value={metrics.wonCount} delta={cmp && deltaPct(cmp.current.wonCount, cmp.previous.wonCount)} />
        <MetricCell label="CAC" value={metrics.cac == null ? "—" : formatK(metrics.cac)} delta={cmp && deltaPct(cmp.current.cac, cmp.previous.cac)} invertDelta />
        <MetricCell label="Retorno" value={metrics.roi == null ? "—" : `${metrics.roi.toFixed(1)}x`} delta={cmp && deltaPct(cmp.current.roi, cmp.previous.roi)} />
      </div>

      {cmp && (
        <div className="mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border)", fontSize: 11, color: "var(--text-faint)" }}>
          {cmp.fair ? (
            <>Comparado com <b style={{ color: "var(--text-dim)" }}>{cmp.previous.campaign.name}</b> na mesma idade ({cmp.windowDays} dias)</>
          ) : (
            <span style={{ color: "var(--warning)" }}>
              A edição anterior é mais recente que esta — comparação omitida pra não inverter a leitura.
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/** Pareamento de feiras: tira ano, acento e palavras genéricas (legado Evento). */
function fairPairKey(name) {
  const GENERIC = new Set(["feira", "expo", "exposicao", "congresso", "salao", "evento", "encontro", "summit", "forum"]);
  const key = (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w && !GENERIC.has(w))
    .join(" ")
    .trim();
  return key || null;
}

const FAIR_COPY = {
  channels: ["Evento"],
  title: "Relatório de Feiras",
  subtitle: "Custo, leads e retorno de cada feira — comparados na mesma idade",
  icon: Tent,
  emptyTitle: "Nenhuma feira cadastrada",
  emptyDescription: "Feira é uma campanha de canal “Evento”. Cadastre a feira em Campanhas e importe a lista de contatos pra ela aparecer aqui.",
  entityPlural: "Feiras",
  costScopeLabel: "feira",
  unlinkedNoun: { one: "negócio veio", many: "negócios vieram" },
  unlinkedOf: "feira",
  unlinkedField: "feira/campanha",
  pairKey: fairPairKey,
  showChannelBadge: false,
  unlinkedTrigger: "feira",
};

const CONTENT_COPY = {
  channels: ["Conteúdo", "Digital"],
  title: "Relatório de Conteúdo",
  subtitle: "Custo, leads e retorno de campanhas Conteúdo e Digital — comparados na mesma idade",
  icon: Newspaper,
  emptyTitle: "Nenhuma campanha de conteúdo",
  emptyDescription: "Campanha de canal “Conteúdo” ou “Digital”, no formato frente-aaaamm-tema. Cadastre em Campanhas e vincule o lead na criação pra aparecer aqui.",
  entityPlural: "Campanhas",
  costScopeLabel: "campanha",
  unlinkedNoun: { one: "negócio ficou", many: "negócios ficaram" },
  unlinkedOf: "conteúdo",
  unlinkedField: "campanha",
  pairKey: contentCampaignPairKey,
  showChannelBadge: true,
  // Sem trigger dedicado pra conteúdo (diferente de feira). Sem sinal
  // confiável, não inventamos o balde “origem não registrada” nesta tela —
  // leads sem campaign_id ficam de fora dos números e ponto (PRD §10).
  unlinkedTrigger: null,
};

/**
 * Relatório de origem por canal(is). Motor inalterado: computeFairMetrics /
 * compareAtSameAge. `variant` escolhe cópia e filtro; props soltas sobrescrevem.
 */
export function FairReportView({
  campaigns = [],
  leads = [],
  user,
  activeCompany,
  variant = "fair",
  ...overrides
}) {
  const copy = { ...(variant === "content" ? CONTENT_COPY : FAIR_COPY), ...overrides };
  const {
    channels,
    title,
    subtitle,
    icon: HeaderIcon,
    emptyTitle,
    emptyDescription,
    entityPlural,
    costScopeLabel,
    unlinkedNoun,
    unlinkedOf,
    unlinkedField,
    pairKey,
    showChannelBadge,
    unlinkedTrigger,
  } = copy;

  const [selectedId, setSelectedId] = useState(null);
  const { expenses } = useMarketingExpenses({ userId: user?.id, role: user?.role });

  // PRD §9: registro de teste (is_demo) não entra no relatório.
  const reportLeads = useMemo(
    () => (leads || []).filter(l => !l.isDemo && !l.is_demo),
    [leads]
  );

  const scoped = useMemo(() => {
    const channelSet = new Set(channels);
    let list = (campaigns || []).filter(c => channelSet.has(c.channel));
    if (activeCompany && activeCompany !== "all") {
      list = list.filter(c => !c.companyIds?.length || c.companyIds.includes(activeCompany));
    }
    return list;
  }, [campaigns, activeCompany, channels]);

  const metrics = useMemo(
    () => computeAllFairMetrics({
      campaigns: scoped,
      leads: reportLeads,
      expenses,
      wonStages: WON_STAGES,
      lostStages: LOST_STAGES,
    }),
    [scoped, reportLeads, expenses]
  );

  const comparisons = useMemo(() => {
    const byId = {};
    for (const m of metrics) {
      const key = pairKey(m.campaign.name);
      if (!key) continue;
      const start = fairStartTime(m.campaign);
      const candidates = metrics
        .filter(o => o.campaign.id !== m.campaign.id
          && pairKey(o.campaign.name) === key
          && fairStartTime(o.campaign) != null
          && (fairStartTime(o.campaign) ?? 0) < (start ?? 0))
        .sort((a, b) => (fairStartTime(b.campaign) ?? 0) - (fairStartTime(a.campaign) ?? 0));

      for (const prev of candidates) {
        const cmp = compareAtSameAge({
          current: m.campaign,
          previous: prev.campaign,
          leads: reportLeads,
          expenses,
          wonStages: WON_STAGES,
          lostStages: LOST_STAGES,
        });
        if (cmp) { byId[m.campaign.id] = cmp; break; }
      }
    }
    return byId;
  }, [metrics, reportLeads, expenses, pairKey]);

  const totals = useMemo(() => {
    const cost = metrics.reduce((s, m) => s + m.cost, 0);
    const leadCount = metrics.reduce((s, m) => s + m.leadCount, 0);
    const wonCount = metrics.reduce((s, m) => s + m.wonCount, 0);
    const revenue = metrics.reduce((s, m) => s + m.revenue, 0);
    return {
      cost, leadCount, wonCount, revenue,
      cac: wonCount > 0 ? cost / wonCount : null,
      roi: cost > 0 ? revenue / cost : null,
    };
  }, [metrics]);

  const selected = metrics.find(m => m.campaign.id === selectedId) || null;

  const unlinked = useMemo(() => {
    if (!unlinkedTrigger) return 0;
    return reportLeads.filter(l =>
      l.trigger === unlinkedTrigger
      && !l.campaignId
      && (!activeCompany || activeCompany === "all" || l.companyId === activeCompany)
    ).length;
  }, [reportLeads, activeCompany, unlinkedTrigger]);

  const roleList = user?.roles?.length ? user.roles : [user?.role].filter(Boolean);
  const hasFullLeadScope = roleList.some(r => ["admin", "gerente", "diretoria"].includes(r));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={HeaderIcon}
        title={title}
        subtitle={subtitle}
      />

      {scoped.length === 0 ? (
        <EmptyState
          icon={HeaderIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <>
          <StatCardGrid desktopClassName="md:grid-cols-4">
            <StatCard icon={HeaderIcon} value={metrics.length} label={entityPlural} />
            <StatCard icon={TrendingUp} value={totals.leadCount} label="Leads captados" sublabel={`${totals.wonCount} viraram negócio`} />
            <StatCard icon={TrendingDown} value={totals.cac == null ? "—" : formatK(totals.cac)} label="CAC médio" sublabel="custo ÷ clientes conquistados" />
            <StatCard icon={TrendingUp} value={totals.roi == null ? "—" : `${totals.roi.toFixed(1)}x`} label="Retorno" sublabel={`${formatK(totals.revenue)} sobre ${formatK(totals.cost)}`} />
          </StatCardGrid>

          {!hasFullLeadScope && (
            <div className="rounded-lg px-4 py-3 flex items-start gap-2.5"
              style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }}>
              <Info size={15} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: "var(--text)" }}>
                <b>Você está vendo só os negócios sob sua responsabilidade.</b>{" "}
                <span style={{ color: "var(--text-dim)" }}>
                  Os números de leads, conversão, CAC e retorno desta tela são
                  parciais — o custo da {costScopeLabel} é o total, mas o resultado é só a
                  sua parte. Peça a visão completa a um gerente ou à diretoria.
                </span>
              </div>
            </div>
          )}

          {unlinked > 0 && (
            <div className="rounded-lg px-4 py-3 flex items-start gap-2.5"
              style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }}>
              <Info size={15} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: "var(--text)" }}>
                <b>{unlinked} {unlinked === 1 ? unlinkedNoun.one : unlinkedNoun.many} de {unlinkedOf} sem indicar qual.</b>{" "}
                <span style={{ color: "var(--text-dim)" }}>
                  {unlinkedTrigger
                    ? <>Eles não entram em nenhum número desta tela. Dá pra indicar a {unlinkedField} no próprio negócio, no campo “Veio de qual {unlinkedField}?”.</>
                    : <>Sem campanha, caem no balde “origem não registrada” — nunca distribuímos entre campanhas. Indique a origem no negócio.</>
                  }
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {metrics.map(m => (
              <FairCard
                key={m.campaign.id}
                metrics={m}
                comparison={comparisons[m.campaign.id]}
                selected={selectedId === m.campaign.id}
                onSelect={id => setSelectedId(prev => (prev === id ? null : id))}
                showChannelBadge={showChannelBadge}
              />
            ))}
          </div>

          {selected && (
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                {selected.campaign.name} — detalhe
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <MetricCell label="Custo" value={selected.cost > 0 ? formatBRL(selected.cost) : "—"} />
                <MetricCell label="Leads" value={selected.leadCount} />
                <MetricCell label="Custo/lead" value={selected.costPerLead == null ? "—" : formatBRL(selected.costPerLead)} />
                <MetricCell label="Conversão" value={pct(selected.conversion)} />
                <MetricCell label="Em aberto" value={selected.openCount} />
                <MetricCell label="Receita" value={selected.revenue > 0 ? formatBRL(selected.revenue) : "—"} />
              </div>
              {selected.openCount > 0 && (
                <p className="mt-3" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                  {selected.openCount} {selected.openCount === 1 ? "negócio ainda está" : "negócios ainda estão"} em
                  aberto — a conversão considera só o que já foi decidido, então
                  esse número ainda pode melhorar.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Atalho Fase 2 — mesmo motor, filtro Conteúdo + Digital. */
export function ContentReportView(props) {
  return <FairReportView {...props} variant="content" />;
}

export default FairReportView;
