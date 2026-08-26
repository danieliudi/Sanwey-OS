import React, { useMemo, useState } from "react";
import { Globe, TrendingUp, GitCompareArrows, Newspaper, Scale, Leaf, MapPin, Coins, ExternalLink, RefreshCcw } from "lucide-react";
import { Tabs } from "../shared/Tabs";
import { StatCard } from "../ui/StatCard";
import { StatCardGrid } from "../shared/StatCardGrid";
import { EmptyState } from "../ui/EmptyState";
import { InsightsView } from "./InsightsView";
import { useMarketIntelligence } from "../../hooks/use-market-intelligence";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { formatDateBR } from "../../utils/date";
import { formatK, formatBRL } from "../../utils/currency";

// Hub "Inteligência de Mercado" — decidido com o Daniel 19-20/08/2026: 3
// abas (Mercado/Insights/Cruzamento) dentro de UMA página, mesmo padrão do
// Painel Executivo (regra 9 do CLAUDE.md — área nova = aba nova, não tela
// nova solta). "Insights" NÃO é reimplementado aqui — é o InsightsView já
// existente, só realocado pra dentro deste hub (regra 1: nunca reimplementar
// o que já existe). Visibilidade: aba Mercado pra vendedor+gerência/
// marketing/admin (gate na rota, App.jsx); Insights/Cruzamento só gerência/
// admin (prop `canSeeDeepIntel`, também computada em App.jsx).

const CATEGORY_META = {
  visao_geral:      { label: "Visão geral",      icon: Globe },
  concorrencia:     { label: "Concorrência",      icon: Scale },
  regulatorio:      { label: "Regulatório",       icon: Newspaper },
  sustentabilidade: { label: "Sustentabilidade",  icon: Leaf },
  regional:         { label: "Regional",          icon: MapPin },
  preco_insumo:     { label: "Preço de insumo",   icon: Coins },
};

