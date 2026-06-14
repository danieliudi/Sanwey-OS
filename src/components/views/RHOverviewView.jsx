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
import { NEUTRAL } from "../../constants/companies";
import {
  RH_DEPARTMENTS,
  RH_CONTRACT_TYPES,
  RH_EMPLOYEE_STATUSES,
  RH_RECRUITMENT_STAGES,
} from "../../constants/rh-config";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

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

function stageInfo(stageId) {
  return (
    RH_RECRUITMENT_STAGES.find((s) => s.id === stageId) || {
      name: stageId || "—",
      color: "var(--text-dim)",
    }
  );
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

export function RHOverviewView({ currentUser, users, canWrite, onNavigate }) {
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
      .neq("stage", "reprovado")
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

  const totalFuncionarios = users.length;
  const totalAtivos = users.filter(
    (u) => !u.employee_status || u.employee_status === "ativo"
  ).length;
  const totalFerias = users.filter((u) => u.employee_status === "ferias").length;
  const totalAfastados = users.filter(
    (u) => u.employee_status === "afastado"
  ).length;

  const recentAdmissions = [...users]
    .filter((u) => u.admission_date)
    .sort(
      (a, b) =>
        new Date(b.admission_date).getTime() -
        new Date(a.admission_date).getTime()
    )
    .slice(0, 5);

  const deptMap = {};
  users.forEach((u) => {
    const dept = u.department || "Não definido";
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
      icon: <UserCheck size={20} color="#16A34A" />,
      accent: "#16A34A",
    },
    {
      label: "De Férias",
      value: totalFerias,
      icon: <Calendar size={20} color="#1E4D8C" />,
      accent: "#1E4D8C",
    },
    {
      label: "Afastados",
      value: totalAfastados,
      icon: <UserMinus size={20} color="#D97706" />,
      accent: "#D97706",
    },
  ];

  const card = {
    background: "#FFF",
    border: `1px solid ${"var(--border)"}`,
    borderRadius: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
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
                    background: "var(--color-industria)"Tint,
                    color: "var(--color-industria)",
                    border: `1px solid ${"var(--color-industria)"}33`,
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
                    const stage = stageInfo(vaga.stage);
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
            {recentAdmissions.length === 0 ? (
              <EmptyState text="Nenhuma admissão registrada" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recentAdmissions.map((u) => (
                  <div
                    key={u.id}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <Avatar name={u.name} bg={u.avatarBg} size={34} />
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
                        {u.name || "—"}
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
                        {u.job_title || u.department || "—"}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        flexShrink: 0,
                      }}
                    >
                      {fmt(u.admission_date)}
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
                        background: NEUTRAL.amberBg,
                        border: `1px solid ${NEUTRAL.amber}33`,
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
                        <Clock size={12} color={NEUTRAL.amber} />
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
                              color: NEUTRAL.amber,
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
          {deptList.length === 0 ? (
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
