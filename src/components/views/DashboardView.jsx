import React, { useMemo, useState } from "react";
import {
  Target, HandCoins, CheckCircle2, Gauge, RefreshCcw, Download, SlidersHorizontal,
  Clock, CalendarClock, AlertTriangle, CalendarCheck, LayoutGrid,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { VISAO_GERAL_WIDGETS } from "../../constants/visao-geral-widgets";
import { StatCard } from "../ui/StatCard";
import { StatCardGrid } from "../shared/StatCardGrid";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Eyebrow } from "../shared/PanelHeading";
import { PanelEmptyState } from "../shared/PanelEmptyState";
import { TaskBucket } from "../shared/TaskBucket";
import { StageDistributionBar } from "../shared/StageDistributionBar";
import { WidgetPrefsModal } from "../shared/WidgetPrefsModal";
import { formatK } from "../../utils/currency";
import { formatDateBR, daysSince } from "../../utils/date";
import { monthBounds, within, pctChange } from "../../utils/trend";
import { exportLeadsToCSV } from "../../utils/export-csv";
import { logExport } from "../../utils/log-export";
import { greetingFor } from "../../utils/greeting";
import { useUsersById } from "../../hooks/use-users-by-id";
import { useDashboardWidgetPrefs } from "../../hooks/use-dashboard-widget-prefs";
import { isStale, daysIdle, getLeadOwnerIds } from "../../utils/pipeline-metrics";

const TERMINAL = new Set(["ganho", "perdido"]);
const CLOSING_HORIZON_DAYS = 7;

