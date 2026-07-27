import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Briefcase,
  Calendar,
  UserCheck,
  UserMinus,
  TrendingUp,
  AlertTriangle,
  SlidersHorizontal,
  LayoutGrid,
  RefreshCcw,
  Download,
} from "lucide-react";
import {
  RH_DESLIGAMENTO_TIPOS,
} from "../../constants/rh-config";
import { VISAO_GERAL_WIDGETS } from "../../constants/visao-geral-widgets";
import { parseDateInput } from "../../utils/date";
import { monthBounds, within, pctChange } from "../../utils/trend";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useDashboardWidgetPrefs } from "../../hooks/use-dashboard-widget-prefs";
import { StatCard } from "../ui/StatCard";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Eyebrow, PanelTitle } from "../shared/PanelHeading";
import { PanelEmptyState } from "../shared/PanelEmptyState";
import { TaskBucket } from "../shared/TaskBucket";
import { WidgetPrefsModal } from "../shared/WidgetPrefsModal";
import { StageDistributionBar } from "../shared/StageDistributionBar";
import { greetingFor } from "../../utils/greeting";
import { exportColaboradoresToCSV } from "../../utils/export-csv";
import { logExport } from "../../utils/log-export";

// Paleta categórica pra distinguir departamentos na barra de distribuição —
// departamento é texto livre (sem cor configurada em tabela, ao contrário das
// etapas de pipeline), então gira por um índice fixo em vez de token único.
const DEPT_COLORS = [
  "#6366F1", "#F59E0B", "#10B981", "#EC4899",
  "#3B82F6", "#8B5CF6", "#14B8A6", "#F97316",
];

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function calcDias(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(0, Math.round(diff / 86400000) + 1);
}

function getInitials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function leaveTypeLabel(typeId) {
  const map = {
    ferias: "Férias",
    licenca_medica: "Lic. Médica",
    licenca_maternidade: "Lic. Maternidade",
    licenca_paternidade: "Lic. Paternidade",
    folga: "Folga Comp.",
    luto: "Lic. Luto",
    outros: "Outros",
  };
  return map[typeId] || typeId || "—";
}

function stageInfo(stages, stageId) {
  const found = stages.find((s) => s.stageKey === stageId);
  return found || { name: stageId || "—", color: "var(--text-dim)" };
}