function MarketItemCard({ item }) {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.visao_geral;
  const Icon = meta.icon;
  return (
    <div
      className="p-4 rounded-xl border flex flex-col gap-2 min-w-0"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          <Icon size={11} strokeWidth={2.5} />
          {meta.label}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>{formatDateBR(item.detected_at)}</span>
      </div>
      <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{item.title}</div>
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{item.summary}</div>
      <div className="flex items-center justify-between gap-2 pt-1">
        {item.sector && (
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>{item.sector}</span>
        )}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            {item.source_name || "Fonte"} <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

function MarketTab({ items, loading, error }) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const filtered = useMemo(
    () => (categoryFilter === "all" ? items : items.filter(i => i.category === categoryFilter)),
    [items, categoryFilter],
  );
  const sectorsCovered = useMemo(() => new Set(items.map(i => i.sector).filter(Boolean)).size, [items]);
  const lastUpdate = items[0]?.detected_at;

  if (loading) {
    return <div className="py-16 text-center text-sm" style={{ color: "var(--text-dim)" }}>Carregando…</div>;
  }

  if (error) {
    return (
      <EmptyState
        icon={Globe}
        title="Não foi possível carregar o conteúdo de mercado"
        description="Verifique a conexão e tente de novo."
      />
    );
  }

  return (
    <div className="space-y-4">
      <StatCardGrid desktopClassName="md:grid-cols-3">
        <StatCard icon={Globe} value={items.length} label="Itens de mercado" />
        <StatCard icon={MapPin} value={sectorsCovered} label="Setores cobertos" />
        <StatCard
          icon={RefreshCcw}
          value={lastUpdate ? formatDateBR(lastUpdate) : "—"}
          label="Última atualização"
        />
      </StatCardGrid>

      {items.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Ainda não há conteúdo de mercado"
          description="Esta aba é alimentada automaticamente pelo workflow n8n 'Scout de Mercado' (Perplexity) — assim que a credencial for configurada e a primeira rodada rodar, o conteúdo aparece aqui sozinho, sem precisar recarregar a página."
        />
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter("all")}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
              style={{
                background: categoryFilter === "all" ? "var(--accent)" : "var(--surface)",
                color: categoryFilter === "all" ? "var(--on-accent)" : "var(--text-dim)",
                borderColor: categoryFilter === "all" ? "var(--accent)" : "var(--border)",
              }}
            >
              Todas
            </button>
            {Object.entries(CATEGORY_META).map(([id, meta]) => (
              <button
                key={id}
                onClick={() => setCategoryFilter(id)}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
                style={{
                  background: categoryFilter === id ? "var(--accent)" : "var(--surface)",
                  color: categoryFilter === id ? "var(--on-accent)" : "var(--text-dim)",
                  borderColor: categoryFilter === id ? "var(--accent)" : "var(--border)",
                }}
              >
                {meta.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(item => <MarketItemCard key={item.id} item={item} />)}
          </div>
        </>
      )}
    </div>
  );
}

function CrossTab({ leads, items }) {
  const rows = useMemo(() => {
    return CANONICAL_SECTORS.map(sector => {
      const sectorLeads = leads.filter(l => l.sector === sector);
      const open = sectorLeads.filter(l => l.stage !== "ganho" && l.stage !== "perdido");
      const won = sectorLeads.filter(l => l.stage === "ganho");
      const pipelineValue = open.reduce((sum, l) => sum + (l.value || 0), 0);
      const wonValue = won.reduce((sum, l) => sum + (l.value || 0), 0);
      const marketItems = items.filter(i => i.sector === sector);
      return {
        sector,
        openCount: open.length,
        wonCount: won.length,
        pipelineValue,
        wonValue,
        marketItemsCount: marketItems.length,
        marketItems,
      };
    }).filter(r => r.openCount > 0 || r.wonCount > 0 || r.marketItemsCount > 0);
  }, [leads, items]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={GitCompareArrows}
        title="Sem dados suficientes pra cruzar ainda"
        description="Esta aba cruza o setor de cada negócio do Funil de Vendas com o conteúdo de mercado da aba Mercado. Precisa de negócios com setor preenchido e/ou conteúdo de mercado publicado pra mostrar alguma coisa."
      />
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--surface-alt)" }}>
            <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Setor</th>
            <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Negócios abertos</th>
            <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Pipeline</th>
            <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Ganhos</th>
            <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Itens de mercado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.sector} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--text)" }}>{r.sector}</td>
              <td className="px-3 py-2.5 text-right" style={{ color: "var(--text)" }}>{r.openCount}</td>
              <td className="px-3 py-2.5 text-right" style={{ color: "var(--text)" }}>{formatK(r.pipelineValue)}</td>
              <td className="px-3 py-2.5 text-right" style={{ color: "var(--text)" }}>{r.wonCount} · {formatK(r.wonValue)}</td>
              <td className="px-3 py-2.5 text-right">
                {r.marketItemsCount > 0 ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                    title={r.marketItems.map(i => i.title).join(" · ")}
                  >
                    {r.marketItemsCount}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-dim)" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketIntelligenceView({ leads = [], pipelines, canSeeDeepIntel = false }) {
  const [tab, setTab] = useState("market");
  const { items, loading, error } = useMarketIntelligence();

  const tabs = [
    { id: "market", label: "Mercado", icon: Globe },
    ...(canSeeDeepIntel ? [
      { id: "insights", label: "Insights", icon: TrendingUp },
      { id: "cross", label: "Cruzamento", icon: GitCompareArrows },
    ] : []),
  ];

  return (
    <div className="space-y-4" data-tour="inteligencia-mercado-hub">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>Inteligência de Mercado</h1>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            Dados do setor, insights internos e o cruzamento dos dois.
          </p>
        </div>
        {tabs.length > 1 && <Tabs tabs={tabs} active={tab} onChange={setTab} />}
      </div>

      {tab === "market" && <MarketTab items={items} loading={loading} error={error} />}
      {tab === "insights" && canSeeDeepIntel && <InsightsView leads={leads} pipelines={pipelines} />}
      {tab === "cross" && canSeeDeepIntel && <CrossTab leads={leads} items={items} />}
    </div>
  );
}

export default MarketIntelligenceView;