export function DashboardView({ user, activeCompany, leads, users = [], onNavigate, onLeadClick, pipelines }) {
  const usersById = useUsersById(users);
  const { widgetVisible, toggles, zone4Title, save } = useDashboardWidgetPrefs(user.id, "comercial");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const isGroupView = activeCompany === "all";
  // roles[] cobre cargo adicional (ex: gerente como cargo secundário) —
  // user.role sozinho (cargo principal) fica só de fallback.
  const userRoleList = user.roles?.length ? user.roles : (user.role ? [user.role] : []);
  const isManager = userRoleList.includes("gerente") || userRoleList.includes("admin");
  const isConsultor = userRoleList.includes("consultor");
  const companyData = isGroupView ? null : COMPANIES[activeCompany];
  const accent = companyData?.primary || null;

  const subordinateIds = useMemo(() => {
    if (user.role !== "vendedor") return new Set();
    return new Set((users || []).filter(u => u.supervisorId === user.id).map(u => u.id));
  }, [users, user.id, user.role]);

  const scopedLeads = useMemo(() => {
    let s = leads;
    if (!isGroupView) s = s.filter(l => l.companyId === activeCompany);
    // getLeadOwnerIds() em vez de `owner` (escalar) — um lead onde o
    // usuário é só co-responsável (ownerIds[]) nunca aparecia aqui, mesmo
    // já aparecendo no Kanban do Funil de Vendas (CRMView já usava getLeadOwnerIds
    // em tudo). Achado da auditoria de fricção de 18/07.
    if (isConsultor) {
      s = s.filter(l => getLeadOwnerIds(l).includes(user.id));
    } else if (!isManager) {
      s = s.filter(l => getLeadOwnerIds(l).some(id => id === user.id || subordinateIds.has(id)));
    }
    if (user.sectors?.length && (user.role === "vendedor" || user.role === "consultor")) {
      s = s.filter(l => !l.sector || user.sectors.includes(l.sector));
    }
    return s;
  }, [leads, activeCompany, user.id, user.role, user.sectors, isGroupView, isManager, isConsultor, subordinateIds]);

  const stats = useMemo(() => {
    let pipelineValue = 0, wonValue = 0, wonCount = 0, openCount = 0;
    let fitSum = 0, fitCount70 = 0, newCount = 0;
    for (const l of scopedLeads) {
      fitSum += l.fitScore;
      if (l.fitScore >= 70) fitCount70++;
      if (daysSince(l.negotiationStartedAt || l.createdAt) <= 2) newCount++;
      if (l.stage === "ganho") { wonValue += l.value; wonCount++; }
      if (!TERMINAL.has(l.stage)) { pipelineValue += l.value; openCount++; }
    }
    const avgFit = scopedLeads.length > 0 ? Math.round(fitSum / scopedLeads.length) : 0;
    return { pipelineValue, wonValue, wonCount, openCount, avgFit, fitCount70, newCount };
  }, [scopedLeads]);

  // Zona 1 — mês corrente vs. mês anterior, mesmo recipe do Marketing
  // (mom.campaigns), aplicado a scopedLeads já carregado.
  const mom = useMemo(() => {
    const now = new Date();
    const [cs, ce] = monthBounds(now);
    const prev = new Date(now); prev.setMonth(prev.getMonth() - 1);
    const [ps, pe] = monthBounds(prev);
    const lc = scopedLeads.filter(l => within(l.negotiationStartedAt || l.createdAt, cs, ce)).length;
    const lp = scopedLeads.filter(l => within(l.negotiationStartedAt || l.createdAt, ps, pe)).length;
    const wc = scopedLeads.filter(l => l.stage === "ganho" && within(l.stageChangedAt, cs, ce))
      .reduce((s, l) => s + l.value, 0);
    const wp = scopedLeads.filter(l => l.stage === "ganho" && within(l.stageChangedAt, ps, pe))
      .reduce((s, l) => s + l.value, 0);
    return {
      leads: { v: lc, d: pctChange(lc, lp) },
      won:   { v: wc, d: pctChange(wc, wp) },
    };
  }, [scopedLeads]);

  // Derived from CRM leads — surfaces what needs attention this week.
  const tasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today.getTime() + CLOSING_HORIZON_DAYS * 86400000);

    const closing = [];
    const stale = [];
    const overdue = [];
    const followUps = [];

    for (const l of scopedLeads) {
      if (TERMINAL.has(l.stage)) continue;

      if (l.closeDate) {
        const close = new Date(l.closeDate);
        if (!Number.isNaN(close.getTime())) {
          if (close < today) {
            overdue.push({ lead: l, close });
          } else if (close <= horizon) {
            closing.push({ lead: l, close });
          }
        }
      }

      // Follow-ups: vencidos OU dentro do horizonte de 7 dias. Quem agendou
      // pra mês que vem aparece no Calendário, não aqui.
      if (l.nextFollowUp) {
        const fu = new Date(l.nextFollowUp);
        if (!Number.isNaN(fu.getTime()) && fu <= horizon) {
          followUps.push({ lead: l, when: fu, isLate: fu < today });
        }
      }

      // Usa SLA por etapa configurado no editor de etapas do Funil de Vendas (com fallback
      // pro default global). Substitui o threshold único de 14 dias.
      const companyStages = pipelines?.[l.companyId];
      if (isStale(l, companyStages)) {
        stale.push({ lead: l, idle: daysIdle(l) });
      }
    }

    closing.sort((a, b) => a.close - b.close);
    overdue.sort((a, b) => a.close - b.close);
    stale.sort((a, b) => b.idle - a.idle);
    followUps.sort((a, b) => a.when - b.when);

    return { closing, stale, overdue, followUps };
  }, [scopedLeads, pipelines]);

  const totalTasks = tasks.closing.length + tasks.stale.length + tasks.overdue.length + tasks.followUps.length;

  // Zona 3 — reaproveita o cálculo de distribuição por etapa já provado em
  // ExecutiveDashboard.jsx:143-173 (dedupe de etapas entre empresas em
  // visão de grupo), aplicado a `scopedLeads` em vez de `filteredLeads`.
  const funnelStages = useMemo(() => {
    const presentIds = new Set(scopedLeads.map(l => l.companyId));
    const extraIds = [...presentIds].filter(id => !COMPANY_IDS.includes(id));
    const sourceCompanies = presentIds.size > 0
      ? [...COMPANY_IDS.filter(id => presentIds.has(id)), ...extraIds]
      : (isGroupView ? COMPANY_IDS : [activeCompany]);
    const stageMap = new Map();
    for (const cid of sourceCompanies) {
      const stages = (pipelines?.[cid] || DEFAULT_PIPELINE_STAGES).filter(s => !s.lost);
      for (const s of stages) {
        if (!stageMap.has(s.id)) stageMap.set(s.id, s);
      }
    }
    const counts = Object.create(null);
    for (const s of stageMap.values()) counts[s.id] = 0;
    for (const l of scopedLeads) {
      if (counts[l.stage] != null) counts[l.stage]++;
    }
    return Array.from(stageMap.values()).map(stage => ({
      id: stage.id, name: stage.name, color: stage.color, count: counts[stage.id] || 0,
    }));
  }, [scopedLeads, pipelines, isGroupView, activeCompany]);

  const taskBuckets = [
    {
      id: "task_overdue", icon: AlertTriangle, tone: "var(--danger)",
      title: "Fechamento atrasado", empty: "Nenhum vencido", fullCount: tasks.overdue.length,
      items: tasks.overdue.slice(0, 4).map(({ lead, close }) => ({
        key: lead.id, primary: lead.company, secondary: `Fechamento ${formatDateBR(close)}`,
        badge: `${daysSince(close)}d`, onClick: () => onLeadClick(lead),
      })),
    },
    {
      id: "task_followups", icon: CalendarCheck, tone: "var(--success)",
      title: "Follow-ups agendados", empty: "Sem follow-up nos próximos 7 dias", fullCount: tasks.followUps.length,
      items: tasks.followUps.slice(0, 4).map(({ lead, when, isLate }) => ({
        key: lead.id, primary: lead.company, secondary: `${stageLabel(lead.stage)} · ${formatDateBR(when)}`,
        badge: isLate ? `${daysSince(when)}d atraso` : formatDateBR(when),
        badgeTone: isLate ? "var(--danger)" : "var(--success)", onClick: () => onLeadClick(lead),
      })),
    },
    {
      id: "task_closing", icon: CalendarClock, tone: "#1E3A8A",
      title: "Fecham nesta semana", empty: "Sem fechamentos próximos", fullCount: tasks.closing.length,
      items: tasks.closing.slice(0, 4).map(({ lead, close }) => ({
        key: lead.id, primary: lead.company, secondary: `${formatK(lead.value)} · ${formatDateBR(close)}`,
        badge: stageLabel(lead.stage), onClick: () => onLeadClick(lead),
      })),
    },
    {
      id: "task_stale", icon: Clock, tone: "var(--warning)",
      title: "Leads parados", empty: "Tudo com atividade recente", fullCount: tasks.stale.length,
      items: tasks.stale.slice(0, 4).map(({ lead, idle }) => ({
        key: lead.id, primary: lead.company, secondary: `${stageLabel(lead.stage)} · ${formatK(lead.value)}`,
        badge: `${idle}d sem atividade`, onClick: () => onLeadClick(lead),
      })),
    },
  ];
  const visibleTaskBuckets = taskBuckets.filter(b => widgetVisible(b.id));
  const visibleTaskCount = visibleTaskBuckets.reduce((s, b) => s + b.fullCount, 0);

  const zone1Ids = ["leads_count", "pipeline_open", "won_value", "avg_fit"];
  const zone1VisibleCount = zone1Ids.filter(widgetVisible).length;

  return (
    <div className="flex flex-col gap-7">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            {greetingFor(user)}
          </h1>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-dim)", marginTop: 4 }}>
            {isGroupView
              ? `${scopedLeads.length} leads em ${COMPANY_IDS.length} empresas`
              : `${companyData?.name || "—"} · ${scopedLeads.length} leads`}
            {totalTasks > 0 && ` · ${totalTasks} pendência${totalTasks !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={RefreshCcw}
            size="md"
            onClick={() => window.location.reload()}
          >
            Atualizar
          </Button>
          {isManager && (
            <Button
              variant="secondary"
              icon={Download}
              size="md"
              onClick={() => { exportLeadsToCSV(scopedLeads, { usersById, pipelines }); logExport(user?.id, "leads_dashboard", scopedLeads.length); }}
            >
              Exportar
            </Button>
          )}
          <Button
            variant="secondary"
            icon={SlidersHorizontal}
            size="md"
            className="min-h-touch lg:min-h-0"
            onClick={() => setPrefsOpen(true)}
            aria-label="Personalizar"
          >
            <span className="hidden lg:inline">Personalizar</span>
          </Button>
        </div>
      </div>

      {/* Stat cards — grade de 2 colunas abaixo de 1024px (StatCardGrid,
          10/08/2026). Substituiu o carrossel horizontal: metade dos
          indicadores ficava fora da tela sem sinal claro. Estes tiles usam
          `variant="ruler"` (eyebrow + número grande), que ignora o `dense`
          injetado pelo StatCardGrid — o ganho aqui é só o fim do scroll
          lateral. Divisor/respiro de desktop ficam no wrapper externo. */}
      <div className="order-2 lg:order-1 lg:pb-[22px] lg:mb-[26px] lg:border-b lg:border-[var(--border)]">
        {zone1VisibleCount === 0 ? (
          <PanelEmptyState>Nenhum item selecionado para esta seção.</PanelEmptyState>
        ) : (
          <StatCardGrid desktopClassName="lg:grid-cols-4 lg:gap-7">
            {widgetVisible("leads_count") && (
              <StatCard icon={Target} value={scopedLeads.length}
                label={isManager ? (isGroupView ? "Leads no grupo" : "Leads da empresa") : "Meus leads"}
                trend={mom.leads.d} compact variant="ruler" />
            )}
            {widgetVisible("pipeline_open") && (
              <StatCard icon={HandCoins} value={formatK(stats.pipelineValue)}
                label="Funil de Vendas aberto"
                sublabel={`${stats.openCount} oportunidades`} compact variant="ruler" />
            )}
            {widgetVisible("won_value") && (
              <StatCard icon={CheckCircle2} value={formatK(stats.wonValue)}
                label="Valor ganho" trend={mom.won.d} accent={accent} compact variant="ruler" />
            )}
            {widgetVisible("avg_fit") && (
              <StatCard icon={Gauge} value={stats.avgFit} label="Fit score médio"
                sublabel={`${stats.newCount} novos em 48h`} compact variant="ruler"
                tooltip="Pontuação de 0 a 100 que indica o potencial do lead. Acima de 70 é considerado quente." />
            )}
          </StatCardGrid>
        )}
      </div>

      {/* Zona 2 — Pendências, derivado dos negócios do CRM. Vem antes da
          faixa de stats no mobile (<1024px): é a ação imediata, não um
          número frio. Rótulo "Pendências" pra bater com Marketing/RH
          (mesma zona estrutural, mesmo nome nas 3 telas). */}
      <div className="order-1 lg:order-2">
        <Eyebrow action={totalTasks > 0 ? "Abrir pipeline" : undefined} onAction={() => onNavigate("crm")} accent={accent}>
          Pendências
        </Eyebrow>
        <p className="text-xs mb-3" style={{ color: "var(--text-dim)", marginTop: -6 }}>
          Pendências dos seus negócios · próximos 7 dias e leads parados
        </p>

        {visibleTaskBuckets.length === 0 ? (
          <PanelEmptyState>Nenhum item selecionado para esta seção.</PanelEmptyState>
        ) : visibleTaskCount === 0 ? (
          <div
            className="p-5 rounded-xl border text-center text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
          >
            Nada urgente por aqui. Seus negócios estão em dia.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleTaskBuckets.map(b => (
              <TaskBucket key={b.id} icon={b.icon} tone={b.tone} title={b.title} empty={b.empty} items={b.items} />
            ))}
          </div>
        )}
      </div>

      {/* Zona 3 — Tendência: distribuição de leads por etapa do funil.
          order-3 fixo (sem variante lg:) — Zona 3 tem que ficar depois de
          Zona 1/2 nos dois breakpoints, e como a inversão mobile usa order-1/
          order-2 nelas, Zona 3 default (order 0) apareceria antes das duas no
          mobile sem isto. */}
      <div className="order-3">
        <div className="p-4 lg:p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Distribuição por etapa do funil
            </div>
          </div>
          {widgetVisible("stage_distribution") ? (
            <StageDistributionBar items={funnelStages} total={scopedLeads.length} emptyLabel="Sem leads" />
          ) : (
            <PanelEmptyState>Nenhum item selecionado para esta seção.</PanelEmptyState>
          )}
        </div>
      </div>

      {/* Zona 4 — livre. Nesta versão só o título é personalizável (via
          modal de Personalizar); sem widget real ainda. order-4 fixo pelo
          mesmo motivo do order-3 da Zona 3 acima. */}
      <div className="order-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <EmptyState
          icon={LayoutGrid}
          title={zone4Title || "Sua seção livre"}
          description="Nesta versão, esta seção ainda não mostra widgets — só o título é personalizável. Mais widgets chegam numa próxima rodada."
        />
      </div>

      <WidgetPrefsModal
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Personalizar Comercial"
        widgets={VISAO_GERAL_WIDGETS.comercial}
        toggles={toggles}
        zone4Title={zone4Title}
        onSave={save}
      />
    </div>
  );
}

const STAGE_LABELS = {
  prospeccao: "Prospecção",
  qualificacao: "Qualificação",
  visitas: "Visitas/Apresentação",
  amostras: "Amostras/Maturação",
  negociacao: "Negociação",
  ganho: "Negócio Fechado",
  perdido: "Perdido",
};

function stageLabel(id) {
  return STAGE_LABELS[id] || id;
}

export default DashboardView;