function Avatar({ name, bg, size = 34 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg || "var(--color-industria)",
        color: "#FFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export function RHOverviewView({ currentUser, canWrite, onNavigate }) {
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({ userId: currentUser?.id });
  const { stages: vagaStages } = useRHPipelineStages("vagas");
  const { widgetVisible, toggles, zone4Title, save } = useDashboardWidgetPrefs(currentUser?.id, "rh");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [vagas, setVagas] = useState([]);
  const [ferias, setFerias] = useState([]);
  const [loadingVagas, setLoadingVagas] = useState(true);
  const [loadingFerias, setLoadingFerias] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingVagas(false);
      setLoadingFerias(false);
      return;
    }
    supabase
      .from("rh_vagas")
      .select("*")
      .eq("stage", "publicada")
      .then(({ data }) => {
        setVagas(data || []);
        setLoadingVagas(false);
      })
      .catch(() => setLoadingVagas(false));

    supabase
      .from("rh_ferias")
      .select("*, profiles:user_id(name, job_title)")
      .eq("status", "pendente")
      .then(({ data }) => {
        setFerias(data || []);
        setLoadingFerias(false);
      })
      .catch(() => setLoadingFerias(false));
  }, []);

  // Fonte única de verdade pra "funcionário" é rh_colaboradores — inclui
  // quem tem login (sincronizado automaticamente via trigger) e quem não
  // tem (cadastrado direto em Funcionários).
  const totalFuncionarios = colaboradores.length;
  const totalAtivos = colaboradores.filter(
    (c) => !c.employeeStatus || c.employeeStatus === "ativo"
  ).length;
  const totalFerias = colaboradores.filter((c) => c.employeeStatus === "ferias").length;
  const totalAfastados = colaboradores.filter(
    (c) => c.employeeStatus === "afastado"
  ).length;

  // Turnover / offboarding (Onda 3, item 10): desligados nos últimos 12 meses,
  // taxa aproximada e distribuição por tipo de saída.
  const desligados12m = colaboradores.filter((c) => {
    if (c.employeeStatus !== "desligado" || !c.desligamentoDate) return false;
    const d = parseDateInput(c.desligamentoDate);
    if (Number.isNaN(d.getTime())) return false;
    return (Date.now() - d.getTime()) <= 365 * 86400000;
  });
  const turnoverRate = totalAtivos > 0 ? Math.round((desligados12m.length / (totalAtivos + desligados12m.length)) * 100) : 0;
  const desligadosVoluntarios = desligados12m.filter((c) => c.desligamentoTipo === "voluntario").length;
  const voluntariosPct = desligados12m.length ? Math.round((desligadosVoluntarios / desligados12m.length) * 100) : 0;
  const exitPorTipo = RH_DESLIGAMENTO_TIPOS
    .map((t) => ({ ...t, n: desligados12m.filter((c) => c.desligamentoTipo === t.id).length }))
    .filter((t) => t.n > 0);
  const semEntrevistaList = desligados12m.filter((c) => !c.desligamentoTipo);

  // MoM — reconstrói o headcount no início do mês corrente a partir de
  // admissionDate/desligamentoDate (sem tabela de snapshot histórico) pra
  // alimentar o trend de "Total de Funcionários". Só usa fatos pontuais e
  // confiáveis (data de admissão, data de desligamento) — não extrapola
  // employeeStatus (ferias/afastado) pro passado, ver spec §4.4.
  const [monthStart] = monthBounds(new Date());
  const totalAtStartOfMonth = colaboradores.filter((c) => {
    if (!c.admissionDate) return false;
    const adm = parseDateInput(c.admissionDate);
    if (Number.isNaN(adm.getTime()) || adm >= monthStart) return false;
    if (c.employeeStatus === "desligado" && c.desligamentoDate) {
      const deslig = parseDateInput(c.desligamentoDate);
      if (!Number.isNaN(deslig.getTime()) && deslig < monthStart) return false;
    }
    return true;
  }).length;

  // Zona 1 — desligamentos por mês-calendário (fluxo), separado da janela
  // rolante de 12 meses que o card mostra (ver spec §4.5).
  const mom = useMemo(() => {
    const now = new Date();
    const [cs, ce] = monthBounds(now);
    const prev = new Date(now); prev.setMonth(prev.getMonth() - 1);
    const [ps, pe] = monthBounds(prev);
    const ec = colaboradores.filter(c => c.employeeStatus === "desligado" && within(c.desligamentoDate, cs, ce)).length;
    const ep = colaboradores.filter(c => c.employeeStatus === "desligado" && within(c.desligamentoDate, ps, pe)).length;
    return { exits: { v: ec, d: pctChange(ec, ep) } };
  }, [colaboradores]);

  const recentAdmissions = [...colaboradores]
    .filter((c) => c.admissionDate)
    .sort(
      (a, b) =>
        new Date(b.admissionDate).getTime() -
        new Date(a.admissionDate).getTime()
    )
    .slice(0, 5);

  const deptMap = {};
  colaboradores.forEach((c) => {
    const dept = c.department || "Não definido";
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });
  const deptList = Object.entries(deptMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Zona 2 — "O que fazer": férias/vagas já eram listas soltas; "sem
  // entrevista" era um aviso estático (`semEntrevista > 0 && ...`) e vira
  // bucket acionável, listando os desligados específicos.
  const rhBuckets = [
    {
      id: "bucket_ferias_pendentes", icon: Calendar, tone: "var(--amber)",
      title: "Férias pendentes", empty: "Nenhuma solicitação pendente", fullCount: ferias.length,
      items: ferias.slice(0, 4).map((req) => {
        const dias = calcDias(req.start_date, req.end_date);
        return {
          key: req.id, primary: req.profiles?.name || "—",
          secondary: `${leaveTypeLabel(req.type)} · ${fmt(req.start_date)} → ${fmt(req.end_date)}`,
          badge: dias > 0 ? `${dias}d` : "—", badgeTone: "var(--amber)",
          onClick: () => onNavigate?.("rh-ferias"),
        };
      }),
    },
    {
      id: "bucket_vagas_abertas", icon: Briefcase, tone: "var(--text-dim)",
      title: "Vagas em aberto", empty: "Nenhuma vaga em aberto", fullCount: vagas.length,
      items: vagas.slice(0, 4).map((vaga) => {
        const stage = stageInfo(vagaStages, vaga.stage);
        return {
          key: vaga.id, primary: vaga.title || vaga.job_title || "Sem título",
          secondary: vaga.department || "—",
          badge: stage.name, badgeTone: stage.color,
          onClick: () => onNavigate?.("rh-recrutamento"),
        };
      }),
    },
    {
      id: "bucket_desligamento_sem_entrevista", icon: AlertTriangle, tone: "var(--danger)",
      title: "Desligamentos sem entrevista", empty: "Todos os desligamentos têm entrevista registrada",
      fullCount: semEntrevistaList.length,
      items: semEntrevistaList.slice(0, 4).map((c) => ({
        key: c.id, primary: c.fullName || "—",
        secondary: `${c.department || "—"} · desligado em ${fmt(c.desligamentoDate)}`,
        badge: "sem entrevista",
        onClick: () => onNavigate?.("rh-funcionarios"),
      })),
    },
  ];
  const visibleRHBuckets = rhBuckets.filter((b) => widgetVisible(b.id));
  const visibleRHBucketCount = visibleRHBuckets.reduce((s, b) => s + b.fullCount, 0);

  const zone1Ids = ["stat_total", "stat_ativos", "stat_ferias", "stat_afastados", "stat_desligamentos", "stat_turnover_rate"];
  const zone1VisibleCount = zone1Ids.filter(widgetVisible).length;

  const card = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div className="flex flex-col gap-7">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "var(--text)",
                margin: 0,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {greetingFor(currentUser)}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "4px 0 0" }}>
              {loadingColaboradores
                ? "Carregando..."
                : <>{totalAtivos} colaborador{totalAtivos !== 1 ? "es" : ""} ativo{totalAtivos !== 1 ? "s" : ""}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={RefreshCcw}
              size="md"
              onClick={() => window.location.reload()}
            >
              Atualizar
            </Button>
            {canWrite && (
              <Button
                variant="secondary"
                icon={Download}
                size="md"
                onClick={() => { exportColaboradoresToCSV(colaboradores); logExport(currentUser?.id, "rh_overview_dashboard", colaboradores.length); }}
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

        {/* Zona 1 — Resumo: 6 tiles (carrossel de peek abaixo de 1024px) */}
        <div className="-mx-4 sm:-mx-6 lg:mx-0">
          {zone1VisibleCount === 0 ? (
            <PanelEmptyState>Nenhum item selecionado para esta seção.</PanelEmptyState>
          ) : loadingColaboradores ? (
            <div
              className="p-5 rounded-xl border text-center text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Carregando...
            </div>
          ) : (
            <div
              className="flex gap-3 overflow-x-auto px-4 sm:px-6 lg:px-0 lg:grid lg:overflow-visible"
              style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
                        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
            >
              {widgetVisible("stat_total") && (
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={Users} value={totalFuncionarios} label="Total de Funcionários"
                    trend={pctChange(totalFuncionarios, totalAtStartOfMonth)} compact />
                </div>
              )}
              {widgetVisible("stat_ativos") && (
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={UserCheck} value={totalAtivos} label="Ativos"
                    sublabel={totalFuncionarios > 0 ? `${Math.round((totalAtivos / totalFuncionarios) * 100)}% do total` : undefined} compact />
                </div>
              )}
              {widgetVisible("stat_ferias") && (
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={Calendar} value={totalFerias} label="De Férias"
                    sublabel={totalFuncionarios > 0 ? `${Math.round((totalFerias / totalFuncionarios) * 100)}% do total` : undefined} compact />
                </div>
              )}
              {widgetVisible("stat_afastados") && (
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={UserMinus} value={totalAfastados} label="Afastados"
                    accent={totalAfastados > 0 ? "var(--warning)" : undefined}
                    sublabel={totalFuncionarios > 0 ? `${Math.round((totalAfastados / totalFuncionarios) * 100)}% do total` : undefined} compact />
                </div>
              )}
              {widgetVisible("stat_desligamentos") && (
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={UserMinus} value={desligados12m.length} label="Desligamentos (12 meses)"
                    trend={mom.exits.d} compact />
                </div>
              )}
              {widgetVisible("stat_turnover_rate") && (
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={TrendingUp} value={`${turnoverRate}%`} label="Taxa de turnover aproximada"
                    accent={turnoverRate >= 20 ? "var(--danger)" : undefined}
                    sublabel={desligados12m.length > 0 ? `${voluntariosPct}% voluntário` : undefined} compact />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zona 2 — O que fazer */}
        <div>
          <Eyebrow>Pendências</Eyebrow>
          <p className="text-xs mb-3" style={{ color: "var(--text-dim)", marginTop: -6 }}>
            Férias, vagas e desligamentos que precisam de atenção
          </p>
          {visibleRHBuckets.length === 0 ? (
            <PanelEmptyState>Nenhum item selecionado para esta seção.</PanelEmptyState>
          ) : (loadingVagas || loadingFerias || loadingColaboradores) ? (
            <div
              className="p-5 rounded-xl border text-center text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Carregando...
            </div>
          ) : visibleRHBucketCount === 0 ? (
            <div
              className="p-5 rounded-xl border text-center text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Nada urgente por aqui. Seus processos estão em dia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleRHBuckets.map((b) => (
                <TaskBucket key={b.id} icon={b.icon} tone={b.tone} title={b.title} empty={b.empty} items={b.items} />
              ))}
            </div>
          )}
        </div>

        {/* Zona 3 — Tendência */}
        <div className="p-4 lg:p-5" style={card}>
          <PanelTitle title="Distribuição por Departamento" />
          {widgetVisible("panel_departamento") ? (
            loadingColaboradores ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
            ) : (
              <StageDistributionBar
                items={deptList.map(([dept, count], i) => ({
                  id: dept,
                  name: dept,
                  color: DEPT_COLORS[i % DEPT_COLORS.length],
                  count,
                }))}
                total={totalFuncionarios}
                emptyLabel="Sem dados de departamento"
              />
            )
          ) : (
            <PanelEmptyState>Nenhum item selecionado para esta seção.</PanelEmptyState>
          )}
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-2"
          style={{ gap: 20 }}
        >
          <div className="p-4 lg:p-5" style={card}>
            <PanelTitle title="Desligamentos por Tipo" />
            {widgetVisible("panel_desligamento_tipo") ? (
              loadingColaboradores ? (
                <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
              ) : desligados12m.length === 0 ? (
                <PanelEmptyState>Sem desligamentos nos últimos 12 meses</PanelEmptyState>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>{voluntariosPct}%</span>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>saíram por conta própria (voluntário)</span>
                  </div>
                  {exitPorTipo.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {exitPorTipo.map((t) => (
                        <Badge key={t.id} variant="neutral">
                          {t.label.split(" (")[0]}: <b style={{ color: "var(--text)" }}>{t.n}</b>
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )
            ) : (
              <PanelEmptyState>Nenhum item selecionado para esta seção.</PanelEmptyState>
            )}
          </div>

          <div className="p-4 lg:p-5" style={card}>
            <PanelTitle title="Admissões Recentes" />
            {widgetVisible("panel_admissoes_recentes") ? (
              loadingColaboradores ? (
                <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
              ) : recentAdmissions.length === 0 ? (
                <PanelEmptyState>Nenhuma admissão registrada</PanelEmptyState>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {recentAdmissions.map((c) => (
                    <div
                      key={c.id}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <Avatar name={c.fullName} size={34} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.fullName || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-dim)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.jobTitle || c.department || "—"}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          flexShrink: 0,
                        }}
                      >
                        {fmt(c.admissionDate)}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <PanelEmptyState>Nenhum item selecionado para esta seção.</PanelEmptyState>
            )}
          </div>
        </div>

        {/* Zona 4 — livre */}
        <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <EmptyState
            icon={LayoutGrid}
            title={zone4Title || "Sua seção livre"}
            description="Nesta versão, esta seção ainda não mostra widgets — só o título é personalizável. Mais widgets chegam numa próxima rodada."
          />
        </div>

        <WidgetPrefsModal
          open={prefsOpen}
          onClose={() => setPrefsOpen(false)}
          title="Personalizar RH"
          widgets={VISAO_GERAL_WIDGETS.rh}
          toggles={toggles}
          zone4Title={zone4Title}
          onSave={save}
        />
    </div>
  );
}

export default RHOverviewView;
