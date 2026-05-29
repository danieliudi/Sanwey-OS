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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Sinais de Mercado
          </h1>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            {scopedSignals.length} sinais monitorados · adaptado ao contexto de cada empresa
          </p>
        </div>

        {/* Urgency filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {URGENCY_FILTERS.map(f => {
            const active = urgencyFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setUrgencyFilter(f.key)}
                className="px-3.5 py-1.5 text-sm font-medium rounded-full border transition-all duration-150"
                style={{
                  background: active ? NEUTRAL.graphite : "#FFFFFF",
                  color: active ? "#FFFFFF" : NEUTRAL.slate,
                  borderColor: active ? NEUTRAL.graphite : "#E0E0E0",
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "#B0B0B0";
                    e.currentTarget.style.background = "#F5F5F5";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "#E0E0E0";
                    e.currentTarget.style.background = "#FFFFFF";
                  }
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Signal cards grid */}
      <div className="grid md:grid-cols-2 gap-3">
        {scopedSignals.map(s => (
          <div
            key={s.id}
            className="p-5 rounded-xl border transition-all duration-150 cursor-default"
            style={{
              background: "#FFFFFF",
              borderColor: "#E5E7EB",
              borderLeftWidth: 4,
              borderLeftColor: COMPANIES[s.company]?.primary || NEUTRAL.slate,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
              e.currentTarget.style.borderColor = "#D0D0D0";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
              e.currentTarget.style.borderColor = "#E5E7EB";
            }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" size="sm">{s.source}</Badge>
                {isGroupView && <CompanyTag companyId={s.company} />}
              </div>
              <UrgencyTag urgency={s.urgency} />
            </div>
            <h3 className="font-semibold mb-2 leading-snug" style={{ fontSize: 14, color: NEUTRAL.graphite }}>
              {s.title}
            </h3>
            <p className="text-sm leading-relaxed mb-3" style={{ color: NEUTRAL.slate }}>
              {s.excerpt}
            </p>
            <div
              className="flex items-center justify-between text-xs pt-3 border-t"
              style={{ borderColor: "#F0F0F0", color: NEUTRAL.slate }}
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
