import React, { useMemo } from "react";
import { Clock, CheckCircle2, TrendingUp, Megaphone, Briefcase, Wallet, ShoppingCart, HandCoins } from "lucide-react";
import { useInsightsMetrics } from "../../hooks/use-insights-metrics";
import { StatCard } from "../ui/StatCard";
import { formatK } from "../../utils/currency";

// Painel de Insights — Fase 1 (velocidade): tempo médio nos processos-chave
// de RH/Comercial/Marketing, comparado com o período anterior, e os custos
// já cadastrados no banco. Só dado que já existe — sem tabela nova, sem API
// externa, sem estimativa. Ver src/hooks/use-insights-metrics.js.

const FASTER_COLOR = "#15803D"; // verde — mesmo tom do trend positivo do StatCard
const SLOWER_COLOR = "#B45309"; // âmbar — sinaliza "piorou" sem soar como erro grave

// Pra métricas de TEMPO, menor é melhor — por isso não usamos a prop `trend`
// numérica do StatCard aqui (ela pinta "subiu" de verde, o que inverteria o
// sentido). Em vez disso, o comparativo vira texto explícito no sublabel.
function VelocitySublabel({ metric, unitLabel }) {
  const { sampleSize, changePercent } = metric;
  const sampleText = `${sampleSize} ${unitLabel} nos últimos 90 dias`;

  if (changePercent == null) {
    return <span>{sampleText}</span>;
  }

  const faster = changePercent > 0;
  const pct = Math.abs(changePercent);
  const word = faster ? "mais rápido" : "mais lento";
  const color = faster ? FASTER_COLOR : SLOWER_COLOR;

  return (
    <span>
      <span style={{ color, fontWeight: 700 }}>{pct}% {word}</span>
      <span> que o trimestre anterior · {sampleText}</span>
    </span>
  );
}

function velocityValue(metric) {
  return metric.avgDays != null ? `${metric.avgDays}d` : "—";
}

// `leads`/`pipelines` vêm de App.jsx (useLeads/usePipelines, já carregados
// pro resto do app) — reaproveitados aqui em vez de refeitos, mesmo padrão
// de props do ExecutiveDashboard. Alimentam "Leads ganhos" e o critério de
// etapa terminal (ganho/perdido) por empresa do fechamento Comercial.
export function InsightsView({ leads, pipelines }) {
  const { loading, velocity, custos } = useInsightsMetrics({ leads, pipelines });

  const velocityCards = useMemo(() => ([
    {
      key: "contratacao",
      icon: Clock,
      label: "Tempo médio de contratação",
      unitLabel: "contratações",
      metric: velocity.contratacao,
    },
    {
      key: "onboarding",
      icon: CheckCircle2,
      label: "Tempo médio de onboarding",
      unitLabel: "onboardings concluídos",
      metric: velocity.onboarding,
    },
    {
      key: "fechamentoComercial",
      icon: TrendingUp,
      label: "Tempo médio de fechamento (Comercial)",
      unitLabel: "negócios fechados",
      metric: velocity.fechamentoComercial,
    },
    {
      key: "aprovacaoCotacaoMarketing",
      icon: Megaphone,
      label: "Aprovação de cotação (Marketing)",
      unitLabel: "cotações aprovadas",
      metric: velocity.aprovacaoCotacaoMarketing,
    },
  ]), [velocity]);

  const custoCards = useMemo(() => ([
    {
      key: "fornecedoresRH",
      icon: Briefcase,
      label: "Fornecedores RH (vigentes)",
      value: formatK(custos.fornecedoresRHTotal),
      sublabel: "Soma dos contratos com vigência ativa",
    },
    {
      key: "beneficios",
      icon: Wallet,
      label: "Benefícios (mensal)",
      value: formatK(custos.beneficiosMensalTotal),
      sublabel: "Soma dos benefícios cadastrados por colaborador",
    },
    {
      key: "comprasMarketing",
      icon: ShoppingCart,
      label: "Compras de Marketing",
      value: formatK(custos.comprasMarketingTotal),
      sublabel: "Total de solicitações de compra",
    },
    {
      key: "leadsGanhos",
      icon: HandCoins,
      label: "Leads ganhos",
      value: formatK(custos.leadsGanhosTotal),
      sublabel: "Valor total fechado (todas as empresas)",
    },
  ]), [custos]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>
        Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Painel de Insights
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
          Cruza dados de RH, Comercial e Marketing já registrados na plataforma, para mostrar a
          insights relacionados aos processos-chave e custos.
        </p>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>
          Velocidade
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {velocityCards.map(c => (
            <StatCard
              key={c.key}
              icon={c.icon}
              value={velocityValue(c.metric)}
              label={c.label}
              sublabel={<VelocitySublabel metric={c.metric} unitLabel={c.unitLabel} />}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>
          Custos
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {custoCards.map(c => (
            <StatCard
              key={c.key}
              icon={c.icon}
              value={c.value}
              label={c.label}
              sublabel={c.sublabel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default InsightsView;
