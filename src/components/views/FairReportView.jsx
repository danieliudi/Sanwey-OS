import React, { useMemo, useState } from "react";
import { Tent, TrendingUp, TrendingDown, Info } from "lucide-react";
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

// Relatório de feiras — fase 2 do mockup de Feiras e Budget (10/08/2026).
// A pergunta que esta tela existe pra responder é "vale a pena continuar indo
// nessa feira?", e a resposta só é confiável comparando edições na MESMA
// IDADE — ver o comentário de topo de utils/fair-report.js.

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

function FairCard({ metrics, comparison, onSelect, selected }) {
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
          <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {c.name}
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

export function FairReportView({ campaigns = [], leads = [], user, activeCompany }) {
  const [selectedId, setSelectedId] = useState(null);
  // Custo da feira vem das despesas ligadas à campanha — vínculo que já
  // existia antes desta entrega (marketing_expenses.campaign_id).
  const { expenses } = useMarketingExpenses({ userId: user?.id, role: user?.role });

  // Feira = campanha de canal "Evento".
  const fairs = useMemo(() => {
    let list = (campaigns || []).filter(c => c.channel === "Evento");
    if (activeCompany && activeCompany !== "all") {
      list = list.filter(c => !c.companyIds?.length || c.companyIds.includes(activeCompany));
    }
    return list;
  }, [campaigns, activeCompany]);

  const metrics = useMemo(
    () => computeAllFairMetrics({
      campaigns: fairs,
      leads,
      expenses,
      wonStages: WON_STAGES,
      lostStages: LOST_STAGES,
    }),
    [fairs, leads, expenses]
  );

  // Comparação com a edição anterior da MESMA feira.
  //
  // A primeira versão casava pela primeira palavra do nome — e "Feira
  // Intermodal 2026" casaria com "Feira Logística 2025", porque as duas
  // começam com "Feira". Comparar feiras diferentes entre si é pior que não
  // comparar. Agora: tira o ano, tira acento, ignora palavras genéricas de
  // prefixo, e exige que o resto bata inteiro. Sem par claro, não compara.
  const comparisons = useMemo(() => {
    const GENERIC = new Set(["feira", "expo", "exposicao", "congresso", "salao", "evento", "encontro", "summit", "forum"]);
    const norm = (n) => (n || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")   // tira acento: "Logística" = "Logistica"
      .replace(/\b(19|20)\d{2}\b/g, " ")                   // tira o ano da edição
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w && !GENERIC.has(w))
      .join(" ")
      .trim();

    const byId = {};
    for (const m of metrics) {
      const key = norm(m.campaign.name);
      if (!key) continue; // nome só com palavra genérica — não dá pra parear com segurança
      const start = fairStartTime(m.campaign);
      // Candidatas: mesma feira, mais antigas, e com data (sem data não dá pra
      // cortar na mesma idade). Pega a mais recente entre elas.
      const candidates = metrics
        .filter(o => o.campaign.id !== m.campaign.id
          && norm(o.campaign.name) === key
          && fairStartTime(o.campaign) != null
          && (fairStartTime(o.campaign) ?? 0) < (start ?? 0))
        .sort((a, b) => (fairStartTime(b.campaign) ?? 0) - (fairStartTime(a.campaign) ?? 0));

      for (const prev of candidates) {
        const cmp = compareAtSameAge({
          current: m.campaign,
          previous: prev.campaign,
          leads,
          expenses,
          wonStages: WON_STAGES,
          lostStages: LOST_STAGES,
        });
        if (cmp) { byId[m.campaign.id] = cmp; break; } // tenta a próxima se esta não deu
      }
    }
    return byId;
  }, [metrics, leads, expenses]);

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

  // Leads de feira sem campanha indicada — ficam fora de todo número acima.
  // Filtrado pela mesma empresa das feiras exibidas, senão com "Resibag" ativa
  // o aviso somaria leads da Sanwey.
  const unlinked = useMemo(
    () => (leads || []).filter(l =>
      l.trigger === "feira"
      && !l.campaignId
      && (!activeCompany || activeCompany === "all" || l.companyId === activeCompany)
    ).length,
    [leads, activeCompany]
  );

  // Escopo de leitura. A RLS de `leads` dá visão completa a admin, gerente e
  // diretoria; vendedor só enxerga os próprios (ou de
  // subordinados). Quem cai no segundo caso vê números REAIS mas PARCIAIS —
  // e sem aviso isso é pior que ver zero, porque parece o total da empresa.
  // Hoje todo perfil de marketing também carrega vendedor, então
  // esse caso não é hipotético.
  const roleList = user?.roles?.length ? user.roles : [user?.role].filter(Boolean);
  const hasFullLeadScope = roleList.some(r => ["admin", "gerente", "diretoria"].includes(r));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Tent}
        title="Relatório de Feiras"
        subtitle="Custo, leads e retorno de cada feira — comparados na mesma idade"
      />

      {fairs.length === 0 ? (
        <EmptyState
          icon={Tent}
          title="Nenhuma feira cadastrada"
          description="Feira é uma campanha de canal “Evento”. Cadastre a feira em Campanhas e importe a lista de contatos pra ela aparecer aqui."
        />
      ) : (
        <>
          <StatCardGrid desktopClassName="md:grid-cols-4">
            <StatCard icon={Tent} value={metrics.length} label="Feiras" />
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
                  parciais — o custo da feira é o total, mas o resultado é só a
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
                <b>{unlinked} {unlinked === 1 ? "negócio veio" : "negócios vieram"} de feira sem indicar qual.</b>{" "}
                <span style={{ color: "var(--text-dim)" }}>
                  Eles não entram em nenhum número desta tela. Dá pra indicar a
                  feira no próprio negócio, no campo “Veio de qual feira/campanha?”.
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

export default FairReportView;
