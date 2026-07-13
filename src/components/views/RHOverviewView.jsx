import React, { useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  Calendar,
  TrendingUp,
  Clock,
  UserCheck,
  UserMinus,
  ArrowRight,
  Building2,
} from "lucide-react";
import {
  RH_DEPARTMENTS,
  RH_CONTRACT_TYPES,
  RH_EMPLOYEE_STATUSES,
} from "../../constants/rh-config";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";

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

function SectionHeader({ title, action, onAction }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 10,
        marginBottom: 14,
        borderBottom: `1px solid ${"var(--border)"}`,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "var(--text-dim)",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </span>
      {action && (
        <button
          onClick={onAction}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-industria)",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: 0,
          }}
        >
          {action}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div
      style={{
        textAlign: "center",
        color: "var(--text-dim)",
        fontSize: 13,
        padding: "24px 0",
      }}
    >
      {text}
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
    {
      label: "Total de Funcionários",
      value: totalFuncionarios,
      icon: <Users size={20} color={"var(--text-dim)"} />,
      accent: "var(--text)",
    },
    {
      label: "Ativos",
      value: totalAtivos,
      icon: <UserCheck size={20} color="var(--success)" />,
      accent: "var(--success)",
    },
    {
      label: "De Férias",
      value: totalFerias,
      icon: <Calendar size={20} color="var(--accent)" />,
      accent: "var(--accent)",
    },
    {
      label: "Afastados",
      value: totalAfastados,
      icon: <UserMinus size={20} color="var(--warning)" />,
      accent: "var(--warning)",
    },
  ];

  const card = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      <div
        style={{
          padding: "24px 32px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
        className="rh-overview-container"
      >
        <style>{`
          @media (max-width: 768px) {
            .rh-overview-container { padding: 16px !important; }
            .rh-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
            .rh-two-col { grid-template-columns: 1fr !important; }
            .rh-three-col { grid-template-columns: 1fr !important; }
          }
        `}</style>

        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "var(--text)",
              margin: 0,
              letterSpacing: "-0.01em",
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

        <div
          className="rh-stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 28,
          }}
        >
          {statCards.map((sc) => (
            <div
              key={sc.label}
              style={{
                ...card,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  opacity: 0.7,
                }}
              >
                {sc.icon}
              </div>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: sc.accent,
                  lineHeight: 1,
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}
              >
                {sc.value}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>
                {sc.label}
              </span>
            </div>
          ))}
        </div>

        <div
          className="rh-three-col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ ...card, padding: 20 }}>
            <SectionHeader
              title="Vagas em Aberto"
              action="Ver todas"
              onAction={() => onNavigate?.("rh-recrutamento")}
            />
            {loadingVagas ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
            ) : vagas.length === 0 ? (
              <EmptyState text="Nenhuma vaga em aberto" />
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
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: stage.color,
                            background: `${stage.color}18`,
                            border: `1px solid ${stage.color}33`,
                            borderRadius: 99,
                            padding: "2px 8px",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {stage.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div style={{ ...card, padding: 20 }}>
            <SectionHeader title="Admissões Recentes" />
            {loadingColaboradores ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
            ) : recentAdmissions.length === 0 ? (
              <EmptyState text="Nenhuma admissão registrada" />
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

          <div style={{ ...card, padding: 20 }}>
            <SectionHeader
              title="Férias Pendentes"
              action="Ver todas"
              onAction={() => onNavigate?.("rh-ferias")}
            />
            {loadingFerias ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
            ) : ferias.length === 0 ? (
              <EmptyState text="Nenhuma solicitação pendente" />
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

        <div style={{ ...card, padding: 20 }}>
          <SectionHeader title="Distribuição por Departamento" />
          {loadingColaboradores ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Carregando...</div>
          ) : deptList.length === 0 ? (
            <EmptyState text="Sem dados de departamento" />
          ) : (
            <div
              className="rh-two-col"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 32px",
              }}
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
