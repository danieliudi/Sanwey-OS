import React, { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { Badge } from "../ui/Badge";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { EmptyState } from "../ui/EmptyState";

const URGENCY_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "critico", label: "Crítico" },
  { key: "alto", label: "Alto" },
  { key: "medio", label: "Médio" },
  { key: "informativo", label: "Info" },
];

export function SignalsView({ activeCompany, signals }) {
  const isGroupView = activeCompany === "all";
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  const scopedSignals = useMemo(() => {
    let s = isGroupView ? signals : signals.filter(x => x.company === activeCompany);
    if (urgencyFilter !== "all") s = s.filter(x => x.urgency === urgencyFilter);
    return s;
  }, [signals, activeCompany, isGroupView, urgencyFilter]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Sinais de Mercado
          </h1>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            {scopedSignals.length} sinais monitorados · adaptado ao contexto de cada empresa
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {URGENCY_FILTERS.map(f => {
            const active = urgencyFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setUrgencyFilter(f.key)}
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm border"
                style={{
                  background: active ? NEUTRAL.graphite : "#FFFFFF",
                  color: active ? "#FFFFFF" : NEUTRAL.slate,
                  borderColor: active ? NEUTRAL.graphite : "#EFEFEF",
                  letterSpacing: "0.08em",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {scopedSignals.map(s => (
          <div
            key={s.id}
            className="p-5 rounded-sm border transition-all hover:shadow-md"
            style={{
              background: "#FFFFFF",
              borderColor: "#EFEFEF",
              borderLeftWidth: 4,
              borderLeftColor: COMPANIES[s.company]?.primary || NEUTRAL.slate,
            }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" size="sm">{s.source}</Badge>
                {isGroupView && <CompanyTag companyId={s.company} />}
              </div>
              <UrgencyTag urgency={s.urgency} />
            </div>
            <h3 className="font-bold mb-2 leading-snug" style={{ fontSize: 14, color: NEUTRAL.graphite }}>
              {s.title}
            </h3>
            <p className="text-sm leading-relaxed mb-3" style={{ color: NEUTRAL.slate }}>
              {s.excerpt}
            </p>
            <div
              className="flex items-center justify-between text-xs pt-3 border-t"
              style={{ borderColor: "#EFEFEF", color: NEUTRAL.slate }}
            >
              <span>{s.affectedCount} afetad{s.affectedCount === 1 ? "a" : "as"}</span>
              <span>{s.date}</span>
            </div>
          </div>
        ))}
      </div>

      {scopedSignals.length === 0 && (
        <EmptyState
          icon={Bell}
          title="Nenhum sinal no filtro atual"
          description="Ajuste os filtros para ver mais sinais."
        />
      )}
    </div>
  );
}

export default SignalsView;
