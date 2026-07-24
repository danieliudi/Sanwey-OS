import React, { useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  Calendar,
  Clock,
  UserCheck,
  UserMinus,
  TrendingUp,
} from "lucide-react";
import {
  RH_DESLIGAMENTO_TIPOS,
} from "../../constants/rh-config";
import { parseDateInput } from "../../utils/date";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { StatCard } from "../ui/StatCard";
import { Badge } from "../ui/Badge";
import { PanelTitle } from "../shared/PanelHeading";
import { PanelEmptyState } from "../shared/PanelEmptyState";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function fmtToday() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
  const semEntrevista = desligados12m.filter((c) => !c.desligamentoTipo).length;

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
  const maxDept = deptList.length > 0 ? deptList[0][1] : 1;

  const statCards = [
    { key: "total", label: "Total de Funcionários", value: totalFuncionarios, icon: Users },
    { key: "ativos", label: "Ativos", value: totalAtivos, icon: UserCheck },
    { key: "ferias", label: "De Férias", value: totalFerias, icon: Calendar },
    { key: "afastados", label: "Afastados", value: totalAfastados, icon: UserMinus, accent: totalAfastados > 0 ? "var(--warning)" : undefined },
  ];

  const card = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      <div className="py-4 lg:py-6" style={{ maxWidth: 1200, margin: "0 auto" }}>

        <div style={{ marginBottom: 28 }}>
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
            Visão Geral — RH
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              margin: "4px 0 0",
              textTransform: "capitalize",
            }}
          >
            {fmtToday()}
          </p>
        </div>

        {/* Stat cards — carrossel de peek abaixo de 1024px (adendo mobile) */}
        <div className="-mx-4 sm:-mx-6 lg:mx-0 mb-7">
          <div
            className="flex gap-3 overflow-x-auto px-4 sm:px-6 lg:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible"
            style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
          >
            {statCards.map((sc) => (
              <div key={sc.key} className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                <StatCard icon={sc.icon} value={sc.value} label={sc.label} accent={sc.accent} compact />
              </div>
            ))}
          </div>
        </div>

        {desligados12m.length > 0 && (
          <div className="p-4 lg:p-5" style={{ ...card, marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <UserMinus size={16} color="var(--text-dim)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Turnover (últimos 12 meses)</span>
            </div>
            <div className="-mx-4 lg:mx-0">
              <div
                className="flex gap-3 overflow-x-auto px-4 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible"
                style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
              >
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={UserMinus} value={desligados12m.length} label="Desligamentos" compact />
                </div>
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={TrendingUp} value={`${turnoverRate}%`} label="Taxa aproximada"
                    accent={turnoverRate >= 20 ? "var(--danger)" : undefined} compact />
                </div>
                <div className="flex-none w-[132px] lg:w-auto" style={{ scrollSnapAlign: "start" }}>
                  <StatCard icon={UserCheck} value={`${voluntariosPct}%`} label="Voluntários" compact />
                </div>
              </div>
            </div>
            {exitPorTipo.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {exitPorTipo.map((t) => (
                  <Badge key={t.id} variant="neutral">
                    {t.label.split(" (")[0]}: <b style={{ color: "var(--text)" }}>{t.n}</b>
                  </Badge>
                ))}
              </div>
            )}
            {semEntrevista > 0 && (
              <div style={{ fontSize: 11, color: "var(--warning)", fontWeight: 600, marginTop: 10 }}>
                {semEntrevista} desligamento(s) sem entrevista de saída registrada.
              </div>
            )}
          </div>
        )}

        <div
          className="grid grid-cols-1 lg:grid-cols-3"
          style={{ gap: 20, marginBottom: 20 }}
        >
          <div className="p-4 lg:p-5" style={card}>
            <PanelTitle
              title="Vagas em Aberto"
              action="Ver todas"
              onAction={() => onNavigate?.("rh-recrutamento")}
              actionColor="var(--color-industria)"
            />
            {loadingVagas ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
            ) : vagas.length === 0 ? (
              <PanelEmptyState>Nenhuma vaga em aberto</PanelEmptyState>
            ) : (
              <>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "color-mix(in srgb, var(--color-industria) 10%, transparent)",
                    color: "var(--color-industria)",
                    border: `1px solid color-mix(in srgb, var(--color-industria) 20%, transparent)`,
                    borderRadius: 99,
                    padding: "2px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 14,
                  }}
                >
                  <Briefcase size={11} />
                  {vagas.length} {vagas.length === 1 ? "vaga" : "vagas"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {vagas.slice(0, 5).map((vaga) => {
                    const stage = stageInfo(vagaStages, vaga.stage);
                    return (
                      <div
                        key={vaga.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
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
                            {vaga.title || vaga.job_title || "Sem título"}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-dim)",
                              marginTop: 1,
                            }}
                          >
                            {vaga.department || "—"}
                          </div>
                        </div>
                        <Badge customColor={stage.color}>{stage.name}</Badge>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="p-4 lg:p-5" style={card}>
            <PanelTitle title="Admissões Recentes" />
            {loadingColaboradores ? (
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
            )}
          </div>

          <div className="p-4 lg:p-5" style={card}>
            <PanelTitle
              title="Férias Pendentes"
              action="Ver todas"
              onAction={() => onNavigate?.("rh-ferias")}
              actionColor="var(--color-industria)"
            />
            {loadingFerias ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
            ) : ferias.length === 0 ? (
              <PanelEmptyState>Nenhuma solicitação pendente</PanelEmptyState>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ferias.map((req) => {
                  const employee = req.profiles;
                  const dias = calcDias(req.start_date, req.end_date);
                  return (
                    <div
                      key={req.id}
                      style={{
                        background: "var(--amber-bg)",
                        border: "1px solid color-mix(in srgb, var(--amber) 20%, transparent)",
                        borderRadius: 8,
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <Clock size={12} color={"var(--amber)"} />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text)",
                          }}
                        >
                          {employee?.name || "—"}
                        </span>
                      </div>
                      <div
                        style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}
                      >
                        {leaveTypeLabel(req.type)} · {fmt(req.start_date)} →{" "}
                        {fmt(req.end_date)}
                        {dias > 0 && (
                          <span
                            style={{
                              marginLeft: 4,
                              fontWeight: 600,
                              color: "var(--amber)",
                            }}
                          >
                            ({dias}d)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 lg:p-5" style={card}>
          <PanelTitle title="Distribuição por Departamento" />
          {loadingColaboradores ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
          ) : deptList.length === 0 ? (
            <PanelEmptyState>Sem dados de departamento</PanelEmptyState>
          ) : (
            <div
              className="grid grid-cols-1 lg:grid-cols-2"
              style={{ gap: "8px 32px" }}
            >
              {deptList.map(([dept, count]) => {
                const pct = Math.round((count / maxDept) * 100);
                const totalPct =
                  totalFuncionarios > 0
                    ? Math.round((count / totalFuncionarios) * 100)
                    : 0;
                return (
                  <div key={dept} style={{ paddingBottom: 4 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--text)",
                        }}
                      >
                        {dept}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-dim)",
                          display: "flex",
                          gap: 6,
                        }}
                      >
                        <strong style={{ color: "var(--text)" }}>{count}</strong>
                        <span>({totalPct}%)</span>
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "var(--border)",
                        borderRadius: 99,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "var(--color-industria)",
                          borderRadius: 99,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RHOverviewView;
